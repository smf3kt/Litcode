/*
 * Connected Unix-socket peer identity for the same-host session transport.
 *
 * A socket pathname and a process record are claims; only the kernel knows who
 * is on the other end of a connected socket. This addon exposes that lookup:
 * LOCAL_PEERPID/LOCAL_PEEREPID for the peer pid, getpeereid for uid/gid. It
 * never writes to the socket and never mutates the target process.
 *
 * Ported from the feasibility fixture
 * (c7.1Vy1UK/peer.c; NAPI 8, macOS arm64, Node 22/26 verified). The shape is
 * kept: one exported function taking a nonnegative integer fd and returning an
 * object of errno/identity fields. Every syscall failure is reported as its
 * errno rather than thrown, except an argument that is not a connected Unix
 * socket: that is a caller bug, not a peer property.
 */
#include <node_api.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <sys/ucred.h>
#include <unistd.h>
#include <errno.h>
#include <limits.h>
#include <math.h>

static void field(napi_env env, napi_value obj, const char *key, int value) {
  napi_value v;
  if (napi_create_int32(env, value, &v) == napi_ok) napi_set_named_property(env, obj, key, v);
}

static napi_value peer(napi_env env, napi_callback_info info) {
  napi_value args[1], out;
  size_t count = 1;
  double value;
  struct sockaddr_un address;
  socklen_t length = sizeof(address);
  napi_get_cb_info(env, info, &count, args, NULL, NULL);
  if (count != 1 || napi_get_value_double(env, args[0], &value) != napi_ok ||
      !isfinite(value) || value < 0 || value > INT_MAX || floor(value) != value) {
    napi_throw_type_error(env, "FD", "Expected nonnegative integer fd");
    return NULL;
  }
  int fd = (int)value;
  if (getpeername(fd, (struct sockaddr *)&address, &length) || address.sun_family != AF_UNIX) {
    napi_throw_error(env, "SOCKET", "Expected connected Unix socket");
    return NULL;
  }
  if (napi_create_object(env, &out) != napi_ok) return NULL;
  pid_t pid = -1;
  length = sizeof(pid);
  int rc = getsockopt(fd, SOL_LOCAL, LOCAL_PEERPID, &pid, &length);
  field(env, out, "pidErrno", rc ? errno : 0);
  field(env, out, "pid", pid);
  field(env, out, "pidBytes", length);
  pid = -1;
  length = sizeof(pid);
  rc = getsockopt(fd, SOL_LOCAL, LOCAL_PEEREPID, &pid, &length);
  field(env, out, "effectivePidErrno", rc ? errno : 0);
  field(env, out, "effectivePid", pid);
  uid_t uid = (uid_t)-1;
  gid_t gid = (gid_t)-1;
  rc = getpeereid(fd, &uid, &gid);
  field(env, out, "uidErrno", rc ? errno : 0);
  field(env, out, "uid", (int)uid);
  field(env, out, "gid", (int)gid);
  struct xucred cred = {0};
  length = sizeof(cred);
  rc = getsockopt(fd, SOL_LOCAL, LOCAL_PEERCRED, &cred, &length);
  field(env, out, "credErrno", rc ? errno : 0);
  field(env, out, "credUid", (int)cred.cr_uid);
  field(env, out, "credVersion", (int)cred.cr_version);
  return out;
}

static napi_value init(napi_env env, napi_value exports) {
  napi_value fn;
  napi_create_function(env, "peer", NAPI_AUTO_LENGTH, peer, NULL, &fn);
  napi_set_named_property(env, exports, "peer", fn);
  return exports;
}

NAPI_MODULE(peer, init)
