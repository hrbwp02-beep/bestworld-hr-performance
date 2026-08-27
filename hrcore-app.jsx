// hrcore-app.jsx — HR Core Shell : เมนู · เส้นทาง (hash routing) · ล็อกอิน · ตรวจสิทธิ์
const { useState: useHA, useEffect: useHAE } = React;

/* เมนู HR Core (STEP 2) — perm = สิทธิ์ที่ต้องมีจึงจะเห็น */
const HRC_NAV = [
  { id: "dashboard", label: "ภาพรวม", icon: "dashboard", perm: null },
  { id: "employees", label: "พนักงาน", icon: "employee", perm: "employee.view" },
  { id: "departments", label: "หน่วยงาน", icon: "briefcase", perm: "department.view" },
  { id: "positions", label: "ตำแหน่งงาน", icon: "jd", perm: "position.view" },
  { id: "org", label: "ผังองค์กร", icon: "users", perm: "employee.view" },
  { id: "master", label: "ข้อมูลตั้งต้น", icon: "settings", perm: "position.manage" },
  { id: "recruit", label: "รับจากสรรหา", icon: "plus", perm: "employee.create" },
  { id: "users", label: "ผู้ใช้ระบบ", icon: "user", perm: "user.manage" },
  { id: "roles", label: "บทบาทและสิทธิ์", icon: "lock", perm: "employee.view" },
  { id: "audit", label: "บันทึกการใช้งาน", icon: "clock", perm: "audit.view" },
];
const HRC_TITLES = {
  dashboard: "ภาพรวม", employees: "พนักงาน", employee: "โปรไฟล์พนักงาน", departments: "หน่วยงาน",
  positions: "ตำแหน่งงาน", org: "ผังองค์กร", master: "ข้อมูลตั้งต้น", recruit: "รับจากสรรหา",
  users: "ผู้ใช้ระบบ", roles: "บทบาทและสิทธิ์", audit: "บันทึกการใช้งาน",
};

/* ---- อ่าน/เขียนเส้นทางจาก hash : #/employees/180009 ---- */
function parseHash() {
  const h = (location.hash || "").replace(/^#\/?/, "").split("/");
  return { page: h[0] || "dashboard", param: h[1] ? decodeURIComponent(h[1]) : null };
}

function HRCoreApp() {
  const [phase, setPhase] = useHA("boot");      // boot | login | ready | error
  const [errText, setErrText] = useHA("");
  const [route, setRoute] = useHA(parseHash());
  const [collapsed, setCollapsed] = useHA(false);
  const [mobileOpen, setMobileOpen] = useHA(false);
  const [, force] = useHA(0);

  const nav = (page, param) => {
    location.hash = "#/" + page + (param ? "/" + encodeURIComponent(param) : "");
    setMobileOpen(false);
  };

  useHAE(() => {
    const onHash = () => { setRoute(parseHash()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const boot = async () => {
    setPhase("boot"); setErrText("");
    try {
      const { data: { session } } = await window.sb.auth.getSession();
      if (!session) { setPhase("login"); return; }
      await HRC.loadCurrentUser();
      await HRC.loadPermissions();
      if (!HRC.can("employee.view")) {
        setErrText("บัญชีของคุณไม่มีสิทธิ์เข้าใช้งาน HR Core (ต้องมีสิทธิ์ employee.view)");
        setPhase("error"); return;
      }
      await HRC.load();
      setPhase("ready");
    } catch (e) { setErrText(String(e.message || e)); setPhase("error"); }
  };
  useHAE(() => { boot(); }, []);

  if (phase === "boot") return (<><HRCBoot /><ToastHost /></>);
  if (phase === "login") return (<><HRCLogin onDone={boot} /><ToastHost /></>);
  if (phase === "error") return (<>
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <Card className="card-pad" style={{ maxWidth: 460, textAlign: "center" }}>
        <span style={{ color: "var(--red)" }}><Icon name="alert" size={40} /></span>
        <h2 style={{ fontSize: 18, margin: "12px 0 6px" }}>เข้าใช้งานไม่ได้</h2>
        <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.7 }}>{errText}</p>
        <div className="row" style={{ gap: 9, justifyContent: "center", marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={async () => { await window.sb.auth.signOut(); boot(); }}>ออกจากระบบ</button>
          <button className="btn btn-pri" onClick={boot}><Icon name="refresh" size={15} />ลองใหม่</button>
        </div>
      </Card>
    </div><ToastHost /></>);

  const cu = HRC.user || {};
  const visibleNav = HRC_NAV.filter((n) => !n.perm || HRC.can(n.perm));
  const page = route.page;
  const allowed = visibleNav.some((n) => n.id === page) || page === "employee";
  const effPage = allowed ? page : "dashboard";

  const Content = () => {
    switch (effPage) {
      case "dashboard": return <HRCDashboard nav={nav} />;
      case "employees": return <HRCEmployees nav={nav} />;
      case "employee": return <HRCEmployeeProfile employeeId={route.param} nav={nav} />;
      case "departments": return <HRCDepartments nav={nav} />;
      case "positions": return <HRCPositions />;
      case "org": return <HRCOrgChart nav={nav} />;
      case "master": return <HRCMasterData />;
      case "recruit": return <HRCRecruitIntake nav={nav} />;
      case "users": return <HRCUsers />;
      case "roles": return <HRCRoles />;
      case "audit": return <HRCAudit />;
      default: return <HRCDashboard nav={nav} />;
    }
  };

  return (
    <div className="app">
      {mobileOpen && <div className="scrim-side" onClick={() => setMobileOpen(false)} />}
      <aside className={"sidebar " + (collapsed ? "collapsed " : "") + (mobileOpen ? "mobile-open" : "")}>
        <div className="side-brand">
          <div className="side-logo"><img src="../logo.svg" alt="BWP" style={{ width: "100%", height: "100%", objectFit: "contain" }} /></div>
          <div className="side-brand-txt"><b>BWP HR Core</b><span>ศูนย์กลางข้อมูลบุคลากร</span></div>
        </div>
        <nav className="side-nav">
          <div className="side-section">HR Core</div>
          {visibleNav.map((n) => (
            <button key={n.id} className={"nav-item" + (effPage === n.id || (effPage === "employee" && n.id === "employees") ? " active" : "")}
              onClick={() => nav(n.id)}>
              <Icon name={n.icon} size={20} stroke={1.9} /><span className="lbl">{n.label}</span>
            </button>
          ))}
          <div className="side-section">ระบบอื่น</div>
          <a className="nav-item" href="../index.html" style={{ textDecoration: "none" }}>
            <Icon name="eval" size={20} stroke={1.9} /><span className="lbl">ระบบประเมินผล</span>
          </a>
          {(HRC.settings && HRC.settings.recruit_app_url) && (
            <a className="nav-item" href={HRC.settings.recruit_app_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              <Icon name="briefcase" size={20} stroke={1.9} /><span className="lbl">ระบบสรรหา</span>
            </a>
          )}
        </nav>
        <div className="side-foot">
          <div className="side-user">
            <Avatar name={cu.name || "ผู้ใช้"} initials={(cu.name || "U").trim()[0]} color="#0d9488" size={36} />
            <div className="meta"><b>{cu.name || "ผู้ใช้งาน"}</b><span>{cu.role_code || cu.role || ""}</span></div>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="icon-btn mobile-only" aria-label="เปิดเมนู" onClick={() => setMobileOpen(true)}><Icon name="menu" size={20} /></button>
          <button className="icon-btn desktop-only" aria-label="ย่อ/ขยายเมนู" onClick={() => setCollapsed(!collapsed)}><Icon name="menu" size={20} /></button>
          <div>
            <div className="top-title">{HRC_TITLES[effPage] || "HR Core"}</div>
            <div className="top-sub">BWP HR Core · ศูนย์กลางข้อมูลบุคลากร</div>
          </div>
          <div className="top-spacer" />
          <button className="btn btn-ghost btn-sm" onClick={async () => { await HRC.load(); force((n) => n + 1); toast("อัปเดตข้อมูลแล้ว", "refresh"); }}>
            <Icon name="refresh" size={15} />รีเฟรช
          </button>
          <button className="icon-btn" aria-label="ออกจากระบบ" title="ออกจากระบบ"
            onClick={async () => { await HRC.audit("ออกจากระบบ", "LOGOUT", "auth", null, null, null); await window.sb.auth.signOut(); location.reload(); }}>
            <Icon name="logout" size={19} />
          </button>
        </header>
        <main className="content"><Content /></main>
      </div>
      <ToastHost />
    </div>
  );
}

/* ---- หน้าจอกำลังเริ่มระบบ ---- */
function HRCBoot() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0a1832", color: "#fff" }}>
      <div style={{ textAlign: "center" }}>
        <img src="../logo.svg" alt="BWP" style={{ width: 54, height: 54 }} />
        <div style={{ fontWeight: 600, marginTop: 12 }}>BWP HR Core</div>
        <div className="boot-spin" style={{ margin: "16px auto 0" }} />
      </div>
    </div>
  );
}

/* ---- หน้าล็อกอินของ HR Core ---- */
function HRCLogin({ onDone }) {
  const [u, setU] = useHA("");
  const [p, setP] = useHA("");
  const [busy, setBusy] = useHA(false);
  const [err, setErr] = useHA("");

  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    const { error } = await window.sb.auth.signInWithPassword({ email: u.trim(), password: p });
    if (error) { setBusy(false); setErr("เข้าสู่ระบบไม่สำเร็จ — ตรวจสอบอีเมล/รหัสผ่าน"); return; }
    const { data: au } = await window.sb.from("app_users").select("active").ilike("email", u.trim()).maybeSingle();
    if (au && au.active === false) {
      await window.sb.auth.signOut(); setBusy(false);
      setErr("บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ"); return;
    }
    await HRC.audit("เข้าสู่ระบบ HR Core", "LOGIN", "auth", null, null, null);
    setBusy(false); onDone();
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0a1832", padding: 22 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <img src="../logo.svg" alt="BWP" style={{ width: 62, height: 62 }} />
          <h1 style={{ color: "#fff", fontSize: 22, margin: "12px 0 4px" }}>BWP HR Core</h1>
          <p style={{ color: "rgba(255,255,255,.6)", fontSize: 13.5, margin: 0 }}>ศูนย์กลางข้อมูลบุคลากร</p>
        </div>
        <form onSubmit={submit} style={{ background: "rgba(255,255,255,.07)", borderRadius: 16, padding: 22, display: "flex", flexDirection: "column", gap: 13 }}>
          {err && <div style={{ padding: "10px 13px", borderRadius: 10, background: "rgba(225,29,72,.18)", color: "#ffd5dd", fontSize: 13 }}>{err}</div>}
          <div className="field"><label style={{ color: "rgba(255,255,255,.8)", fontSize: 12.5 }}>อีเมล</label>
            <input className="input" value={u} onChange={(e) => setU(e.target.value)} autoComplete="username"
              style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.2)", color: "#fff" }} /></div>
          <div className="field"><label style={{ color: "rgba(255,255,255,.8)", fontSize: 12.5 }}>รหัสผ่าน</label>
            <input className="input" type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password"
              style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.2)", color: "#fff" }} /></div>
          <button type="submit" className="btn btn-pri" disabled={busy} style={{ padding: 12, marginTop: 4 }}>
            {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
          </button>
          <a href="../index.html" style={{ color: "#9dc0ff", fontSize: 12.5, textAlign: "center", textDecoration: "none" }}>← ไประบบประเมินผล</a>
        </form>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<HRCoreApp />);
