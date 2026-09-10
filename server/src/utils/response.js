import { isoNow } from "./time.js";

export function successResponse(payload = {}) {
  return {
    valid: true,
    ...payload,
    serverTime: payload.serverTime || isoNow()
  };
}

export function errorResponse(code, message, extras = {}) {
  return {
    valid: false,
    code,
    message,
    error: {
      code,
      message
    },
    serverTime: extras.serverTime || isoNow()
  };
}
