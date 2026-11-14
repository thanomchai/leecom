"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useActionState } from "react";
import { loginAction, registerAction } from "@/app/actions/auth";
import type { AuthState } from "@/app/actions/auth";
import { GoogleOAuthNotice } from "@/app/components/google-oauth-notice";

type AuthMode = "login" | "register";

export function AuthForm({ mode }: { mode: AuthMode }) {
  const action = mode === "login" ? loginAction : registerAction;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    {},
  );
  const isRegister = mode === "register";

  return (
    <section className="auth-card">
      <div aria-hidden="true" className="auth-icon">
        {isRegister ? "✦" : "↗"}
      </div>
      <p className="eyebrow">{isRegister ? "เริ่มต้นกับเรา" : "ยินดีต้อนรับกลับ"}</p>
      <h1>{isRegister ? "สร้างบัญชี LeeCom" : "เข้าสู่ระบบ"}</h1>
      <p className="auth-description">
        {isRegister
          ? "สมัครสมาชิกเพื่อรับประสบการณ์เลือกซื้อที่ดียิ่งขึ้น"
          : "เข้าสู่ระบบเพื่อใช้งานบัญชี LeeCom ของคุณ"}
      </p>

      <form action={formAction} className="auth-form">
        {isRegister ? (
          <label>
            ชื่อที่ใช้แสดง
            <input
              autoComplete="name"
              maxLength={80}
              minLength={2}
              name="name"
              placeholder="ชื่อของคุณ"
              required
            />
          </label>
        ) : null}
        <label>
          อีเมล
          <input
            autoComplete="email"
            maxLength={254}
            name="email"
            placeholder="you@example.com"
            required
            type="email"
          />
        </label>
        <label>
          รหัสผ่าน
          <input
            autoComplete={isRegister ? "new-password" : "current-password"}
            maxLength={72}
            minLength={isRegister ? 8 : undefined}
            name="password"
            placeholder={isRegister ? "อย่างน้อย 8 ตัวอักษร" : "รหัสผ่านของคุณ"}
            required
            type="password"
          />
        </label>
        {state.error ? (
          <p className="form-message form-error" role="alert">
            {state.error}
          </p>
        ) : null}
        <button className="button auth-submit" disabled={pending} type="submit">
          {pending
            ? "กำลังดำเนินการ..."
            : isRegister
              ? "สมัครสมาชิก"
              : "เข้าสู่ระบบ"}
        </button>
      </form>
      <div aria-hidden="true" className="auth-divider">
        <span>หรือ</span>
      </div>
      <a className="google-auth-button" href="/auth/google">
        <span aria-hidden="true" className="google-auth-mark">
          G
        </span>
        ดำเนินการต่อด้วย Google
      </a>
      <Suspense fallback={null}>
        <GoogleOAuthNotice />
      </Suspense>
      <p className="auth-switch">
        {isRegister ? "มีบัญชีอยู่แล้ว?" : "ยังไม่มีบัญชี?"}{" "}
        <Link href={isRegister ? "/login" : "/register"}>
          {isRegister ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
        </Link>
      </p>
    </section>
  );
}
