#!/usr/bin/env python3
"""Read-only worker liveness observer for the Product Intake host.

This deliberately does not use Sentry cron monitors: the small systemd timer
checks the process and the durable Supabase heartbeat, then uses the existing
error-event allowance only when the observed unhealthy state changes.
"""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
import urllib.parse
import urllib.request
import uuid


WORKER_UNIT = os.environ.get("CHAARLIE_PRODUCT_INTAKE_WORKER_UNIT", "chaarlie-product-intake-worker.service")
CURRENT = Path(os.environ.get("CHAARLIE_PRODUCT_INTAKE_CURRENT", "/opt/chaarlie/product-intake/current"))
STATE_PATH = Path(
    os.environ.get(
        "CHAARLIE_WORKER_HEALTH_STATE_PATH",
        "/opt/chaarlie/product-intake/shared/worker-health-state.json",
    )
)
HEAVY_STATE_PATH = Path(
    os.environ.get(
        "CHAARLIE_HEAVY_STATE_PATH",
        "/opt/chaarlie/product-intake/shared/heavy-work-state.json",
    )
)
RELEASE_ENV = Path(
    os.environ.get("CHAARLIE_PRODUCT_INTAKE_RELEASE_ENV", "/opt/chaarlie/product-intake/shared/release.env")
)
PROC_ROOT = Path(os.environ.get("CHAARLIE_WORKER_HEALTH_PROC_ROOT", "/proc"))
SYSTEMCTL = os.environ.get("CHAARLIE_WORKER_HEALTH_SYSTEMCTL", "/usr/bin/systemctl")
STALE_MS = 10 * 60 * 1000
REQUEST_TIMEOUT_SECONDS = 8


class HealthReadError(Exception):
    pass


def now_ms():
    return int(time.time() * 1000)


def read_env_file(path):
    """Read only simple systemd EnvironmentFile assignments without logging values."""
    values = {}
    try:
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            if key and key.replace("_", "").isalnum():
                values[key] = value.strip().strip('"')
    except OSError as error:
        raise HealthReadError("release_identity_unavailable") from error
    return values


def systemd_properties():
    fields = ["ActiveState", "SubState", "MainPID", "ActiveEnterTimestampMonotonic"]
    try:
        result = subprocess.run(
            [SYSTEMCTL, "show", WORKER_UNIT, *[f"--property={field}" for field in fields]],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise HealthReadError("systemd_unavailable") from error
    if result.returncode:
        raise HealthReadError("systemd_unavailable")
    values = {}
    for line in result.stdout.splitlines():
        key, separator, value = line.partition("=")
        if separator:
            values[key] = value
    if any(field not in values for field in fields):
        raise HealthReadError("systemd_unavailable")
    try:
        pid = int(values["MainPID"])
        entered_monotonic_us = int(values["ActiveEnterTimestampMonotonic"])
    except ValueError as error:
        raise HealthReadError("systemd_unavailable") from error
    return {
        "active": values["ActiveState"] == "active" and values["SubState"] == "running",
        "pid": pid,
        "entered_monotonic_us": entered_monotonic_us,
    }


def process_identity(pid, expected_release):
    if pid <= 1:
        return {"matches": False, "reason": "worker_not_running"}
    try:
        cwd = Path(os.path.realpath(PROC_ROOT / str(pid) / "cwd"))
        environ = (PROC_ROOT / str(pid) / "environ").read_bytes().split(b"\0")
    except OSError:
        return {"matches": False, "reason": "worker_process_unavailable"}
    environment = {}
    for item in environ:
        key, separator, value = item.partition(b"=")
        if separator:
            environment[key.decode("utf-8", "ignore")] = value.decode("utf-8", "ignore")
    current = Path(os.path.realpath(CURRENT))
    actual_release = environment.get("PRODUCT_INTAKE_RELEASE_SHA")
    if cwd != current:
        return {"matches": False, "reason": "worker_cwd_mismatch"}
    if not expected_release or actual_release != expected_release:
        return {"matches": False, "reason": "worker_release_mismatch"}
    return {"matches": True, "release_sha": actual_release}


def read_heartbeat(host, pid):
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        raise HealthReadError("heartbeat_credentials_unavailable")
    query = urllib.parse.urlencode(
        {
            "select": "host,pid,release_sha,started_at,last_seen_at",
            "host": f"eq.{host}",
            "pid": f"eq.{pid}",
            "order": "last_seen_at.desc",
            "limit": "1",
        }
    )
    request = urllib.request.Request(
        f"{url}/rest/v1/product_intake_worker_heartbeats?{query}",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as error:  # Provider details must never enter a host log or Sentry event.
        raise HealthReadError("heartbeat_read_failed") from error
    if not isinstance(payload, list) or len(payload) > 1:
        raise HealthReadError("heartbeat_read_failed")
    return payload[0] if payload else None


def parse_timestamp_ms(value):
    if not isinstance(value, str):
        return None
    try:
        return int(__import__("datetime").datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp() * 1000)
    except ValueError:
        return None


def heavy_stage_reason(now):
    """Only the helper's explicit fail-closed sidecar is unhealthy.

    The normal marker represents a running stage and must never be inferred as
    a failure from age: price audit can legitimately own it for three hours.
    """
    unresolved = HEAVY_STATE_PATH.with_name(f"{HEAVY_STATE_PATH.name}.unconfirmed")
    if not unresolved.exists():
        return None
    try:
        marker = json.loads(unresolved.read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        return "heavy_stage_unresolved"
    if not isinstance(marker, dict) or marker.get("version") != 1 or marker.get("reason") != "HEAVY_STAGE_UNCONFIRMED":
        return "heavy_stage_unresolved"
    return "heavy_stage_unresolved"


def load_state(now):
    try:
        state = json.loads(STATE_PATH.read_text(encoding="utf-8"))
        if isinstance(state, dict) and state.get("version") == 1:
            return state
    except (OSError, ValueError):
        pass
    return {"version": 1, "first_observed_at_ms": now, "notified_signature": None, "last_status": "unknown"}


def save_state(state):
    STATE_PATH.parent.mkdir(mode=0o750, parents=True, exist_ok=True)
    temporary = STATE_PATH.with_name(f"{STATE_PATH.name}.{uuid.uuid4().hex}")
    try:
        temporary.write_text(json.dumps(state, separators=(",", ":")), encoding="utf-8")
        temporary.chmod(0o600)
        os.replace(temporary, STATE_PATH)
    finally:
        temporary.unlink(missing_ok=True)


def send_sentry(message, reasons, incident_id):
    dsn = os.environ.get("NEXT_PUBLIC_SENTRY_DSN", "").strip()
    if not dsn:
        return False
    parsed = urllib.parse.urlparse(dsn)
    project_id = parsed.path.strip("/").split("/")[-1]
    if parsed.scheme not in ("http", "https") or not parsed.hostname or not parsed.username or not project_id.isdigit():
        return False
    event_id = uuid.uuid4().hex
    endpoint = f"{parsed.scheme}://{parsed.hostname}"
    if parsed.port:
        endpoint += f":{parsed.port}"
    endpoint += f"/api/{project_id}/envelope/"
    event = {
        "event_id": event_id,
        "timestamp": time.time(),
        "message": {"formatted": message},
        "level": "error",
        "platform": "python",
        "environment": os.environ.get("NODE_ENV", "").strip() or "production",
        "fingerprint": ["product-intake-worker-health", incident_id, *sorted(reasons)],
        "tags": {"product_intake.monitor": "worker_health", "product_intake.status": "unhealthy"},
        "contexts": {"product_intake_worker_health": {"reasons": reasons}},
    }
    envelope = "\n".join(
        [
            json.dumps({"event_id": event_id, "dsn": dsn}),
            json.dumps({"type": "event", "content_type": "application/json"}),
            json.dumps(event),
            "",
        ]
    ).encode("utf-8")
    try:
        request = urllib.request.Request(endpoint, data=envelope, headers={"Content-Type": "application/x-sentry-envelope"}, method="POST")
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS):
            pass
        return True
    except Exception:
        return False


def main():
    observed = now_ms()
    state = load_state(observed)
    reasons = []
    try:
        expected_release = os.environ.get("PRODUCT_INTAKE_RELEASE_SHA") or read_env_file(RELEASE_ENV).get(
            "PRODUCT_INTAKE_RELEASE_SHA"
        )
        unit = systemd_properties()
        identity = process_identity(unit["pid"], expected_release)
        if not unit["active"]:
            reasons.append("worker_not_running")
        if not identity["matches"]:
            reasons.append(identity["reason"])
        heartbeat = read_heartbeat(socket.gethostname(), unit["pid"])
        heartbeat_at = parse_timestamp_ms(heartbeat.get("last_seen_at")) if isinstance(heartbeat, dict) else None
        if not heartbeat or heartbeat_at is None or observed - heartbeat_at > STALE_MS:
            reasons.append("heartbeat_stale")
        elif heartbeat.get("release_sha") != expected_release:
            reasons.append("heartbeat_release_mismatch")
    except HealthReadError as error:
        reasons.append(str(error))
    heavy_reason = heavy_stage_reason(observed)
    if heavy_reason:
        reasons.append(heavy_reason)

    signature = ",".join(sorted(set(reasons)))
    # The initial ten minutes and a still-fresh prior heartbeat cover systemd's 15s restart.
    prior_healthy = state.get("last_healthy_at_ms")
    in_grace = bool(signature) and (
        observed - int(state.get("first_observed_at_ms", observed)) < STALE_MS
        or (isinstance(prior_healthy, int) and observed - prior_healthy < STALE_MS)
    ) and "heavy_stage_unresolved" not in signature
    if not signature:
        state["last_healthy_at_ms"] = observed
        status = "healthy"
        recovery = state.get("last_status") == "unhealthy"
        state["notified_signature"] = None
        state.pop("incident_id", None)
    elif in_grace and "heartbeat_read_failed" not in signature and "heartbeat_credentials_unavailable" not in signature:
        status = "grace"
        recovery = False
    else:
        status = "unhealthy"
        recovery = False
        if state.get("last_status") != "unhealthy" or not isinstance(state.get("incident_id"), str):
            state["incident_id"] = uuid.uuid4().hex
        if state.get("notified_signature") != signature:
            delivered = send_sentry(
                "product_intake_admin_alert_worker_health_requires_attention",
                signature.split(","),
                state["incident_id"],
            )
            if delivered:
                state["notified_signature"] = signature
    state["last_status"] = status
    save_state(state)
    # Deliberately contains only enum-like reasons; no release, PID, URL, or provider body.
    print(json.dumps({"monitor": "product_intake_worker_health", "status": status, "reasons": signature.split(",") if signature else [], "recovery": recovery}, separators=(",", ":")))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        # Last-resort path must remain private-safe and should not cause timer retry storms.
        print('{"monitor":"product_intake_worker_health","status":"read_failed","reasons":["monitor_internal_error"]}')
