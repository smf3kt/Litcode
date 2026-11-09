/* Descriptor-relative Read host rewrite; see W385, Mk/eNe/Yg UTF-16
 * [214762,215541), chunk-2bcyxj9q sha256 fac54023446990731332f837b388955e357036b2797a11f93150648afb45f7e0. */
#define _POSIX_C_SOURCE 200809L
#define _DARWIN_C_SOURCE 1
#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <unistd.h>
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <signal.h>

#if (defined(__APPLE__) || defined(__linux__)) && !defined(DIRECTORY_READ_UNSUPPORTED)
static int write_all(int fd, const void *data, size_t len) {
  const char *p = data;
  while (len) {
    ssize_t n = write(fd, p, len);
    if (n < 0 && errno == EINTR) continue;
    if (n <= 0) return -1;
    p += n; len -= (size_t)n;
  }
  return 0;
}

static int status_line(const char *phase, const struct stat *st, const struct stat *parent) {
  char buf[512];
#if defined(__APPLE__)
  struct timespec mt = st->st_mtimespec, ct = st->st_ctimespec;
#else
  struct timespec mt = st->st_mtim, ct = st->st_ctim;
#endif
  int n = parent ? snprintf(buf, sizeof(buf), "v2 %s %llu %llu %lld %lld %ld %lld %ld %u %llu %llu %llu\n", phase,
    (unsigned long long)st->st_dev, (unsigned long long)st->st_ino,
    (long long)st->st_size, (long long)mt.tv_sec, mt.tv_nsec, (long long)ct.tv_sec, ct.tv_nsec,
    (unsigned)(st->st_mode & 07777), (unsigned long long)st->st_nlink,
    (unsigned long long)parent->st_dev, (unsigned long long)parent->st_ino)
    : snprintf(buf, sizeof(buf), "v1 %s %llu %llu %lld %lld %ld %lld %ld\n", phase,
    (unsigned long long)st->st_dev, (unsigned long long)st->st_ino,
    (long long)st->st_size, (long long)mt.tv_sec, mt.tv_nsec,
    (long long)ct.tv_sec, ct.tv_nsec);
  return n < 0 || (size_t)n >= sizeof(buf) ? -1 : write_all(4, buf, (size_t)n);
}

static int same_stat(const struct stat *a, const struct stat *b) {
#if defined(__APPLE__)
  struct timespec am = a->st_mtimespec, bm = b->st_mtimespec;
  struct timespec ac = a->st_ctimespec, bc = b->st_ctimespec;
#else
  struct timespec am = a->st_mtim, bm = b->st_mtim;
  struct timespec ac = a->st_ctim, bc = b->st_ctim;
#endif
  return a->st_dev == b->st_dev && a->st_ino == b->st_ino && a->st_size == b->st_size &&
    a->st_mode == b->st_mode && a->st_nlink == b->st_nlink &&
    am.tv_sec == bm.tv_sec && am.tv_nsec == bm.tv_nsec && ac.tv_sec == bc.tv_sec && ac.tv_nsec == bc.tv_nsec;
}

struct checkpoint_node { int fd; const char *name; struct stat before; };

static int checkpoint_verify(struct checkpoint_node *nodes, size_t count) {
  for (size_t i = 0; i < count; i++) {
    struct stat opened, named;
    if (fstat(nodes[i].fd, &opened) || !same_stat(&nodes[i].before, &opened) || !opened.st_nlink) return -1;
    if (i && (fstatat(nodes[i-1].fd, nodes[i].name, &named, AT_SYMLINK_NOFOLLOW) || !same_stat(&opened, &named))) return -1;
  }
  return 0;
}

static int checkpoint_copy(int source, int destination, off_t length, int copy) {
  char left[65536], right[65536];
  for (off_t offset = 0; offset < length;) {
    size_t count = length-offset < (off_t)sizeof(left) ? (size_t)(length-offset) : sizeof(left), done = 0;
    while (done < count) {
      ssize_t n = pread(source, left+done, count-done, offset+(off_t)done);
      if (n < 0 && errno == EINTR) continue;
      if (n <= 0) return -1;
      done += (size_t)n;
    }
    done = 0;
    while (done < count) {
      ssize_t n = copy ? pwrite(destination, left+done, count-done, offset+(off_t)done)
                       : pread(destination, right+done, count-done, offset+(off_t)done);
      if (n < 0 && errno == EINTR) continue;
      if (n <= 0) return -1;
      done += (size_t)n;
    }
    if (!copy && memcmp(left, right, count)) return -1;
    offset += (off_t)count;
  }
  return 0;
}

/* Host rewrite: Tke/Cwt, sfn1dbxq [4732048,4733481)/[4734814,4735645), UTF-16.
 * fd 3 is the grant, fd 4 the status pipe, fd 5 the caller's continuation,
 * fd 6 the inherited Session gate and fd 7 an independent empty backup. */
static int checkpoint_bracket(const char *target) {
  struct checkpoint_node nodes[1024];
  size_t count = 0;
  char *copy = NULL, *part, *slash, *missing = NULL;
  struct stat witness, after;
  int result = 1;
  if (!target || !target[0] || target[0] == '/' || strlen(target) > 4096) goto done;
  copy = strdup(target);
  if (!copy) goto done;
  nodes[count].fd = dup(3); nodes[count].name = NULL;
  if (nodes[count].fd < 0) goto done;
  count++;
  if (fstat(nodes[0].fd, &nodes[0].before) || !S_ISDIR(nodes[0].before.st_mode) || !nodes[0].before.st_nlink) goto done;
  if (fstat(7, &witness) || !S_ISREG(witness.st_mode) || witness.st_size != 0 || witness.st_nlink != 1 ||
      (witness.st_mode & 07777) != 0600 || witness.st_uid != geteuid() || (fcntl(7, F_GETFL) & O_ACCMODE) != O_RDWR) goto done;
  part = copy;
  for (;;) {
    slash = strchr(part, '/'); if (slash) *slash = '\0';
    if (!*part || !strcmp(part, ".") || !strcmp(part, "..") || count >= 1024) goto done;
    int flags = O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC;
    if (slash) flags |= O_DIRECTORY;
    int fd = openat(nodes[count-1].fd, part, flags);
    if (fd < 0 && !slash && errno == ENOENT) { missing = part; break; }
    if (fd < 0) goto done;
    nodes[count].fd = fd; nodes[count].name = part; count++;
    if (fstat(fd, &nodes[count-1].before) || (slash ? !S_ISDIR(nodes[count-1].before.st_mode) : !S_ISREG(nodes[count-1].before.st_mode))) goto done;
    if (!slash) break;
    part = slash+1;
  }
  if (missing) {
    if (checkpoint_verify(nodes, count) || fstatat(nodes[count-1].fd, missing, &after, AT_SYMLINK_NOFOLLOW) == 0 || errno != ENOENT ||
        checkpoint_verify(nodes, count) || fstat(7, &after) || !same_stat(&witness, &after) ||
        status_line("bracket-ready", &nodes[count-1].before, NULL)) goto done;
  } else {
    struct stat *file = &nodes[count-1].before;
    if (file->st_nlink != 1 || file->st_size < 0 || (file->st_dev == witness.st_dev && file->st_ino == witness.st_ino) ||
        checkpoint_copy(nodes[count-1].fd, 7, file->st_size, 1) || fsync(7) || fstat(7, &witness) || witness.st_size != file->st_size ||
        checkpoint_verify(nodes, count) || checkpoint_copy(nodes[count-1].fd, 7, witness.st_size, 0) ||
        fstat(7, &after) || !same_stat(&witness, &after) || checkpoint_verify(nodes, count) ||
        status_line("bracket-ready", file, &nodes[count-2].before)) goto done;
  }
  char control;
  ssize_t got;
  do { got = read(5, &control, 1); } while (got < 0 && errno == EINTR);
  if (got != 1 || control != 'c' || checkpoint_verify(nodes, count) || fstat(7, &after) || !same_stat(&witness, &after)) goto done;
  if (missing) {
    if (fstatat(nodes[count-1].fd, missing, &after, AT_SYMLINK_NOFOLLOW) == 0 || errno != ENOENT ||
        checkpoint_verify(nodes, count) || status_line("bracket-stable", &nodes[count-1].before, NULL)) goto done;
  } else {
    if (checkpoint_copy(nodes[count-1].fd, 7, witness.st_size, 0) || fstat(7, &after) || !same_stat(&witness, &after) ||
        checkpoint_verify(nodes, count) || status_line("bracket-stable", &nodes[count-1].before, &nodes[count-2].before)) goto done;
  }
  result = 0;
done:
  if (result) write_all(4, "unknown\n", 8);
  while (count) close(nodes[--count].fd);
  free(copy);
  return result;
}
/* Host recovery adaptation of EVr/RVr, sfn1dbxq
 * 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da,
 * UTF-16 [4739632,4743506): sync and recheck every opened/named component
 * before admitting an interrupted write's surviving file as durable. */
/* Read-only legacy-pair evidence. EVr/RVr's ordinary hardlink refusal stays
 * intact; the host's old link/unlink publication needs both names witnessed.
 * Source coordinates and digest above; this does not authorize restoration. */
static int linked_verify(int parent, const char *alias, int fd, const struct stat *expected) {
  struct stat opened, named;
  return fstat(fd, &opened) || fstatat(parent, alias, &named, AT_SYMLINK_NOFOLLOW) ||
    !same_stat(expected, &opened) || !same_stat(expected, &named) ? -1 : 0;
}

static int synced_observation(const char *target, int mode, const char *alias) {
  int missing = mode == 1, metadata = mode == 2;
  struct checkpoint_node nodes[1024];
  size_t count = 0;
  char *copy = NULL, *part, *slash;
  struct stat after;
  int result = 1, alias_fd = -1;
  if (alias && (missing || metadata || !*alias || strchr(alias, '/') || !strcmp(alias, ".") || !strcmp(alias, ".."))) goto done;
  if (!target || !target[0] || target[0] == '/' || strlen(target) > 4096) goto done;
  copy = strdup(target);
  if (!copy) goto done;
  nodes[0].fd = dup(3); nodes[0].name = NULL;
  if (nodes[0].fd < 0) goto done;
  count = 1;
  if (fstat(nodes[0].fd, &nodes[0].before) || !S_ISDIR(nodes[0].before.st_mode)) goto done;
  part = copy;
  for (;;) {
    slash = strchr(part, '/'); if (slash) *slash = '\0';
    if (!*part || !strcmp(part, ".") || !strcmp(part, "..") || count >= 1024) goto done;
    if (!slash && (missing || metadata)) break;
    int fd = openat(nodes[count-1].fd, part, O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC | (slash ? O_DIRECTORY : 0));
    if (fd < 0) goto done;
    nodes[count].fd = fd; nodes[count].name = part; count++;
    if (fstat(fd, &nodes[count-1].before) || (slash ? !S_ISDIR(nodes[count-1].before.st_mode) :
        (!S_ISREG(nodes[count-1].before.st_mode) || nodes[count-1].before.st_nlink != (alias ? 2 : 1)))) goto done;
    if (!slash) break;
    part = slash + 1;
  }
  if (alias) {
    if (!strcmp(part, alias)) goto done;
    alias_fd = openat(nodes[count-2].fd, alias, O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC);
    if (alias_fd < 0 || linked_verify(nodes[count-2].fd, alias, alias_fd, &nodes[count-1].before)) goto done;
  }
  if (checkpoint_verify(nodes, count)) goto done;
  for (size_t i = count; i > 0; i--) if (fsync(nodes[i-1].fd)) goto done;
  if (checkpoint_verify(nodes, count) || (alias && linked_verify(nodes[count-2].fd, alias, alias_fd, &nodes[count-1].before))) goto done;
  if (metadata) {
    /* EVr, same source/range above: named metadata only, not an opened leaf
     * or verified bytes. Parent descriptors are synced and checked throughout. */
    struct stat named;
    if (fstatat(nodes[count-1].fd, part, &named, AT_SYMLINK_NOFOLLOW) ||
        !S_ISREG(named.st_mode) || named.st_nlink != 1 || named.st_size < 0 ||
        status_line("metadata_begin", &named, &nodes[count-1].before)) goto done;
#ifdef DIRECTORY_READ_TEST
    char control;
    if (write_all(4, "test metadata_before_final\n", 27) || read(5, &control, 1) != 1 || control != 'c') goto done;
#endif
    if (checkpoint_verify(nodes, count) || fstatat(nodes[count-1].fd, part, &after, AT_SYMLINK_NOFOLLOW) ||
        !same_stat(&named, &after) || status_line("metadata_stable", &named, &nodes[count-1].before)) goto done;
  } else if (missing) {
    if (fstatat(nodes[count-1].fd, part, &after, AT_SYMLINK_NOFOLLOW) == 0 || errno != ENOENT ||
        checkpoint_verify(nodes, count) || status_line("missing", &nodes[count-1].before, NULL)) goto done;
  } else {
    if (status_line(alias ? "linked_begin" : "begin", &nodes[count-1].before, &nodes[count-2].before)) goto done;
    char bytes[16384];
    for (;;) {
      ssize_t n = read(nodes[count-1].fd, bytes, sizeof(bytes));
      if (n < 0 && errno == EINTR) continue;
      if (n < 0) goto done;
      if (!n) break;
      if (write_all(1, bytes, (size_t)n)) goto done;
    }
#ifdef DIRECTORY_READ_TEST
    if (alias) {
      char control;
      if (write_all(4, "test linked_before_final\n", 25) || read(5, &control, 1) != 1 || control != 'c') goto done;
    }
#endif
    if (checkpoint_verify(nodes, count) || (alias && linked_verify(nodes[count-2].fd, alias, alias_fd, &nodes[count-1].before)) ||
        status_line(alias ? "linked_stable" : "stable", &nodes[count-1].before, &nodes[count-2].before)) goto done;
  }
  result = 0;
done:
  if (alias_fd >= 0) close(alias_fd);
  while (count) close(nodes[--count].fd);
  free(copy);
  return result;
}
#endif

int main(int argc, char **argv) {
#if (!defined(__APPLE__) && !defined(__linux__)) || defined(DIRECTORY_READ_UNSUPPORTED)
  (void)argc; (void)argv;
  return 78;
#else
  int current = -1, file = -1, parent = -1, result = 1;
  char *copy = NULL;
  struct stat st, before, after, parent_before, parent_after;
  if (argc == 3 && (!strcmp(argv[1], "--sync-backup") || !strcmp(argv[1], "--sync-probe-missing")))
    return synced_observation(argv[2], !strcmp(argv[1], "--sync-probe-missing"), NULL);
  if (argc == 3 && !strcmp(argv[1], "--sync-named-metadata")) return synced_observation(argv[2], 2, NULL);
  if (argc == 5 && !strcmp(argv[1], "--sync-linked-pair") && !strcmp(argv[4], "--observe"))
    return synced_observation(argv[2], 0, argv[3]);
  if (argc == 4 && !strcmp(argv[1], "--checkpoint-bracket") && !strcmp(argv[3], "--execute")) {
    signal(SIGPIPE, SIG_IGN);
    return checkpoint_bracket(argv[2]);
  }
  /* W385 host rewrite: T$n, sfn1dbxq [4739060,4739632), UTF-16, uses path stat.
   * This observation describes only the pinned parent, not the current pathname. */
  int probe_missing = argc == 3 && !strcmp(argv[1], "--probe-missing");
  int backup = argc == 3 && !strcmp(argv[1], "--backup");
  const char *name = probe_missing || backup ? argv[2] : argc == 2 ? argv[1] : NULL;
  if (!name || !name[0] || name[0] == '/') goto done;
  copy = strdup(name);
  if (!copy || fstat(3, &st) || !S_ISDIR(st.st_mode)) goto done;
  current = dup(3);
  if (current < 0) goto done;
  char *part = copy;
  for (;;) {
    char *slash = strchr(part, '/');
    if (slash) *slash = '\0';
    if (!*part || !strcmp(part, ".") || !strcmp(part, "..")) goto done;
    int flags = O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC;
    if (slash) flags |= O_DIRECTORY;
    file = openat(current, part, flags);
    if (probe_missing && !slash && file < 0 && errno == ENOENT) {
      if (fstat(current, &before) || !S_ISDIR(before.st_mode)) goto done;
      if (fstatat(current, part, &st, AT_SYMLINK_NOFOLLOW) == 0 || errno != ENOENT) goto done;
      if (fstat(current, &after) || !same_stat(&before, &after)) goto done;
      if (status_line("missing", &after, NULL)) goto done;
      result = 0; goto done;
    }
    if (file < 0 || fstat(file, &st)) goto done;
    if (probe_missing && !slash) goto done;
    if (slash ? !S_ISDIR(st.st_mode) : !S_ISREG(st.st_mode)) goto done;
    if (!slash) { parent = current; current = file; file = -1; break; }
    close(current); current = file; file = -1;
    part = slash + 1;
  }
  /* Both observations belong to the same open regular-file descriptor. */
  if (backup && (fstat(parent, &parent_before) || !S_ISDIR(parent_before.st_mode) || !parent_before.st_nlink)) goto done;
  if (fstat(current, &before) || !S_ISREG(before.st_mode) || status_line("begin", &before, backup ? &parent_before : NULL)) goto done;
  char buffer[16384];
  for (;;) {
    ssize_t n = read(current, buffer, sizeof(buffer));
    if (n < 0 && errno == EINTR) continue;
    if (n < 0) goto done;
    if (n == 0) {
      if (fstat(current, &after) || !S_ISREG(after.st_mode)) goto done;
      int stable = same_stat(&before, &after);
      if (backup) {
        if (fstat(parent, &parent_after)) goto done;
        stable = stable && S_ISDIR(parent_after.st_mode) && parent_after.st_nlink &&
          parent_before.st_dev == parent_after.st_dev && parent_before.st_ino == parent_after.st_ino;
      }
      if (status_line(stable ? "stable" : "changed", &after, backup ? &parent_after : NULL)) goto done;
      result = 0; break;
    }
    if (write_all(1, buffer, (size_t)n)) goto done;
  }
done:
  if (file >= 0) close(file);
  if (current >= 0) close(current);
  if (parent >= 0) close(parent);
  free(copy);
  return result;
#endif
}
