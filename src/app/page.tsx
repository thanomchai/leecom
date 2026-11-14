import { Suspense } from "react";
import Link from "next/link";
import { ProductList } from "@/app/components/product-list";

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div aria-hidden="true" className="hero-orb hero-orb-one" />
        <div aria-hidden="true" className="hero-orb hero-orb-two" />
        <div className="hero-content">
          <p className="hero-kicker">
            <span className="hero-kicker-dot" />
            ร้านคอมพิวเตอร์ที่คุณวางใจ
          </p>
          <h1>
            เทคโนโลยีที่ใช่
            <br />
            <span>ในราคาที่ชอบ</span>
          </h1>
          <p className="hero-description">
            คัดสรรคอมพิวเตอร์และอุปกรณ์คุณภาพ พร้อมให้คุณไปได้ไกลกว่าเดิม
          </p>
          <Link className="button hero-button" href="#products">
            เลือกชมสินค้า <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div aria-hidden="true" className="hero-visual">
          <div className="hero-visual-glow" />
          <div className="hero-device hero-monitor">
            <div className="monitor-screen">
              <span className="screen-line screen-line-short" />
              <span className="screen-line" />
              <span className="screen-line screen-line-medium" />
              <span className="screen-shape" />
            </div>
            <div className="monitor-neck" />
            <div className="monitor-base" />
          </div>
          <div className="hero-device hero-case">
            <span className="case-glow" />
            <span className="case-fan case-fan-one" />
            <span className="case-fan case-fan-two" />
          </div>
          <span className="hero-spark hero-spark-one">✦</span>
          <span className="hero-spark hero-spark-two">✧</span>
        </div>
      </section>

      <section className="store-section" id="products">
        <div className="section-heading">
          <div>
            <p className="eyebrow">LEECOM SELECTION</p>
            <h2>สินค้าของเรา</h2>
            <p className="section-description">
              อุปกรณ์คอมพิวเตอร์คัดคุณภาพ พร้อมตอบโจทย์ทุกการใช้งาน
            </p>
          </div>
          <span className="section-note">
            <span aria-hidden="true" className="availability-dot" />
            อัปเดตสินค้าและสต็อกแล้ว
          </span>
        </div>
        <Suspense fallback={<div className="loading-grid">กำลังโหลดสินค้า...</div>}>
          <ProductList />
        </Suspense>
      </section>
    </main>
  );
}
