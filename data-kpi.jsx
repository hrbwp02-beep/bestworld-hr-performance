// data-kpi.jsx — KPI scoring engine + config helpers
// NOTE: KPI definitions, report submissions, and teams now live in Supabase
// (loaded by loadHRData() in supa.jsx into window.KPI_DEFS / SUBMISSIONS / TEAMS).
// This file keeps only the pure scoring/derivation functions and config maps.
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

// ---------- derivations over the live KPI definitions ----------
const kpisOf = (dept) => (window.KPI_DEFS || []).filter((k) => k.dept === dept && k.status === "approved");
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

// ---------- file kinds & submission status maps ----------
const FILE_KINDS = {
  excel: { icon: "fileExcel", c: "#16a34a", label: "Excel" },
  pdf:   { icon: "file", c: "#e11d48", label: "PDF" },
  ppt:   { icon: "file", c: "#e08a00", label: "PowerPoint" },
  image: { icon: "eye", c: "#2563eb", label: "รูปภาพ" },
  drive: { icon: "layers", c: "#0d9488", label: "Google Drive" },
  sharepoint: { icon: "layers", c: "#2563eb", label: "SharePoint" },
};
const SUB_STATUS = {
  draft:     { l: "ฉบับร่าง", cls: "b-gray", c: "#5b6b86" },
  submitted: { l: "ส่งแล้ว", cls: "b-blue", c: "#2563eb" },
  approved:  { l: "อนุมัติแล้ว", cls: "b-green", c: "#16a34a" },
  rejected:  { l: "ตีกลับ", cls: "b-red", c: "#e11d48" },
  overdue:   { l: "เกินกำหนด", cls: "b-amber", c: "#e08a00" },
};

// ---------- teams (for drill-down) ----------
const teamsOf = (dept) => (window.TEAMS || []).filter((t) => t.dept === dept);

// risk alerts: KPIs below target or trending down
function kpiRisks() {
  return (window.KPI_DEFS || []).filter((k) => k.status === "approved" && (kpiScore(k) < 100 || k.trendDown))
    .map((k) => ({ ...k, score: kpiScore(k) }))
    .sort((a, b) => a.score - b.score).slice(0, 6);
}

Object.assign(window, {
  kpiScore, trafficOf, METHOD_LABEL, kpisOf, deptAchievement, KPI_DEPTS,
  KPI_MONTHS, deptKpiTrend, FILE_KINDS, SUB_STATUS, teamsOf, kpiRisks,
});
