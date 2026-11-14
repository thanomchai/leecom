import bcrypt from "bcryptjs";
import mysql from "mysql2/promise";

const host = process.env.DB_HOST ?? "127.0.0.1";
const port = Number(process.env.DB_PORT ?? 3307);
const user = process.env.DB_USER ?? "root";
const password = process.env.DB_PASSWORD;
const database = process.env.DB_NAME ?? "leecom";
const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const adminName = (process.env.ADMIN_NAME ?? "LeeCom Admin").trim();
const adminPassword = process.env.ADMIN_PASSWORD;

if (password === undefined) {
  throw new Error("Set DB_PASSWORD before creating the admin account.");
}
if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
  throw new Error("Set a valid ADMIN_EMAIL environment variable.");
}
if (adminPassword === undefined || adminPassword.length < 12) {
  throw new Error("ADMIN_PASSWORD must contain at least 12 characters.");
}
if (Buffer.byteLength(adminPassword, "utf8") > 72) {
  throw new Error("ADMIN_PASSWORD must be no more than 72 bytes.");
}
if (adminName.length < 2 || adminName.length > 80) {
  throw new Error("ADMIN_NAME must contain between 2 and 80 characters.");
}
if (!/^[A-Za-z0-9_]+$/.test(database)) {
  throw new Error("DB_NAME may contain only letters, numbers, and underscores.");
}

const passwordHash = await bcrypt.hash(adminPassword, 12);
const connection = await mysql.createConnection({
  host,
  port,
  user,
  password,
  database,
  charset: "utf8mb4",
});

try {
  await connection.execute(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES (?, ?, ?, 'admin')
     ON DUPLICATE KEY UPDATE
       name = ?, password_hash = ?, role = 'admin'`,
    [
      adminName,
      adminEmail,
      passwordHash,
      adminName,
      passwordHash,
    ],
  );
  console.log(`Admin account is ready for ${adminEmail}.`);
} finally {
  await connection.end();
}
