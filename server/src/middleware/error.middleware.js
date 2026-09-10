import { errorResponse } from "../utils/response.js";
import { logEvent } from "../utils/logger.js";

export function notFoundMiddleware(_req, res) {
  res.status(404).json(errorResponse("NOT_FOUND", "Not found"));
}

export function errorMiddleware(error, req, res, _next) {
  if (error.type === "entity.parse.failed" || error.type === "entity.too.large") {
    res.status(400).json(errorResponse("INVALID_REQUEST", "Invalid JSON request body"));
    return;
  }

  logEvent("error", "request_failed", {
    requestId: req.id,
    method: req.method,
    path: req.path,
    message: error.message
  });
  const body = errorResponse("SERVER_ERROR", "Internal server error");
  if (process.env.NODE_ENV === "development") {
    body.developmentMessage = error.message;
  }
  res.status(500).json(body);
}
