#!/usr/bin/env python3
"""Serialize the two host-heavy stages; reconcile only a proven owned rembg container."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import signal
import stat
import subprocess
import sys
import time

LABEL = 'io.chaarlie.heavy-stage'
CLEANUP_SECONDS = 20
cancelled = False


class StageError(Exception):
    pass


def on_signal(_signum, _frame):
    global cancelled
    cancelled = True


def check(deadline):
    if cancelled:
        raise StageError('HEAVY_STAGE_CANCELLED')
    if time.time() * 1000 >= deadline:
        raise StageError('HEAVY_STAGE_DEADLINE')


def write_state(path, value):
    temporary = path.with_name(path.name + '.' + secrets.token_hex(8))
    try:
        fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w') as stream:
            json.dump(value, stream)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        sync_directory(path.parent)
    finally:
        temporary.unlink(missing_ok=True)


def sync_directory(path):
    fd = os.open(path, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def state_location():
    return Path(os.environ.get('CHAARLIE_HEAVY_STATE_PATH', '/opt/chaarlie/product-intake/shared/heavy-work-state.json'))


def alert_location():
    return Path(str(state_location()) + '.unconfirmed')


def clear_state(path):
    path.unlink()
    sync_directory(path.parent)


def docker_call(binary, args, until):
    remaining = min(5, until - time.monotonic())
    if remaining <= 0:
        raise StageError('HEAVY_STAGE_UNCONFIRMED')
    try:
        result = subprocess.run([binary, *args], capture_output=True, text=True, timeout=remaining)
    except (OSError, subprocess.TimeoutExpired):
        raise StageError('HEAVY_STAGE_UNCONFIRMED') from None
    if result.returncode:
        raise StageError('HEAVY_STAGE_UNCONFIRMED')
    return result.stdout.strip()


def reconcile_rembg(value, binary, until):
    name, token = value.get('container_name'), value.get('token')
    if (not isinstance(name, str) or not re.fullmatch(r'chaarlie-rembg-[0-9a-f]{24}', name)
            or not isinstance(token, str) or not re.fullmatch(r'[0-9a-f]{32}', token)):
        raise StageError('HEAVY_STAGE_UNCONFIRMED')
    listing = ['container', 'ls', '--all', '--filter', 'name=^/' + name + '$', '--format', '{{.Names}}']
    found = docker_call(binary, listing, until)
    if not found:
        return
    if found != name:
        raise StageError('HEAVY_STAGE_UNCONFIRMED')
    raw = docker_call(binary, ['container', 'inspect', '--format',
                              '{"name":{{json .Name}},"labels":{{json .Config.Labels}}}', name], until)
    try:
        actual = json.loads(raw)
    except ValueError:
        raise StageError('HEAVY_STAGE_UNCONFIRMED') from None
    if (not isinstance(actual, dict) or actual.get('name') != '/' + name
            or not isinstance(actual.get('labels'), dict) or actual['labels'].get(LABEL) != token):
        raise StageError('HEAVY_STAGE_UNCONFIRMED')
    docker_call(binary, ['container', 'rm', '--force', name], until)
    if docker_call(binary, listing, until):
        raise StageError('HEAVY_STAGE_UNCONFIRMED')


def group_exists(pgid):
    try:
        os.killpg(pgid, 0)
        return True
    except ProcessLookupError:
        return False
    except (PermissionError, OverflowError):
        raise StageError('HEAVY_STAGE_UNCONFIRMED') from None


def reconcile(path, docker, until):
    if not path.exists():
        return
    try:
        value = json.loads(path.read_text())
    except (OSError, ValueError):
        raise StageError('HEAVY_STAGE_UNCONFIRMED') from None
    if not isinstance(value, dict) or value.get('version') != 1:
        raise StageError('HEAVY_STAGE_UNCONFIRMED')
    if value.get('kind') == 'rembg':
        reconcile_rembg(value, docker, until)
        # Empty Docker listing is insufficient while a launcher can still create work.
        pgid = value.get('process_group_id')
        if type(pgid) is not int or pgid <= 1:
            raise StageError('HEAVY_STAGE_UNCONFIRMED')
        while group_exists(pgid):
            if time.monotonic() >= until:
                raise StageError('HEAVY_STAGE_UNCONFIRMED')
            time.sleep(.05)
    elif value.get('kind') == 'price-audit':
        pgid = value.get('process_group_id')
        # A pending launch or any surviving group is deliberately not recovered by force.
        if type(pgid) is not int or pgid <= 1 or group_exists(pgid):
            raise StageError('HEAVY_STAGE_UNCONFIRMED')
    else:
        raise StageError('HEAVY_STAGE_UNCONFIRMED')
    clear_state(path)


def stop_child(child):
    # The leader may already have exited while descendants still own this session.
    for sig, grace in ((signal.SIGTERM, 1), (signal.SIGKILL, 1)):
        try:
            os.killpg(child.pid, sig)
        except ProcessLookupError:
            child.wait(timeout=1)
            return
        until = time.monotonic() + grace
        while time.monotonic() < until:
            child.poll()  # Reap the leader so its zombie does not keep the group alive.
            if not group_exists(child.pid):
                return
            time.sleep(.05)
    child.poll()


def rembg_command(args):
    command = args.command
    if (not args.container_name or not re.fullmatch(r'chaarlie-rembg-[0-9a-f]{24}', args.container_name)
            or len(command) < 3 or command[1] != 'run'):
        raise StageError('HEAVY_STAGE_UNCONFIRMED')
    names = []
    for i, part in enumerate(command[2:], 2):
        if part == '--name':
            names.append(command[i + 1] if i + 1 < len(command) else '')
        elif part.startswith('--name='):
            names.append(part[7:])
        if LABEL in part or part in ('-d', '--detach') or part.startswith('--detach='):
            raise StageError('HEAVY_STAGE_UNCONFIRMED')
    if names != [args.container_name]:
        raise StageError('HEAVY_STAGE_UNCONFIRMED')
    token = secrets.token_hex(16)
    return [*command[:2], '--label', LABEL + '=' + token, *command[2:]], {
        'version': 1, 'kind': 'rembg', 'container_name': args.container_name, 'token': token}


def run(args):
    start = time.time() * 1000
    deadline = args.deadline_ms if args.deadline_ms is not None else float('inf')
    if args.kind == 'price-audit':
        deadline = min(deadline, start + args.run_timeout_ms)
    lock_path = Path(os.environ.get('CHAARLIE_HEAVY_LOCK_PATH', '/run/chaarlie/heavy-work.lock'))
    state_path = state_location()
    docker = args.command[0] if args.kind == 'rembg' else shutil.which('docker')
    command, marker = rembg_command(args) if args.kind == 'rembg' else (args.command, {'version': 1, 'kind': 'price-audit'})
    # Provision the parent at boot. Never unlink or replace this shared lock inode.
    fd = os.open(lock_path, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o660)
    try:
        if not stat.S_ISREG(os.fstat(fd).st_mode):
            raise StageError('HEAVY_STAGE_UNCONFIRMED')
        while True:
            check(deadline)
            try:
                fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                time.sleep(.05)
        reconcile(state_path, docker, time.monotonic() + CLEANUP_SECONDS)
        alert_location().unlink(missing_ok=True)
        check(deadline)
        deadline = min(deadline, time.time() * 1000 + args.run_timeout_ms)
        write_state(state_path, marker)
        child = None
        failure = None
        try:
            check(deadline)
            # Preserve audit's existing journal summaries; helper/Docker diagnostics stay sanitized.
            output = None if args.kind == 'price-audit' else subprocess.DEVNULL
            child = subprocess.Popen(command, start_new_session=True, stdout=output, stderr=output)
            marker['process_group_id'] = child.pid
            write_state(state_path, marker)
            while child.poll() is None:
                check(deadline)
                time.sleep(.05)
        except StageError as error:
            failure = error
        except OSError:
            failure = StageError('HEAVY_STAGE_UNCONFIRMED')
        finally:
            if child is not None:
                stop_child(child)
            if child is None:
                # This supervisor knows launch never happened; a future one cannot assume it.
                clear_state(state_path)
            elif args.kind == 'rembg':
                reconcile(state_path, docker, time.monotonic() + CLEANUP_SECONDS)
            elif child is not None and not group_exists(child.pid):
                clear_state(state_path)
            else:
                raise StageError('HEAVY_STAGE_UNCONFIRMED')
        if failure:
            raise failure
        return child.returncode if child.returncode >= 0 else 1
    finally:
        os.close(fd)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--kind', choices=('rembg', 'price-audit'), required=True)
    parser.add_argument('--deadline-ms', type=int)
    parser.add_argument('--run-timeout-ms', type=int, required=True)
    parser.add_argument('--container-name')
    parser.add_argument('command', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if args.command[:1] == ['--']:
        args.command = args.command[1:]
    if not args.command or args.run_timeout_ms <= 0:
        parser.error('a command and positive run timeout are required')
    signal.signal(signal.SIGTERM, on_signal)
    signal.signal(signal.SIGINT, on_signal)
    try:
        return run(args)
    except (StageError, OSError, ValueError, TypeError, subprocess.SubprocessError):
        # Never expose command arguments, daemon stderr, paths, environment or data.
        error = sys.exc_info()[1]
        token = str(error) if isinstance(error, StageError) else 'HEAVY_STAGE_UNCONFIRMED'
        if token == 'HEAVY_STAGE_UNCONFIRMED':
            try:
                write_state(alert_location(), {'version': 1, 'reason': token, 'detected_at_ms': int(time.time() * 1000)})
            except OSError:
                pass  # stderr remains the fallback when storage itself is unavailable.
        print(token, file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
