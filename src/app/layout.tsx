import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/app/components/site-header";
import { Geist, Geist_Mono } from "next/font/google";
import "@fontsource-variable/noto-sans-thai";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "LeeCom | ร้านคอมพิวเตอร์",
    template: "%s | LeeCom",
  },
  description: "เลือกซื้อคอมพิวเตอร์และอุปกรณ์คุณภาพที่ LeeCom",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <div className="app-shell">
          <SiteHeader />
          {children}
          <footer className="site-footer">
            <div className="footer-inner">
              <Link aria-label="LeeCom หน้าหลัก" className="footer-brand" href="/">
                <span aria-hidden="true" className="brand-mark">
                  L
                </span>
                <span>LeeCom</span>
              </Link>
              <p>คอมพิวเตอร์คุณภาพ เพื่อทุกวันที่ดีกว่า</p>
              <span>© LeeCom</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
