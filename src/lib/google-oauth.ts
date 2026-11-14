import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getDb } from "@/lib/db";

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
const GOOGLE_CALLBACK_PATH = "/auth/google/callback";

const oauthCookieNames = {
  state:
    process.env.NODE_ENV === "production"
      ? "__Host-leecom-google-state"
      : "leecom-google-state",
  nonce:
    process.env.NODE_ENV === "production"
      ? "__Host-leecom-google-nonce"
      : "leecom-google-nonce",
  verifier:
    process.env.NODE_ENV === "production"
      ? "__Host-leecom-google-verifier"
      : "leecom-google-verifier",
};

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type GoogleProfile = {
  subject: string;
  email: string;
  name: string;
};

export function getGoogleOAuthConfig(): GoogleOAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUriValue = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUriValue) {
    throw new Error(
      "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.",
    );
  }

  let redirectUri: URL;
  try {
    redirectUri = new URL(redirectUriValue);
  } catch {
    throw new Error("GOOGLE_REDIRECT_URI must be an absolute URL.");
  }

  const isLocalDevelopmentUrl =
    process.env.NODE_ENV !== "production" &&
    redirectUri.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(redirectUri.hostname);
  if (
    (redirectUri.protocol !== "https:" && !isLocalDevelopmentUrl) ||
    redirectUri.pathname !== GOOGLE_CALLBACK_PATH ||
    redirectUri.search ||
    redirectUri.hash
  ) {
    throw new Error(
      `GOOGLE_REDIRECT_URI must use HTTPS and end with ${GOOGLE_CALLBACK_PATH} (HTTP localhost is allowed in development).`,
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri: redirectUri.href,
  };
}

export function createOAuthSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function getOAuthCookieNames() {
  return oauthCookieNames;
}

export function createCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function secretsMatch(actual: string | undefined, expected: string) {
  if (!actual || actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export async function verifyGoogleIdToken(
  idToken: string,
  expectedNonce: string,
  clientId: string,
): Promise<GoogleProfile> {
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    algorithms: ["RS256"],
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: clientId,
  });

  if (
    payload.nonce !== expectedNonce ||
    typeof payload.sub !== "string" ||
    payload.sub.length === 0 ||
    payload.sub.length > 255 ||
    typeof payload.email !== "string" ||
    payload.email_verified !== true
  ) {
    throw new Error("Google ID token is missing verified identity claims.");
  }

  const email = payload.email.trim().toLowerCase();
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error("Google ID token contains an invalid email address.");
  }

  const displayName =
    typeof payload.name === "string" && payload.name.trim()
      ? payload.name.trim()
      : email.slice(0, email.indexOf("@"));

  return {
    subject: payload.sub,
    email,
    name: Array.from(displayName).slice(0, 80).join(""),
  };
}

interface OAuthUserRow extends RowDataPacket {
  user_id: number;
}

interface UserRow extends RowDataPacket {
  id: number;
}

function isDuplicateEntry(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ER_DUP_ENTRY"
  );
}

export async function resolveGoogleUser(profile: GoogleProfile): Promise<number> {
  const connection = await getDb().getConnection();
  try {
    await connection.beginTransaction();

    const [accountRows] = await connection.execute<OAuthUserRow[]>(
      `SELECT user_id FROM oauth_accounts
       WHERE provider = 'google' AND provider_subject = ?
       LIMIT 1 FOR UPDATE`,
      [profile.subject],
    );

    let userId: number;
    if (accountRows[0]) {
      userId = accountRows[0].user_id;
    } else {
      const [userRows] = await connection.execute<UserRow[]>(
        "SELECT id FROM users WHERE email = ? LIMIT 1 FOR UPDATE",
        [profile.email],
      );

      if (userRows[0]) {
        userId = userRows[0].id;
      } else {
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO users (name, email, password_hash, role)
           VALUES (?, ?, NULL, 'customer')`,
          [profile.name, profile.email],
        );
        userId = result.insertId;
      }

      await connection.execute(
        `INSERT INTO oauth_accounts (user_id, provider, provider_subject)
         VALUES (?, 'google', ?)`,
        [userId, profile.subject],
      );
    }

    await connection.commit();
    return userId;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error("Google account transaction rollback failed:", rollbackError);
    }

    if (isDuplicateEntry(error)) {
      const [rows] = await getDb().execute<OAuthUserRow[]>(
        `SELECT user_id FROM oauth_accounts
         WHERE provider = 'google' AND provider_subject = ?
         LIMIT 1`,
        [profile.subject],
      );
      if (rows[0]) {
        return rows[0].user_id;
      }
    }

    throw error;
  } finally {
    connection.release();
  }
}
