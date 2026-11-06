/* W385 host rewrite: Axe/ale chunk-sfn1dbxq.js SHA-256
 * 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
 * UTF-16 [82919,87427), [3506526,3518705), Mw chunk-25vrbr0v.js
 * SHA-256 30b526b2b8573161c4d1ec0f5b720701820375443a0e3d84c336cff9d839537e
 * [943,3031). Source has no reciprocal owner or fd3 protocol. */
#if defined(__APPLE__)
#include <sys/types.h>
#include <sys/wait.h>
#include <poll.h>
#include <signal.h>
#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

enum { SESSION = 1, READY, EXITED, SIGNALED, EXEC_FAILED, SETUP_FAILED };
struct message { int kind, value; pid_t watcher, worker; };
static volatile sig_atomic_t cancelled;
static void cancel(int sig) { (void)sig; cancelled = 1; }
#ifdef SUPERVISOR_TEST_GATE
static void test_barrier(const char *phase) {
  const char *selected = getenv("SUPERVISOR_TEST_PHASE");
  if (!selected || strcmp(selected, phase)) return;
  dprintf(4, "%s %ld\n", phase, (long)getpid());
  char token;
  ssize_t n;
  do { n = read(5, &token, 1); } while (n < 0 && errno == EINTR);
  if (n != 1) _exit(125);
}
#endif
static int fail(const char *stage, int error) {
  dprintf(3, "{\"kind\":\"error\",\"stage\":\"%s\",\"errno\":%d}\n", stage, error);
  return 125;
}
static int send_message(int fd, struct message msg) {
  ssize_t n;
  do { n = write(fd, &msg, sizeof msg); } while (n < 0 && errno == EINTR);
  return n == sizeof msg ? 0 : -1;
}
static void watcher_main(int owner, int result, char **command) {
#ifdef SUPERVISOR_TEST_GATE
  test_barrier("startup");
#endif
  if (setsid() < 0) _exit(125);
  if (send_message(result, (struct message){SESSION, 0, getpid(), 0})) _exit(125);
  char token;
  ssize_t n;
  do { n = read(owner, &token, 1); } while (n < 0 && errno == EINTR);
  if (n != 1 || token != 'S') _exit(125);
  struct pollfd ownership = {owner, POLLIN | POLLHUP, 0};
  if (poll(&ownership, 1, 0) < 0 || (ownership.revents & POLLHUP)) _exit(125);
  int gate[2], exec_error[2];
  if (pipe(gate) || pipe(exec_error) || fcntl(exec_error[1], F_SETFD, FD_CLOEXEC) < 0) _exit(125);
  pid_t worker = fork();
  if (worker < 0) _exit(125);
  if (worker == 0) {
    close(owner); close(result); close(gate[1]); close(exec_error[0]);
    signal(SIGTERM, SIG_DFL); signal(SIGINT, SIG_DFL); signal(SIGHUP, SIG_DFL); signal(SIGPIPE, SIG_DFL);
    int nullfd = open("/dev/null", O_RDONLY);
    if (nullfd < 0 || dup2(nullfd, STDIN_FILENO) < 0) {
      struct message error = {SETUP_FAILED, errno, 0, 0};
      (void)write(exec_error[1], &error, sizeof error); _exit(125);
    }
    if (nullfd != STDIN_FILENO) close(nullfd);
    do { n = read(gate[0], &token, 1); } while (n < 0 && errno == EINTR);
    close(gate[0]);
    if (n != 1 || token != 'G') _exit(125);
#ifdef SUPERVISOR_TEST_GATE
    test_barrier("postgrant");
    close(4); close(5);
#endif
    execvp(command[0], command);
    struct message error = {EXEC_FAILED, errno, 0, 0};
    (void)write(exec_error[1], &error, sizeof error); _exit(127);
  }
  close(gate[0]); close(exec_error[1]);
  if (send_message(result, (struct message){READY, 0, getpid(), worker})) _exit(125);
  int completed = 0, granted = 0;
  for (;;) {
    siginfo_t info = {0};
    if (!completed && waitid(P_PID, worker, &info, WEXITED | WNOHANG | WNOWAIT) < 0) _exit(125);
    if (info.si_pid == worker && (info.si_code == CLD_EXITED || info.si_code == CLD_KILLED || info.si_code == CLD_DUMPED)) {
      int status; pid_t waited;
      do { waited = waitpid(worker, &status, 0); } while (waited < 0 && errno == EINTR);
      if (waited != worker) _exit(125);
      struct message msg = {0};
      do { n = read(exec_error[0], &msg, sizeof msg); } while (n < 0 && errno == EINTR);
      if (n == 0) {
        if (WIFEXITED(status)) msg = (struct message){EXITED, WEXITSTATUS(status), 0, 0};
        else if (WIFSIGNALED(status)) msg = (struct message){SIGNALED, WTERMSIG(status), 0, 0};
        else _exit(125);
      } else if (n != sizeof msg || (msg.kind != EXEC_FAILED && msg.kind != SETUP_FAILED)) _exit(125);
      if (send_message(result, msg)) _exit(125);
      completed = 1;
    }
    struct pollfd p = {owner, POLLIN | POLLHUP, 0};
    int r; do { r = poll(&p, 1, 20); } while (r < 0 && errno == EINTR);
    if (r < 0) _exit(125);
    if (r > 0) {
      do { n = read(owner, &token, 1); } while (n < 0 && errno == EINTR);
      if (!granted && !completed && n == 1 && token == 'G' && write(gate[1], &token, 1) == 1) {
        granted = 1; close(gate[1]);
      } else { kill(-getpid(), SIGKILL); _exit(125); }
    }
  }
}
int main(int argc, char **argv) {
  if (fcntl(3, F_GETFD) < 0) { fputs("supervisor: status fd 3 required\n", stderr); return 125; }
  int immediate = argc > 1 && !strcmp(argv[1], "--kill-immediately");
  if (argc < 2 + immediate) return fail("arguments", EINVAL);
  if (signal(SIGPIPE, SIG_IGN) == SIG_ERR) return fail("signal", errno);
  struct sigaction action = {0}; action.sa_handler = cancel; sigemptyset(&action.sa_mask);
  if (sigaction(SIGTERM, &action, NULL) || sigaction(SIGINT, &action, NULL) || sigaction(SIGHUP, &action, NULL)) return fail("signal", errno);
  int owner[2], result[2];
  if (pipe(owner) || pipe(result)) return fail("pipe", errno);
  pid_t watcher = fork();
  if (watcher < 0) return fail("fork", errno);
  if (!watcher) {
    close(owner[1]); close(result[0]); close(3);
#ifdef SUPERVISOR_TEST_GATE
    if (getenv("SUPERVISOR_TEST_GATE") && !getenv("SUPERVISOR_TEST_PHASE")) { close(4); close(5); }
#endif
    signal(SIGTERM, SIG_DFL); signal(SIGINT, SIG_DFL); signal(SIGHUP, SIG_DFL);
    watcher_main(owner[0], result[1], argv + 1 + immediate); _exit(125);
  }
  close(owner[0]); close(result[1]);
  int flags = fcntl(result[0], F_GETFL);
  int session = 0, ready = 0, outcome = 125, saved = 0, reported = 0;
  const char *stage = "gate";
  struct message msg = {0}; size_t received = 0;
  if (flags < 0 || fcntl(result[0], F_SETFL, flags | O_NONBLOCK) < 0) { saved = errno; stage = "fcntl"; goto cleanup; }
  for (;;) {
    while (received < sizeof msg) {
      ssize_t n = read(result[0], (char *)&msg + received, sizeof msg - received);
      if (n > 0) { received += (size_t)n; continue; }
      if (n < 0 && errno == EINTR) continue;
      if (n < 0 && errno != EAGAIN && errno != EWOULDBLOCK) { saved = errno; stage = "status"; goto cleanup; }
      break;
    }
    if (received == sizeof msg) {
      received = 0;
      if (!session) {
        if (msg.kind != SESSION || msg.watcher != watcher) { saved = EIO; goto cleanup; }
        session = 1;
        struct pollfd control = {STDIN_FILENO, POLLIN | POLLHUP, 0};
        int r = poll(&control, 1, 0);
        if (r < 0) { saved = errno; stage = "poll"; goto cleanup; }
        if (cancelled || (r > 0 && control.revents)) { outcome = 130; goto cleanup; }
        if (write(owner[1], "S", 1) != 1) { saved = errno; goto cleanup; }
      } else if (!ready) {
        if (msg.kind != READY || msg.watcher != watcher || msg.worker <= 1) { saved = EIO; goto cleanup; }
        ready = 1;
#ifdef SUPERVISOR_TEST_GATE
        if (getenv("SUPERVISOR_TEST_GATE")) {
          dprintf(4, "%ld %ld\n", (long)msg.worker, (long)watcher);
          char release; ssize_t n;
          do { n = read(5, &release, 1); } while (n < 0 && errno == EINTR && !cancelled);
        }
#endif
        struct pollfd control = {STDIN_FILENO, POLLIN | POLLHUP, 0};
        int r = poll(&control, 1, 0);
        if (r < 0) { saved = errno; stage = "poll"; goto cleanup; }
        if (cancelled || (r > 0 && control.revents)) { outcome = 130; goto cleanup; }
        if (write(owner[1], "G", 1) != 1) { saved = errno; goto cleanup; }
      } else {
        if (msg.kind == EXITED) { dprintf(3, "{\"kind\":\"exit\",\"code\":%d}\n", msg.value); outcome = msg.value; reported = 1; }
        else if (msg.kind == SIGNALED) { dprintf(3, "{\"kind\":\"signal\",\"signal\":%d}\n", msg.value); outcome = 128 + msg.value; reported = 1; }
        else if (msg.kind == EXEC_FAILED || msg.kind == SETUP_FAILED) { stage = msg.kind == EXEC_FAILED ? "exec" : "child_setup"; saved = msg.value; }
        else saved = EIO;
        goto cleanup;
      }
      continue;
    }
    siginfo_t info = {0};
    if (waitid(P_PID, watcher, &info, WEXITED | WNOHANG | WNOWAIT) < 0) { saved = errno; if (saved == ECHILD) session = 0; stage = "waitid"; goto cleanup; }
    if (info.si_pid == watcher && (info.si_code == CLD_EXITED || info.si_code == CLD_KILLED || info.si_code == CLD_DUMPED)) {
      ssize_t n = read(result[0], (char *)&msg + received, sizeof msg - received);
      if (n > 0) { received += (size_t)n; continue; }
      saved = EIO; goto cleanup;
    }
    if (cancelled) { outcome = 130; goto cleanup; }
    struct pollfd p[2] = {{result[0], POLLIN | POLLHUP, 0}, {STDIN_FILENO, POLLIN | POLLHUP, 0}};
    int r; do { r = poll(p, 2, 20); } while (r < 0 && errno == EINTR && !cancelled);
    if (r < 0 && errno == EINTR) continue;
    if (r < 0) { saved = errno; stage = "poll"; goto cleanup; }
    if (p[0].revents & POLLIN) continue;
    if (p[1].revents) { outcome = 130; goto cleanup; }
  }
cleanup:
  if (session) {
    if (!immediate) {
      (void)kill(-watcher, SIGTERM);
      struct timespec delay = {0, 200000000};
      while (nanosleep(&delay, &delay) < 0 && errno == EINTR) {}
    }
    (void)kill(-watcher, SIGKILL);
  }
  (void)kill(watcher, SIGKILL);
  close(owner[1]); close(result[0]);
  int status; while (waitpid(watcher, &status, 0) < 0 && errno == EINTR) {}
  if (reported) return outcome;
  if (outcome == 130) { dprintf(3, "{\"kind\":\"cancelled\"}\n"); return 130; }
  if (saved || outcome == 125) return fail(stage, saved ? saved : EIO);
  return outcome;
}
#else
#include <stdio.h>
int main(void) { fputs("supervisor: unsupported platform\n", stderr); return 125; }
#endif
