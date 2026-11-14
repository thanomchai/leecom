import "server-only";
import mysql, { type Pool } from "mysql2/promise";

let pool: Pool | undefined;

export function getDb(): Pool {
  if (!pool) {
    const password = process.env.DB_PASSWORD;
    if (password === undefined) {
      throw new Error("Missing DB_PASSWORD environment variable.");
    }

    pool = mysql.createPool({
      host: process.env.DB_HOST ?? "127.0.0.1",
      port: Number(process.env.DB_PORT ?? 3307),
      user: process.env.DB_USER ?? "root",
      password,
      database: process.env.DB_NAME ?? "leecom",
      connectionLimit: 10,
      charset: "utf8mb4",
      timezone: "Z",
    });
    pool.pool.on("connection", (connection) => {
      connection.query("SET time_zone = '+00:00'", (error) => {
        if (error) {
          console.error("Failed to set MySQL session timezone to UTC:", error);
          connection.destroy();
        }
      });
    });
  }

  return pool;
}
