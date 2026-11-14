import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import {
  createCodeChallenge,
  createOAuthSecret,
  getGoogleOAuthConfig,
  getOAuthCookieNames,
} from "@/lib/google-oauth";

export async function GET() {
  const cookieStore = await cookies();
  let config;
  try {
    config = getGoogleOAuthConfig();
  } catch (error) {
    console.error("Google OAuth is unavailable:", error);
    redirect("/login?oauth=unavailable");
  }

  const state = createOAuthSecret();
  const nonce = createOAuthSecret();
  const verifier = createOAuthSecret();
  const names = getOAuthCookieNames();
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
  };

  cookieStore.set(names.state, state, cookieOptions);
  cookieStore.set(names.nonce, nonce, cookieOptions);
  cookieStore.set(names.verifier, verifier, cookieOptions);

  const authorizationUrl = new URL(
    "https://accounts.google.com/o/oauth2/v2/auth",
  );
  authorizationUrl.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: createCodeChallenge(verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();

  const response = NextResponse.redirect(authorizationUrl, 302);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
