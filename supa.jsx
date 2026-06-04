// supa.jsx — Supabase client + data loader
// Loads all HR data from Postgres into window globals so the existing
// screens (which read DEPARTMENTS, EMPLOYEES, KPI_DEFS, …) keep working.
// --------------------------------------------------------------------

const SUPABASE_URL = "https://mxubzxygthueoaunhiwq.supabase.co";
// Publishable key — safe to expose in client code; access is gated by RLS.
const SUPABASE_KEY = "sb_publishable_4C-xYuDcE0AZWvLZ5ZPEeQ_czQ29jQu";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window.sb = sb;

// ---------- role definitions (permissions) ----------
const ROLES = [
  { id: "admin",      label: "ผู้ดูแลระบบ",      desc: "เข้าถึงทุกฟังก์ชัน",          cls: "b-blue",
    perms: ["จัดการผู้ใช้และสิทธิ์", "ตั้งค่าระบบทั้งหมด", "เข้าถึงทุกหน้าและรายงาน", "อนุมัติ/แก้ไขทุกข้อมูล"] },
  { id: "hr",         label: "ฝ่ายบุคคล (HR)",   desc: "จัดการการประเมินทั้งองค์กร", cls: "b-teal",
    perms: ["จัดการพนักงานและหน่วยงาน", "ตั้งค่ารอบประเมิน/น้ำหนักคะแนน", "ดูรายงานทั้งองค์กร", "อนุมัติผลการประเมิน"] },
  { id: "manager",    label: "ผู้จัดการฝ่าย",     desc: "ประเมินและอนุมัติทีม",        cls: "b-green",
    perms: ["ดูพนักงานในหน่วยงานตนเอง", "ประเมินและอนุมัติผลของทีม", "เสนอ KPI หน่วยงาน", "ดูรายงานระดับหน่วยงาน"] },
  { id: "supervisor", label: "หัวหน้างาน",        desc: "ประเมินผู้ใต้บังคับบัญชา",     cls: "b-amber",
    perms: ["ประเมินผู้ใต้บังคับบัญชา", "บันทึก/ส่งผลการประเมิน", "ดูผลของทีมตนเอง"] },
  { id: "viewer",     label: "พนักงานทั่วไป",     desc: "ดูผลและประเมินตนเอง",         cls: "b-gray",
    perms: ["ดูผลการประเมินของตนเอง", "ทำแบบประเมินตนเอง"] },
];
const roleMeta = (id) => ROLES.find((r) => r.id === id) || { id, label: id, desc: "", cls: "b-gray" };
window.ROLES = ROLES;
window.roleMeta = roleMeta;

// ---------- CSV export (real download) ----------
function downloadCSV(filename, headers, rows) {
  const esc = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const lines = [headers.map(esc).join(",")].concat(rows.map((r) => r.map(esc).join(",")));
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
window.downloadCSV = downloadCSV;

const _num = (x) => (x == null ? null : Number(x));

async function loadHRData() {
  const tables = [
    "departments", "competencies", "employees", "jd_library", "notifications",
    "kpi_items", "jd_items", "kpi_defs", "submissions", "teams", "app_users", "performance_trend",
  ];
  const results = await Promise.all(
    tables.map((t) => sb.from(t).select("*").order("sort", { ascending: true }))
  );
  // app_settings is a single row (no sort column) — fetch separately
  results.push(await sb.from("app_settings").select("*").eq("id", 1).maybeSingle());
  const failed = results.filter((r) => r.error);
  if (failed.length) throw new Error(failed.map((r) => r.error.message).join(" · "));

  const [
    departments, competencies, empRows, jdLibrary, notifications,
    kpiItems, jdItems, kpiDefRows, subRows, teams, appUsers, trendRows, appSettings,
  ] = results.map((r) => r.data);

  // employees → re-attach computed fields the screens expect
  const EMPLOYEES = empRows.map((e) => {
    const overall = Math.round((e.kpi * 0.6 + e.comp * 0.4) * 10) / 10;
    const parts = (e.name || "").split(" ");
    const initials = (parts[0] ? parts[0][0] : "") + (parts[1] ? parts[1][0] : "");
    // อายุงาน is computed live from hire_date when available
    const tenure = e.hire_date ? tenureFrom(e.hire_date) : e.tenure;
    return { ...e, tenure, overall, initials, band: bandOf(overall) };
  });

  // kpi_defs → shape back into the nested form { target:{m,q,y}, range:[lo,hi], … }
  const KPI_DEFS = kpiDefRows.map((k) => ({
    id: k.id, dept: k.dept, name: k.name, en: k.en, unit: k.unit,
    method: k.method, weight: Number(k.weight),
    target: { m: _num(k.target_m), q: _num(k.target_q), y: _num(k.target_y) },
    actual: _num(k.actual), type: k.type, status: k.status, owner: k.owner,
    range: (k.range_lo != null && k.range_hi != null) ? [Number(k.range_lo), Number(k.range_hi)] : undefined,
    customScore: _num(k.custom_score), formula: k.formula, trendDown: k.trend_down,
  }));

  // submissions: files/versions/audit already arrive as parsed JSON
  const SUBMISSIONS = subRows.map((s) => ({ ...s }));

  // ----- company summary: headcount & status from the REAL employee records -----
  const total = EMPLOYEES.length;
  const cnt = (s) => EMPLOYEES.filter((e) => e.status === s).length;
  const done = cnt("done");
  const scored = EMPLOYEES.filter((e) => e.overall > 0);
  // weighted dept average (used as a fallback when employee scores aren't entered yet)
  const headSum = departments.reduce((a, d) => a + d.head, 0) || 1;
  const deptWavg = Math.round(departments.reduce((a, d) => a + Number(d.score) * d.head, 0) / headSum * 10) / 10;
  const avgScore = scored.length ? Math.round(scored.reduce((a, e) => a + e.overall, 0) / scored.length * 10) / 10 : deptWavg;
  const avgTrend = Math.round(departments.reduce((a, d) => a + Number(d.trend) * d.head, 0) / headSum * 10) / 10;
  const top = [...departments].sort((a, b) => b.score - a.score)[0] || { name: "—", score: 0 };
  const SUMMARY = {
    total, done, pending: total - done,
    avgScore, avgTrend,
    topDept: top.name, topDeptScore: Number(top.score),
    highPotential: EMPLOYEES.filter((e) => e.potential >= 3 && e.perf >= 3).length,
    atRisk: scored.filter((e) => e.overall < 60).length,
  };

  // status pie — real counts straight from the employee records (sums to total)
  const STATUS_PIE = [
    { label: "ประเมินแล้ว", v: done, color: "#16a34a" },
    { label: "กำลังประเมิน", v: cnt("progress"), color: "#2563eb" },
    { label: "รออนุมัติ", v: cnt("review"), color: "#e08a00" },
    { label: "รอประเมิน", v: cnt("pending"), color: "#cbd5e1" },
  ];

  // evaluation cycle year — single source of truth from app_settings
  let cycleYear = 2569;
  if (appSettings && appSettings.cycle_name) {
    const ym = String(appSettings.cycle_name).match(/(25\d{2}|20\d{2})/);
    if (ym) cycleYear = Number(ym[1]);
  }
  if (window.COMPANY) window.COMPANY.cycle = "รอบประเมินปี " + cycleYear;

  // monthly trend + competency radar from DB (fall back to static defaults if empty)
  const trCur = (trendRows || []).filter((t) => t.kind === "cur").map((t) => ({ m: t.label, v: Number(t.value) }));
  const trPrev = (trendRows || []).filter((t) => t.kind === "prev").map((t) => ({ m: t.label, v: Number(t.value) }));
  const compRadar = (competencies || []).filter((c) => c.avg_score != null).map((c) => ({ id: c.id, name: c.name, v: Number(c.avg_score) }));

  Object.assign(window, {
    DEPARTMENTS: departments, COMPETENCIES: competencies, EMPLOYEES,
    JD_LIBRARY: jdLibrary, NOTIFS: notifications, KPI_ITEMS: kpiItems, JD_ITEMS: jdItems,
    KPI_DEFS, SUBMISSIONS, TEAMS: teams, SUMMARY, STATUS_PIE,
    APP_USERS: appUsers || [], APP_SETTINGS: appSettings || null, CYCLE_YEAR: cycleYear,
    KPI_DEPTS: departments.filter((d) => KPI_DEFS.some((k) => k.dept === d.id)).map((d) => d.id),
    ...(trCur.length ? { TREND: trCur } : {}),
    ...(trPrev.length ? { TREND_PREV: trPrev } : {}),
    ...(compRadar.length ? { COMP_RADAR: compRadar } : {}),
  });
}

window.loadHRData = loadHRData;
