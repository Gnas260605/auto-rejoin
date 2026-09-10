import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { env } from "../config/env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "migrations");

async function ensureMigrationsTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      applied_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

function splitSql(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function runMigrations() {
  const connection = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    multipleStatements: false,
    timezone: "Z"
  });

  try {
    await ensureMigrationsTable(connection);
    const [appliedRows] = await connection.execute("SELECT filename FROM schema_migrations");
    const applied = new Set(appliedRows.map((row) => row.filename));
    const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();

    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }
      const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
      await connection.beginTransaction();
      try {
        for (const statement of splitSql(sql)) {
          await connection.query(statement);
        }
        await connection.execute(
          "INSERT INTO schema_migrations (filename, applied_at) VALUES (?, UTC_TIMESTAMP())",
          [file]
        );
        await connection.commit();
        console.log(`Applied migration ${file}`);
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }
  } finally {
    await connection.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runMigrations().catch((error) => {
    console.error(`Migration failed: ${error.message}`);
    process.exit(1);
  });
}
