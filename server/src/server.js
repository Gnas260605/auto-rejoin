import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();

app.listen(env.port, () => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "info",
    event: "server_started",
    port: env.port
  }));
});
