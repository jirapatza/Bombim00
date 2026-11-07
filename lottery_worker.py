"""Optional always-on checker. Run one instance with a persistent state directory.

Only JSON data is read from runtime-live; imported code is from the reviewed release.
Actions must be disabled via LOTTERY_CHECKER_MODE=continuous before this worker starts.
"""
import base64
import contextlib
import fcntl
import json
import os
from pathlib import Path
import re
import time

import requests
import lottery_checker as checker
import settings_loader as sl

INPUTS = ('config/settings.json', 'data/all_lotteries.json',
          'lottery_previous_results.json', 'status/status.json')
OUTPUTS = ('lottery_previous_results.json', 'status/status.json')


class RuntimeRepository:
    def __init__(self, repository, token):
        if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repository):
            raise ValueError('Invalid repository')
        self.base = f'https://api.github.com/repos/{repository}'
        self.session = requests.Session()
        self.session.headers.update({'Authorization': f'Bearer {token}', 'Accept': 'application/vnd.github+json'})

    def api(self, method, path, body=None):
        response = self.session.request(method, self.base + path, json=body, timeout=20)
        # Do not include response bodies, request headers or credentials in errors.
        if not response.ok:
            raise RuntimeError(f'GitHub runtime API HTTP {response.status_code}')
        return response.json()

    def assert_continuous(self):
        mode = self.api('GET', '/actions/variables/LOTTERY_CHECKER_MODE')
        if mode.get('value') != 'continuous':
            raise RuntimeError('Disable the Actions writer with LOTTERY_CHECKER_MODE=continuous first')
        # A run queued before the switch could still publish. Wait for it to finish.
        runs = self.api('GET', '/actions/workflows/lottery.yml/runs?per_page=100')['workflow_runs']
        if any(run['status'] != 'completed' and run.get('event') != 'pull_request' for run in runs):
            raise RuntimeError('An Actions checker run is still active; wait before starting the worker')

    def snapshot(self):
        head = self.api('GET', '/git/ref/heads/runtime-live')['object']['sha']
        tree = self.api('GET', f'/git/commits/{head}')['tree']['sha']
        data = {}
        for path in INPUTS:
            value = self.api('GET', f'/contents/{path}?ref={head}')
            if value.get('encoding') != 'base64':
                raise ValueError('Expected runtime JSON blob')
            data[path] = json.loads(base64.b64decode(value['content']))
        return {'head': head, 'tree': tree, 'data': data}

    def publish(self, pending):
        # A retry may follow a lost HTTP response after the commit already succeeded.
        latest = self.snapshot()
        if all(latest['data'][path] == pending['outputs'][path] for path in OUTPUTS):
            return
        if any(latest['data'][path] != pending['before'][path] for path in OUTPUTS):
            raise RuntimeError('Concurrent results changed; refusing to overwrite delivery history')
        entries = []
        for path in OUTPUTS:
            entries.append({'path': path, 'mode': '100644', 'type': 'blob',
                            'content': json.dumps(pending['outputs'][path], ensure_ascii=False, indent=2)})
        tree = self.api('POST', '/git/trees', {'base_tree': latest['tree'], 'tree': entries})['sha']
        commit = self.api('POST', '/git/commits', {'message': 'chore(bot): update lottery results and status [skip ci] [skip render]',
                                                'tree': tree, 'parents': [latest['head']]})['sha']
        self.api('PATCH', '/git/refs/heads/runtime-live', {'sha': commit, 'force': False})


def run_cycle(remote, state):
    """Retry unpublished output before any new network sends. Never execute remote code."""
    state = Path(state).resolve()
    pending_path = state / 'pending.json'
    inflight = state / 'inflight.json'
    if pending_path.exists():
        remote.publish(json.loads(pending_path.read_text()))
        pending_path.unlink()
        inflight.unlink(missing_ok=True)
        return
    if inflight.exists():
        raise RuntimeError('Interrupted delivery: reconcile local history and ntfy before clearing inflight.json')
    snapshot = remote.snapshot()
    if set(snapshot['data']) != set(INPUTS):
        raise ValueError('Incomplete runtime snapshot')
    for path, value in snapshot['data'].items():
        if path not in INPUTS:
            raise ValueError('Unexpected runtime path')
        sl._atomic_json_write(value, str(state / path))
    # Mark before main: a crash after ntfy acceptance must not silently resend.
    sl._atomic_json_write({'base': snapshot['head']}, str(inflight))
    with contextlib.chdir(state):
        checker.S = sl.load()
        checker.main()
    outputs = {path: json.loads((state / path).read_text()) for path in OUTPUTS}
    pending = {'before': {path: snapshot['data'][path] for path in OUTPUTS}, 'outputs': outputs}
    sl._atomic_json_write(pending, str(pending_path))
    remote.publish(pending)
    pending_path.unlink()
    inflight.unlink()


def main():
    state = Path(os.environ['LOTTERY_WORKER_STATE_DIR']).resolve()
    state.mkdir(parents=True, exist_ok=True)
    if not (state / '.persistent-volume-confirmed').is_file():
        raise RuntimeError('Use a persistent disk and create .persistent-volume-confirmed before starting')
    if not os.environ.get('NTFY_TOPIC', '').strip():
        raise RuntimeError('NTFY_TOPIC must be explicitly configured for the worker')
    if os.environ.get('FORCE_NOTIFY', '').lower() == 'true':
        raise RuntimeError('FORCE_NOTIFY is forbidden for the continuous worker')
    os.environ['LOTTERY_TARGET'] = 'all'
    interval = max(15, int(os.environ.get('LOTTERY_POLL_SECONDS', '15')))
    remote = RuntimeRepository(os.environ['GITHUB_REPOSITORY'], os.environ['LOTTERY_RUNTIME_TOKEN'])
    with (state / 'worker.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        remote.assert_continuous()
        while True:
            started = time.monotonic()
            remote.assert_continuous()
            try:
                run_cycle(remote, state)
            except Exception:
                if not (state / 'pending.json').exists():
                    # Stop on uncertain delivery; safe publish retries need no resend.
                    raise
                print('[ERROR] Runtime publish pending; retrying saved output without sending again.', flush=True)
            time.sleep(max(0, interval - (time.monotonic() - started)))


if __name__ == '__main__':
    main()
