import pytest
from deploy.start_worker import prepare_persistent_disk


def test_ephemeral_state_is_rejected_before_marker_is_created(tmp_path):
    with pytest.raises(RuntimeError, match='mounted persistent disk'):
        prepare_persistent_disk(tmp_path)
    assert not (tmp_path / '.persistent-volume-confirmed').exists()


def test_confirmed_mount_preserves_existing_delivery_state(tmp_path, monkeypatch):
    import deploy.start_worker as launcher
    history = tmp_path / 'pending.json'
    history.write_text('{"delivery":"already accepted"}')
    monkeypatch.setattr(launcher.os.path, 'ismount', lambda path: path == tmp_path)
    prepare_persistent_disk(tmp_path)
    prepare_persistent_disk(tmp_path)
    assert (tmp_path / '.persistent-volume-confirmed').exists()
    assert history.read_text() == '{"delivery":"already accepted"}'


def test_bind_mount_on_same_filesystem_is_detected(tmp_path, monkeypatch):
    import deploy.start_worker as launcher
    monkeypatch.setattr(launcher.os.path, 'ismount', lambda path: False)
    info = tmp_path / 'mountinfo'
    state = tmp_path / 'state with spaces'
    escaped = str(state).replace(' ', r'\040')
    info.write_text(f'51 29 0:34 /volume {escaped} rw - ext4 /dev/test rw\n')
    assert launcher.is_mounted_volume(state, info)
    assert not launcher.is_mounted_volume(state / 'child', info)
