"""Render launcher: confirm the declared state directory is a mounted volume."""
import os
from pathlib import Path
import sys
import re


def is_mounted_volume(directory, mountinfo='/proc/self/mountinfo'):
    # ismount() misses bind mounts on the same filesystem (including Docker volumes).
    if os.path.ismount(directory):
        return True
    for line in Path(mountinfo).read_text().splitlines():
        fields = line.split()
        if len(fields) < 5:
            continue
        target = re.sub(r'\\([0-7]{3})', lambda m: chr(int(m[1], 8)), fields[4])
        if Path(target) == directory:
            return True
    return False


def prepare_persistent_disk(directory):
    state = Path(directory).resolve()
    if state == Path(state.anchor) or not is_mounted_volume(state):
        raise RuntimeError('Worker state must be a mounted persistent disk; refusing ephemeral storage')
    (state / '.persistent-volume-confirmed').touch(exist_ok=True)
    return state


def main():
    prepare_persistent_disk(os.environ['LOTTERY_WORKER_STATE_DIR'])
    os.execv(sys.executable, [sys.executable, '-m', 'lottery_worker'])


if __name__ == '__main__':
    main()
