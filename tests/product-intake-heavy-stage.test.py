"""Behavioral tests of the real POSIX supervisor with a fake Docker daemon."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest

HELPER = Path(__file__).resolve().parents[1] / 'deploy/product-intake/heavy-stage.py'
FAKE_DOCKER = r'''#!/usr/bin/env python3
import json, os, pathlib, sys, time
root=pathlib.Path(os.environ['FAKE_DOCKER_ROOT'])
a=sys.argv[1:]
if (root/'fail').exists(): sys.exit(1)
def event(kind,name):
    with (root/'events').open('a') as f: f.write(json.dumps([kind,name])+"\n")
if a[0]=='run':
    name=a[a.index('--name')+1]; label=a[a.index('--label')+1]
    token=label.split('=',1)[1]; state=root/name
    state.write_text(json.dumps({'name':'/'+name,'labels':{'io.chaarlie.heavy-stage':token}}))
    event('start',name)
    until=time.monotonic()+float((root/'duration').read_text())
    while state.exists() and time.monotonic()<until: time.sleep(.02)
    state.unlink(missing_ok=True); event('end',name)
elif a[:2]==['container','ls']:
    name=a[a.index('--filter')+1].removeprefix('name=^/').removesuffix('$')
    if (root/name).exists(): print(name)
elif a[:2]==['container','inspect']:
    p=root/a[-1]
    if not p.exists(): sys.exit(1)
    print(p.read_text())
elif a[:2]==['container','rm']:
    (root/a[-1]).unlink(missing_ok=True); event('remove',a[-1])
else: sys.exit(2)
'''


class HeavyStageTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.docker = self.root / 'docker'
        self.docker.write_text(FAKE_DOCKER)
        self.docker.chmod(0o755)
        (self.root / 'duration').write_text('.15')
        self.env = dict(os.environ, FAKE_DOCKER_ROOT=str(self.root),
                        CHAARLIE_HEAVY_LOCK_PATH=str(self.root / 'lock'),
                        CHAARLIE_HEAVY_STATE_PATH=str(self.root / 'state'),
                        PATH=str(self.root) + os.pathsep + os.environ['PATH'])
        self.children = []

    def tearDown(self):
        for p in self.children:
            if p.poll() is None:
                p.terminate()
                try: p.wait(timeout=5)
                except subprocess.TimeoutExpired: p.kill(); p.wait()
            if p.stdout: p.stdout.close()
            if p.stderr: p.stderr.close()
        for state in self.root.glob('chaarlie-rembg-*'):
            state.unlink(missing_ok=True)
        time.sleep(.06)  # Let the fake daemon's disposable launchers observe removal.
        self.tmp.cleanup()

    def launch(self, n=1, timeout=3000, deadline=None, kind='rembg', audit_seconds=.15):
        args = [sys.executable, str(HELPER), '--kind', kind, '--run-timeout-ms', str(timeout)]
        if deadline is not None: args += ['--deadline-ms', str(deadline)]
        if kind == 'rembg':
            name = 'chaarlie-rembg-' + format(n, '024x')
            args += ['--container-name', name, '--', str(self.docker), 'run', '--rm', '--name', name, 'fake-image']
        else:
            args += ['--', sys.executable, '-c', f'import sys, time; print("audit-summary", flush=True); print("audit-diagnostic", file=sys.stderr, flush=True); time.sleep({audit_seconds})']
        p = subprocess.Popen(args, env=self.env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        self.children.append(p)
        return p

    def wait_for(self, predicate):
        until = time.monotonic() + 4
        while time.monotonic() < until:
            if predicate(): return
            time.sleep(.02)
        self.fail('condition was not reached')

    def events(self):
        p = self.root / 'events'
        return [json.loads(line) for line in p.read_text().splitlines()] if p.exists() else []

    def result(self, p, token=None):
        stdout, stderr = p.communicate(timeout=8)
        if token:
            self.assertNotEqual(p.returncode, 0)
            self.assertIn(token, stderr)
        else: self.assertEqual(p.returncode, 0, stderr)
        self.assertNotIn('fake-image', stderr)
        return stdout, stderr

    def test_two_contenders_share_one_inode_and_do_not_overlap(self):
        (self.root/'duration').write_text('.3')
        first = self.launch(1)
        self.wait_for(lambda: len(self.events()) == 1)
        self.assertFalse((self.root/'state.unconfirmed').exists())
        inode = (self.root/'lock').stat().st_ino
        second = self.launch(2)
        self.result(first); self.result(second)
        self.assertEqual([e[0] for e in self.events()], ['start','end','start','end'])
        self.assertEqual((self.root/'lock').stat().st_ino, inode)
        self.assertFalse((self.root/'state').exists())

    def test_cancel_waiter_and_expired_deadline_never_launch(self):
        (self.root/'duration').write_text('1')
        first = self.launch(1)
        self.wait_for(lambda: len(self.events()) == 1)
        waiter = self.launch(2); time.sleep(.1); waiter.terminate()
        self.result(waiter, 'HEAVY_STAGE_CANCELLED')
        expired = self.launch(3, deadline=int(time.time()*1000)+70)
        self.result(expired, 'HEAVY_STAGE_DEADLINE')
        self.result(first)
        self.assertEqual(len([e for e in self.events() if e[0]=='start']), 1)

    def test_timeout_and_active_cancel_remove_exact_container(self):
        (self.root/'duration').write_text('10')
        timed = self.launch(1, timeout=350)
        self.result(timed, 'HEAVY_STAGE_DEADLINE')
        self.assertFalse((self.root/'state').exists())
        active = self.launch(2)
        self.wait_for(lambda: ['start','chaarlie-rembg-'+format(2,'024x')] in self.events())
        active.terminate(); self.result(active, 'HEAVY_STAGE_CANCELLED')
        self.assertFalse((self.root/'state').exists())
        self.assertEqual(len([e for e in self.events() if e[0]=='remove']), 2)

    def test_sigkill_orphan_is_reconciled_before_next_launch(self):
        (self.root/'duration').write_text('10')
        first = self.launch(1)
        self.wait_for(lambda: len(self.events()) == 1)
        first.kill(); first.wait()
        self.assertTrue((self.root/'state').exists())
        (self.root/'duration').write_text('.1')
        self.result(self.launch(2))
        kinds = [e[0] for e in self.events()]
        self.assertLess(kinds.index('remove'), kinds.index('start',1))
        self.assertFalse((self.root/'state').exists())

    def test_unknown_state_and_docker_failure_hold_heavy_work(self):
        (self.root/'state').write_text('{broken')
        self.result(self.launch(), 'HEAVY_STAGE_UNCONFIRMED')
        self.assertEqual(self.events(), [])
        alert = json.loads((self.root/'state.unconfirmed').read_text())
        self.assertEqual(alert['reason'], 'HEAVY_STAGE_UNCONFIRMED')
        self.assertEqual((self.root/'state').read_text(), '{broken')
        (self.root/'state').unlink()
        (self.root/'duration').write_text('10')
        first = self.launch(); self.wait_for(lambda: len(self.events()) == 1)
        first.kill(); first.wait(); (self.root/'fail').touch()
        self.result(self.launch(2), 'HEAVY_STAGE_UNCONFIRMED')
        self.assertTrue((self.root/'state').exists())
        self.assertEqual(len(self.events()), 1)
        (self.root/'fail').unlink()
        name = self.events()[0][1]
        (self.root/name).write_text(json.dumps({'name':'/'+name,'labels':{}}))
        self.result(self.launch(3), 'HEAVY_STAGE_UNCONFIRMED')
        self.assertTrue((self.root/name).exists())

    def test_price_audit_wait_counts_against_total_timeout(self):
        (self.root/'duration').write_text('.4')
        first = self.launch(); self.wait_for(lambda: len(self.events()) == 1)
        self.result(self.launch(kind='price-audit',timeout=80), 'HEAVY_STAGE_DEADLINE')
        self.result(first)
        stdout, stderr = self.result(self.launch(kind='price-audit'))
        self.assertIn('audit-summary', stdout)
        self.assertIn('audit-diagnostic', stderr)

    def test_price_audit_crash_holds_until_exact_group_exits(self):
        audit = self.launch(kind='price-audit', audit_seconds=.8)
        def pinned():
            try: return 'process_group_id' in json.loads((self.root/'state').read_text())
            except (FileNotFoundError, ValueError): return False
        self.wait_for(pinned)
        audit.kill(); audit.wait()
        self.result(self.launch(2), 'HEAVY_STAGE_UNCONFIRMED')
        self.assertEqual(self.events(), [])
        time.sleep(1)
        self.result(self.launch(3))
        self.assertFalse((self.root/'state').exists())
        self.assertFalse((self.root/'state.unconfirmed').exists())

    def test_pending_launch_cannot_be_cleared_as_absent(self):
        (self.root/'state').write_text(json.dumps({
            'version':1, 'kind':'rembg', 'container_name':'chaarlie-rembg-'+format(1,'024x'),
            'token':'a'*32}))
        self.result(self.launch(2), 'HEAVY_STAGE_UNCONFIRMED')
        self.assertTrue((self.root/'state').exists())
        self.assertEqual(self.events(), [])

    def test_price_audit_missing_docker_cannot_clear_rembg_marker(self):
        (self.root/'duration').write_text('10')
        first = self.launch()
        self.wait_for(lambda: len(self.events()) == 1)
        first.kill(); first.wait()
        original = (self.root/'state').read_text()
        self.env['PATH'] = str(self.root/'no-executables')
        self.result(self.launch(kind='price-audit'), 'HEAVY_STAGE_UNCONFIRMED')
        self.assertEqual((self.root/'state').read_text(), original)
        self.assertTrue((self.root/'state.unconfirmed').exists())
        self.assertEqual(len(self.events()), 1)


if __name__ == '__main__': unittest.main()
