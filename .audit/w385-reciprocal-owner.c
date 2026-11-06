/* W385 ownership prerequisite; standalone fixture, not product code. */
#include <sys/types.h>
#include <sys/wait.h>
#include <poll.h>
#include <signal.h>
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

static void write_pid(int fd, pid_t pid) {
  if (write(fd, &pid, sizeof(pid)) != sizeof(pid)) _exit(90);
}

static pid_t read_pid(int fd) {
  pid_t pid = 0;
  size_t n = 0;
  while (n < sizeof(pid)) {
    ssize_t r = read(fd, (char *)&pid + n, sizeof(pid) - n);
    if (r <= 0) { if (r < 0 && errno == EINTR) continue; return -1; }
    n += (size_t)r;
  }
  return pid;
}

static void supervisor(int report, int alive) {
  int owner[2], ready[2];
  if (pipe(owner) || pipe(ready)) _exit(91);
  pid_t watcher = fork();
  if (watcher < 0) _exit(92);
  if (watcher == 0) {
    close(owner[1]); close(ready[0]);
    if (setsid() < 0) _exit(93);
    pid_t worker = fork();
    if (worker < 0) _exit(94);
    if (worker == 0) {
      close(owner[0]); close(ready[1]); close(report);
      for (;;) pause();
    }
    close(alive);
    write_pid(ready[1], worker);
    close(ready[1]);
    char byte;
    ssize_t n;
    do { n = read(owner[0], &byte, 1); } while (n < 0 && errno == EINTR);
    /* The watcher is the process-group leader and deliberately dies here. */
    kill(-getpid(), SIGKILL);
    _exit(95);
  }
  close(owner[0]); close(ready[1]); close(alive);
  pid_t worker = read_pid(ready[0]);
  close(ready[0]);
  if (worker <= 1) _exit(96);
  write_pid(report, watcher);
  write_pid(report, worker);
  close(report);
  siginfo_t info = {0};
  int r;
  do { r = waitid(P_PID, watcher, &info, WEXITED | WNOWAIT); } while (r < 0 && errno == EINTR);
  if (r < 0 || info.si_pid != watcher) _exit(97);
  /* watcher remains an unreaped child while its process group is signalled. */
  if (kill(-watcher, SIGKILL) < 0 && errno != ESRCH) _exit(98);
  close(owner[1]);
  while (waitpid(watcher, NULL, 0) < 0 && errno == EINTR) {}
  _exit(0);
}

static int trial(int kill_watcher) {
  int report[2], alive[2];
  if (pipe(report) || pipe(alive)) return 1;
  pid_t owner = fork();
  if (owner < 0) return 1;
  if (owner == 0) {
    close(report[0]); close(alive[0]);
    supervisor(report[1], alive[1]);
  }
  close(report[1]); close(alive[1]);
  pid_t watcher = read_pid(report[0]), worker = read_pid(report[0]);
  close(report[0]);
  if (watcher <= 1 || worker <= 1) { kill(owner, SIGKILL); waitpid(owner, NULL, 0); return 1; }
  int failed = 0;
  if (getpgid(watcher) != watcher || getsid(watcher) != watcher ||
      getpgid(worker) != watcher || getsid(worker) != watcher) failed = 1;
  if (kill(kill_watcher ? watcher : owner, SIGKILL)) failed = 1;
  struct pollfd p = { alive[0], POLLIN | POLLHUP, 0 };
  int ready;
  do { ready = poll(&p, 1, 5000); } while (ready < 0 && errno == EINTR);
  char byte;
  if (ready <= 0 || read(alive[0], &byte, 1) != 0) failed = 1;
  close(alive[0]);
  if (failed) { kill(-watcher, SIGKILL); kill(worker, SIGKILL); kill(owner, SIGKILL); }
  int status;
  while (waitpid(owner, &status, 0) < 0 && errno == EINTR) {}
  if (kill_watcher && (!WIFEXITED(status) || WEXITSTATUS(status) != 0)) failed = 1;
  if (!kill_watcher && (!WIFSIGNALED(status) || WTERMSIG(status) != SIGKILL)) failed = 1;
  printf("%s: %s\n", kill_watcher ? "watcher death" : "supervisor death", failed ? "FAIL" : "worker pipe EOF");
  return failed;
}

int main(void) { return trial(0) | trial(1); }
