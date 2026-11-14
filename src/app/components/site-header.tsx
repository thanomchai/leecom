import Link from "next/link";
import { Suspense } from "react";
import { AccountMenu } from "@/app/components/account-menu";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Link aria-label="LeeCom หน้าหลัก" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark">
            L
          </span>
          <span>
            <strong>LeeCom</strong>
            <small>COMPUTER STORE</small>
          </span>
        </Link>
        <nav aria-label="เมนูหลัก" className="main-nav">
          <Link href="/">หน้าร้าน</Link>
          <Link href="/#products">สินค้า</Link>
        </nav>
        <Suspense
          fallback={<div aria-label="กำลังโหลดบัญชี" className="account-skeleton" />}
        >
          <AccountMenu />
        </Suspense>
      </div>
    </header>
  );
}
