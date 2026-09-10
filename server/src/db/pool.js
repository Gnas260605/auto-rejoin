import mysql from "mysql2/promise";
import { env } from "../config/env.js";

let pool;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: true,
      timezone: "Z"
    });
  }
  return pool;
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
