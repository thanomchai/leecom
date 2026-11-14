import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import {
  getAdminTransactions,
  type AdminTransactionFilters,
  type OrderStatus,
} from "@/lib/commerce";
import { bahtFormat, formatThaiDateTime } from "@/lib/presentation";

export const metadata: Metadata = {
  title: "สรุปธุรกรรม",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const orderStatuses: OrderStatus[] = [
  "awaiting_payment",
  "pending_review",
  "paid",
];

function firstParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function statusLabel(status: OrderStatus): string {
  switch (status) {
    case "awaiting_payment":
      return "รอชำระเงิน";
    case "pending_review":
      return "รอตรวจสลิป";
    case "paid":
      return "ชำระแล้ว";
  }
}

function paymentProviderLabel(provider: "manual" | "stripe"): string {
  return provider === "stripe" ? "Stripe PromptPay" : "แนบสลิป (เดโม)";
}

function pageHref(filters: AdminTransactionFilters, page: number): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("q", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  params.set("page", String(page));
  return `/admin/transactions?${params.toString()}`;
}

export default function AdminTransactionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <main className="admin-transactions-page">
      <Suspense fallback={<div className="loading-grid">กำลังโหลดธุรกรรม...</div>}>
        <AdminTransactionsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function AdminTransactionsContent({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const params = await searchParams;
  const rawSearch = firstParam(params.q).trim();
  const rawStatus = firstParam(params.status);
  let from = firstParam(params.from);
  let to = firstParam(params.to);
  let invalidDate = false;

  if (from && !validDate(from)) {
    from = "";
    invalidDate = true;
  }
  if (to && !validDate(to)) {
    to = "";
    invalidDate = true;
  }
  if (from && to && from > to) {
    from = "";
    to = "";
    invalidDate = true;
  }

  const pageValue = firstParam(params.page);
  const requestedPage =
    /^\d+$/.test(pageValue) && Number.isSafeInteger(Number(pageValue))
      ? Math.max(1, Number(pageValue))
      : 1;
  const status = orderStatuses.find((value) => value === rawStatus) ?? "";
  const filters: AdminTransactionFilters = {
    search: rawSearch.slice(0, 100),
    status,
    from,
    to,
    page: requestedPage,
  };
  const result = await getAdminTransactions(filters);

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <p className="eyebrow">LEECOM ADMIN</p>
          <h1>สรุปธุรกรรม</h1>
          <p>รายการคำสั่งซื้อและสถานะการชำระเงินจากข้อมูลปัจจุบัน</p>
        </div>
        <span className="section-note">
          พบ {result.totalCount.toLocaleString("th-TH")} รายการ
        </span>
      </div>

      <form action="/admin/transactions" className="transaction-filters" method="get">
        <label>
          <span>ค้นหา</span>
          <input
            autoComplete="off"
            maxLength={100}
            name="q"
            placeholder="เลขคำสั่งซื้อ ชื่อลูกค้า หรืออีเมล"
            type="search"
            defaultValue={filters.search}
          />
        </label>
        <label>
          <span>สถานะ</span>
          <select defaultValue={filters.status} name="status">
            <option value="">ทุกสถานะ</option>
            <option value="awaiting_payment">รอชำระเงิน</option>
            <option value="pending_review">รอตรวจสลิป</option>
            <option value="paid">ชำระแล้ว</option>
          </select>
        </label>
        <label>
          <span>ตั้งแต่วันที่สั่งซื้อ</span>
          <input defaultValue={filters.from} name="from" type="date" />
        </label>
        <label>
          <span>ถึงวันที่</span>
          <input defaultValue={filters.to} name="to" type="date" />
        </label>
        <div className="transaction-filter-actions">
          <button className="button" type="submit">
            ค้นหา
          </button>
          <Link className="button button-outline" href="/admin/transactions">
            ล้างตัวกรอง
          </Link>
        </div>
      </form>

      {invalidDate ? (
        <p className="transaction-filter-error" role="alert">
          ช่วงวันที่ไม่ถูกต้อง ระบบแสดงรายการโดยไม่ใช้ตัวกรองวันที่
        </p>
      ) : null}

      {result.transactions.length === 0 ? (
        <section className="empty-commerce-state">
          <h2>ไม่พบรายการธุรกรรม</h2>
          <p>ลองเปลี่ยนคำค้นหา สถานะ หรือช่วงวันที่</p>
        </section>
      ) : (
        <>
          <div className="transaction-table-scroll">
            <table className="transaction-table">
              <thead>
                <tr>
                  <th scope="col">คำสั่งซื้อ / ลูกค้า</th>
                  <th scope="col">ยอดเงิน</th>
                  <th scope="col">ช่องทาง</th>
                  <th scope="col">สถานะ</th>
                  <th scope="col">วันเวลาที่เกี่ยวข้อง</th>
                </tr>
              </thead>
              <tbody>
                {result.transactions.map((transaction) => (
                  <tr key={transaction.orderNumber}>
                    <td>
                      <strong>{transaction.orderNumber}</strong>
                      <span>{transaction.customerName}</span>
                      <small>{transaction.customerEmail}</small>
                    </td>
                    <td className="transaction-amount">
                      {bahtFormat.format(transaction.total)}
                    </td>
                    <td>{paymentProviderLabel(transaction.paymentProvider)}</td>
                    <td>
                      <span
                        className={`order-status status-${transaction.status}`}
                      >
                        {statusLabel(transaction.status)}
                      </span>
                    </td>
                    <td className="transaction-dates">
                      <span>
                        <b>สั่งซื้อ</b>
                        {formatThaiDateTime(transaction.createdAt)}
                      </span>
                      {transaction.paidAt ? (
                        <span>
                          <b>ยืนยันชำระ</b>
                          {formatThaiDateTime(transaction.paidAt)}
                        </span>
                      ) : null}
                      {transaction.transferredAt ? (
                        <span>
                          <b>แจ้งโอน</b>
                          {formatThaiDateTime(transaction.transferredAt)}
                        </span>
                      ) : null}
                      {transaction.reviewedAt ? (
                        <span>
                          <b>ตรวจสลิปล่าสุด</b>
                          {formatThaiDateTime(transaction.reviewedAt)}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav aria-label="แบ่งหน้ารายการธุรกรรม" className="transaction-pagination">
            <span>
              หน้า {result.page} / {result.pageCount}
            </span>
            <div>
              {result.page > 1 ? (
                <Link
                  className="button button-outline"
                  href={pageHref(filters, result.page - 1)}
                >
                  ก่อนหน้า
                </Link>
              ) : null}
              {result.page < result.pageCount ? (
                <Link
                  className="button button-outline"
                  href={pageHref(filters, result.page + 1)}
                >
                  ถัดไป
                </Link>
              ) : null}
            </div>
          </nav>
          <p className="transaction-data-note">
            เวลาที่แสดงมาจากข้อมูลคำสั่งซื้อ ได้แก่ เวลาสั่งซื้อ การแจ้งโอน และการตรวจสลิป
            ระบบไม่แสดงข้อมูลลับหรือไฟล์สลิปในหน้านี้
          </p>
        </>
      )}
    </>
  );
}
