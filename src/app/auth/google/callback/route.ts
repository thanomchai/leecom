import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import {
  getGoogleOAuthConfig,
  getOAuthCookieNames,
  resolveGoogleUser,
  secretsMatch,
  verifyGoogleIdToken,
} from "@/lib/google-oauth";
import { createSession } from "@/lib/auth";

function redirectToLogin(redirectUri: string, status: string) {
  const response = NextResponse.redirect(
    new URL(`/login?oauth=${status}`, redirectUri),
    303,
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  let config;
  try {
    config = getGoogleOAuthConfig();
  } catch (error) {
    console.error("Google OAuth callback is unavailable:", error);
    redirect("/login?oauth=unavailable");
  }

  const callbackUrl = new URL(request.url);
  const names = getOAuthCookieNames();
  const stateCookie = cookieStore.get(names.state)?.value;
  const nonceCookie = cookieStore.get(names.nonce)?.value;
  const verifierCookie = cookieStore.get(names.verifier)?.value;
  cookieStore.delete(names.state);
  cookieStore.delete(names.nonce);
  cookieStore.delete(names.verifier);

  const stateValues = callbackUrl.searchParams.getAll("state");
  if (
    stateValues.length !== 1 ||
    !secretsMatch(stateValues[0], stateCookie ?? "")
  ) {
    return redirectToLogin(config.redirectUri, "failed");
  }

  if (callbackUrl.searchParams.has("error")) {
    return redirectToLogin(config.redirectUri, "cancelled");
  }

  const codeValues = callbackUrl.searchParams.getAll("code");
  if (
    codeValues.length !== 1 ||
    codeValues[0].length === 0 ||
    codeValues[0].length > 2048 ||
    !nonceCookie ||
    !verifierCookie
  ) {
    return redirectToLogin(config.redirectUri, "failed");
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: codeValues[0],
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
        code_verifier: verifierCookie,
      }),
      cache: "no-store",
    });

    if (!tokenResponse.ok) {
      throw new Error(
        `Google token exchange failed with status ${tokenResponse.status}.`,
      );
    }

    const tokenBody: unknown = await tokenResponse.json();
    if (
      typeof tokenBody !== "object" ||
      tokenBody === null ||
      !("id_token" in tokenBody) ||
      typeof tokenBody.id_token !== "string"
    ) {
      throw new Error("Google token response did not contain an ID token.");
    }

    const profile = await verifyGoogleIdToken(
      tokenBody.id_token,
      nonceCookie,
      config.clientId,
    );
    const userId = await resolveGoogleUser(profile);
    await createSession(userId);

    const response = NextResponse.redirect(new URL("/", config.redirectUri), 303);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Google OAuth callback failed:", error);
    return redirectToLogin(config.redirectUri, "failed");
  }
}
