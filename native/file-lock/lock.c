#include <node_api.h>
#include <sys/file.h>
#include <errno.h>
#include <stdint.h>
#include <string.h>

static napi_value lock_fd(napi_env env, napi_callback_info info) {
  napi_value args[2], result;
  size_t count = 2;
  int32_t fd;
  bool wait;
  napi_get_cb_info(env, info, &count, args, NULL, NULL);
  if (count != 2 || napi_get_value_int32(env, args[0], &fd) != napi_ok || fd < 0 ||
      napi_get_value_bool(env, args[1], &wait) != napi_ok) {
    napi_throw_type_error(env, NULL, "Expected fd and wait flag");
    return NULL;
  }
  int rc;
  do { rc = flock(fd, LOCK_EX | (wait ? 0 : LOCK_NB)); } while (rc && errno == EINTR);
  int error = rc ? errno : 0;
  if (error && error != EWOULDBLOCK && error != EAGAIN) {
    napi_throw_error(env, "FLOCK_FAILED", strerror(error));
    return NULL;
  }
  napi_get_boolean(env, !rc, &result);
  return result;
}

static napi_value init(napi_env env, napi_value exports) {
  napi_value fn;
  napi_create_function(env, "lock", NAPI_AUTO_LENGTH, lock_fd, NULL, &fn);
  napi_set_named_property(env, exports, "lock", fn);
  return exports;
}
NAPI_MODULE(file_lock, init)
