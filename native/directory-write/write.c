/* Host rewrite: pPe/sC UTF-16 [7111,7501)/[12501,15618), chunk-f606a53w.js SHA-256
 * dd0a1dc61be769e7ea2ec7f4345b3b4f88996150d4d219b8ada90f03e89dd033.
 * US/Xr, bf3z2ftn SHA-256 1c4ed6b761e5ced6000d4a7c4c43b970eb1d35c37015a35c3ac825b5739478b3,
 * UTF-16 [15698,15966)/[15966,20119), pins and rechecks the target before writing.
 * argv: relative target, expected byte count, optional expected frame and mode;
 * fd 3: opened directory;
 * fd 4: status stream; stdin: file bytes. Temp files are created at mode 0600.
 * Missing final status, or a last status of publishing, means unknown effect. */
#define _GNU_SOURCE 1
#define _POSIX_C_SOURCE 200809L
#define _DARWIN_C_SOURCE 1
#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <errno.h>
#include <dirent.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <inttypes.h>
#include <stdarg.h>
#if defined(__APPLE__)
#include <sys/stdio.h>
#include <sys/xattr.h>
#include <CommonCrypto/CommonDigest.h>
#elif defined(__linux__)
#include <sys/syscall.h>
#include <linux/fs.h>
#endif

static volatile sig_atomic_t cancelled;
static int receipt_fd = -1, receipt_failed;
static off_t receipt_bytes;
static int report(const char *format, ...);
#ifdef DIRECTORY_WRITE_TEST
static int test_point(const char *point) {
  const char *selected = getenv("DIRECTORY_WRITE_TEST_POINT");
  int matched = 0;
  for (const char *part = selected; part && *part;) {
    const char *end = strchr(part, ',');
    size_t length = end ? (size_t)(end - part) : strlen(part);
    if (strlen(point) == length && !strncmp(part, point, length)) { matched = 1; break; }
    part = end ? end + 1 : NULL;
  }
  if (!matched) return 0;
  if (getenv("DIRECTORY_WRITE_TEST_SELF_KILL")) { raise(SIGKILL); _exit(137); }
  if (getenv("DIRECTORY_WRITE_TEST_FAIL")) { errno = EIO; return -1; }
  char ch;
  if (getenv("DIRECTORY_WRITE_TEST_CONTROL_STATUS") && dprintf(5, "test %s %ld\n", point, (long)getpid()) < 0) return -1;
  if (report("test %s\n", point) < 0 || read(5, &ch, 1) != 1 || ch != 'c') { errno = EIO; return -1; }
  return 0;
}
#else
static int test_point(const char *point) { (void)point; return 0; }
#endif
static void on_signal(int sig) { (void)sig; cancelled = 1; }
static int write_all(int fd, const char *p, size_t n) {
  while (n) {
    if (cancelled) { errno = EINTR; return -1; }
    size_t amount = n;
#ifdef DIRECTORY_WRITE_TEST
    if (getenv("DIRECTORY_WRITE_TEST_SHORT") && amount > 7) amount = 7;
#endif
    ssize_t k = write(fd, p, amount);
    if (k < 0 && errno == EINTR) continue;
    if (k <= 0) { if (!k) errno = EIO; return -1; }
    p += k; n -= (size_t)k;
  }
  return 0;
}
/* Host durable-result adaptation of RVr [4740702,4743506), UTF-16,
 * sfn1dbxq 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da.
 * FD 8 is explicitly opted in, owned and identity-bound by the caller before
 * effects. A status prefix is not success; only the final exit marker is final. */
static int receipt_append(const char *text, size_t length) {
  struct stat st;
  if (receipt_failed || length > 24000 || receipt_bytes > 24000 - (off_t)length ||
      fstat(receipt_fd, &st) || !S_ISREG(st.st_mode) || st.st_nlink != 1 ||
      (st.st_mode & 07777) != 0600 || st.st_size != receipt_bytes || lseek(receipt_fd, 0, SEEK_CUR) != receipt_bytes) {
    receipt_failed = 1; return -1;
  }
  size_t amount = length;
#ifdef DIRECTORY_WRITE_TEST
  static size_t error_bytes = 0;
  static int error_started = 0;
  const char *error_cut = getenv("DIRECTORY_WRITE_TEST_ERROR_CUT");
  int cutting_error = error_cut && (!strncmp(text, "error ", 6) || (error_started && !strncmp(text, "exit 1\n", 7)));
  if (cutting_error) {
    char *end; unsigned long limit = strtoul(error_cut, &end, 10);
    if (!*error_cut || *end || !limit || limit > 100 || error_bytes >= limit) { receipt_failed = 1; return -1; }
    error_started = 1;
    if (amount > limit - error_bytes) amount = limit - error_bytes;
  }
  const char *cut = getenv("DIRECTORY_WRITE_TEST_RECEIPT_CUT");
  if (cut && (!strncmp(text, "intent normalize-linked ", 24) || !strncmp(text, "intent replace ", 15) || !strncmp(text, "intent remove ", 14) || !strncmp(text, "mode_applied ", 13))) {
    char *end; unsigned long fields = strtoul(cut, &end, 10);
    const char *staged = strrchr(text, ' ');
    if (!*cut || *end || fields > 12 || !staged || length < 2) { receipt_failed = 1; return -1; }
    const char *cursor = staged + 2;
    while (fields && cursor < text + length - 1) { if (*cursor++ == ':') --fields; }
    amount = (size_t)(cursor - text);
  }
#endif
  if (write_all(receipt_fd, text, amount) || fsync(receipt_fd)) { receipt_failed = 1; return -1; }
  receipt_bytes += (off_t)amount;
#ifdef DIRECTORY_WRITE_TEST
  if (cutting_error) {
    error_bytes += amount;
    if (error_bytes == strtoul(error_cut, NULL, 10)) { raise(SIGKILL); _exit(137); }
  }
  if (amount != length) { test_point("receipt_partial_intent"); receipt_failed = 1; return -1; }
#endif
  return 0;
}
static int report(const char *format, ...) {
  char buffer[2048]; va_list args;
  if (receipt_fd < 0) {
    va_start(args, format); int result = vdprintf(4, format, args); va_end(args);
    return result;
  }
  va_start(args, format); int length = vsnprintf(buffer, sizeof(buffer), format, args); va_end(args);
  if (length < 0 || (size_t)length >= sizeof(buffer)) { errno = EOVERFLOW; receipt_failed = 1; return -1; }
  if (receipt_fd >= 0 && receipt_append(buffer, (size_t)length)) return -1;
  int result = write_all(4, buffer, (size_t)length);
  return receipt_fd >= 0 ? 0 : result;
}
static int status(const char *s) { return receipt_fd < 0 ? write_all(4, s, strlen(s)) : report("%s", s); }
static int parse_unsigned(const char *value, uintmax_t *out) {
  char *end;
  if (!*value) { errno = EINVAL; return -1; }
  for (const char *p = value; *p; p++) if (*p < '0' || *p > '9') { errno = EINVAL; return -1; }
  errno = 0; *out = strtoumax(value, &end, 10);
  if (errno || *end) { errno = EINVAL; return -1; }
  return 0;
}
static int frame(char *buf, size_t size, const struct stat *file, const struct stat *parent) {
  int n;
  if (!S_ISDIR(parent->st_mode) || !parent->st_nlink) { errno = ESTALE; return -1; }
  if (!file) n = snprintf(buf, size, "missing:%ju:%ju", (uintmax_t)parent->st_dev, (uintmax_t)parent->st_ino);
  else {
#if defined(__APPLE__)
    struct timespec mt = file->st_mtimespec, ct = file->st_ctimespec;
#else
    struct timespec mt = file->st_mtim, ct = file->st_ctim;
#endif
    n = snprintf(buf, size, "v2:%ju:%ju:%jd:%jd:%ld:%jd:%ld:%u:%ju:%ju:%ju",
      (uintmax_t)file->st_dev, (uintmax_t)file->st_ino, (intmax_t)file->st_size,
      (intmax_t)mt.tv_sec, mt.tv_nsec, (intmax_t)ct.tv_sec, ct.tv_nsec,
      (unsigned)(file->st_mode & 07777), (uintmax_t)file->st_nlink,
      (uintmax_t)parent->st_dev, (uintmax_t)parent->st_ino);
  }
  if (n < 0 || (size_t)n >= size) { errno = EOVERFLOW; return -1; }
  return 0;
}
static int observe(int dir, const char *part, char *buf, size_t size, struct stat *file) {
  struct stat parent;
  if (fstat(dir, &parent)) return -1;
  if (fstatat(dir, part, file, AT_SYMLINK_NOFOLLOW) == 0) {
    if (!S_ISREG(file->st_mode)) { errno = EINVAL; return -1; }
    return frame(buf, size, file, &parent) ? -1 : 1;
  }
  if (errno != ENOENT) return -1;
  return frame(buf, size, NULL, &parent) ? -1 : 0;
}
/* Host crash provenance for RVr/sC, ranges and digests above: persist exact
 * object identities before the first target effect, independently of fd 4. */
static int receipt_intent(const char *kind, const char *original, int object, int parent) {
  if (receipt_fd < 0) return 0;
  struct stat file, directory;
  char observed[512], line[1200];
  if (fstat(parent, &directory) || (object >= 0 && fstat(object, &file)) ||
      frame(observed, sizeof(observed), object >= 0 ? &file : NULL, &directory)) return -1;
  int length = snprintf(line, sizeof(line), "intent %s %s %s\n", kind, original, observed);
  if (length < 0 || (size_t)length >= sizeof(line)) { errno = EOVERFLOW; return -1; }
  return receipt_append(line, (size_t)length);
}
static int same_parent(int root, const char *target, int held) {
  int current = -1, next = -1, result = -1;
  char *copy = strdup(target), *part = copy, *slash;
  struct stat named, opened;
  if (!copy) goto done;
  current = dup(root); if (current < 0) goto done;
  while ((slash = strchr(part, '/')) != NULL) {
    *slash = '\0';
    if (!*part || !strcmp(part, ".") || !strcmp(part, "..")) { errno = EINVAL; goto done; }
    next = openat(current, part, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    if (next < 0) goto done;
    close(current); current = next; next = -1; part = slash + 1;
  }
  if (fstat(current, &named) || fstat(held, &opened)) goto done;
  if (!S_ISDIR(named.st_mode) || !S_ISDIR(opened.st_mode) || !named.st_nlink || !opened.st_nlink ||
      named.st_dev != opened.st_dev || named.st_ino != opened.st_ino) { errno = ESTALE; goto done; }
  result = 0;
done:
  { int saved = errno;
    if (next >= 0) close(next);
    if (current >= 0) close(current);
    free(copy); errno = saved;
  }
  return result;
}
static int valid_uuid(const char *id) {
  if (strlen(id) != 36) return 0;
  for (size_t i = 0; i < 36; i++) {
    if (i == 8 || i == 13 || i == 18 || i == 23) { if (id[i] != '-') return 0; }
    else if (!((id[i] >= '0' && id[i] <= '9') || (id[i] >= 'a' && id[i] <= 'f') || (id[i] >= 'A' && id[i] <= 'F'))) return 0;
  }
  return 1;
}
static int rename_exclusive(int from, const char *oldname, int to, const char *newname) {
#if defined(__APPLE__)
  return renameatx_np(from, oldname, to, newname, RENAME_EXCL);
#elif defined(__linux__) && defined(SYS_renameat2) && defined(RENAME_NOREPLACE)
  return (int)syscall(SYS_renameat2, from, oldname, to, newname, RENAME_NOREPLACE);
#else
  (void)from; (void)oldname; (void)to; (void)newname; errno = ENOTSUP; return -1;
#endif
}
static int same_file(const struct stat *a, const struct stat *b, int ctime_required) {
#if defined(__APPLE__)
  struct timespec am = a->st_mtimespec, bm = b->st_mtimespec, ac = a->st_ctimespec, bc = b->st_ctimespec;
#else
  struct timespec am = a->st_mtim, bm = b->st_mtim, ac = a->st_ctim, bc = b->st_ctim;
#endif
  return S_ISREG(a->st_mode) && S_ISREG(b->st_mode) && a->st_dev == b->st_dev && a->st_ino == b->st_ino &&
    a->st_size == b->st_size && a->st_mode == b->st_mode && a->st_nlink == b->st_nlink &&
    am.tv_sec == bm.tv_sec && am.tv_nsec == bm.tv_nsec && (!ctime_required || (ac.tv_sec == bc.tv_sec && ac.tv_nsec == bc.tv_nsec));
}
/* sC, f606a53w [12501,15618), UTF-16. Its final rename and failure
 * cleanup address a staging name. In a granted directory recheck that
 * name against the still-open descriptor before using it. */
static int check_stage_name(int dir, const char *name, int stage, struct stat *opened) {
  struct stat named;
  if (fstat(stage, opened) || fstatat(dir, name, &named, AT_SYMLINK_NOFOLLOW)) return -1;
  if (opened->st_nlink != 1 || !same_file(opened, &named, 1)) { errno = ESTALE; return -1; }
  return 0;
}
static int compare_input(int fd, const struct stat *initial) {
  char expected[65536], actual[65536], extra;
  off_t offset = 0;
  while (offset < initial->st_size) {
    size_t count = (uintmax_t)(initial->st_size - offset) < sizeof(expected) ? (size_t)(initial->st_size - offset) : sizeof(expected);
    size_t got = 0;
    while (got < count) {
      ssize_t n = read(0, expected + got, count - got);
      if (n < 0 && errno == EINTR) continue;
      if (n <= 0) { errno = EIO; return -1; }
      got += (size_t)n;
    }
    got = 0;
    while (got < count) {
      ssize_t n = pread(fd, actual + got, count - got, offset + (off_t)got);
      if (n < 0 && errno == EINTR) continue;
      if (n <= 0) { errno = EIO; return -1; }
      got += (size_t)n;
    }
    if (memcmp(expected, actual, count)) { errno = ESTALE; return -1; }
    offset += (off_t)count;
  }
  ssize_t n;
  do { n = read(0, &extra, 1); } while (n < 0 && errno == EINTR);
  if (n != 0) { errno = EIO; return -1; }
  struct stat after;
  if (fstat(fd, &after) || !same_file(initial, &after, 1)) { errno = ESTALE; return -1; }
  return 0;
}
/* Host FD rewrite: kVr/EVr, sfn1dbxq [4735645,4737243)/[4739632,4740702),
 * UTF-16. Retain the captured inode for later owner-bound reconciliation. */
static int remove_file(const char *target, const char *expected, const char *id) {
  int dir = -1, next = -1, qfd = -1, pinned = -1, created = 0, attempted = 0, ok = 0;
  char *copy = NULL, *part, *slash, original[512], current[512], quarantine[80];
  struct stat st, initial, pinned_stat, captured, after, qopened, qnamed;
  if (status("start\n")) goto done;
  if (!target[0] || target[0] == '/' || !expected[0] || !valid_uuid(id)) { errno = EINVAL; goto done; }
  if (snprintf(quarantine, sizeof(quarantine), ".litcode-remove-%s", id) >= (int)sizeof(quarantine)) { errno = EINVAL; goto done; }
  copy = strdup(target);
  if (!copy || fstat(3, &st)) goto done;
  if (!S_ISDIR(st.st_mode)) { errno = ENOTDIR; goto done; }
  dir = dup(3); if (dir < 0) goto done;
  part = copy;
  for (;;) {
    slash = strchr(part, '/'); if (slash) *slash = '\0';
    if (!*part || !strcmp(part, ".") || !strcmp(part, "..")) { errno = EINVAL; goto done; }
    if (!slash) break;
    next = openat(dir, part, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    if (next < 0) goto done;
    close(dir); dir = next; next = -1; part = slash + 1;
  }
  int present = observe(dir, part, original, sizeof(original), &st);
  if (present < 0) goto done;
  if (!present) { errno = ENOENT; goto done; }
  if (st.st_nlink != 1) { errno = EMLINK; goto done; }
  if (strcmp(original, expected)) { errno = ESTALE; goto done; }
  if (status("checking\n") || cancelled || test_point("remove_before_recheck")) goto done;
  if (same_parent(3, target, dir)) goto done;
  present = observe(dir, part, current, sizeof(current), &st);
  if (present < 0) goto done;
  if (!present || st.st_nlink != 1 || strcmp(current, original)) { errno = ESTALE; goto done; }
  initial = st;
  pinned = openat(dir, part, O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC);
  if (pinned < 0 || fstat(pinned, &pinned_stat) || !same_file(&initial, &pinned_stat, 1)) { errno = ESTALE; goto done; }
  if (mkdirat(dir, quarantine, 0700)) goto done;
  created = 1;
  qfd = openat(dir, quarantine, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (qfd < 0 || fstat(qfd, &qopened) || !S_ISDIR(qopened.st_mode) || (qopened.st_mode & 0777) != 0700 || fsync(dir)) goto done;
  if (test_point("remove_quarantine") || receipt_intent("remove", original, -1, qfd) || test_point("remove_after_recheck") || status("committing\n")) goto done;
  attempted = 1;
  if (rename_exclusive(dir, part, qfd, "held")) goto done;
  if (fsync(qfd) || fsync(dir) || status("captured\n") || test_point("remove_after_capture")) goto done;
  if (fstatat(qfd, "held", &captured, AT_SYMLINK_NOFOLLOW) || fstat(pinned, &pinned_stat) ||
      !same_file(&initial, &captured, 0) || !same_file(&captured, &pinned_stat, 1) || captured.st_nlink != 1 ||
      compare_input(pinned, &captured) || same_parent(3, target, dir)) goto done;
  if (fstatat(dir, part, &after, AT_SYMLINK_NOFOLLOW) == 0 || errno != ENOENT) { errno = EEXIST; goto done; }
  if (fstatat(qfd, "held", &after, AT_SYMLINK_NOFOLLOW) || !same_file(&captured, &after, 1)) goto done;
  if (test_point("remove_after_verify")) goto done;
  if (fsync(qfd) || fsync(dir) || same_parent(3, target, dir)) goto done;
  if (fstatat(dir, part, &after, AT_SYMLINK_NOFOLLOW) == 0 || errno != ENOENT) { errno = EEXIST; goto done; }
  if (fstatat(dir, quarantine, &qnamed, AT_SYMLINK_NOFOLLOW) || !S_ISDIR(qnamed.st_mode) ||
      qnamed.st_dev != qopened.st_dev || qnamed.st_ino != qopened.st_ino ||
      fstatat(qfd, "held", &after, AT_SYMLINK_NOFOLLOW) || !same_file(&captured, &after, 1) ||
      fstat(pinned, &pinned_stat) || !same_file(&captured, &pinned_stat, 1)) { errno = ESTALE; goto done; }
  if (frame(current, sizeof(current), &after, &qopened) || report("held %s\n", current) < 0 ||
      status("quarantined\n") || test_point("remove_after_quarantine")) goto done;
  if (same_parent(3, target, dir)) goto done;
  if (fstatat(dir, part, &after, AT_SYMLINK_NOFOLLOW) == 0 || errno != ENOENT) { errno = EEXIST; goto done; }
  if (fstatat(dir, quarantine, &qnamed, AT_SYMLINK_NOFOLLOW) || !S_ISDIR(qnamed.st_mode) ||
      qnamed.st_dev != qopened.st_dev || qnamed.st_ino != qopened.st_ino ||
      fstatat(qfd, "held", &after, AT_SYMLINK_NOFOLLOW) || !same_file(&captured, &after, 1) ||
      fstat(pinned, &pinned_stat) || !same_file(&captured, &pinned_stat, 1)) { errno = ESTALE; goto done; }
  ok = 1;
done:
  { int saved = errno;
    if (pinned >= 0) close(pinned);
    if (qfd >= 0) close(qfd);
    if (!ok) report("error %s %d\n", attempted || created ? "unknown" : "not_removed", saved);
    if (next >= 0) close(next);
    if (dir >= 0) close(dir);
    free(copy);
  }
  return ok ? 0 : 1;
}

#if defined(__APPLE__)
static int compare_files(int a, int b) {
  struct stat before_a, before_b, after_a, after_b;
  if (fstat(a, &before_a) || fstat(b, &before_b) || !S_ISREG(before_a.st_mode) || !S_ISREG(before_b.st_mode) ||
      before_a.st_size != before_b.st_size || (before_a.st_dev == before_b.st_dev && before_a.st_ino == before_b.st_ino)) {
    errno = ESTALE; return -1;
  }
  char left[65536], right[65536]; off_t offset = 0;
  while (offset < before_a.st_size) {
    size_t count = (uintmax_t)(before_a.st_size - offset) < sizeof(left) ? (size_t)(before_a.st_size - offset) : sizeof(left);
    size_t pos = 0;
    while (pos < count) {
      ssize_t n = pread(a, left + pos, count - pos, offset + (off_t)pos);
      if (n < 0 && errno == EINTR) continue;
      if (n <= 0) { errno = EIO; return -1; }
      pos += (size_t)n;
    }
    pos = 0;
    while (pos < count) {
      ssize_t n = pread(b, right + pos, count - pos, offset + (off_t)pos);
      if (n < 0 && errno == EINTR) continue;
      if (n <= 0) { errno = EIO; return -1; }
      pos += (size_t)n;
    }
    if (memcmp(left, right, count)) { errno = ESTALE; return -1; }
    offset += (off_t)count;
  }
  if (fstat(a, &after_a) || fstat(b, &after_b) || !same_file(&before_a, &after_a, 1) || !same_file(&before_b, &after_b, 1)) {
    errno = ESTALE; return -1;
  }
  return 0;
}
static int file_digest(int fd, unsigned char actual[CC_SHA256_DIGEST_LENGTH]) {
  struct stat before, after;
  if (fstat(fd, &before) || !S_ISREG(before.st_mode)) return -1;
  CC_SHA256_CTX hash; CC_SHA256_Init(&hash);
  char bytes[65536]; off_t offset = 0;
  while (offset < before.st_size) {
    size_t count = (uintmax_t)(before.st_size - offset) < sizeof(bytes) ? (size_t)(before.st_size - offset) : sizeof(bytes);
    ssize_t n = pread(fd, bytes, count, offset);
    if (n < 0 && errno == EINTR) continue;
    if (n <= 0) { errno = EIO; return -1; }
    CC_SHA256_Update(&hash, bytes, (CC_LONG)n); offset += n;
  }
  CC_SHA256_Final(actual, &hash);
  if (fstat(fd, &after) || !same_file(&before, &after, 1)) { errno = ESTALE; return -1; }
  return 0;
}
static int digest_matches(int fd, const unsigned char *expected) {
  unsigned char actual[CC_SHA256_DIGEST_LENGTH];
  if (file_digest(fd, actual) || memcmp(actual, expected, sizeof(actual))) { errno = ESTALE; return -1; }
  return 0;
}
static int named_directory(int parent, const char *name, const struct stat *opened) {
  struct stat named;
  if (fstatat(parent, name, &named, AT_SYMLINK_NOFOLLOW) || !S_ISDIR(named.st_mode) || !named.st_nlink ||
      named.st_dev != opened->st_dev || named.st_ino != opened->st_ino || (named.st_mode & 0777) != 0700) { errno = ESTALE; return -1; }
  return 0;
}

/* Host rewrite: RVr, sfn1dbxq [4740702,4743506), UTF-16. This checks a retained
 * descriptor and its name at observation time; a later effect must check again. */
static int linked_alias_matches(int dir, const char *alias, const struct stat *expected);
static int valid_linked_alias(const char *alias);
/* Read a fresh directory stream each time, including on retry. */
static int only_held(int fd) {
  int scan = openat(fd, ".", O_RDONLY | O_DIRECTORY | O_CLOEXEC);
  if (scan < 0) return -1;
  DIR *stream = fdopendir(scan);
  if (!stream) { int saved = errno; close(scan); errno = saved; return -1; }
  int held = 0;
  struct dirent *entry;
  for (;;) {
    errno = 0;
    entry = readdir(stream);
    if (!entry) break;
    if (!strcmp(entry->d_name, ".") || !strcmp(entry->d_name, "..")) continue;
    if (strcmp(entry->d_name, "held") || held) { errno = ESTALE; break; }
    held = 1;
  }
  int saved = errno;
  if (closedir(stream)) return -1;
  if (saved || !held) { errno = saved ? saved : ESTALE; return -1; }
  return 0;
}
/* RVr [4740702,4743506) and sC [12501,15618), half-open UTF-16. The
 * independent session gate survives both archive-directory replacement and
 * child death. Each phase is an atomic create-only, descriptor-bound record. */
static int archive_mark(const char *id, const char *phase, const char *value, int create) {
  char name[128], saved[1024];
  snprintf(name, sizeof(name), "org.litcode.archive.%s.%s", phase, id);
  ssize_t n = fgetxattr(6, name, saved, sizeof(saved), 0, 0);
  if (n < 0 && errno == ENOATTR && !create) return 0;
  if (n < 0 && errno == ENOATTR && create) {
    if (fsetxattr(6, name, value, strlen(value), 0, XATTR_CREATE) && errno != EEXIST) return -1;
    n = fgetxattr(6, name, saved, sizeof(saved), 0, 0);
  }
  if (n < 0 || !value || (size_t)n != strlen(value) || memcmp(saved, value, (size_t)n)) { errno = ESTALE; return -1; }
  return 1;
}
static int observe_retained(const char *target, const char *expected, const char *id, const char *alias, const char *expected_parent, int archive, int move, int removal) {
  int dir = -1, next = -1, qfd = -1, heldfd = -1, ok = 0;
  char *copy = NULL, *part, *slash, quarantine[80], current[512];
  struct stat st, qopened, initial, pinned, after;
  if (status("start\n")) goto done;
  if (!target[0] || target[0] == '/' || !expected[0] || !valid_uuid(id)) { errno = EINVAL; goto done; }
  if (alias && (!valid_linked_alias(alias) || !expected_parent)) { errno = EINVAL; goto done; }
  if (snprintf(quarantine, sizeof(quarantine), ".litcode-%s-%s", alias ? "linked" : removal ? "remove" : "replace", id) >= (int)sizeof(quarantine)) { errno = EINVAL; goto done; }
  copy = strdup(target);
  if (!copy || fstat(3, &st) || !S_ISDIR(st.st_mode) || !st.st_nlink) { errno = ENOTDIR; goto done; }
  dir = dup(3); if (dir < 0) goto done;
  part = copy;
  for (;;) {
    slash = strchr(part, '/'); if (slash) *slash = '\0';
    if (!*part || !strcmp(part, ".") || !strcmp(part, "..")) { errno = EINVAL; goto done; }
    if (!slash) break;
    next = openat(dir, part, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    if (next < 0) goto done;
    close(dir); dir = next; next = -1; part = slash + 1;
  }
  if (expected_parent && (fstat(dir, &st) || frame(current, sizeof(current), NULL, &st) || strcmp(current, expected_parent))) { errno = ESTALE; goto done; }
  int holder = dir;
  char binding[1024];
  int intent = 0, captured = 0;
  if (archive == -2 && (archive_mark(id, "intent", NULL, 0) || archive_mark(id, "captured", NULL, 0))) goto done;
  if (archive >= 0) {
    struct stat store, gate, root;
    if (fstat(6, &gate) || !S_ISREG(gate.st_mode) || gate.st_nlink != 1 ||
        (gate.st_mode & 07777) != 0600 || gate.st_uid != geteuid() || fstat(3, &root)) goto done;
    if (fstat(archive, &store) || !S_ISDIR(store.st_mode) || !store.st_nlink || store.st_uid != geteuid() ||
        (store.st_mode & 07777) != 0700 || (move && store.st_dev != st.st_dev) ||
        (store.st_dev == st.st_dev && store.st_ino == st.st_ino)) { errno = ESTALE; goto done; }
    unsigned char digest[CC_SHA256_DIGEST_LENGTH]; char hex[2 * CC_SHA256_DIGEST_LENGTH + 1];
    if (file_digest(7, digest)) goto done;
    for (size_t i = 0; i < sizeof(digest); i++) snprintf(hex + 2*i, 3, "%02x", digest[i]);
    int n = snprintf(binding, sizeof(binding), "v1 %s %ju:%ju %ju:%ju %s %s %s", quarantine,
      (uintmax_t)root.st_dev, (uintmax_t)root.st_ino, (uintmax_t)store.st_dev, (uintmax_t)store.st_ino,
      expected_parent, expected, hex);
    if (n < 0 || (size_t)n >= sizeof(binding)) goto done;
    intent = archive_mark(id, "intent", binding, 0);
    captured = archive_mark(id, "captured", binding, 0);
    if (intent < 0 || captured < 0 || (captured && !intent)) goto done;
  }
  qfd = openat(dir, quarantine, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (captured && qfd >= 0) { errno = ESTALE; goto done; }
  if (archive >= 0 && qfd < 0 && errno == ENOENT) {
    holder = archive;
    qfd = openat(archive, quarantine, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  }
  if (qfd < 0 || fstat(qfd, &qopened) || !S_ISDIR(qopened.st_mode) || !qopened.st_nlink ||
      (qopened.st_mode & 0777) != 0700 || named_directory(holder, quarantine, &qopened) ||
      same_parent(3, target, dir) || observe(qfd, "held", current, sizeof(current), &initial) != 1 ||
      initial.st_nlink != (alias ? 2 : 1) || strcmp(current, expected) || linked_alias_matches(dir, alias, &initial)) { errno = ESTALE; goto done; }
  heldfd = openat(qfd, "held", O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC);
  if (heldfd < 0 || fstat(heldfd, &pinned) || !same_file(&initial, &pinned, 1) ||
      compare_files(heldfd, 7) || (alias && (fsync(heldfd) || fsync(qfd) || fsync(dir))) || test_point("observe_retained_after_read") ||
      same_parent(3, target, dir) || named_directory(holder, quarantine, &qopened) ||
      fstat(heldfd, &pinned) || !same_file(&initial, &pinned, 1) ||
      observe(qfd, "held", current, sizeof(current), &after) != 1 ||
      !same_file(&initial, &after, 1) || strcmp(current, expected) || compare_files(heldfd, 7) ||
      same_parent(3, target, dir) || named_directory(holder, quarantine, &qopened) ||
      observe(qfd, "held", current, sizeof(current), &after) != 1 ||
      !same_file(&initial, &after, 1) || strcmp(current, expected) || linked_alias_matches(dir, alias, &initial)) { errno = ESTALE; goto done; }
  if (move || holder != dir) {
    /* sC [12501,15618), UTF-16, adapted to exclusive same-volume capture.
     * Keeping the directory intact preserves the held file's parent frame. */
    if (only_held(qfd) || cancelled) goto done;
    if (move && (archive_mark(id, "intent", binding, 1) != 1 || fsync(6) || test_point("archive_after_intent"))) goto done;
    if (holder == dir) {
      /* EVr/RVr [4739632,4743506), half-open UTF-16: recheck the parent
       * and the named source against its open descriptor after intent sync. */
      if (test_point("archive_before_capture") || cancelled || only_held(qfd) ||
          compare_files(heldfd, 7) || same_parent(3, target, dir) ||
          observe(qfd, "held", current, sizeof(current), &after) != 1 || strcmp(current, expected) ||
          named_directory(dir, quarantine, &qopened)) goto done;
      if (rename_exclusive(dir, quarantine, archive, quarantine) || test_point("archive_after_capture")) goto done;
    }
    if (fsync(qfd) || fsync(archive) || fsync(dir) || only_held(qfd) || same_parent(3, target, dir) ||
        named_directory(archive, quarantine, &qopened) || compare_files(heldfd, 7) ||
        observe(qfd, "held", current, sizeof(current), &after) != 1 || strcmp(current, expected) ||
        fstatat(dir, quarantine, &st, AT_SYMLINK_NOFOLLOW) == 0 || errno != ENOENT ||
        named_directory(archive, quarantine, &qopened) || only_held(qfd)) { errno = ESTALE; goto done; }
    if (move && (archive_mark(id, "captured", binding, 1) != 1 || fsync(6) || test_point("archive_after_receipt"))) goto done;
    if (report(move ? "archived %s\n" : "observed %s\n", current) < 0) goto done;
  } else if (report(alias ? "observed_linked %s\n" : "observed %s\n", current) < 0) goto done;
  ok = 1;
done:
  { int saved = errno;
    if (heldfd >= 0) close(heldfd);
    if (qfd >= 0) close(qfd);
    if (!ok) report("error unknown %d\n", saved);
    if (next >= 0) close(next);
    if (dir >= 0) close(dir);
    free(copy);
  }
  return ok ? 0 : 1;
}

/* Host rewrite: uno/pPe/sC, sfn1dbxq [739599,743280), f606a53w [7111,7501)/[12501,15618), UTF-16.
 * The retained objects require a later owner-bound transaction and revalidation. */
/* Host legacy recovery adaptation of RVr [4740702,4743506), UTF-16,
 * sfn1dbxq SHA 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da.
 * Never remove an alias. Retain the old pair and publish an independent copy. */
static int linked_alias_matches(int dir, const char *alias, const struct stat *expected) {
  struct stat named;
  if (!alias) return 0;
  if (expected->st_nlink != 2 || fstatat(dir, alias, &named, AT_SYMLINK_NOFOLLOW) || !same_file(expected, &named, 1)) {
    errno = ESTALE; return -1;
  }
  return 0;
}
static int valid_linked_alias(const char *alias) {
  const char *prefix = ".litcode-tmp-";
  if (strncmp(alias, prefix, strlen(prefix))) return 0;
  const char *p = alias + strlen(prefix), *start = p;
  while (*p >= '0' && *p <= '9') p++;
  if (p == start || *p++ != '-') return 0;
  start = p;
  while (*p >= '0' && *p <= '9') p++;
  return p != start && !*p;
}
static int replace_retained(const char *target, const char *count, const char *expected, const char *id, const char *restore_mode, const char *alias) {
  int dir = -1, next = -1, qfd = -1, pinned = -1, stage = -1, output = -1, created = 0, attempted = 0, ok = 0;
  char *copy = NULL, *part, *slash, original[512], current[512], held_frame[512], quarantine[80], bytes[65536];
  struct stat st, initial, pin, held, after, qopened, stage_before, staged, output_stat;
  uintmax_t length = 0, received = 0;
  uintmax_t requested_mode = 0;
  unsigned char digest[CC_SHA256_DIGEST_LENGTH];
  CC_SHA256_CTX hash;
  if (status("start\n")) goto done;
  if (!target[0] || target[0] == '/' || !expected[0] || !valid_uuid(id) || parse_unsigned(count, &length)) { errno = EINVAL; goto done; }
  if (alias && (!valid_linked_alias(alias) || restore_mode)) { errno = EINVAL; goto done; }
  if (restore_mode && (parse_unsigned(restore_mode, &requested_mode) || requested_mode > 07777)) { errno = EINVAL; goto done; }
  if (snprintf(quarantine, sizeof(quarantine), alias ? ".litcode-linked-%s" : ".litcode-replace-%s", id) >= (int)sizeof(quarantine)) { errno = EINVAL; goto done; }
  copy = strdup(target);
  if (!copy || fstat(3, &st) || !S_ISDIR(st.st_mode) || !st.st_nlink) { errno = ENOTDIR; goto done; }
  dir = dup(3); if (dir < 0) goto done;
  part = copy;
  for (;;) {
    slash = strchr(part, '/'); if (slash) *slash = '\0';
    if (!*part || !strcmp(part, ".") || !strcmp(part, "..")) { errno = EINVAL; goto done; }
    if (!slash) break;
    next = openat(dir, part, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    if (next < 0) goto done;
    close(dir); dir = next; next = -1; part = slash + 1;
  }
  int present = observe(dir, part, original, sizeof(original), &initial);
  if (present != 1 || initial.st_nlink != (alias ? 2 : 1) || strcmp(original, expected) ||
      (alias && (!strcmp(part, alias) || initial.st_size < 0 || (uintmax_t)initial.st_size != length)) ||
      linked_alias_matches(dir, alias, &initial)) { errno = ESTALE; goto done; }
  pinned = openat(dir, part, O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC);
  if (pinned < 0 || fstat(pinned, &pin) || !same_file(&initial, &pin, 1) || compare_files(pinned, 7)) { errno = ESTALE; goto done; }
  if (test_point("replace_before_quarantine")) goto done;
  if (mkdirat(dir, quarantine, 0700)) goto done;
  created = 1;
  qfd = openat(dir, quarantine, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (qfd < 0 || fstat(qfd, &qopened) || !S_ISDIR(qopened.st_mode) || (qopened.st_mode & 0777) != 0700 || fsync(dir)) goto done;
  if (test_point("replace_quarantine")) goto done;
  stage = openat(qfd, "staged", O_RDWR | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0600);
  if (stage < 0 || status("staging\n") || test_point("replace_staging")) goto done;
  CC_SHA256_Init(&hash);
  for (;;) {
    if (cancelled) { errno = EINTR; goto done; }
    size_t input_cap = sizeof(bytes);
#ifdef DIRECTORY_WRITE_TEST
    if (getenv("DIRECTORY_WRITE_TEST_SHORT_READ")) input_cap = 1;
#endif
    ssize_t n = read(0, bytes, input_cap);
    if (n < 0 && errno == EINTR) continue;
    if (n < 0) goto done;
    if (!n) break;
    if ((uintmax_t)n > length - received) { errno = EFBIG; goto done; }
    CC_SHA256_Update(&hash, bytes, (CC_LONG)n);
    if (write_all(stage, bytes, (size_t)n)) goto done;
    received += (uintmax_t)n;
    if (test_point("replace_writing")) goto done;
  }
  CC_SHA256_Final(digest, &hash);
  /* RVr, sfn1dbxq 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da,
   * UTF-16 [4740702,4743506): restore backup mode. The host applies it to
   * staged bytes before publication; held keeps the target's original mode. */
  mode_t mode = restore_mode ? (mode_t)requested_mode : initial.st_mode & 07777;
  if (received != length || fchmod(stage, mode)) { errno = EIO; goto done; }
#ifdef DIRECTORY_WRITE_TEST
  if (getenv("DIRECTORY_WRITE_TEST_FIXED_TIME")) {
    struct timespec fixed[2] = { { 1700000000, 0 }, { 1700000000, 0 } };
    if (futimens(stage, fixed)) goto done;
  }
#endif
  if (fsync(stage) || fstat(stage, &stage_before) ||
      !S_ISREG(stage_before.st_mode) || stage_before.st_nlink != 1 || (stage_before.st_mode & 07777) != mode || stage_before.st_size < 0 || (uintmax_t)stage_before.st_size != length ||
      digest_matches(stage, digest) || (alias && compare_files(stage, 7)) || fsync(qfd) || status("checking\n")) { errno = EIO; goto done; }
  if (test_point("replace_before_intent")) goto done;
  if (same_parent(3, target, dir) || named_directory(dir, quarantine, &qopened) ||
      observe(dir, part, current, sizeof(current), &st) != 1 || strcmp(current, original) ||
      fstat(pinned, &pin) || !same_file(&initial, &pin, 1) || compare_files(pinned, 7) || linked_alias_matches(dir, alias, &initial)) { errno = ESTALE; goto done; }
  if ((alias && report("linked_alias %s\n", alias) < 0) ||
      receipt_intent(alias ? "normalize-linked" : "replace", original, stage, qfd) || test_point("replace_after_recheck") || status("capturing\n")) goto done;
  attempted = 1;
  if (rename_exclusive(dir, part, qfd, "held")) goto done;
  if (fsync(qfd) || fsync(dir) || status("captured\n") || test_point("replace_after_capture")) goto done;
  if (fstatat(qfd, "held", &held, AT_SYMLINK_NOFOLLOW) || fstat(pinned, &pin) ||
      !same_file(&initial, &held, 0) || !same_file(&held, &pin, 1) || compare_files(pinned, 7) || linked_alias_matches(dir, alias, &held) ||
      same_parent(3, target, dir) || named_directory(dir, quarantine, &qopened)) { errno = ESTALE; goto done; }
  if (fstatat(dir, part, &after, AT_SYMLINK_NOFOLLOW) == 0 || errno != ENOENT) { errno = EEXIST; goto done; }
  if (fstatat(qfd, "staged", &staged, AT_SYMLINK_NOFOLLOW) || !same_file(&stage_before, &staged, 1) ||
      fstatat(qfd, "held", &after, AT_SYMLINK_NOFOLLOW) || !same_file(&held, &after, 1) ||
      status("publishing\n") || test_point("replace_before_stage_check")) { errno = ESTALE; goto done; }
  if (fstat(stage, &staged) || !same_file(&stage_before, &staged, 1) || digest_matches(stage, digest) ||
      fstatat(qfd, "staged", &after, AT_SYMLINK_NOFOLLOW) || !same_file(&staged, &after, 1) ||
      test_point("replace_after_stage_check")) { errno = ESTALE; goto done; }
  if (rename_exclusive(qfd, "staged", dir, part)) goto done;
  if (status("renamed\n") || test_point("replace_after_publish")) goto done;
  /* RVr keeps an already-open descriptor across chmod. Retain the staged FD
   * across publication so mode 0000 needs no new read permission. The named
   * no-follow observations below bind the published path to this same inode. */
  output = fcntl(stage, F_DUPFD_CLOEXEC, 0);
  if (output < 0 || fstat(stage, &staged) || !same_file(&stage_before, &staged, 0) || digest_matches(stage, digest) ||
      fstat(output, &output_stat) || !same_file(&staged, &output_stat, 1) || digest_matches(output, digest) ||
      fstatat(dir, part, &after, AT_SYMLINK_NOFOLLOW) || !same_file(&output_stat, &after, 1) ||
      fstatat(qfd, "held", &after, AT_SYMLINK_NOFOLLOW) || !same_file(&held, &after, 1) || compare_files(pinned, 7) || linked_alias_matches(dir, alias, &held) ||
      same_parent(3, target, dir) || named_directory(dir, quarantine, &qopened) || fsync(output) || fsync(qfd) || fsync(dir) ||
      test_point("replace_before_final")) { errno = ESTALE; goto done; }
  if (fstat(stage, &staged) || !same_file(&output_stat, &staged, 1) || fstat(output, &pin) || !same_file(&staged, &pin, 1) ||
      fstatat(dir, part, &after, AT_SYMLINK_NOFOLLOW) || !same_file(&pin, &after, 1) ||
      fstatat(qfd, "held", &after, AT_SYMLINK_NOFOLLOW) || !same_file(&held, &after, 1) || linked_alias_matches(dir, alias, &held) ||
      same_parent(3, target, dir) || named_directory(dir, quarantine, &qopened) || fstat(qfd, &st) ||
      frame(held_frame, sizeof(held_frame), &held, &st) || fstat(dir, &st) || frame(current, sizeof(current), &pin, &st)) { errno = ESTALE; goto done; }
  if (report("held %s\nlanded %s\n", held_frame, current) < 0 || status("durable\n")) goto done;
  ok = 1;
done:
  { int saved = errno;
    if (output >= 0) close(output);
    if (stage >= 0) close(stage);
    if (pinned >= 0) close(pinned);
    if (qfd >= 0) close(qfd);
    if (!ok) report("error %s %d\n", created || attempted ? "unknown" : "not_published", saved);
    if (next >= 0) close(next);
    if (dir >= 0) close(dir);
    free(copy);
  }
  return ok ? 0 : 1;
}
/* RVr, sfn1dbxq 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
 * UTF-16 [4740702,4743506); sC, f606a53w
 * dd0a1dc61be769e7ea2ec7f4345b3b4f88996150d4d219b8ada90f03e89dd033
 * UTF-16 [12501,15618). Adapt retained staging and captured publication:
 * preparation cannot reach rename; publication requires a separately saved frame.
 * FD 7 supplies independent desired bytes. Neither phase deletes evidence. */
static int create_retained(const char *target, const char *missing, const char *id,
    const char *expected_stage, const char *count, const char *requested_mode) {
  int dir = -1, next = -1, qfd = -1, stage = -1, created = 0, attempted = 0, mode_effect = 0, ok = 0;
  int preparing = expected_stage == NULL;
  char *copy = NULL, *part, *slash, quarantine[80], current[512], staged_frame[512], buffer[65536];
  struct stat st, parent, qopened, staged, opened, after;
  uintmax_t length = 0, received = 0, mode = 0;
  if (status("start\n")) goto done;
  if (!target[0] || target[0] == '/' || !missing[0] || !valid_uuid(id) ||
      parse_unsigned(requested_mode, &mode) || mode > 07777 || (preparing && parse_unsigned(count, &length))) { errno = EINVAL; goto done; }
  if (snprintf(quarantine, sizeof(quarantine), ".litcode-create-%s", id) >= (int)sizeof(quarantine)) { errno = EINVAL; goto done; }
  copy = strdup(target);
  if (!copy || fstat(3, &st) || !S_ISDIR(st.st_mode) || !st.st_nlink) { errno = ENOTDIR; goto done; }
  dir = dup(3); if (dir < 0) goto done;
  part = copy;
  for (;;) {
    slash = strchr(part, '/'); if (slash) *slash = '\0';
    if (!*part || !strcmp(part, ".") || !strcmp(part, "..")) { errno = EINVAL; goto done; }
    if (!slash) break;
    next = openat(dir, part, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    if (next < 0) goto done;
    close(dir); dir = next; next = -1; part = slash + 1;
  }
  if (observe(dir, part, current, sizeof(current), &st) != 0 || strcmp(current, missing)) { errno = ESTALE; goto done; }
  if (preparing) {
    if (test_point("create_before_quarantine") || mkdirat(dir, quarantine, 0700)) goto done;
    created = 1;
  }
  qfd = openat(dir, quarantine, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (qfd < 0 || fstat(qfd, &qopened) || named_directory(dir, quarantine, &qopened) || fsync(dir)) goto done;
  if (preparing) {
    if (test_point("create_quarantine")) goto done;
    stage = openat(qfd, "staged", O_RDWR | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0600);
    if (stage < 0 || status("staging\n") || test_point("create_staging")) goto done;
    for (;;) {
      if (cancelled) { errno = EINTR; goto done; }
      size_t capacity = sizeof(buffer);
#ifdef DIRECTORY_WRITE_TEST
      if (getenv("DIRECTORY_WRITE_TEST_SHORT_READ")) capacity = 1;
#endif
      ssize_t n = read(0, buffer, capacity);
      if (n < 0 && errno == EINTR) continue;
      if (n < 0) goto done;
      if (!n) break;
      if ((uintmax_t)n > length - received) { errno = EFBIG; goto done; }
      if (write_all(stage, buffer, (size_t)n)) goto done;
      received += (uintmax_t)n;
      if (test_point("create_writing")) goto done;
    }
    if (received != length || fchmod(stage, 0600) || fsync(stage) || fstat(stage, &staged) ||
        !S_ISREG(staged.st_mode) || staged.st_nlink != 1 || staged.st_size < 0 || (uintmax_t)staged.st_size != length ||
        (staged.st_mode & 07777) != 0600 || compare_files(stage, 7)) { errno = ESTALE; goto done; }
  } else {
    if (observe(qfd, "staged", current, sizeof(current), &staged) != 1 || staged.st_nlink != 1 || (staged.st_mode & 07777) != 0600 || strcmp(current, expected_stage)) { errno = ESTALE; goto done; }
    stage = openat(qfd, "staged", O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC);
    if (stage < 0 || fstat(stage, &opened) || !same_file(&staged, &opened, 1) || compare_files(stage, 7) || fsync(stage)) goto done;
  }
  if (fsync(qfd) || fsync(dir) || status("checking\n") || test_point(preparing ? "create_before_prepared" : "create_before_publish")) goto done;
  if (cancelled || same_parent(3, target, dir) || named_directory(dir, quarantine, &qopened) ||
      observe(dir, part, current, sizeof(current), &st) != 0 || strcmp(current, missing) ||
      observe(qfd, "staged", current, sizeof(current), &after) != 1 || !same_file(&staged, &after, 1) ||
      fstat(stage, &opened) || !same_file(&staged, &opened, 1) || compare_files(stage, 7) ||
      frame(staged_frame, sizeof(staged_frame), &staged, &qopened)) { errno = ESTALE; goto done; }
  if (report("create_mode %ju\n", mode) < 0 || receipt_intent(preparing ? "prepare-create" : "publish-create", missing, stage, qfd)) goto done;
  if (preparing) {
    if (report("prepared_create %s %s\n", missing, staged_frame) < 0 || status("prepared\n") || test_point("create_after_prepared")) goto done;
    ok = 1; goto done;
  }
  /* sC UTF-16 [12501,15618): apply target mode through the already verified
   * open descriptor, before rename. Private staging remains reopenable until
   * this separately receipted publication phase, including target mode 0000. */
  if (status("mode_changing\n") || test_point("create_before_mode")) goto done;
  mode_effect = 1;
  if (fchmod(stage, (mode_t)mode) || fsync(stage) || test_point("create_after_mode") || fstat(stage, &opened)) goto done;
  struct stat configured = staged;
  configured.st_mode = (configured.st_mode & ~07777) | (mode_t)mode;
  if (!same_file(&configured, &opened, 0) || observe(qfd, "staged", current, sizeof(current), &after) != 1 || !same_file(&opened, &after, 1) ||
      same_parent(3, target, dir) || named_directory(dir, quarantine, &qopened) ||
      observe(dir, part, current, sizeof(current), &st) != 0 || strcmp(current, missing) || compare_files(stage, 7) ||
      frame(current, sizeof(current), &opened, &qopened) || report("mode_applied %s\n", current) < 0) { errno = ESTALE; goto done; }
  staged = opened;
  if (status("publishing\n") || test_point("create_after_recheck")) goto done;
  attempted = 1;
  if (rename_exclusive(qfd, "staged", dir, part)) goto done;
  if (status("renamed\n") || test_point("create_after_publish")) goto done;
  if (fstat(stage, &opened) || !same_file(&staged, &opened, 0) || compare_files(stage, 7) ||
      fstatat(dir, part, &after, AT_SYMLINK_NOFOLLOW) || !same_file(&opened, &after, 1) ||
      same_parent(3, target, dir) || named_directory(dir, quarantine, &qopened) ||
      fsync(stage) || fsync(qfd) || fsync(dir) || test_point("create_before_final")) { errno = ESTALE; goto done; }
  if (fstatat(qfd, "staged", &after, AT_SYMLINK_NOFOLLOW) == 0 || errno != ENOENT) { errno = EEXIST; goto done; }
  if (fstat(stage, &after) || !same_file(&opened, &after, 1) ||
      fstatat(dir, part, &after, AT_SYMLINK_NOFOLLOW) || !same_file(&opened, &after, 1) || compare_files(stage, 7) ||
      same_parent(3, target, dir) || named_directory(dir, quarantine, &qopened) || fstat(dir, &parent) ||
      frame(current, sizeof(current), &opened, &parent) || report("landed %s\n", current) < 0 || status("durable\n")) goto done;
  ok = 1;
done:
  { int saved = errno;
    if (stage >= 0) close(stage);
    if (qfd >= 0) close(qfd);
    if (!ok) report("error %s %d\n", preparing ? (created ? "preparation_incomplete" : "not_prepared") : (attempted || mode_effect ? "unknown" : "not_published"), saved);
    if (next >= 0) close(next);
    if (dir >= 0) close(dir);
    free(copy);
  }
  return ok ? 0 : 1;
}

/* Captured-state continuation of the verified publication tail above.
 * RVr, sfn1dbxq 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
 * UTF-16 [4740702,4743506); sC, f606a53w
 * dd0a1dc61be769e7ea2ec7f4345b3b4f88996150d4d219b8ada90f03e89dd033
 * UTF-16 [12501,15618). Host crash continuation preserves both retained
 * objects; fd 7/9 supply independent original/desired bytes, fd 6 the lease. */
static int publish_captured(const char *target, const char *missing, const char *expected_held, const char *expected_stage, const char *id, const char *alias) {
  int dir = -1, next = -1, qfd = -1, heldfd = -1, stage = -1, attempted = 0, ok = 0;
  char *copy = NULL, *part, *slash, quarantine[80], current[512], held_frame[512];
  struct stat st, parent, qopened, held, staged, opened, after;
  if (status("start\n")) goto done;
  if (!target[0] || target[0] == '/' || !missing[0] || !expected_held[0] || !expected_stage[0] || !valid_uuid(id)) { errno = EINVAL; goto done; }
  if (alias && !valid_linked_alias(alias)) { errno = EINVAL; goto done; }
  if (snprintf(quarantine, sizeof(quarantine), alias ? ".litcode-linked-%s" : ".litcode-replace-%s", id) >= (int)sizeof(quarantine)) { errno = EINVAL; goto done; }
  copy = strdup(target);
  if (!copy || fstat(3, &st) || !S_ISDIR(st.st_mode) || !st.st_nlink) { errno = ENOTDIR; goto done; }
  dir = dup(3); if (dir < 0) goto done;
  part = copy;
  for (;;) {
    slash = strchr(part, '/'); if (slash) *slash = '\0';
    if (!*part || !strcmp(part, ".") || !strcmp(part, "..")) { errno = EINVAL; goto done; }
    if (!slash) break;
    next = openat(dir, part, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    if (next < 0) goto done;
    close(dir); dir = next; next = -1; part = slash + 1;
  }
  if (observe(dir, part, current, sizeof(current), &st) != 0 || strcmp(current, missing)) { errno = ESTALE; goto done; }
  qfd = openat(dir, quarantine, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (qfd < 0 || fstat(qfd, &qopened) || named_directory(dir, quarantine, &qopened) ||
      observe(qfd, "held", current, sizeof(current), &held) != 1 || held.st_nlink != (alias ? 2 : 1) || strcmp(current, expected_held) ||
      observe(qfd, "staged", current, sizeof(current), &staged) != 1 || staged.st_nlink != 1 || strcmp(current, expected_stage) ||
      (held.st_dev == staged.st_dev && held.st_ino == staged.st_ino) || linked_alias_matches(dir, alias, &held) ||
      (alias && (held.st_mode & 07777) != (staged.st_mode & 07777))) { errno = ESTALE; goto done; }
  heldfd = openat(qfd, "held", O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC);
  stage = openat(qfd, "staged", O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC);
  if (heldfd < 0 || stage < 0 || fstat(heldfd, &opened) || !same_file(&held, &opened, 1) ||
      fstat(stage, &opened) || !same_file(&staged, &opened, 1) || compare_files(heldfd, 7) || compare_files(stage, 9) ||
      (alias && compare_files(stage, 7)) || fsync(heldfd) || fsync(stage) || fsync(qfd) || fsync(dir) || status("checking\n")) goto done;
  if ((alias ? report("resume_linked %s %s %s %s\n", alias, missing, expected_held, expected_stage) :
      report("resume %s %s %s\n", missing, expected_held, expected_stage)) < 0 || status("publishing\n") ||
      test_point("captured_before_publish")) goto done;
  if (cancelled || same_parent(3, target, dir) || named_directory(dir, quarantine, &qopened) ||
      observe(dir, part, current, sizeof(current), &st) != 0 || strcmp(current, missing) ||
      observe(qfd, "held", current, sizeof(current), &after) != 1 || !same_file(&held, &after, 1) ||
      observe(qfd, "staged", current, sizeof(current), &after) != 1 || !same_file(&staged, &after, 1) ||
      fstat(heldfd, &opened) || !same_file(&held, &opened, 1) || fstat(stage, &opened) || !same_file(&staged, &opened, 1) ||
      compare_files(heldfd, 7) || compare_files(stage, 9) || linked_alias_matches(dir, alias, &held) ||
      test_point("captured_after_recheck")) { errno = ESTALE; goto done; }
  attempted = 1;
  if (rename_exclusive(qfd, "staged", dir, part)) goto done;
  if (status("renamed\n") || test_point("captured_after_publish")) goto done;
  if (fstat(stage, &opened) || !same_file(&staged, &opened, 0) || compare_files(stage, 9) ||
      fstatat(dir, part, &after, AT_SYMLINK_NOFOLLOW) || !same_file(&opened, &after, 1) ||
      fstat(heldfd, &after) || !same_file(&held, &after, 1) || compare_files(heldfd, 7) ||
      fstatat(qfd, "held", &after, AT_SYMLINK_NOFOLLOW) || !same_file(&held, &after, 1) || linked_alias_matches(dir, alias, &held) ||
      same_parent(3, target, dir) || named_directory(dir, quarantine, &qopened) ||
      fsync(stage) || fsync(qfd) || fsync(dir) || test_point("captured_before_final")) { errno = ESTALE; goto done; }
  if (fstatat(qfd, "staged", &after, AT_SYMLINK_NOFOLLOW) == 0 || errno != ENOENT) { errno = EEXIST; goto done; }
  if (fstat(stage, &after) || !same_file(&opened, &after, 1) ||
      fstatat(dir, part, &after, AT_SYMLINK_NOFOLLOW) || !same_file(&opened, &after, 1) || compare_files(stage, 9) ||
      fstatat(qfd, "held", &after, AT_SYMLINK_NOFOLLOW) || !same_file(&held, &after, 1) || compare_files(heldfd, 7) || linked_alias_matches(dir, alias, &held) ||
      same_parent(3, target, dir) || named_directory(dir, quarantine, &qopened) || fstat(dir, &parent) ||
      frame(current, sizeof(current), &opened, &parent) || frame(held_frame, sizeof(held_frame), &held, &qopened) ||
      report("held %s\nlanded %s\n", held_frame, current) < 0 || status("durable\n")) goto done;
  ok = 1;
done:
  { int saved = errno;
    if (stage >= 0) close(stage);
    if (heldfd >= 0) close(heldfd);
    if (qfd >= 0) close(qfd);
    if (!ok) report("error %s %d\n", attempted ? "unknown" : "not_published", saved);
    if (next >= 0) close(next);
    if (dir >= 0) close(dir);
    free(copy);
  }
  return ok ? 0 : 1;
}
#else
static int create_retained(const char *target, const char *missing, const char *id,
    const char *staged, const char *count, const char *mode) {
  (void)target; (void)missing; (void)id; (void)staged; (void)count; (void)mode;
  status("start\n"); report("error unsupported %d\n", ENOTSUP); return 1;
}
static int publish_captured(const char *target, const char *missing, const char *held, const char *staged, const char *id, const char *alias) {
  (void)target; (void)missing; (void)held; (void)staged; (void)id; (void)alias;
  status("start\n"); report("error not_published %d\n", ENOTSUP); return 1;
}
static int observe_retained(const char *target, const char *expected, const char *id, const char *alias, const char *parent, int archive, int move, int removal) {
  (void)target; (void)expected; (void)id; (void)alias; (void)parent; (void)archive; (void)move; (void)removal;
  status("start\n"); report("error unknown %d\n", ENOTSUP); return 1;
}
static int replace_retained(const char *target, const char *count, const char *expected, const char *id, const char *restore_mode, const char *alias) {
  (void)target; (void)count; (void)expected; (void)id; (void)restore_mode; (void)alias;
  status("start\n"); report("error not_published %d\n", ENOTSUP); return 1;
}
#endif

static int run(int argc, char **argv);
int main(int argc, char **argv) {
  if (argc > 1 && !strcmp(argv[1], "--receipt")) {
    struct stat st; int flags = fcntl(8, F_GETFL);
    if (flags < 0 || (flags & O_ACCMODE) == O_RDONLY || fstat(8, &st) || !S_ISREG(st.st_mode) ||
        st.st_nlink != 1 || (st.st_mode & 07777) != 0600 || st.st_size != 0 || lseek(8, 0, SEEK_CUR) != 0) return 2;
    receipt_fd = 8;
    if (receipt_append("directory-write-receipt-v2\n", 27)) return 2;
    ++argv; --argc;
  }
  int result = run(argc, argv);
  if (receipt_fd >= 0) {
    char final[32]; int length = snprintf(final, sizeof(final), "exit %d\n", result);
    if (length < 0 || (size_t)length >= sizeof(final) || receipt_append(final, (size_t)length)) return 1;
  }
  return result;
}
static int run(int argc, char **argv) {
  int dir = -1, next = -1, tmp = -1, created = 0, attempted = 0, renamed = 0, ok = 0;
  char *copy = NULL, name[96] = "", *part, *slash, original[512], current[512];
  struct stat st;
  uintmax_t expected = 0, received = 0;
  mode_t mode;
  struct sigaction sa = {0}; sa.sa_handler = on_signal; sigemptyset(&sa.sa_mask);
  sigaction(SIGTERM, &sa, NULL); sigaction(SIGINT, &sa, NULL);
  signal(SIGPIPE, SIG_IGN);
  if (argc == 6 && !strcmp(argv[1], "--remove") && !strcmp(argv[5], "--execute")) return remove_file(argv[2], argv[3], argv[4]);
  if (argc == 6 && !strcmp(argv[1], "--observe-retained") && !strcmp(argv[5], "--execute")) return observe_retained(argv[2], argv[3], argv[4], NULL, NULL, -1, 0, 0);
  if (argc == 6 && !strcmp(argv[1], "--observe-unarchived") && !strcmp(argv[5], "--execute")) return observe_retained(argv[2], argv[3], argv[4], NULL, NULL, -2, 0, 0);
  if (argc == 8 && !strcmp(argv[1], "--observe-linked-retained") && !strcmp(argv[7], "--execute")) return observe_retained(argv[2], argv[3], argv[4], argv[5], argv[6], -1, 0, 0);
  if (argc == 7 && (!strcmp(argv[1], "--archive-retained") || !strcmp(argv[1], "--locate-retained")) && !strcmp(argv[6], "--execute"))
    return observe_retained(argv[2], argv[3], argv[4], NULL, argv[5], 9, !strcmp(argv[1], "--archive-retained"), 0);
  if (argc == 7 && (!strcmp(argv[1], "--archive-removed") || !strcmp(argv[1], "--locate-removed")) && !strcmp(argv[6], "--execute"))
    return observe_retained(argv[2], argv[3], argv[4], NULL, argv[5], 9, !strcmp(argv[1], "--archive-removed"), 1);
  if (argc == 7 && !strcmp(argv[1], "--replace-retained") && !strcmp(argv[6], "--execute")) return replace_retained(argv[2], argv[3], argv[4], argv[5], NULL, NULL);
  if (argc == 8 && !strcmp(argv[1], "--restore-retained") && !strcmp(argv[7], "--execute")) return replace_retained(argv[2], argv[3], argv[4], argv[5], argv[6], NULL);
  if (argc == 8 && !strcmp(argv[1], "--normalize-linked") && !strcmp(argv[7], "--execute")) return replace_retained(argv[2], argv[3], argv[4], argv[5], NULL, argv[6]);
  if (argc == 8 && !strcmp(argv[1], "--publish-captured") && !strcmp(argv[7], "--execute")) return publish_captured(argv[2], argv[3], argv[4], argv[5], argv[6], NULL);
  if (argc == 9 && !strcmp(argv[1], "--publish-linked-captured") && !strcmp(argv[8], "--execute")) return publish_captured(argv[2], argv[3], argv[4], argv[5], argv[6], argv[7]);
  if (argc == 8 && !strcmp(argv[1], "--prepare-create") && !strcmp(argv[7], "--execute")) return create_retained(argv[2], argv[3], argv[4], NULL, argv[5], argv[6]);
  if (argc == 8 && !strcmp(argv[1], "--publish-prepared-create") && !strcmp(argv[7], "--execute")) return create_retained(argv[2], argv[3], argv[4], argv[5], NULL, argv[6]);
  if (status("start\n")) goto done;
  if (argc < 3 || argc > 5 || !argv[1][0] || argv[1][0] == '/') { errno = EINVAL; goto done; }
  if (parse_unsigned(argv[2], &expected)) goto done;
  copy = strdup(argv[1]);
  if (!copy || fstat(3, &st)) goto done;
  if (!S_ISDIR(st.st_mode)) { errno = ENOTDIR; goto done; }
  dir = dup(3); if (dir < 0) goto done;
  part = copy;
  for (;;) {
    slash = strchr(part, '/'); if (slash) *slash = '\0';
    if (!*part || !strcmp(part, ".") || !strcmp(part, "..")) { errno = EINVAL; goto done; }
    if (!slash) break;
    next = openat(dir, part, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    if (next < 0) goto done;
    close(dir); dir = next; next = -1; part = slash + 1;
  }
  mode_t mask = umask(0); umask(mask); mode = 0666 & ~mask;
  int present = observe(dir, part, original, sizeof(original), &st);
  if (present < 0) goto done;
  if (present) mode = st.st_mode & 07777;
  if (argc >= 4 && strcmp(original, argv[3])) { errno = ESTALE; goto done; }
  if (argc == 5) {
    uintmax_t requested;
    if (parse_unsigned(argv[4], &requested)) goto done;
    if (requested > 07777) { errno = EINVAL; goto done; }
    mode = (mode_t)requested;
  }
  for (unsigned i = 0; i < 128; i++) {
    snprintf(name, sizeof(name), ".litcode-tmp-%ld-%u", (long)getpid(), i);
    tmp = openat(dir, name, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0600);
    if (tmp >= 0) { created = 1; break; }
    if (errno != EEXIST) goto done;
  }
  if (tmp < 0) goto done;
  if (status("staging\n")) goto done;
  if (test_point("staging")) goto done;
  char buffer[65536];
  for (;;) {
    if (cancelled) { errno = EINTR; goto done; }
    ssize_t n = read(0, buffer, sizeof(buffer));
    if (n < 0 && errno == EINTR) continue;
    if (n < 0) goto done;
    if (!n) break;
    if ((uintmax_t)n > expected - received) { errno = EFBIG; goto done; }
    if (test_point("write") || write_all(tmp, buffer, (size_t)n)) goto done;
    received += (uintmax_t)n;
  }
  if (received != expected) { errno = EIO; goto done; }
  if (fchmod(tmp, mode) || fsync(tmp)) goto done;
#ifdef DIRECTORY_WRITE_TEST
  if (getenv("DIRECTORY_WRITE_TEST_TRUNCATE") && expected && ftruncate(tmp, (off_t)(expected - 1))) goto done;
#endif
  struct stat staged;
  if (fstat(tmp, &staged)) goto done;
  if (!S_ISREG(staged.st_mode) || staged.st_size < 0 || (uintmax_t)staged.st_size != expected || (staged.st_mode & 07777) != mode) { errno = EIO; goto done; }
  if (status("publishing\n") || cancelled || test_point("before_rename")) goto done;
  if (observe(dir, part, current, sizeof(current), &st) < 0) goto done;
  if (strcmp(current, original)) { errno = ESTALE; goto done; }
  if (receipt_intent("create", name, tmp, dir) || test_point("after_recheck")) goto done;
  if (same_parent(3, argv[1], dir) || check_stage_name(dir, name, tmp, &st)) goto done;
  if (!same_file(&staged, &st, 1)) { errno = ESTALE; goto done; }
  if (status("committing\n")) goto done;
  attempted = 1;
  /* Adapt sC's rename publication, f606a53w [12501,15618), UTF-16,
   * SHA dd0a1dc61be769e7ea2ec7f4345b3b4f88996150d4d219b8ada90f03e89dd033.
   * Exclusive rename preserves the host no-overwrite contract without a
   * two-link intermediate state. */
  if (!present) {
    if (rename_exclusive(dir, name, dir, part)) goto done;
    renamed = 1; created = 0;
  } else {
    if (renameat(dir, name, dir, part)) goto done;
    renamed = 1; created = 0;
  }
  if (test_point("after_publish")) goto done;
  if (status("renamed\n")) goto done;
  if (test_point("after_rename")) goto done;
  if (fsync(dir)) goto done;
  struct stat parent;
  if (same_parent(3, argv[1], dir) || check_stage_name(dir, part, tmp, &st)) goto done;
  if (!same_file(&staged, &st, 0)) { errno = ESTALE; goto done; }
  if (fstat(dir, &parent) || frame(current, sizeof(current), &st, &parent)) goto done;
  if (report("landed %s\n", current) < 0) goto done;
  if (close(tmp)) { tmp = -1; goto done; } tmp = -1;
  if (status("durable\n")) goto done;
  ok = 1;
done:
  { int saved = errno;
    if (created && dir >= 0 && (same_parent(3, argv[1], dir) ||
        check_stage_name(dir, name, tmp, &st) || unlinkat(dir, name, 0))) {
      report("cleanup_failed %d\n", errno);
    }
    if (tmp >= 0) close(tmp);
    if (!ok) report("error %s %d\n", renamed ? "renamed" : attempted ? "unknown" : "not_renamed", saved);
    if (next >= 0) close(next);
    if (dir >= 0) close(dir);
    free(copy);
  }
  return ok ? 0 : 1;
}
