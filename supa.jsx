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
  { id: "admin",      label: "ผู้ดูแลระบบ",      desc: "เข้าถึงทุกฟังก์ชัน",          cls: "b-blue" },
  { id: "hr",         label: "ฝ่ายบุคคล (HR)",   desc: "จัดการการประเมินทั้งองค์กร", cls: "b-teal" },
  { id: "manager",    label: "ผู้จัดการฝ่าย",     desc: "ประเมินและอนุมัติทีม",        cls: "b-green" },
  { id: "supervisor", label: "หัวหน้างาน",        desc: "ประเมินผู้ใต้บังคับบัญชา",     cls: "b-amber" },
  { id: "viewer",     label: "พนักงานทั่วไป",     desc: "ดูผลและประเมินตนเอง",         cls: "b-gray" },
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
    "kpi_items", "jd_items", "kpi_defs", "submissions", "teams", "app_users",
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
    kpiItems, jdItems, kpiDefRows, subRows, teams, appUsers, appSettings,
  ] = results.map((r) => r.data);

  // employees → re-attach computed fields the screens expect
  const EMPLOYEES = empRows.map((e) => {
    const overall = Math.round((e.kpi * 0.6 + e.comp * 0.4) * 10) / 10;
    const parts = (e.name || "").split(" ");
    const initials = (parts[0] ? parts[0][0] : "") + (parts[1] ? parts[1][0] : "");
    return { ...e, overall, initials, band: bandOf(overall) };
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

  // derived company summary
  const total = departments.reduce((a, d) => a + d.head, 0);
  const done = departments.reduce((a, d) => a + d.done, 0);
  const top = [...departments].sort((a, b) => b.score - a.score)[0] || { name: "—", score: 0 };
  const SUMMARY = {
    total, done, pending: total - done,
    avgScore: 84.7, avgTrend: 1.8,
    topDept: top.name, topDeptScore: Number(top.score),
    highPotential: 9, atRisk: 6,
  };
  const STATUS_PIE = [
    { label: "ประเมินแล้ว", v: done, color: "#16a34a" },
    { label: "กำลังประเมิน", v: 22, color: "#2563eb" },
    { label: "รออนุมัติ", v: 18, color: "#e08a00" },
    { label: "รอประเมิน", v: total - done - 22 - 18, color: "#cbd5e1" },
  ];

  Object.assign(window, {
    DEPARTMENTS: departments, COMPETENCIES: competencies, EMPLOYEES,
    JD_LIBRARY: jdLibrary, NOTIFS: notifications, KPI_ITEMS: kpiItems, JD_ITEMS: jdItems,
    KPI_DEFS, SUBMISSIONS, TEAMS: teams, SUMMARY, STATUS_PIE,
    APP_USERS: appUsers || [], APP_SETTINGS: appSettings || null,
  });
}

window.loadHRData = loadHRData;
