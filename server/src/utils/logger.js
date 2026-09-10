const REDACT_KEYS = new Set(["licenseKey", "token", "pepper", "password", "dbPassword"]);

function redactValue(key, value) {
  if (REDACT_KEYS.has(key)) {
    return "***";
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return redactObject(value);
  }
  return value;
}

export function redactObject(obj = {}) {
  return Object.fromEntries(Object.entries(obj).map(([key, value]) => [key, redactValue(key, value)]));
}

export function logEvent(level, event, fields = {}) {
  const line = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...redactObject(fields)
  };
  console.log(JSON.stringify(line));
}
