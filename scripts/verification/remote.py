#!/usr/bin/env python3
"""Opt-in committed-tree remote executor for explicit focused Node tests."""

from __future__ import annotations

import argparse
from pathlib import Path
import shlex
import subprocess
import sys
import tarfile
import tempfile

HOST = "chaarlie-hetzner"
IMAGE = "node:22-bookworm-slim"
TEST_SUFFIXES = (".test.ts", ".test.tsx", ".spec.ts")
UNSAFE_GLOB = set("*?[]{}")
SENSITIVE_PARTS = {"credentials", "credential", "secrets", "secret", "private-keys", "private_keys"}
SSH_OPTIONS = ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-o", "ConnectTimeout=15"]


def repository() -> Path:
    return Path(subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip())


def git(root: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(["git", *args], cwd=root, text=True, capture_output=True, check=False)


def excluded(path: str) -> bool:
    """Do not transfer local environment configuration or credentials."""
    parts = Path(path).parts
    name = parts[-1] if parts else ""
    return (
        name.startswith(".env")
        or name.endswith((".pem", ".key", ".p12", ".pfx"))
        or name in {"id_rsa", "id_ed25519", "id_ecdsa", ".npmrc", ".netrc", ".git-credentials", "credentials.json", "service-account.json"}
        or any(part.lower() in SENSITIVE_PARTS for part in parts)
    )


def validate_tests(root: Path, raw_tests: list[str]) -> list[str]:
    if not raw_tests:
        raise ValueError("provide one or more explicit tracked test files")
    valid: list[str] = []
    for raw in raw_tests:
        candidate = Path(raw)
        if raw.startswith("-") or any(char in raw for char in UNSAFE_GLOB):
            raise ValueError(f"test path must be an explicit file, not a flag or glob: {raw}")
        if candidate.is_absolute() or ".." in candidate.parts or not raw.startswith("tests/"):
            raise ValueError(f"test path must be a repository-relative tests/ path: {raw}")
        if not raw.endswith(TEST_SUFFIXES):
            raise ValueError(f"unsupported test extension: {raw}")
        local = root / candidate
        if local.is_symlink() or not local.is_file():
            raise ValueError(f"test file is missing or a symlink: {raw}")
        if git(root, "ls-files", "--error-unmatch", "--", raw).returncode:
            raise ValueError(f"test file is not tracked at HEAD: {raw}")
        if git(root, "ls-tree", "HEAD", "--", raw).stdout.startswith("120000 "):
            raise ValueError(f"test file is a symlink in HEAD: {raw}")
        valid.append(raw)
    return valid


def assert_clean_tracked(root: Path) -> None:
    if git(root, "diff", "--quiet", "HEAD", "--").returncode or git(root, "diff", "--cached", "--quiet").returncode:
        raise ValueError("remote tests require a committed snapshot; tracked changes are left untouched")


def source_sha(root: Path) -> str:
    result = git(root, "rev-parse", "HEAD")
    if result.returncode:
        raise ValueError("unable to identify HEAD")
    return result.stdout.strip()


def tracked_exclusions(root: Path) -> list[str]:
    return [path for path in git(root, "ls-tree", "-r", "--name-only", "HEAD").stdout.splitlines() if excluded(path)]


def create_archive(root: Path, destination: Path, sha: str = "HEAD") -> list[str]:
    """Write a HEAD-only archive, filtering forbidden tracked paths."""
    source = subprocess.Popen(["git", "archive", "--format=tar", sha], cwd=root, stdout=subprocess.PIPE)
    assert source.stdout is not None
    omissions: list[str] = []
    try:
        with tarfile.open(fileobj=source.stdout, mode="r|") as incoming, tarfile.open(destination, "w:gz") as outgoing:
            for member in incoming:
                if excluded(member.name):
                    omissions.append(member.name)
                    continue
                outgoing.addfile(member, incoming.extractfile(member) if member.isfile() else None)
    finally:
        source.stdout.close()
        archive_status = source.wait()
    if archive_status != 0:
        raise ValueError("git archive failed")
    return omissions


REMOTE_RUN = r'''set -eu
sha="$1"; image="$2"; shift 2
root="$HOME/.cache/coding-verification"
job=""
container="coding-verification-$(printf %.12s "$sha")-$$"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; [ -z "$job" ] || rm -rf "$job"; }
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
mkdir -p "$root"
exec 9>"$root/remote.lock"
flock -w 1800 9
available_kib=$(awk '/MemAvailable:/ {print $2}' /proc/meminfo)
disk_kib=$(df -Pk "$root" | awk 'NR==2 {print $4}')
[ -n "$available_kib" ] && [ "$available_kib" -ge 2097152 ] || { echo "remote memory headroom is below 2 GiB" >&2; exit 2; }
[ -n "$disk_kib" ] && [ "$disk_kib" -ge 5242880 ] || { echo "remote disk headroom is below 5 GiB" >&2; exit 2; }
job=$(mktemp -d "$root/job.XXXXXX")
cat > "$job/source.tar.gz"
mkdir "$job/work"
tar -xzf "$job/source.tar.gz" -C "$job/work" --no-same-owner --no-same-permissions
uid=$(id -u); gid=$(id -g)
docker pull "$image"
image_id=$(docker image inspect --format '{{.Id}}' "$image")
common=(--rm --name "$container" --cpus=1 --memory=1g --memory-swap=1g --pids-limit=128 --read-only --tmpfs /tmp:rw,noexec,nosuid,size=256m --user "$uid:$gid" -e HOME=/tmp -e HUSKY=0 -e CI=true -e npm_config_cache=/work/.npm-cache -e NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co -e NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder -e SUPABASE_SERVICE_ROLE_KEY=placeholder -e OPENAI_API_KEY=sk-placeholder -v "$job/work:/work" -w /work)
timeout --foreground 1800 docker run "${common[@]}" "$image_id" sh -c 'npm ci; status=$?; printf "install_peak_bytes=%s\n" "$(cat /sys/fs/cgroup/memory.peak 2>/dev/null || echo unknown)"; exit "$status"'
runtime=$(docker run "${common[@]}" --network none "$image_id" node --version)
if timeout --foreground 1800 docker run "${common[@]}" --network none "$image_id" sh -c 'node --import ./tests/server-only-register.cjs --import tsx --test --test-concurrency=1 "$@"; status=$?; printf "test_peak_bytes=%s\n" "$(cat /sys/fs/cgroup/memory.peak 2>/dev/null || echo unknown)"; exit "$status"' sh "$@"; then status=0; else status=$?; fi
printf 'remote receipt: commit=%s image=%s node=%s status=%s\n' "$sha" "$image_id" "$runtime" "$status"
exit "$status"
'''


def run_remote(root: Path, tests: list[str], sha: str) -> int:
    with tempfile.TemporaryDirectory(prefix="coding-verification-") as temp:
        archive = Path(temp) / "source.tar.gz"
        omissions = create_archive(root, archive, sha)
        print(f"[remote] archive commit={sha} excluded={len(omissions)}", file=sys.stderr)
        command = "timeout --kill-after=10s 1800s bash -c " + shlex.quote(REMOTE_RUN) + " -- " + " ".join(shlex.quote(arg) for arg in [sha, IMAGE, *tests])
        with archive.open("rb") as source:
            result = subprocess.run(
                ["ssh", *SSH_OPTIONS, HOST, command],
                stdin=source,
                timeout=1830,
                check=False,
            )
    return result.returncode


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="validate locally without contacting the host")
    parser.add_argument("tests", nargs="+")
    args = parser.parse_args(argv)
    root = repository()
    tests = validate_tests(root, args.tests)
    assert_clean_tracked(root)
    sha = source_sha(root)
    omissions = tracked_exclusions(root)
    print(f"source: committed HEAD {sha}")
    print(f"host: {HOST}; selected tests: {', '.join(tests)}")
    print(f"archive: tracked HEAD only; excluded paths: {', '.join(omissions) if omissions else 'none'}")
    print("remote plan: streamed archive enters only after flock and headroom checks; Node 22 slim; npm ci online; 1 CPU/1 GiB/no-swap Docker tests with network disabled")
    return 0 if args.dry_run else run_remote(root, tests, sha)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, OSError, subprocess.TimeoutExpired) as error:
        print(f"[remote verification] {error}", file=sys.stderr)
        raise SystemExit(2)
