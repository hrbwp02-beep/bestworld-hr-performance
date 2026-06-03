// data.jsx — static config + helpers for Bestworld HR Performance
// บริษัท เบสท์เวิลด์ อินเตอร์พลาส จำกัด
// NOTE: transactional/reference data (departments, employees, KPIs, JD, …)
// now lives in Supabase and is loaded by loadHRData() in supa.jsx.
// This file keeps only pure helpers and presentational chart constants.

const COMPANY = {
  name: "เบสท์เวิลด์ อินเตอร์พลาส",
  full: "บริษัท เบสท์เวิลด์ อินเตอร์พลาส จำกัด",
  cycle: "รอบประเมินปี 2569",
};

// ---------- helpers ----------
function bandOf(score) {
  if (score >= 90) return { key: "A", label: "ดีเยี่ยม", cls: "b-green", color: "#16a34a" };
  if (score >= 80) return { key: "B", label: "ดีมาก", cls: "b-teal", color: "#0d9488" };
  if (score >= 70) return { key: "C", label: "ตามเป้า", cls: "b-blue", color: "#2563eb" };
  if (score >= 60) return { key: "D", label: "ต้องพัฒนา", cls: "b-amber", color: "#e08a00" };
  return { key: "E", label: "ต่ำกว่าเกณฑ์", cls: "b-red", color: "#e11d48" };
}
function statusMeta(s) {
  return ({
    done:    { label: "ประเมินแล้ว", cls: "b-green" },
    review:  { label: "รออนุมัติ", cls: "b-amber" },
    pending: { label: "รอประเมิน", cls: "b-gray" },
    progress:{ label: "กำลังประเมิน", cls: "b-blue" },
  })[s];
}

// department lookups — read the live DEPARTMENTS loaded from Supabase
const deptName = (id) => ((window.DEPARTMENTS || []).find((d) => d.id === id) || {}).name || id;
const deptShort = (id) => ((window.DEPARTMENTS || []).find((d) => d.id === id) || {}).short || id;

// ---------- ระดับพนักงาน (employee levels) ----------
const LEVELS = ["ผู้จัดการ", "หัวหน้างาน", "วิศวกร", "วิชาชีพ", "เจ้าหน้าที่", "ช่างฝีมือ", "ปฏิบัติการ"];
// เดา "ระดับ" จากชื่อตำแหน่ง (ใช้เป็นค่าเริ่มต้น/เมื่อไฟล์ไม่ระบุระดับ)
function levelFromPosition(pos) {
  const p = String(pos || "");
  if (/ผู้จัดการ|ผจก|กรรมการ|ผู้อำนวยการ|ผู้ช่วยผู้จัดการ/.test(p)) return "ผู้จัดการ";
  if (/หัวหน้า|ซุปเปอร์ไวเซอร์|หัวหน้ากะ|foreman|โฟร์แมน|supervisor/i.test(p)) return "หัวหน้างาน";
  if (/วิศวกร|engineer/i.test(p)) return "วิศวกร";
  if (/นักวิจัย|นักวิเคราะห์|วิชาชีพ/.test(p)) return "วิชาชีพ";
  if (/เจ้าหน้าที่|ธุรการ|เลขานุการ|officer|admin/i.test(p)) return "เจ้าหน้าที่";
  if (/ช่าง/.test(p)) return "ช่างฝีมือ";
  return "ปฏิบัติการ";
}

// อายุงาน — compute from hire date (วันเข้างาน) relative to today
function tenureFrom(hireDate) {
  if (!hireDate) return "—";
  const start = new Date(hireDate);
  if (isNaN(start.getTime())) return "—";
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months--;
  if (months < 0) months = 0;
  const y = Math.floor(months / 12), m = months % 12;
  const parts = [];
  if (y > 0) parts.push(y + " ปี");
  if (m > 0) parts.push(m + " เดือน");
  return parts.length ? parts.join(" ") : "น้อยกว่า 1 เดือน";
}

// ---------- presentational analytics (historical chart constants) ----------
// performance trend (company avg by month)
const TREND = [
  { m: "ต.ค.", v: 79.2 }, { m: "พ.ย.", v: 80.1 }, { m: "ธ.ค.", v: 81.0 },
  { m: "ม.ค.", v: 81.6 }, { m: "ก.พ.", v: 82.4 }, { m: "มี.ค.", v: 82.9 },
  { m: "เม.ย.", v: 83.5 }, { m: "พ.ค.", v: 84.1 }, { m: "มิ.ย.", v: 84.7 },
];
const TREND_PREV = [
  { m: "ต.ค.", v: 76.0 }, { m: "พ.ย.", v: 76.8 }, { m: "ธ.ค.", v: 77.5 },
  { m: "ม.ค.", v: 78.0 }, { m: "ก.พ.", v: 78.6 }, { m: "มี.ค.", v: 79.3 },
  { m: "เม.ย.", v: 80.0 }, { m: "พ.ค.", v: 80.6 }, { m: "มิ.ย.", v: 81.2 },
];

// competency distribution (company avg)
const COMP_RADAR = [
  { id: "lead", name: "ภาวะผู้นำ", v: 81 },
  { id: "team", name: "ทำงานเป็นทีม", v: 87 },
  { id: "comm", name: "การสื่อสาร", v: 83 },
  { id: "solve", name: "แก้ปัญหา", v: 79 },
  { id: "disc", name: "ความมีวินัย", v: 90 },
];

// 9-box labels
const NINEBOX = {
  cells: [
    { x:0,y:2, label:"เพชรในตม", sub:"Potential Gem", color:"#0ea5e9" },
    { x:1,y:2, label:"ดาวรุ่ง", sub:"High Potential", color:"#16a34a" },
    { x:2,y:2, label:"ดาวเด่น", sub:"Star", color:"#15803d" },
    { x:0,y:1, label:"ต้องพัฒนา", sub:"Inconsistent", color:"#e08a00" },
    { x:1,y:1, label:"กำลังหลัก", sub:"Core Player", color:"#2563eb" },
    { x:2,y:1, label:"ผู้ทำผลงานสูง", sub:"High Performer", color:"#0d9488" },
    { x:0,y:0, label:"เสี่ยง", sub:"Risk", color:"#e11d48" },
    { x:1,y:0, label:"ทำได้ตามเกณฑ์", sub:"Effective", color:"#94a3b8" },
    { x:2,y:0, label:"ผู้เชี่ยวชาญ", sub:"Trusted Pro", color:"#64748b" },
  ],
};

Object.assign(window, {
  COMPANY, TREND, TREND_PREV, COMP_RADAR, NINEBOX,
  bandOf, statusMeta, deptName, deptShort, tenureFrom, LEVELS, levelFromPosition,
});
