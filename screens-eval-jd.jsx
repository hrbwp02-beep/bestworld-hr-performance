// screens-eval-jd.jsx — Evaluation form + JD Management
const { useState: useS3, useMemo: useM3 } = React;

/* =========================================================
   EVALUATION
   ========================================================= */
function Evaluation({ ctx }) {
  const e = EMPLOYEES.find((x) => x.id === ctx.evalEmp) || EMPLOYEES[0];
  // align the form with the employee's real JD + department KPIs
  const norm = (s) => String(s || "").replace(/\s+/g, "").trim();
  const _jdlib = window.JD_LIBRARY || [];
  const empJD = _jdlib.find((j) => j.id === e.jd_id)
    || _jdlib.find((j) => norm(j.title) === norm(e.position))
    || _jdlib.find((j) => norm(j.title) && (norm(j.title).includes(norm(e.position)) || norm(e.position).includes(norm(j.title))))
    || _jdlib.find((j) => j.dept === e.dept) || null;
  const kpiDept = (empJD && (empJD.kpi_dept || empJD.dept)) || e.dept; // KPI อ้างอิงตาม JD
  const deptKpis = (window.KPI_DEFS || []).filter((k) => k.dept === kpiDept && k.status === "approved");
  const W = window.APP_SETTINGS || {};
  const wK = W.w_kpi != null ? W.w_kpi : 50, wC = W.w_comp != null ? W.w_comp : 25, wJ = W.w_jd != null ? W.w_jd : 25;
  const wSum = (wK + wC + wJ) || 100;

  const [tab, setTab] = useS3("kpi");
  const [kpi, setKpi] = useS3(() => deptKpis.map((k) => ({ id: k.id, name: k.name, target: (k.target && k.target.y != null ? k.target.y : "") + (k.unit || ""), weight: k.weight || Math.round(100 / (deptKpis.length || 1)), score: 3 })));
  const [comp, setComp] = useS3(() => ((empJD && empJD.competencies && empJD.competencies.length) ? empJD.competencies : (COMPETENCIES || []).map((c) => c.name)).map((name, i) => ({ id: "c" + i, name, score: 3, note: "" })));
  const [jd, setJd] = useS3(() => ((empJD && empJD.duties && empJD.duties.length) ? empJD.duties : (window.JD_ITEMS || []).map((j) => j.name)).map((name, i) => ({ id: "j" + i, name, score: 3, note: "" })));
  const [submitted, setSubmitted] = useS3(false);
  const [comment, setComment] = useS3("");
  const [saving, setSaving] = useS3(false);
  const [pickDept, setPickDept] = useS3(e.dept);
  const [pickSec, setPickSec] = useS3(window.sectionOf(e.position));
  const deptEmps = (EMPLOYEES || []).filter((emp) => emp.dept === pickDept);
  const secList = [...new Set(deptEmps.map((emp) => window.sectionOf(emp.position)))];
  const effSec = secList.includes(pickSec) ? pickSec : secList[0];
  const pickEmps = secList.length > 1 ? deptEmps.filter((emp) => window.sectionOf(emp.position) === effSec) : deptEmps;

  const kpiTotal = useM3(() => { if (!kpi.length) return 0; const w = kpi.reduce((a, k) => a + (k.weight || 0), 0) || 1; return Math.round(kpi.reduce((a, k) => a + k.score * 20 * (k.weight || 0), 0) / w * 10) / 10; }, [kpi]);
  const compTotal = useM3(() => comp.length ? Math.round(comp.reduce((a, c) => a + c.score * 20, 0) / comp.length * 10) / 10 : 0, [comp]);
  const jdTotal = useM3(() => jd.length ? Math.round(jd.reduce((a, j) => a + j.score * 20, 0) / jd.length * 10) / 10 : 0, [jd]);
  const overall = Math.round((kpiTotal * wK + compTotal * wC + jdTotal * wJ) / wSum * 10) / 10;
  const band = window.bandOf(overall);
  const outcome = window.evalOutcome(overall, e.warnings);

  // save the evaluation to Supabase: record it + write scores back to the employee
  const saveEval = async (finalStatus) => {
    if (saving) return;
    setSaving(true);
    const kScore = Math.round(kpiTotal), cScore = Math.round(compTotal), jScore = Math.round(jdTotal);
    const cy = +(window.CYCLE_YEAR || 2569);
    const histVal = Math.round(kScore * 0.6 + cScore * 0.4);
    // keep exactly one evaluation record per (employee, cycle_year): clear prior then insert
    await window.sb.from("evaluations").delete().eq("employee_id", e.id).eq("cycle_year", cy);
    const { error: evErr } = await window.sb.from("evaluations").insert({
      employee_id: e.id, cycle_year: cy, kpi_score: kScore, comp_score: cScore, jd_score: jScore,
      overall: Math.round(overall), comment: comment.trim() || null, evaluator: "คุณสุดารัตน์ (HR)", status: finalStatus,
      grade: outcome.grade, bonus_months: outcome.bonusMonths, raise_pct: outcome.raisePct, has_warning: outcome.hasWarning,
    });
    const newHist = finalStatus === "done" ? [...(e.history || []), histVal] : (e.history || []);
    const { error: upErr } = await window.sb.from("employees").update({
      kpi: kScore, comp: cScore, status: finalStatus, history: newHist,
    }).eq("id", e.id);
    setSaving(false);
    if (evErr || upErr) { toast("บันทึกไม่สำเร็จ: " + ((evErr || upErr).message), "x"); return; }
    await ctx.refresh();
    if (finalStatus === "done") { setSubmitted(true); toast("อนุมัติและบันทึกผลการประเมินแล้ว", "checkCircle"); }
    else toast("บันทึกฉบับร่างแล้ว", "check");
  };

  const tabs = [
    { id: "kpi", label: "A · KPI", count: kpiTotal },
    { id: "comp", label: "B · Competency", count: compTotal },
    { id: "jd", label: "C · ตาม JD", count: jdTotal },
    { id: "approve", label: "สรุป & อนุมัติ" },
  ];

  const Stepper = () => (
    <div className="row wrap" style={{ gap: 0 }}>
      {[["KPI", "น้ำหนัก " + wK + "%", kpiTotal, "#2563eb"], ["Competency", "น้ำหนัก " + wC + "%", compTotal, "#7c3aed"], ["JD-Based", "น้ำหนัก " + wJ + "%", jdTotal, "#0d9488"]].map(([n, w, v, c], i) => (
        <React.Fragment key={n}>
          <div style={{ textAlign: "center", flex: 1 }}>
            <div className="num" style={{ fontWeight: 700, fontSize: 24, color: c }}>{v}</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{n}</div>
            <div className="muted" style={{ fontSize: 11.5 }}>{w}</div>
          </div>
          {i < 2 && <div style={{ fontSize: 20, color: "var(--text-3)", padding: "0 4px", alignSelf: "flex-start", marginTop: 6 }}>+</div>}
        </React.Fragment>
      ))}
      <div style={{ fontSize: 20, color: "var(--text-3)", padding: "0 8px", alignSelf: "flex-start", marginTop: 6 }}>=</div>
      <div style={{ textAlign: "center", flex: 1 }}>
        <div className="num" style={{ fontWeight: 700, fontSize: 24, color: band.color }}>{overall}</div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>คะแนนรวม</div>
        <span className={"badge " + band.cls} style={{ marginTop: 2 }}>{band.label}</span>
      </div>
    </div>
  );

  return (
    <div className="grid">
      <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => ctx.openEmp(e.id)}><Icon name="chevLeft" size={15} />กลับ</button>

      {/* subject header */}
      <Card className="card-pad">
        <div className="row wrap between" style={{ gap: 16 }}>
          <div className="row" style={{ gap: 14 }}>
            <Avatar name={e.name} initials={e.initials} color={e.color} size={52} />
            <div>
              <div className="row" style={{ gap: 9 }}><span style={{ fontWeight: 700, fontSize: 17 }}>{e.name}</span><Badge cls="b-blue" dot>กำลังประเมิน</Badge></div>
              <div className="muted" style={{ fontSize: 13.5 }}>{e.position} · {deptName(e.dept)} · {COMPANY.cycle}</div>
            </div>
          </div>
          <div className="row wrap" style={{ gap: 10 }}>
            <select className="select" style={{ minWidth: 150 }} value={pickDept} onChange={(ev) => setPickDept(ev.target.value)} title="เลือกหน่วยงาน">
              {(window.DEPARTMENTS || []).filter((d) => (EMPLOYEES || []).some((emp) => emp.dept === d.id)).map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({(EMPLOYEES || []).filter((emp) => emp.dept === d.id).length})</option>
              ))}
            </select>
            {secList.length > 1 && (
              <select className="select" style={{ minWidth: 140 }} value={effSec} onChange={(ev) => setPickSec(ev.target.value)} title="เลือกส่วนงาน">
                {secList.map((s) => (
                  <option key={s} value={s}>{s} ({deptEmps.filter((emp) => window.sectionOf(emp.position) === s).length})</option>
                ))}
              </select>
            )}
            <select className="select" style={{ minWidth: 180 }} value={pickEmps.some((emp) => emp.id === e.id) ? e.id : ""} onChange={(ev) => ev.target.value && ctx.startEval(ev.target.value)} title="เลือกพนักงาน">
              {!pickEmps.some((emp) => emp.id === e.id) && <option value="">— เลือกพนักงาน —</option>}
              {pickEmps.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "")).map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name} {emp.status === "done" ? "✓" : ""}</option>
              ))}
            </select>
            <button className="btn btn-ghost" onClick={() => saveEval("progress")} disabled={saving}>{saving ? "กำลังบันทึก…" : "บันทึกร่าง"}</button>
            <button className="btn btn-pri" onClick={() => { setTab("approve"); }}>ไปขั้นอนุมัติ <Icon name="chevRight" size={15} /></button>
          </div>
        </div>
        <hr className="divider" style={{ margin: "18px 0" }} />
        <Stepper />
      </Card>

      <Card>
        <div style={{ padding: "0 8px" }}><Tabs tabs={tabs} active={tab} onChange={setTab} /></div>

        {/* A. KPI — ของแผนกจริง */}
        {tab === "kpi" && (
          <div className="card-pad fade-up" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>ให้คะแนนผลงานตาม KPI ของ <b>{deptName(kpiDept)}</b> (อ้างอิงตาม JD) (1–5 ดาว) · ถ่วงน้ำหนักตามที่กำหนด</p>
            {kpi.length === 0 && <div className="placeholder-img" style={{ height: 72 }}>ยังไม่มี KPI ของหน่วยงานนี้ — ตั้งค่าได้ที่ KPI หน่วยงาน → กำหนด KPI</div>}
            {kpi.map((k, i) => (
              <div key={k.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
                <div className="between wrap" style={{ gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div className="row" style={{ gap: 9 }}><Icon name="target" size={15} color="#2563eb" /><span style={{ fontWeight: 600, fontSize: 14 }}>{k.name}</span></div>
                    <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>เป้าหมาย {k.target || "—"} · น้ำหนัก {k.weight}%</div>
                  </div>
                  <div className="row" style={{ gap: 12 }}>
                    <Stars value={k.score} onChange={(v) => { const a = [...kpi]; a[i] = { ...a[i], score: v }; setKpi(a); }} />
                    <span className="num" style={{ fontWeight: 700, color: window.bandOf(k.score * 20).color, minWidth: 34 }}>{k.score * 20}</span>
                  </div>
                </div>
              </div>
            ))}
            <div className="between" style={{ background: "var(--surface-2)", borderRadius: 10, padding: "12px 16px" }}><b style={{ fontSize: 14 }}>คะแนน KPI รวม (ถ่วงน้ำหนัก)</b><span className="num" style={{ fontWeight: 700, fontSize: 16, color: "#2563eb" }}>{kpiTotal}</span></div>
          </div>
        )}

        {/* B. Competency */}
        {tab === "comp" && (
          <div className="card-pad fade-up" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>ให้คะแนนสมรรถนะตามตำแหน่ง ({comp.length} ด้าน · จาก JD) (1–5 ดาว) พร้อมความคิดเห็นประกอบ</p>
            {comp.map((c, i) => (
              <div key={c.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
                <div className="between wrap" style={{ gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 200 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div></div>
                  <div className="row" style={{ gap: 12 }}>
                    <Stars value={c.score} onChange={(v) => { const a = [...comp]; a[i] = { ...a[i], score: v }; setComp(a); }} />
                    <span className="num" style={{ fontWeight: 700, color: window.bandOf(c.score*20).color, minWidth: 34 }}>{c.score * 20}</span>
                  </div>
                </div>
                <input className="input" placeholder="ความคิดเห็น / ตัวอย่างพฤติกรรม…" style={{ marginTop: 12, fontSize: 13.5 }}
                  value={c.note} onChange={(ev) => { const a = [...comp]; a[i] = { ...a[i], note: ev.target.value }; setComp(a); }} />
              </div>
            ))}
          </div>
        )}

        {/* C. JD */}
        {tab === "jd" && (
          <div className="card-pad fade-up">
            <div className="row" style={{ gap: 10, background: "var(--accent-soft)", border: "1px solid var(--accent-soft-2)", borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
              <Icon name="jd" size={18} color="#2563eb" />
              <span style={{ fontSize: 13.5, color: "var(--accent-700)" }}>{empJD ? <>หัวข้อหน้าที่ดึงจาก JD: <b>{empJD.id} · {empJD.title}</b></> : <>ไม่พบ JD ตรงตำแหน่ง “{e.position}” — ใช้รายการมาตรฐาน</>}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {jd.map((j, i) => (
                <div key={j.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
                  <div className="between wrap" style={{ gap: 12 }}>
                    <div className="row" style={{ gap: 10, flex: 1, minWidth: 200 }}>
                      <span style={{ width: 26, height: 26, borderRadius: 8, background: "var(--surface-3)", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, color: "var(--text-2)", flex: "0 0 26px" }}>{i + 1}</span>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{j.name}</span>
                    </div>
                    <Stars value={j.score} onChange={(v) => { const a = [...jd]; a[i] = { ...a[i], score: v }; setJd(a); }} />
                  </div>
                  <div className="row wrap" style={{ gap: 10, marginTop: 12 }}>
                    <input className="input" placeholder="ความคิดเห็น…" style={{ flex: 1, minWidth: 200, fontSize: 13.5 }}
                      value={j.note} onChange={(ev) => { const a = [...jd]; a[i] = { ...a[i], note: ev.target.value }; setJd(a); }} />
                    <button className="btn btn-ghost btn-sm" onClick={() => toast("แนบไฟล์หลักฐานแล้ว", "paperclip")}><Icon name="paperclip" size={15} />แนบหลักฐาน</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary & Approve */}
        {tab === "approve" && (
          <div className="card-pad fade-up">
            <div className="grid" style={{ gridTemplateColumns: "1fr 1.3fr", gap: 24 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "10px 0" }}>
                <Ring value={overall} size={170} label={band.label} />
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
                  {[["KPI (" + wK + "%)", kpiTotal, "#2563eb"], ["Competency (" + wC + "%)", compTotal, "#7c3aed"], ["JD-Based (" + wJ + "%)", jdTotal, "#0d9488"]].map(([l, v, c]) => (
                    <div key={l} className="between" style={{ fontSize: 13.5 }}><span className="muted">{l}</span><span className="num" style={{ fontWeight: 700, color: c }}>{v}</span></div>
                  ))}
                </div>
                {/* outcome: grade + bonus + raise */}
                <div style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                  <div className="between" style={{ background: outcome.color + "14", padding: "12px 14px" }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>ผลสรุป</span>
                    <span className="badge" style={{ background: outcome.color + "22", color: outcome.color, fontWeight: 700 }}>เกรด {outcome.grade} · {outcome.gradeLabel}</span>
                  </div>
                  <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 9 }}>
                    <div className="between" style={{ fontSize: 13 }}><span className="row" style={{ gap: 7 }}><Icon name="trophy" size={15} color="#e08a00" />โบนัส</span>{outcome.bonusEligible ? <span style={{ fontWeight: 700, color: "#16a34a" }}>ได้รับ · {outcome.bonusMonths} เท่าของเงินเดือน</span> : <span className="muted" style={{ fontWeight: 600 }}>ไม่ได้รับ</span>}</div>
                    <div className="between" style={{ fontSize: 13 }}><span className="row" style={{ gap: 7 }}><Icon name="trend" size={15} color="#2563eb" />ปรับเงินเดือน</span>{outcome.raiseEligible ? <span style={{ fontWeight: 700, color: "#16a34a" }}>+{outcome.raisePct}%</span> : <span style={{ fontWeight: 600, color: "var(--red)" }}>ไม่ปรับเงิน</span>}</div>
                    {outcome.hasWarning && <div style={{ background: "var(--red-soft)", color: "#be123c", borderRadius: 8, padding: "8px 11px", fontSize: 12.5 }}><Icon name="alert" size={14} /> มีใบเตือน {outcome.warnings} ใบ — ระงับการปรับเงินเดือนรอบนี้</div>}
                  </div>
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 14 }}>สายการอนุมัติ (Approval Workflow)</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {[
                    { who: "ผู้ประเมิน (หัวหน้างาน)", role: e.reviewer, state: "done", date: "29 พ.ค. 2568" },
                    { who: "ผู้จัดการฝ่าย", role: "อนุมัติระดับฝ่าย", state: submitted ? "done" : "current", date: submitted ? "29 พ.ค. 2568" : "รอดำเนินการ" },
                    { who: "ฝ่ายทรัพยากรบุคคล", role: "ตรวจสอบและบันทึก", state: submitted ? "current" : "wait", date: "—" },
                  ].map((s, i, arr) => (
                    <div key={i} className="row" style={{ gap: 14, alignItems: "flex-start" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", alignSelf: "stretch" }}>
                        <span style={{ width: 30, height: 30, borderRadius: 999, display: "grid", placeItems: "center", flex: "0 0 30px",
                          background: s.state === "done" ? "#16a34a" : s.state === "current" ? "var(--accent)" : "var(--surface-3)",
                          color: s.state === "wait" ? "var(--text-3)" : "#fff" }}>
                          {s.state === "done" ? <Icon name="check" size={16} /> : <span className="mono" style={{ fontSize: 13, fontWeight: 700 }}>{i + 1}</span>}
                        </span>
                        {i < arr.length - 1 && <span style={{ width: 2, flex: 1, minHeight: 28, background: "var(--border)" }} />}
                      </div>
                      <div style={{ paddingBottom: 18 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.who}</div>
                        <div className="muted" style={{ fontSize: 12.5 }}>{s.role} · {s.date}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <textarea className="input" placeholder="ความคิดเห็นสรุปจากผู้ประเมิน…" style={{ marginTop: 8 }} value={comment} onChange={(ev) => setComment(ev.target.value)} />
                <div className="row wrap" style={{ gap: 10, marginTop: 16 }}>
                  <button className="btn btn-ghost" onClick={() => saveEval("progress")} disabled={saving}><Icon name="refresh" size={15} />บันทึกร่าง</button>
                  <button className="btn btn-pri" style={{ flex: 1 }} onClick={() => saveEval("done")} disabled={saving || submitted}>
                    <Icon name="check" size={16} />{submitted ? "อนุมัติแล้ว ✓" : (saving ? "กำลังบันทึก…" : "อนุมัติผลการประเมิน")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/* =========================================================
   JD MANAGEMENT
   ========================================================= */
/* ---------- Create JD modal ---------- */
function AddJDModal({ defaultDept, jd, ctx, onClose }) {
  const isEdit = !!jd;
  const [title, setTitle] = useS3((jd && jd.title) || "");
  const [dept, setDept] = useS3(jd ? jd.dept : (defaultDept && defaultDept !== "all" ? defaultDept : "prod"));
  const [kpis, setKpis] = useS3(jd ? String(jd.kpis) : "");
  const [comps, setComps] = useS3(jd ? String(jd.comps) : "");
  const [duties, setDuties] = useS3(jd && jd.duties ? jd.duties.join("\n") : "");
  const [busy, setBusy] = useS3(false);
  const [err, setErr] = useS3("");

  const thMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const today = () => { const d = new Date(); return String(d.getDate()).padStart(2, "0") + " " + thMonths[d.getMonth()] + " " + (d.getFullYear() + 543); };
  const nextId = (dp) => {
    const code = dp.toUpperCase();
    const ids = new Set((window.JD_LIBRARY || []).map((j) => j.id));
    let n = (window.JD_LIBRARY || []).filter((j) => j.dept === dp).length + 1;
    let id = "JD-" + code + "-" + String(n).padStart(2, "0");
    while (ids.has(id)) { n++; id = "JD-" + code + "-" + String(n).padStart(2, "0"); }
    return id;
  };

  const save = async () => {
    if (!title.trim()) { setErr("กรุณากรอกชื่อตำแหน่ง"); return; }
    const dutyArr = duties.split("\n").map((s) => s.trim()).filter(Boolean);
    setErr(""); setBusy(true);
    let error;
    if (isEdit) {
      ({ error } = await window.sb.from("jd_library").update({ title: title.trim(), dept, kpis: Number(kpis) || 0, comps: Number(comps) || 0, duties: dutyArr, updated: today() }).eq("id", jd.id));
    } else {
      ({ error } = await window.sb.from("jd_library").insert({
        id: nextId(dept), title: title.trim(), dept, version: "v1.0", updated: today(),
        status: "draft", kpis: Number(kpis) || 0, comps: Number(comps) || 0, duties: dutyArr, sort: 999,
      }));
    }
    if (error) { setBusy(false); setErr("บันทึกไม่สำเร็จ: " + error.message); return; }
    await ctx.refresh();
    toast(isEdit ? "บันทึก JD แล้ว" : "สร้าง JD “" + title.trim() + "” แล้ว", "check");
    onClose();
  };

  return (
    <Modal title={isEdit ? "แก้ไข Job Description" : "สร้าง Job Description ใหม่"} onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button className="btn btn-pri" onClick={save} disabled={busy}><Icon name="check" size={15} />{busy ? "กำลังบันทึก…" : "บันทึก JD"}</button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {err && <div style={{ padding: "10px 13px", borderRadius: 10, background: "var(--red-soft)", color: "#be123c", fontSize: 13 }}>{err}</div>}
        <div className="field"><label>ชื่อตำแหน่ง *</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น หัวหน้าแผนกควบคุมคุณภาพ" /></div>
        <div className="field"><label>หน่วยงาน</label><select className="select" value={dept} onChange={(e) => setDept(e.target.value)}>{(window.DEPARTMENTS || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="field"><label>จำนวน KPI ที่เชื่อมโยง</label><input className="input" type="number" value={kpis} onChange={(e) => setKpis(e.target.value)} placeholder="5" /></div>
          <div className="field"><label>จำนวน Competency</label><input className="input" type="number" value={comps} onChange={(e) => setComps(e.target.value)} placeholder="5" /></div>
        </div>
        <div className="field"><label>หน้าที่ความรับผิดชอบ (บรรทัดละ 1 ข้อ)</label><textarea className="input" value={duties} onChange={(e) => setDuties(e.target.value)} rows={5} placeholder={"ควบคุมคุณภาพงานให้เป็นไปตามมาตรฐาน\nวางแผนการผลิตและจัดสรรกำลังคน"} /></div>
      </div>
    </Modal>
  );
}

function JDManagement({ ctx }) {
  const [open, setOpen] = useS3(null);
  const [dept, setDept] = useS3("all");
  const [showAdd, setShowAdd] = useS3(false);
  const [editJd, setEditJd] = useS3(null);
  const list = JD_LIBRARY.filter((j) => dept === "all" || j.dept === dept);
  const stMeta = { active: { l: "ใช้งาน", c: "b-green" }, review: { l: "รอตรวจสอบ", c: "b-amber" }, draft: { l: "ฉบับร่าง", c: "b-gray" } };
  const jd = open ? JD_LIBRARY.find((j) => j.id === open) : null;

  return (
    <div className="grid">
      <div className="page-head">
        <div><h1>จัดการ Job Description</h1><p>คลัง JD แยกตามตำแหน่ง · เชื่อมโยง KPI และ Competency · ควบคุมเวอร์ชัน</p></div>
        <button className="btn btn-pri" onClick={() => setShowAdd(true)}><Icon name="plus" size={16} />สร้าง JD</button>
      </div>

      <div className="row wrap" style={{ gap: 8 }}>
        <button className={"chip" + (dept === "all" ? " on" : "")} onClick={() => setDept("all")}>ทุกหน่วยงาน</button>
        {DEPARTMENTS.map((d) => <button key={d.id} className={"chip" + (dept === d.id ? " on" : "")} onClick={() => setDept(d.id)}>{d.short}</button>)}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>
        {list.map((j) => {
          const sm = stMeta[j.status];
          return (
            <Card key={j.id} className="card-pad" style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: 13 }} >
              <div onClick={() => setOpen(j.id)} style={{ display: "contents" }}>
                <div className="between">
                  <span className="mono muted" style={{ fontSize: 12 }}>{j.id}</span>
                  <Badge cls={sm.c} dot>{sm.l}</Badge>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15.5 }}>{j.title}</div>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{deptName(j.dept)}</div>
                </div>
                <div className="row" style={{ gap: 18, borderTop: "1px solid var(--border-2)", paddingTop: 12 }}>
                  <div><div className="num" style={{ fontWeight: 700, fontSize: 17, color: "#2563eb" }}>{j.kpis}</div><div className="muted" style={{ fontSize: 11.5 }}>KPI mapped</div></div>
                  <div><div className="num" style={{ fontWeight: 700, fontSize: 17, color: "#7c3aed" }}>{j.comps}</div><div className="muted" style={{ fontSize: 11.5 }}>Competency</div></div>
                  <div style={{ marginLeft: "auto", textAlign: "right" }}><div className="mono" style={{ fontWeight: 600, fontSize: 13 }}>{j.version}</div><div className="muted" style={{ fontSize: 11.5 }}>{j.updated}</div></div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {jd && (
        <Drawer title={jd.title} sub={`${jd.id} · ${deptName(jd.dept)} · ${jd.version}`} onClose={() => setOpen(null)}
          footer={<>
            <button className="btn btn-ghost" onClick={() => toast("ดูประวัติเวอร์ชัน", "history")}><Icon name="history" size={15} />ประวัติเวอร์ชัน</button>
            <button className="btn btn-pri" onClick={() => { setEditJd(jd); setOpen(null); }}><Icon name="edit" size={15} />แก้ไข JD</button>
          </>}>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div>
              <div className="row between" style={{ marginBottom: 10 }}><b style={{ fontSize: 14 }}>หน้าที่ความรับผิดชอบหลัก</b><Badge cls={stMeta[jd.status].c}>{stMeta[jd.status].l}</Badge></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {jd.duties.map((d, i) => (
                  <div key={i} className="row" style={{ gap: 11, background: "var(--surface-2)", borderRadius: 10, padding: "11px 14px" }}>
                    <span style={{ color: "#16a34a", marginTop: 1 }}><Icon name="check" size={16} stroke={2.6} /></span>
                    <span style={{ fontSize: 13.5 }}>{d}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <b style={{ fontSize: 14, display: "block", marginBottom: 10 }}>KPI หน่วยงาน ({deptName(jd.kpi_dept || jd.dept)}) ที่อ้างอิง</b>
              {(() => {
                const ks = (window.KPI_DEFS || []).filter((k) => k.dept === (jd.kpi_dept || jd.dept));
                return ks.length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {ks.map((k) => (
                      <div key={k.id} className="between" style={{ border: "1px solid var(--border)", borderRadius: 9, padding: "9px 13px", gap: 10 }}>
                        <span className="row" style={{ gap: 9, fontSize: 13, minWidth: 0 }}><Icon name="target" size={15} color="#2563eb" /><span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k.name}</span></span>
                        <span className="num muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>เป้า {k.target.y}{k.unit || ""}</span>
                      </div>
                    ))}
                  </div>
                ) : <div className="muted" style={{ fontSize: 13 }}>ยังไม่มี KPI ของหน่วยงานนี้</div>;
              })()}
            </div>
            <div>
              <b style={{ fontSize: 14, display: "block", marginBottom: 10 }}>สมรรถนะตามตำแหน่ง ({(jd.competencies || []).length} ด้าน)</b>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {(jd.competencies || []).map((c, i) => (
                  <div key={i} className="row" style={{ gap: 9, fontSize: 13, background: "var(--surface-2)", borderRadius: 9, padding: "9px 13px" }}><span style={{ color: "#7c3aed", flex: "0 0 auto" }}><Icon name="award" size={15} /></span>{c}</div>
                ))}
                {(jd.competencies || []).length === 0 && <div className="muted" style={{ fontSize: 13 }}>—</div>}
              </div>
            </div>
          </div>
        </Drawer>
      )}

      {showAdd && <AddJDModal defaultDept={dept} ctx={ctx} onClose={() => setShowAdd(false)} />}
      {editJd && <AddJDModal jd={editJd} ctx={ctx} onClose={() => setEditJd(null)} />}
    </div>
  );
}

Object.assign(window, { Evaluation, JDManagement });
