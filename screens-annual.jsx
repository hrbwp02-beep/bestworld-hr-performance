// screens-annual.jsx — ประเมินผลประจำปีแบบใหม่ (ตาม JD เพื่อคิดโบนัส/ขึ้นเงินเดือน)
// ข้อมูลอยู่ในตาราง perf_* และคิดคะแนนในฐานข้อมูล (ฟังก์ชัน perf_results) — หน้าจอนี้แสดงผลและส่งคำสั่งเท่านั้น
// บัญชีหน่วยงาน (เช่น maintenance@) ประเมินพนักงานในหน่วยงานของตน · HR/admin เห็นและจัดการทั้งหมด
const { useState: useAnnS, useEffect: useAnnE, useMemo: useAnnM } = React;

const ANN_STATUS = {
  pending: ["ยังไม่เริ่ม", "b-gray"],
  draft: ["กำลังประเมิน", "b-blue"],
  submitted: ["รอผู้จัดการทบทวน", "b-amber"],
  reviewed: ["รอ HR อนุมัติ", "b-amber"],
  approved: ["อนุมัติแล้ว", "b-green"],
  returned: ["ตีกลับแก้ไข", "b-red"],
};
const ANN_LEVEL = { ops: "พนักงานปฏิบัติการ", office: "เจ้าหน้าที่สำนักงาน", supervisor: "หัวหน้างาน", manager: "ผู้จัดการขึ้นไป" };
const ANN_SECTION = {
  A: "A · งานตามหน้าที่ (JD)",
  B_skill: "B · ทักษะงานตามตำแหน่ง",
  B_lead: "B · ภาวะผู้นำ",
  C: "C · พฤติกรรมหลัก",
};
const ANN_RATING = [
  [1, "ต่ำกว่าที่คาดหวังมาก"], [2, "ต่ำกว่าที่คาดหวัง"], [3, "ตามที่คาดหวัง"], [4, "ดีกว่าที่คาดหวัง"], [5, "โดดเด่น"],
];
const ANN_GRADE_COLOR = { "A+": "#15803d", A: "#16a34a", "B+": "#0d9488", B: "#0891b2", C: "#e08a00", D: "#e11d48", F: "#9f1239" };
const ANN_DEDUCT = [
  ["late", "มาสาย (ครั้ง)"], ["absent", "ขาดงาน (วัน)"], ["personal_over", "ลากิจเกินสิทธิ์ (วัน)"], ["sick_over", "ลาป่วยเกินสิทธิ์ (วัน)"],
  ["sick_no_cert", "ลาป่วยไม่มีใบรับรองแพทย์ (ครั้ง)"], ["unapproved", "ลาโดยไม่ได้รับอนุมัติ (ครั้ง)"], ["unpaid", "ลาไม่รับค่าจ้าง (ครั้ง)"],
  ["warn_verbal", "หนังสือเตือนด้วยวาจา"], ["warn_written_1", "หนังสือเตือนลายลักษณ์อักษร ครั้งที่ 1"],
  ["warn_written_2", "หนังสือเตือนลายลักษณ์อักษร ครั้งที่ 2"], ["warn_written_3", "หนังสือเตือนลายลักษณ์อักษร ครั้งที่ 3"],
  ["suspend", "พักงาน"], ["adjust", "ปรับคะแนน (ใส่ติดลบเพื่อคืนคะแนน)"],
];
const annDeductLabel = (k) => (ANN_DEDUCT.find((x) => x[0] === k) || [k, k])[1];

async function annRpc(fn, args) {
  const { data, error } = await window.sb.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}
function annIsHR() { const r = (window.CURRENT_USER || {}).role; return r === "admin" || r === "hr"; }
function annFmt(n, d) { if (n == null || n === "") return "—"; const v = Number(n); return Number.isInteger(v) && !d ? String(v) : v.toFixed(d == null ? 1 : d); }
function annDate(s) { if (!s) return "—"; const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return d + "/" + m + "/" + (y + 543); }

function AnnStatus({ s }) { const m = ANN_STATUS[s] || [s, "b-gray"]; return <Badge cls={m[1]} dot>{m[0]}</Badge>; }
function AnnGrade({ g }) {
  if (!g) return <span className="muted">—</span>;
  return <span className="badge" style={{ background: (ANN_GRADE_COLOR[g] || "#64748b") + "1f", color: ANN_GRADE_COLOR[g] || "#64748b", fontWeight: 700 }}>{g}</span>;
}

/* =========================================================
   หน้าหลัก
   ========================================================= */
function AnnualEval({ ctx }) {
  const [cycle, setCycle] = useAnnS(null);
  const [rows, setRows] = useAnnS(null);
  const [err, setErr] = useAnnS("");
  const [formId, setFormId] = useAnnS(null);
  const [tab, setTab] = useAnnS(annIsHR() ? "overview" : "mine");
  const hr = annIsHR();

  const load = async () => {
    setErr("");
    try {
      const { data: cy, error } = await window.sb.from("perf_cycles").select("*").order("id", { ascending: false }).limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      if (!cy) { setCycle(null); setRows([]); return; }
      setCycle(cy);
      setRows(await annRpc("perf_list", { p_cycle: cy.id }) || []);
    } catch (e) { setErr(e.message || String(e)); setRows([]); }
  };
  useAnnE(() => { load(); }, []);

  if (formId) return <AnnualForm id={formId} onBack={() => { setFormId(null); load(); }} />;
  if (rows == null) return <Card pad><div className="muted">กำลังโหลด…</div></Card>;
  if (err) return <Card pad><div style={{ color: "var(--red)" }}>โหลดไม่สำเร็จ: {err}</div></Card>;
  if (!cycle) return <Card pad><div className="muted">ยังไม่มีรอบประเมิน</div></Card>;

  const tabs = hr
    ? [{ id: "overview", label: "ภาพรวม" }, { id: "forms", label: "ใบประเมินทั้งหมด", count: rows.length }, { id: "setup", label: "รายชื่อ & ผู้ประเมิน" },
       { id: "deduct", label: "คะแนนหัก" }, { id: "items", label: "หัวข้อประเมิน" }, { id: "cycle", label: "ตั้งค่ารอบ" }]
    : [{ id: "mine", label: "ใบประเมินของหน่วยงาน", count: rows.filter((r) => r.eligible).length }];

  return (
    <div className="grid">
      <AnnualCycleBanner cycle={cycle} />
      <Card><div style={{ padding: "0 8px" }}><Tabs tabs={tabs} active={tab} onChange={setTab} /></div></Card>
      {tab === "mine" && <AnnualMine rows={rows} onOpen={setFormId} />}
      {tab === "overview" && <AnnualOverview rows={rows} cycle={cycle} />}
      {tab === "forms" && <AnnualAllForms rows={rows} onOpen={setFormId} reload={load} />}
      {tab === "setup" && <AnnualSetup rows={rows} cycle={cycle} reload={load} />}
      {tab === "deduct" && <AnnualDeductions rows={rows} cycle={cycle} reload={load} />}
      {tab === "items" && <AnnualItems rows={rows} />}
      {tab === "cycle" && <AnnualCycleSettings cycle={cycle} reload={load} />}
    </div>
  );
}

function AnnualCycleBanner({ cycle }) {
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const open = cycle.status === "open" && today >= cycle.open_from && today <= cycle.open_to;
  const msg = open ? "เปิดรับประเมินอยู่ ถึง " + annDate(cycle.open_to)
    : cycle.status === "draft" ? "ยังไม่เปิดรับประเมิน (เปิด " + annDate(cycle.open_from) + " – " + annDate(cycle.open_to) + ")"
    : today < cycle.open_from ? "เปิดรับประเมิน " + annDate(cycle.open_from) + " – " + annDate(cycle.open_to)
    : "ปิดรับประเมินแล้ว";
  return (
    <Card pad>
      <div className="row wrap" style={{ gap: 14, justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{cycle.name}</div>
          <div className="muted" style={{ fontSize: 13 }}>ผลงาน {annDate(cycle.period_start)} – {annDate(cycle.period_end)} · จ่ายโบนัส {annDate(cycle.bonus_pay)} · เงินเดือนใหม่มีผล {annDate(cycle.raise_effective)}</div>
        </div>
        <Badge cls={open ? "b-green" : "b-gray"} dot>{msg}</Badge>
      </div>
    </Card>
  );
}

/* ---------- สำหรับบัญชีหน่วยงาน: รายชื่อที่ต้องประเมิน ---------- */
function AnnualMine({ rows, onOpen }) {
  const [q, setQ] = useAnnS("");
  const [only, setOnly] = useAnnS("todo");
  const list = rows.filter((r) => r.eligible)
    .filter((r) => only === "all" || ["pending", "draft", "returned"].includes(r.status))
    .filter((r) => !q || (r.name + r.employee_id + (r.position || "")).toLowerCase().includes(q.toLowerCase()));
  const done = rows.filter((r) => r.eligible && !["pending", "draft", "returned"].includes(r.status)).length;
  const total = rows.filter((r) => r.eligible).length;
  return (
    <Card>
      <CardHead title={"ส่งแล้ว " + done + " จาก " + total + " คน"} sub="กดชื่อเพื่อให้คะแนน · ให้ระดับ 1–5 ทุกข้อ แล้วกด ส่งใบประเมิน"
        right={<Seg options={[{ value: "todo", label: "ยังไม่ส่ง" }, { value: "all", label: "ทั้งหมด" }]} value={only} onChange={setOnly} />} />
      <div style={{ padding: "0 20px 12px" }}><input className="input" placeholder="ค้นหาชื่อ / รหัส" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>พนักงาน</th><th>ตำแหน่ง</th><th>ความคืบหน้า</th><th>สถานะ</th><th>คะแนน</th><th>เกรด</th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.assignment_id} style={{ cursor: "pointer" }} onClick={() => onOpen(r.assignment_id)}>
                <td><b>{r.name}</b><div className="muted" style={{ fontSize: 12 }}>{r.employee_id} · {r.dept_name}</div></td>
                <td style={{ fontSize: 13 }}>{r.position}</td>
                <td className="num">{r.items_rated}/{r.items_total}</td>
                <td><AnnStatus s={r.status} /></td>
                <td className="num">{annFmt(r.total)}</td>
                <td><AnnGrade g={r.grade} /></td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={6} className="muted" style={{ textAlign: "center", padding: 28 }}>{only === "todo" ? "ส่งครบทุกคนแล้ว" : "ไม่มีรายชื่อ"}</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* =========================================================
   ใบประเมิน 1 ใบ
   ========================================================= */
function AnnualForm({ id, onBack }) {
  const [f, setF] = useAnnS(null);
  const [items, setItems] = useAnnS([]);
  const [comment, setComment] = useAnnS("");
  const [note2, setNote2] = useAnnS("");
  const [busy, setBusy] = useAnnS(false);
  const [err, setErr] = useAnnS("");
  const [dirty, setDirty] = useAnnS(false);

  const load = async () => {
    try {
      const d = await annRpc("perf_get_form", { p_assignment: id });
      setF(d); setItems(d.items || []); setComment((d.row && d.row.evaluator_comment) || ""); setDirty(false);
    } catch (e) { setErr(e.message); }
  };
  useAnnE(() => { load(); }, [id]);

  if (err && !f) return <Card pad><button className="btn btn-ghost btn-sm" onClick={onBack}><Icon name="chevLeft" size={15} />กลับ</button><div style={{ color: "var(--red)", marginTop: 12 }}>{err}</div></Card>;
  if (!f) return <Card pad><div className="muted">กำลังโหลดใบประเมิน…</div></Card>;
  const r = f.row || {};
  const can = !!f.can_edit;
  const cfg = (f.cycle && f.cycle.config) || {};
  const lead = r.level === "supervisor" || r.level === "manager";

  const setItem = (iid, patch) => { setItems((xs) => xs.map((x) => x.item_id === iid ? { ...x, ...patch } : x)); setDirty(true); };

  // คำนวณคะแนนสดในหน้าจอ (สูตรเดียวกับฐานข้อมูล) — ตัวเลขจริงยืนยันโดยฐานข้อมูลหลังบันทึก
  const live = (() => {
    const w = (cfg.weights || {})[r.level] || { A: 50, B: 15, C: 35 };
    const avg = (sec) => { const xs = items.filter((x) => x.section === sec && x.rating); const sw = xs.reduce((s, x) => s + Number(x.weight || 1), 0); return sw ? xs.reduce((s, x) => s + Number(x.weight || 1) * x.rating, 0) / sw : null; };
    const av = { A: avg("A"), B: avg("B"), C: avg("C") };
    let sw = 0, s = 0; ["A", "B", "C"].forEach((k) => { if (av[k] != null && w[k] > 0) { sw += w[k]; s += w[k] * (70 + (av[k] - 3) * 15); } });
    const pct = sw ? s / sw : null;
    const att = r.attendance_points != null ? Number(r.attendance_points) : 10;
    const warn = Number(r.warning_points || 0);
    const total = pct == null ? null : Math.round((0.9 * pct + att - warn) * 10) / 10;
    const bands = cfg.bands || [];
    const band = total == null ? null : bands.find((b) => Math.round(total) >= b[0]);
    const rated = items.filter((x) => x.rating).length;
    return { av, pct, att, warn, total, grade: band ? band[1] : null, meaning: band ? band[3] : "", rated };
  })();

  const save = async (quiet) => {
    setBusy(true); setErr("");
    try {
      await annRpc("perf_save", { p_assignment: id, p_scores: items.map((x) => ({ item_id: x.item_id, rating: x.rating || null, note: x.note || "" })), p_comment: comment });
      if (!quiet) toast("บันทึกแล้ว", "check");
      setDirty(false);
      return true;
    } catch (e) { setErr(e.message); return false; } finally { setBusy(false); }
  };
  const submit = async () => {
    const missing = items.filter((x) => !x.rating).length;
    if (missing) { setErr("ยังไม่ได้ให้คะแนน " + missing + " ข้อ"); return; }
    const noReason = items.filter((x) => (x.rating === 1 || x.rating === 5) && !(x.note || "").trim()).length;
    if (noReason) { setErr("ข้อที่ให้ระดับ 1 หรือ 5 ต้องเขียนเหตุผล (ยังขาด " + noReason + " ข้อ)"); return; }
    if (!window.confirm("ส่งใบประเมินของ " + r.name + "?\nส่งแล้วแก้ไม่ได้ จนกว่าจะถูกตีกลับ")) return;
    if (!(await save(true))) return;
    setBusy(true);
    try { await annRpc("perf_submit", { p_assignment: id }); toast("ส่งใบประเมินแล้ว", "checkCircle"); await load(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const review = async (action) => {
    if (action === "return" && !note2.trim()) { setErr("ตีกลับต้องเขียนเหตุผล"); return; }
    setBusy(true); setErr("");
    try {
      if (f.is_hr) await annRpc("perf_hr_decide", { p_ids: [id], p_action: action, p_comment: note2 });
      else await annRpc("perf_review", { p_assignment: id, p_action: action, p_comment: note2 });
      toast(action === "approve" ? "อนุมัติแล้ว" : action === "return" ? "ตีกลับแล้ว" : "เปิดใหม่แล้ว", "check"); setNote2(""); await load();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const groups = [
    ["A", ANN_SECTION.A], ["B", lead ? ANN_SECTION.B_lead : ANN_SECTION.B_skill], ["C", ANN_SECTION.C],
  ].map(([k, label]) => [k, label, items.filter((x) => x.section === k)]).filter((g) => g[2].length);
  const w = (cfg.weights || {})[r.level] || {};
  const hrCanDecide = f.is_hr && ["submitted", "reviewed"].includes(r.status);

  return (
    <div className="grid">
      <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => { if (dirty && !window.confirm("ยังไม่ได้บันทึก ออกจากหน้านี้?")) return; onBack(); }}><Icon name="chevLeft" size={15} />กลับรายชื่อ</button>
      <Card pad>
        <div className="row wrap" style={{ gap: 16, justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="row" style={{ gap: 10 }}><span style={{ fontWeight: 700, fontSize: 18 }}>{r.name}</span><AnnStatus s={r.status} /></div>
            <div className="muted" style={{ fontSize: 13.5, marginTop: 3 }}>{r.employee_id} · {r.position} · {r.dept_name}</div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>ระดับ: {ANN_LEVEL[r.level]} · JD: {r.jd_id ? r.jd_id + " " + (r.jd_title || "") : "ยังไม่ผูก JD"}{r.evaluator_name ? " · ผู้ประเมินตามสาย: " + r.evaluator_name : ""}</div>
          </div>
          <div style={{ textAlign: "center", minWidth: 150 }}>
            <div className="muted" style={{ fontSize: 12 }}>คะแนนรวม (ประมาณ)</div>
            <div className="mono" style={{ fontSize: 30, fontWeight: 700 }}>{annFmt(live.total)}</div>
            <AnnGrade g={live.rated === items.length ? live.grade : null} />
            <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>{live.rated}/{items.length} ข้อ{live.rated === items.length && live.meaning ? " · " + live.meaning : ""}</div>
          </div>
        </div>
        <hr className="divider" style={{ margin: "14px 0" }} />
        <div className="row wrap" style={{ gap: 18, fontSize: 13 }}>
          <span>ผลงาน (เต็ม 90): <b className="mono">{live.pct == null ? "—" : annFmt(0.9 * live.pct)}</b></span>
          <span>การมาทำงาน (เต็ม 10): <b className="mono">{annFmt(live.att)}</b></span>
          <span>หักใบเตือน: <b className="mono">{annFmt(live.warn)}</b></span>
          <span className="muted">น้ำหนัก A {w.A || 0} · B {w.B || 0} · C {w.C || 0}</span>
        </div>
        {!can && r.status === "pending" && !f.is_hr && <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>ยังไม่อยู่ในช่วงเปิดรับประเมิน — ดูหัวข้อล่วงหน้าได้ แต่ยังให้คะแนนไม่ได้</div>}
        {r.status === "returned" && (r.reviewer_comment || r.hr_comment) && <div style={{ marginTop: 10, padding: "10px 13px", borderRadius: 10, background: "var(--red-soft)", color: "#be123c", fontSize: 13 }}>ถูกตีกลับ: {r.hr_comment || r.reviewer_comment}</div>}
      </Card>

      <Card pad>
        <div className="row wrap" style={{ gap: 8, fontSize: 12.5 }}>
          <b>ระดับ:</b>{ANN_RATING.map(([n, t]) => <span key={n} className="badge b-gray">{n} = {t}</span>)}
          <span className="muted">· ให้ 1 หรือ 5 ต้องเขียนเหตุผล</span>
        </div>
      </Card>

      {groups.map(([k, label, xs]) => (
        <Card key={k}>
          <CardHead title={label} sub={"น้ำหนัก " + (w[k] || 0) + "% · ระดับเฉลี่ย " + (live.av[k] == null ? "—" : live.av[k].toFixed(2))} />
          <div style={{ padding: "0 20px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            {xs.map((x, i) => {
              const needNote = (x.rating === 1 || x.rating === 5) && !(x.note || "").trim();
              return (
                <div key={x.item_id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{i + 1}. {x.title}</div>
                  {x.standard && <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>มาตรฐานระดับ 3: {x.standard}</div>}
                  <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
                    {ANN_RATING.map(([n, t]) => (
                      <button key={n} disabled={!can} onClick={() => setItem(x.item_id, { rating: x.rating === n ? null : n })} title={t}
                        className={"btn btn-sm " + (x.rating === n ? "btn-pri" : "btn-ghost")} style={{ minWidth: 44, fontWeight: 700 }}>{n}</button>
                    ))}
                    <span className="muted" style={{ fontSize: 12.5, marginLeft: 6 }}>{x.rating ? ANN_RATING[x.rating - 1][1] : "ยังไม่ให้คะแนน"}</span>
                  </div>
                  {(can || x.note) && <input className="input" disabled={!can} placeholder={needNote ? "ต้องเขียนเหตุผล / ตัวอย่างผลงาน" : "เหตุผล / ตัวอย่างผลงาน (ไม่บังคับ)"} value={x.note || ""}
                    onChange={(e) => setItem(x.item_id, { note: e.target.value })} style={{ marginTop: 10, fontSize: 13.5, borderColor: needNote ? "var(--red)" : undefined }} />}
                </div>
              );
            })}
          </div>
        </Card>
      ))}
      {!groups.length && <Card pad><div className="muted">ใบนี้ยังไม่มีหัวข้อประเมิน — HR ต้องผูก JD ก่อน</div></Card>}

      <Card pad>
        <div className="field"><label>ความเห็นของผู้ประเมิน / สิ่งที่ควรพัฒนา</label>
          <textarea className="input" disabled={!can} value={comment} onChange={(e) => { setComment(e.target.value); setDirty(true); }} /></div>
        {r.reviewer_comment && r.status !== "returned" && <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>ความเห็นผู้ทบทวน: {r.reviewer_comment}</div>}
        {err && <div style={{ marginTop: 12, padding: "10px 13px", borderRadius: 10, background: "var(--red-soft)", color: "#be123c", fontSize: 13 }}>{err}</div>}
        <div className="row wrap" style={{ gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
          {can && <button className="btn btn-ghost" disabled={busy} onClick={() => save(false)}><Icon name="check" size={15} />บันทึก</button>}
          {can && <button className="btn btn-pri" disabled={busy} onClick={submit}><Icon name="checkCircle" size={15} />ส่งใบประเมิน</button>}
        </div>
        {(f.can_review || hrCanDecide || (f.is_hr && r.status === "approved")) && (
          <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            <div className="field"><label>{f.is_hr ? "ความเห็น HR" : "ความเห็นผู้ทบทวน"} (ตีกลับต้องใส่)</label><input className="input" value={note2} onChange={(e) => setNote2(e.target.value)} /></div>
            <div className="row wrap" style={{ gap: 10, marginTop: 10, justifyContent: "flex-end" }}>
              {r.status === "approved"
                ? <button className="btn btn-ghost" disabled={busy} onClick={() => review("reopen")}>ยกเลิกอนุมัติ</button>
                : <>
                    <button className="btn btn-ghost" disabled={busy} style={{ color: "var(--red)" }} onClick={() => review("return")}><Icon name="x" size={15} />ตีกลับให้แก้</button>
                    <button className="btn btn-pri" disabled={busy} onClick={() => review("approve")}><Icon name="check" size={15} />{f.is_hr ? "HR อนุมัติ" : "อนุมัติ"}</button>
                  </>}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

/* =========================================================
   HR: ภาพรวม
   ========================================================= */
function AnnualOverview({ rows, cycle }) {
  const el = rows.filter((r) => r.eligible);
  const cnt = (s) => el.filter((r) => r.status === s).length;
  const bands = (cycle.config && cycle.config.bands) || [];
  const byDept = {};
  el.forEach((r) => { const d = byDept[r.dept_name || r.dept] = byDept[r.dept_name || r.dept] || { n: 0, sent: 0, appr: 0, grades: {} }; d.n++; if (!["pending", "draft", "returned"].includes(r.status)) d.sent++; if (r.status === "approved") d.appr++; if (r.grade) d.grades[r.grade] = (d.grades[r.grade] || 0) + 1; });
  const gradeTotal = {}; el.forEach((r) => { if (r.grade) gradeTotal[r.grade] = (gradeTotal[r.grade] || 0) + 1; });
  const graded = Object.values(gradeTotal).reduce((a, b) => a + b, 0);
  const noJd = el.filter((r) => !r.jd_id).length;
  const exportCsv = () => {
    const H = ["รหัส", "ชื่อ-สกุล", "หน่วยงาน", "ตำแหน่ง", "สถานะ", "ผลงาน(เต็ม90)", "มาทำงาน(เต็ม10)", "หักใบเตือน", "คะแนนรวม", "เกรด", "โบนัส(เดือน)", "สัดส่วนอายุงาน", "ขึ้นเงินเดือน(%)"];
    const R = el.map((r) => [r.employee_id, r.name, r.dept_name, r.position, (ANN_STATUS[r.status] || [r.status])[0], r.perf_pct == null ? "" : (0.9 * r.perf_pct).toFixed(1), r.attendance_points, r.warning_points, r.total, r.grade || "", r.bonus_months == null ? "" : r.bonus_months, r.bonus_factor == null ? "" : r.bonus_factor, r.raise_pct == null ? "" : r.raise_pct]);
    window.downloadCSV("ผลประเมิน-" + cycle.id + ".csv", H, R);
  };
  return (
    <>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
        <Stat icon="users" label="ต้องประเมิน" value={el.length} sub={rows.length - el.length + " คนไม่อยู่ในรอบ"} />
        <Stat icon="clock" label="ยังไม่ส่ง" value={cnt("pending") + cnt("draft") + cnt("returned")} tone="#e08a00" soft="#fdf1dc" sub={cnt("returned") + " ใบถูกตีกลับ"} />
        <Stat icon="checkCircle" label="รอ HR อนุมัติ" value={cnt("reviewed") + cnt("submitted")} tone="#0d9488" soft="#e2f4f2" />
        <Stat icon="award" label="อนุมัติแล้ว" value={cnt("approved")} tone="#16a34a" soft="#e7f6ec" />
      </div>
      {noJd > 0 && <Card pad><div style={{ color: "#b45309", fontSize: 13.5 }}><Icon name="alert" size={15} /> มี {noJd} คนที่ยังไม่ผูก JD — ใบของคนกลุ่มนี้มีแค่พฤติกรรมหลัก (แก้ได้ที่แท็บ รายชื่อ & ผู้ประเมิน)</div></Card>}
      <Card>
        <CardHead title="การกระจายเกรด" sub={graded + " คนที่ให้คะแนนครบแล้ว"} right={<button className="btn btn-soft btn-sm" onClick={exportCsv}><Icon name="download" size={14} />ส่งออก CSV ไป Bplus</button>} />
        <div className="row wrap" style={{ gap: 10, padding: "0 20px 18px" }}>
          {bands.map((b) => (
            <div key={b[1]} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", minWidth: 96 }}>
              <AnnGrade g={b[1]} /><div className="mono" style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{gradeTotal[b[1]] || 0}</div>
              <div className="muted" style={{ fontSize: 11.5 }}>{graded ? Math.round((gradeTotal[b[1]] || 0) / graded * 100) : 0}% · {b[3]}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <CardHead title="ความคืบหน้ารายหน่วยงาน" />
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>หน่วยงาน</th><th>ต้องประเมิน</th><th>ส่งแล้ว</th><th>อนุมัติแล้ว</th>{bands.map((b) => <th key={b[1]}>{b[1]}</th>)}</tr></thead>
          <tbody>{Object.entries(byDept).map(([d, v]) => (
            <tr key={d}><td><b>{d}</b></td><td className="num">{v.n}</td><td className="num">{v.sent}</td><td className="num">{v.appr}</td>{bands.map((b) => <td key={b[1]} className="num">{v.grades[b[1]] || ""}</td>)}</tr>
          ))}</tbody>
        </table></div>
      </Card>
    </>
  );
}

/* ---------- HR: ใบประเมินทั้งหมด + อนุมัติเป็นชุด ---------- */
function AnnualAllForms({ rows, onOpen, reload }) {
  const [st, setSt] = useAnnS("all");
  const [dept, setDept] = useAnnS("all");
  const [q, setQ] = useAnnS("");
  const [sel, setSel] = useAnnS({});
  const [busy, setBusy] = useAnnS(false);
  const depts = [...new Set(rows.map((r) => r.dept_name || r.dept))];
  const list = rows.filter((r) => r.eligible)
    .filter((r) => st === "all" || (st === "todo" ? ["pending", "draft", "returned"].includes(r.status) : r.status === st))
    .filter((r) => dept === "all" || (r.dept_name || r.dept) === dept)
    .filter((r) => !q || (r.name + r.employee_id).toLowerCase().includes(q.toLowerCase()));
  const picked = list.filter((r) => sel[r.assignment_id] && ["submitted", "reviewed"].includes(r.status)).map((r) => r.assignment_id);
  const approve = async () => {
    if (!picked.length || !window.confirm("อนุมัติ " + picked.length + " ใบ?")) return;
    setBusy(true);
    try { const d = await annRpc("perf_hr_decide", { p_ids: picked, p_action: "approve", p_comment: null }); toast("อนุมัติแล้ว " + d.count + " ใบ", "checkCircle"); setSel({}); await reload(); }
    catch (e) { toast(e.message, "x"); } finally { setBusy(false); }
  };
  return (
    <Card>
      <CardHead title={"ใบประเมิน " + list.length + " ใบ"} sub="เลือกใบที่รอ HR แล้วกดอนุมัติเป็นชุดได้"
        right={<button className="btn btn-pri btn-sm" disabled={busy || !picked.length} onClick={approve}><Icon name="check" size={14} />อนุมัติที่เลือก ({picked.length})</button>} />
      <div className="row wrap" style={{ gap: 10, padding: "0 20px 12px" }}>
        <select className="select" style={{ maxWidth: 200 }} value={st} onChange={(e) => setSt(e.target.value)}>
          <option value="all">ทุกสถานะ</option><option value="todo">ยังไม่ส่ง</option>
          {Object.entries(ANN_STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}
        </select>
        <select className="select" style={{ maxWidth: 220 }} value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="all">ทุกหน่วยงาน</option>{depts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <input className="input" style={{ maxWidth: 240 }} placeholder="ค้นหาชื่อ / รหัส" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th></th><th>พนักงาน</th><th>หน่วยงาน</th><th>สถานะ</th><th>ข้อ</th><th>ผลงาน</th><th>มาทำงาน</th><th>ใบเตือน</th><th>รวม</th><th>เกรด</th><th>โบนัส</th><th>ขึ้นเงิน</th></tr></thead>
        <tbody>{list.map((r) => (
          <tr key={r.assignment_id}>
            <td onClick={(e) => e.stopPropagation()}>{["submitted", "reviewed"].includes(r.status) && <input type="checkbox" checked={!!sel[r.assignment_id]} onChange={(e) => setSel({ ...sel, [r.assignment_id]: e.target.checked })} />}</td>
            <td style={{ cursor: "pointer" }} onClick={() => onOpen(r.assignment_id)}><b>{r.name}</b><div className="muted" style={{ fontSize: 12 }}>{r.employee_id} · {r.position}</div></td>
            <td style={{ fontSize: 13 }}>{r.dept_name}</td>
            <td><AnnStatus s={r.status} /></td>
            <td className="num">{r.items_rated}/{r.items_total}</td>
            <td className="num">{r.perf_pct == null ? "—" : annFmt(0.9 * r.perf_pct)}</td>
            <td className="num" style={{ color: Number(r.attendance_points) < 0 ? "var(--red)" : undefined }}>{annFmt(r.attendance_points)}</td>
            <td className="num">{Number(r.warning_points) ? "−" + annFmt(r.warning_points) : ""}</td>
            <td className="num"><b>{annFmt(r.total)}</b></td>
            <td><AnnGrade g={r.grade} /></td>
            <td className="num">{r.bonus_months == null ? "" : annFmt(r.bonus_months, 2)}</td>
            <td className="num">{r.raise_pct == null ? "" : r.raise_pct + "%"}</td>
          </tr>
        ))}</tbody>
      </table></div>
    </Card>
  );
}

/* ---------- HR: รายชื่อ ผู้ประเมิน ระดับ JD สิทธิ์เข้ารอบ ---------- */
function AnnualSetup({ rows, cycle, reload }) {
  const [busy, setBusy] = useAnnS(false);
  const [q, setQ] = useAnnS("");
  const [flt, setFlt] = useAnnS("all");
  const emps = (window.EMPLOYEES_ALL || window.EMPLOYEES || []).slice().sort((a, b) => (a.name || "").localeCompare(b.name || "", "th"));
  const jds = (window.JD_LIBRARY || []).slice().sort((a, b) => String(a.id).localeCompare(String(b.id), "en", { numeric: true }));
  const gen = async (refresh) => {
    if (refresh && !window.confirm("คำนวณผู้ประเมิน/ระดับ/JD ใหม่ให้ใบที่ยังไม่เริ่ม?\n(ใบที่เริ่มให้คะแนนแล้วจะไม่ถูกแตะ)")) return;
    setBusy(true);
    try { const d = await annRpc("perf_generate", { p_cycle: cycle.id, p_refresh: !!refresh }); toast("สร้างใหม่ " + d.created + " ใบ · ปรับ " + d.refreshed + " ใบ", "check"); await reload(); }
    catch (e) { toast(e.message, "x"); } finally { setBusy(false); }
  };
  const upd = async (r, patch) => {
    const { error } = await window.sb.from("perf_assignments").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", r.assignment_id);
    if (error) { toast("บันทึกไม่สำเร็จ: " + error.message, "x"); return; }
    toast("บันทึกแล้ว", "check"); reload();
  };
  const list = rows.filter((r) => flt === "all" || (flt === "nojd" && !r.jd_id) || (flt === "out" && !r.eligible) || (flt === "noev" && !r.evaluator_id))
    .filter((r) => !q || (r.name + r.employee_id + (r.dept_name || "")).toLowerCase().includes(q.toLowerCase()));
  return (
    <Card>
      <CardHead title="รายชื่อ & ผู้ประเมิน" sub="ผู้ประเมินตามสาย = หัวหน้าหน่วยงาน · ไม่มีหัวหน้า = ผู้จัดการ · ใช้แสดงผลและคิดขั้นทบทวน (บัญชีหน่วยงานประเมินได้ทุกคนในหน่วยงานของตน)"
        right={<div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => gen(false)}><Icon name="plus" size={14} />เพิ่มพนักงานใหม่</button>
          <button className="btn btn-soft btn-sm" disabled={busy} onClick={() => gen(true)}><Icon name="refresh" size={14} />คำนวณใหม่ (ใบที่ยังไม่เริ่ม)</button>
        </div>} />
      <div className="row wrap" style={{ gap: 10, padding: "0 20px 12px" }}>
        <Seg options={[{ value: "all", label: "ทั้งหมด" }, { value: "nojd", label: "ยังไม่มี JD" }, { value: "out", label: "ไม่อยู่ในรอบ" }, { value: "noev", label: "ไม่มีผู้ประเมิน" }]} value={flt} onChange={setFlt} />
        <input className="input" style={{ maxWidth: 240 }} placeholder="ค้นหา" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>พนักงาน</th><th>ระดับ</th><th>JD</th><th>ผู้ประเมินตามสาย</th><th>ผู้ทบทวน</th><th>เข้ารอบ</th></tr></thead>
        <tbody>{list.map((r) => {
          const locked = r.status !== "pending";
          return (
            <tr key={r.assignment_id}>
              <td><b>{r.name}</b><div className="muted" style={{ fontSize: 12 }}>{r.employee_id} · {r.dept_name} · {r.position}</div></td>
              <td><select className="select" style={{ minWidth: 150 }} disabled={locked} value={r.level} onChange={(e) => upd(r, { level: e.target.value })}>{Object.entries(ANN_LEVEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
              <td><select className="select" style={{ minWidth: 200, borderColor: r.jd_id ? undefined : "#e08a00" }} disabled={locked} value={r.jd_id || ""} onChange={(e) => upd(r, { jd_id: e.target.value || null })}>
                <option value="">— ยังไม่ผูก —</option>{jds.map((j) => <option key={j.id} value={j.id}>{j.id} · {j.title}</option>)}</select></td>
              <td><select className="select" style={{ minWidth: 180 }} value={r.evaluator_id || ""} onChange={(e) => upd(r, { evaluator_id: e.target.value || null })}>
                <option value="">—</option>{emps.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.id})</option>)}</select></td>
              <td><select className="select" style={{ minWidth: 180 }} value={r.reviewer_id || ""} onChange={(e) => upd(r, { reviewer_id: e.target.value || null })}>
                <option value="">— ไม่มี (ส่งตรงถึง HR) —</option>{emps.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.id})</option>)}</select></td>
              <td>
                <label className="row" style={{ gap: 6, fontSize: 13 }}><input type="checkbox" checked={!!r.eligible} onChange={(e) => upd(r, { eligible: e.target.checked, eligible_note: e.target.checked ? null : (r.eligible_note || "HR ยกเว้น") })} />{r.eligible ? "ประเมิน" : "ไม่ประเมิน"}</label>
                {!r.eligible && r.eligible_note && <div className="muted" style={{ fontSize: 11.5 }}>{r.eligible_note}</div>}
              </td>
            </tr>
          );
        })}</tbody>
      </table></div>
      <div className="muted" style={{ fontSize: 12, padding: "10px 20px 16px" }}>ระดับและ JD แก้ได้เฉพาะใบที่ยังไม่เริ่มให้คะแนน เพราะเปลี่ยนหัวข้อประเมิน</div>
    </Card>
  );
}

/* ---------- HR: คะแนนหักการลา/มาสาย/ขาดงาน และใบเตือน ---------- */
function AnnualDeductions({ rows, cycle, reload }) {
  const [data, setData] = useAnnS(null);
  const [busy, setBusy] = useAnnS(false);
  const [add, setAdd] = useAnnS({ employee_id: "", kind: "sick_no_cert", qty: 1, note: "" });
  const [q, setQ] = useAnnS("");
  const k = (cycle.config && cycle.config.deduct) || {};
  const load = async () => {
    const { data: d, error } = await window.sb.from("perf_deductions").select("*").eq("cycle_id", cycle.id).order("created_at");
    if (error) { toast(error.message, "x"); return; } setData(d || []);
  };
  useAnnE(() => { load(); }, []);
  const sync = async () => {
    if (!window.confirm("ดึงคะแนนหักจากตอกบัตรและใบเตือนใหม่ทั้งหมด?\n(รายการที่ HR กรอกเองไม่ถูกลบ)")) return;
    setBusy(true);
    try { const d = await annRpc("perf_sync_deductions", { p_cycle: cycle.id }); toast("ตอกบัตร " + d.timecard + " รายการ · ใบเตือน " + d.warning + " รายการ", "check"); await load(); await reload(); }
    catch (e) { toast(e.message, "x"); } finally { setBusy(false); }
  };
  const addRow = async () => {
    if (!add.employee_id) { toast("เลือกพนักงานก่อน", "x"); return; }
    const pts = add.kind === "adjust" ? Number(add.qty) : Number(add.qty) * Number(k[add.kind] || 0);
    const { error } = await window.sb.from("perf_deductions").insert({ cycle_id: cycle.id, employee_id: add.employee_id, kind: add.kind, qty: Number(add.qty), points: pts, source: "manual", note: add.note || null, created_by: (window.CURRENT_USER || {}).email });
    if (error) { toast(error.message, "x"); return; }
    toast("เพิ่มแล้ว", "check"); setAdd({ ...add, note: "" }); await load(); reload();
  };
  const del = async (d) => { if (!window.confirm("ลบรายการนี้?")) return; await window.sb.from("perf_deductions").delete().eq("id", d.id); await load(); reload(); };
  const waive = async (d) => { await window.sb.from("perf_deductions").update({ waived: !d.waived }).eq("id", d.id); await load(); reload(); };
  if (!data) return <Card pad><div className="muted">กำลังโหลด…</div></Card>;
  const byEmp = {}; data.forEach((d) => { (byEmp[d.employee_id] = byEmp[d.employee_id] || []).push(d); });
  const people = rows.filter((r) => byEmp[r.employee_id]).filter((r) => !q || (r.name + r.employee_id).toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <Card pad>
        <div className="row wrap" style={{ gap: 12, justifyContent: "space-between" }}>
          <div style={{ fontSize: 13.5 }}>การมาทำงานเริ่มที่ 10 คะแนนแล้วหักตามเกณฑ์ปี 2568 (หักเกิน 10 ได้) · ใบเตือนหักจากคะแนนรวม · <b>ขาดงานที่ออกใบเตือนแล้ว</b> ให้เพิ่มรายการ "ปรับคะแนน" ติดลบเพื่อไม่หักซ้อน</div>
          <button className="btn btn-pri btn-sm" disabled={busy} onClick={sync}><Icon name="refresh" size={14} />ดึงจากตอกบัตร + ใบเตือน</button>
        </div>
      </Card>
      <Card>
        <CardHead title="เพิ่มรายการเอง" sub="สำหรับข้อมูลที่ตอกบัตรไม่มี เช่น ลาป่วยไม่มีใบรับรองแพทย์ ลาโดยไม่ได้รับอนุมัติ" />
        <div className="row wrap" style={{ gap: 10, padding: "0 20px 18px", alignItems: "flex-end" }}>
          <div className="field" style={{ minWidth: 220 }}><label>พนักงาน</label><select className="select" value={add.employee_id} onChange={(e) => setAdd({ ...add, employee_id: e.target.value })}>
            <option value="">— เลือก —</option>{rows.slice().sort((a, b) => a.name.localeCompare(b.name, "th")).map((r) => <option key={r.employee_id} value={r.employee_id}>{r.name} ({r.employee_id})</option>)}</select></div>
          <div className="field" style={{ minWidth: 260 }}><label>ประเภท</label><select className="select" value={add.kind} onChange={(e) => setAdd({ ...add, kind: e.target.value })}>
            {ANN_DEDUCT.map(([v, l]) => <option key={v} value={v}>{l}{k[v] != null ? " · หัก " + k[v] : ""}</option>)}</select></div>
          <div className="field" style={{ width: 110 }}><label>{add.kind === "adjust" ? "คะแนน (+/−)" : "จำนวน"}</label><input className="input" type="number" value={add.qty} onChange={(e) => setAdd({ ...add, qty: e.target.value })} /></div>
          <div className="field" style={{ flex: 1, minWidth: 200 }}><label>หมายเหตุ</label><input className="input" value={add.note} onChange={(e) => setAdd({ ...add, note: e.target.value })} /></div>
          <button className="btn btn-soft" onClick={addRow}><Icon name="plus" size={15} />เพิ่ม</button>
        </div>
      </Card>
      <Card>
        <CardHead title={"มีคะแนนหัก " + people.length + " คน"} right={<input className="input" style={{ width: 220 }} placeholder="ค้นหา" value={q} onChange={(e) => setQ(e.target.value)} />} />
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>พนักงาน</th><th>รายการ</th><th>หัก</th><th>ที่มา</th><th></th></tr></thead>
          <tbody>{people.map((r) => byEmp[r.employee_id].map((d, i) => (
            <tr key={d.id} style={{ opacity: d.waived ? 0.45 : 1 }}>
              <td>{i === 0 && <><b>{r.name}</b><div className="muted" style={{ fontSize: 12 }}>{r.employee_id} · มาทำงาน {annFmt(r.attendance_points)} · ใบเตือน −{annFmt(r.warning_points)}</div></>}</td>
              <td style={{ fontSize: 13 }}>{annDeductLabel(d.kind)}<div className="muted" style={{ fontSize: 12 }}>{d.note}</div></td>
              <td className="num">{annFmt(d.points)}</td>
              <td style={{ fontSize: 12.5 }}>{d.source === "manual" ? "HR กรอก" : d.source === "warning" ? "ใบเตือน" : "ตอกบัตร"}</td>
              <td><div className="row" style={{ gap: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => waive(d)}>{d.waived ? "นับคืน" : "ไม่นับ"}</button>
                {d.source === "manual" && <button className="btn btn-ghost btn-sm" style={{ color: "var(--red)" }} onClick={() => del(d)}>ลบ</button>}
              </div></td>
            </tr>
          )))}</tbody>
        </table></div>
        <div className="muted" style={{ fontSize: 12, padding: "10px 20px 16px" }}>"ไม่นับ" ของรายการจากตอกบัตรจะหายเมื่อกดดึงข้อมูลใหม่ — ถ้าต้องการถาวรให้ใช้รายการ "ปรับคะแนน"</div>
      </Card>
    </>
  );
}

/* ---------- HR: หัวข้อประเมินตาม JD และหัวข้อกลาง ---------- */
function AnnualItems({ rows }) {
  const [jd, setJd] = useAnnS("");
  const [items, setItems] = useAnnS(null);
  const [common, setCommon] = useAnnS([]);
  const [counts, setCounts] = useAnnS({});
  const jds = (window.JD_LIBRARY || []).slice().sort((a, b) => String(a.id).localeCompare(String(b.id), "en", { numeric: true }));
  const used = {}; rows.forEach((r) => { if (r.jd_id && r.eligible) used[r.jd_id] = (used[r.jd_id] || 0) + 1; });
  const loadCounts = async () => {
    const { data } = await window.sb.from("perf_jd_items").select("jd_id, section");
    const c = {}; (data || []).forEach((x) => { const o = c[x.jd_id] = c[x.jd_id] || { A: 0, B: 0 }; o[x.section]++; }); setCounts(c);
    const { data: cm } = await window.sb.from("perf_common_items").select("*").order("kind").order("seq"); setCommon(cm || []);
  };
  const load = async (id) => {
    if (!id) { setItems(null); return; }
    const { data, error } = await window.sb.from("perf_jd_items").select("*").eq("jd_id", id).order("section").order("seq");
    if (error) { toast(error.message, "x"); return; } setItems(data || []);
  };
  useAnnE(() => { loadCounts(); }, []);
  useAnnE(() => { load(jd); }, [jd]);
  const save = async (it, patch) => {
    const { error } = await window.sb.from("perf_jd_items").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", it.id);
    if (error) toast(error.message, "x"); else { toast("บันทึกแล้ว", "check"); load(jd); }
  };
  const addItem = async (section) => {
    const seq = Math.max(0, ...items.filter((x) => x.section === section).map((x) => x.seq)) + 1;
    const { error } = await window.sb.from("perf_jd_items").insert({ jd_id: jd, section, seq, title: "หัวข้อใหม่", weight: 1 });
    if (error) toast(error.message, "x"); else { load(jd); loadCounts(); }
  };
  const delItem = async (it) => { if (!window.confirm("ลบหัวข้อ \"" + it.title + "\"?\nคะแนนที่ให้ไปแล้วในข้อนี้จะไม่ถูกนับ")) return; await window.sb.from("perf_jd_items").delete().eq("id", it.id); load(jd); loadCounts(); };
  const saveCommon = async (c, patch) => { const { error } = await window.sb.from("perf_common_items").update(patch).eq("id", c.id); if (error) toast(error.message, "x"); else { toast("บันทึกแล้ว", "check"); loadCounts(); } };
  const ItemRow = ({ it, onSave, onDel, showW }) => {
    const [t, setT] = useAnnS(it.title); const [s, setS] = useAnnS(it.standard || ""); const [w, setW] = useAnnS(it.weight);
    const ch = t !== it.title || s !== (it.standard || "") || (showW && Number(w) !== Number(it.weight));
    return (
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12, display: "grid", gap: 8 }}>
        <input className="input" value={t} onChange={(e) => setT(e.target.value)} />
        <input className="input" placeholder="มาตรฐานระดับ 3 — ทำได้ตามที่คาดหวังคืออะไร (เห็นได้จริง)" value={s} onChange={(e) => setS(e.target.value)} style={{ fontSize: 13 }} />
        <div className="row" style={{ gap: 8 }}>
          {showW && <><span className="muted" style={{ fontSize: 12.5 }}>น้ำหนัก</span><input className="input" type="number" min="0.1" step="0.5" style={{ width: 90 }} value={w} onChange={(e) => setW(e.target.value)} /></>}
          <div className="spacer" style={{ flex: 1 }} />
          {onDel && <button className="btn btn-ghost btn-sm" style={{ color: "var(--red)" }} onClick={onDel}>ลบ</button>}
          <button className="btn btn-soft btn-sm" disabled={!ch} onClick={() => onSave(showW ? { title: t, standard: s || null, weight: Number(w) || 1 } : { title: t, standard: s || null })}>บันทึก</button>
        </div>
      </div>
    );
  };
  return (
    <>
      <Card pad>
        <div style={{ fontSize: 13.5 }}>แนะนำ: ส่วน A ให้เหลือ <b>3–6 ข้อ</b> ต่อ JD และเขียน "มาตรฐานระดับ 3" ทุกข้อ · ส่วน B ทักษะงาน 2–4 ข้อ (สิ่งที่ทำได้จริงในงาน ไม่ใช่คุณสมบัติตอนรับสมัคร) · แก้ก่อนเปิดรับประเมิน</div>
        <div className="row wrap" style={{ gap: 10, marginTop: 12 }}>
          <select className="select" style={{ maxWidth: 420 }} value={jd} onChange={(e) => setJd(e.target.value)}>
            <option value="">— เลือก JD (เรียงตามรหัส) —</option>
            {jds.map((j) => { const c = counts[j.id] || { A: 0, B: 0 }; return <option key={j.id} value={j.id}>{j.id} · {j.title} · ใช้ {used[j.id] || 0} คน · A {c.A} ข้อ{c.A > 6 ? " (เกิน 6)" : ""}</option>; })}
          </select>
        </div>
      </Card>
      {items && ["A", "B"].map((sec) => (
        <Card key={sec}>
          <CardHead title={sec === "A" ? ANN_SECTION.A : ANN_SECTION.B_skill + " (ใช้กับพนักงานและเจ้าหน้าที่)"} sub={items.filter((x) => x.section === sec).length + " ข้อ"}
            right={<button className="btn btn-soft btn-sm" onClick={() => addItem(sec)}><Icon name="plus" size={14} />เพิ่มหัวข้อ</button>} />
          <div style={{ padding: "0 20px 16px", display: "grid", gap: 10 }}>
            {items.filter((x) => x.section === sec).map((it) => <ItemRow key={it.id + it.updated_at} it={it} showW onSave={(p) => save(it, p)} onDel={() => delItem(it)} />)}
          </div>
        </Card>
      ))}
      <Card>
        <CardHead title="หัวข้อกลางทั้งบริษัท" sub="C พฤติกรรมหลัก (ทุกคน) · B ภาวะผู้นำ (หัวหน้างานและผู้จัดการ)" />
        <div style={{ padding: "0 20px 16px", display: "grid", gap: 10 }}>
          {common.map((c) => <div key={c.id}><div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{c.kind === "core" ? "C พฤติกรรมหลัก" : "B ภาวะผู้นำ"} ข้อ {c.seq}</div><ItemRow it={c} onSave={(p) => saveCommon(c, p)} /></div>)}
        </div>
      </Card>
    </>
  );
}

/* ---------- HR: ตั้งค่ารอบ ---------- */
function AnnualCycleSettings({ cycle, reload }) {
  const [c, setC] = useAnnS({ ...cycle });
  const [busy, setBusy] = useAnnS(false);
  const cfg = cycle.config || {};
  const set = (k, v) => setC({ ...c, [k]: v });
  const save = async () => {
    setBusy(true);
    const patch = { status: c.status, open_from: c.open_from, open_to: c.open_to, period_start: c.period_start, period_end: c.period_end,
      eligible_cutoff: c.eligible_cutoff, bonus_pay: c.bonus_pay, raise_effective: c.raise_effective, new_salary_pay: c.new_salary_pay, updated_at: new Date().toISOString() };
    const { error } = await window.sb.from("perf_cycles").update(patch).eq("id", cycle.id);
    setBusy(false);
    if (error) { toast(error.message, "x"); return; } toast("บันทึกแล้ว", "check"); reload();
  };
  const D = (k, label) => <div className="field"><label>{label}</label><input className="input" type="date" value={c[k] || ""} onChange={(e) => set(k, e.target.value)} /></div>;
  return (
    <>
      <Card pad>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          <div className="field"><label>สถานะรอบ</label><select className="select" value={c.status} onChange={(e) => set("status", e.target.value)}>
            <option value="draft">ร่าง — ยังไม่เปิด</option><option value="open">เปิดรับประเมิน (ตามช่วงวันที่)</option><option value="closed">ปิดรับประเมิน</option><option value="final">สรุปผลแล้ว</option></select></div>
          {D("open_from", "เปิดรับประเมินตั้งแต่")}{D("open_to", "ถึงวันที่")}
          {D("period_start", "ผลงานตั้งแต่")}{D("period_end", "ผลงานถึง")}{D("eligible_cutoff", "ต้องพ้นทดลองงาน ณ")}
          {D("bonus_pay", "จ่ายโบนัส")}{D("raise_effective", "เงินเดือนใหม่มีผล")}{D("new_salary_pay", "จ่ายเงินเดือนใหม่ครั้งแรก")}
        </div>
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 14 }}><button className="btn btn-pri" disabled={busy} onClick={save}><Icon name="check" size={15} />บันทึก</button></div>
        <div className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>หน่วยงานให้คะแนนได้เมื่อสถานะ "เปิดรับประเมิน" และวันนี้อยู่ในช่วงวันที่ · HR แก้คะแนนได้ตลอด</div>
      </Card>
      <Card>
        <CardHead title="เกณฑ์ของรอบนี้" sub="ตามเอกสารแบบระบบใหม่และเกณฑ์บริษัทปี 2568 · ถ้าจะเปลี่ยนเกณฑ์ แจ้งผู้ดูแลระบบ" />
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>ระดับตำแหน่ง</th><th>A งานตาม JD</th><th>B ทักษะ/ภาวะผู้นำ</th><th>C พฤติกรรมหลัก</th></tr></thead>
          <tbody>{Object.entries(cfg.weights || {}).map(([k, v]) => <tr key={k}><td>{ANN_LEVEL[k] || k}</td><td className="num">{v.A}%</td><td className="num">{v.B}%</td><td className="num">{v.C}%</td></tr>)}</tbody>
        </table></div>
        <div className="tbl-wrap" style={{ marginTop: 8 }}><table className="tbl">
          <thead><tr><th>คะแนนรวมขั้นต่ำ</th><th>เกรด</th><th>ความหมาย</th><th>โบนัส (เดือน)</th></tr></thead>
          <tbody>{(cfg.bands || []).map((b) => <tr key={b[1]}><td className="num">{b[0]}</td><td><AnnGrade g={b[1]} /></td><td>{b[3]}</td><td className="num">{b[2]}</td></tr>)}</tbody>
        </table></div>
        <div className="muted" style={{ fontSize: 12.5, padding: "10px 20px 16px" }}>ขึ้นเงินเดือน {cfg.raise_pct}% ทุกเกรด ยกเว้น F และอายุงานไม่ถึง 1 ปี · คะแนนรวม = ผลงาน 90 + การมาทำงาน 10 − ใบเตือน</div>
      </Card>
    </>
  );
}

Object.assign(window, { AnnualEval });
