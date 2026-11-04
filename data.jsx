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
// ช่วงเกรดใช้ชุดเดียวกับระบบประเมินประจำปี (เกณฑ์บริษัทปี 2568 ใน perf_cycles.config.bands)
// ทุกหน้าจึงตัดเกรดตรงกัน · ส่ง grade มาด้วยได้ (เช่นเกรดที่ HR ปรับผลแล้ว) จะใช้เกรดนั้นแทนการคิดจากคะแนน
const BAND_STYLE = {
  "A+": ["b-green", "#15803d"], A: ["b-green", "#16a34a"], "B+": ["b-teal", "#0d9488"], B: ["b-teal", "#0891b2"],
  C: ["b-amber", "#e08a00"], D: ["b-red", "#e11d48"], F: ["b-red", "#9f1239"],
};
const BANDS_DEFAULT = [[96, "A+", 1, "ผลงานโดดเด่นมาก"], [90, "A", 0.9, "เกินเป้าหมาย"], [80, "B+", 0.8, "ดีมาก"], [70, "B", 0.7, "ตามมาตรฐาน"],
  [60, "C", 0.5, "ต่ำกว่าเป้าเล็กน้อย"], [50, "D", 0.2, "ต้องปรับปรุง"], [0, "F", 0, "ไม่ผ่านเกณฑ์"]];
function bandOf(score, grade) {
  const bands = window.PERF_BANDS || BANDS_DEFAULT;
  const b = (grade && bands.find((x) => x[1] === grade)) || bands.find((x) => Math.round(Number(score) || 0) >= x[0]) || bands[bands.length - 1];
  const st = BAND_STYLE[b[1]] || ["b-gray", "#64748b"];
  return { key: b[1], label: b[3], cls: st[0], color: st[1] };
}
function statusMeta(s) {
  return ({
    done:    { label: "ประเมินแล้ว", cls: "b-green" },
    review:  { label: "รออนุมัติ", cls: "b-amber" },
    pending: { label: "รอประเมิน", cls: "b-gray" },
    progress:{ label: "กำลังประเมิน", cls: "b-blue" },
  })[s];
}

// ผลสรุปการประเมิน → เกรด + โบนัส + การปรับเงินเดือน (มีใบเตือน = ไม่ปรับเงิน)
const BONUS_TIERS_DEFAULT = {
  "A+": { bonus: 2.5, raise: 12 }, "A": { bonus: 2.0, raise: 10 }, "B+": { bonus: 1.5, raise: 7 },
  "B": { bonus: 1.2, raise: 5 }, "C": { bonus: 0.8, raise: 3 }, "D": { bonus: 0, raise: 0 },
};
function evalOutcome(overall, warnings) {
  const b = bandOf(overall);
  // มีรอบประเมินประจำปี → ใช้โบนัสตามเกรด/ขึ้นเงินเดือนของรอบนั้น (ตรงกับหน้าประเมินประจำปีและไฟล์ส่ง Bplus)
  const pc = window.PERF_CYCLE && window.PERF_CYCLE.config;
  let bonus, raise;
  if (pc && pc.bands) {
    const pb = pc.bands.find((x) => x[1] === b.key);
    bonus = pb ? Number(pb[2]) || 0 : 0;
    raise = b.key === "F" ? 0 : Number(pc.raise_pct) || 0;
  } else {
    const tiers = (window.APP_SETTINGS && window.APP_SETTINGS.bonus_tiers) || BONUS_TIERS_DEFAULT;
    const t = tiers[b.key] || BONUS_TIERS_DEFAULT[b.key] || { bonus: 0, raise: 0 };
    bonus = Number(t.bonus) || 0; raise = Number(t.raise) || 0;
  }
  const hasWarning = (warnings || 0) > 0;
  return {
    grade: b.key, gradeLabel: b.label, color: b.color, cls: b.cls,
    bonusMonths: bonus, bonusEligible: bonus > 0,
    // เกณฑ์ปี 2568: ใบเตือนหักคะแนนแล้ว ไม่ตัดสิทธิ์ขึ้นเงินเดือนซ้ำ (ระบบเดิมตัด — ใช้เฉพาะเมื่อไม่มีรอบประเมินประจำปี)
    raisePct: hasWarning && !pc ? 0 : raise, raiseEligible: !(hasWarning && !pc) && raise > 0,
    hasWarning, warnings: warnings || 0,
  };
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

// ส่วนงาน (section) — แยกย่อยภายในหน่วยงานจากชื่อตำแหน่ง (ใช้กับฝ่ายที่มีคนเยอะ เช่น ผลิต)
function sectionOf(position) {
  const p = String(position || "");
  if (/เป่า/.test(p)) return "ส่วนงานเป่า";
  if (/พิมพ์/.test(p)) return "ส่วนงานพิมพ์";
  if (/สลิท|สลิต/.test(p)) return "ส่วนงานสลิท";
  if (/กรอ/.test(p)) return "ส่วนงานกรอ";
  if (/ผสม/.test(p)) return "ส่วนงานผสมเม็ด";
  if (/ซีล/.test(p)) return "ส่วนงานโรงซีล";
  return "ส่วนกลาง";
}

// ลำดับตำแหน่ง (เลขน้อย = ตำแหน่งใหญ่) ใช้เรียงรายชื่อ
function posRank(position) {
  const p = String(position || "");
  if (/ประธาน|กรรมการผู้จัดการ|ผู้อำนวยการ/.test(p) && !/ผู้ช่วย/.test(p)) return 0;
  if (/ผู้ช่วย.*กรรมการ|ที่ปรึกษา/.test(p)) return 1;
  if (/ผู้จัดการ|ผจก/.test(p) && !/ผู้ช่วย/.test(p)) return 2;
  if (/ผู้ช่วยผู้จัดการ/.test(p)) return 3;
  if (/หัวหน้าฝ่าย|หัวหน้าแผน|หัวหน้าส่วน/.test(p)) return 4; // "หัวหน้าแผน" รวมคำสะกดผิด "หัวหน้าแผนซ่อมบำรุง"
  if (/ซุปเปอร์ไวเซอร์|supervisor|หัวหน้างาน/i.test(p)) return 5;
  if (/หัวหน้ากะ|โฟร์แมน|foreman|หัวหน้า/i.test(p)) return 6;
  if (/วิศวกร|วิศกร|engineer/i.test(p)) return 7;
  if (/นักวิ|วิชาชีพ/.test(p)) return 8;
  if (/เจ้าหน้าที่|ธุรการ|เลขานุการ|officer|admin/i.test(p)) return 9;
  if (/ผู้ช่วยช่าง/.test(p)) return 10.5;
  if (/ช่าง/.test(p)) return 10;
  return 11;
}
// เรียงรายชื่อ: หน่วยงาน → ส่วนงานย่อย (ตามสายการประเมิน เช่น 09-1 เป่า, 09-4 พิมพ์) → ตำแหน่งใหญ่ไปเล็ก → รหัส
// ระดับผู้จัดการขึ้นไปอยู่บนสุดของหน่วยงานเสมอ · ใช้ได้ทั้งแถว employees (e.annual.line_name) และแถว perf_list (r.line_name)
function empOrderCmp(a, b) {
  const deps = window.DEPARTMENTS_ALL || window.DEPARTMENTS || [];
  const di = (x) => { const i = deps.findIndex((d) => d.id === x.dept); return i < 0 ? 999 : i; };
  const pos = (x) => x.position || "";
  const id = (x) => String(x.employee_id || x.id || "");
  const sub = (x) => {
    if (posRank(pos(x)) <= 3) return [-2, 0, ""];
    const ln = x.line_name || (x.annual && x.annual.line_name) || "";
    const m = ln.match(/^(\d+)(?:-(\d+))?/);
    if (m) return [Number(m[1]), m[2] ? Number(m[2]) : 0, ln];
    if (ln) return [900, 0, ln];
    const s = sectionOf(pos(x)); return [s === "ส่วนกลาง" ? -1 : 500, 0, s];
  };
  const sa = sub(a), sb_ = sub(b);
  return di(a) - di(b) || sa[0] - sb_[0] || sa[1] - sb_[1] || sa[2].localeCompare(sb_[2], "th")
    || posRank(pos(a)) - posRank(pos(b)) || id(a).localeCompare(id(b), "en", { numeric: true });
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

Object.assign(window, { BANDS_DEFAULT, BAND_STYLE,
  COMPANY, TREND, TREND_PREV, COMP_RADAR, NINEBOX,
  bandOf, statusMeta, deptName, deptShort, tenureFrom, LEVELS, levelFromPosition, posRank, empOrderCmp, evalOutcome, BONUS_TIERS_DEFAULT, sectionOf,
});
