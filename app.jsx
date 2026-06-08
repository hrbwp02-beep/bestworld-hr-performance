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

const NAV = [
  { id: "dashboard", label: "ภาพรวม", icon: "dashboard" },
  { id: "exec", label: "มุมมองผู้บริหาร", icon: "trend" },
  { id: "employee", label: "พนักงาน", icon: "employee" },
  { id: "hrdata", label: "ข้อมูลพนักงาน (HR)", icon: "users" },
  { id: "evaltrack", label: "ติดตามการประเมิน", icon: "checkCircle" },
  { id: "kpi", label: "KPI หน่วยงาน", icon: "deptkpi" },
  { id: "eval", label: "ฟอร์มประเมิน", icon: "eval" },
  { id: "jd", label: "จัดการ JD", icon: "jd" },
  { id: "reports", label: "รายงาน", icon: "reports" },
  { id: "calibration", label: "Calibration", icon: "calibration" },
];
const TITLES = {
  dashboard: ["ภาพรวมการประเมิน", "Performance Dashboard"],
  exec: ["มุมมองผู้บริหาร", "Executive Drill-down"],
  employee: ["พนักงาน", "Employee Directory"],
  hrdata: ["แดชบอร์ดข้อมูลพนักงาน", "HR Workforce Dashboard"],
  evaltrack: ["ติดตามการประเมิน", "Evaluation Tracking"],
  profile: ["ข้อมูลพนักงาน", "Employee Profile"],
  kpi: ["KPI หน่วยงาน", "Department KPI"],
  eval: ["ฟอร์มประเมินผล", "Evaluation Form"],
  jd: ["จัดการ JD", "Job Description"],
  reports: ["รายงาน", "Reports & Analytics"],
  calibration: ["Calibration", "Talent Calibration"],
  settings: ["ตั้งค่า", "Settings"],
};

function BootSplash({ text, error }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0a1832", color: "#fff" }}>
      <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
        <div className="side-logo" style={{ width: 56, height: 56, margin: "0 auto 18px" }}><Icon name="layers" size={28} /></div>
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
  const [route, setRoute] = useA("dashboard");
  const [empId, setEmpId] = useA("E1000");
  const [evalEmp, setEvalEmp] = useA("");
  const [year, setYear] = useA(String(window.CYCLE_YEAR || "2569"));
  const [collapsed, setCollapsed] = useA(false);
  const [mobileOpen, setMobileOpen] = useA(false);
  const [notifOpen, setNotifOpen] = useA(false);
  const [menuOpen, setMenuOpen] = useA(false);
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

  const go = (rt) => { setRoute(rt); setMobileOpen(false); setNotifOpen(false); setMenuOpen(false); if (rt !== "exec") setExecDept(null); window.scrollTo(0, 0); };
  const openEmp = (id) => { setEmpId(id); go("profile"); };
  const startEval = (id) => { setEvalEmp(id); go("eval"); };
  const openSub = (id) => setSubId(id);
  const goExec = (deptId) => { setExecDept(deptId); setRoute("exec"); setMobileOpen(false); window.scrollTo(0, 0); };

  const ctx = { t, setTweak, go, openEmp, startEval, openSub, goExec, empId, evalEmp, year, setYear, execDept, refresh, dataVer };

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
  if (!session) return (<><LoginScreen onLogin={() => {}} logo={null} /><ToastHost />{Panel}</>);
  if (loadErr) return (<><BootSplash text={"โหลดข้อมูลไม่สำเร็จ · " + loadErr} error /><ToastHost />{Panel}</>);
  if (!dataReady) return (<><BootSplash text="กำลังโหลดข้อมูล…" /><ToastHost />{Panel}</>);

  const [tTitle, tSub] = TITLES[route] || TITLES.dashboard;
  const cu = window.CURRENT_USER || {};
  const cuRole = (window.roleMeta ? window.roleMeta(cu.role) : { label: cu.role || "" });
  const cuName = cu.name || "ผู้ใช้งาน";
  const cuInitials = (cuName.trim()[0] || "U");

  return (
    <div className="app" data-density={t.density}>
      {mobileOpen && <div className="scrim-side" onClick={() => setMobileOpen(false)} />}
      <aside className={"sidebar " + (t.sidebarStyle === "light" ? "light " : "") + (collapsed ? "collapsed " : "") + (mobileOpen ? "mobile-open" : "")}>
        <div className="side-brand">
          <div className="side-logo"><b style={{ fontSize: 16, fontWeight: 700 }}>BW</b></div>
          <div className="side-brand-txt"><b>{COMPANY.name}</b><span>Performance System</span></div>
        </div>
        <nav className="side-nav">
          <div className="side-section">เมนูหลัก</div>
          {NAV.map((n) => (
            <button key={n.id} className={"nav-item" + (route === n.id || (route === "profile" && n.id === "employee") ? " active" : "")} onClick={() => go(n.id)}>
              <Icon name={n.icon} size={20} stroke={1.9} />
              <span className="lbl">{n.label}</span>
              {n.id === "eval" && <span className="nav-badge">{SUMMARY.pending}</span>}
            </button>
          ))}
          <div className="side-section">ระบบ</div>
          <button className={"nav-item" + (route === "settings" ? " active" : "")} onClick={() => go("settings")}>
            <Icon name="settings" size={20} stroke={1.9} /><span className="lbl">ตั้งค่า</span>
          </button>
        </nav>
        <div className="side-foot">
          <div className="side-user" onClick={() => go("settings")}>
            <Avatar name={cuName} initials={cuInitials} color="#0d9488" size={36} />
            <div className="meta"><b>{cuName}</b><span>{cuRole.label}</span></div>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn mobile-only" onClick={() => setMobileOpen(true)}><Icon name="menu" size={20} /></button>
          <button className="icon-btn desktop-only" onClick={() => setCollapsed(!collapsed)}><Icon name="menu" size={20} /></button>
          <div>
            <div className="top-title">{tTitle}</div>
            <div className="top-sub">{tSub}</div>
          </div>
          <div className="top-spacer" />
          <div className="search hide-xs">
            <Icon name="search" size={18} />
            <input placeholder="ค้นหาพนักงาน, ตำแหน่ง…" />
            <kbd className="hide-sm">⌘K</kbd>
          </div>

          <div style={{ position: "relative" }}>
            <button className="icon-btn" onClick={() => { setNotifOpen(!notifOpen); setMenuOpen(false); }}><Icon name="bell" size={19} /><span className="dot" /></button>
            {notifOpen && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={() => setNotifOpen(false)} />
                <div className="card" style={{ position: "absolute", right: 0, top: 50, width: 340, zIndex: 50, boxShadow: "var(--shadow-lg)", overflow: "hidden" }}>
                  <div className="card-head" style={{ padding: "14px 18px" }}><h3 style={{ fontSize: 14 }}>การแจ้งเตือน</h3><div className="spacer" /><span className="muted" style={{ fontSize: 12 }}>{NOTIFS.length} ใหม่</span></div>
                  <div style={{ maxHeight: 360, overflowY: "auto" }}>
                    {NOTIFS.map((n) => {
                      const ic = { warn: ["alert", "#e08a00", "#fdf1dc"], info: ["bell", "#2563eb", "#e8effb"], ok: ["checkCircle", "#16a34a", "#e7f6ec"] }[n.type];
                      return (
                        <div key={n.id} className="row" style={{ gap: 11, padding: "12px 18px", borderBottom: "1px solid var(--border-2)", alignItems: "flex-start", cursor: "pointer" }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-2)"} onMouseLeave={(e) => e.currentTarget.style.background = "none"}>
                          <span style={{ width: 32, height: 32, borderRadius: 9, background: ic[2], color: ic[1], display: "grid", placeItems: "center", flex: "0 0 32px" }}><Icon name={ic[0]} size={16} /></span>
                          <div><div style={{ fontWeight: 600, fontSize: 13 }}>{n.title}</div><div className="muted" style={{ fontSize: 12, marginTop: 1 }}>{n.body}</div><div className="muted-3" style={{ fontSize: 11, marginTop: 3 }}>{n.time}</div></div>
                        </div>
                      );
                    })}
                  </div>
                  <button className="btn btn-soft btn-sm" style={{ margin: 12, width: "calc(100% - 24px)" }} onClick={() => { setNotifOpen(false); toast("ทำเครื่องหมายอ่านทั้งหมดแล้ว", "check"); }}>อ่านทั้งหมด</button>
                </div>
              </>
            )}
          </div>

          <div style={{ position: "relative" }}>
            <button className="row" style={{ gap: 9, background: "none", border: "none", cursor: "pointer", padding: 2 }} onClick={() => { setMenuOpen(!menuOpen); setNotifOpen(false); }}>
              <Avatar name={cuName} initials={cuInitials} color="#0d9488" size={38} />
              <div className="hide-md" style={{ textAlign: "left", lineHeight: 1.25 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{cuName}</div><div className="muted" style={{ fontSize: 11.5 }}>{cuRole.label}</div></div>
              <span className="hide-md muted"><Icon name="chevDown" size={15} /></span>
            </button>
            {menuOpen && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 49 }} onClick={() => setMenuOpen(false)} />
                <div className="card" style={{ position: "absolute", right: 0, top: 52, width: 220, zIndex: 50, boxShadow: "var(--shadow-lg)", padding: 6 }}>
                  {[["user", "โปรไฟล์ของฉัน"], ["settings", "ตั้งค่า"], ["history", "ประวัติการใช้งาน"]].map(([ic, l]) => (
                    <button key={l} className="row" style={{ gap: 11, width: "100%", padding: "10px 12px", border: "none", background: "none", cursor: "pointer", borderRadius: 9, fontSize: 13.5, color: "var(--text)" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-2)"} onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                      onClick={() => { setMenuOpen(false); if (l === "ตั้งค่า") go("settings"); }}><Icon name={ic} size={17} color="var(--text-2)" />{l}</button>
                  ))}
                  <hr className="divider" style={{ margin: "5px 0" }} />
                  <button className="row" style={{ gap: 11, width: "100%", padding: "10px 12px", border: "none", background: "none", cursor: "pointer", borderRadius: 9, fontSize: 13.5, color: "var(--red)" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--red-soft)"} onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                    onClick={() => { window.sb.auth.signOut(); setMenuOpen(false); }}><Icon name="logout" size={17} />ออกจากระบบ</button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="content">
          {route === "dashboard" && <Dashboard ctx={ctx} />}
          {route === "exec" && <ExecDashboard ctx={ctx} />}
          {route === "employee" && <EmployeeList ctx={ctx} />}
          {route === "hrdata" && <HRDataDashboard ctx={ctx} />}
          {route === "evaltrack" && <EvalTracking ctx={ctx} />}
          {route === "profile" && <EmployeeProfile ctx={ctx} empId={empId} />}
          {route === "kpi" && <KPIModule ctx={ctx} />}
          {route === "eval" && <Evaluation key={ctx.evalEmp} ctx={ctx} />}
          {route === "jd" && <JDManagement ctx={ctx} />}
          {route === "reports" && <Reports ctx={ctx} />}
          {route === "calibration" && <Calibration ctx={ctx} />}
          {route === "settings" && <Settings ctx={ctx} />}
        </main>
      </div>

      {subId && <SubmissionDrawer subId={subId} onClose={() => setSubId(null)} ctx={ctx} />}
      <ToastHost />
      {Panel}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
