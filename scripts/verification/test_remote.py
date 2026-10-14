#!/usr/bin/env python3
"""Local-only contracts for remote focused-test selection and archive filtering."""

from __future__ import annotations

import importlib.util
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location("remote", Path(__file__).with_name("remote.py"))
assert SPEC and SPEC.loader
remote = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(remote)


class RemoteVerificationInputTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "tests").mkdir()
        (self.root / "tests/example.test.ts").write_text("export {}\n", encoding="utf-8")
        (self.root / ".env.local").write_text("LOCAL_ONLY=1\n", encoding="utf-8")
        subprocess.run(["git", "init", "-q"], cwd=self.root, check=True)
        subprocess.run(["git", "add", "."], cwd=self.root, check=True)
        subprocess.run(
            ["git", "-c", "user.name=test", "-c", "user.email=test@example.invalid", "commit", "-qm", "fixture"],
            cwd=self.root,
            check=True,
        )

    def tearDown(self) -> None:
        self.temp.cleanup()

    def test_selected_file_must_be_tracked_head_test(self) -> None:
        self.assertEqual(remote.validate_tests(self.root, ["tests/example.test.ts"]), ["tests/example.test.ts"])
        (self.root / "tests/untracked.test.ts").write_text("export {}\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "not tracked"):
            remote.validate_tests(self.root, ["tests/untracked.test.ts"])

    def test_committed_source_identity_rejects_staged_and_unstaged_changes(self) -> None:
        test_file = self.root / "tests/example.test.ts"
        head = remote.source_sha(self.root)
        test_file.write_text("changed\n", encoding="utf-8")
        self.assertEqual(remote.source_sha(self.root), head)
        with self.assertRaisesRegex(ValueError, "committed snapshot"):
            remote.assert_clean_tracked(self.root)
        subprocess.run(["git", "add", "tests/example.test.ts"], cwd=self.root, check=True)
        with self.assertRaisesRegex(ValueError, "committed snapshot"):
            remote.assert_clean_tracked(self.root)

    def test_sensitive_archive_paths_are_excluded(self) -> None:
        for path in (".env.local", "apps/web/.env.production", "keys/service.pem", "secrets/token.txt", "id_ed25519", ".npmrc", ".netrc"):
            self.assertTrue(remote.excluded(path), path)
        self.assertFalse(remote.excluded("tests/example.test.ts"))
        self.assertFalse(remote.excluded("src/private-label.ts"))

    def test_archive_omits_env_but_keeps_selected_source(self) -> None:
        head = remote.source_sha(self.root)
        (self.root / "tests/example.test.ts").write_text("newer commit\n", encoding="utf-8")
        subprocess.run(["git", "add", "tests/example.test.ts"], cwd=self.root, check=True)
        subprocess.run(
            ["git", "-c", "user.name=test", "-c", "user.email=test@example.invalid", "commit", "-qm", "newer fixture"],
            cwd=self.root,
            check=True,
        )
        archive = self.root / "source.tar.gz"
        self.assertEqual(remote.create_archive(self.root, archive, head), [".env.local"])
        with tarfile.open(archive) as contents:
            self.assertEqual(sorted(contents.getnames()), ["tests", "tests/example.test.ts"])
            self.assertEqual(contents.extractfile("tests/example.test.ts").read(), b"export {}\n")

    def test_path_filter_rejects_shell_shaped_inputs(self) -> None:
        for path in ("--test-concurrency=8", "tests/*.test.ts", "tests/../secret.test.ts", "/tmp/x.test.ts"):
            with self.assertRaises(ValueError):
                remote.validate_tests(self.root, [path])


if __name__ == "__main__":
    unittest.main()
