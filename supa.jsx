// supa.jsx — Supabase client + data loader
// Loads all HR data from Postgres into window globals so the existing
// screens (which read DEPARTMENTS, EMPLOYEES, KPI_DEFS, …) keep working.
// --------------------------------------------------------------------

const SUPABASE_URL = "https://mxubzxygthueoaunhiwq.supabase.co";
// Publishable key — safe to expose in client code; access is gated by RLS.
const SUPABASE_KEY = "sb_publishable_4C-xYuDcE0AZWvLZ5ZPEeQ_czQ29jQu";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window.sb = sb;
// URL สาธารณะคงที่ของโลโก้ (ใช้ได้แม้ยังไม่ล็อกอิน เช่น หน้าล็อกอิน)
window.LOGO_PUBLIC_URL = SUPABASE_URL + "/storage/v1/object/public/branding/org-logo";

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

// ---------- notifications helpers ----------
// อีเมล (บัญชีล็อกอิน) ของพนักงานจาก employee_id
window.empEmail = (empId) => { const a = (window.APP_USERS || []).find((u) => u.employee_id === empId); return a ? a.email : null; };
// ส่งการแจ้งเตือนถึงผู้รับ (ถ้าไม่มีอีเมลผู้รับ จะไม่ส่ง)
window.notify = async (recipientEmail, type, title, body) => {
  if (!recipientEmail) return;
  try { await window.sb.from("notifications").insert({ type: type || "info", title, body: body || null, recipient_email: recipientEmail }); } catch (e) { /* ignore */ }
};
// บันทึก audit log (ใครทำอะไร) — เงียบถ้าพลาด
window.audit = async (action, entity, detail) => {
  try {
    const email = (window.CURRENT_USER || {}).email || (await window.sb.auth.getUser()).data?.user?.email || null;
    await window.sb.from("audit_log").insert({ actor_email: email, action, entity: entity || null, detail: detail || null });
  } catch (e) { /* ignore */ }
};
window.markNotifsRead = async () => {
  const email = (window.CURRENT_USER || {}).email; if (!email) return;
  try { await window.sb.from("notifications").update({ read: true }).eq("recipient_email", email).eq("read", false); } catch (e) { /* ignore */ }
};

const _num = (x) => (x == null ? null : Number(x));

async function loadHRData() {
  // who is logged in right now (for permission gating + showing the real user)
  let authEmail = "";
  try { const { data } = await sb.auth.getUser(); authEmail = (data?.user?.email || "").toLowerCase(); } catch { /* not logged in */ }

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

  // ตารางใหม่ (ไม่มีคอลัมน์ sort) — โหลดแยก ไม่ให้ error ทำให้ทั้งระบบล่ม
  const [disc, trains, cycArc, audit] = await Promise.all([
    sb.from("disciplinary").select("*").order("date", { ascending: false }),
    sb.from("trainings").select("*").order("date", { ascending: false }),
    sb.from("cycle_archive").select("*").order("cycle_year", { ascending: true }),
    sb.from("audit_log").select("*").order("at", { ascending: false }).limit(50),
  ]);
  window.DISCIPLINARY = disc.data || [];
  window.TRAININGS = trains.data || [];
  window.CYCLE_ARCHIVE = cycArc.data || [];
  window.AUDIT_LOG = audit.data || [];

  const [
    departments, competencies, empRows, jdLibrary, notifications,
    kpiItems, jdItems, kpiDefRows, subRows, teams, appUsers, trendRows, appSettings,
  ] = results.map((r) => r.data);

  // การแจ้งเตือน: แสดงเฉพาะของผู้ใช้ปัจจุบัน (recipient_email = ตัวเอง) + broadcast (null) เรียงใหม่สุดก่อน
  const _relTime = (iso) => { if (!iso) return ""; const s = Math.floor((Date.now() - new Date(iso)) / 1000); if (s < 60) return "เมื่อสักครู่"; const m = Math.floor(s / 60); if (m < 60) return m + " นาทีที่แล้ว"; const h = Math.floor(m / 60); if (h < 24) return h + " ชั่วโมงที่แล้ว"; return Math.floor(h / 24) + " วันที่แล้ว"; };
  const myNotifs = (notifications || [])
    .filter((n) => !n.recipient_email || (n.recipient_email || "").toLowerCase() === authEmail)
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .map((n) => ({ ...n, time: n.time || _relTime(n.created_at) }));

  // evaluation cycle year — derived early so we can match this year's records
  let cycleYear = 2569;
  if (appSettings && appSettings.cycle_name) {
    const ym = String(appSettings.cycle_name).match(/(25\d{2}|20\d{2})/);
    if (ym) cycleYear = Number(ym[1]);
  }

  // evaluations are the single source of truth for an employee's final score & grade
  // (weighted KPI+Competency+JD per app_settings). Fall back to kpi/comp when not evaluated.
  const evalRes = await sb.from("evaluations").select("*").eq("cycle_year", cycleYear);
  if (evalRes.error) throw new Error(evalRes.error.message);
  const evalByEmp = {};
  (evalRes.data || []).forEach((r) => { evalByEmp[r.employee_id] = r; });

  // employees → re-attach computed fields the screens expect
  const EMPLOYEES = empRows.map((e) => {
    const ev = evalByEmp[e.id];
    const overall = ev && ev.overall != null
      ? Math.round(Number(ev.overall) * 10) / 10
      : Math.round((e.kpi * 0.6 + e.comp * 0.4) * 10) / 10;
    const parts = (e.name || "").split(" ");
    const initials = (parts[0] ? parts[0][0] : "") + (parts[1] ? parts[1][0] : "");
    // อายุงาน is computed live from hire_date when available
    const tenure = e.hire_date ? tenureFrom(e.hire_date) : e.tenure;
    return {
      ...e, tenure, overall, initials, band: bandOf(overall),
      eval: ev || null, jd_score: ev ? _num(ev.jd_score) : null,
    };
  });

  // department aggregates (head / done / avg score) computed LIVE from employees — never stale
  departments.forEach((d) => {
    const es = EMPLOYEES.filter((e) => e.dept === d.id);
    const dn = es.filter((e) => e.status === "done");
    d.head = es.length;
    d.done = dn.length;
    d.score = dn.length ? Math.round(dn.reduce((a, e) => a + e.overall, 0) / dn.length * 10) / 10 : 0;
  });

  // kpi_defs → shape back into the nested form { target:{m,q,y}, range:[lo,hi], … }
  const KPI_DEFS = kpiDefRows.map((k) => ({
    id: k.id, dept: k.dept, name: k.name, en: k.en, unit: k.unit,
    method: k.method, weight: Number(k.weight),
    target: { m: _num(k.target_m), q: _num(k.target_q), y: _num(k.target_y) },
    actual: _num(k.actual), type: k.type, status: k.status, owner: k.owner,
    range: (k.range_lo != null && k.range_hi != null) ? [Number(k.range_lo), Number(k.range_hi)] : undefined,
    customScore: _num(k.custom_score), formula: k.formula, trendDown: k.trend_down, section: k.section || null,
    detail: k.detail || null, target2568: k.target_2568 || null, frequency: k.frequency || "monthly",
  }));

  // monthly KPI results for the current cycle → map { [kpi_id]: { 1..12: value } }
  const monthlyRes = await sb.from("kpi_monthly").select("*").eq("year", cycleYear);
  const KPI_MONTHLY = {};
  if (!monthlyRes.error) (monthlyRes.data || []).forEach((m) => { (KPI_MONTHLY[m.kpi_id] = KPI_MONTHLY[m.kpi_id] || {})[m.month] = _num(m.value); });
  // actual = average of entered monthly results (so overview/scoring reflect monthly data)
  KPI_DEFS.forEach((k) => { const mm = KPI_MONTHLY[k.id]; if (mm) { const vs = Object.values(mm).filter((v) => v != null); if (vs.length) k.actual = Math.round(vs.reduce((a, b) => a + b, 0) / vs.length * 100) / 100; } });


  // submissions: files/versions/audit already arrive as parsed JSON
  const SUBMISSIONS = subRows.map((s) => ({ ...s }));

  // HR roster (demographic dataset for the HR data dashboard) — separate from eval employees
  const hrRes = await sb.from("hr_roster").select("*").order("sort", { ascending: true });
  const HR_ROSTER = hrRes.error ? [] : (hrRes.data || []);

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
    atRisk: scored.filter((e) => e.overall < 70).length, // เกรด D (ต้องพัฒนา)
  };

  // status pie — real counts straight from the employee records (sums to total)
  const STATUS_PIE = [
    { label: "ประเมินแล้ว", v: done, color: "#16a34a" },
    { label: "กำลังประเมิน", v: cnt("progress"), color: "#2563eb" },
    { label: "รออนุมัติ", v: cnt("review"), color: "#e08a00" },
    { label: "รอประเมิน", v: cnt("pending"), color: "#cbd5e1" },
  ];

  if (window.COMPANY) window.COMPANY.cycle = "รอบประเมินปี " + cycleYear;

  // monthly trend (historical, from DB if available)
  const trCur = (trendRows || []).filter((t) => t.kind === "cur").map((t) => ({ m: t.label, v: Number(t.value) }));
  const trPrev = (trendRows || []).filter((t) => t.kind === "prev").map((t) => ({ m: t.label, v: Number(t.value) }));

  // competency radar — คำนวณจากคะแนนสมรรถนะหลัก (Core/B1) ในใบประเมินจริง
  const coreAgg = {};
  (evalRes.data || []).forEach((r) => { const it = r.items; if (it && Array.isArray(it.b)) it.b.forEach((x) => { if ((x.grp || "") === "core") { const a = coreAgg[x.name] = coreAgg[x.name] || { s: 0, n: 0 }; a.s += Number(x.score) || 0; a.n++; } }); });
  const doneEmps2 = EMPLOYEES.filter((e) => e.status === "done");
  const avgCompScore = doneEmps2.length ? Math.round(doneEmps2.reduce((s, e) => s + (e.comp || 0), 0) / doneEmps2.length) : 0;
  const coreMinN = Math.max(3, Math.floor(doneEmps2.length * 0.5)); // ใช้คะแนนรายสมรรถนะเมื่อมีข้อมูลมากพอ ไม่งั้นใช้ค่าเฉลี่ยรวม
  let COMP_RADAR = (competencies || []).map((c) => { const a = coreAgg[c.name]; return { id: c.id, name: c.name, v: (a && a.n >= coreMinN) ? Math.round(a.s / a.n) : avgCompScore }; });
  if (!COMP_RADAR.length) COMP_RADAR = [{ id: "x", name: "สมรรถนะ", v: avgCompScore }];

  // grade distribution (real) for dashboard
  const GRADE_KEYS = [["A+", "#15803d"], ["A", "#16a34a"], ["B+", "#0d9488"], ["B", "#0891b2"], ["C", "#2563eb"], ["D", "#e11d48"]];
  const GRADE_DIST = GRADE_KEYS.map(([g, color]) => ({ g, color, n: EMPLOYEES.filter((e) => e.status === "done" && e.band.key === g).length }));

  const currentUser = (appUsers || []).find((u) => (u.email || "").toLowerCase() === authEmail)
    || (authEmail ? { name: authEmail.split("@")[0], email: authEmail, role: "viewer", active: true } : null);
  // ขอบเขตการมองเห็นตามหน่วยงาน: admin/hr เห็นทุกหน่วยงาน · อื่นๆ เห็นเฉพาะ dept_scope (หรือ dept ของตัวเอง)
  const _allAccess = !currentUser || currentUser.role === "admin" || currentUser.role === "hr";
  const _scopeDepts = _allAccess ? [] : (Array.isArray(currentUser.dept_scope) && currentUser.dept_scope.length
    ? currentUser.dept_scope
    : (currentUser.dept ? [currentUser.dept] : []));
  window.SCOPE = { all: _allAccess, depts: _scopeDepts };
  window.inScope = (deptId) => window.SCOPE.all || window.SCOPE.depts.indexOf(deptId) > -1;
  window.scopeEmployees = (list) => window.SCOPE.all ? (list || []) : (list || []).filter((e) => window.SCOPE.depts.indexOf(e.dept) > -1);

  Object.assign(window, {
    DEPARTMENTS: departments, COMPETENCIES: competencies, EMPLOYEES,
    JD_LIBRARY: jdLibrary, NOTIFS: myNotifs, KPI_ITEMS: kpiItems, JD_ITEMS: jdItems,
    KPI_DEFS, KPI_MONTHLY, SUBMISSIONS, TEAMS: teams, SUMMARY, STATUS_PIE, COMP_RADAR, GRADE_DIST, HR_ROSTER,
    APP_USERS: appUsers || [], APP_SETTINGS: appSettings || null, CYCLE_YEAR: cycleYear,
    CURRENT_USER: currentUser,
    KPI_DEPTS: departments.filter((d) => KPI_DEFS.some((k) => k.dept === d.id)).map((d) => d.id),
    ...(trCur.length ? { TREND: trCur } : {}),
    ...(trPrev.length ? { TREND_PREV: trPrev } : {}),
  });
}

window.loadHRData = loadHRData;
