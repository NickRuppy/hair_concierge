#!/usr/bin/env python3
"""Process-level contract tests for the local heavy-verification launcher."""

from __future__ import annotations

import os
import json
import fcntl
import signal
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path


RUNNER = Path(__file__).with_name("run.py")
PYTHON = sys.executable


def wait_for(path: Path, timeout: float = 3.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if path.exists():
            return
        time.sleep(0.02)
    raise AssertionError(f"timed out waiting for {path}")


class VerificationRunnerTests(unittest.TestCase):
    """Exercise the public CLI against real, short-lived child processes."""

    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.lock_dir = self.root / "shared-lock"
        self.work_one = self.root / "work-one"
        self.work_two = self.root / "work-two"
        self.work_one.mkdir()
        self.work_two.mkdir()
        self.processes: list[subprocess.Popen[str]] = []

    def tearDown(self) -> None:
        for process in self.processes:
            if process.poll() is None:
                process.kill()
                try:
                    process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    pass
            try:
                process.communicate(timeout=0.2)
            except subprocess.TimeoutExpired:
                # A failed launcher may leave a descendant holding these pipes.
                for stream in (process.stdout, process.stderr):
                    if stream is not None:
                        stream.close()
        self.temp.cleanup()

    def write_program(self, name: str, source: str) -> Path:
        path = self.root / name
        path.write_text(source, encoding="utf-8")
        return path

    def environment(self, **extra: str) -> dict[str, str]:
        env = os.environ.copy()
        env.pop("CODING_VERIFY_ACTIVE", None)
        env.update(
            {
                "CODING_VERIFY_LOCK_DIR": str(self.lock_dir),
                "CODING_VERIFY_TIMEOUT_SECONDS": "5",
                "CODING_VERIFY_WAIT_SECONDS": "5",
            }
        )
        env.update(extra)
        return env

    def launch(
        self,
        *command: str,
        cwd: Path | None = None,
        env: dict[str, str] | None = None,
    ) -> subprocess.Popen[str]:
        process = subprocess.Popen(
            [PYTHON, str(RUNNER), *command],
            cwd=cwd or self.work_one,
            env=env or self.environment(),
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        self.processes.append(process)
        return process

    def invoke(
        self, *command: str, cwd: Path | None = None, env: dict[str, str] | None = None
    ) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [PYTHON, str(RUNNER), *command],
            cwd=cwd or self.work_one,
            env=env or self.environment(),
            text=True,
            capture_output=True,
            timeout=8,
            check=False,
        )

    def test_jobs_from_distinct_workdirs_do_not_overlap(self) -> None:
        entered = self.root / "first-entered"
        release = self.root / "release-first"
        active = self.root / "active"
        first = self.write_program(
            "first.py",
            """from pathlib import Path
import sys, time
entered, release, active = map(Path, sys.argv[1:])
active.touch()
entered.touch()
while not release.exists(): time.sleep(0.02)
active.unlink()
""",
        )
        second = self.write_program(
            "second.py",
            """from pathlib import Path
import sys
active = Path(sys.argv[1])
if active.exists(): raise SystemExit(91)
""",
        )
        one = self.launch("--", PYTHON, str(first), str(entered), str(release), str(active))
        try:
            wait_for(entered)
            two = self.launch("--", PYTHON, str(second), str(active), cwd=self.work_two)
            time.sleep(0.12)
            self.assertIsNone(two.poll(), "second job began while first job held the shared slot")
            release.touch()
            self.assertEqual(one.wait(timeout=3), 0)
            self.assertEqual(two.wait(timeout=3), 0)
        finally:
            release.touch()

    def test_failure_code_is_preserved_and_releases_slot(self) -> None:
        failing = self.write_program("fail.py", "raise SystemExit(37)\n")
        succeeded = self.write_program("success.py", "raise SystemExit(0)\n")
        self.assertEqual(self.invoke("--", PYTHON, str(failing)).returncode, 37)
        self.assertEqual(self.invoke("--", PYTHON, str(succeeded)).returncode, 0)

    def test_busy_slot_fails_fast_without_starting_the_job(self) -> None:
        entered = self.root / "first-entered"
        release = self.root / "release-first"
        side_effect = self.root / "second-ran"
        first = self.write_program(
            "first.py",
            """from pathlib import Path
import sys, time
entered, release = map(Path, sys.argv[1:])
entered.touch()
while not release.exists(): time.sleep(0.02)
""",
        )
        second = self.write_program(
            "second.py",
            """from pathlib import Path
import sys
Path(sys.argv[1]).touch()
""",
        )
        one = self.launch("--", PYTHON, str(first), str(entered), str(release))
        try:
            wait_for(entered)
            started = time.monotonic()
            result = self.invoke(
                "--",
                PYTHON,
                str(second),
                str(side_effect),
                cwd=self.work_two,
                env=self.environment(CODING_VERIFY_WAIT_SECONDS="0"),
            )
            self.assertEqual(result.returncode, 124, result.stderr)
            self.assertLess(time.monotonic() - started, 1)
            self.assertFalse(side_effect.exists(), "busy-slot job should not have started")
        finally:
            release.touch()
            self.assertEqual(one.wait(timeout=3), 0)

    def test_sigterm_stops_ignoring_child_and_releases_slot(self) -> None:
        entered = self.root / "parent-entered"
        child_pid = self.root / "child.pid"
        child_ready = self.root / "child-ready"
        stubborn_parent = self.write_program(
            "stubborn-parent.py",
            """from pathlib import Path
import subprocess, sys, time
entered, child_pid, child_ready = map(Path, sys.argv[1:])
child = subprocess.Popen([sys.executable, '-c',
    'from pathlib import Path; import signal,sys,time; signal.signal(signal.SIGTERM, signal.SIG_IGN); Path(sys.argv[1]).touch(); time.sleep(30)',
    str(child_ready)])
child_pid.write_text(str(child.pid))
while not child_ready.exists(): time.sleep(0.01)
entered.touch()
time.sleep(30)
""",
        )
        succeeded = self.write_program("success.py", "raise SystemExit(0)\n")
        runner = self.launch(
            "--", PYTHON, str(stubborn_parent), str(entered), str(child_pid), str(child_ready)
        )
        pid: int | None = None
        try:
            wait_for(entered)
            pid = int(child_pid.read_text(encoding="utf-8"))
            runner.send_signal(signal.SIGTERM)
            self.assertNotEqual(runner.wait(timeout=4), 0)
            deadline = time.monotonic() + 3
            while time.monotonic() < deadline:
                try:
                    os.kill(pid, 0)
                except ProcessLookupError:
                    break
                time.sleep(0.03)
            else:
                self.fail("SIGTERM left the child process running")
            self.assertEqual(self.invoke("--", PYTHON, str(succeeded)).returncode, 0)
        finally:
            if pid is not None:
                try:
                    os.kill(pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass

    def test_execution_timeout_returns_124(self) -> None:
        child_pid = self.root / "timeout-child.pid"
        sleeper = self.write_program(
            "sleep.py",
            """from pathlib import Path
import os, sys, time
Path(sys.argv[1]).write_text(str(os.getpid()))
time.sleep(30)
""",
        )
        started = time.monotonic()
        try:
            result = self.invoke(
                "--",
                PYTHON,
                str(sleeper),
                str(child_pid),
                env=self.environment(CODING_VERIFY_TIMEOUT_SECONDS="0.2"),
            )
            self.assertEqual(result.returncode, 124, result.stderr)
            self.assertLess(time.monotonic() - started, 4)
        finally:
            if child_pid.exists():
                try:
                    os.kill(int(child_pid.read_text(encoding="utf-8")), signal.SIGKILL)
                except ProcessLookupError:
                    pass

    def test_nested_runner_fails_promptly_with_an_actionable_error(self) -> None:
        started = time.monotonic()
        result = self.invoke(
            "--",
            PYTHON,
            "-c",
            "raise SystemExit(0)",
            env=self.environment(CODING_VERIFY_ACTIVE="1"),
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("nested", (result.stdout + result.stderr).lower())
        self.assertLess(time.monotonic() - started, 3)

    def test_hosted_build_needs_no_python_and_preserves_flags_and_failure(self) -> None:
        # A real Next build is expensive; replace only the external Next CLI.
        # PATH intentionally contains no Python, unlike the local supervisor path.
        node = shutil.which("node")
        self.assertIsNotNone(node)
        executable = self.root / "next"
        executable.write_text(
            '#!/bin/sh\n[ "$1" = build ] && [ "$2" = --webpack ] || exit 91\n'
            'printf "hosted build reached Next\\n"\nexit 37\n'
        )
        executable.chmod(0o700)
        result = subprocess.run(
            [node, str(RUNNER.with_name("build.mjs")), "--webpack"],
            env=dict(self.environment(), VERCEL="1", PATH=str(self.root)),
            text=True,
            capture_output=True,
            timeout=5,
        )
        self.assertEqual(result.returncode, 37, result.stderr)
        self.assertIn("hosted build reached Next", result.stdout)

    def test_status_shows_active_owner_and_idle_after_release(self) -> None:
        entered = self.root / "status-entered"
        release = self.root / "status-release"
        program = self.write_program(
            "status-owner.py",
            "from pathlib import Path\nimport sys,time\n"
            "entered,release=map(Path,sys.argv[1:])\nentered.touch()\n"
            "while not release.exists(): time.sleep(0.02)\n",
        )
        owner = self.launch("--", PYTHON, str(program), str(entered), str(release))
        try:
            wait_for(entered)
            result = self.invoke("--status")
            self.assertEqual(result.returncode, 0, result.stderr)
            status = json.loads(result.stdout)
            self.assertEqual(status["state"], "running")
            self.assertEqual(status["pid"], owner.pid)
            self.assertEqual(status["cwd"], str(self.work_one.resolve()))
            self.assertEqual(status["command"], Path(PYTHON).name)
            self.assertNotIn(str(program), result.stdout)
            bypass = self.invoke(
                "--", PYTHON, "-c", "pass", env=self.environment(CODING_VERIFY_BYPASS="1")
            )
            self.assertEqual(bypass.returncode, 0, bypass.stderr)
            self.assertEqual(json.loads(self.invoke("--status").stdout)["pid"], owner.pid)
        finally:
            release.touch()
            owner.wait(timeout=3)
        self.assertEqual(json.loads(self.invoke("--status").stdout), {"state": "idle"})

    def test_idle_status_probes_do_not_report_each_other_as_jobs(self) -> None:
        self.lock_dir.mkdir()
        with (self.lock_dir / "slot.lock").open("w+") as another_status_probe:
            fcntl.flock(another_status_probe, fcntl.LOCK_SH | fcntl.LOCK_NB)
            result = self.invoke("--status")
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout), {"state": "idle"})

    def test_status_ignores_stale_sidecar_when_kernel_lock_is_free(self) -> None:
        self.lock_dir.mkdir()
        (self.lock_dir / "slot.lock").touch()
        (self.lock_dir / "current.json").write_text(
            json.dumps({"pid": os.getpid(), "cwd": str(self.work_one), "command": "stale"})
        )
        result = self.invoke("--status")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), {"state": "idle"})

if __name__ == "__main__":
    unittest.main()
