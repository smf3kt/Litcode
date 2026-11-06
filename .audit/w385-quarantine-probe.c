/* Experiment for source kVr/EVr, sfn1dbxq [4735645,4737243)/[4739632,4740702), UTF-16. */
#define _DARWIN_C_SOURCE 1
#define _POSIX_C_SOURCE 200809L
#include <sys/types.h>
#include <sys/stat.h>
#include <sys/stdio.h>
#include <fcntl.h>
#include <unistd.h>
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <inttypes.h>

static int wait_step(void) {
  char c;
  return read(5, &c, 1) == 1 && c == 'c' ? 0 : -1;
}
static int unchanged(const struct stat *a, const struct stat *b) {
  return S_ISREG(a->st_mode) && S_ISREG(b->st_mode) && a->st_dev == b->st_dev && a->st_ino == b->st_ino &&
    a->st_mode == b->st_mode && a->st_nlink == b->st_nlink && a->st_size == b->st_size &&
    a->st_mtimespec.tv_sec == b->st_mtimespec.tv_sec && a->st_mtimespec.tv_nsec == b->st_mtimespec.tv_nsec &&
    a->st_ctimespec.tv_sec == b->st_ctimespec.tv_sec && a->st_ctimespec.tv_nsec == b->st_ctimespec.tv_nsec;
}
static int same_bytes(int left, int right, const struct stat *captured) {
  struct stat l0, l1, r0, r1;
  if (fstat(left, &l0) || fstat(right, &r0) || !unchanged(&l0, captured) || !S_ISREG(r0.st_mode) ||
      l0.st_size < 0 || r0.st_size < 0) return -1;
  int same = l0.st_size == r0.st_size;
  char a[8192], b[8192];
  for (off_t offset = 0; same && offset < l0.st_size;) {
    size_t size = (uintmax_t)(l0.st_size - offset) < sizeof(a) ? (size_t)(l0.st_size - offset) : sizeof(a);
    ssize_t n = pread(left, a, size, offset), m = pread(right, b, size, offset);
    if (n <= 0 || m != n) return -1;
    if (!offset && getenv("QUARANTINE_COMPARE_BARRIER") && (dprintf(4, "comparing\n") < 0 || wait_step())) return -1;
    if (memcmp(a, b, (size_t)n)) same = 0;
    offset += n;
  }
  if (fstat(left, &l1) || fstat(right, &r1) || !unchanged(&l0, &l1) || !unchanged(&r0, &r1)) return -1;
  return same;
}
int main(int argc, char **argv) {
  if (argc != 5) return 2;
  const char *target = argv[1], *quarantine = argv[2];
  uintmax_t dev = strtoumax(argv[3], NULL, 10), ino = strtoumax(argv[4], NULL, 10);
  struct stat before, captured;
  if (fstatat(3, target, &before, AT_SYMLINK_NOFOLLOW) || !S_ISREG(before.st_mode) ||
      before.st_nlink != 1 || (uintmax_t)before.st_dev != dev || (uintmax_t)before.st_ino != ino) return 3;
  if (mkdirat(3, quarantine, 0700)) return 4;
  int qfd = openat(3, quarantine, O_RDONLY | O_DIRECTORY | O_NOFOLLOW);
  if (qfd < 0) return 5;
  if (fsync(3) || dprintf(4, "checked\n") < 0 || wait_step()) return 6;
  if (renameat(3, target, qfd, "held")) return 7;
  if (fsync(qfd) || fsync(3) || fstatat(qfd, "held", &captured, AT_SYMLINK_NOFOLLOW)) return 8;
  int match = S_ISREG(captured.st_mode) && captured.st_nlink == 1 &&
    (uintmax_t)captured.st_dev == dev && (uintmax_t)captured.st_ino == ino && captured.st_mode == before.st_mode &&
    captured.st_size == before.st_size && captured.st_mtimespec.tv_sec == before.st_mtimespec.tv_sec &&
    captured.st_mtimespec.tv_nsec == before.st_mtimespec.tv_nsec;
  int bytes = -1;
  if (match) {
    int file = openat(qfd, "held", O_RDONLY | O_NOFOLLOW | O_NONBLOCK);
    if (file >= 0) { bytes = same_bytes(file, 6, &captured); close(file); }
  }
  if (dprintf(4, "captured %d %ju %ju %ju %u %jd %ld %jd %ld %d\n", match,
      (uintmax_t)captured.st_dev, (uintmax_t)captured.st_ino, (uintmax_t)captured.st_nlink,
      (unsigned)captured.st_mode, (intmax_t)before.st_ctimespec.tv_sec, before.st_ctimespec.tv_nsec,
      (intmax_t)captured.st_ctimespec.tv_sec, captured.st_ctimespec.tv_nsec, bytes) < 0 || wait_step()) return 9;
  struct stat current;
  if (fstatat(qfd, "held", &current, AT_SYMLINK_NOFOLLOW) || current.st_dev != captured.st_dev ||
      current.st_ino != captured.st_ino || current.st_mode != captured.st_mode || current.st_nlink != captured.st_nlink) {
    close(qfd);
    return dprintf(4, "changed\n") < 0 ? 13 : 0;
  }
  if (getenv("QUARANTINE_DELETE") && match && bytes == 1) {
    struct stat destination;
    if (fstatat(3, target, &destination, AT_SYMLINK_NOFOLLOW) == 0) {
      close(qfd);
      return dprintf(4, "retained %d\n", EEXIST) < 0 ? 14 : 0;
    }
    if (errno != ENOENT || dprintf(4, "delete_ready\n") < 0 || wait_step()) return 15;
    if (fstatat(qfd, "held", &current, AT_SYMLINK_NOFOLLOW) || !unchanged(&current, &captured)) {
      close(qfd);
      return dprintf(4, "changed\n") < 0 ? 16 : 0;
    }
    if (getenv("QUARANTINE_DELETE_BARRIER") && (dprintf(4, "before_unlink\n") < 0 || wait_step())) return 17;
    if (unlinkat(qfd, "held", 0) || dprintf(4, "removed\n") < 0) return 18;
    if (getenv("QUARANTINE_KILL_BARRIER") && wait_step()) return 19;
    if (fsync(qfd) || fsync(3) || close(qfd) || unlinkat(3, quarantine, AT_REMOVEDIR) || fsync(3)) return 20;
    return dprintf(4, "deleted\n") < 0 ? 21 : 0;
  }
  if (renameatx_np(qfd, "held", 3, target, RENAME_EXCL)) {
    int e = errno;
    if (dprintf(4, "retained %d\n", e) < 0) return 10;
    close(qfd);
    return 0;
  }
  if (fsync(qfd) || fsync(3) || close(qfd) || unlinkat(3, quarantine, AT_REMOVEDIR) || fsync(3)) return 11;
  return dprintf(4, "restored\n") < 0 ? 12 : 0;
}
