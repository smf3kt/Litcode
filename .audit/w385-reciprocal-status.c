/* Independent W385 host experiment, not the shell supervisor implementation.
 * Source: chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
 * Axe/ale UTF-16 [82919,87427), [3506526,3518705); chunk-25vrbr0v.js
 * sha256 30b526b2b8573161c4d1ec0f5b720701820375443a0e3d84c336cff9d839537e
 * Mw/helpers UTF-16 [943,3031). Source does not provide this ownership protocol. */
#include <sys/types.h>
#include <sys/event.h>
#include <sys/sysctl.h>
#include <sys/wait.h>
#include <errno.h>
#include <fcntl.h>
#include <poll.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

struct message { int kind; int value; pid_t watcher; pid_t worker; };
enum { READY = 1, EXITED, SIGNALED, WATCHER_LOST, CANCELLED, EXEC_FAILED, SESSION };
static int barrier_notice = -1, barrier_release = -1, barrier_phase;
static volatile sig_atomic_t interrupted;
static void interrupt_supervisor(int sig) { interrupted = sig; }
static void send_message(int fd, struct message msg);
static void kill_group(pid_t watcher) {
  if (barrier_phase == 6 && getpgid(watcher) != watcher) {
    (void)write(barrier_notice, "K", 1);
    return;
  }
  kill(-watcher, SIGKILL);
}

static void barrier(int phase) {
  if (barrier_phase != phase) return;
  char byte = (char)phase;
  if (write(barrier_notice, &byte, 1) != 1 || read(barrier_release, &byte, 1) != 1) _exit(89);
}

static void send_status(int fd, struct message msg) {
  barrier(1);
  if (barrier_phase == 2) {
    size_t half = sizeof msg / 2;
    if (write(fd, &msg, half) != (ssize_t)half) _exit(90);
    barrier(2);
    if (write(fd, (char *)&msg + half, sizeof msg - half) != (ssize_t)(sizeof msg - half)) _exit(90);
  } else send_message(fd, msg);
  barrier(3);
}

static void send_message(int fd, struct message msg) {
  if (write(fd, &msg, sizeof msg) != sizeof msg) _exit(90);
}
static int receive(int fd, struct message *msg) {
  size_t n = 0;
  while (n < sizeof *msg) {
    ssize_t count = read(fd, (char *)msg + n, sizeof *msg - n);
    if (count < 0 && errno == EINTR) continue;
    if (count <= 0) return 0;
    n += (size_t)count;
  }
  return 1;
}
static void wait_child(pid_t pid, int *status) {
  pid_t result;
  do { result = waitpid(pid, status, 0); } while (result < 0 && errno == EINTR);
  if (result != pid) _exit(91);
}
static void watch(int owner, int result, int alive, int mode) {
  if (barrier_phase == 6) {
    send_message(barrier_notice, (struct message){ 0, 0, getpid(), 0 });
    barrier(6);
  }
  if (setsid() < 0) _exit(92);
  send_message(result, (struct message){ SESSION, 0, getpid(), 0 });
  char session_ack;
  ssize_t received_ack;
  do { received_ack = read(owner, &session_ack, 1); } while (received_ack < 0 && errno == EINTR);
  if (received_ack != 1 || session_ack != 'S') _exit(112);
  if (barrier_phase == 8) {
    send_message(barrier_notice, (struct message){ SESSION, 0, getpid(), 0 });
    barrier(8);
  }
  struct pollfd ownership = { owner, POLLIN | POLLHUP, 0 };
  if (poll(&ownership, 1, 0) < 0 || (ownership.revents & POLLHUP)) _exit(112);
  if (barrier_phase == 9) {
    send_message(barrier_notice, (struct message){ SESSION, 0, getpid(), 0 });
    barrier(9);
  }
  int gate[2], exec_error[2];
  if (pipe(gate) || pipe(exec_error) || fcntl(exec_error[1], F_SETFD, FD_CLOEXEC)) _exit(93);
  pid_t worker = fork();
  if (worker < 0) _exit(94);
  if (!worker) {
    close(owner); close(result); close(gate[1]); close(exec_error[0]);
    char grant;
    ssize_t n;
    do { n = read(gate[0], &grant, 1); } while (n < 0 && errno == EINTR);
    close(gate[0]);
    if (n != 1 || grant != 'G') _exit(95);
    barrier(10);
    if (write(alive, "R", 1) != 1) _exit(96);
    if (mode == 10) {
      if (dup2(alive, STDOUT_FILENO) < 0) _exit(96);
      execl("/bin/sh", "sh", "-c", "printf E; exit 7", (char *)NULL);
    }
    if (mode == 7) execl("/bin/sh", "sh", "-c", "exit 7", (char *)NULL);
    if (mode == 125) execl("/bin/sh", "sh", "-c", "exit 125", (char *)NULL);
    if (mode == 127) execl("/bin/sh", "sh", "-c", "exit 127", (char *)NULL);
    if (mode == 126) execl("/w385-nonexistent-executable", "missing", (char *)NULL);
    if (mode == 7 || mode == 10 || mode == 125 || mode == 126 || mode == 127) {
      int error = errno;
      (void)write(exec_error[1], &error, sizeof error);
      _exit(127);
    }
    close(exec_error[1]);
    if (mode == 1) { raise(SIGKILL); _exit(96); }
    for (;;) pause();
  }
  close(alive); close(gate[0]); close(exec_error[1]);
  struct message ready = { READY, 0, getpid(), worker };
  if (barrier_phase == 7 || barrier_phase == 8 || barrier_phase == 9) send_message(barrier_notice, ready);
  if (barrier_phase == 9) barrier(9);
  if (barrier_phase == 6) {
    send_message(barrier_notice, ready);
    barrier(6);
  }
  if (barrier_phase == 4 || barrier_phase == 5) {
    send_message(barrier_notice, ready);
    if (barrier_phase == 5 && write(result, &ready, sizeof ready / 2) != sizeof ready / 2) _exit(90);
    barrier(barrier_phase);
    if (barrier_phase == 5) {
      if (write(result, (char *)&ready + sizeof ready / 2, sizeof ready - sizeof ready / 2) != sizeof ready - sizeof ready / 2) _exit(90);
    } else send_message(result, ready);
  } else send_message(result, ready);
  int completed = 0, granted = 0;
  for (;;) {
    siginfo_t info = {0};
    if (!completed && waitid(P_PID, worker, &info, WEXITED | WNOHANG | WNOWAIT) < 0) _exit(98);
    if (info.si_pid == worker) {
      int status; wait_child(worker, &status);
      int error = 0;
      ssize_t count;
      do { count = read(exec_error[0], &error, sizeof error); } while (count < 0 && errno == EINTR);
      if (count == sizeof error) send_status(result, (struct message){ EXEC_FAILED, error, 0, 0 });
      else if (count != 0) _exit(99);
      else if (WIFEXITED(status)) send_status(result, (struct message){ EXITED, WEXITSTATUS(status), 0, 0 });
      else if (WIFSIGNALED(status)) send_status(result, (struct message){ SIGNALED, WTERMSIG(status), 0, 0 });
      else _exit(99);
      completed = 1;
      /* Keep the group leader alive until the supervisor has consumed status. */
    }
    struct pollfd p = { owner, POLLIN | POLLHUP, 0 };
    int r;
    do { r = poll(&p, 1, 20); } while (r < 0 && errno == EINTR);
    if (r < 0) _exit(100);
    if (r > 0) {
      char grant;
      ssize_t n;
      do { n = read(owner, &grant, 1); } while (n < 0 && errno == EINTR);
      if (!granted && !completed && n == 1 && grant == 'G' && write(gate[1], &grant, 1) == 1) {
        granted = 1;
        close(gate[1]);
      } else { kill(-getpid(), SIGKILL); _exit(101); }
    }
  }
}
static void supervise(int report, int alive, int control, int mode) {
  int owner[2], result[2];
  if (pipe(owner) || pipe(result)) _exit(102);
  struct sigaction handler = {0};
  handler.sa_handler = interrupt_supervisor;
  sigemptyset(&handler.sa_mask);
  if (sigaction(SIGTERM, &handler, NULL) || sigaction(SIGINT, &handler, NULL) || sigaction(SIGHUP, &handler, NULL)) _exit(110);
  pid_t watcher = fork();
  if (watcher < 0) _exit(103);
  if (!watcher) {
    signal(SIGTERM, SIG_DFL); signal(SIGINT, SIG_DFL); signal(SIGHUP, SIG_DFL);
    close(owner[1]); close(result[0]); close(report); close(control);
    watch(owner[0], result[1], alive, mode);
  }
  close(owner[0]); close(result[1]); close(alive);
  struct message msg = {0};
  if (fcntl(result[0], F_SETFL, O_NONBLOCK) < 0) _exit(107);
  int granted = 0, ready = 0, session = 0, pending_grant = 0;
  size_t received = 0;
  for (;;) {
    while (received < sizeof msg) {
      ssize_t n = read(result[0], (char *)&msg + received, sizeof msg - received);
      if (n > 0) { received += (size_t)n; continue; }
      if (n < 0 && errno == EINTR) continue;
      if (n < 0 && errno != EAGAIN && errno != EWOULDBLOCK) _exit(108);
      break;
    }
    if (received == sizeof msg) {
      if (!session) {
        if (msg.kind != SESSION || msg.watcher != watcher) _exit(104);
        session = 1; received = 0;
        if (barrier_phase == 7) {
          send_message(barrier_notice, msg);
          barrier(7);
        }
        struct pollfd control_state = { control, POLLIN | POLLHUP, 0 };
        if (poll(&control_state, 1, 0) < 0) _exit(106);
        if (control_state.revents & POLLHUP) {
          send_message(report, (struct message){ CANCELLED, 0, 0, 0 });
          kill_group(watcher);
          kill(watcher, SIGKILL);
          break;
        }
        (void)write(owner[1], "S", 1);
        continue;
      }
      if (!ready) {
        if (msg.kind != READY || msg.watcher != watcher) _exit(104);
        send_message(report, msg);
        ready = 1; received = 0;
        if (pending_grant) {
          if (write(owner[1], "G", 1) != 1) _exit(111);
          granted = 1;
          if (barrier_phase && barrier_phase < 4) raise(SIGSTOP);
        }
        continue;
      }
      if (msg.kind != EXITED && msg.kind != SIGNALED && msg.kind != EXEC_FAILED) _exit(109);
      send_message(report, msg);
      if (session) kill_group(watcher);
      break;
    }
    siginfo_t info = {0};
    if (waitid(P_PID, watcher, &info, WEXITED | WNOHANG | WNOWAIT) < 0) _exit(105);
    if (info.si_pid == watcher && (info.si_code == CLD_EXITED || info.si_code == CLD_KILLED || info.si_code == CLD_DUMPED)) {
      ssize_t n;
      do { n = read(result[0], (char *)&msg + received, sizeof msg - received); } while (n < 0 && errno == EINTR);
      if (n > 0) { received += (size_t)n; continue; }
      if (session) kill_group(watcher);
      send_message(report, (struct message){ WATCHER_LOST, 0, 0, 0 });
      break;
    }
    if (interrupted) {
      send_message(report, (struct message){ CANCELLED, 0, 0, 0 });
      if (session) kill_group(watcher);
      kill(watcher, SIGKILL);
      break;
    }
    struct pollfd p[2] = { { result[0], POLLIN | POLLHUP, 0 }, { control, POLLIN | POLLHUP, 0 } };
    int r;
    do { r = poll(p, 2, 20); } while (r < 0 && errno == EINTR && !interrupted);
    if (r < 0 && errno == EINTR) continue;
    if (r < 0) _exit(106);
    if (p[0].revents & POLLIN) continue;
    if (p[1].revents) {
      char grant;
      ssize_t n;
      do { n = read(control, &grant, 1); } while (n < 0 && errno == EINTR);
      if (!granted && !pending_grant && n == 1 && grant == 'G') {
        if (!ready) pending_grant = 1;
        else {
          if (write(owner[1], &grant, 1) != 1) _exit(111);
          granted = 1;
          if (barrier_phase && barrier_phase < 4) raise(SIGSTOP);
        }
      } else {
        send_message(report, (struct message){ CANCELLED, 0, 0, 0 });
        if (session) kill_group(watcher);
        kill(watcher, SIGKILL);
        break;
      }
    }
  }
  close(owner[1]); close(result[0]); if (control >= 0) close(control);
  int status; wait_child(watcher, &status);
  _exit(0);
}
static int trial(int mode, int victim, int expected_kind, int expected_value) {
  int report[2], alive[2], control[2];
  if (pipe(report) || pipe(alive) || pipe(control)) return 1;
  pid_t supervisor = fork();
  if (supervisor < 0) return 1;
  if (!supervisor) {
    close(report[0]); close(alive[0]); close(control[1]);
    supervise(report[1], alive[1], control[0], mode);
  }
  close(report[1]); close(alive[1]); close(control[0]);
  struct message msg = {0};
  int failed = !receive(report[0], &msg) || msg.kind != READY;
  pid_t watcher = msg.watcher, worker = msg.worker;
  if (!failed && (getpgid(watcher) != watcher || getpgid(worker) != watcher || getsid(worker) != watcher)) failed = 1;
  if (!failed && write(control[1], "G", 1) != 1) failed = 1;
  char byte;
  if (!failed && (read(alive[0], &byte, 1) != 1 || byte != 'R')) failed = 1;
  if (!failed && victim && kill(victim == 1 ? supervisor : victim == 2 ? watcher : worker, SIGKILL)) failed = 1;
  if (victim != 1 && (!receive(report[0], &msg) || msg.kind != expected_kind || msg.value != expected_value)) failed = 1;
  struct pollfd p = { alive[0], POLLIN | POLLHUP, 0 };
  int r;
  do { r = poll(&p, 1, 5000); } while (r < 0 && errno == EINTR);
  if (r <= 0 || read(alive[0], &byte, 1) != 0) failed = 1;
  close(control[1]);
  if (failed) {
    if (watcher > 1) kill(-watcher, SIGKILL);
    if (worker > 1) kill(worker, SIGKILL);
    kill(supervisor, SIGKILL);
  }
  int status; wait_child(supervisor, &status);
  close(report[0]); close(alive[0]);
  printf("mode=%d victim=%d %s\n", mode, victim, failed ? "FAIL" : "PASS");
  return failed;
}
static int pregrant(int victim) {
  int report[2], alive[2], control[2];
  if (pipe(report) || pipe(alive) || pipe(control)) return 1;
  pid_t supervisor = fork();
  if (supervisor < 0) return 1;
  if (!supervisor) {
    close(report[0]); close(alive[0]); close(control[1]);
    supervise(report[1], alive[1], control[0], 0);
  }
  close(report[1]); close(alive[1]); close(control[0]);
  struct message msg = {0};
  int failed = !receive(report[0], &msg) || msg.kind != READY;
  pid_t watcher = msg.watcher, worker = msg.worker;
  pid_t target = victim == 1 ? supervisor : victim == 2 ? watcher : worker;
  int queue = kqueue();
  struct kevent event;
  EV_SET(&event, target, EVFILT_PROC, EV_ADD | EV_ONESHOT, NOTE_EXIT, 0, NULL);
  if (queue < 0 || kevent(queue, &event, 1, NULL, 0, NULL) < 0 || kill(target, SIGKILL)) failed = 1;
  struct timespec timeout = { 5, 0 };
  if (!failed && kevent(queue, NULL, 0, &event, 1, &timeout) != 1) failed = 1;
  if (!failed && victim != 1) {
    struct pollfd pending = { report[0], POLLIN | POLLHUP, 0 };
    if (poll(&pending, 1, 5000) <= 0 || !receive(report[0], &msg) ||
        msg.kind != (victim == 2 ? WATCHER_LOST : SIGNALED) ||
        (victim == 3 && msg.value != SIGKILL)) failed = 1;
  }
  close(control[1]);
  struct pollfd p = { alive[0], POLLIN | POLLHUP, 0 };
  char byte;
  if (poll(&p, 1, 5000) <= 0 || read(alive[0], &byte, 1) != 0) failed = 1;
  if (failed) {
    if (watcher > 1) kill(-watcher, SIGKILL);
    if (worker > 1) kill(worker, SIGKILL);
    kill(supervisor, SIGKILL);
  }
  int status; wait_child(supervisor, &status);
  if (queue >= 0) close(queue);
  close(report[0]); close(alive[0]);
  printf("pregrant victim=%d %s\n", victim, failed ? "FAIL" : "PASS");
  return failed;
}
static int cancelled(int after_grant) {
  int report[2], alive[2], control[2];
  if (pipe(report) || pipe(alive) || pipe(control)) return 1;
  pid_t supervisor = fork();
  if (supervisor < 0) return 1;
  if (!supervisor) {
    close(report[0]); close(alive[0]); close(control[1]);
    supervise(report[1], alive[1], control[0], 0);
  }
  close(report[1]); close(alive[1]); close(control[0]);
  struct message msg = {0};
  int failed = !receive(report[0], &msg) || msg.kind != READY;
  if (!failed && after_grant) {
    char byte;
    if (write(control[1], "G", 1) != 1 || read(alive[0], &byte, 1) != 1 || byte != 'R') failed = 1;
  }
  int queue = kqueue();
  struct kevent event;
  EV_SET(&event, msg.worker, EVFILT_PROC, EV_ADD | EV_ONESHOT, NOTE_EXIT, 0, NULL);
  if (queue < 0 || kevent(queue, &event, 1, NULL, 0, NULL) < 0) failed = 1;
  close(control[1]);
  pid_t watcher = msg.watcher, worker = msg.worker;
  struct pollfd pending = { report[0], POLLIN | POLLHUP, 0 };
  if (!failed && (poll(&pending, 1, 5000) <= 0 || !receive(report[0], &msg) || msg.kind != CANCELLED)) failed = 1;
  if (failed) {
    if (watcher > 1) kill(-watcher, SIGKILL);
    if (worker > 1) kill(worker, SIGKILL);
    kill(supervisor, SIGKILL);
  }
  int status; wait_child(supervisor, &status);
  struct pollfd p = { alive[0], POLLIN | POLLHUP, 0 };
  char byte;
  struct timespec timeout = { 5, 0 };
  if (queue < 0 || kevent(queue, NULL, 0, &event, 1, &timeout) != 1) failed = 1;
  if (poll(&p, 1, 5000) <= 0 || read(alive[0], &byte, 1) != 0) failed = 1;
  if (queue >= 0) close(queue);
  close(report[0]); close(alive[0]);
  printf("%s control EOF cancels %s\n", after_grant ? "postgrant" : "pregrant", failed ? "FAIL" : "PASS");
  return failed;
}
static int status_race(int phase, int victim) {
  int report[2], alive[2], control[2], notice[2], release[2];
  if (pipe(report) || pipe(alive) || pipe(control) || pipe(notice) || pipe(release)) return 1;
  barrier_phase = phase; barrier_notice = notice[1]; barrier_release = release[0];
  pid_t supervisor = fork();
  if (supervisor < 0) return 1;
  if (!supervisor) {
    close(report[0]); close(alive[0]); close(control[1]); close(notice[0]); close(release[1]);
    supervise(report[1], alive[1], control[0], 7);
  }
  barrier_phase = 0; barrier_notice = barrier_release = -1;
  close(report[1]); close(alive[1]); close(control[0]); close(notice[1]); close(release[0]);
  struct message msg = {0};
  int failed = !receive(report[0], &msg) || msg.kind != READY;
  pid_t watcher = msg.watcher, worker = msg.worker;
  int queue = kqueue();
  int watcher_exited = 0, worker_exited = 0;
  struct kevent changes[2], events[2];
  EV_SET(&changes[0], watcher, EVFILT_PROC, EV_ADD | EV_ONESHOT, NOTE_EXIT, 0, NULL);
  EV_SET(&changes[1], worker, EVFILT_PROC, EV_ADD | EV_ONESHOT, NOTE_EXIT, 0, NULL);
  if (queue < 0 || kevent(queue, changes, 2, NULL, 0, NULL) < 0) failed = 1;
  if (write(control[1], "G", 1) != 1) failed = 1;
  int status;
  if (waitpid(supervisor, &status, WUNTRACED) != supervisor || !WIFSTOPPED(status)) failed = 1;
  struct pollfd p = { notice[0], POLLIN, 0 };
  char byte;
  if (poll(&p, 1, 5000) <= 0 || read(notice[0], &byte, 1) != 1 || byte != phase) failed = 1;
  if (victim == 1) { close(control[1]); control[1] = -1; }
  else if (kill(victim == 2 ? watcher : supervisor, SIGKILL)) failed = 1;
  if (victim == 2) {
    struct timespec timeout = { 5, 0 };
    int found = 0;
    while (!found) {
      int n = kevent(queue, NULL, 0, events, 2, &timeout);
      if (n <= 0) { failed = 1; break; }
      for (int i = 0; i < n; i++) {
        if ((pid_t)events[i].ident == watcher) found = watcher_exited = 1;
        if ((pid_t)events[i].ident == worker) worker_exited = 1;
      }
    }
  }
  if (victim != 3 && kill(supervisor, SIGCONT)) failed = 1;
  if (victim == 3 && write(release[1], "R", 1) != 1) failed = 1;
  p.fd = report[0]; p.events = POLLIN | POLLHUP;
  if (poll(&p, 1, 5000) <= 0) failed = 1;
  else if (victim == 3) { if (receive(report[0], &msg)) failed = 1; }
  else if (!receive(report[0], &msg) || msg.kind != (phase == 3 ? EXITED : victim == 1 ? CANCELLED : WATCHER_LOST) ||
           (phase == 3 && msg.value != 7)) failed = 1;
  if (failed) { kill(-watcher, SIGKILL); kill(worker, SIGKILL); kill(supervisor, SIGKILL); }
  wait_child(supervisor, &status);
  while (!watcher_exited || !worker_exited) {
    struct timespec timeout = { 5, 0 };
    int n = kevent(queue, NULL, 0, events, 2, &timeout);
    if (n <= 0) { failed = 1; break; }
    for (int i = 0; i < n; i++) {
      if ((pid_t)events[i].ident == watcher) watcher_exited = 1;
      if ((pid_t)events[i].ident == worker) worker_exited = 1;
    }
  }
  p.fd = alive[0]; p.events = POLLIN | POLLHUP;
  if (poll(&p, 1, 5000) <= 0) failed = 1;
  else if (read(alive[0], &byte, 1) != 1 || byte != 'R' || read(alive[0], &byte, 1) != 0) failed = 1;
  if (control[1] >= 0) close(control[1]);
  close(report[0]); close(alive[0]); close(notice[0]); close(release[1]);
  if (queue >= 0) close(queue);
  printf("status phase=%d victim=%d %s\n", phase, victim, failed ? "FAIL" : "PASS");
  return failed;
}
static int startup_race(int phase, int action) {
  int report[2], alive[2], control[2], notice[2], release[2];
  if (pipe(report) || pipe(alive) || pipe(control) || pipe(notice) || pipe(release)) return 1;
  barrier_phase = phase; barrier_notice = notice[1]; barrier_release = release[0];
  pid_t supervisor = fork();
  if (supervisor < 0) return 1;
  if (!supervisor) {
    close(report[0]); close(alive[0]); close(control[1]); close(notice[0]); close(release[1]);
    supervise(report[1], alive[1], control[0], 0);
  }
  barrier_phase = 0; barrier_notice = barrier_release = -1;
  close(report[1]); close(alive[1]); close(control[0]); close(notice[1]); close(release[0]);
  struct message msg = {0};
  char byte;
  int failed = !receive(notice[0], &msg) || read(notice[0], &byte, 1) != 1 || byte != phase;
  pid_t watcher = msg.watcher, worker = msg.worker;
  int queue = kqueue();
  struct kevent changes[2], events[2];
  EV_SET(&changes[0], watcher, EVFILT_PROC, EV_ADD | EV_ONESHOT, NOTE_EXIT, 0, NULL);
  EV_SET(&changes[1], worker, EVFILT_PROC, EV_ADD | EV_ONESHOT, NOTE_EXIT, 0, NULL);
  if (queue < 0 || kevent(queue, changes, 2, NULL, 0, NULL) < 0) failed = 1;
  if (kill(watcher, SIGSTOP)) failed = 1;
  int stopped = 0, mib[] = { CTL_KERN, KERN_PROC, KERN_PROC_PID, watcher };
  for (int i = 0; i < 500 && !stopped; i++) {
    struct kinfo_proc process;
    size_t size = sizeof process;
    if (sysctl(mib, 4, &process, &size, NULL, 0) || size != sizeof process) break;
    stopped = process.kp_proc.p_stat == SSTOP;
    if (!stopped) poll(NULL, 0, 10);
  }
  if (!stopped) failed = 1;
  if (action == 1) { close(control[1]); control[1] = -1; }
  else if (kill(action == 3 ? watcher : supervisor,
                action == 3 ? SIGKILL : action == 2 ? SIGTERM : action == 4 ? SIGINT : SIGHUP)) failed = 1;
  struct pollfd pending = { report[0], POLLIN | POLLHUP, 0 };
  if (poll(&pending, 1, 1000) <= 0 || !receive(report[0], &msg) ||
      msg.kind != (action == 3 ? WATCHER_LOST : CANCELLED)) { fprintf(stderr, "report phase=%d action=%d kind=%d stopped=%d\n", phase, action, msg.kind, stopped); failed = 1; }
  if (failed) { if (watcher > 1) kill(-watcher, SIGKILL); if (worker > 1) kill(worker, SIGKILL); kill(supervisor, SIGKILL); }
  int status; wait_child(supervisor, &status);
  if (!failed && (!WIFEXITED(status) || WEXITSTATUS(status))) { fprintf(stderr, "supervisor status=%d\n", status); failed = 1; }
  int watcher_exited = 0, worker_exited = 0;
  while (queue >= 0 && (!watcher_exited || !worker_exited)) {
    struct timespec timeout = { 5, 0 };
    int n = kevent(queue, NULL, 0, events, 2, &timeout);
    if (n <= 0) { fprintf(stderr, "exit events phase=%d action=%d watcher=%d worker=%d n=%d\n", phase, action, watcher_exited, worker_exited, n); failed = 1; break; }
    for (int i = 0; i < n; i++) {
      if ((pid_t)events[i].ident == watcher) watcher_exited = 1;
      if ((pid_t)events[i].ident == worker) worker_exited = 1;
    }
  }
  struct pollfd p = { alive[0], POLLIN | POLLHUP, 0 };
  if (poll(&p, 1, 5000) <= 0 || read(alive[0], &byte, 1) != 0) { fprintf(stderr, "alive phase=%d action=%d\n", phase, action); failed = 1; }
  if (control[1] >= 0) close(control[1]);
  close(report[0]); close(alive[0]); close(notice[0]); close(release[1]);
  if (queue >= 0) close(queue);
  printf("startup phase=%d action=%d %s\n", phase, action, failed ? "FAIL" : "PASS");
  return failed;
}
static int session_race(int phase, int action) {
  int report[2], alive[2], control[2], notice[2], release[2];
  if (pipe(report) || pipe(alive) || pipe(control) || pipe(notice) || pipe(release)) return 1;
  barrier_phase = phase; barrier_notice = notice[1]; barrier_release = release[0];
  pid_t supervisor = fork();
  if (supervisor < 0) return 1;
  if (!supervisor) {
    close(report[0]); close(alive[0]); close(control[1]); close(notice[0]); close(release[1]);
    supervise(report[1], alive[1], control[0], 0);
  }
  barrier_phase = 0; barrier_notice = barrier_release = -1;
  close(report[1]); close(alive[1]); close(control[0]); close(notice[1]); close(release[0]);
  struct message msg = {0};
  char byte;
  struct pollfd p = { notice[0], POLLIN | POLLHUP, 0 };
  int failed = poll(&p, 1, 5000) <= 0 || !receive(notice[0], &msg) ||
    read(notice[0], &byte, 1) != 1 || byte != phase || msg.kind != SESSION;
  pid_t watcher = msg.watcher;
  int queue = kqueue();
  struct kevent event;
  EV_SET(&event, watcher, EVFILT_PROC, EV_ADD | EV_ONESHOT, NOTE_EXIT, 0, NULL);
  if (failed || watcher <= 1 || queue < 0 || kevent(queue, &event, 1, NULL, 0, NULL) < 0) failed = 1;
  if (!failed) {
    if (action == 1) { close(control[1]); control[1] = -1; }
    else if (kill(action == 2 ? supervisor : watcher, SIGKILL)) failed = 1;
  }
  int status;
  if (action == 2) {
    wait_child(supervisor, &status);
    if (!WIFSIGNALED(status) || WTERMSIG(status) != SIGKILL) failed = 1;
  }
  if (phase == 7 || action == 2) {
    if (write(release[1], "R", 1) != 1) failed = 1;
  }
  p.fd = report[0];
  if (poll(&p, 1, 5000) <= 0) failed = 1;
  else if (action == 2) { if (receive(report[0], &msg)) failed = 1; }
  else if (!receive(report[0], &msg) || msg.kind != (action == 1 ? CANCELLED : WATCHER_LOST)) failed = 1;
  if (failed) { if (watcher > 1) kill(-watcher, SIGKILL); kill(supervisor, SIGKILL); }
  if (action != 2) {
    wait_child(supervisor, &status);
    if (!WIFEXITED(status) || WEXITSTATUS(status)) failed = 1;
  }
  struct timespec timeout = { 5, 0 };
  if (queue < 0 || kevent(queue, NULL, 0, &event, 1, &timeout) != 1 || (pid_t)event.ident != watcher) failed = 1;
  p.fd = notice[0];
  if (poll(&p, 1, 5000) <= 0 || read(notice[0], &byte, 1) != 0) failed = 1;
  p.fd = alive[0];
  if (poll(&p, 1, 5000) <= 0 || read(alive[0], &byte, 1) != 0) failed = 1;
  if (control[1] >= 0) close(control[1]);
  close(report[0]); close(alive[0]); close(notice[0]); close(release[1]);
  if (queue >= 0) close(queue);
  printf("session phase=%d action=%d no_fork_no_grant %s\n", phase, action, failed ? "FAIL" : "PASS");
  return failed;
}
static int postcheck_race(int action) {
  int report[2], alive[2], control[2], notice[2], release[2];
  if (pipe(report) || pipe(alive) || pipe(control) || pipe(notice) || pipe(release)) return 1;
  barrier_phase = 9; barrier_notice = notice[1]; barrier_release = release[0];
  pid_t supervisor = fork();
  if (supervisor < 0) return 1;
  if (!supervisor) {
    close(report[0]); close(alive[0]); close(control[1]); close(notice[0]); close(release[1]);
    supervise(report[1], alive[1], control[0], 7);
  }
  barrier_phase = 0; barrier_notice = barrier_release = -1;
  close(report[1]); close(alive[1]); close(control[0]); close(notice[1]); close(release[0]);
  struct message msg = {0};
  char byte;
  struct pollfd p = { notice[0], POLLIN | POLLHUP, 0 };
  int failed = poll(&p, 1, 5000) <= 0 || !receive(notice[0], &msg) || msg.kind != SESSION ||
    read(notice[0], &byte, 1) != 1 || byte != 9;
  pid_t watcher = msg.watcher, worker = 0;
  int queue = kqueue(), status = 0;
  struct kevent change, events[2];
  EV_SET(&change, watcher, EVFILT_PROC, EV_ADD | EV_ONESHOT, NOTE_EXIT, 0, NULL);
  if (watcher <= 1 || queue < 0 || kevent(queue, &change, 1, NULL, 0, NULL) < 0) failed = 1;
  if (action == 1) {
    if (kill(supervisor, SIGKILL)) failed = 1;
    wait_child(supervisor, &status);
    if (!WIFSIGNALED(status) || WTERMSIG(status) != SIGKILL) failed = 1;
  } else {
    if (kill(supervisor, SIGSTOP) || waitpid(supervisor, &status, WUNTRACED) != supervisor || !WIFSTOPPED(status)) failed = 1;
    close(control[1]); control[1] = -1;
  }
  if (write(release[1], "R", 1) != 1) failed = 1;
  if (poll(&p, 1, 5000) <= 0 || !receive(notice[0], &msg) || msg.kind != READY || msg.watcher != watcher ||
      read(notice[0], &byte, 1) != 1 || byte != 9) failed = 1;
  worker = msg.worker;
  EV_SET(&change, worker, EVFILT_PROC, EV_ADD | EV_ONESHOT, NOTE_EXIT, 0, NULL);
  if (worker <= 1 || queue < 0 || kevent(queue, &change, 1, NULL, 0, NULL) < 0) failed = 1;
  p.fd = alive[0];
  if (poll(&p, 1, 0) != 0) failed = 1;
  if (action == 1) {
    if (write(release[1], "R", 1) != 1) failed = 1;
  } else if (kill(supervisor, SIGCONT)) failed = 1;
  p.fd = report[0];
  if (poll(&p, 1, 5000) <= 0) failed = 1;
  else if (action == 1) { if (receive(report[0], &msg)) failed = 1; }
  else if (!receive(report[0], &msg) || msg.kind != CANCELLED) failed = 1;
  if (failed) { if (watcher > 1) kill(-watcher, SIGKILL); if (worker > 1) kill(worker, SIGKILL); kill(supervisor, SIGKILL); }
  if (action != 1) {
    wait_child(supervisor, &status);
    if (!WIFEXITED(status) || WEXITSTATUS(status)) failed = 1;
  }
  int exits = 0;
  while (queue >= 0 && exits != 3) {
    struct timespec timeout = { 5, 0 };
    int n = kevent(queue, NULL, 0, events, 2, &timeout);
    if (n <= 0) { failed = 1; break; }
    for (int i = 0; i < n; i++) {
      if ((pid_t)events[i].ident == watcher) exits |= 1;
      if ((pid_t)events[i].ident == worker) exits |= 2;
    }
  }
  p.fd = alive[0];
  if (poll(&p, 1, 5000) <= 0 || read(alive[0], &byte, 1) != 0) failed = 1;
  if (control[1] >= 0) close(control[1]);
  close(report[0]); close(alive[0]); close(notice[0]); close(release[1]);
  if (queue >= 0) close(queue);
  printf("postcheck action=%d forked=1 no_grant_no_exec exits=%d %s\n", action, exits, failed ? "FAIL" : "PASS");
  return failed;
}
static int postgrant_exec(int action) {
  int report[2], alive[2], control[2], notice[2], release[2];
  if (pipe(report) || pipe(alive) || pipe(control) || pipe(notice) || pipe(release)) return 1;
  barrier_phase = 10; barrier_notice = notice[1]; barrier_release = release[0];
  pid_t supervisor = fork();
  if (supervisor < 0) return 1;
  if (!supervisor) {
    close(report[0]); close(alive[0]); close(control[1]); close(notice[0]); close(release[1]);
    supervise(report[1], alive[1], control[0], 10);
  }
  barrier_phase = 0; barrier_notice = barrier_release = -1;
  close(report[1]); close(alive[1]); close(control[0]); close(notice[1]); close(release[0]);
  struct message msg = {0};
  struct pollfd p = { report[0], POLLIN | POLLHUP, 0 };
  int failed = poll(&p, 1, 5000) <= 0 || !receive(report[0], &msg) || msg.kind != READY;
  pid_t watcher = msg.watcher, worker = msg.worker;
  int queue = kqueue(), status = 0, exits = 0;
  struct kevent changes[2], events[2];
  EV_SET(&changes[0], watcher, EVFILT_PROC, EV_ADD | EV_ONESHOT, NOTE_EXIT, 0, NULL);
  EV_SET(&changes[1], worker, EVFILT_PROC, EV_ADD | EV_ONESHOT, NOTE_EXIT, 0, NULL);
  if (watcher <= 1 || worker <= 1 || queue < 0 || kevent(queue, changes, 2, NULL, 0, NULL) < 0) failed = 1;
  char byte;
  if (write(control[1], "G", 1) != 1) failed = 1;
  p.fd = notice[0];
  if (poll(&p, 1, 5000) <= 0 || read(notice[0], &byte, 1) != 1 || byte != 10) failed = 1;
  /* The worker has consumed the watcher's grant, but has not reached exec. */
  if (kill(supervisor, SIGSTOP) || waitpid(supervisor, &status, WUNTRACED) != supervisor || !WIFSTOPPED(status)) failed = 1;
  if (kill(watcher, SIGSTOP)) failed = 1;
  int stopped = 0, mib[] = { CTL_KERN, KERN_PROC, KERN_PROC_PID, watcher };
  for (int i = 0; i < 500 && !stopped; i++) {
    struct kinfo_proc process; size_t size = sizeof process;
    if (sysctl(mib, 4, &process, &size, NULL, 0) || size != sizeof process) break;
    stopped = process.kp_proc.p_stat == SSTOP;
    if (!stopped) poll(NULL, 0, 10);
  }
  if (!stopped) failed = 1;
  if (action == 1) {
    if (kill(supervisor, SIGKILL)) failed = 1;
    wait_child(supervisor, &status);
    if (!WIFSIGNALED(status) || WTERMSIG(status) != SIGKILL) failed = 1;
  } else if (action == 2) {
    if (kill(watcher, SIGKILL)) failed = 1;
    struct timespec timeout = { 5, 0 };
    int n = kevent(queue, NULL, 0, events, 2, &timeout);
    if (n != 1 || (pid_t)events[0].ident != watcher) failed = 1;
    else exits |= 1;
  } else { close(control[1]); control[1] = -1; }
  if (write(release[1], "R", 1) != 1) failed = 1;
  p.fd = alive[0];
  if (poll(&p, 1, 5000) <= 0 || read(alive[0], &byte, 1) != 1 || byte != 'R' ||
      read(alive[0], &byte, 1) != 1 || byte != 'E' || read(alive[0], &byte, 1) != 0) failed = 1;
  while (queue >= 0 && !(exits & 2)) {
    struct timespec timeout = { 5, 0 };
    int n = kevent(queue, NULL, 0, events, 2, &timeout);
    if (n <= 0) { failed = 1; break; }
    for (int i = 0; i < n; i++) {
      if ((pid_t)events[i].ident == watcher) exits |= 1;
      if ((pid_t)events[i].ident == worker) exits |= 2;
    }
  }
  if (action == 1) { if (kill(watcher, SIGCONT)) failed = 1; }
  else if (kill(supervisor, SIGCONT)) failed = 1;
  p.fd = report[0];
  if (poll(&p, 1, 5000) <= 0) failed = 1;
  else if (action == 1) { if (receive(report[0], &msg)) failed = 1; }
  else if (!receive(report[0], &msg) || msg.kind != (action == 2 ? WATCHER_LOST : CANCELLED)) failed = 1;
  if (failed) { if (watcher > 1) kill(-watcher, SIGKILL); if (worker > 1) kill(worker, SIGKILL); kill(supervisor, SIGKILL); }
  if (action != 1) {
    wait_child(supervisor, &status);
    if (!WIFEXITED(status) || WEXITSTATUS(status) != 0) failed = 1;
  }
  while (queue >= 0 && exits != 3) {
    struct timespec timeout = { 5, 0 };
    int n = kevent(queue, NULL, 0, events, 2, &timeout);
    if (n <= 0) { failed = 1; break; }
    for (int i = 0; i < n; i++) {
      if ((pid_t)events[i].ident == watcher) exits |= 1;
      if ((pid_t)events[i].ident == worker) exits |= 2;
    }
  }
  if (control[1] >= 0) close(control[1]);
  close(report[0]); close(alive[0]); close(notice[0]); close(release[1]);
  if (queue >= 0) close(queue);
  printf("postgrant action=%d exec=E exits=%d %s\n", action, exits, failed ? "FAIL" : "PASS");
  return failed;
}
static int session_grant(void) {
  int report[2], alive[2], control[2], notice[2], release[2];
  if (pipe(report) || pipe(alive) || pipe(control) || pipe(notice) || pipe(release)) return 1;
  barrier_phase = 8; barrier_notice = notice[1]; barrier_release = release[0];
  pid_t supervisor = fork();
  if (supervisor < 0) return 1;
  if (!supervisor) {
    close(report[0]); close(alive[0]); close(control[1]); close(notice[0]); close(release[1]);
    supervise(report[1], alive[1], control[0], 0);
  }
  barrier_phase = 0; barrier_notice = barrier_release = -1;
  close(report[1]); close(alive[1]); close(control[0]); close(notice[1]); close(release[0]);
  struct message msg = {0};
  char byte;
  struct pollfd p = { notice[0], POLLIN | POLLHUP, 0 };
  int failed = poll(&p, 1, 5000) <= 0 || !receive(notice[0], &msg) || msg.kind != SESSION ||
    read(notice[0], &byte, 1) != 1 || byte != 8;
  pid_t watcher = msg.watcher, worker = 0;
  p.fd = alive[0];
  if (poll(&p, 1, 0) != 0 || write(release[1], "R", 1) != 1) failed = 1;
  p.fd = notice[0];
  if (poll(&p, 1, 5000) <= 0 || !receive(notice[0], &msg) || msg.kind != READY || msg.watcher != watcher) failed = 1;
  worker = msg.worker;
  p.fd = report[0];
  if (poll(&p, 1, 5000) <= 0 || !receive(report[0], &msg) || msg.kind != READY || msg.worker != worker) failed = 1;
  int queue = kqueue();
  struct kevent changes[2], events[2];
  EV_SET(&changes[0], watcher, EVFILT_PROC, EV_ADD | EV_ONESHOT, NOTE_EXIT, 0, NULL);
  EV_SET(&changes[1], worker, EVFILT_PROC, EV_ADD | EV_ONESHOT, NOTE_EXIT, 0, NULL);
  if (watcher <= 1 || worker <= 1 || queue < 0 || kevent(queue, changes, 2, NULL, 0, NULL) < 0) failed = 1;
  p.fd = alive[0];
  if (poll(&p, 1, 0) != 0 || write(control[1], "G", 1) != 1 || poll(&p, 1, 5000) <= 0 ||
      read(alive[0], &byte, 1) != 1 || byte != 'R') failed = 1;
  close(control[1]);
  p.fd = report[0];
  if (poll(&p, 1, 5000) <= 0 || !receive(report[0], &msg) || msg.kind != CANCELLED) failed = 1;
  if (failed) { if (watcher > 1) kill(-watcher, SIGKILL); if (worker > 1) kill(worker, SIGKILL); kill(supervisor, SIGKILL); }
  int status; wait_child(supervisor, &status);
  if (!WIFEXITED(status) || WEXITSTATUS(status)) failed = 1;
  int exits = 0;
  while (queue >= 0 && exits != 3) {
    struct timespec timeout = { 5, 0 };
    int n = kevent(queue, NULL, 0, events, 2, &timeout);
    if (n <= 0) { failed = 1; break; }
    for (int i = 0; i < n; i++) {
      if ((pid_t)events[i].ident == watcher) exits |= 1;
      if ((pid_t)events[i].ident == worker) exits |= 2;
    }
  }
  p.fd = alive[0];
  if (poll(&p, 1, 5000) <= 0 || read(alive[0], &byte, 1) != 0) failed = 1;
  close(report[0]); close(alive[0]); close(notice[0]); close(release[1]);
  if (queue >= 0) close(queue);
  printf("session ack fork grant cleanup %s\n", failed ? "FAIL" : "PASS");
  return failed;
}
static int presession(int action) {
  int report[2], alive[2], control[2], notice[2], release[2];
  if (pipe(report) || pipe(alive) || pipe(control) || pipe(notice) || pipe(release)) return 1;
  barrier_phase = 6; barrier_notice = notice[1]; barrier_release = release[0];
  pid_t supervisor = fork();
  if (supervisor < 0) return 1;
  if (!supervisor) {
    close(report[0]); close(alive[0]); close(control[1]); close(notice[0]); close(release[1]);
    supervise(report[1], alive[1], control[0], 0);
  }
  barrier_phase = 0; barrier_notice = barrier_release = -1;
  close(report[1]); close(alive[1]); close(control[0]); close(notice[1]); close(release[0]);
  struct message msg = {0};
  char byte;
  int failed = !receive(notice[0], &msg) || read(notice[0], &byte, 1) != 1 || byte != 6;
  pid_t watcher = msg.watcher, worker = 0;
  int queue = kqueue(), stopped = 0;
  struct kevent change, event;
  EV_SET(&change, watcher, EVFILT_PROC, EV_ADD | EV_ONESHOT, NOTE_EXIT, 0, NULL);
  if (queue < 0 || kevent(queue, &change, 1, NULL, 0, NULL) < 0 || kill(watcher, SIGSTOP)) failed = 1;
  int mib[] = { CTL_KERN, KERN_PROC, KERN_PROC_PID, watcher };
  for (int i = 0; i < 500 && !stopped; i++) {
    struct kinfo_proc process;
    size_t size = sizeof process;
    if (sysctl(mib, 4, &process, &size, NULL, 0) || size != sizeof process) break;
    stopped = process.kp_proc.p_stat == SSTOP;
    if (!stopped) poll(NULL, 0, 10);
  }
  if (!stopped || getsid(watcher) == watcher) failed = 1;
  if (action == 1) { if (kill(supervisor, SIGKILL)) failed = 1; }
  else if (action == 2) { close(control[1]); control[1] = -1; }
  else if (kill(watcher, SIGKILL)) failed = 1;
  int status;
  if (action != 1) {
    struct pollfd p = { report[0], POLLIN | POLLHUP, 0 };
    if (poll(&p, 1, 5000) <= 0 || !receive(report[0], &msg) ||
        msg.kind != (action == 2 ? CANCELLED : WATCHER_LOST)) failed = 1;
  }
  wait_child(supervisor, &status);
  if (action == 1) {
    struct pollfd report_pending = { report[0], POLLIN | POLLHUP, 0 };
    if (poll(&report_pending, 1, 5000) <= 0 || read(report[0], &byte, 1) != 0) failed = 1;
    if (!WIFSIGNALED(status) || WTERMSIG(status) != SIGKILL || kill(watcher, SIGCONT) || write(release[1], "R", 1) != 1) failed = 1;
    struct pollfd p = { notice[0], POLLIN | POLLHUP, 0 };
    if (poll(&p, 1, 5000) <= 0 || read(notice[0], &byte, 1) != 0) failed = 1;
  } else if (!WIFEXITED(status) || WEXITSTATUS(status) != 0) failed = 1;
  int watcher_exited = 0, worker_exited = !worker;
  while (!watcher_exited || !worker_exited) {
    struct timespec timeout = { 5, 0 };
    if (kevent(queue, NULL, 0, &event, 1, &timeout) != 1) { failed = 1; break; }
    if ((pid_t)event.ident == watcher) watcher_exited = 1;
    if ((pid_t)event.ident == worker) worker_exited = 1;
  }
  struct pollfd p = { alive[0], POLLIN | POLLHUP, 0 };
  if (poll(&p, 1, 5000) <= 0 || read(alive[0], &byte, 1) != 0) failed = 1;
  p.fd = notice[0];
  if (action != 1 && poll(&p, 1, 0) > 0 && read(notice[0], &byte, 1) == 1 && byte == 'K') {
    fprintf(stderr, "presession action=%d unsafe group signal attempted\n", action);
    failed = 1;
  }
  if (control[1] >= 0) close(control[1]);
  close(report[0]); close(alive[0]); close(notice[0]); close(release[1]); close(queue);
  printf("presession action=%d worker_forked=%d %s\n", action, worker != 0, failed ? "FAIL" : "PASS");
  return failed;
}
int main(void) {
  signal(SIGPIPE, SIG_IGN);
  return postgrant_exec(1) | postgrant_exec(2) | postgrant_exec(3) | postcheck_race(1) | postcheck_race(2) | session_grant() | session_race(7, 1) | session_race(7, 2) | session_race(7, 3) |
    session_race(8, 1) | session_race(8, 2) | session_race(8, 3) |
    presession(1) | presession(2) | presession(3) | trial(7, 0, EXITED, 7) | trial(125, 0, EXITED, 125) |
    trial(1, 0, SIGNALED, SIGKILL) | trial(0, 1, 0, 0) |
    trial(0, 2, WATCHER_LOST, 0) | trial(0, 3, SIGNALED, SIGKILL) |
    trial(126, 0, EXEC_FAILED, ENOENT) | trial(127, 0, EXITED, 127) |
    pregrant(1) | pregrant(2) | pregrant(3) | cancelled(0) | cancelled(1) |
    status_race(1, 1) | status_race(2, 1) | status_race(3, 1) |
    status_race(1, 2) | status_race(2, 2) | status_race(3, 2) |
    status_race(1, 3) | status_race(2, 3) | status_race(3, 3) |
    startup_race(4, 1) | startup_race(5, 1) | startup_race(4, 2) |
    startup_race(5, 2) | startup_race(4, 3) | startup_race(5, 3) |
    startup_race(4, 4) | startup_race(5, 4) | startup_race(4, 5) | startup_race(5, 5);
}
