"""Behavioral contract for the read-only Product Intake worker health observer."""
import json
import importlib.util
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse


OBSERVER = Path(__file__).resolve().parents[1] / "deploy/product-intake/worker-health.py"


def observer_module():
    spec = importlib.util.spec_from_file_location("worker_health_test_module", OBSERVER)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(module)
    return module


class RecordingServer(ThreadingHTTPServer):
    heartbeat = []
    heartbeat_status = 200
    envelopes = []
    envelope_status = 200
    claimable = []
    outcomes = []


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)
        if parsed.path.endswith("product_intake_research_jobs"):
            body = self.server.outcomes if "progress->>worker_id" in query else self.server.claimable
        else:
            body = self.server.heartbeat
        self.send_response(self.server.heartbeat_status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(body).encode())

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", "0"))).decode()
        self.server.envelopes.append(body)
        self.send_response(self.server.envelope_status)
        self.end_headers()

    def log_message(self, _format, *_args):
        pass


class WorkerHealthTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.release = self.root / "release"
        self.release.mkdir()
        self.current = self.root / "current"
        self.current.symlink_to(self.release)
        self.release_env = self.root / "release.env"
        self.release_env.write_text("PRODUCT_INTAKE_RELEASE_SHA=verified-sha\n")
        self.state = self.root / "state.json"
        self.heavy = self.root / "heavy.json"
        self.proc = self.root / "proc"
        process = self.proc / "234"
        process.mkdir(parents=True)
        (process / "cwd").symlink_to(self.release)
        (process / "environ").write_bytes(b"PRODUCT_INTAKE_RELEASE_SHA=verified-sha\0")
        self.systemctl = self.root / "systemctl"
        self.set_systemd("active", "running")
        self.server = RecordingServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.server.heartbeat = [self.fresh_row()]
        self.server.heartbeat_status = 200
        self.server.envelopes = []
        self.server.envelope_status = 200
        self.server.claimable = []
        self.server.outcomes = []

    def tearDown(self):
        self.server.shutdown()
        self.thread.join(timeout=2)
        self.server.server_close()
        self.tmp.cleanup()

    def set_systemd(self, active, substate):
        # Deliberately reordered: `systemctl show` does not promise --value line order.
        self.systemctl.write_text(
            f"#!/bin/sh\nprintf 'MainPID=234\\nSubState={substate}\\nActiveEnterTimestampMonotonic=1\\nActiveState={active}\\n'\n"
        )
        self.systemctl.chmod(0o755)

    def fresh_row(self):
        return {
            "host": os.uname().nodename,
            "pid": 234,
            "release_sha": "verified-sha",
            "worker_id": f"codex-worker:{os.uname().nodename}:234",
            "started_at": "2026-01-01T00:00:00Z",
            "last_seen_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

    def expire_grace(self):
        payload = json.loads(self.state.read_text())
        payload["first_observed_at_ms"] = 0
        payload["last_healthy_at_ms"] = 0
        self.state.write_text(json.dumps(payload))

    def run_monitor(self, disk_free=50):
        port = self.server.server_address[1]
        env = dict(
            os.environ,
            NEXT_PUBLIC_SUPABASE_URL=f"http://127.0.0.1:{port}",
            SUPABASE_SERVICE_ROLE_KEY="private-service-secret",
            NEXT_PUBLIC_SENTRY_DSN=f"http://public@127.0.0.1:{port}/99",
            CHAARLIE_PRODUCT_INTAKE_CURRENT=str(self.current),
            CHAARLIE_PRODUCT_INTAKE_RELEASE_ENV=str(self.release_env),
            CHAARLIE_WORKER_HEALTH_STATE_PATH=str(self.state),
            CHAARLIE_HEAVY_STATE_PATH=str(self.heavy),
            CHAARLIE_WORKER_HEALTH_PROC_ROOT=str(self.proc),
            CHAARLIE_WORKER_HEALTH_SYSTEMCTL=str(self.systemctl),
        )
        runner = (
            "import runpy, shutil, sys; "
            f"shutil.disk_usage=lambda _path: shutil._ntuple_diskusage(100, {100 - disk_free}, {disk_free}); "
            "runpy.run_path(sys.argv[1], run_name='__main__')"
        )
        result = subprocess.run([sys.executable, "-c", runner, str(OBSERVER)], env=env, capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn("private-service-secret", result.stdout + result.stderr)
        return json.loads(result.stdout)

    def test_stopped_or_stale_worker_alerts_once_then_recovers(self):
        self.assertEqual(self.run_monitor()["status"], "healthy")
        self.expire_grace()
        stale = self.fresh_row()
        stale["last_seen_at"] = "2020-01-01T00:00:00Z"
        self.server.heartbeat = [stale]
        first = self.run_monitor()
        self.assertEqual(first["status"], "unhealthy")
        self.assertIn("heartbeat_stale", first["reasons"])
        self.assertEqual(len(self.server.envelopes), 1)
        self.assertIn("product_intake_admin_alert_worker_health_requires_attention", self.server.envelopes[0])
        self.assertNotIn("private-service-secret", self.server.envelopes[0])
        event = json.loads(self.server.envelopes[0].splitlines()[2])
        self.assertEqual(event["environment"], "production")
        self.assertEqual(event["fingerprint"][0], "product-intake-worker-health")
        self.assertRegex(event["fingerprint"][1], r"^[0-9a-f]{32}$")
        self.assertEqual(event["fingerprint"][2:], ["heartbeat_stale"])
        self.assertEqual(self.run_monitor()["status"], "unhealthy")
        self.assertEqual(len(self.server.envelopes), 1, "same unhealthy state is deduplicated")
        self.server.heartbeat = [self.fresh_row()]
        recovered = self.run_monitor()
        self.assertEqual(recovered["status"], "healthy")
        self.assertTrue(recovered["recovery"])
        self.set_systemd("inactive", "dead")
        self.expire_grace()
        stopped = self.run_monitor()
        self.assertEqual(stopped["status"], "unhealthy")
        self.assertIn("worker_not_running", stopped["reasons"])
        self.assertEqual(len(self.server.envelopes), 2)
        stopped_event = json.loads(self.server.envelopes[1].splitlines()[2])
        self.assertNotEqual(event["fingerprint"][1], stopped_event["fingerprint"][1])

    def test_failed_heartbeat_read_alerts_without_waiting_for_stale_grace(self):
        self.assertEqual(self.run_monitor()["status"], "healthy")
        self.server.heartbeat_status = 500
        result = self.run_monitor()
        self.assertEqual(result["status"], "unhealthy")
        self.assertIn("heartbeat_read_failed", result["reasons"])
        self.assertEqual(len(self.server.envelopes), 1)

    def test_malformed_unconfirmed_sidecar_is_sanitized_and_alerted(self):
        unresolved = self.heavy.with_name(self.heavy.name + ".unconfirmed")
        unresolved.write_text("[]")
        result = self.run_monitor()
        self.assertEqual(result["status"], "unhealthy")
        self.assertEqual(result["reasons"], ["heavy_stage_unresolved"])
        self.assertEqual(len(self.server.envelopes), 1)

    def test_failed_sentry_delivery_is_retried_for_the_same_incident(self):
        self.assertEqual(self.run_monitor()["status"], "healthy")
        self.expire_grace()
        stale = self.fresh_row()
        stale["last_seen_at"] = "2020-01-01T00:00:00Z"
        self.server.heartbeat = [stale]
        self.server.envelope_status = 500
        self.assertEqual(self.run_monitor()["status"], "unhealthy")
        first = json.loads(self.state.read_text())
        self.assertIsNone(first["notified_signature"])
        self.server.envelope_status = 200
        self.assertEqual(self.run_monitor()["status"], "unhealthy")
        second = json.loads(self.state.read_text())
        self.assertEqual(second["notified_signature"], "heartbeat_stale")
        self.assertEqual(first["incident_id"], second["incident_id"])
        self.assertEqual(len(self.server.envelopes), 2)
        self.assertNotIn("private-service-secret", self.server.envelopes[0])

    def test_normal_heavy_marker_is_ignored_but_explicit_unconfirmed_sidecar_alerts(self):
        self.heavy.write_text(json.dumps({"version": 1, "kind": "price-audit"}))
        self.assertEqual(self.run_monitor()["status"], "healthy")
        self.expire_grace()
        unresolved = self.heavy.with_name(self.heavy.name + ".unconfirmed")
        unresolved.write_text(json.dumps({"version": 1, "reason": "HEAVY_STAGE_UNCONFIRMED", "detected_at_ms": 1}))
        result = self.run_monitor()
        self.assertEqual(result["status"], "unhealthy")
        self.assertIn("heavy_stage_unresolved", result["reasons"])
        self.assertEqual(len(self.server.envelopes), 1)

    def claimable_row(self, **overrides):
        return {
            "status": "queued",
            "attempt_count": 0,
            "max_attempts": 3,
            "next_run_at": "2020-01-01T00:00:00Z",
            "locked_at": None,
            "created_at": "2020-01-01T00:00:00Z",
            "submission": {"status": "researching"},
            **overrides,
        }

    def outcome(self, status, error_code=None):
        return {"status": status, "updated_at": "2026-10-16T10:00:00Z", "error_code": error_code}

    def test_only_old_claimable_queue_work_alerts(self):
        self.assertEqual(self.run_monitor()["status"], "healthy")
        self.expire_grace()
        self.server.claimable = [self.claimable_row(attempt_count=3, max_attempts=3)]
        self.assertEqual(self.run_monitor()["status"], "healthy", "exhausted historical queue row is not claimable")
        self.server.claimable = [self.claimable_row()]
        result = self.run_monitor()
        self.assertEqual(result["status"], "unhealthy")
        self.assertEqual(result["reasons"], ["claimable_queue_aged"])

    def test_current_worker_failure_streak_and_auth_reset_on_nonfailure_or_new_worker(self):
        self.assertEqual(self.run_monitor()["status"], "healthy")
        self.expire_grace()
        self.server.outcomes = [self.outcome("failed"), self.outcome("failed"), self.outcome("failed")]
        failed = self.run_monitor()
        self.assertIn("consecutive_job_failures", failed["reasons"])
        self.server.outcomes = [self.outcome("waiting_for_review"), self.outcome("failed"), self.outcome("failed")]
        self.assertEqual(self.run_monitor()["status"], "healthy")
        self.server.outcomes = [self.outcome("blocked", "infra_auth")]
        auth = self.run_monitor()
        self.assertEqual(auth["reasons"], ["infra_auth"])
        new_worker = self.fresh_row()
        new_worker["worker_id"] = "codex-worker:new-host:999"
        self.server.heartbeat = [new_worker]
        self.server.outcomes = []
        self.assertEqual(self.run_monitor()["status"], "healthy")

    def test_disk_threshold_is_strict_and_sanitized(self):
        self.assertEqual(self.run_monitor(disk_free=15)["status"], "healthy")
        result = self.run_monitor(disk_free=14)
        self.assertEqual(result["status"], "unhealthy")
        self.assertEqual(result["reasons"], ["disk_low"])
        event = json.loads(self.server.envelopes[0].splitlines()[2])
        self.assertEqual(event["contexts"]["product_intake_worker_health"], {"reasons": ["disk_low"]})

    def test_stale_running_job_requires_a_due_next_run_and_saturation_is_not_silently_healthy(self):
        self.assertEqual(self.run_monitor()["status"], "healthy")
        self.expire_grace()
        self.server.claimable = [
            self.claimable_row(status="running", locked_at="2020-01-01T00:00:00Z", next_run_at="2999-01-01T00:00:00Z")
        ]
        self.assertEqual(self.run_monitor()["status"], "healthy")
        self.server.claimable = [self.claimable_row(attempt_count=3, max_attempts=3) for _ in range(100)]
        result = self.run_monitor()
        self.assertEqual(result["status"], "unhealthy")
        self.assertEqual(result["reasons"], ["queue_health_incomplete"])

    def test_queue_age_measures_wait_since_due_not_original_submission_creation(self):
        self.assertEqual(self.run_monitor()["status"], "healthy")
        self.expire_grace()
        fresh_due = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        self.server.claimable = [self.claimable_row(created_at="2020-01-01T00:00:00Z", next_run_at=fresh_due)]
        self.assertEqual(self.run_monitor()["status"], "healthy")

    def test_queue_age_boundary_and_saturated_aged_hit(self):
        module = observer_module()
        observed = 10_000_000
        self.assertFalse(module.is_aged_claimable("1970-01-01T00:46:40Z", observed))
        self.assertTrue(module.is_aged_claimable("1970-01-01T00:46:39.999Z", observed))
        self.assertEqual(self.run_monitor()["status"], "healthy")
        self.expire_grace()
        self.server.claimable = [self.claimable_row()] + [self.claimable_row(attempt_count=3, max_attempts=3) for _ in range(99)]
        result = self.run_monitor()
        self.assertEqual(result["reasons"], ["claimable_queue_aged"])

    def test_request_budget_fails_closed_when_exhausted(self):
        module = observer_module()
        budget = module.RequestBudget()
        budget.deadline = module.time.monotonic() - 1
        with self.assertRaisesRegex(module.HealthReadError, "operational_read_failed"):
            budget.timeout()


if __name__ == "__main__":
    unittest.main()
