"""Behavioral contract for the read-only Product Intake worker health observer."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


OBSERVER = Path(__file__).resolve().parents[1] / "deploy/product-intake/worker-health.py"


class RecordingServer(ThreadingHTTPServer):
    heartbeat = []
    heartbeat_status = 200
    envelopes = []
    envelope_status = 200


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(self.server.heartbeat_status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(self.server.heartbeat).encode())

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
            "started_at": "2026-01-01T00:00:00Z",
            "last_seen_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

    def expire_grace(self):
        payload = json.loads(self.state.read_text())
        payload["first_observed_at_ms"] = 0
        payload["last_healthy_at_ms"] = 0
        self.state.write_text(json.dumps(payload))

    def run_monitor(self):
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
        result = subprocess.run([sys.executable, str(OBSERVER)], env=env, capture_output=True, text=True, timeout=10)
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
        self.assertEqual(result["reasons"], ["heartbeat_read_failed"])
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


if __name__ == "__main__":
    unittest.main()
