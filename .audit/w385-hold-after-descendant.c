#include <sys/types.h>
#include <sys/wait.h>
#include <signal.h>
#include <unistd.h>
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>

static void die(const char *s) { perror(s); exit(1); }
int main(void) {
  int fds[2]; if (pipe(fds)) die("pipe");
  pid_t leader = fork(); if (leader < 0) die("fork");
  if (!leader) {
    close(fds[0]); if (setsid() < 0) _exit(2);
    pid_t child = fork(); if (child < 0) _exit(3);
    if (!child) { char ready = 'R'; if (write(fds[1], &ready, 1) != 1) _exit(4); for (;;) pause(); }
    _exit(0);
  }
  close(fds[1]); char ready; if (read(fds[0], &ready, 1) != 1 || ready != 'R') die("ready");
  siginfo_t info = {0}; if (waitid(P_PID, leader, &info, WEXITED | WNOWAIT)) die("waitid");
  if (info.si_pid != leader) return 5;
  if (kill(-leader, SIGKILL)) die("kill group");
  if (read(fds[0], &ready, 1) != 0) return 6;
  struct timespec delay = { .tv_sec = 1 }; nanosleep(&delay, NULL);
  errno = 0; int result = kill(-leader, 0), error = errno;
  siginfo_t held = {0}; if (waitid(P_PID, leader, &held, WEXITED | WNOWAIT)) die("held");
  int status; if (waitpid(leader, &status, 0) != leader) die("reap");
  printf("held_pid=%d group_probe=%d errno=%d leader_status=%d\n", held.si_pid, result, error, WEXITSTATUS(status));
  return held.si_pid != leader;
}
