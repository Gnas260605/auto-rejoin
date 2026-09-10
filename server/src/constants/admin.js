export const ADMIN_ROLES = Object.freeze({
  ADMIN: "admin",
  SUPER_ADMIN: "super_admin"
});

export const ADMIN_STATUSES = Object.freeze({
  ACTIVE: "active",
  DISABLED: "disabled"
});

export const ADMIN_COOKIE_NAME = "admin_token";

export const ADMIN_AUDIT_ACTIONS = Object.freeze({
  ADMIN_LOGIN_SUCCESS: "admin_login_success",
  ADMIN_LOGIN_FAILED: "admin_login_failed",
  ADMIN_LOGOUT: "admin_logout",
  LICENSE_CREATED: "license_created",
  LICENSE_UPDATED: "license_updated",
  LICENSE_EXTENDED: "license_extended",
  LICENSE_SUSPENDED: "license_suspended",
  LICENSE_REACTIVATED: "license_reactivated",
  LICENSE_REVOKED: "license_revoked",
  DEVICE_REVOKED: "device_revoked",
  DEVICE_RESET: "device_reset"
});
