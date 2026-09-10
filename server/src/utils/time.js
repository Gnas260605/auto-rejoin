export function nowDate() {
  return new Date();
}

export function isoNow(date = nowDate()) {
  return date.toISOString();
}

export function secondsFromNow(seconds, baseDate = nowDate()) {
  return new Date(baseDate.getTime() + Number(seconds) * 1000);
}

export function mysqlDate(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

export function isExpired(expiresAt, now = nowDate()) {
  if (!expiresAt) {
    return false;
  }
  return new Date(expiresAt).getTime() <= now.getTime();
}
