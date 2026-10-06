import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();

// PM2 cluster đặt exec_mode=cluster_mode. Rate limit đang lưu trong bộ nhớ từng process nên sẽ bị nhân lên.
if (process.env.exec_mode === "cluster_mode") {
  console.warn(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "warn",
    event: "rate_limit_per_process",
    message: "Running in PM2 cluster mode: in-memory rate limits are per process. Use instances: 1 (ecosystem.config.cjs)."
  }));
}

app.listen(env.port, () => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "info",
    event: "server_started",
    port: env.port
  }));
});
