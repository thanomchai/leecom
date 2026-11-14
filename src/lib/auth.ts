import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getDb } from "@/lib/db";

const SESSION_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Host-leecom-session"
    : "leecom-session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type UserRole = "customer" | "admin";

export type PublicUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
};

interface UserRow extends RowDataPacket, PublicUser {}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  await getDb().execute(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
    [hashToken(token), userId, expiresAt],
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return null;
  }

  await connection();
  const [rows] = await getDb().execute<UserRow[]>(
    `SELECT u.id, u.name, u.email, u.role
     FROM sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP(3)
     LIMIT 1`,
    [hashToken(token)],
  );

  return rows[0] ?? null;
}

export async function requireUser(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireAdmin(): Promise<PublicUser> {
  const user = await requireUser();
  if (user.role !== "admin") {
    redirect("/");
  }
  return user;
}

export async function deleteCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
    await getDb().execute("DELETE FROM sessions WHERE token_hash = ?", [
      hashToken(token),
    ]);
  }

  cookieStore.delete(SESSION_COOKIE);
}
