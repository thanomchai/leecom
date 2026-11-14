import Link from "next/link";

export function PaymentReviewNavigation({
  active,
}: {
  active: "pending" | "history";
}) {
  return (
    <nav aria-label="เมนูตรวจสอบการชำระเงิน" className="payment-review-tabs">
      <Link
        aria-current={active === "pending" ? "page" : undefined}
        className={active === "pending" ? "active" : ""}
        href="/admin/payments"
      >
        รอตรวจ
      </Link>
      <Link
        aria-current={active === "history" ? "page" : undefined}
        className={active === "history" ? "active" : ""}
        href="/admin/payments/history"
      >
        ประวัติ
      </Link>
    </nav>
  );
}
