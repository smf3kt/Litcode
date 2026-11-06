"""Owned-process counterexample for a gate independent of watcher lifetime."""
import os
import select
import signal


def run(observe_death):
    death_r, death_w = os.pipe()
    gate_r, gate_w = os.pipe()
    marker_r, marker_w = os.pipe()
    ready_r, ready_w = os.pipe()
    watcher = os.fork()
    if watcher == 0:
        for fd in (death_r, gate_r, gate_w, marker_r, marker_w, ready_r):
            os.close(fd)
        os.write(ready_w, b"R")
        os.close(ready_w)
        while True:
            signal.pause()

    worker = os.fork()
    if worker == 0:
        for fd in (death_r, death_w, gate_w, marker_r, ready_r, ready_w):
            os.close(fd)
        if os.read(gate_r, 1) == b"G":
            os.write(marker_w, b"X")
        os._exit(0)

    for fd in (death_w, gate_r, marker_w, ready_w):
        os.close(fd)
    pending = {watcher, worker}
    try:
        assert os.read(ready_r, 1) == b"R"
        os.kill(watcher, signal.SIGKILL)
        if observe_death:
            assert select.select([death_r], [], [], 5)[0]
            assert os.read(death_r, 1) == b""
            _, status = os.waitpid(watcher, 0)
            pending.remove(watcher)
            assert os.WIFSIGNALED(status) and os.WTERMSIG(status) == signal.SIGKILL
        os.write(gate_w, b"G")
        os.close(gate_w)
        gate_w = -1
        _, status = os.waitpid(worker, 0)
        pending.remove(worker)
        assert os.WIFEXITED(status) and os.WEXITSTATUS(status) == 0
        marker = os.read(marker_r, 1) == b"X"
        if not observe_death:
            os.waitpid(watcher, 0)
            pending.remove(watcher)
        return marker
    finally:
        for fd in (death_r, marker_r, ready_r, gate_w):
            if fd >= 0:
                os.close(fd)
        for pid in pending:
            try:
                os.kill(pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            try:
                os.waitpid(pid, 0)
            except ChildProcessError:
                pass


if __name__ == "__main__":
    observed = run(True)
    assert observed, "independent gate did not exhibit the expected counterexample"
    concurrent = sum(run(False) for _ in range(30))
    print(f"EOF and wait before release: marker={observed}")
    print(f"SIGKILL concurrent with release: marker={concurrent}/30")
