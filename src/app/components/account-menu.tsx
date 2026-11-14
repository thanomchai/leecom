import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth";

export async function AccountMenu() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="account-actions">
        <Link className="login-link" href="/login">
          เข้าสู่ระบบ
        </Link>
        <Link className="button button-small" href="/register">
          สมัครสมาชิก
        </Link>
      </div>
    );
  }

  return (
    <div className="account-actions">
      <span className="account-name">
        สวัสดี, {user.name}
      </span>
      <div
        className={`member-links${user.role === "admin" ? " member-links-admin" : ""}`}
      >
        {user.role === "admin" ? (
          <>
            <Link href="/admin/productls">จัดการสินค้า</Link>
            <Link href="/admin/payments">ตรวจสลิป</Link>
            <Link href="/admin/transactions">สรุปธุรกรรม</Link>
          </>
        ) : (
          <>
            <Link href="/cart">ตะกร้า</Link>
            <Link href="/orders">คำสั่งซื้อ</Link>
          </>
        )}
      </div>
      <form action={logoutAction}>
        <button className="login-link logout-button" type="submit">
          ออกจากระบบ
        </button>
      </form>
    </div>
  );
}
