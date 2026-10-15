#!/usr/bin/env python3
"""Read-only host observations. DB, review, CI and workload gates remain separate."""
import collections
import datetime
import json
import os
import pathlib
import shutil
import subprocess
import urllib.request

ROOT = pathlib.Path('/opt/chaarlie/product-intake')
UNITS = ('chaarlie-product-intake-worker.service', 'chaarlie-product-intake-review.service')


def command(*args):
    return subprocess.check_output(args, text=True, timeout=15).strip()


def unit_state(name, active):
    properties = command('systemctl', 'show', name, '-p', 'ActiveState', '-p', 'MainPID',
                         '-p', 'MemoryMax', '-p', 'MemoryHigh', '-p', 'Nice', '-p', 'ExecStart')
    values = dict(line.split('=', 1) for line in properties.splitlines() if '=' in line)
    pid = values.get('MainPID', '0')
    cwd = pathlib.Path(os.readlink('/proc/' + pid + '/cwd')) if pid != '0' else None
    entry = values.pop('ExecStart', '')
    values['process_working_directory'] = str(cwd) if cwd else None
    values['process_uses_active_release'] = bool(cwd and (cwd == active or active in cwd.parents))
    if name == UNITS[0]:
        values['native_server_runtime'] = '--conditions=react-server' in entry and '--import tsx' in entry
    values['drop_in_names'] = sorted(p.name for p in
        (pathlib.Path('/etc/systemd/system') / (name + '.d')).glob('*.conf'))
    return values


def local_json(route):
    with urllib.request.urlopen('http://127.0.0.1:3910' + route, timeout=15) as response:
        return response.status, json.load(response)


def main():
    active = (ROOT / 'current').resolve(strict=True)
    if active.parent != ROOT / 'releases':
        raise RuntimeError('Active target is outside the immutable releases directory')
    disk = shutil.disk_usage(ROOT)
    observations = {
        'observed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'scope': 'read-only host observations; no writes, claims, retries, reloads or restarts',
        'active_release': active.name,
        'installed_releases': sorted(p.name for p in (ROOT / 'releases').iterdir() if p.is_dir()),
        'disk': {'total_bytes': disk.total, 'used_bytes': disk.used, 'available_bytes': disk.free,
                 'df': command('df', '-h', str(ROOT))},
        'services': {name: unit_state(name, active) for name in UNITS},
        'private_configuration_present': (active / '.env.local').is_file() and
                                         (ROOT / 'shared/worker.env').is_file(),
        'review_build_present': (active / 'apps/product-intake-review/.next/BUILD_ID').is_file(),
        'shared_finalized_files': sum(p.is_file() for p in (ROOT / 'shared/finalized-images').rglob('*')),
        'shared_model_files': sum(p.is_file() for p in (ROOT / 'shared/rembg').rglob('*')),
        'heavy_lock_path_present': pathlib.Path('/run/chaarlie/heavy-work.lock').exists(),
        'deployment_gates_not_proven_by_this_report': [
            'current complete DB queue/lease state and fresh heartbeat',
            'exact reviewed Git head, content fingerprint and all required CI',
            'required production migrations and schema compatibility',
            'representative image/research workload under the intended shared-host limits',
            'rollback identity and startup/readiness evidence',
            'alert delivery and runtime credential compatibility',
        ],
    }
    status, health = local_json('/api/health')
    observations['review_health'] = {'http_status': status, 'ok': health.get('ok') is True}
    status, queue = local_json('/api/queue')
    rows = queue.get('rows')
    if not isinstance(rows, list) or queue.get('source') != 'supabase':
        raise RuntimeError('Review queue did not return database-backed rows')
    observations['review_queue_sample'] = {
        'http_status': status, 'sample_size': len(rows),
        'job_status_counts': dict(collections.Counter(str(row.get('jobStatus')) for row in rows)),
        'limitation': 'Endpoint is capped at 100 rows; this sample cannot prove the full queue is idle.',
    }
    print(json.dumps(observations, indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Exception messages from HTTP/service tools can contain private response text.
        print(json.dumps({'scope': 'read-only host observations', 'error_type': type(error).__name__,
                          'report_complete': False}))
        raise SystemExit(1)
