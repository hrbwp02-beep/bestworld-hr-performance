// data-kpi.jsx — Department-based KPI definitions, scoring, submissions, teams
// ----------------------------------------------------------------------------

// ---------- scoring engine ----------
// methods: higher (Higher is Better), lower (Lower is Better), range, custom
function kpiScore(k) {
  const t = (k.target && k.target.y != null) ? k.target.y : k.target;
  const a = k.actual;
  let s;
  if (k.method === "lower") s = (a <= 0 ? 150 : (t / a) * 100);
  else if (k.method === "range") {
    const [lo, hi] = k.range;
    s = (a >= lo && a <= hi) ? 100 : (a < lo ? (a / lo) * 100 : (hi / a) * 100);
  } else if (k.method === "custom") s = k.customScore;
  else s = (t <= 0 ? 0 : (a / t) * 100);
  return Math.round(Math.min(Math.max(s, 0), 150) * 10) / 10;
}
const METHOD_LABEL = { higher: "ยิ่งสูงยิ่งดี", lower: "ยิ่งต่ำยิ่งดี", range: "อยู่ในช่วง", custom: "สูตรกำหนดเอง" };

// traffic light
function trafficOf(score) {
  if (score >= 100) return { key: "green", c: "#16a34a", soft: "#e7f6ec", l: "บรรลุเป้า" };
  if (score >= 95)  return { key: "yellow", c: "#e08a00", soft: "#fdf1dc", l: "ใกล้เป้า" };
  return { key: "red", c: "#e11d48", soft: "#fbe7ec", l: "ต่ำกว่าเป้า" };
}

// ---------- KPI definitions per department ----------
// type: number | quality ; status: approved | proposed (เสนอโดยผู้จัดการ รอ HR อนุมัติ)
let _kid = 0;
const mk = (dept, name, en, unit, method, weight, tm, tq, ty, actual, opt = {}) => ({
  id: "KPI-" + (++_kid).toString().padStart(3, "0"),
  dept, name, en, unit, method, weight,
  target: { m: tm, q: tq, y: ty }, actual,
  type: opt.type || "number", status: opt.status || "approved", owner: opt.owner || "HR",
  range: opt.range, customScore: opt.customScore, formula: opt.formula, trendDown: !!opt.trendDown,
});

const KPI_DEFS = [
  // ฝ่ายผลิต (prod) — weights 100
  mk("prod", "Output Achievement", "อัตราผลผลิตตามเป้า", "%", "higher", 20, 95, 95, 95, 97.2),
  mk("prod", "Machine Efficiency", "ประสิทธิภาพเครื่องจักร", "%", "higher", 15, 90, 90, 90, 91.5),
  mk("prod", "OEE", "ประสิทธิผลโดยรวมของเครื่องจักร", "%", "higher", 20, 85, 85, 85, 88.0),
  mk("prod", "Scrap Rate", "อัตราของเสีย", "%", "lower", 15, 3.0, 3.0, 3.0, 2.4),
  mk("prod", "Downtime", "เวลาเครื่องหยุด", "ชม./เดือน", "lower", 15, 40, 120, 480, 34, { trendDown: true }),
  mk("prod", "Productivity", "ผลิตภาพแรงงาน", "ชิ้น/ชม.", "higher", 15, 1200, 1200, 1200, 1180),
  // ฝ่ายคุณภาพ (qc)
  mk("qc", "Customer Claim", "ข้อร้องเรียนลูกค้า", "ครั้ง", "lower", 25, 5, 15, 60, 3),
  mk("qc", "Internal Defect", "ของเสียภายใน", "%", "lower", 20, 2.0, 2.0, 2.0, 1.6),
  mk("qc", "Audit Result", "ผลการตรวจประเมิน", "%", "higher", 20, 90, 90, 90, 93),
  mk("qc", "Quality Cost", "ต้นทุนคุณภาพ", "% ยอดขาย", "lower", 15, 1.5, 1.5, 1.5, 1.3),
  mk("qc", "Corrective Action Closure", "ปิดงานแก้ไข", "%", "higher", 20, 95, 95, 95, 97),
  // ฝ่ายคลังสินค้า (wh)
  mk("wh", "Inventory Accuracy", "ความแม่นยำสินค้าคงคลัง", "%", "higher", 30, 98, 98, 98, 96.5, { trendDown: true }),
  mk("wh", "Stock Turnover", "อัตราหมุนเวียนสต็อก", "รอบ", "higher", 20, 8, 8, 8, 7.4),
  mk("wh", "Picking Accuracy", "ความแม่นยำการหยิบสินค้า", "%", "higher", 25, 99, 99, 99, 98.7),
  mk("wh", "Delivery Accuracy", "ความแม่นยำการจัดส่ง", "%", "higher", 25, 98, 98, 98, 97.2),
  // ฝ่ายบุคคล (hr)
  mk("hr", "Recruitment Lead Time", "ระยะเวลาสรรหา", "วัน", "lower", 25, 30, 30, 30, 27),
  mk("hr", "Turnover Rate", "อัตราการลาออก", "%", "lower", 25, 8, 8, 8, 9.2, { trendDown: true }),
  mk("hr", "Training Achievement", "ความสำเร็จการฝึกอบรม", "%", "higher", 25, 90, 90, 90, 94),
  mk("hr", "Employee Engagement", "ความผูกพันพนักงาน", "คะแนน", "higher", 25, 80, 80, 80, 82, { type: "quality" }),
  // ฝ่ายจัดซื้อ (purch)
  mk("purch", "Cost Saving", "การประหยัดต้นทุน", "%", "higher", 40, 5, 5, 5, 6.2),
  mk("purch", "On-Time Delivery Supplier", "ส่งมอบตรงเวลาของซัพพลายเออร์", "%", "higher", 30, 95, 95, 95, 93, { trendDown: true }),
  mk("purch", "Supplier Evaluation Score", "คะแนนประเมินซัพพลายเออร์", "คะแนน", "higher", 30, 85, 85, 85, 88, { type: "quality" }),
  // ฝ่ายวิศวกรรม & ซ่อมบำรุง (eng)
  mk("eng", "MTBF", "เวลาเฉลี่ยระหว่างเครื่องเสีย", "ชม.", "higher", 25, 400, 400, 400, 412),
  mk("eng", "MTTR", "เวลาเฉลี่ยในการซ่อม", "ชม.", "lower", 20, 4, 4, 4, 3.6),
  mk("eng", "PM Completion", "ความสำเร็จบำรุงรักษาเชิงป้องกัน", "%", "higher", 30, 95, 95, 95, 96.5),
  mk("eng", "Maintenance Cost", "ต้นทุนซ่อมบำรุงต่องบ", "%", "lower", 25, 100, 100, 100, 97, { trendDown: true }),
  // ฝ่ายวางแผนการผลิต (plan)
  mk("plan", "Plan Achievement", "ความสำเร็จตามแผนผลิต", "%", "higher", 30, 95, 95, 95, 97.1),
  mk("plan", "Forecast Accuracy", "ความแม่นยำพยากรณ์", "%", "higher", 25, 85, 85, 85, 86.4),
  mk("plan", "On-Time Delivery", "ส่งมอบตรงเวลา", "%", "higher", 25, 98, 98, 98, 96.5, { trendDown: true }),
  mk("plan", "Inventory Days", "จำนวนวันสินค้าคงคลัง", "วัน", "lower", 20, 25, 25, 25, 23),
  // proposed examples (ผู้จัดการเสนอ รอ HR อนุมัติ)
  mk("prod", "Energy per Unit", "พลังงานต่อหน่วยผลิต", "kWh/ชิ้น", "lower", 0, 0.8, 0.8, 0.8, 0.74, { status: "proposed", owner: "ผู้จัดการฝ่ายผลิต" }),
  mk("qc", "First Pass Yield", "อัตราผ่านครั้งแรก", "%", "higher", 0, 96, 96, 96, 95.2, { status: "proposed", owner: "ผู้จัดการแผนก QC" }),
];

const kpisOf = (dept) => KPI_DEFS.filter((k) => k.dept === dept && k.status === "approved");
function deptAchievement(dept) {
  const ks = kpisOf(dept);
  const w = ks.reduce((a, k) => a + k.weight, 0) || 1;
  return Math.round(ks.reduce((a, k) => a + kpiScore(k) * k.weight, 0) / w * 10) / 10;
}
// departments that run the KPI module
const KPI_DEPTS = ["prod", "qc", "wh", "hr", "purch", "eng", "plan"];

// ---------- KPI monthly trend (achievement %) per department ----------
const KPI_MONTHS = ["ธ.ค.", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค."];
function deptKpiTrend(dept) {
  const base = deptAchievement(dept);
  const seed = dept.charCodeAt(0);
  return KPI_MONTHS.map((m, i) => ({ m, v: Math.round((base - (5 - i) * 1.1 + ((seed + i) % 5 - 2) * 0.8) * 10) / 10 }));
}

// ---------- report submissions ----------
const FILE_KINDS = {
  excel: { icon: "fileExcel", c: "#16a34a", label: "Excel" },
  pdf:   { icon: "file", c: "#e11d48", label: "PDF" },
  ppt:   { icon: "file", c: "#e08a00", label: "PowerPoint" },
  image: { icon: "eye", c: "#2563eb", label: "รูปภาพ" },
  drive: { icon: "layers", c: "#0d9488", label: "Google Drive" },
  sharepoint: { icon: "layers", c: "#2563eb", label: "SharePoint" },
};

const SUBMISSIONS = [
  { id: "RPT-2568-051", dept: "qc", period: "พฤษภาคม 2568", cycle: "monthly", due: "05 มิ.ย. 2568", submitted: "03 มิ.ย. 2568", submitter: "สุดารัตน์ วงศ์ทอง", status: "approved",
    files: [{ name: "QC_KPI_May2568.xlsx", type: "excel", size: "248 KB" }, { name: "Audit_Report.pdf", type: "pdf", size: "1.2 MB" }, { name: "Claim_Summary.pptx", type: "ppt", size: "3.4 MB" }],
    note: "ปิด Corrective Action ครบทุกรายการ", ver: "v2",
    versions: [{ v: "v2", date: "03 มิ.ย. 2568", by: "สุดารัตน์", note: "แก้ไขตัวเลข Claim" }, { v: "v1", date: "01 มิ.ย. 2568", by: "สุดารัตน์", note: "ฉบับแรก" }],
    audit: [{ act: "อนุมัติโดยผู้จัดการ", by: "สุดารัตน์ วงศ์ทอง", time: "03 มิ.ย. 09:12" }, { act: "HR ตรวจสอบผ่าน", by: "ฝ่ายบุคคล", time: "03 มิ.ย. 14:40" }, { act: "ส่งรายงาน v2", by: "สุดารัตน์", time: "03 มิ.ย. 08:55" }] },
  { id: "RPT-2568-052", dept: "prod", period: "พฤษภาคม 2568", cycle: "monthly", due: "05 มิ.ย. 2568", submitted: "04 มิ.ย. 2568", submitter: "สมชาย ศรีสุข", status: "submitted",
    files: [{ name: "Production_KPI.xlsx", type: "excel", size: "312 KB" }, { name: "OEE_Dashboard.png", type: "image", size: "680 KB" }, { name: "ลิงก์ข้อมูลการผลิต", type: "drive", size: "Google Drive" }],
    note: "รอผู้จัดการอนุมัติ", ver: "v1",
    versions: [{ v: "v1", date: "04 มิ.ย. 2568", by: "สมชาย", note: "ฉบับแรก" }],
    audit: [{ act: "ส่งรายงาน v1", by: "สมชาย ศรีสุข", time: "04 มิ.ย. 16:20" }] },
  { id: "RPT-2568-053", dept: "wh", period: "พฤษภาคม 2568", cycle: "monthly", due: "05 มิ.ย. 2568", submitted: null, submitter: "สุดารัตน์ (คลัง)", status: "overdue",
    files: [], note: "ยังไม่ส่ง — เกินกำหนด 2 วัน", ver: "—",
    versions: [], audit: [{ act: "ระบบเตือนใกล้ครบกำหนด", by: "ระบบ", time: "04 มิ.ย. 08:00" }] },
  { id: "RPT-2568-054", dept: "purch", period: "ไตรมาส 2/2568", cycle: "quarterly", due: "10 ก.ค. 2568", submitted: "28 พ.ค. 2568", submitter: "ผู้จัดการฝ่ายจัดซื้อ", status: "approved",
    files: [{ name: "Purchasing_Q2.xlsx", type: "excel", size: "420 KB" }, { name: "Supplier_Eval.pdf", type: "pdf", size: "890 KB" }, { name: "SharePoint: Cost Saving", type: "sharepoint", size: "SharePoint" }],
    note: "Cost Saving เกินเป้า", ver: "v1",
    versions: [{ v: "v1", date: "28 พ.ค. 2568", by: "ผู้จัดการฝ่ายจัดซื้อ", note: "ฉบับแรก" }],
    audit: [{ act: "ส่งรายงาน v1", by: "ผู้จัดการฝ่ายจัดซื้อ", time: "28 พ.ค. 10:05" }, { act: "อนุมัติ", by: "กรรมการผู้จัดการ", time: "29 พ.ค. 11:30" }] },
  { id: "RPT-2568-055", dept: "hr", period: "พฤษภาคม 2568", cycle: "monthly", due: "05 มิ.ย. 2568", submitted: "05 มิ.ย. 2568", submitter: "ฝ่ายบุคคล", status: "rejected",
    files: [{ name: "HR_KPI_May.xlsx", type: "excel", size: "198 KB" }], note: "ตัวเลข Turnover ไม่ตรง ขอแก้ไข", ver: "v1",
    versions: [{ v: "v1", date: "05 มิ.ย. 2568", by: "ฝ่ายบุคคล", note: "ฉบับแรก" }],
    audit: [{ act: "ส่งรายงาน v1", by: "ฝ่ายบุคคล", time: "05 มิ.ย. 09:40" }, { act: "ตีกลับ: ตัวเลขไม่ตรง", by: "ผู้จัดการ HR", time: "05 มิ.ย. 15:10" }] },
  { id: "RPT-2568-056", dept: "eng", period: "พฤษภาคม 2568", cycle: "monthly", due: "05 มิ.ย. 2568", submitted: null, submitter: "ผู้จัดการวิศวกรรม", status: "draft",
    files: [{ name: "Maintenance_KPI_draft.xlsx", type: "excel", size: "156 KB" }], note: "ฉบับร่าง ยังไม่ส่ง", ver: "ร่าง",
    versions: [{ v: "ร่าง", date: "04 มิ.ย. 2568", by: "ผู้จัดการวิศวกรรม", note: "บันทึกร่าง" }],
    audit: [{ act: "บันทึกฉบับร่าง", by: "ผู้จัดการวิศวกรรม", time: "04 มิ.ย. 13:25" }] },
  { id: "RPT-2568-050", dept: "plan", period: "พฤษภาคม 2568", cycle: "monthly", due: "05 มิ.ย. 2568", submitted: "02 มิ.ย. 2568", submitter: "ผู้จัดการวางแผน", status: "approved",
    files: [{ name: "Planning_KPI.xlsx", type: "excel", size: "210 KB" }, { name: "MPS_Report.pdf", type: "pdf", size: "640 KB" }], note: "ครบถ้วน", ver: "v1",
    versions: [{ v: "v1", date: "02 มิ.ย. 2568", by: "ผู้จัดการวางแผน", note: "ฉบับแรก" }],
    audit: [{ act: "ส่งรายงาน v1", by: "ผู้จัดการวางแผน", time: "02 มิ.ย. 11:00" }, { act: "อนุมัติ", by: "กรรมการผู้จัดการ", time: "02 มิ.ย. 16:45" }] },
];
const SUB_STATUS = {
  draft:     { l: "ฉบับร่าง", cls: "b-gray", c: "#5b6b86" },
  submitted: { l: "ส่งแล้ว", cls: "b-blue", c: "#2563eb" },
  approved:  { l: "อนุมัติแล้ว", cls: "b-green", c: "#16a34a" },
  rejected:  { l: "ตีกลับ", cls: "b-red", c: "#e11d48" },
  overdue:   { l: "เกินกำหนด", cls: "b-amber", c: "#e08a00" },
};

// ---------- teams (for drill-down) ----------
const TEAMS = [
  { id: "T-prod-1", dept: "prod", name: "ทีมฉีดพลาสติก A", lead: "E1001", ach: 96.4 },
  { id: "T-prod-2", dept: "prod", name: "ทีมประกอบ & แพ็ค", lead: "E1004", ach: 89.1 },
  { id: "T-qc-1", dept: "qc", name: "ทีมตรวจสอบคุณภาพ", lead: "E1005", ach: 98.2 },
  { id: "T-wh-1", dept: "wh", name: "ทีมคลังวัตถุดิบ", lead: "E1014", ach: 94.3 },
  { id: "T-wh-2", dept: "wh", name: "ทีมจัดส่ง & โลจิสติกส์", lead: "E1016", ach: 90.5 },
  { id: "T-purch-1", dept: "purch", name: "ทีมจัดซื้อในประเทศ", lead: "E1024", ach: 102.0 },
  { id: "T-hr-1", dept: "hr", name: "ทีมสรรหา & พัฒนา", lead: "E1021", ach: 97.6 },
  { id: "T-eng-1", dept: "eng", name: "ทีมซ่อมบำรุง", lead: "E1009", ach: 91.8 },
  { id: "T-plan-1", dept: "plan", name: "ทีมวางแผนการผลิต", lead: "E1012", ach: 95.9 },
];
const teamsOf = (dept) => TEAMS.filter((t) => t.dept === dept);

// risk alerts: KPIs below target or trending down
function kpiRisks() {
  return KPI_DEFS.filter((k) => k.status === "approved" && (kpiScore(k) < 100 || k.trendDown))
    .map((k) => ({ ...k, score: kpiScore(k) }))
    .sort((a, b) => a.score - b.score).slice(0, 6);
}

Object.assign(window, {
  kpiScore, trafficOf, METHOD_LABEL, KPI_DEFS, kpisOf, deptAchievement, KPI_DEPTS,
  KPI_MONTHS, deptKpiTrend, FILE_KINDS, SUBMISSIONS, SUB_STATUS, TEAMS, teamsOf, kpiRisks,
});
