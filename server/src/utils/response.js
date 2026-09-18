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

export function sendSuccess(res, data = {}, status = 200) {
  return res.status(status).json({
    ok: true,
    ...data,
    serverTime: isoNow()
  });
}

export function sendError(res, message, status = 400, code = "BAD_REQUEST", extras = {}) {
  return res.status(status).json({
    ok: false,
    code,
    message,
    ...extras,
    serverTime: isoNow()
  });
}
