// app.jsx — shell, routing, sidebar, topbar, tweaks
const { useState: useA, useEffect: useAE } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dashLayout": "airy",
  "accent": "#2563eb",
  "sidebarStyle": "navy",
  "density": "regular",
  "fontScale": 100,
  "cardRadius": 14
}/*EDITMODE-END*/;

const ACCENTS = {
  "#2563eb": { c600: "#1d4ed8", c700: "#1e40af", soft: "#eff4ff", soft2: "#dbe7ff" },
  "#1e3a8a": { c600: "#1c357d", c700: "#172b66", soft: "#eef2fb", soft2: "#d9e2f5" },
  "#0d9488": { c600: "#0c8378", c700: "#0f766e", soft: "#e6f6f4", soft2: "#cdeee9" },
  "#4f46e5": { c600: "#4338ca", c700: "#3730a3", soft: "#eef0fe", soft2: "#dcdffb" },
};

// ===== BWP HR Connect — แบ่งเป็นโมดูล (แต่ละโมดูลมีเมนูของตัวเอง) =====
const MODULES = [
  { id: "people", label: "บุคลากร", en: "People & Data", icon: "users" },
  { id: "perf", label: "ประเมินผล", en: "Performance", icon: "eval" },
];
const NAV = [
  // โมดูล: บุคลากร
  { id: "employee", label: "พนักงาน", icon: "employee", mod: "people" },
  { id: "hrdata", label: "ข้อมูลพนักงาน (HR)", icon: "users", mod: "people" },
  { id: "analytics", label: "สถิติหน่วยงาน", icon: "trend", mod: "people" },
  { id: "manage", label: "จัดการข้อมูล", icon: "settings", mod: "people" },
  // โมดูล: ประเมินผล
  // ประเมินประจำปีแบบใหม่ (ตาม JD) — แทนฟอร์มประเมิน/ติดตามการประเมิน/Calibration แบบเดิม
  { id: "annual", label: "ประเมินประจำปี", icon: "eval", mod: "perf" },
  { id: "dashboard", label: "ภาพรวมการประเมิน", icon: "dashboard", mod: "perf" },
  { id: "kpi", label: "KPI หน่วยงาน", icon: "deptkpi", mod: "perf" },
  { id: "jd", label: "จัดการ JD", icon: "jd", mod: "perf" },
  { id: "exec", label: "มุมมองผู้บริหาร", icon: "trend", mod: "perf" },
  { id: "reports", label: "รายงาน", icon: "reports", mod: "perf" },
];
// หน้าระบบประเมินแบบเดิม — ซ่อนจากเมนู (ยังเปิดตรงได้ถ้าจำเป็น) ไม่ลบ
const LEGACY_PAGES = ["eval", "evaltrack", "calibration"];
// หน้าที่ไม่อยู่ในเมนู แต่สังกัดโมดูล (ใช้ไฮไลต์โมดูลให้ถูกตอนเปิดหน้านั้น)
const PAGE_MODULE = { profile: "people", settings: "people" };
const moduleOfPage = (id) => PAGE_MODULE[id] || (NAV.find((n) => n.id === id) || {}).mod || "perf";
// สิทธิ์เข้าถึงหน้าตามบทบาท ("*" = ทุกหน้า)
const ROLE_PAGES = {
  admin: "*",
  hr: "*",
  manager: ["annual", "dashboard", "employee", "hrdata", "analytics", "kpi", "profile"],
  supervisor: ["annual", "dashboard", "employee", "hrdata", "analytics", "profile"],
  viewer: ["dashboard", "hrdata", "profile"],
};
const pagesFor = (role) => ROLE_PAGES[role] || ROLE_PAGES.viewer;
// หน้าในระบบประเมินประจำปีใช้ route "ann:<หน้า>" — สิทธิ์เท่ากับหน้า "annual"
const baseRoute = (id) => String(id).startsWith("ann:") ? "annual" : id;
const canSeePage = (role, id) => { const p = pagesFor(role); return p === "*" || p.indexOf(baseRoute(id)) > -1; };

// ===== เมนูด้านซ้ายแบบ Prosoft HCM (กลุ่ม › เมนูย่อย) — hr: true = เฉพาะ HR/admin =====
const SIDE_MENU = [
  { id: "ann:home", label: "หน้าแรก", icon: "home" },
  { id: "g_setup", label: "ตั้งค่าระบบ", icon: "settings", hr: true, children: [
    ["ann:hub", "ภาพรวมการตั้งค่า"], ["ann:cycle", "รอบประเมิน & เกณฑ์"], ["ann:setup", "รายชื่อ & ผู้ประเมิน"], ["ann:exclude", "ผู้ที่ไม่ต้องประเมิน"],
    ["ann:items", "หัวข้อประเมิน (JD)"], ["ann:deduct", "คะแนนหัก (ตอกบัตร/ใบเตือน)"], ["jd", "จัดการ JD"], ["manage", "จัดการข้อมูล"], ["settings", "ตั้งค่าทั่วไป"]] },
  { id: "g_perf", label: "การประเมินผลงาน", icon: "eval", children: [
    ["ann:flow", "ขั้นตอนการประเมิน"], ["ann:forms", "ใบประเมินทั้งหมด", "hr"], ["ann:mine", "ใบประเมินของหน่วยงาน", "nohr"], ["ann:overview", "สรุปผลการประเมิน"],
    ["ann:calib", "ปรับผล (Calibration)", "hr"], ["ann:reports-inform", "แจ้งผลการประเมิน", "hr"]] },
  { id: "ann:approve", label: "ศูนย์อนุมัติ", icon: "checkCircle", badge: "approve" },
  { id: "ann:todo", label: "งานของฉัน", icon: "list", badge: "todo" },
  { id: "g_rep", label: "รายงาน", icon: "reports", hr: true, children: [
    ["ann:reports", "รายงานทั้งหมด"], ["ann:reports-annual", "ผลประเมินประจำปี"], ["ann:reports-approval", "สถานะการอนุมัติ"], ["ann:reports-adjust", "การปรับเกรด/คะแนน"],
    ["ann:reports-deduct", "คะแนนหักการมาทำงาน"], ["ann:reports-dept", "สรุปผลรายหน่วยงาน"]] },
  { id: "g_people", label: "ข้อมูลพนักงาน", icon: "users", children: [["employee", "รายชื่อพนักงาน"], ["hrdata", "แดชบอร์ดกำลังคน"], ["analytics", "สถิติหน่วยงาน"]] },
  { id: "g_more", label: "วิเคราะห์เพิ่มเติม", icon: "trend", children: [["dashboard", "แดชบอร์ดผลประเมิน"], ["exec", "มุมมองผู้บริหาร"], ["reports", "รายงานวิเคราะห์"], ["kpi", "KPI หน่วยงาน (ยังไม่นับคะแนน)"]] },
];
const ANN_TITLES = {
  home: "หน้าแรก", flow: "ขั้นตอนการประเมิน", hub: "ตั้งค่าระบบ", mine: "ใบประเมินของหน่วยงาน", forms: "ใบประเมินทั้งหมด", todo: "งานของฉัน",
  approve: "ศูนย์อนุมัติ", overview: "สรุปผลการประเมิน", calib: "ปรับผล (Calibration)", setup: "รายชื่อ & ผู้ประเมิน", exclude: "ผู้ที่ไม่ต้องประเมิน",
  deduct: "คะแนนหัก (ตอกบัตร/ใบเตือน)", items: "หัวข้อประเมิน (JD)", reports: "รายงาน", cycle: "รอบประเมิน & เกณฑ์",
  "reports-annual": "รายงานผลประเมินประจำปี", "reports-approval": "รายงานตรวจสอบสถานะการอนุมัติ", "reports-adjust": "รายงานการปรับเกรด/คะแนน",
  "reports-deduct": "รายงานคะแนนหักการมาทำงานและใบเตือน", "reports-dept": "สรุปผลรายหน่วยงาน", "reports-inform": "แจ้งผลการประเมิน",
};
const routeTitle = (r) => String(r).startsWith("ann:") ? ANN_TITLES[r.slice(4)] || "ประเมินผลประจำปี" : (TITLES[r] || [""])[0];
const canSeeSettings = (role) => role === "admin" || role === "hr";

const TITLES = {
  annual: ["ประเมินผลประจำปี", "Annual Evaluation"],
  dashboard: ["ภาพรวมการประเมิน", "Performance Dashboard"],
  exec: ["มุมมองผู้บริหาร", "Executive Drill-down"],
  employee: ["พนักงาน", "Employee Directory"],
  hrdata: ["แดชบอร์ดข้อมูลพนักงาน", "HR Workforce Dashboard"],
  analytics: ["สถิติหน่วยงาน", "HR Analytics"],
  evaltrack: ["ติดตามการประเมิน", "Evaluation Tracking"],
  profile: ["ข้อมูลพนักงาน", "Employee Profile"],
  kpi: ["KPI หน่วยงาน", "Department KPI"],
  eval: ["ฟอร์มประเมินผล", "Evaluation Form"],
  jd: ["จัดการ JD", "Job Description"],
  reports: ["รายงาน", "Reports & Analytics"],
  calibration: ["Calibration", "Talent Calibration"],
  manage: ["จัดการข้อมูล", "Data Management"],
  settings: ["ตั้งค่า", "Settings"],
};

// โลโก้ BWP — ใช้รูปที่อัปโหลด (app_settings.logo_url) ก่อน, ไม่มีก็ใช้ logo.svg, สุดท้าย fallback ตัวอักษร "BW"
function LogoMark({ fontSize = 16 }) {
  const [stage, setStage] = useA(0); // 0=uploaded, 1=svg, 2=text
  const uploaded = (window.APP_SETTINGS || {}).logo_url || "";
  const src = stage === 0 && uploaded ? uploaded : "logo.svg";
  if (stage >= 2) return <b style={{ fontSize, fontWeight: 700 }}>BW</b>;
  return <img src={src} alt="BWP" onError={() => setStage((s) => s + 1)} style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 8 }} />;
}

function BootSplash({ text, error }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0a1832", color: "#fff" }}>
      <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
        <div className="side-logo" style={{ width: 56, height: 56, margin: "0 auto 18px" }}><LogoMark fontSize={20} /></div>
        <div style={{ fontWeight: 600, fontSize: 16 }}>{COMPANY.name}</div>
        <div style={{ marginTop: 10, color: error ? "#ffb4c0" : "rgba(255,255,255,.62)", fontSize: 13.5, lineHeight: 1.6 }}>{text}</div>
        {!error && <div className="boot-spin" style={{ margin: "20px auto 0" }} />}
      </div>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [session, setSession] = useA(null);
  const [checking, setChecking] = useA(true);
  const [dataReady, setDataReady] = useA(false);
  const [loadErr, setLoadErr] = useA(null);
  const [route, setRoute] = useA("ann:home");
  const [annCounts, setAnnCounts] = useA({ todo: 0, approve: 0 });
  const [annOpenId, setAnnOpenId] = useA(null);
  const [openGroups, setOpenGroups] = useA({ g_perf: true });
  const [empId, setEmpId] = useA("E1000");
  const [evalEmp, setEvalEmp] = useA("");
  const [year, setYear] = useA(String(window.CYCLE_YEAR || "2569"));
  const [collapsed, setCollapsed] = useA(false);
  const [mobileOpen, setMobileOpen] = useA(false);
  const [notifOpen, setNotifOpen] = useA(false);
  const [menuOpen, setMenuOpen] = useA(false);
  const [pwOpen, setPwOpen] = useA(false);
  const [searchQ, setSearchQ] = useA("");
  const [subId, setSubId] = useA(null);
  const [execDept, setExecDept] = useA(null);
  const [dataVer, setDataVer] = useA(0);

  // re-fetch all HR data from Supabase and re-render (used after inserts/edits)
  const refresh = async () => { await loadHRData(); setDataVer((v) => v + 1); };

  // apply tweaks → CSS vars
  useAE(() => {
    const r = document.documentElement.style;
    const a = ACCENTS[t.accent] || ACCENTS["#2563eb"];
    r.setProperty("--accent", t.accent);
    r.setProperty("--accent-600", a.c600);
    r.setProperty("--accent-700", a.c700);
    r.setProperty("--accent-soft", a.soft);
    r.setProperty("--accent-soft-2", a.soft2);
    r.setProperty("--r", (t.cardRadius || 14) + "px");
    document.body.style.fontSize = (t.fontScale || 100) + "%";
  }, [t.accent, t.cardRadius, t.fontScale]);

  // Supabase auth session
  useAE(() => {
    let mounted = true;
    window.sb.auth.getSession().then(({ data }) => { if (mounted) { setSession(data.session); setChecking(false); } });
    const { data: sub } = window.sb.auth.onAuthStateChange((_evt, s) => { if (mounted) setSession(s); });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  // load HR data from Supabase once authenticated
  useAE(() => {
    if (session && !dataReady) {
      loadHRData().then(() => setDataReady(true)).catch((e) => setLoadErr(e.message || String(e)));
    }
    if (!session) { setDataReady(false); setLoadErr(null); }
  }, [session]);

  // "annual" (ลิงก์เดิมจากหน้าอื่น) → หน้าใบประเมินของระบบใหม่
  const go = (rt0) => { const rt = rt0 === "annual" ? (["admin", "hr"].includes((window.CURRENT_USER || {}).role) ? "ann:forms" : "ann:mine") : rt0; setRoute(rt); setMobileOpen(false); setNotifOpen(false); setMenuOpen(false); if (rt !== "exec") setExecDept(null); window.scrollTo(0, 0); };
  const openEmp = (id) => { setEmpId(id); go("profile"); };
  // ปุ่ม "ประเมิน" ในหน้าพนักงาน/JD ยังเรียกตัวนี้อยู่ — ส่งไปหน้าประเมินประจำปีแบบใหม่ ไม่ให้ไปเขียนตาราง evaluations เดิม
  const startEval = (id) => { setEvalEmp(id); go("annual"); };
  const openSub = (id) => setSubId(id);
  const goExec = (deptId) => { setExecDept(deptId); setRoute("exec"); setMobileOpen(false); window.scrollTo(0, 0); };

  const ctx = { t, setTweak, go, openEmp, startEval, openSub, goExec, empId, evalEmp, year, setYear, execDept, refresh, dataVer,
    setAnnCounts, annOpenId, setAnnOpenId };

  const Panel = (
    <TweaksPanel>
      <TweakSection label="เลย์เอาต์ Dashboard" />
      <TweakRadio label="รูปแบบ" value={t.dashLayout}
        options={[{ value: "airy", label: "โปร่ง" }, { value: "analytics", label: "วิเคราะห์" }, { value: "focus", label: "โฟกัส" }]}
        onChange={(v) => setTweak("dashLayout", v)} />
      <TweakSection label="ธีม" />
      <TweakColor label="สีหลัก" value={t.accent}
        options={["#2563eb", "#1e3a8a", "#0d9488", "#4f46e5"]}
        onChange={(v) => setTweak("accent", v)} />
      <TweakRadio label="แถบเมนู" value={t.sidebarStyle}
        options={[{ value: "navy", label: "น้ำเงินเข้ม" }, { value: "light", label: "สว่าง" }]}
        onChange={(v) => setTweak("sidebarStyle", v)} />
      <TweakSection label="การแสดงผล" />
      <TweakRadio label="ความหนาแน่น" value={t.density}
        options={[{ value: "compact", label: "แน่น" }, { value: "regular", label: "ปกติ" }, { value: "comfy", label: "โปร่ง" }]}
        onChange={(v) => setTweak("density", v)} />
      <TweakSlider label="ขนาดตัวอักษร" value={t.fontScale} min={90} max={115} step={5} unit="%"
        onChange={(v) => setTweak("fontScale", v)} />
      <TweakSlider label="ความโค้งการ์ด" value={t.cardRadius} min={6} max={22} step={2} unit="px"
        onChange={(v) => setTweak("cardRadius", v)} />
    </TweaksPanel>
  );

  if (checking) return (<><BootSplash text="กำลังเริ่มระบบ…" /><ToastHost />{Panel}</>);
  if (!session) return (<><LoginScreen onLogin={() => {}} logo={(window.APP_SETTINGS || {}).logo_url || window.LOGO_PUBLIC_URL || "logo.svg"} /><ToastHost />{Panel}</>);
  if (loadErr) return (<><BootSplash text={"โหลดข้อมูลไม่สำเร็จ · " + loadErr} error /><ToastHost />{Panel}</>);
  if (!dataReady) return (<><BootSplash text="กำลังโหลดข้อมูล…" /><ToastHost />{Panel}</>);

  const cu = window.CURRENT_USER || {};
  const cuRole = (window.roleMeta ? window.roleMeta(cu.role) : { label: cu.role || "" });
  const cuName = cu.name || "ผู้ใช้งาน";
  const cuInitials = (cuName.trim()[0] || "U");
  // จำกัดสิทธิ์เข้าหน้า: ถ้าหน้าปัจจุบันไม่ได้รับอนุญาต ให้ตกกลับไปหน้าภาพรวม
  const routeAllowed = (r) => r === "settings" ? canSeeSettings(cu.role) : canSeePage(cu.role, r);
  const effRoute = routeAllowed(route) ? route : "ann:home";
  const isHR = canSeeSettings(cu.role);
  // หาพนักงานที่ตรงกับบัญชีผู้ใช้: ใช้ employee_id ที่ผูกไว้ก่อน แล้วค่อย fallback เทียบชื่อ
  const _normName = (s) => (s || "").replace(/^(นาย|นางสาว|นาง|คุณ|น\.ส\.)\s*/, "").replace(/\s+/g, "").toLowerCase();
  const myEmp = (cu.employee_id && (window.EMPLOYEES || []).find((e) => e.id === cu.employee_id))
    || (window.EMPLOYEES || []).find((e) => _normName(e.name) === _normName(cuName)) || null;
  const openMyProfile = () => { if (myEmp) openEmp(myEmp.id); else toast("บัญชีนี้เป็นบัญชีหน่วยงาน — ไม่ได้ผูกกับพนักงานคนใด", "info"); };

  // เมนูที่บัญชีนี้เห็น (ตัดเมนูย่อยที่ไม่มีสิทธิ์ · กลุ่มที่ไม่เหลือเมนูย่อยไม่แสดง)
  const okItem = (id, flag) => routeAllowed(id) && (flag !== "hr" || isHR) && (flag !== "nohr" || !isHR);
  const menu = SIDE_MENU.filter((m) => !m.hr || isHR).map((m) => m.children ? { ...m, children: m.children.filter(([id, , f]) => okItem(id, f)) } : m)
    .filter((m) => m.children ? m.children.length : routeAllowed(m.id));
  const curGroup = menu.find((m) => m.children && m.children.some(([id]) => id === effRoute || (effRoute === "profile" && id === "employee")));
  const title = effRoute === "profile" ? "ข้อมูลพนักงาน" : routeTitle(effRoute);
  const crumbs = ["หน้าแรก", ...(curGroup ? [curGroup.label] : []), ...(effRoute !== "ann:home" ? [title] : [])];
  const badge = (k) => k && annCounts[k] ? <span className="hcm-badge">{annCounts[k]}</span> : null;
  const toggleGroup = (id) => setOpenGroups((o) => ({ ...o, [id]: !o[id] }));

  const topNav = [
    ["home", "หน้าแรก", "ann:home"], ["checkCircle", "ศูนย์อนุมัติ", "ann:approve", "approve"], ["list", "งานของฉัน", "ann:todo", "todo"],
    ...(isHR ? [["settings", "ตั้งค่า", "ann:hub"]] : [["lock", "เปลี่ยนรหัสผ่าน", "pw"]]),
  ];

  return (
    <div className="hcm" data-density={t.density}>
      {/* ===== แถบบนสีน้ำเงิน (Home / Approve Center / Todo List / Setting / Log Out) ===== */}
      <header className="hcm-top">
        <button className="hcm-burger" aria-label="เปิดเมนู" onClick={() => setMobileOpen(!mobileOpen)}><Icon name="menu" size={22} /></button>
        <div className="hcm-brand" onClick={() => go("ann:home")}>
          <span className="hcm-logo"><LogoMark fontSize={14} /></span>
          <span className="hcm-brand-t"><b>BWP <em>HR</em> Performance</b><small>Human Capital Management</small></span>
        </div>
        <nav className="hcm-topnav">
          {topNav.map(([ic, l, r, k]) => (
            <button key={l} className={"hcm-tn" + (effRoute === r ? " on" : "")} onClick={() => r === "pw" ? setPwOpen(true) : go(r)}>
              <span className="i"><Icon name={ic} size={22} stroke={1.8} />{badge(k)}</span><span className="l">{l}</span>
            </button>
          ))}
          <button className="hcm-tn" onClick={() => { if (window.confirm("ออกจากระบบ?")) window.sb.auth.signOut(); }}>
            <span className="i"><Icon name="logout" size={22} stroke={1.8} /></span><span className="l">ออกจากระบบ</span>
          </button>
        </nav>
        <div className="hcm-who"><b>{cuName}</b><span>{cuRole.label}</span></div>
      </header>

      <div className="hcm-body">
        {mobileOpen && <div className="scrim-side" onClick={() => setMobileOpen(false)} />}
        {/* ===== เมนูซ้าย: โปรไฟล์ + เมนูแบบกลุ่ม ===== */}
        <aside className={"hcm-side" + (mobileOpen ? " open" : "") + (collapsed ? " mini" : "")}>
          <div className="hcm-prof">
            <div className="hcm-prof-av" onClick={openMyProfile}><Avatar name={cuName} initials={cuInitials} color="#2f6db5" size={64} /></div>
            <div className="hcm-prof-r">
              <div className="row" style={{ gap: 6, justifyContent: "space-between" }}>
                <button className="hcm-bell" aria-label="การแจ้งเตือน" onClick={() => { setNotifOpen(!notifOpen); setMenuOpen(false); }}>
                  <Icon name="bell" size={19} />{NOTIFS.length > 0 && <span className="hcm-badge">{NOTIFS.length}</span>}
                </button>
                <button className="hcm-mini-btn" aria-label="ย่อ/ขยายเมนู" onClick={() => setCollapsed(!collapsed)}><Icon name="menu" size={18} /></button>
              </div>
              <b>{cuName}</b>
              <span><Icon name="user" size={13} /> {cuRole.label}</span>
              <button className="hcm-link" onClick={() => setPwOpen(true)}>เปลี่ยนรหัสผ่าน</button>
            </div>
            {notifOpen && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={() => setNotifOpen(false)} />
                <div className="card" style={{ position: "absolute", left: 12, top: 96, width: 320, zIndex: 50, boxShadow: "var(--shadow-lg)", overflow: "hidden" }}>
                  <div className="card-head" style={{ padding: "12px 16px" }}><h3 style={{ fontSize: 14 }}>การแจ้งเตือน</h3><div className="spacer" /><span className="muted" style={{ fontSize: 12 }}>{NOTIFS.length} ใหม่</span></div>
                  <div style={{ maxHeight: 340, overflowY: "auto" }}>
                    {NOTIFS.map((n) => (
                      <div key={n.id} style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-2)" }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{n.title}</div><div className="muted" style={{ fontSize: 12 }}>{n.body}</div><div className="muted-3" style={{ fontSize: 11 }}>{n.time}</div>
                      </div>
                    ))}
                    {!NOTIFS.length && <div className="muted" style={{ padding: 16, fontSize: 13 }}>ไม่มีการแจ้งเตือน</div>}
                  </div>
                  {NOTIFS.length > 0 && <button className="btn btn-soft btn-sm" style={{ margin: 10, width: "calc(100% - 20px)" }} onClick={async () => { setNotifOpen(false); await window.markNotifsRead(); await refresh(); toast("ทำเครื่องหมายอ่านทั้งหมดแล้ว", "check"); }}>อ่านทั้งหมด</button>}
                </div>
              </>
            )}
          </div>
          <nav className="hcm-menu">
            {menu.map((m) => m.children ? (
              <div key={m.id} className={"hcm-grp" + (openGroups[m.id] || curGroup === m ? " open" : "")}>
                <button className={"hcm-mi" + (curGroup === m ? " in" : "")} onClick={() => toggleGroup(m.id)} title={m.label}>
                  <Icon name={m.icon} size={19} stroke={1.9} /><span className="l">{m.label}</span><Icon name="chevRight" size={15} />
                </button>
                {(openGroups[m.id] || curGroup === m) && !collapsed && (
                  <div className="hcm-sub">
                    {m.children.map(([id, l]) => (
                      <button key={id} className={"hcm-si" + (effRoute === id || (effRoute === "profile" && id === "employee") ? " on" : "")} onClick={() => go(id)}>{l}</button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <button key={m.id} className={"hcm-mi" + (effRoute === m.id ? " on" : "")} onClick={() => go(m.id)} title={m.label}>
                <Icon name={m.icon} size={19} stroke={1.9} /><span className="l">{m.label}</span>{badge(m.badge)}
              </button>
            ))}
            <a className="hcm-mi" href="https://bwp-hr-connect.vercel.app/" style={{ textDecoration: "none" }} title="กลับหน้ารวมระบบ HR">
              <Icon name="chevLeft" size={19} stroke={1.9} /><span className="l">กลับหน้ารวมระบบ HR</span>
            </a>
          </nav>
        </aside>

        <div className="hcm-main">
          {/* breadcrumb + ค้นหาพนักงาน */}
          <div className="hcm-crumb">
            <Icon name="home" size={15} />
            {crumbs.map((c, i) => <React.Fragment key={i}>{i > 0 && <span className="sep">›</span>}<span className={i === crumbs.length - 1 ? "cur" : ""} onClick={i === 0 ? () => go("ann:home") : undefined} style={i === 0 ? { cursor: "pointer" } : undefined}>{c}</span></React.Fragment>)}
            <div className="top-spacer" />
            <div className="hcm-search hide-xs">
              <Icon name="search" size={15} />
              <input aria-label="ค้นหาพนักงาน" placeholder="ค้นหาพนักงาน…" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} />
              {searchQ.trim().length >= 2 && (() => {
                const ql = searchQ.trim().toLowerCase();
                const res = window.scopeEmployees(window.EMPLOYEES || []).filter((e) => (e.name || "").toLowerCase().includes(ql) || (e.position || "").toLowerCase().includes(ql) || String(e.id).includes(ql)).slice(0, 8);
                return (
                  <div className="card" style={{ position: "absolute", top: 36, right: 0, width: 320, zIndex: 60, boxShadow: "var(--shadow-lg)", padding: 6, maxHeight: 360, overflowY: "auto" }}>
                    {res.length === 0 ? <div className="muted" style={{ padding: "10px 12px", fontSize: 13 }}>ไม่พบผลลัพธ์</div> : res.map((e) => (
                      <button key={e.id} className="row hcm-sr" onClick={() => { openEmp(e.id); setSearchQ(""); }}>
                        <Avatar name={e.name} initials={e.initials} color={e.color} size={28} />
                        <div style={{ minWidth: 0, textAlign: "left" }}><div style={{ fontWeight: 600, fontSize: 13 }}>{e.name}</div><div className="muted" style={{ fontSize: 11.5 }}>{e.position} · {window.deptShort ? window.deptShort(e.dept) : e.dept}</div></div>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
          <main className="content">
            {effRoute !== "ann:home" && <h1 className="hcm-title">{title}</h1>}
            {effRoute.startsWith("ann:") && <AnnualEval ctx={ctx} page={effRoute.slice(4)} />}
            {effRoute === "dashboard" && <Dashboard ctx={ctx} />}
            {effRoute === "exec" && <ExecDashboard ctx={ctx} />}
            {effRoute === "employee" && <EmployeeList ctx={ctx} />}
            {effRoute === "hrdata" && <HRDataDashboard ctx={ctx} />}
            {effRoute === "analytics" && <HRAnalytics ctx={ctx} />}
            {effRoute === "evaltrack" && <EvalTracking ctx={ctx} />}
            {effRoute === "profile" && <EmployeeProfile ctx={ctx} empId={empId} />}
            {effRoute === "kpi" && <KPIModule ctx={ctx} />}
            {effRoute === "eval" && <Evaluation key={ctx.evalEmp} ctx={ctx} />}
            {effRoute === "jd" && <JDManagement ctx={ctx} />}
            {effRoute === "reports" && <Reports ctx={ctx} />}
            {effRoute === "calibration" && <Calibration ctx={ctx} />}
            {effRoute === "manage" && <DataManagement ctx={ctx} />}
            {effRoute === "settings" && <Settings ctx={ctx} />}
          </main>
          <footer className="hcm-foot">Powered by BWP HR Connect © 2569 บริษัท เบสท์เวิลด์ อินเตอร์พลาส จำกัด</footer>
        </div>
      </div>

      {subId && <SubmissionDrawer subId={subId} onClose={() => setSubId(null)} ctx={ctx} />}
      {pwOpen && <ChangePasswordModal onClose={() => setPwOpen(false)} />}
      <ToastHost />
      {Panel}
    </div>
  );
}

// เปลี่ยนรหัสผ่านของตัวเอง (ผู้ใช้ที่ล็อกอินอยู่)
function ChangePasswordModal({ onClose }) {
  const [p1, setP1] = useA("");
  const [p2, setP2] = useA("");
  const [busy, setBusy] = useA(false);
  const [err, setErr] = useA("");
  const save = async () => {
    if (p1.length < 6) { setErr("รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร"); return; }
    if (p1 !== p2) { setErr("รหัสผ่านทั้งสองช่องไม่ตรงกัน"); return; }
    setErr(""); setBusy(true);
    const { error } = await window.sb.auth.updateUser({ password: p1 });
    setBusy(false);
    if (error) { setErr("เปลี่ยนไม่สำเร็จ: " + error.message); return; }
    toast("เปลี่ยนรหัสผ่านเรียบร้อย", "check"); onClose();
  };
  return (
    <Modal title="เปลี่ยนรหัสผ่าน" onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button className="btn btn-pri" onClick={save} disabled={busy}><Icon name="check" size={15} />{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {err && <div style={{ padding: "10px 13px", borderRadius: 10, background: "var(--red-soft)", color: "#be123c", fontSize: 13 }}>{err}</div>}
        <div className="field"><label>รหัสผ่านใหม่</label><input className="input" type="password" value={p1} onChange={(e) => setP1(e.target.value)} placeholder="อย่างน้อย 6 ตัวอักษร" /></div>
        <div className="field"><label>ยืนยันรหัสผ่านใหม่</label><input className="input" type="password" value={p2} onChange={(e) => setP2(e.target.value)} /></div>
      </div>
    </Modal>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
