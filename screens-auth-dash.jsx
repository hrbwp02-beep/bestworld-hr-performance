// screens-auth-dash.jsx — Login + Main Dashboard
const { useState: useS1, useEffect: useE1 } = React;

/* =========================================================
   LOGIN — glassmorphism
   ========================================================= */
function LoginScreen({ onLogin, logo }) {
  const [u, setU] = useS1("hr.admin@bestworld.co.th");
  const [p, setP] = useS1("");
  const [show, setShow] = useS1(false);
  const [busy, setBusy] = useS1(false);
  const [err, setErr] = useS1("");
  // self-service: พนักงานดูผลของตัวเองด้วยรหัสพนักงาน
  const [selfMode, setSelfMode] = useS1(false);
  const [code, setCode] = useS1("");
  const [dob, setDob] = useS1("");
  const [look, setLook] = useS1(false);
  const [res, setRes] = useS1(null);
  const [selfErr, setSelfErr] = useS1("");
  const lookup = async (e) => {
    if (e) e.preventDefault();
    if (!code.trim()) { setSelfErr("กรุณากรอกรหัสพนักงาน"); return; }
    if (!dob) { setSelfErr("กรุณากรอกวันเกิดเพื่อยืนยันตัวตน"); return; }
    setSelfErr(""); setRes(null); setLook(true);
    const { data, error } = await window.sb.functions.invoke("employee-result", { body: { code: code.trim(), birthdate: dob } });
    setLook(false);
    if (error) { setSelfErr("เกิดข้อผิดพลาด ลองใหม่อีกครั้ง"); return; }
    if (data && data.needDob) { setSelfErr("กรุณากรอกวันเกิด"); return; }
    if (!data || !data.found) { setSelfErr("รหัสพนักงานหรือวันเกิดไม่ถูกต้อง"); return; }
    setRes(data);
  };
  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    const { error } = await window.sb.auth.signInWithPassword({ email: u.trim(), password: p });
    if (error) { setBusy(false); setErr("เข้าสู่ระบบไม่สำเร็จ — ตรวจสอบอีเมล/รหัสผ่านอีกครั้ง"); return; }
    // enforce account status: a suspended (active=false) user must not get in
    const { data: au } = await window.sb.from("app_users").select("active").eq("email", u.trim().toLowerCase()).maybeSingle();
    if (au && au.active === false) {
      await window.sb.auth.signOut();
      setBusy(false); setErr("บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ"); return;
    }
    if (onLogin) onLogin();
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", position: "relative", overflow: "hidden", background: "#0a1832" }}>
      {/* animated background scene (factory / KPI placeholder) */}
      <div style={{ position: "absolute", inset: 0, background:
        "radial-gradient(1100px 700px at 78% 18%, rgba(37,99,235,.42), transparent 60%), radial-gradient(900px 600px at 10% 90%, rgba(13,148,136,.30), transparent 55%), linear-gradient(135deg,#0a1832 0%,#0f2147 55%,#0a1832 100%)" }} />
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: .5 }} preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="grid" width="46" height="46" patternUnits="userSpaceOnUse">
            <path d="M46 0H0V46" fill="none" stroke="rgba(255,255,255,.05)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        {/* abstract KPI bars bottom-left */}
        {[0,1,2,3,4,5,6].map((i) => (
          <rect key={i} x={70 + i * 46} y={`${72 - [30,46,38,58,50,68,60][i]/2}%`} width="26" height={`${[30,46,38,58,50,68,60][i]}%`} rx="6" fill="rgba(91,141,239,.16)">
            <animate attributeName="opacity" values="0.5;0.9;0.5" dur={`${3+i*0.3}s`} repeatCount="indefinite" />
          </rect>
        ))}
      </svg>

      {/* left brand panel */}
      <div className="hide-xs" style={{ flex: 1, position: "relative", zIndex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "54px 60px", color: "#fff" }}>
        <div className="row" style={{ gap: 13 }}>
          <div className="side-logo" style={{ width: 46, height: 46 }}>{logo ? <img src={logo} alt="" /> : <Icon name="layers" size={24} />}</div>
          <div style={{ lineHeight: 1.25 }}>
            <b style={{ fontSize: 16 }}>{COMPANY.name}</b><br />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,.6)" }}>Performance Management System</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 38, fontWeight: 700, lineHeight: 1.25, letterSpacing: "-.01em", maxWidth: 520 }}>
            ระบบประเมินผล<br />การปฏิบัติงานประจำปี
          </div>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,.72)", maxWidth: 460, marginTop: 16, lineHeight: 1.7 }}>
            ติดตาม KPI และ Competency รายบุคคล หน่วยงาน และทั้งองค์กร เชื่อมโยงกับ Job Description พร้อมรายงานเชิงลึกสำหรับฝ่าย HR และผู้บริหาร
          </p>
          <div className="row" style={{ gap: 30, marginTop: 32 }}>
            {[["พนักงานในระบบ", "147 คน"], ["รอบประเมิน", "ปี 2569"], ["หน่วยงาน", "11 ฝ่าย"]].map(([k, v]) => (
              <div key={k}><div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--mono)" }}>{v}</div><div style={{ fontSize: 12.5, color: "rgba(255,255,255,.55)" }}>{k}</div></div>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,.4)" }}>© 2569 {COMPANY.full} · v2.4</div>
      </div>

      {/* glass login card */}
      <div style={{ position: "relative", zIndex: 1, flex: "0 0 auto", width: "min(480px, 100%)", display: "grid", placeItems: "center", padding: 24 }}>
        {!selfMode && <form onSubmit={submit} style={{ width: "min(400px, 100%)", background: "rgba(255,255,255,.09)", backdropFilter: "blur(22px)",
          border: "1px solid rgba(255,255,255,.18)", borderRadius: 22, padding: "38px 34px", boxShadow: "0 28px 70px rgba(0,0,0,.4)" }}>
          <div className="side-logo mobile-only" style={{ width: 48, height: 48, marginBottom: 18 }}>{logo ? <img src={logo} alt="" /> : <Icon name="layers" size={24} />}</div>
          <h2 style={{ margin: 0, color: "#fff", fontSize: 23, fontWeight: 700 }}>เข้าสู่ระบบ</h2>
          <p style={{ margin: "7px 0 26px", color: "rgba(255,255,255,.62)", fontSize: 14 }}>ยินดีต้อนรับกลับ กรุณาเข้าสู่ระบบเพื่อใช้งาน</p>

          <div className="field" style={{ marginBottom: 16 }}>
            <label style={{ color: "rgba(255,255,255,.82)" }}>ชื่อผู้ใช้ / อีเมล</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,.5)" }}><Icon name="user" size={18} /></span>
              <input className="input" value={u} onChange={(e) => setU(e.target.value)} style={glassInput} />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 14 }}>
            <label style={{ color: "rgba(255,255,255,.82)" }}>รหัสผ่าน</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,.5)" }}><Icon name="lock" size={18} /></span>
              <input className="input" type={show ? "text" : "password"} value={p} onChange={(e) => setP(e.target.value)} style={glassInput} />
              <button type="button" onClick={() => setShow(!show)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "rgba(255,255,255,.55)", cursor: "pointer", padding: 6 }}><Icon name="eye" size={18} /></button>
            </div>
          </div>
          <div className="between" style={{ marginBottom: 22 }}>
            <label className="row" style={{ gap: 8, color: "rgba(255,255,255,.78)", fontSize: 13.5, cursor: "pointer" }}>
              <input type="checkbox" defaultChecked style={{ accentColor: "#5b8def", width: 16, height: 16 }} /> จดจำการเข้าสู่ระบบ
            </label>
            <a href="#" onClick={async (e) => { e.preventDefault(); if (!u.trim()) { toast("กรุณากรอกอีเมลก่อน", "mail"); return; } const { error } = await window.sb.auth.resetPasswordForEmail(u.trim()); toast(error ? ("ส่งไม่สำเร็จ: " + error.message) : "ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลแล้ว", "mail"); }} style={{ color: "#9dc0ff", fontSize: 13.5, textDecoration: "none", fontWeight: 600 }}>ลืมรหัสผ่าน?</a>
          </div>
          {err && (
            <div style={{ marginBottom: 14, padding: "10px 13px", borderRadius: 10, background: "rgba(225,29,72,.18)", border: "1px solid rgba(255,140,160,.4)", color: "#ffd5dd", fontSize: 13 }}>
              {err}
            </div>
          )}
          <button type="submit" className="btn btn-pri" disabled={busy} style={{ width: "100%", padding: "13px", fontSize: 15, opacity: busy ? .8 : 1 }}>
            {busy ? "กำลังเข้าสู่ระบบ…" : <>เข้าสู่ระบบ <Icon name="chevRight" size={18} /></>}
          </button>
          <div style={{ borderTop: "1px solid rgba(255,255,255,.14)", margin: "20px 0 0", paddingTop: 16, textAlign: "center" }}>
            <button type="button" onClick={() => { setSelfMode(true); setErr(""); }} className="btn btn-ghost" style={{ width: "100%", color: "#fff", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.2)" }}>
              <Icon name="user" size={16} />พนักงานดูผลประเมินของตัวเอง
            </button>
          </div>
        </form>}

        {selfMode && (() => {
          const r = res; const ev = r && r.result; const b = ev ? window.bandOf(ev.overall) : null;
          const o = ev ? window.evalOutcome(ev.overall, ev.has_warning ? 1 : 0) : null;
          return (
          <div style={{ width: "min(440px, 100%)", background: "rgba(255,255,255,.09)", backdropFilter: "blur(22px)", border: "1px solid rgba(255,255,255,.18)", borderRadius: 22, padding: "30px 28px", boxShadow: "0 28px 70px rgba(0,0,0,.4)", color: "#fff", maxHeight: "88vh", overflowY: "auto" }}>
            <div className="row" style={{ gap: 8, marginBottom: 6 }}>
              <button onClick={() => { setSelfMode(false); setRes(null); setCode(""); setSelfErr(""); }} style={{ background: "none", border: "none", color: "#9dc0ff", cursor: "pointer", fontSize: 13, padding: 0 }}><Icon name="chevLeft" size={15} />กลับเข้าสู่ระบบ</button>
            </div>
            <h2 style={{ margin: "0 0 4px", fontSize: 21, fontWeight: 700 }}>ดูผลประเมินของฉัน</h2>
            <p style={{ margin: "0 0 18px", color: "rgba(255,255,255,.62)", fontSize: 13.5 }}>กรอกรหัสพนักงานเพื่อดูผลการประเมินของตัวเอง</p>
            <form onSubmit={lookup} style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
              <div className="field"><label style={{ color: "rgba(255,255,255,.8)", fontSize: 12.5 }}>รหัสพนักงาน</label><input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="เช่น 180032" style={glassInput} /></div>
              <div className="field"><label style={{ color: "rgba(255,255,255,.8)", fontSize: 12.5 }}>วันเกิด (ยืนยันตัวตน)</label><input className="input" type="date" value={dob} onChange={(e) => setDob(e.target.value)} style={glassInput} /></div>
              <button type="submit" className="btn btn-pri" disabled={look} style={{ padding: "12px", marginTop: 2 }}>{look ? "กำลังตรวจสอบ…" : <>ดูผลประเมิน <Icon name="chevRight" size={16} /></>}</button>
            </form>
            {selfErr && <div style={{ marginBottom: 12, padding: "10px 13px", borderRadius: 10, background: "rgba(225,29,72,.18)", border: "1px solid rgba(255,140,160,.4)", color: "#ffd5dd", fontSize: 13 }}>{selfErr}</div>}
            {r && r.found && (
              <div style={{ background: "rgba(255,255,255,.07)", borderRadius: 14, padding: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{r.employee.name}</div>
                <div style={{ color: "rgba(255,255,255,.7)", fontSize: 13, marginBottom: 12 }}>{r.employee.position} · {r.employee.dept} · รหัส {r.employee.id}</div>
                {!ev ? <div style={{ color: "rgba(255,255,255,.7)", fontSize: 13.5, padding: "14px 0", textAlign: "center" }}>ยังไม่มีผลการประเมินรอบ {r.cycleYear}</div> : (<>
                  <div className="row" style={{ gap: 14, alignItems: "center", marginBottom: 12 }}>
                    <div style={{ width: 76, height: 76, borderRadius: "50%", display: "grid", placeItems: "center", background: b.color + "33", border: "3px solid " + b.color }}>
                      <div style={{ textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 800 }}>{ev.overall}</div></div>
                    </div>
                    <div>
                      <span className="badge" style={{ background: b.color, color: "#fff", fontWeight: 700, fontSize: 14 }}>เกรด {ev.grade} · {b.label}</span>
                      <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.7)", marginTop: 6 }}>รอบประเมินปี {r.cycleYear} · สถานะ {ev.status === "done" ? "อนุมัติแล้ว" : ev.status === "review" ? "อยู่ระหว่างอนุมัติ" : "ฉบับร่าง"}</div>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 0, textAlign: "center", borderTop: "1px solid rgba(255,255,255,.14)", paddingTop: 12 }}>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 18, fontWeight: 700, color: "#9dc0ff" }}>{ev.a_score != null ? ev.a_score : ev.kpi_score}</div><div style={{ fontSize: 11.5, color: "rgba(255,255,255,.6)" }}>ผลงาน/KPI (70%)</div></div>
                    <div style={{ width: 1, background: "rgba(255,255,255,.14)" }} />
                    <div style={{ flex: 1 }}><div style={{ fontSize: 18, fontWeight: 700, color: "#c4b5fd" }}>{ev.b_score != null ? ev.b_score : ev.comp_score}</div><div style={{ fontSize: 11.5, color: "rgba(255,255,255,.6)" }}>สมรรถนะ (30%)</div></div>
                  </div>
                  <div style={{ borderTop: "1px solid rgba(255,255,255,.14)", marginTop: 12, paddingTop: 12, display: "flex", flexDirection: "column", gap: 7, fontSize: 13 }}>
                    <div className="between"><span style={{ color: "rgba(255,255,255,.65)" }}>โบนัส</span><span style={{ fontWeight: 700 }}>{o.bonusEligible ? o.bonusMonths + " เท่าของเงินเดือน" : "ไม่ได้รับ"}</span></div>
                    <div className="between"><span style={{ color: "rgba(255,255,255,.65)" }}>ปรับเงินเดือน</span><span style={{ fontWeight: 700, color: o.raiseEligible ? "#86efac" : "#ffd5dd" }}>{o.raiseEligible ? "+" + o.raisePct + "%" : "ไม่ปรับ" + (o.hasWarning ? " (มีใบเตือน)" : "")}</span></div>
                    {ev.evaluator && <div className="between"><span style={{ color: "rgba(255,255,255,.65)" }}>ผู้ประเมิน</span><span>{ev.evaluator}{ev.evaluator_code ? " · " + ev.evaluator_code : ""}</span></div>}
                    {ev.comment && <div style={{ color: "rgba(255,255,255,.75)", fontSize: 12.5, marginTop: 2 }}>หมายเหตุ: {ev.comment}</div>}
                  </div>
                </>)}
              </div>
            )}
          </div>
          );
        })()}
      </div>
    </div>
  );
}
const glassInput = { background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.2)", color: "#fff", paddingLeft: 40 };

/* =========================================================
   DASHBOARD
   ========================================================= */
function Dashboard({ ctx }) {
  const EMPLOYEES = window.scopeEmployees(window.EMPLOYEES || []); // จำกัดตามขอบเขตหน่วยงานของผู้ใช้
  const t = ctx.t;
  const layout = t.dashLayout || "airy";
  const cy = +(window.CYCLE_YEAR || 2569);
  // เฉพาะหน่วยงานที่มีพนักงานจริง (ตัดหน่วยงานว่างคะแนน 0 ออก)
  const realDepts = (DEPARTMENTS || []).filter((d) => (d.head || 0) > 0 && window.inScope(d.id));
  const topDepts = [...realDepts].sort((a, b) => b.score - a.score);

  const StatRow = ({ compact }) => (
    <div className="grid" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${compact ? 175 : 210}px, 1fr))` }}>
      <Stat icon="users" label="พนักงานทั้งหมด" value={SUMMARY.total} unit="คน" tone="#2563eb" soft="#e8effb" sub={`${DEPARTMENTS.length} หน่วยงาน`} />
      <Stat icon="checkCircle" label="ประเมินแล้ว" value={SUMMARY.done} unit="คน" tone="#16a34a" soft="#e7f6ec" sub={`${Math.round(SUMMARY.done / SUMMARY.total * 100)}% ของทั้งหมด`} />
      <Stat icon="clock" label="รอดำเนินการ" value={SUMMARY.pending} unit="คน" tone="#e08a00" soft="#fdf1dc" sub="ครบกำหนด 15 มิ.ย." />
      <Stat icon="target" label="คะแนนเฉลี่ยองค์กร" value={SUMMARY.avgScore} tone="#7c3aed" soft="#f1ebfd" delta={SUMMARY.avgTrend} sub="เทียบปีก่อน" />
      {!compact && <Stat icon="trophy" label="หน่วยงานอันดับ 1" value={SUMMARY.topDeptScore} tone="#0d9488" soft="#e2f4f2" sub={SUMMARY.topDept} />}
    </div>
  );

  const TrendCard = ({ tall }) => {
    const dist = window.GRADE_DIST || [];
    const maxN = Math.max(1, ...dist.map((d) => d.n));
    const totalDone = dist.reduce((s, d) => s + d.n, 0) || 1;
    return (
      <Card>
        <CardHead title="การกระจายเกรดผลการประเมิน" sub={`พนักงานประเมินแล้ว ${SUMMARY.done} คน · ${COMPANY.cycle}`} />
        <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 14, minHeight: tall ? 280 : 230, justifyContent: "center" }}>
          {dist.map((d) => (
            <div key={d.g} className="row" style={{ gap: 12, alignItems: "center" }}>
              <span className="badge" style={{ background: d.color + "22", color: d.color, fontWeight: 700, minWidth: 34, textAlign: "center" }}>{d.g}</span>
              <div style={{ flex: 1, background: "var(--surface-3)", borderRadius: 8, height: 22, overflow: "hidden" }}>
                <div style={{ width: (d.n / maxN * 100) + "%", height: "100%", background: d.color, borderRadius: 8, transition: "width .4s" }} />
              </div>
              <span className="num" style={{ fontWeight: 700, minWidth: 64, textAlign: "right", fontSize: 13 }}>{d.n} คน · {Math.round(d.n / totalDone * 100)}%</span>
            </div>
          ))}
        </div>
      </Card>
    );
  };

  const DeptBarCard = () => (
    <Card>
      <CardHead title="KPI เฉลี่ยตามหน่วยงาน" sub="เส้นประแดง = เป้าหมายองค์กร 85 คะแนน"
        right={<button className="btn btn-ghost btn-sm" onClick={() => ctx.go("deptkpi")}>ดูทั้งหมด <Icon name="chevRight" size={14} /></button>} />
      <div className="card-pad"><BarChart data={realDepts} baseline={85} /></div>
    </Card>
  );

  const StatusCard = () => (
    <Card>
      <CardHead title="สถานะการประเมิน" sub={COMPANY.cycle} />
      <div className="card-pad"><Donut data={STATUS_PIE} centerLabel="พนักงาน" /></div>
    </Card>
  );

  const RadarCard = () => (
    <Card>
      <CardHead title="การกระจาย Competency" sub="คะแนนเฉลี่ยสมรรถนะหลัก (Core/B1)" />
      <div className="card-pad"><Radar data={COMP_RADAR} /></div>
    </Card>
  );

  const RankCard = () => (
    <Card>
      <CardHead title="อันดับหน่วยงาน" sub="เรียงตามคะแนนเฉลี่ย (เฉพาะที่มีพนักงาน)"
        right={<Badge cls="b-blue" dot>{topDepts.length} ฝ่าย</Badge>} />
      <div className="card-pad"><HBar data={topDepts.map((d) => ({ name: d.name + " (" + d.head + ")", score: d.score, color: d.color }))} /></div>
    </Card>
  );

  const AttentionCard = () => {
    const pend = EMPLOYEES.filter((e) => e.status === "pending" || e.status === "review").slice(0, 5);
    return (
      <Card>
        <CardHead title="ต้องดำเนินการ" sub="รายการที่รอคุณ"
          right={<Badge cls="b-amber" dot>{pend.length}</Badge>} />
        <div style={{ padding: "6px 10px 10px" }}>
          {pend.map((e) => {
            const sm = statusMeta(e.status);
            return (
              <button key={e.id} onClick={() => ctx.openEmp(e.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", border: "none", background: "none", cursor: "pointer", borderRadius: 10, textAlign: "left" }}
                onMouseEnter={(ev) => ev.currentTarget.style.background = "var(--surface-2)"} onMouseLeave={(ev) => ev.currentTarget.style.background = "none"}>
                <Avatar name={e.name} initials={e.initials} color={e.color} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{deptShort(e.dept)} · {e.position}</div>
                </div>
                <Badge cls={sm.cls}>{sm.label}</Badge>
              </button>
            );
          })}
        </div>
      </Card>
    );
  };

  return (
    <div className="grid">
      <div className="page-head">
        <div>
          <h1>ภาพรวมการประเมินผล</h1>
          <p>สรุปผลการปฏิบัติงานทั้งองค์กร · {COMPANY.cycle}</p>
        </div>
        <div className="row wrap" style={{ gap: 10 }}>
          <div className="seg"><Seg options={[{value:String(cy),label:"ปี "+cy},{value:String(cy-1),label:"ปี "+(cy-1)}]} value={ctx.year} onChange={ctx.setYear} /></div>
          <button className="btn btn-ghost" onClick={async () => { await ctx.refresh(); toast("อัปเดตข้อมูลล่าสุดจากฐานข้อมูลแล้ว", "refresh"); }}><Icon name="refresh" size={16} />รีเฟรช</button>
          <button className="btn btn-ghost" onClick={() => { downloadCSV("dashboard_departments.csv", ["รหัส", "หน่วยงาน", "พนักงาน", "ประเมินแล้ว", "คะแนนเฉลี่ย", "แนวโน้ม"], DEPARTMENTS.map((d) => [d.id, d.name, d.head, d.done, d.score, d.trend])); toast("ส่งออกรายงานภาพรวมแล้ว", "download"); }}><Icon name="download" size={16} />ส่งออกรายงาน</button>
        </div>
      </div>

      {layout === "airy" && (<>
        <StatRow />
        <div className="grid" style={{ gridTemplateColumns: "1.7fr 1fr" }}>
          <TrendCard /><StatusCard />
        </div>
        <DeptBarCard />
        <div className="grid" style={{ gridTemplateColumns: "1fr 1.2fr" }}>
          <RadarCard /><RankCard />
        </div>
      </>)}

      {layout === "analytics" && (<>
        <StatRow compact />
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <div style={{ gridColumn: "span 2" }}><DeptBarCard /></div>
          <StatusCard />
          <div style={{ gridColumn: "span 2" }}><TrendCard /></div>
          <RadarCard />
        </div>
        <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
          <RankCard /><AttentionCard />
        </div>
      </>)}

      {layout === "focus" && (<>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1.5fr" }}>
          <Card className="card-pad" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center" }}>
            <div className="muted" style={{ fontWeight: 600, fontSize: 14 }}>คะแนนเฉลี่ยทั้งองค์กร</div>
            <Ring value={SUMMARY.avgScore} size={180} />
            <Badge cls="b-green" dot>เพิ่มขึ้น {SUMMARY.avgTrend} จากปีก่อน</Badge>
            <div className="row" style={{ gap: 24, marginTop: 4 }}>
              <div><div className="mono" style={{ fontSize: 22, fontWeight: 700, color: "#16a34a" }}>{SUMMARY.highPotential}</div><div className="muted" style={{ fontSize: 12 }}>High Potential</div></div>
              <div style={{ width: 1, background: "var(--border)" }} />
              <div><div className="mono" style={{ fontSize: 22, fontWeight: 700, color: "#e11d48" }}>{SUMMARY.atRisk}</div><div className="muted" style={{ fontSize: 12 }}>กลุ่มเสี่ยง</div></div>
            </div>
          </Card>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Stat icon="users" label="พนักงานทั้งหมด" value={SUMMARY.total} unit="คน" tone="#2563eb" soft="#e8effb" />
            <Stat icon="checkCircle" label="ประเมินแล้ว" value={SUMMARY.done} unit="คน" tone="#16a34a" soft="#e7f6ec" />
            <Stat icon="clock" label="รอดำเนินการ" value={SUMMARY.pending} unit="คน" tone="#e08a00" soft="#fdf1dc" />
            <Stat icon="trophy" label="อันดับ 1" value={SUMMARY.topDeptScore} tone="#0d9488" soft="#e2f4f2" sub={SUMMARY.topDept} />
          </div>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "1.5fr 1fr" }}>
          <TrendCard /><AttentionCard />
        </div>
        <DeptBarCard />
      </>)}
    </div>
  );
}

Object.assign(window, { LoginScreen, Dashboard });
