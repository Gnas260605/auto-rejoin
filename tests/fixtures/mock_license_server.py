#!/usr/bin/env python3
import json
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer


class Handler(BaseHTTPRequestHandler):
    def _json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        return

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8")
        try:
            data = json.loads(raw or "{}")
        except json.JSONDecodeError:
            self._json(400, {"valid": False, "code": "MALFORMED_REQUEST"})
            return

        if self.path.endswith("/activate"):
            key = data.get("licenseKey")
            if key == "VALID" or key == "AR-ABCD-EFGH-IJKL-1234":
                self._json(200, {
                    "valid": True,
                    "licenseId": "lic_test_123",
                    "plan": "pro",
                    "expiresAt": "2026-12-31T23:59:59Z",
                    "maxInstances": 20,
                    "features": ["monitor", "profiles", "installer", "discord"],
                    "revalidateAfter": 3600,
                    "serverTime": "2026-09-10T00:00:00Z",
                    "token": "tok_test_secret",
                })
            elif key == "EXPIRED":
                self._json(200, {"valid": False, "code": "EXPIRED", "message": "expired"})
            elif key == "REVOKED":
                self._json(200, {"valid": False, "code": "REVOKED", "message": "revoked"})
            elif key == "DEVICE_LIMIT":
                self._json(200, {"valid": False, "code": "DEVICE_LIMIT", "message": "device limit"})
            elif key == "AR-MALF-MALF-MALF-MALF":
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b"{not-json")
            else:
                self._json(200, {"valid": False, "code": "INVALID_KEY", "message": "invalid"})
            return

        if self.path.endswith("/validate"):
            if data.get("token") == "tok_test_secret":
                self._json(200, {
                    "valid": True,
                    "licenseId": "lic_test_123",
                    "plan": "pro",
                    "expiresAt": "2026-12-31T23:59:59Z",
                    "maxInstances": 20,
                    "features": ["monitor", "profiles", "installer", "discord"],
                    "revalidateAfter": 3600,
                    "serverTime": "2026-09-10T00:10:00Z",
                    "token": "tok_test_secret",
                })
            else:
                self._json(200, {"valid": False, "code": "REVOKED", "message": "bad token"})
            return

        if self.path.endswith("/deactivate"):
            if data.get("token") == "tok_test_secret":
                self._json(200, {"deactivated": True})
            else:
                self._json(200, {"deactivated": False, "code": "SERVER_ERROR", "message": "bad token"})
            return

        self._json(404, {"valid": False, "code": "SERVER_ERROR", "message": "not found"})


def main():
    port = int(sys.argv[1])
    HTTPServer(("127.0.0.1", port), Handler).serve_forever()


if __name__ == "__main__":
    main()
