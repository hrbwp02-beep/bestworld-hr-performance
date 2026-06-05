// screens-eval-jd.jsx — Evaluation form + JD Management
const { useState: useS3, useMemo: useM3 } = React;

// ---- Multi-level approval workflow (Phase 7) ----
const APPROVAL_STAGES = [
  { key: "supervisor", label: "หัวหน้างาน / ผู้ประเมิน" },
  { key: "manager", label: "ผู้จัดการฝ่าย" },
  { key: "hr", label: "ฝ่ายทรัพยากรบุคคล" },
];
async function currentApprover() {
  try {
    const u = (await window.sb.auth.getUser()).data.user;
    const email = u && u.email;
    const au = (window.APP_USERS || []).find((a) => a.email === email);
    return { email, name: (au && (au.name || au.full_name)) || email || "ผู้ใช้งาน", role: (au && au.role) || "user" };
  } catch (e) { return { email: null, name: "ผู้ใช้งาน", role: "user" }; }
}
const fmtApprovalTime = (iso) => { try { const d = new Date(iso); const m = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."]; return d.getDate() + " " + m[d.getMonth()] + " " + (d.getFullYear() + 543) + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); } catch (e) { return ""; } }

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
  const empSection = window.sectionOf(e.position);
  let deptKpis = (window.KPI_DEFS || []).filter((k) => k.dept === kpiDept && k.status === "approved");
  // หน่วยงานที่มี KPI แยกตามส่วนงาน (เช่น ผลิต: พิมพ์/สลิท vs เป่า-ภาพรวม) → กรองตามส่วนงานของพนักงาน
  if (deptKpis.some((k) => k.section)) {
    const isPrint = /พิมพ์|สลิท/.test(empSection);
    deptKpis = deptKpis.filter((k) => !k.section || (isPrint ? k.section === "พิมพ์" : k.section === "เป่า"));
  }
  const W = window.APP_SETTINGS || {};
  const wK = W.w_kpi != null ? W.w_kpi : 50, wC = W.w_comp != null ? W.w_comp : 25, wJ = W.w_jd != null ? W.w_jd : 25;
  const wSum = (wK + wC + wJ) || 100;

  // ===== แบบประเมิน 2 ส่วนตามไฟล์ : A ผลงาน/KPI (70%) + B สมรรถนะ (30%) =====
  const buildA = () => {
    // A1 · KPI รายบุคคล (จากหน้าที่ JD) — กลุ่ม 70%
    let a1src = (empJD && empJD.eval_a && empJD.eval_a.length) ? empJD.eval_a.filter((x) => (x.grp || "a1") === "a1") : null;
    if (!a1src || !a1src.length) {
      const duties = (empJD && empJD.duties && empJD.duties.length) ? empJD.duties : [];
      a1src = duties.map((name) => ({ name }));
    }
    const a1HasW = a1src.some((x) => x.weight);
    const a1w = a1src.length ? 70 / a1src.length : 0;
    const A1 = a1src.map((x, i) => ({ id: "a1_" + i, name: x.name, weight: a1HasW ? (Number(x.weight) || 0) : Math.round(a1w * 10) / 10, grp: "a1", target: x.target || null, score: 3, note: "" }));
    // A2 · KPI ร่วมของหน่วยงาน — ดึงจาก KPI หน่วยงานจริง (กรองตามส่วนงาน) ทุก JD · กลุ่ม 30%
    const kd = (empJD && (empJD.kpi_dept || empJD.dept)) || e.dept;
    let dk = (window.KPI_DEFS || []).filter((k) => k.dept === kd && k.status === "approved");
    if (dk.some((k) => k.section)) { const isPrint = /พิมพ์|สลิท/.test(empSection); dk = dk.filter((k) => !k.section || (isPrint ? k.section === "พิมพ์" : k.section === "เป่า")); }
    const a2w = dk.length ? 30 / dk.length : 0;
    const A2 = dk.map((k, i) => ({ id: "a2_" + i, name: k.en || k.name, weight: Math.round(a2w * 10) / 10, grp: "a2", target: k.formula || ((k.target && k.target.y != null ? k.target.y : "") + (k.unit || "")), score: 3, note: "" }));
    return [...A1, ...A2];
  };
  const buildB = () => {
    if (empJD && empJD.eval_b && empJD.eval_b.length) return empJD.eval_b.map((it, i) => ({ id: "b" + i, name: it.name, weight: Number(it.weight) || 0, grp: it.grp || "specific", score: 3, note: "" }));
    const comps = (empJD && empJD.competencies && empJD.competencies.length) ? empJD.competencies : (COMPETENCIES || []).map((c) => c.name);
    return comps.map((name, i) => ({ id: "b" + i, name, weight: Math.round(100 / (comps.length || 1)), grp: i < 3 ? "core" : "specific", score: 3, note: "" }));
  };
  const [tab, setTab] = useS3("a");
  const [secA, setSecA] = useS3(buildA);
  const [secB, setSecB] = useS3(buildB);
  const [submitted, setSubmitted] = useS3(false);
  const [comment, setComment] = useS3("");
  const [saving, setSaving] = useS3(false);
  const evalSup = (EMPLOYEES || []).find((x) => x.id === e.supervisor_id) || null; // ผู้ประเมิน (หัวหน้างาน)
  const [evalCode, setEvalCode] = useS3(e.supervisor_id || "");
  const evalCodeName = ((EMPLOYEES || []).find((x) => x.id === evalCode) || {}).name || e.reviewer || "";
  const [pickDept, setPickDept] = useS3(e.dept);
  const [pickSec, setPickSec] = useS3(window.sectionOf(e.position));
  const deptEmps = (EMPLOYEES || []).filter((emp) => emp.dept === pickDept);
  const secList = [...new Set(deptEmps.map((emp) => window.sectionOf(emp.position)))];
  const effSec = secList.includes(pickSec) ? pickSec : secList[0];
  const pickEmps = secList.length > 1 ? deptEmps.filter((emp) => window.sectionOf(emp.position) === effSec) : deptEmps;

  const wsum = (arr) => arr.reduce((s, x) => s + (x.weight || 0), 0);
  const aTotal = useM3(() => { if (!secA.length) return 0; const w = wsum(secA) || secA.length; return Math.round(secA.reduce((s, x) => s + x.score * 20 * (x.weight || 1), 0) / w * 10) / 10; }, [secA]);
  const bTotal = useM3(() => { if (!secB.length) return 0; const w = wsum(secB) || secB.length; return Math.round(secB.reduce((s, x) => s + x.score * 20 * (x.weight || 1), 0) / w * 10) / 10; }, [secB]);
  const kpiTotal = aTotal, compTotal = bTotal, jdTotal = 0;
  const overall = Math.round((aTotal * wK + bTotal * wC) / ((wK + wC) || 100) * 10) / 10;
  const band = window.bandOf(overall);
  const outcome = window.evalOutcome(overall, e.warnings);
  // approval workflow state (Phase 7)
  const evRec = e.eval || null;
  const curStage = evRec ? (evRec.stage || "draft") : "draft";
  const isApproved = !!(evRec && (evRec.status === "done" || curStage === "approved"));
  const inReview = !!(evRec && evRec.status === "review" && !isApproved);
  const curIdx = APPROVAL_STAGES.findIndex((s) => s.key === curStage);
  const approvalsLog = (evRec && evRec.approvals) || [];
  // แสดงคะแนนที่บันทึกไว้แล้วเมื่ออยู่ระหว่าง/ผ่านการอนุมัติ มิฉะนั้นใช้คะแนนสดจากฟอร์ม
  const showSaved = inReview || isApproved;
  const dOverall = showSaved ? evRec.overall : overall;
  const dKpi = showSaved ? evRec.kpi_score : kpiTotal;
  const dComp = showSaved ? evRec.comp_score : compTotal;
  const dJd = showSaved ? evRec.jd_score : jdTotal;
  const dBand = window.bandOf(dOverall);
  const dOutcome = showSaved ? window.evalOutcome(dOverall, e.warnings) : outcome;

  // save the evaluation to Supabase: record it + write scores back to the employee
  const saveEval = async (finalStatus) => {
    if (saving) return;
    setSaving(true);
    try {
      // ตรวจสอบ session ก่อน — ถ้าหลุด login จะบันทึกไม่ได้
      const sess = (await window.sb.auth.getSession()).data.session;
      if (!sess) { toast("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่", "x"); return; }
      const kScore = Math.round(kpiTotal), cScore = Math.round(compTotal), jScore = Math.round(jdTotal);
      const cy = +(window.CYCLE_YEAR || 2569);
      const histVal = Math.round(kScore * 0.6 + cScore * 0.4);
      // keep exactly one evaluation record per (employee, cycle_year): clear prior then insert
      const { error: delErr } = await window.sb.from("evaluations").delete().eq("employee_id", e.id).eq("cycle_year", cy);
      if (delErr) { toast("บันทึกไม่สำเร็จ (ลบรอบเดิม): " + delErr.message, "x"); return; }
      const items = {
        a: secA.map((x) => ({ name: x.name, weight: x.weight, score: x.score * 20 })),
        b: secB.map((x) => ({ name: x.name, weight: x.weight, grp: x.grp, score: x.score * 20 })),
        kpi: secA.map((x) => ({ name: x.name, score: x.score * 20 })),
        comp: secB.map((x) => ({ name: x.name, score: x.score * 20 })),
      };
      const who = await currentApprover();
      const isSubmit = finalStatus === "review";
      const stage = isSubmit ? APPROVAL_STAGES[0].key : "draft";
      const approvals = isSubmit ? [{ stage: "submit", act: "ส่งเข้าสายอนุมัติ", by: who.name, at: new Date().toISOString() }] : [];
      const { error: evErr } = await window.sb.from("evaluations").insert({
        employee_id: e.id, cycle_year: cy, kpi_score: kScore, comp_score: cScore, jd_score: 0,
        a_score: kScore, b_score: cScore,
        overall: Math.round(overall), comment: comment.trim() || null, evaluator: evalCodeName || who.name, evaluator_code: evalCode || null, status: finalStatus === "review" ? "review" : "progress",
        grade: outcome.grade, bonus_months: outcome.bonusMonths, raise_pct: outcome.raisePct, has_warning: outcome.hasWarning,
        items, stage, approvals,
      });
      if (evErr) { toast("บันทึกไม่สำเร็จ: " + evErr.message, "x"); return; }
      const { error: upErr } = await window.sb.from("employees").update({
        kpi: kScore, comp: cScore, status: finalStatus === "review" ? "review" : "progress", history: e.history || [],
      }).eq("id", e.id);
      if (upErr) { toast("บันทึกคะแนนพนักงานไม่สำเร็จ: " + upErr.message, "x"); return; }
      await ctx.refresh();
      if (finalStatus === "review") { setSubmitted(true); toast("ส่งเข้าสายอนุมัติแล้ว → " + APPROVAL_STAGES[0].label, "checkCircle"); }
      else toast("บันทึกฉบับร่างแล้ว", "check");
    } catch (err) {
      toast("บันทึกไม่สำเร็จ: " + (err && err.message ? err.message : String(err)), "x");
    } finally {
      setSaving(false);
    }
  };

  // เดินสายอนุมัติไปขั้นถัดไป (หรือจบ → done) / ตีกลับให้แก้ไข
  const advanceApproval = async () => {
    if (saving) return; setSaving(true);
    try {
      const cy = +(window.CYCLE_YEAR || 2569);
      const rec = e.eval; if (!rec) { toast("ยังไม่มีใบประเมินให้อนุมัติ", "x"); return; }
      const who = await currentApprover();
      const cur = rec.stage || APPROVAL_STAGES[0].key;
      const idx = APPROVAL_STAGES.findIndex((s) => s.key === cur);
      const curLabel = (APPROVAL_STAGES[idx] || {}).label || cur;
      const log = [...(rec.approvals || []), { stage: cur, act: "อนุมัติ", by: who.name, at: new Date().toISOString(), note: comment.trim() || null }];
      const next = APPROVAL_STAGES[idx + 1];
      const patch = next ? { stage: next.key, approvals: log } : { stage: "approved", status: "done", approvals: log };
      const { error } = await window.sb.from("evaluations").update(patch).eq("employee_id", e.id).eq("cycle_year", cy);
      if (error) { toast("อนุมัติไม่สำเร็จ: " + error.message, "x"); return; }
      if (!next) {
        const histVal = Math.round((rec.kpi_score || 0) * 0.6 + (rec.comp_score || 0) * 0.4);
        await window.sb.from("employees").update({ status: "done", history: [...(e.history || []), histVal] }).eq("id", e.id);
      }
      await ctx.refresh();
      toast(next ? ("อนุมัติขั้น " + curLabel + " แล้ว → " + next.label) : "อนุมัติครบทุกขั้น เสร็จสมบูรณ์", "checkCircle");
    } catch (err) { toast("อนุมัติไม่สำเร็จ: " + (err && err.message ? err.message : String(err)), "x"); }
    finally { setSaving(false); }
  };
  const rejectApproval = async () => {
    if (saving) return; setSaving(true);
    try {
      const cy = +(window.CYCLE_YEAR || 2569);
      const rec = e.eval; if (!rec) return;
      const who = await currentApprover();
      const log = [...(rec.approvals || []), { stage: rec.stage || "", act: "ตีกลับให้แก้ไข", by: who.name, at: new Date().toISOString(), note: comment.trim() || null }];
      await window.sb.from("evaluations").update({ stage: "draft", status: "progress", approvals: log }).eq("employee_id", e.id).eq("cycle_year", cy);
      await window.sb.from("employees").update({ status: "progress" }).eq("id", e.id);
      await ctx.refresh();
      toast("ตีกลับให้แก้ไขแล้ว", "check");
    } catch (err) { toast("ไม่สำเร็จ: " + (err && err.message ? err.message : String(err)), "x"); }
    finally { setSaving(false); }
  };

  const tabs = [
    { id: "a", label: "A · ผลงาน/KPI (70%)", count: aTotal },
    { id: "b", label: "B · สมรรถนะ (30%)", count: bTotal },
    { id: "approve", label: "สรุป & อนุมัติ" },
  ];

  const Stepper = () => (
    <div className="row wrap" style={{ gap: 0 }}>
      {[["A · ผลงาน/KPI", "น้ำหนัก " + wK + "%", aTotal, "#2563eb"], ["B · สมรรถนะ", "น้ำหนัก " + wC + "%", bTotal, "#7c3aed"]].map(([n, w, v, c], i) => (
        <React.Fragment key={n}>
          <div style={{ textAlign: "center", flex: 1 }}>
            <div className="num" style={{ fontWeight: 700, fontSize: 24, color: c }}>{v}</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{n}</div>
            <div className="muted" style={{ fontSize: 11.5 }}>{w}</div>
          </div>
          {i < 1 && <div style={{ fontSize: 20, color: "var(--text-3)", padding: "0 4px", alignSelf: "flex-start", marginTop: 6 }}>+</div>}
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
              <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>ผู้ประเมิน: {evalCodeName || "—"}{evalCode ? " · รหัส " + evalCode : ""}</div>
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

        {/* ส่วน A — ผลงานตามเป้าหมาย / KPI (หน้าที่หลักจาก JD) · น้ำหนัก 70% */}
        {tab === "a" && (
          <div className="card-pad fade-up" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="row" style={{ gap: 10, background: "var(--accent-soft)", border: "1px solid var(--accent-soft-2)", borderRadius: 12, padding: "12px 16px" }}>
              <Icon name="jd" size={18} color="#2563eb" />
              <span style={{ fontSize: 13.5, color: "var(--accent-700)" }}>ส่วน A · ผลงานตามเป้าหมาย/KPI (หน้าที่หลักจาก JD) · น้ำหนักส่วน 70% · {empJD ? <b>{empJD.id} · {empJD.title}</b> : "ใช้รายการจากตำแหน่ง"}</span>
            </div>
            {secA.length === 0 && <div className="placeholder-img" style={{ height: 72 }}>ยังไม่มีหัวข้อผลงาน — ผูก JD ให้พนักงานก่อน</div>}
            {["a1", "a2"].map((grp) => {
              const rows = secA.map((k, i) => ({ ...k, _i: i })).filter((k) => (k.grp || "a1") === grp);
              if (!rows.length) return null;
              return (
                <div key={grp}>
                  <div className="muted" style={{ fontSize: 12.5, fontWeight: 700, margin: "4px 0 8px" }}>{grp === "a1" ? "A1 · KPI รายบุคคล (จากหน้าที่ใน JD — ให้คะแนนตามผลงานแต่ละคน)" : "A2 · KPI ร่วมของหน่วยงาน (จาก KPI ฝ่าย — ทั้งทีมใช้ผลร่วมกัน)"}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {rows.map((k) => (
                      <div key={k.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
                        <div className="between wrap" style={{ gap: 12 }}>
                          <div className="row" style={{ gap: 10, flex: 1, minWidth: 220 }}>
                            <span style={{ width: 24, height: 24, borderRadius: 7, background: grp === "a2" ? "#e2f4f2" : "var(--surface-3)", display: "grid", placeItems: "center", fontSize: 11.5, fontWeight: 700, color: grp === "a2" ? "#0d9488" : "var(--text-2)", flex: "0 0 24px" }}>{k._i + 1}</span>
                            <div><span style={{ fontWeight: 600, fontSize: 13.5, lineHeight: 1.4 }}>{k.name}</span><div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>น้ำหนัก {k.weight}%{k.target ? " · เป้า " + k.target : ""}</div></div>
                          </div>
                          <div className="row" style={{ gap: 12 }}>
                            <Stars value={k.score} onChange={(v) => { const a = [...secA]; a[k._i] = { ...a[k._i], score: v }; setSecA(a); }} />
                            <span className="num" style={{ fontWeight: 700, color: window.bandOf(k.score * 20).color, minWidth: 34 }}>{k.score * 20}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="between" style={{ background: "var(--surface-2)", borderRadius: 10, padding: "12px 16px" }}><b style={{ fontSize: 14 }}>คะแนนส่วน A (รายบุคคล + ร่วมทีม · ถ่วงน้ำหนัก เต็ม 100)</b><span className="num" style={{ fontWeight: 700, fontSize: 16, color: "#2563eb" }}>{aTotal}</span></div>
          </div>
        )}

        {/* ส่วน B — สมรรถนะ (Core 40% + เฉพาะตำแหน่ง 60%) · น้ำหนัก 30% */}
        {tab === "b" && (
          <div className="card-pad fade-up" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="row" style={{ gap: 10, background: "#f3ecfd", border: "1px solid #e4d6fb", borderRadius: 12, padding: "12px 16px" }}>
              <Icon name="award" size={18} color="#7c3aed" />
              <span style={{ fontSize: 13.5, color: "#6d28d9" }}>ส่วน B · สมรรถนะ/พฤติกรรม · น้ำหนักส่วน 30% (สมรรถนะหลัก Core + เฉพาะตำแหน่ง)</span>
            </div>
            {["core", "specific"].map((grp) => {
              const rows = secB.map((c, i) => ({ ...c, _i: i })).filter((c) => (c.grp || "specific") === grp);
              if (!rows.length) return null;
              return (
                <div key={grp}>
                  <div className="muted" style={{ fontSize: 12.5, fontWeight: 700, margin: "4px 0 8px" }}>{grp === "core" ? "B1 · สมรรถนะหลัก (Core — เหมือนกันทั้งบริษัท)" : "B2 · สมรรถนะเฉพาะตำแหน่ง (จาก JD)"}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {rows.map((c) => (
                      <div key={c.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
                        <div className="between wrap" style={{ gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 200 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.name}</div><div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>น้ำหนัก {c.weight}%</div></div>
                          <div className="row" style={{ gap: 12 }}>
                            <Stars value={c.score} onChange={(v) => { const a = [...secB]; a[c._i] = { ...a[c._i], score: v }; setSecB(a); }} />
                            <span className="num" style={{ fontWeight: 700, color: window.bandOf(c.score * 20).color, minWidth: 34 }}>{c.score * 20}</span>
                          </div>
                        </div>
                        <input className="input" placeholder="ความคิดเห็น / ตัวอย่างพฤติกรรม…" style={{ marginTop: 10, fontSize: 13.5 }}
                          value={c.note} onChange={(ev) => { const a = [...secB]; a[c._i] = { ...a[c._i], note: ev.target.value }; setSecB(a); }} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="between" style={{ background: "var(--surface-2)", borderRadius: 10, padding: "12px 16px" }}><b style={{ fontSize: 14 }}>คะแนนส่วน B (ถ่วงน้ำหนัก · เต็ม 100)</b><span className="num" style={{ fontWeight: 700, fontSize: 16, color: "#7c3aed" }}>{bTotal}</span></div>
          </div>
        )}

        {/* Summary & Approve */}
        {tab === "approve" && (
          <div className="card-pad fade-up">
            <div className="grid" style={{ gridTemplateColumns: "1fr 1.3fr", gap: 24 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "10px 0" }}>
                <Ring value={dOverall} size={170} label={dBand.label} />
                <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
                  {[["A · ผลงาน/KPI (" + wK + "%)", dKpi, "#2563eb"], ["B · สมรรถนะ (" + wC + "%)", dComp, "#7c3aed"]].map(([l, v, c]) => (
                    <div key={l} className="between" style={{ fontSize: 13.5 }}><span className="muted">{l}</span><span className="num" style={{ fontWeight: 700, color: c }}>{v}</span></div>
                  ))}
                </div>
                {/* outcome: grade + bonus + raise */}
                <div style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                  <div className="between" style={{ background: dOutcome.color + "14", padding: "12px 14px" }}>
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>ผลสรุป</span>
                    <span className="badge" style={{ background: dOutcome.color + "22", color: dOutcome.color, fontWeight: 700 }}>เกรด {dOutcome.grade} · {dOutcome.gradeLabel}</span>
                  </div>
                  <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 9 }}>
                    <div className="between" style={{ fontSize: 13 }}><span className="row" style={{ gap: 7 }}><Icon name="trophy" size={15} color="#e08a00" />โบนัส</span>{dOutcome.bonusEligible ? <span style={{ fontWeight: 700, color: "#16a34a" }}>ได้รับ · {dOutcome.bonusMonths} เท่าของเงินเดือน</span> : <span className="muted" style={{ fontWeight: 600 }}>ไม่ได้รับ</span>}</div>
                    <div className="between" style={{ fontSize: 13 }}><span className="row" style={{ gap: 7 }}><Icon name="trend" size={15} color="#2563eb" />ปรับเงินเดือน</span>{dOutcome.raiseEligible ? <span style={{ fontWeight: 700, color: "#16a34a" }}>+{dOutcome.raisePct}%</span> : <span style={{ fontWeight: 600, color: "var(--red)" }}>ไม่ปรับเงิน</span>}</div>
                    {dOutcome.hasWarning && <div style={{ background: "var(--red-soft)", color: "#be123c", borderRadius: 8, padding: "8px 11px", fontSize: 12.5 }}><Icon name="alert" size={14} /> มีใบเตือน {dOutcome.warnings} ใบ — ระงับการปรับเงินเดือนรอบนี้</div>}
                  </div>
                </div>
              </div>
              <div>
                <div className="between" style={{ marginBottom: 14 }}>
                  <span style={{ fontWeight: 600, fontSize: 14.5 }}>สายการอนุมัติ (Approval Workflow)</span>
                  <Badge cls={isApproved ? "b-green" : inReview ? "b-amber" : "b-gray"} dot>{isApproved ? "อนุมัติครบแล้ว" : inReview ? "อยู่ระหว่างอนุมัติ" : "ยังไม่ส่ง"}</Badge>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {APPROVAL_STAGES.map((s, i, arr) => {
                    const done = isApproved || (curIdx > -1 && i < curIdx);
                    const current = inReview && i === curIdx;
                    const state = done ? "done" : current ? "current" : "wait";
                    const log = [...approvalsLog].reverse().find((a) => a.stage === s.key && a.act === "อนุมัติ");
                    return (
                      <div key={s.key} className="row" style={{ gap: 14, alignItems: "flex-start" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", alignSelf: "stretch" }}>
                          <span style={{ width: 30, height: 30, borderRadius: 999, display: "grid", placeItems: "center", flex: "0 0 30px",
                            background: state === "done" ? "#16a34a" : state === "current" ? "var(--accent)" : "var(--surface-3)",
                            color: state === "wait" ? "var(--text-3)" : "#fff" }}>
                            {state === "done" ? <Icon name="check" size={16} /> : <span className="mono" style={{ fontSize: 13, fontWeight: 700 }}>{i + 1}</span>}
                          </span>
                          {i < arr.length - 1 && <span style={{ width: 2, flex: 1, minHeight: 28, background: "var(--border)" }} />}
                        </div>
                        <div style={{ paddingBottom: 18 }}>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.label}{i === 0 && e.reviewer ? " · " + e.reviewer : ""}</div>
                          <div className="muted" style={{ fontSize: 12.5 }}>{log ? ("อนุมัติโดย " + log.by + " · " + fmtApprovalTime(log.at)) : current ? "รอดำเนินการขั้นนี้" : done ? "ผ่านแล้ว" : "รอขั้นก่อนหน้า"}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="field" style={{ marginTop: 8 }}><label style={{ fontSize: 12.5 }}>ผู้ประเมิน (หัวหน้างาน) · รหัส</label>
                  <select className="select" value={evalCode} onChange={(ev) => setEvalCode(ev.target.value)} disabled={isApproved}>
                    <option value="">— ไม่ระบุ —</option>
                    {(EMPLOYEES || []).slice().sort((a, b) => (a.dept || "").localeCompare(b.dept || "")).map((x) => <option key={x.id} value={x.id}>{x.id} · {x.name} ({deptShort(x.dept)})</option>)}
                  </select>
                  {evalCode && <span className="muted" style={{ fontSize: 11.5 }}>รหัส {evalCode} · {evalCodeName}</span>}
                </div>
                <textarea className="input" placeholder={inReview ? "ความคิดเห็นผู้อนุมัติ / เหตุผลตีกลับ…" : "ความคิดเห็นสรุปจากผู้ประเมิน…"} style={{ marginTop: 8 }} value={comment} onChange={(ev) => setComment(ev.target.value)} />
                <div className="row wrap" style={{ gap: 10, marginTop: 16 }}>
                  {isApproved ? (
                    <button className="btn btn-pri" style={{ flex: 1 }} disabled><Icon name="checkCircle" size={16} />อนุมัติครบทุกขั้นแล้ว ✓</button>
                  ) : inReview ? (<>
                    <button className="btn btn-ghost" onClick={rejectApproval} disabled={saving} style={{ color: "var(--red)" }}><Icon name="x" size={15} />ตีกลับแก้ไข</button>
                    <button className="btn btn-pri" style={{ flex: 1 }} onClick={advanceApproval} disabled={saving}>
                      <Icon name="check" size={16} />{saving ? "กำลังดำเนินการ…" : ("อนุมัติขั้น: " + ((APPROVAL_STAGES[curIdx] || {}).label || ""))}
                    </button>
                  </>) : (<>
                    <button className="btn btn-ghost" onClick={() => saveEval("progress")} disabled={saving}><Icon name="refresh" size={15} />บันทึกร่าง</button>
                    <button className="btn btn-pri" style={{ flex: 1 }} onClick={() => saveEval("review")} disabled={saving}>
                      <Icon name="check" size={16} />{saving ? "กำลังบันทึก…" : "ส่งเข้าสายอนุมัติ"}
                    </button>
                  </>)}
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
  const [compList, setCompList] = useS3(jd && jd.competencies ? jd.competencies.join("\n") : "");
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
    const compArr = compList.split("\n").map((s) => s.trim()).filter(Boolean);
    const compCount = compArr.length || Number(comps) || 0;
    setErr(""); setBusy(true);
    let error;
    if (isEdit) {
      ({ error } = await window.sb.from("jd_library").update({ title: title.trim(), dept, kpis: Number(kpis) || 0, comps: compCount, competencies: compArr, duties: dutyArr, updated: today() }).eq("id", jd.id));
    } else {
      ({ error } = await window.sb.from("jd_library").insert({
        id: nextId(dept), title: title.trim(), dept, version: "v1.0", updated: today(),
        status: "draft", kpis: Number(kpis) || 0, comps: compCount, competencies: compArr, duties: dutyArr, sort: 999,
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
        <div className="field"><label>จำนวน KPI ที่เชื่อมโยง</label><input className="input" type="number" value={kpis} onChange={(e) => setKpis(e.target.value)} placeholder="5" /></div>
        <div className="field"><label>สมรรถนะตามตำแหน่ง (Competency · บรรทัดละ 1 ข้อ — แนะนำ ≥ 5 ข้อ)</label><textarea className="input" value={compList} onChange={(e) => setCompList(e.target.value)} rows={5} placeholder={"ความรับผิดชอบและตรงต่อเวลา\nการทำงานเป็นทีมและการสื่อสาร\nวินัย ความปลอดภัย และกิจกรรม 5ส\nการแก้ปัญหาและการตัดสินใจ\nความรู้ความสามารถในงาน"} /><div className="muted" style={{ fontSize: 12, marginTop: 4 }}>ใช้เป็นหัวข้อให้คะแนนในฟอร์มประเมิน (ส่วน B) · ตอนนี้ {compList.split("\n").map((s) => s.trim()).filter(Boolean).length} ข้อ</div></div>
        <div className="field"><label>หน้าที่ความรับผิดชอบ (ตาม JD · บรรทัดละ 1 ข้อ)</label><textarea className="input" value={duties} onChange={(e) => setDuties(e.target.value)} rows={5} placeholder={"ควบคุมคุณภาพงานให้เป็นไปตามมาตรฐาน\nวางแผนการผลิตและจัดสรรกำลังคน"} /></div>
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
