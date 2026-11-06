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
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <inttypes.h>
#if defined(__APPLE__)
#include <sys/stdio.h>
#include <CommonCrypto/CommonDigest.h>
#elif defined(__linux__)
#include <sys/syscall.h>
#include <linux/fs.h>
#endif

static volatile sig_atomic_t cancelled;
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
  char ch;
  if (getenv("DIRECTORY_WRITE_TEST_CONTROL_STATUS") && dprintf(5, "test %s %ld\n", point, (long)getpid()) < 0) return -1;
  if (dprintf(4, "test %s\n", point) < 0 || read(5, &ch, 1) != 1 || ch != 'c') { errno = EIO; return -1; }
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
static int status(const char *s) { return write_all(4, s, strlen(s)); }
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
  if (test_point("remove_after_recheck") || status("committing\n")) goto done;
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
  if (frame(current, sizeof(current), &after, &qopened) || dprintf(4, "held %s\n", current) < 0 ||
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
    if (!ok) dprintf(4, "error %s %d\n", attempted || created ? "unknown" : "not_removed", saved);
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
static int digest_matches(int fd, const unsigned char *expected) {
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
  unsigned char actual[CC_SHA256_DIGEST_LENGTH]; CC_SHA256_Final(actual, &hash);
  if (fstat(fd, &after) || !same_file(&before, &after, 1) || memcmp(actual, expected, sizeof(actual))) { errno = ESTALE; return -1; }
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
static int observe_retained(const char *target, const char *expected, const char *id) {
  int dir = -1, next = -1, qfd = -1, heldfd = -1, ok = 0;
  char *copy = NULL, *part, *slash, quarantine[80], current[512];
  struct stat st, qopened, initial, pinned, after;
  if (status("start\n")) goto done;
  if (!target[0] || target[0] == '/' || !expected[0] || !valid_uuid(id)) { errno = EINVAL; goto done; }
  if (snprintf(quarantine, sizeof(quarantine), ".litcode-replace-%s", id) >= (int)sizeof(quarantine)) { errno = EINVAL; goto done; }
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
  qfd = openat(dir, quarantine, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (qfd < 0 || fstat(qfd, &qopened) || !S_ISDIR(qopened.st_mode) || !qopened.st_nlink ||
      (qopened.st_mode & 0777) != 0700 || named_directory(dir, quarantine, &qopened) ||
      same_parent(3, target, dir) || observe(qfd, "held", current, sizeof(current), &initial) != 1 ||
      initial.st_nlink != 1 || strcmp(current, expected)) { errno = ESTALE; goto done; }
  heldfd = openat(qfd, "held", O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC);
  if (heldfd < 0 || fstat(heldfd, &pinned) || !same_file(&initial, &pinned, 1) ||
      compare_files(heldfd, 7) || test_point("observe_retained_after_read") ||
      same_parent(3, target, dir) || named_directory(dir, quarantine, &qopened) ||
      fstat(heldfd, &pinned) || !same_file(&initial, &pinned, 1) ||
      observe(qfd, "held", current, sizeof(current), &after) != 1 ||
      !same_file(&initial, &after, 1) || strcmp(current, expected) || compare_files(heldfd, 7) ||
      same_parent(3, target, dir) || named_directory(dir, quarantine, &qopened) ||
      observe(qfd, "held", current, sizeof(current), &after) != 1 ||
      !same_file(&initial, &after, 1) || strcmp(current, expected)) { errno = ESTALE; goto done; }
  if (dprintf(4, "observed %s\n", current) < 0) goto done;
  ok = 1;
done:
  { int saved = errno;
    if (heldfd >= 0) close(heldfd);
    if (qfd >= 0) close(qfd);
    if (!ok) dprintf(4, "error unknown %d\n", saved);
    if (next >= 0) close(next);
    if (dir >= 0) close(dir);
    free(copy);
  }
  return ok ? 0 : 1;
}

/* Host rewrite: uno/pPe/sC, sfn1dbxq [739599,743280), f606a53w [7111,7501)/[12501,15618), UTF-16.
 * The retained objects require a later owner-bound transaction and revalidation. */
static int replace_retained(const char *target, const char *count, const char *expected, const char *id) {
  int dir = -1, next = -1, qfd = -1, pinned = -1, stage = -1, output = -1, created = 0, attempted = 0, ok = 0;
  char *copy = NULL, *part, *slash, original[512], current[512], held_frame[512], quarantine[80], bytes[65536];
  struct stat st, initial, pin, held, after, qopened, stage_before, staged, output_stat;
  uintmax_t length = 0, received = 0;
  unsigned char digest[CC_SHA256_DIGEST_LENGTH];
  CC_SHA256_CTX hash;
  if (status("start\n")) goto done;
  if (!target[0] || target[0] == '/' || !expected[0] || !valid_uuid(id) || parse_unsigned(count, &length)) { errno = EINVAL; goto done; }
  if (snprintf(quarantine, sizeof(quarantine), ".litcode-replace-%s", id) >= (int)sizeof(quarantine)) { errno = EINVAL; goto done; }
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
  if (present != 1 || initial.st_nlink != 1 || strcmp(original, expected)) { errno = ESTALE; goto done; }
  pinned = openat(dir, part, O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC);
  if (pinned < 0 || fstat(pinned, &pin) || !same_file(&initial, &pin, 1) || compare_files(pinned, 7)) { errno = ESTALE; goto done; }
  if (mkdirat(dir, quarantine, 0700)) goto done;
  created = 1;
  qfd = openat(dir, quarantine, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (qfd < 0 || fstat(qfd, &qopened) || !S_ISDIR(qopened.st_mode) || (qopened.st_mode & 0777) != 0700 || fsync(dir)) goto done;
  stage = openat(qfd, "staged", O_RDWR | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0600);
  if (stage < 0 || status("staging\n") || test_point("replace_staging")) goto done;
  CC_SHA256_Init(&hash);
  for (;;) {
    if (cancelled) { errno = EINTR; goto done; }
    ssize_t n = read(0, bytes, sizeof(bytes));
    if (n < 0 && errno == EINTR) continue;
    if (n < 0) goto done;
    if (!n) break;
    if ((uintmax_t)n > length - received) { errno = EFBIG; goto done; }
    CC_SHA256_Update(&hash, bytes, (CC_LONG)n);
    if (write_all(stage, bytes, (size_t)n)) goto done;
    received += (uintmax_t)n;
  }
  CC_SHA256_Final(digest, &hash);
  if (received != length || fchmod(stage, initial.st_mode & 07777)) { errno = EIO; goto done; }
#ifdef DIRECTORY_WRITE_TEST
  if (getenv("DIRECTORY_WRITE_TEST_FIXED_TIME")) {
    struct timespec fixed[2] = { { 1700000000, 0 }, { 1700000000, 0 } };
    if (futimens(stage, fixed)) goto done;
  }
#endif
  if (fsync(stage) || fstat(stage, &stage_before) ||
      !S_ISREG(stage_before.st_mode) || stage_before.st_size < 0 || (uintmax_t)stage_before.st_size != length ||
      digest_matches(stage, digest) || fsync(qfd) || status("checking\n")) { errno = EIO; goto done; }
  if (same_parent(3, target, dir) || named_directory(dir, quarantine, &qopened) ||
      observe(dir, part, current, sizeof(current), &st) != 1 || strcmp(current, original) ||
      fstat(pinned, &pin) || !same_file(&initial, &pin, 1) || compare_files(pinned, 7)) { errno = ESTALE; goto done; }
  if (test_point("replace_after_recheck") || status("capturing\n")) goto done;
  attempted = 1;
  if (rename_exclusive(dir, part, qfd, "held")) goto done;
  if (fsync(qfd) || fsync(dir) || status("captured\n") || test_point("replace_after_capture")) goto done;
  if (fstatat(qfd, "held", &held, AT_SYMLINK_NOFOLLOW) || fstat(pinned, &pin) ||
      !same_file(&initial, &held, 0) || !same_file(&held, &pin, 1) || compare_files(pinned, 7) ||
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
  output = openat(dir, part, O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC);
  if (output < 0 || fstat(stage, &staged) || !same_file(&stage_before, &staged, 0) || digest_matches(stage, digest) ||
      fstat(output, &output_stat) || !same_file(&staged, &output_stat, 1) || digest_matches(output, digest) ||
      fstatat(dir, part, &after, AT_SYMLINK_NOFOLLOW) || !same_file(&output_stat, &after, 1) ||
      fstatat(qfd, "held", &after, AT_SYMLINK_NOFOLLOW) || !same_file(&held, &after, 1) || compare_files(pinned, 7) ||
      same_parent(3, target, dir) || named_directory(dir, quarantine, &qopened) || fsync(output) || fsync(qfd) || fsync(dir) ||
      test_point("replace_before_final")) { errno = ESTALE; goto done; }
  if (fstat(stage, &staged) || !same_file(&output_stat, &staged, 1) || fstat(output, &pin) || !same_file(&staged, &pin, 1) ||
      fstatat(dir, part, &after, AT_SYMLINK_NOFOLLOW) || !same_file(&pin, &after, 1) ||
      fstatat(qfd, "held", &after, AT_SYMLINK_NOFOLLOW) || !same_file(&held, &after, 1) ||
      same_parent(3, target, dir) || named_directory(dir, quarantine, &qopened) || fstat(qfd, &st) ||
      frame(held_frame, sizeof(held_frame), &held, &st) || fstat(dir, &st) || frame(current, sizeof(current), &pin, &st)) { errno = ESTALE; goto done; }
  if (dprintf(4, "held %s\nlanded %s\n", held_frame, current) < 0 || status("durable\n")) goto done;
  ok = 1;
done:
  { int saved = errno;
    if (output >= 0) close(output);
    if (stage >= 0) close(stage);
    if (pinned >= 0) close(pinned);
    if (qfd >= 0) close(qfd);
    if (!ok) dprintf(4, "error %s %d\n", created || attempted ? "unknown" : "not_published", saved);
    if (next >= 0) close(next);
    if (dir >= 0) close(dir);
    free(copy);
  }
  return ok ? 0 : 1;
}
#else
static int observe_retained(const char *target, const char *expected, const char *id) {
  (void)target; (void)expected; (void)id;
  status("start\n"); dprintf(4, "error unknown %d\n", ENOTSUP); return 1;
}
static int replace_retained(const char *target, const char *count, const char *expected, const char *id) {
  (void)target; (void)count; (void)expected; (void)id;
  status("start\n"); dprintf(4, "error not_published %d\n", ENOTSUP); return 1;
}
#endif

int main(int argc, char **argv) {
  int dir = -1, next = -1, tmp = -1, created = 0, attempted = 0, renamed = 0, ok = 0;
  char *copy = NULL, name[96] = "", *part, *slash, original[512], current[512];
  struct stat st;
  uintmax_t expected = 0, received = 0;
  mode_t mode;
  struct sigaction sa = {0}; sa.sa_handler = on_signal; sigemptyset(&sa.sa_mask);
  sigaction(SIGTERM, &sa, NULL); sigaction(SIGINT, &sa, NULL);
  signal(SIGPIPE, SIG_IGN);
  if (argc == 6 && !strcmp(argv[1], "--remove") && !strcmp(argv[5], "--execute")) return remove_file(argv[2], argv[3], argv[4]);
  if (argc == 6 && !strcmp(argv[1], "--observe-retained") && !strcmp(argv[5], "--execute")) return observe_retained(argv[2], argv[3], argv[4]);
  if (argc == 7 && !strcmp(argv[1], "--replace-retained") && !strcmp(argv[6], "--execute")) return replace_retained(argv[2], argv[3], argv[4], argv[5]);
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
  if (fstat(tmp, &st)) goto done;
  if (!S_ISREG(st.st_mode) || st.st_size < 0 || (uintmax_t)st.st_size != expected || (st.st_mode & 07777) != mode) { errno = EIO; goto done; }
  if (status("publishing\n") || cancelled || test_point("before_rename")) goto done;
  if (observe(dir, part, current, sizeof(current), &st) < 0) goto done;
  if (strcmp(current, original)) { errno = ESTALE; goto done; }
  if (test_point("after_recheck")) goto done;
  if (status("committing\n")) goto done;
  attempted = 1;
  /* The host's no-overwrite contract needs an atomic missing-leaf claim;
   * sC, f606a53w [12501,15618), UTF-16, uses replacement rename. */
  if (!present) {
    if (linkat(dir, name, dir, part, 0)) goto done;
    renamed = 1;
    if (test_point("after_link") || unlinkat(dir, name, 0)) goto done;
    created = 0;
  } else {
    if (renameat(dir, name, dir, part)) goto done;
    renamed = 1; created = 0;
  }
  if (status("renamed\n")) goto done;
  if (test_point("after_rename")) goto done;
  if (fsync(dir)) goto done;
  struct stat parent;
  if (fstat(tmp, &st) || fstat(dir, &parent) || frame(current, sizeof(current), &st, &parent)) goto done;
  if (dprintf(4, "landed %s\n", current) < 0) goto done;
  if (close(tmp)) { tmp = -1; goto done; } tmp = -1;
  if (status("durable\n")) goto done;
  ok = 1;
done:
  { int saved = errno;
    if (tmp >= 0) close(tmp);
    if (created && dir >= 0 && unlinkat(dir, name, 0)) {
      dprintf(4, "cleanup_failed %d\n", errno);
    }
    if (!ok) dprintf(4, "error %s %d\n", renamed ? "renamed" : attempted ? "unknown" : "not_renamed", saved);
    if (next >= 0) close(next);
    if (dir >= 0) close(dir);
    free(copy);
  }
  return ok ? 0 : 1;
}
