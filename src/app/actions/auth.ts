"use server";

import bcrypt from "bcryptjs";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, deleteCurrentSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export type AuthState = {
  error?: string;
};

const registrationSchema = z.object({
  name: z.string().trim().min(2, "กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร").max(80),
  email: z.email("กรุณากรอกอีเมลให้ถูกต้อง").trim().max(254),
  password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร").max(72),
});

const loginSchema = z.object({
  email: z.email("กรุณากรอกอีเมลให้ถูกต้อง").trim().max(254),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน").max(72),
});

function formString(data: FormData, key: string): string {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
}

export async function registerAction(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = registrationSchema.safeParse({
    name: formString(formData, "name"),
    email: formString(formData, "email").toLowerCase(),
    password: formString(formData, "password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "กรุณาตรวจสอบข้อมูล" };
  }
  if (Buffer.byteLength(parsed.data.password, "utf8") > 72) {
    return { error: "รหัสผ่านต้องมีขนาดไม่เกิน 72 ไบต์" };
  }

  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const [result] = await getDb().execute<ResultSetHeader>(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES (?, ?, ?, 'customer')`,
      [
        parsed.data.name,
        parsed.data.email,
        passwordHash,
      ],
    );
    await createSession(result.insertId);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ER_DUP_ENTRY"
    ) {
      return { error: "อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบ" };
    }
    console.error("Registration failed:", error);
    return { error: "สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }

  redirect("/");
}

interface LoginRow extends RowDataPacket {
  id: number;
  password_hash: string | null;
}

export async function loginAction(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formString(formData, "email").toLowerCase(),
    password: formString(formData, "password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "กรุณาตรวจสอบข้อมูล" };
  }
  if (Buffer.byteLength(parsed.data.password, "utf8") > 72) {
    return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
  }

  let user: LoginRow | undefined;
  try {
    const [rows] = await getDb().execute<LoginRow[]>(
      "SELECT id, password_hash FROM users WHERE email = ? LIMIT 1",
      [parsed.data.email],
    );
    user = rows[0];
    if (
      !user ||
      !user.password_hash ||
      !(await bcrypt.compare(parsed.data.password, user.password_hash))
    ) {
      return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };
    }
    await createSession(user.id);
  } catch (error) {
    console.error("Login failed:", error);
    return { error: "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }

  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await deleteCurrentSession();
  redirect("/");
}
