# ระบบประเมินผลพนักงาน — เบสท์เวิลด์ อินเตอร์พลาส

HR Performance Management System (KPI · Competency · JD · Calibration) สำหรับบริษัทโรงงานอุตสาหกรรม
UI ภาษาไทย · โทนน้ำเงิน/ขาว/เทา · IBM Plex Sans Thai · responsive

> Prototype นี้พัฒนาจากดีไซน์ Claude Design แล้วต่อยอดให้ใช้งานจริงด้วย **Supabase**
> (ฐานข้อมูล Postgres + Auth จริง) และ deploy เป็น static site บน **GitHub Pages**

## สถาปัตยกรรม

- **Frontend** — React 18 (UMD) + Babel-standalone, ไม่มีขั้นตอน build เป็น static ล้วน
- **Backend** — Supabase (Postgres + Row Level Security + Auth อีเมล/รหัสผ่าน)
- ข้อมูลทั้งหมด (พนักงาน, แผนก, KPI, JD, การส่งรายงาน ฯลฯ) อยู่ในตาราง `public.*`
  และโหลดเข้าหน้าเว็บผ่าน `loadHRData()` ใน [`supa.jsx`](supa.jsx)

## โครงสร้างไฟล์

| ไฟล์ | หน้าที่ |
|------|---------|
| `index.html` | จุดเริ่ม โหลด CDN + สคริปต์ทั้งหมด |
| `supa.jsx` | Supabase client + ตัวโหลดข้อมูลจาก DB |
| `styles.css` | Design system / tokens |
| `data.jsx` | helper + ค่าคงที่เชิงกราฟ (ข้อมูลจริงมาจาก DB) |
| `data-kpi.jsx` | เครื่องคำนวณคะแนน KPI + config |
| `ui.jsx`, `icons.jsx`, `charts.jsx` | คอมโพเนนต์ UI / ไอคอน / กราฟ SVG |
| `screens-*.jsx` | หน้าจอแต่ละโมดูล |
| `app.jsx` | App shell, routing, auth gate, sidebar/topbar |
| `server.ps1` | static server สำหรับรันทดสอบบนเครื่อง (Windows, ไม่ต้องติดตั้งอะไร) |

## รันบนเครื่อง (local)

```powershell
powershell -ExecutionPolicy Bypass -File server.ps1 -Port 5173
# เปิด http://localhost:5173
```
(ต้องเสิร์ฟผ่าน HTTP เพราะ Babel โหลดไฟล์ `.jsx` ผ่าน fetch — เปิดไฟล์ตรงๆ ไม่ได้)

## การเข้าสู่ระบบ

ใช้ Supabase Auth จริง — บัญชีตัวอย่าง:
- อีเมล: `hr.admin@bestworld.co.th`
- รหัสผ่าน: *(แชร์แยกต่างหาก — เปลี่ยนได้ที่ Supabase → Authentication)*

## ความปลอดภัย

- คีย์ที่ฝังในโค้ดเป็น **publishable/anon key** ซึ่งออกแบบมาให้เปิดเผยฝั่ง client ได้
- ทุกตารางเปิด **Row Level Security** — เฉพาะผู้ที่ล็อกอินเท่านั้นที่อ่าน/เขียนได้
- **อย่า** commit service-role key ลง repo
