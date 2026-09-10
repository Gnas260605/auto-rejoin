#!/usr/bin/env python3
import json
import sys


def read_input(args):
    files = [a for a in args if not a.startswith("-") and a not in ("empty",) and not a.startswith(".") and a not in ("{licenseKey:$licenseKey, installationId:$installationId, clientVersion:$clientVersion, device:$device}", "{installationId:$installationId, clientVersion:$clientVersion, token:$token}", "{installationId:$installationId, token:$token}") and not a.startswith("{\n")]
    if files:
        try:
            with open(files[-1], "r", encoding="utf-8") as fh:
                return fh.read()
        except OSError:
            return ""
    return sys.stdin.read()


def first_filter(args):
    for arg in args:
        if arg.startswith("-"):
            continue
        return arg
    return "."


def parse_vars(args):
    out = {}
    i = 0
    while i < len(args):
        if args[i] == "--arg" and i + 2 < len(args):
            out[args[i + 1]] = args[i + 2]
            i += 3
        elif args[i] == "--argjson" and i + 2 < len(args):
            out[args[i + 1]] = json.loads(args[i + 2])
            i += 3
        else:
            i += 1
    return out


def select(data, filt):
    defaults = {
        '.valid // false': data.get("valid", False),
        '.code // "SERVER_ERROR"': data.get("code", "SERVER_ERROR"),
        '.code // .error.code // "SERVER_ERROR"': data.get("code", (data.get("error") or {}).get("code", "SERVER_ERROR")),
        '.message // .error // "License request failed"': data.get("message", data.get("error", "License request failed")),
        '.message // .error.message // .error // "License request failed"': data.get("message", (data.get("error") or {}).get("message", data.get("error", "License request failed"))),
        '.licenseId // ""': data.get("licenseId", ""),
        '.plan // "free"': data.get("plan", "free"),
        '.expiresAt // ""': data.get("expiresAt", ""),
        '.maxInstances // 1': data.get("maxInstances", 1),
        '.token // ""': data.get("token", ""),
        '.revalidateAfter // 3600': data.get("revalidateAfter", 3600),
        '.serverTime // ""': data.get("serverTime", ""),
        '.status // "NOT_ACTIVATED"': data.get("status", "NOT_ACTIVATED"),
        '.lastValidatedAt // 0': data.get("lastValidatedAt", 0),
        '.deactivated // .valid // false': data.get("deactivated", data.get("valid", False)),
        '.maintenance.enabled // false': (data.get("maintenance") or {}).get("enabled", False),
        '.maintenance.allowCachedEntitlements // false': (data.get("maintenance") or {}).get("allowCachedEntitlements", False),
        '.maintenance.message // ""': (data.get("maintenance") or {}).get("message", ""),
        '.schemaVersion // empty': data.get("schemaVersion", ""),
        '.version // empty': data.get("version", ""),
        '.channel // empty': data.get("channel", ""),
        '.artifact.url // empty': (data.get("artifact") or {}).get("url", ""),
        '.artifact.sha256 // empty': (data.get("artifact") or {}).get("sha256", ""),
        '.artifact.size // empty': (data.get("artifact") or {}).get("size", ""),
        '.mandatory // false': data.get("mandatory", False),
        '.minimumVersion // empty': data.get("minimumVersion", ""),
        '.notesUrl // empty': data.get("notesUrl", ""),
    }
    if filt == ".features // [] | join(\",\")":
        return ",".join(data.get("features") or [])
    return defaults.get(filt, "")


def main():
    args = sys.argv[1:]
    if "empty" in args:
        json.loads(read_input(args))
        return
    if "-n" in args:
        values = parse_vars(args)
        if "licenseKey" in values:
            print(json.dumps({
                "licenseKey": values["licenseKey"],
                "installationId": values["installationId"],
                "clientVersion": values["clientVersion"],
                "device": values["device"],
            }))
        elif "status" in values:
            features = [f for f in values.get("features", "").split(",") if f]
            print(json.dumps({
                "status": values.get("status", "NOT_ACTIVATED"),
                "licenseId": values.get("licenseId", ""),
                "plan": values.get("plan", "free"),
                "expiresAt": values.get("expiresAt", ""),
                "maxInstances": int(values.get("maxInstances") or 1),
                "features": features,
                "token": values.get("token", ""),
                "serverTime": values.get("serverTime", ""),
                "maintenance": {
                    "enabled": values.get("maintenanceEnabled") == "true",
                    "allowCachedEntitlements": values.get("maintenanceAllowCache") == "true",
                    "message": values.get("maintenanceMessage", ""),
                },
                "lastValidatedAt": int(values.get("lastValidatedAt") or 0),
                "revalidateAfter": int(values.get("revalidateAfter") or 3600),
            }))
        elif "token" in values:
            obj = {"installationId": values.get("installationId", ""), "token": values.get("token", "")}
            if "clientVersion" in values:
                obj["clientVersion"] = values["clientVersion"]
            print(json.dumps(obj))
        elif "platform" in values:
            print(json.dumps({"platform": values.get("platform"), "executor": values.get("executor")}))
        else:
            print("{}")
        return

    filt = first_filter(args)
    if filt.startswith(".") or "|" in filt:
        data = json.loads(read_input(args))
        value = select(data, filt)
        if isinstance(value, bool):
            print("true" if value else "false")
        else:
            print(value)


if __name__ == "__main__":
    main()
