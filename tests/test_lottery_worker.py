import copy
import json
import pytest
import lottery_worker as worker


class Remote:
    def __init__(self):
        self.publishes = []
        self.fail = True
        self.data = {'config/settings.json':{}, 'data/all_lotteries.json':[],
                     'lottery_previous_results.json':[], 'status/status.json':{}}

    def snapshot(self):
        return {'head':'base', 'tree':'tree', 'data':copy.deepcopy(self.data)}

    def publish(self, pending):
        self.publishes.append(copy.deepcopy(pending))
        if self.fail:
            raise OSError('simulated network failure')


def test_publish_retry_never_repeats_notifications(tmp_path, monkeypatch):
    remote = Remote()
    sends = []
    def check():
        sends.append('synthetic delivery')
        worker.sl.save_results([{'ชื่อหวย':'test','สถานะการแจ้งเตือน':'sent'}])
    monkeypatch.setattr(worker.checker, 'main', check)
    with pytest.raises(OSError):
        worker.run_cycle(remote, tmp_path)
    assert (tmp_path/'pending.json').exists()
    remote.fail = False
    worker.run_cycle(remote, tmp_path)
    assert sends == ['synthetic delivery']
    assert remote.publishes[0] == remote.publishes[1]
    assert not (tmp_path/'inflight.json').exists()


def test_interrupted_send_stops_before_any_further_send(tmp_path, monkeypatch):
    (tmp_path/'inflight.json').write_text('{}')
    def forbidden():
        pytest.fail('must not retry an uncertain send')
    monkeypatch.setattr(worker.checker, 'main', forbidden)
    with pytest.raises(RuntimeError, match='Interrupted delivery'):
        worker.run_cycle(Remote(), tmp_path)


def test_remote_writes_only_result_and_status_on_runtime_branch(monkeypatch):
    remote = worker.RuntimeRepository('owner/repo', 'synthetic-token')
    before = {'lottery_previous_results.json':[], 'status/status.json':{}}
    monkeypatch.setattr(remote, 'snapshot', lambda: {'head':'latest', 'tree':'base-tree', 'data':before})
    calls = []
    def api(method, path, body=None):
        calls.append((method,path,body))
        return {'sha':'new-sha'}
    monkeypatch.setattr(remote, 'api', api)
    remote.publish({'before':before,'outputs':dict(before, **{'status/status.json':{'healthy':True}})})
    assert calls[0][2]['base_tree'] == 'base-tree'
    assert {item['path'] for item in calls[0][2]['tree']} == set(worker.OUTPUTS)
    assert calls[-1] == ('PATCH','/git/refs/heads/runtime-live',{'sha':'new-sha','force':False})


def test_concurrent_history_is_never_overwritten(monkeypatch):
    remote = worker.RuntimeRepository('owner/repo','synthetic-token')
    before = {'lottery_previous_results.json':[], 'status/status.json':{}}
    monkeypatch.setattr(remote, 'snapshot', lambda: {'data':dict(before, **{'lottery_previous_results.json':[{'different':True}]})})
    monkeypatch.setattr(remote, 'api', lambda *args: pytest.fail('must not write conflicting history'))
    with pytest.raises(RuntimeError, match='Concurrent results'):
        remote.publish({'before':before,'outputs':dict(before, **{'status/status.json':{'new':True}})})


def test_already_published_retry_is_idempotent(monkeypatch):
    remote = worker.RuntimeRepository('owner/repo','synthetic-token')
    outputs = {'lottery_previous_results.json':[{'sent':True}], 'status/status.json':{'current':True}}
    monkeypatch.setattr(remote, 'snapshot', lambda: {'data': outputs})
    monkeypatch.setattr(remote, 'api', lambda *args: pytest.fail('no duplicate commit needed'))
    remote.publish({'outputs':outputs, 'before':{}})


def test_worker_requires_actions_writer_to_be_disabled(monkeypatch):
    remote = worker.RuntimeRepository('owner/repo','synthetic-token')
    monkeypatch.setattr(remote,'api',lambda *args:{'value':'actions'})
    with pytest.raises(RuntimeError,match='Disable the Actions writer'):
        remote.assert_continuous()
    def api(method,path):
        return {'value':'continuous'} if 'variables' in path else {'workflow_runs':[{'status':'in_progress','event':'schedule'}]}
    monkeypatch.setattr(remote,'api',api)
    with pytest.raises(RuntimeError,match='still active'):
        remote.assert_continuous()
