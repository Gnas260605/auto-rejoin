#!/usr/bin/env node
import { spawn } from "node:child_process";

const child = spawn(process.execPath, ["--test", "tests/mysql.integration.test.js"], {
  stdio: "inherit",
  env: {
    ...process.env,
    MYSQL_INTEGRATION_TEST: "1"
  }
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
