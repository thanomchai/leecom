# LeeCom

เว็บร้านคอมพิวเตอร์เดโมภาษาไทย สร้างด้วย Next.js, TypeScript และ MySQL รองรับหน้าร้าน
ระบบสมาชิก ตะกร้า checkout ประวัติคำสั่งซื้อ PromptPay ผ่าน Stripe
การแนบสลิปเพื่อรอตรวจสอบ และหน้าจัดการสินค้า
สำหรับผู้ดูแล ใช้ Noto Sans Thai แบบ variable ที่ bundle ไว้กับแอป เพื่อให้แสดงผลภาษาไทย
สม่ำเสมอโดยไม่ต้องพึ่งฟอนต์จาก CDN ภายนอก

## ความต้องการ

- Node.js 20.9 ขึ้นไป
- MySQL ที่เข้าถึงได้จากเครื่องนี้
- บัญชี MySQL ที่สร้างฐานข้อมูลและตารางได้ (ค่าเดโมเริ่มต้นคือ `root` ที่ `127.0.0.1:3307`)

## เริ่มใช้งาน

1. ติดตั้ง dependencies:

   ```powershell
   npm.cmd install
   ```

2. ถ้ายังไม่มี `.env.local` ให้คัดลอก `.env.example` แล้วกำหนดค่าการเชื่อมต่อ
   ฐานข้อมูลให้ตรงกับเครื่อง:

   ```powershell
   if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
   ```

   กำหนด `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` และ `DB_NAME` ใน `.env.local`
   ไฟล์นี้ถูกละเว้นจาก Git และห้าม commit

3. สร้างฐานข้อมูล ตาราง และสินค้าเดโม 6 รายการ:

   ```powershell
   npm.cmd run db:setup
   ```

   สคริปต์สร้างตารางที่ยังไม่มี เติมคอลัมน์ snapshot และข้อมูล Stripe ที่จำเป็นในตารางคำสั่งซื้อ
   สร้างตารางประวัติการตรวจสอบการชำระเงินและ Stripe webhook และเพิ่มเฉพาะสินค้าเดโมที่ยังไม่มีอยู่
   โดยไม่เขียนทับสินค้า ผู้ใช้ คำสั่งซื้อ หรือสต็อกเดิม

4. เริ่มเว็บและเปิด <http://localhost:3000>:

   ```powershell
   npm.cmd run dev
   ```

ใช้ `npm.cmd` ใน PowerShell เพื่อเลี่ยงการถูกบล็อก `npm.ps1` ตาม Execution Policy

## สร้างบัญชีผู้ดูแลสำหรับ Local demo

ตั้งค่า `ADMIN_EMAIL`, `ADMIN_NAME` (ไม่บังคับ) และ `ADMIN_PASSWORD` ใน environment
หรือ `.env.local` แล้วรัน:

```powershell
npm.cmd run db:seed-admin
```

`ADMIN_PASSWORD` ต้องยาวอย่างน้อย 12 ตัวอักษรและไม่เกิน 72 ไบต์ สคริปต์ hash
รหัสผ่านด้วย bcrypt ก่อนบันทึกและไม่แสดงรหัสผ่านในผลลัพธ์ บัญชีที่สมัครจากหน้าเว็บ
จะเป็น `customer` เสมอ การกำหนด role `admin` ทำได้จาก seed script ฝั่งเซิร์ฟเวอร์เท่านั้น

ผู้ดูแลเข้าสู่หน้า [จัดการสินค้า](/admin/productls) และ [ตรวจสอบการชำระเงิน](/admin/payments)
ได้หลังเข้าสู่ระบบ ผู้ใช้ทั่วไปจะถูก
ตรวจสิทธิ์และปฏิเสธที่เซิร์ฟเวอร์

## สมัครและเข้าสู่ระบบด้วย Google

1. ใน Google Cloud Console สร้าง OAuth Client ID ประเภท **Web application**
   และเพิ่ม Authorized redirect URI ให้ตรงกับ URL ที่ใช้เปิดเว็บ เช่น
   `http://localhost:3000/auth/google/callback`
2. หากหน้า OAuth consent screen อยู่ในโหมดทดสอบ ให้เพิ่มบัญชี Google ที่จะใช้ทดสอบ
   เป็น test user
3. กำหนด `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` และ
   `GOOGLE_REDIRECT_URI` ใน `.env.local` แล้วรัน `npm.cmd run db:setup`
   เพื่อสร้างตารางเชื่อมบัญชี จากนั้นเริ่มหรือ restart เว็บ

`GOOGLE_REDIRECT_URI` ต้องตรงกับ Authorized redirect URI ทุกตัวอักษร
รวมถึง host ที่ใช้เปิดเว็บ (`localhost` และ `127.0.0.1` ถือเป็นคนละค่า)
บัญชี Google ใหม่จะเป็น `customer` และต้องมีอีเมลที่ Google ยืนยันแล้ว
หากอีเมลตรงกับบัญชี LeeCom เดิม ระบบจะเชื่อมบัญชีโดยคง role เดิมไว้
บัญชีที่ใช้ Google อย่างเดียวจะไม่มีรหัสผ่าน LeeCom; ผู้ใช้เดิมยังเข้าสู่ระบบ
ด้วยรหัสผ่านได้ตามปกติ

## สั่งซื้อสินค้าในเดโม

1. เข้าสู่ระบบ แล้วเลือกสินค้าและเพิ่มลงตะกร้า
2. ปรับจำนวนสินค้าในตะกร้า และไปหน้า checkout เพื่อกรอกชื่อผู้รับ เบอร์โทรศัพท์
   และที่อยู่จัดส่ง
3. ค่าจัดส่งในเดโมเป็น 0 บาท เมื่อยืนยัน ระบบอ่านราคาและสต็อกจาก MySQL
   ตรวจสต็อกและสร้างคำสั่งซื้อใน transaction เดียว
4. ที่หน้ารายละเอียดคำสั่งซื้อ เลือกชำระ PromptPay ผ่าน Stripe หรือใช้ช่องทางโอน
   สำหรับเดโมแล้วแนบสลิป JPG/PNG ขนาดไม่เกิน 5 MB พร้อมวันเวลาและยอดที่แจ้ง
   การแนบสลิปจะเปลี่ยนสถานะเป็น `pending_review` เพื่อรอตรวจสอบเท่านั้น

**ข้อมูลสาธิต ห้ามโอนเงินจริง** บัญชีที่แสดงในหน้าคำสั่งซื้อเป็นข้อมูลสมมติ
การแนบสลิปไม่ยืนยันการชำระเงินโดยอัตโนมัติ ไฟล์สลิปเก็บใน `.private/payment-proofs`
นอกโฟลเดอร์สาธารณะและดาวน์โหลดได้เฉพาะเจ้าของคำสั่งซื้อหรือผู้ดูแลที่เข้าสู่ระบบ
ผู้ดูแลอนุมัติสลิปให้เป็นชำระเงินแล้ว หรือปฏิเสธสลิปเพื่อให้ลูกค้าแนบใหม่ได้ โดยการปฏิเสธ
จะไม่คืนสต็อกที่จองไว้ รูปสินค้าจากผู้ดูแลจะอยู่ใน
`public/uploads/products`

## ชำระผ่าน Thai PromptPay ด้วย Stripe

1. ใช้ Stripe account ที่รองรับประเทศไทย และเปิดใช้งาน PromptPay ใน Stripe Dashboard
2. ใน `.env.local` กำหนด `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` และ
   `APP_URL` ให้ตรงกับ host ที่ใช้เปิดเว็บ เช่น `http://localhost:3000`
   (`localhost` และ `127.0.0.1` เป็นคนละ host)
   เริ่มทดสอบด้วย Secret key ใน test mode ก่อน ห้ามใช้หรือ commit คีย์จริงใน source code
3. สำหรับ local development ติดตั้ง Stripe CLI แล้วเปิด listener:

   ```powershell
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

   นำ webhook signing secret ที่ CLI แสดง (`whsec_...`) ใส่ใน `STRIPE_WEBHOOK_SECRET`
   แล้ว restart เว็บและ listener
4. ใน production ตั้ง endpoint `${APP_URL}/api/stripe/webhook` ใน Stripe Dashboard
   และ subscribe อย่างน้อย `checkout.session.completed` กับ
   `checkout.session.async_payment_succeeded` และ
   `checkout.session.async_payment_failed`; ใช้ signing secret ของ endpoint นั้น

ลูกค้าจะถูกส่งไปหน้า Checkout ของ Stripe เพื่อสแกน QR PromptPay
ยอดจะถูกคำนวณจากคำสั่งซื้อในฐานข้อมูลและระบบเปลี่ยนเป็น `paid` เฉพาะเมื่อ webhook
ลายเซ็นถูกต้องและยอด/สกุลเงิน/session ตรงกับคำสั่งซื้อเท่านั้น
การกลับมาหน้า success เพียงอย่างเดียวไม่ถือว่าชำระแล้ว
PromptPay รองรับยอด 10 ถึง 999,999.99 บาทต่อรายการตามขีดจำกัด Stripe
เมื่อเริ่ม Stripe Checkout แล้ว คำสั่งซื้อนั้นจะใช้ Stripe เท่านั้นเพื่อป้องกันการจ่ายซ้ำ

## หน้าจัดการสินค้า

หน้า `/admin/productls` สำหรับผู้ดูแลเท่านั้น สามารถดู เพิ่ม แก้ไขสินค้าและสถานะเปิดขาย
อัปโหลดรูป JPG, PNG, SVG หรือ WebP ไม่เกิน 5 MB และลบสินค้าได้ หากสินค้ามีประวัติคำสั่งซื้อ
ระบบจะเก็บถาวรและปิดการขายแทนการลบ
ไฟล์ SVG จะถูกกรองเนื้อหาที่ไม่ปลอดภัยก่อนบันทึก และส่งพร้อมนโยบาย CSP ที่จำกัดการทำงาน

## ตรวจสอบการชำระเงิน

หน้า `/admin/payments` แสดงคำสั่งซื้อที่อยู่ในสถานะ `pending_review` ผู้ดูแลสามารถเปิดดูสลิป
แล้วอนุมัติการชำระเงินหรือปฏิเสธสลิปพร้อมบันทึกหมายเหตุให้ลูกค้าได้ ส่วนหน้า
`/admin/payments/history` แสดงประวัติผลตรวจทุกครั้งพร้อมคำสั่งซื้อ ผู้ตรวจ เวลา และหมายเหตุ
ข้อมูลประวัติถูกบันทึกใน transaction เดียวกับการเปลี่ยนสถานะ และสคริปต์ตั้งค่าจะนำเข้าผลตรวจ
เดิมที่ยังมีข้อมูลอยู่ เมื่อปฏิเสธ ไฟล์สลิปเดิมจะถูกลบและคำสั่งซื้อกลับเป็น `awaiting_payment`
เพื่อให้ลูกค้าแนบใหม่ได้ โดยไม่คืนสต็อกที่จองไว้ ประวัติจะเก็บเฉพาะข้อมูลการตรวจสอบ ไม่เก็บ
สำเนาไฟล์สลิปที่ถูกปฏิเสธ

## สรุปธุรกรรมสำหรับผู้ดูแล

หน้า `/admin/transactions` แสดงรายการคำสั่งซื้อแบบอ่านอย่างเดียว โดยอ่านยอดและสถานะจาก
ข้อมูลคำสั่งซื้อเดิม ไม่สร้างยอดธุรกรรมซ้ำ สามารถค้นหาด้วยเลขคำสั่งซื้อ ชื่อลูกค้า หรืออีเมล
และกรองตามสถานะกับวันที่สั่งซื้อได้ ตารางแสดงช่องทางชำระ เวลาสั่งซื้อ การแจ้งโอน
และการตรวจสลิปตามข้อมูลที่มี โดยจำกัดการแสดงครั้งละ 25 รายการและแบ่งหน้า
บันทึกเวลาชำระในคำสั่งซื้อเมื่อยืนยันสำเร็จ โดยไม่สร้างยอดธุรกรรมซ้ำ หน้านี้ไม่แสดงไฟล์สลิป
หรือข้อมูลลับของ Stripe ระบบใช้ UTC กับ MySQL และแสดงเวลาเป็นเขตเวลาไทย

## Environment variables

| ตัวแปร | ค่าเริ่มต้น/การใช้งาน |
| --- | --- |
| `DB_HOST` | `127.0.0.1` |
| `DB_PORT` | `3307` |
| `DB_USER` | `root` |
| `DB_PASSWORD` | รหัสผ่าน MySQL (ต้องกำหนด) |
| `DB_NAME` | `leecom` |
| `ADMIN_EMAIL` | ต้องกำหนดเมื่อ seed admin |
| `ADMIN_NAME` | `LeeCom Admin` |
| `ADMIN_PASSWORD` | ต้องกำหนดเมื่อ seed admin; อย่างน้อย 12 ตัวอักษร |
| `GOOGLE_CLIENT_ID` | OAuth Client ID จาก Google; ไม่ต้องกำหนดหากไม่ใช้ Google Sign-In |
| `GOOGLE_CLIENT_SECRET` | OAuth Client Secret จาก Google |
| `GOOGLE_REDIRECT_URI` | Callback URL ที่ลงทะเบียนใน Google; local ใช้ `http://localhost:3000/auth/google/callback` |
| `APP_URL` | Origin ของเว็บ เช่น `http://localhost:3000`; production ต้องใช้ HTTPS |
| `STRIPE_SECRET_KEY` | Stripe Secret key ฝั่ง server (`sk_test_...` หรือ `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret ของ Stripe webhook หรือ Stripe CLI (`whsec_...`) |

## ตรวจสอบโปรเจกต์

```powershell
npm.cmd run lint
npm.cmd run build
```

รหัสผ่านผู้ใช้ถูก hash ด้วย bcrypt ส่วน session ใช้ token แบบสุ่มที่เก็บเฉพาะ SHA-256
hash ใน MySQL และ cookie ตั้ง `HttpOnly`, `SameSite=Lax`, หมดอายุใน 7 วัน
และเปิด `Secure` ใน production
