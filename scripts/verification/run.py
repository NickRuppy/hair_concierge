#!/usr/bin/env python3
"""One per-user slot for expensive coding checks, with bounded child cleanup."""

import fcntl
import math
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import time


def seconds(name, default, allow_zero=False):
    value = float(os.environ.get(name, default))
    if not math.isfinite(value) or value < 0 or (value == 0 and not allow_zero):
        raise ValueError(f"{name} must be {'nonnegative' if allow_zero else 'positive'} and finite")
    return value


def command_for(args):
    if args and args[0] == "--node-tests":
        files = args[1:]
        if not files or not any(Path(arg).is_file() for arg in files):
            raise ValueError("Node test mode requires explicit existing test files; use test:node for the full suite")
        if any(arg.startswith("--test-concurrency") for arg in files):
            raise ValueError("Set CODING_TEST_CONCURRENCY instead of passing --test-concurrency")
        workers = os.environ.get("CODING_TEST_CONCURRENCY")
        if workers is None and os.environ.get("GITHUB_ACTIONS") != "true":
            workers = "2"
        flags = []
        if workers is not None:
            if not workers.isdigit() or int(workers) < 1:
                raise ValueError("CODING_TEST_CONCURRENCY must be a positive integer")
            flags = [f"--test-concurrency={workers}"]
        node = shutil.which("node")
        if not node:
            raise ValueError("node is not available on PATH")
        return [node, "--import", "./tests/server-only-register.cjs", "--import", "tsx", "--test", *flags, *files]
    if args and args[0] == "--":
        args = args[1:]
    if not args:
        raise ValueError("Usage: coding-check -- <command> [args...] or run.py --node-tests <files...>")
    return args


def group_exists(pgid):
    try:
        os.killpg(pgid, 0)
        return True
    except ProcessLookupError:
        return False


def stop_group(child):
    """The immediate child may exit before its own children; clean the whole group."""
    try:
        os.killpg(child.pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    deadline = time.monotonic() + 1
    while time.monotonic() < deadline:
        child.poll()
        if not group_exists(child.pid):
            break
        time.sleep(0.05)
    try:
        os.killpg(child.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    child.wait(timeout=5)


def main():
    if os.environ.get("CODING_VERIFY_ACTIVE"):
        raise ValueError("Nested verification launcher: run the gated leaf directly; do not wrap gated npm scripts")
    command = command_for(sys.argv[1:])
    timeout = seconds("CODING_VERIFY_TIMEOUT_SECONDS", "1800")
    wait_timeout = seconds("CODING_VERIFY_WAIT_SECONDS", "1800", allow_zero=True)
    cancelled = []

    def cancel(signum, _frame):
        cancelled.append(signum)

    for signum in (signal.SIGINT, signal.SIGTERM, signal.SIGHUP):
        signal.signal(signum, cancel)

    lock_dir = Path(os.environ.get("CODING_VERIFY_LOCK_DIR", Path.home() / ".cache/coding-verification"))
    lock_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    # Never unlink this file: a second inode would create a second independent slot.
    fd = os.open(lock_dir / "slot.lock", os.O_CREAT | os.O_RDWR, 0o600)
    with os.fdopen(fd, "r+") as lock:
        bypass = os.environ.get("CODING_VERIFY_BYPASS") == "1"
        if bypass:
            print("[verification] WARNING: explicit emergency slot bypass is active", file=sys.stderr, flush=True)
        else:
            deadline = time.monotonic() + wait_timeout
            next_notice = 0
            while True:
                if cancelled:
                    return 128 + cancelled[0]
                try:
                    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                    break
                except BlockingIOError:
                    now = time.monotonic()
                    if now >= deadline:
                        print("[verification] Slot busy; finish the other heavy check, then retry", file=sys.stderr)
                        return 124
                    if now >= next_notice:
                        print("[verification] Waiting for the machine-wide heavy-check slot…", file=sys.stderr, flush=True)
                        next_notice = now + 30
                    time.sleep(min(0.1, deadline - now))
        if cancelled:
            return 128 + cancelled[0]
        print(f"[verification] Running {Path(command[0]).name} in {Path.cwd()}", file=sys.stderr, flush=True)
        env = dict(os.environ, CODING_VERIFY_ACTIVE="1")
        # The direct job also owns the lock descriptor if this supervisor is killed.
        child = subprocess.Popen(command, env=env, start_new_session=True, pass_fds=(lock.fileno(),))
        deadline = time.monotonic() + timeout
        try:
            while child.poll() is None:
                if cancelled:
                    return 128 + cancelled[0]
                if time.monotonic() >= deadline:
                    print("[verification] Execution deadline reached; stopping job and children", file=sys.stderr, flush=True)
                    return 124
                time.sleep(0.05)
            return child.returncode if child.returncode >= 0 else 128 - child.returncode
        finally:
            if group_exists(child.pid):
                stop_group(child)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ValueError, OSError, subprocess.TimeoutExpired) as error:
        print(f"[verification] {error}", file=sys.stderr)
        sys.exit(2)
