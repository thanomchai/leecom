"use client";

import { useSearchParams } from "next/navigation";

export function GoogleOAuthNotice() {
  const searchParams = useSearchParams();
  const status = searchParams.get("oauth");
  let message: string | null = null;

  switch (status) {
    case "unavailable":
      message = "การเข้าสู่ระบบด้วย Google ยังไม่พร้อม กรุณาตรวจสอบการตั้งค่าระบบ";
      break;
    case "cancelled":
      message = "ยกเลิกการเข้าสู่ระบบด้วย Google แล้ว";
      break;
    case "failed":
      message = "เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
      break;
  }

  if (!message) {
    return null;
  }

  return (
    <p className="form-message form-error" role="alert">
      {message}
    </p>
  );
}
