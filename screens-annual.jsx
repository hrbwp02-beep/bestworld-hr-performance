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

// ขั้นถัดไปของใบ (แบบคอลัมน์ Next Level ของระบบตัวอย่าง)
const ANN_NEXT = { pending: "หน่วยงานให้คะแนน", draft: "หน่วยงานให้คะแนน", returned: "หน่วยงานแก้ไขแล้วส่งใหม่", submitted: "ผู้จัดการทบทวน", reviewed: "HR อนุมัติ", approved: "เสร็จสิ้น" };
function annDateTime(s) { if (!s) return "—"; const d = new Date(s); return annDate(new Date(d.getTime() + 7 * 3600e3).toISOString()) + " " + d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }); }
function annEsc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }
// ระดับเฉลี่ย 1–5 → เปอร์เซ็นต์ (ระดับ 3 = 70, ระดับ 5 = 100) สูตรเดียวกับฐานข้อมูล
function annPct(av) { return av == null ? null : 70 + (Number(av) - 3) * 15; }
// คะแนนรายส่วนที่นับเข้าคะแนนรวม: [ส่วน, คะแนนที่ได้, คะแนนเต็ม]
function annParts(r, w) {
  const av = { A: r.avg_a, B: r.avg_b, C: r.avg_c };
  const ks = ["A", "B", "C"].filter((k) => av[k] != null && (w[k] || 0) > 0);
  const sw = ks.reduce((s, k) => s + w[k], 0);
  return ks.map((k) => [k, 0.9 * w[k] / sw * annPct(av[k]), 0.9 * w[k] / sw * 100]);
}
function AnnTotal({ r }) {
  if (r.total == null) return <span className="muted">—</span>;
  return <span title={r.adjusted ? "HR ปรับผล · ระบบคิดได้ " + annFmt(r.calc_total) + " (" + (r.calc_grade || "—") + ")" + (r.adj_reason ? " · " + r.adj_reason : "") : undefined}>
    {r.adjusted && <span style={{ color: "#c2410c", fontSize: 11, fontWeight: 700, marginRight: 4 }}>(ปรับ)</span>}<b>{annFmt(r.total)}</b></span>;
}
// เปิดหน้าพิมพ์ (บันทึกเป็น PDF ได้จากหน้าต่างพิมพ์ของเบราว์เซอร์)
function annPrint(title, body, landscape) {
  const w = window.open("", "_blank");
  if (!w) { toast("เบราว์เซอร์บล็อกหน้าต่างใหม่ — อนุญาต pop-up ก่อน", "x"); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${annEsc(title)}</title>
    <style>@page{size:A4 ${landscape ? "landscape" : "portrait"};margin:12mm}body{font-family:'Sarabun','TH Sarabun New',Tahoma,sans-serif;color:#1a1a1a;font-size:13px;margin:0;padding:18px}
    h1{font-size:18px;margin:0}h2{font-size:15px;margin:16px 0 6px;color:#1d4ed8}.sub{color:#555;font-size:12.5px}
    table{border-collapse:collapse;width:100%;margin-top:8px}th,td{border:1px solid #cbd5e1;padding:4px 6px;text-align:left;vertical-align:top}th{background:#1d4ed8;color:#fff;font-weight:600}
    td.n,th.n{text-align:right}.adj{color:#c2410c;font-weight:700}.box{display:inline-block;border:1px solid #cbd5e1;border-radius:8px;padding:6px 12px;margin:4px 6px 0 0}
    .page{page-break-after:always}.page:last-child{page-break-after:auto}.sign{display:flex;gap:30px;margin-top:40px}.sign div{flex:1;text-align:center;border-top:1px dotted #555;padding-top:4px}
    .bar{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1d4ed8;padding-bottom:8px;margin-bottom:8px}@media print{.noprint{display:none}}</style></head>
    <body><div class="noprint" style="text-align:right;margin-bottom:8px"><button onclick="window.print()" style="padding:8px 16px;background:#1d4ed8;color:#fff;border:none;border-radius:8px;cursor:pointer">พิมพ์ / บันทึก PDF</button></div>${body}</body></html>`);
  w.document.close();
}
function annPrintHead(title, sub) {
  return `<div class="bar"><div><h1>${annEsc(title)}</h1><div class="sub">บริษัท เบสท์เวิลด์ อินเตอร์พลาส จำกัด${sub ? " · " + annEsc(sub) : ""}</div></div><div class="sub">พิมพ์เมื่อ ${annEsc(annDateTime(new Date().toISOString()))}</div></div>`;
}

function AnnStatus({ s }) { const m = ANN_STATUS[s] || [s, "b-gray"]; return <Badge cls={m[1]} dot>{m[0]}</Badge>; }
function AnnGrade({ g }) {
  if (!g) return <span className="muted">—</span>;
  return <span className="badge" style={{ background: (ANN_GRADE_COLOR[g] || "#64748b") + "1f", color: ANN_GRADE_COLOR[g] || "#64748b", fontWeight: 700 }}>{g}</span>;
}

/* =========================================================
   หน้าหลัก
   ========================================================= */
// หน้าที่เฉพาะ HR เปิดได้ (บัญชีหน่วยงานเปิดแล้วจะกลับไปหน้าแรก)
const ANN_HR_PAGES = ["forms", "setup", "exclude", "deduct", "items", "reports", "cycle", "calib", "hub"];
// ใบที่ HR ต้องกรอกเอง = หัวหน้า/ผู้จัดการ (บัญชีหน่วยงานประเมินไม่ได้ กันให้คะแนนตัวเอง)
const annHrMustFill = (r) => r.level === "supervisor" || r.level === "manager";
const annTodoStatus = (s) => ["pending", "draft", "returned"].includes(s);
const annWaitStatus = (s) => s === "submitted" || s === "reviewed";

/* =========================================================
   หน้าหลัก — ทุกหน้าที่ใช้ข้อมูลรอบประเมินผ่านตัวนี้ (page มาจากเมนูด้านซ้าย/แถบบน)
   ========================================================= */
function AnnualEval({ ctx, page }) {
  const [cycle, setCycle] = useAnnS(null);
  const [rowsAll, setRows] = useAnnS(null);
  const [err, setErr] = useAnnS("");
  const [formId, setFormId] = useAnnS(null);
  const hr = annIsHR();
  const pg = !hr && ANN_HR_PAGES.includes(page) ? "home" : (page || "home");

  const load = async () => {
    setErr("");
    try {
      const { data: cy, error } = await window.sb.from("perf_cycles").select("*").order("id", { ascending: false }).limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      if (!cy) { setCycle(null); setRows([]); return; }
      setCycle(cy);
      const rs = await annRpc("perf_list", { p_cycle: cy.id }) || [];
      setRows(rs);
      // ตัวเลขบนแถบเมนู (งานของฉัน / ศูนย์อนุมัติ)
      const live = rs.filter((r) => r.eligible && !r.excluded);
      if (ctx && ctx.setAnnCounts) ctx.setAnnCounts({
        todo: live.filter((r) => annTodoStatus(r.status) && (!hr || annHrMustFill(r))).length,
        approve: live.filter((r) => annWaitStatus(r.status)).length,
      });
    } catch (e) { setErr(e.message || String(e)); setRows([]); }
  };
  useAnnE(() => { load(); }, []);
  useAnnE(() => { setFormId(null); }, [page]);
  // เปิดใบจากที่อื่น (เช่นหน้าแรก) ผ่าน ctx.annOpen
  useAnnE(() => { if (ctx && ctx.annOpenId) { setFormId(ctx.annOpenId); ctx.setAnnOpenId(null); } }, [ctx && ctx.annOpenId]);

  if (formId) return <AnnualForm id={formId} onBack={() => { setFormId(null); load(); }} />;
  if (rowsAll == null) return <Card pad><div className="muted">กำลังโหลด…</div></Card>;
  if (err) return <Card pad><div style={{ color: "var(--red)" }}>โหลดไม่สำเร็จ: {err}</div></Card>;
  if (!cycle) return <Card pad><div className="muted">ยังไม่มีรอบประเมิน</div></Card>;

  // คนที่ติ๊ก "ไม่ต้องประเมิน" ไม่อยู่ในรายการ/สรุปผล/รายงานใดๆ ยกเว้นหน้ารายชื่อ (ที่ใช้ติ๊กคืน)
  const rows = rowsAll.filter((r) => !r.excluded);
  const go = (p) => ctx.go("ann:" + p);
  const banner = !["home", "flow", "hub"].includes(pg);

  return (
    <div className="grid">
      {banner && <AnnualCycleBanner cycle={cycle} />}
      {pg === "home" && <AnnualHome rows={rows} cycle={cycle} onOpen={setFormId} go={go} />}
      {pg === "flow" && <AnnualFlow rows={rows} go={go} />}
      {pg === "hub" && <AnnualSetupHub rowsAll={rowsAll} go={go} goRoute={ctx.go} />}
      {pg === "mine" && <AnnualMine rows={rows} onOpen={setFormId} preset="all" />}
      {pg === "todo" && (hr
        ? <AnnualMine rows={rows.filter(annHrMustFill)} onOpen={setFormId} title="ใบที่ HR ต้องกรอกเอง (หัวหน้า/ผู้จัดการ)" />
        : <AnnualMine rows={rows} onOpen={setFormId} />)}
      {pg === "approve" && (hr
        ? <AnnualAllForms rows={rows} onOpen={setFormId} reload={load} preset="wait" />
        : <AnnualMine rows={rows} onOpen={setFormId} preset="sent" />)}
      {pg === "overview" && <AnnualOverview rows={rows} rowsAll={rowsAll} cycle={cycle} />}
      {pg === "forms" && <AnnualAllForms rows={rows} onOpen={setFormId} reload={load} />}
      {pg === "calib" && <AnnualCalib rows={rows} cycle={cycle} onOpen={setFormId} />}
      {/* ติ๊ก "ไม่ต้องประเมิน" แล้วโหลดข้อมูลทั้งระบบใหม่ด้วย ให้แดชบอร์ด/สถิติตัดคนนั้นออกทันที */}
      {(pg === "setup" || pg === "exclude") && <AnnualSetup key={pg} rows={rowsAll} cycle={cycle} reload={async () => { await load(); if (ctx.refresh) ctx.refresh(); }} initial={pg === "exclude" ? "excl" : "all"} />}
      {pg === "deduct" && <AnnualDeductions rows={rows} cycle={cycle} reload={load} />}
      {pg === "items" && <AnnualItems rows={rows} />}
      {pg.startsWith("reports") && <AnnualReports key={pg} rows={rows} cycle={cycle} only={pg.split("-")[1]} />}
      {pg === "cycle" && <AnnualCycleSettings cycle={cycle} reload={load} />}
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
function AnnualMine({ rows, onOpen, preset, title }) {
  const [q, setQ] = useAnnS("");
  const [only, setOnly] = useAnnS(preset || "todo");
  const list = rows.filter((r) => r.eligible)
    .filter((r) => only === "all" || (only === "sent" ? !annTodoStatus(r.status) : annTodoStatus(r.status)))
    .filter((r) => !q || (r.name + r.employee_id + (r.position || "")).toLowerCase().includes(q.toLowerCase()));
  const done = rows.filter((r) => r.eligible && !["pending", "draft", "returned"].includes(r.status)).length;
  const total = rows.filter((r) => r.eligible).length;
  const el = rows.filter((r) => r.eligible);
  const n = (ss) => el.filter((r) => ss.includes(r.status)).length;
  return (
    <>
    {/* สรุปงานของหน่วยงาน (แบบหน้า Home / Todo List ของระบบตัวอย่าง) */}
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
      <Stat icon="clock" label="รอให้คะแนน" value={n(["pending", "draft"])} tone="#e08a00" soft="#fdf1dc" />
      <Stat icon="alert" label="ถูกตีกลับ ต้องแก้" value={n(["returned"])} tone="#e11d48" soft="#fde4ea" />
      <Stat icon="checkCircle" label="ส่งแล้ว รออนุมัติ" value={n(["submitted", "reviewed"])} tone="#0d9488" soft="#e2f4f2" />
      <Stat icon="award" label="อนุมัติแล้ว" value={n(["approved"])} tone="#16a34a" soft="#e7f6ec" />
    </div>
    <Card>
      <CardHead title={(title ? title + " · " : "") + "ส่งแล้ว " + done + " จาก " + total + " คน"} sub="กดชื่อเพื่อเปิดใบประเมิน · ให้ระดับ 1–5 ทุกข้อ แล้วกด ส่งใบประเมิน"
        right={<Seg options={[{ value: "todo", label: "ยังไม่ส่ง" }, { value: "sent", label: "ส่งแล้ว" }, { value: "all", label: "ทั้งหมด" }]} value={only} onChange={setOnly} />} />
      <div style={{ padding: "0 20px 12px" }}><input className="input" placeholder="ค้นหาชื่อ / รหัส" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>พนักงาน</th><th>ตำแหน่ง</th><th>ความคืบหน้า</th><th>สถานะ</th><th>คะแนน</th><th>เกรด</th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.assignment_id} style={{ cursor: "pointer" }} onClick={() => onOpen(r.assignment_id)}>
                <td><b>{r.name}</b><div className="muted" style={{ fontSize: 12 }}>{r.employee_id} · {r.dept_name} · {r.doc_no}</div></td>
                <td style={{ fontSize: 13 }}>{r.position}</td>
                <td className="num">{r.items_rated}/{r.items_total}</td>
                <td><AnnStatus s={r.status} />{r.status !== "approved" && <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>ถัดไป: {ANN_NEXT[r.status]}</div>}</td>
                {/* คะแนนระหว่างกรอกยังไม่ครบไม่มีความหมาย แสดงเมื่อให้ครบทุกข้อแล้ว */}
                <td className="num">{r.complete ? annFmt(r.total) : "—"}</td>
                <td><AnnGrade g={r.complete ? r.grade : null} /></td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={6} className="muted" style={{ textAlign: "center", padding: 28 }}>{only === "todo" ? "ไม่มีงานค้าง — ส่งครบทุกคนแล้ว" : only === "sent" ? "ยังไม่มีใบที่ส่ง" : "ไม่มีรายชื่อ"}</td></tr>}
          </tbody>
        </table>
      </div>
      {!annIsHR() && <div className="muted" style={{ fontSize: 12, padding: "10px 20px 16px" }}>ใบประเมินของหัวหน้าและผู้จัดการหน่วยงาน HR เป็นผู้กรอก จึงไม่อยู่ในรายชื่อนี้</div>}
    </Card>
    </>
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
  const [ftab, setFtab] = useAnnS("score");

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
  // ถ้า HR ปรับผลแล้ว (และยังไม่ได้แก้คะแนนค้างในหน้า) แสดงค่าที่ปรับ ไม่ใช่ค่าที่คิดสด
  const useAdj = r.adjusted && !dirty;
  const shownTotal = useAdj ? r.total : live.total;
  const allRated = live.rated === items.length && items.length > 0;
  const shownGrade = r.eligible && allRated ? (useAdj ? r.grade : live.grade) : null;
  const parts = annParts({ avg_a: live.av.A, avg_b: live.av.B, avg_c: live.av.C }, w);
  const SEC_NAME = { A: "A งานตาม JD", B: lead ? "B ภาวะผู้นำ" : "B ทักษะงาน", C: "C พฤติกรรมหลัก" };
  const deds = f.deductions || [];
  const evs = f.events || [];
  const tenure = (() => { if (!r.hire_date) return "—"; const [y, m] = r.hire_date.split("-").map(Number); const now = new Date(); let mm = (now.getFullYear() - y) * 12 + now.getMonth() + 1 - m; return Math.floor(mm / 12) + " ปี " + (mm % 12) + " เดือน"; })();

  const printForm = () => {
    const sec = groups.map(([k, label, xs]) => `<h2>${annEsc(label)} · น้ำหนัก ${w[k] || 0}%</h2><table><tr><th style="width:28px">#</th><th>หัวข้อ</th><th class="n" style="width:60px">ระดับ</th><th>เหตุผล / ตัวอย่างผลงาน</th></tr>${xs.map((x, i) => `<tr><td>${i + 1}</td><td>${annEsc(x.title)}${x.standard ? `<div class="sub">มาตรฐานระดับ 3: ${annEsc(x.standard)}</div>` : ""}</td><td class="n"><b>${x.rating || "—"}</b></td><td>${annEsc(x.note || "")}</td></tr>`).join("")}</table>`).join("");
    annPrint("ใบประเมิน " + r.name, annPrintHead("แบบประเมินผลการปฏิบัติงานประจำปี", (f.cycle || {}).name + " · เลขที่ " + (r.doc_no || "")) +
      `<table><tr><td>ชื่อ-สกุล <b>${annEsc(r.name)}</b></td><td>รหัส <b>${annEsc(r.employee_id)}</b></td><td>สถานะ <b>${annEsc((ANN_STATUS[r.status] || [r.status])[0])}</b></td></tr>
       <tr><td>ตำแหน่ง ${annEsc(r.position)}</td><td>หน่วยงาน ${annEsc(r.dept_name)}</td><td>ระดับ ${annEsc(ANN_LEVEL[r.level])}</td></tr>
       <tr><td colspan="2">JD ${annEsc(r.jd_id ? r.jd_id + " " + (r.jd_title || "") : "—")}</td><td>เริ่มงาน ${annEsc(annDate(r.hire_date))} (${annEsc(tenure)})</td></tr></table>
       <div style="margin-top:10px">${parts.map(([k, v, mx]) => `<span class="box">${annEsc(SEC_NAME[k])}: <b>${v.toFixed(1)}</b> / ${mx.toFixed(1)}</span>`).join("")}<span class="box">การมาทำงาน: <b>${annFmt(live.att)}</b> / 10</span><span class="box">หักใบเตือน: <b>${annFmt(live.warn)}</b></span>
       <span class="box">คะแนนรวม: <b>${annFmt(shownTotal)}</b>${useAdj ? ' <span class="adj">(ปรับ)</span>' : ""}</span><span class="box">เกรด: <b>${shownGrade || "—"}</b></span></div>
       ${useAdj ? `<div class="sub" style="margin-top:6px">HR ปรับผล: ระบบคิดได้ ${annFmt(r.calc_total)} (${r.calc_grade || "—"}) · เหตุผล: ${annEsc(r.adj_reason || "")}</div>` : ""}
       ${sec}<h2>ความเห็นของผู้ประเมิน / สิ่งที่ควรพัฒนา</h2><div style="border:1px solid #cbd5e1;min-height:50px;padding:6px">${annEsc(comment)}</div>
       <div class="sign"><div>ผู้ประเมิน</div><div>ผู้จัดการฝ่าย</div><div>ฝ่ายบุคคล</div><div>พนักงานรับทราบ</div></div>`);
  };

  return (
    <div className="grid">
      <div className="row" style={{ gap: 8, justifyContent: "space-between" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => { if (dirty && !window.confirm("ยังไม่ได้บันทึก ออกจากหน้านี้?")) return; onBack(); }}><Icon name="chevLeft" size={15} />กลับรายชื่อ</button>
        <button className="btn btn-ghost btn-sm" onClick={printForm}><Icon name="file" size={14} />พิมพ์ใบประเมิน</button>
      </div>
      <Card pad>
        <div className="row wrap" style={{ gap: 16, justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="row" style={{ gap: 10 }}><span style={{ fontWeight: 700, fontSize: 18 }}>{r.name}</span><AnnStatus s={r.status} /></div>
            <div className="muted" style={{ fontSize: 13.5, marginTop: 3 }}>{r.employee_id} · {r.position} · {r.dept_name}</div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>เลขที่ {r.doc_no} · ระดับ: {ANN_LEVEL[r.level]} · JD: {r.jd_id ? r.jd_id + " " + (r.jd_title || "") : "ยังไม่ผูก JD"}{r.evaluator_name ? " · ผู้ประเมินตามสาย: " + r.evaluator_name : ""}</div>
            {r.status !== "approved" && <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>ขั้นถัดไป: <b>{ANN_NEXT[r.status]}</b></div>}
          </div>
          <div style={{ textAlign: "center", minWidth: 150 }}>
            <div className="muted" style={{ fontSize: 12 }}>{useAdj ? "คะแนนรวม (HR ปรับ)" : "คะแนนรวม (ประมาณ)"}</div>
            <div className="mono" style={{ fontSize: 30, fontWeight: 700, color: useAdj ? "#c2410c" : undefined }}>{annFmt(shownTotal)}</div>
            <AnnGrade g={shownGrade} />
            <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>{!r.eligible ? "ไม่อยู่ในรอบประเมิน — ไม่คิดเกรด" : useAdj ? "ระบบคิดได้ " + annFmt(r.calc_total) + " (" + (r.calc_grade || "—") + ")" : live.rated + "/" + items.length + " ข้อ" + (allRated && live.meaning ? " · " + live.meaning : "")}</div>
          </div>
        </div>
        <hr className="divider" style={{ margin: "14px 0" }} />
        {/* สรุปคะแนนรายส่วน (แบบหน้า Summary of Evaluation) — ส่วน A/B/C รวมกันเต็ม 90 + การมาทำงาน 10 − ใบเตือน */}
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          {parts.map(([k, v, mx]) => (
            <div key={k} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "10px 12px" }}>
              <div className="muted" style={{ fontSize: 12 }}>{SEC_NAME[k]} ({w[k]}%)</div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{v.toFixed(1)}<span className="muted" style={{ fontSize: 12, fontWeight: 400 }}> / {mx.toFixed(1)}</span></div>
              <div className="muted" style={{ fontSize: 11.5 }}>ระดับเฉลี่ย {live.av[k].toFixed(2)}</div>
            </div>
          ))}
          {!parts.length && <div className="muted" style={{ fontSize: 13 }}>ยังไม่ได้ให้คะแนน · น้ำหนัก A {w.A || 0} · B {w.B || 0} · C {w.C || 0}</div>}
          <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "10px 12px" }}>
            <div className="muted" style={{ fontSize: 12 }}>การมาทำงาน</div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: live.att < 0 ? "var(--red)" : undefined }}>{annFmt(live.att)}<span className="muted" style={{ fontSize: 12, fontWeight: 400 }}> / 10</span></div>
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "10px 12px" }}>
            <div className="muted" style={{ fontSize: 12 }}>หักใบเตือน</div>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: live.warn ? "var(--red)" : undefined }}>{live.warn ? "−" + annFmt(live.warn) : "0"}</div>
          </div>
        </div>
        {!can && r.status === "pending" && !f.is_hr && <div className="muted" style={{ marginTop: 10, fontSize: 13 }}>ยังไม่อยู่ในช่วงเปิดรับประเมิน — ดูหัวข้อล่วงหน้าได้ แต่ยังให้คะแนนไม่ได้</div>}
        {r.status === "returned" && (r.reviewer_comment || r.hr_comment) && <div style={{ marginTop: 10, padding: "10px 13px", borderRadius: 10, background: "var(--red-soft)", color: "#be123c", fontSize: 13 }}>ถูกตีกลับ: {r.hr_comment || r.reviewer_comment}</div>}
      </Card>

      <Card><div style={{ padding: "0 8px" }}><Tabs tabs={[{ id: "score", label: "ให้คะแนน" }, { id: "emp", label: "ข้อมูลพนักงาน" }, { id: "ded", label: "การมาทำงาน & ใบเตือน", count: deds.filter((d) => !d.waived).length }, { id: "log", label: "ประวัติการดำเนินการ", count: evs.length }]} active={ftab} onChange={setFtab} /></div></Card>

      {ftab === "emp" && (
        <Card pad>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, fontSize: 13.5 }}>
            {[["รหัสพนักงาน", r.employee_id], ["ชื่อ-สกุล", r.name], ["ตำแหน่ง", r.position], ["หน่วยงาน", r.dept_name], ["ระดับตำแหน่ง (ใช้คิดน้ำหนัก)", ANN_LEVEL[r.level]],
              ["JD ที่ใช้ประเมิน", r.jd_id ? r.jd_id + " · " + (r.jd_title || "") : "ยังไม่ผูก"], ["วันเริ่มงาน", annDate(r.hire_date)], ["อายุงาน", tenure],
              ["สถานะพนักงาน", r.employment_status === "RESIGNED" ? "ลาออกแล้ว" : r.employment_status === "PROBATION" ? "ทดลองงาน" : "ปฏิบัติงาน"],
              ["ผู้ประเมินตามสาย", r.evaluator_name || "—"], ["ผู้ทบทวน", r.reviewer_name || "— (ส่งตรงถึง HR)"], ["อยู่ในรอบประเมิน", r.eligible ? "ใช่" : "ไม่ — " + (r.eligible_note || "")]]
              .map(([k, v]) => <div key={k}><div className="muted" style={{ fontSize: 12 }}>{k}</div><div style={{ fontWeight: 600 }}>{v || "—"}</div></div>)}
          </div>
        </Card>
      )}

      {ftab === "ded" && (
        <Card>
          <CardHead title="รายการหักคะแนน" sub="การมาทำงานเริ่มที่ 10 แล้วหักตามรายการ · ใบเตือนหักจากคะแนนรวม · ข้อมูลจากตอกบัตรและใบเตือนใน HR Core" />
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>รายการ</th><th>จำนวน</th><th>หัก</th><th>ที่มา</th>{f.is_hr && <th>หมายเหตุ</th>}</tr></thead>
            <tbody>{deds.map((d, i) => (
              <tr key={i} style={{ opacity: d.waived ? 0.45 : 1 }}>
                <td>{annDeductLabel(d.kind)}{d.waived && <span className="muted"> (ไม่นับ)</span>}</td><td className="num">{annFmt(d.qty)}</td><td className="num">{annFmt(d.points)}</td>
                <td style={{ fontSize: 12.5 }}>{d.source === "manual" ? "HR กรอก" : d.source === "warning" ? "ใบเตือน" : "ตอกบัตร"}</td>{f.is_hr && <td style={{ fontSize: 12.5 }}>{d.note}</td>}
              </tr>))}
              {!deds.length && <tr><td colSpan={5} className="muted" style={{ textAlign: "center", padding: 22 }}>ไม่มีรายการหัก — ได้คะแนนการมาทำงานเต็ม 10</td></tr>}
            </tbody>
          </table></div>
        </Card>
      )}

      {ftab === "log" && (
        <Card>
          <CardHead title="ประวัติการดำเนินการ" sub="บันทึกอัตโนมัติทุกครั้งที่เปลี่ยนสถานะหรือ HR ปรับผล · แก้ไขย้อนหลังไม่ได้" />
          <div style={{ padding: "0 20px 16px", display: "grid", gap: 8 }}>
            {evs.map((e, i) => (
              <div key={i} className="row" style={{ gap: 12, alignItems: "flex-start", borderLeft: "3px solid " + (e.action === "status" ? "var(--blue, #2563eb)" : "#c2410c"), paddingLeft: 10 }}>
                <div className="mono muted" style={{ fontSize: 12, minWidth: 120 }}>{annDateTime(e.at)}</div>
                <div style={{ fontSize: 13.5 }}>
                  {e.action === "status" ? <>{(ANN_STATUS[e.from] || [e.from])[0]} → <b>{(ANN_STATUS[e.to] || [e.to])[0]}</b></>
                    : e.action === "adjust" ? <b style={{ color: "#c2410c" }}>HR ปรับผล: {e.data && e.data.new_total != null ? "คะแนน " + annFmt(e.data.new_total) : ""}{e.data && e.data.new_grade ? " เกรด " + e.data.new_grade : ""}{e.data && e.data.calc_total != null ? " (ระบบคิด " + annFmt(e.data.calc_total) + " / " + (e.data.calc_grade || "—") + ")" : ""}</b>
                    : <b>ยกเลิกการปรับผล — กลับไปใช้คะแนนที่ระบบคิด</b>}
                  <div className="muted" style={{ fontSize: 12 }}>{e.actor}{e.note ? " · " + e.note : ""}</div>
                </div>
              </div>
            ))}
            {!evs.length && <div className="muted" style={{ fontSize: 13 }}>ยังไม่มีการดำเนินการ</div>}
          </div>
        </Card>
      )}

      {ftab === "score" && f.is_hr && r.eligible && r.complete && <AnnAdjustPanel r={r} bands={cfg.bands || []} dirty={dirty} onDone={load} />}

      {ftab === "score" && <>
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
      </>}
    </div>
  );
}

/* HR ปรับผล (Calibration) — ใส่เกรด หรือคะแนนรวมใหม่ พร้อมเหตุผล · ระบบเก็บค่าที่คิดไว้และประวัติทุกครั้ง */
function AnnAdjustPanel({ r, bands, dirty, onDone }) {
  const [open, setOpen] = useAnnS(false);
  const [mode, setMode] = useAnnS("grade");
  const [grade, setGrade] = useAnnS(r.adjusted && r.grade ? r.grade : "");
  const [total, setTotal] = useAnnS(r.adjusted ? String(r.total) : "");
  const [reason, setReason] = useAnnS(r.adj_reason || "");
  const [busy, setBusy] = useAnnS(false);
  const run = async (clear) => {
    if (dirty) { toast("บันทึกคะแนนก่อน แล้วค่อยปรับผล", "x"); return; }
    if (!clear && !reason.trim()) { toast("ต้องเขียนเหตุผลการปรับ", "x"); return; }
    if (!clear && mode === "grade" && !grade) { toast("เลือกเกรดก่อน", "x"); return; }
    if (!clear && mode === "total" && (total === "" || isNaN(Number(total)))) { toast("ใส่คะแนนเป็นตัวเลข", "x"); return; }
    if (clear && !window.confirm("ยกเลิกการปรับผล กลับไปใช้คะแนนที่ระบบคิด (" + annFmt(r.calc_total) + " / " + (r.calc_grade || "—") + ")?")) return;
    setBusy(true);
    try {
      await annRpc("perf_adjust", clear ? { p_assignment: r.assignment_id, p_total: null, p_grade: null, p_reason: reason || "ยกเลิกการปรับ" }
        : { p_assignment: r.assignment_id, p_total: mode === "total" ? Number(total) : null, p_grade: mode === "grade" ? grade : null, p_reason: reason.trim() });
      toast(clear ? "ยกเลิกการปรับแล้ว" : "ปรับผลแล้ว", "check"); setOpen(false); await onDone();
    } catch (e) { toast(e.message, "x"); } finally { setBusy(false); }
  };
  return (
    <Card pad>
      <div className="row wrap" style={{ gap: 10, justifyContent: "space-between" }}>
        <div style={{ fontSize: 13.5 }}>
          <b>ปรับผล (Calibration)</b> · ระบบคิดได้ <b className="mono">{annFmt(r.calc_total)}</b> เกรด <AnnGrade g={r.calc_grade} />
          {r.adjusted && <span style={{ color: "#c2410c" }}> → ใช้ <b>{annFmt(r.total)}</b> เกรด <b>{r.grade}</b> · {r.adj_reason} ({r.adj_by}, {annDateTime(r.adj_at)})</span>}
        </div>
        <div className="row" style={{ gap: 8 }}>
          {r.adjusted && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(true)}>ยกเลิกการปรับ</button>}
          <button className="btn btn-soft btn-sm" onClick={() => setOpen(!open)}><Icon name="sliders" size={14} />{r.adjusted ? "แก้การปรับ" : "ปรับผล"}</button>
        </div>
      </div>
      {open && (
        <div className="row wrap" style={{ gap: 10, marginTop: 12, alignItems: "flex-end" }}>
          <Seg options={[{ value: "grade", label: "ปรับเกรด" }, { value: "total", label: "ปรับคะแนนรวม" }]} value={mode} onChange={setMode} />
          {mode === "grade"
            ? <div className="field" style={{ width: 140 }}><label>เกรดใหม่</label><select className="select" value={grade} onChange={(e) => setGrade(e.target.value)}><option value="">— เลือก —</option>{bands.map((b) => <option key={b[1]} value={b[1]}>{b[1]} · {b[3]}</option>)}</select></div>
            : <div className="field" style={{ width: 140 }}><label>คะแนนรวมใหม่</label><input className="input" type="number" step="0.1" value={total} onChange={(e) => setTotal(e.target.value)} /></div>}
          <div className="field" style={{ flex: 1, minWidth: 240 }}><label>เหตุผล (บังคับ — แสดงในรายงานการปรับผล)</label><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เช่น มติคณะกรรมการ Calibration 20/12/2569" /></div>
          <button className="btn btn-pri" disabled={busy} onClick={() => run(false)}><Icon name="check" size={15} />บันทึกการปรับ</button>
        </div>
      )}
      <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>ปรับเกรด = โบนัสตามเกรดใหม่ · ปรับคะแนนรวม = เกรดคิดจากคะแนนใหม่ · ทุกครั้งที่ปรับจะถูกบันทึกในประวัติและรายงานการปรับผล</div>
    </Card>
  );
}

/* =========================================================
   HR: ภาพรวม
   ========================================================= */
function AnnualOverview({ rows, rowsAll, cycle }) {
  const nExcl = (rowsAll || rows).filter((r) => r.excluded).length;
  const el = rows.filter((r) => r.eligible);
  const cnt = (s) => el.filter((r) => r.status === s).length;
  const bands = (cycle.config && cycle.config.bands) || [];
  const byDept = {};
  el.forEach((r) => { const d = byDept[r.dept_name || r.dept] = byDept[r.dept_name || r.dept] || { n: 0, sent: 0, appr: 0, grades: {} }; d.n++; if (!["pending", "draft", "returned"].includes(r.status)) d.sent++; if (r.status === "approved") d.appr++; if (r.grade) d.grades[r.grade] = (d.grades[r.grade] || 0) + 1; });
  const gradeTotal = {}; el.forEach((r) => { if (r.grade) gradeTotal[r.grade] = (gradeTotal[r.grade] || 0) + 1; });
  const graded = Object.values(gradeTotal).reduce((a, b) => a + b, 0);
  const noJd = el.filter((r) => !r.jd_id).length;
  const exportCsv = () => {
    const H = ["เลขที่", "รหัส", "ชื่อ-สกุล", "หน่วยงาน", "ตำแหน่ง", "สถานะ", "ผลงาน(เต็ม90)", "มาทำงาน(เต็ม10)", "หักใบเตือน", "คะแนนรวม", "เกรด", "โบนัส(เดือน)", "สัดส่วนอายุงาน", "ขึ้นเงินเดือน(%)", "HR ปรับผล", "คะแนนที่ระบบคิด", "เกรดที่ระบบคิด", "เหตุผลการปรับ"];
    const R = el.map((r) => [r.doc_no, r.employee_id, r.name, r.dept_name, r.position, (ANN_STATUS[r.status] || [r.status])[0], r.perf_pct == null ? "" : (0.9 * r.perf_pct).toFixed(1), r.attendance_points, r.warning_points, r.total, r.grade || "", r.bonus_months == null ? "" : r.bonus_months, r.bonus_factor == null ? "" : r.bonus_factor, r.raise_pct == null ? "" : r.raise_pct,
      r.adjusted ? "ปรับ" : "", r.adjusted ? r.calc_total : "", r.adjusted ? r.calc_grade || "" : "", r.adjusted ? r.adj_reason || "" : ""]);
    window.downloadCSV("ผลประเมิน-" + cycle.id + ".csv", H, R);
  };
  return (
    <>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
        <Stat icon="users" label="ต้องประเมิน" value={el.length} sub={rows.length - el.length + " คนไม่อยู่ในรอบ" + (nExcl ? " · " + nExcl + " คนไม่ต้องประเมิน" : "")} />
        <Stat icon="clock" label="ยังไม่ส่ง" value={cnt("pending") + cnt("draft") + cnt("returned")} tone="#e08a00" soft="#fdf1dc" sub={cnt("returned") + " ใบถูกตีกลับ"} />
        <Stat icon="checkCircle" label="รอ HR อนุมัติ" value={cnt("reviewed") + cnt("submitted")} tone="#0d9488" soft="#e2f4f2" />
        <Stat icon="award" label="อนุมัติแล้ว" value={cnt("approved")} tone="#16a34a" soft="#e7f6ec" />
      </div>
      {noJd > 0 && <Card pad><div style={{ color: "#b45309", fontSize: 13.5 }}><Icon name="alert" size={15} /> มี {noJd} คนที่ยังไม่ผูก JD — ใบของคนกลุ่มนี้มีแค่พฤติกรรมหลัก (แก้ได้ที่แท็บ รายชื่อ & ผู้ประเมิน)</div></Card>}
      <Card>
        <CardHead title="การกระจายเกรด" sub={graded + " คนที่ให้คะแนนครบแล้ว"} right={annIsHR() ? <button className="btn btn-soft btn-sm" onClick={exportCsv}><Icon name="download" size={14} />ส่งออก CSV ไป Bplus</button> : null} />
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
function AnnualAllForms({ rows, onOpen, reload, preset }) {
  const [st, setSt] = useAnnS(preset || "all");
  const [dept, setDept] = useAnnS("all");
  const [q, setQ] = useAnnS("");
  const [sel, setSel] = useAnnS({});
  const [busy, setBusy] = useAnnS(false);
  const depts = [...new Set(rows.map((r) => r.dept_name || r.dept))];
  const list = rows.filter((r) => r.eligible)
    .filter((r) => st === "all" || (st === "todo" ? annTodoStatus(r.status) : st === "wait" ? annWaitStatus(r.status) : r.status === st))
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
          <option value="all">ทุกสถานะ</option><option value="wait">รอ HR อนุมัติ (ทั้งหมด)</option><option value="todo">ยังไม่ส่ง</option>
          {Object.entries(ANN_STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}
        </select>
        <select className="select" style={{ maxWidth: 220 }} value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="all">ทุกหน่วยงาน</option>{depts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <input className="input" style={{ maxWidth: 240 }} placeholder="ค้นหาชื่อ / รหัส" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th></th><th>เลขที่</th><th>พนักงาน</th><th>หน่วยงาน</th><th>สถานะ / ขั้นถัดไป</th><th>ส่งเมื่อ</th><th>ข้อ</th><th>ผลงาน</th><th>มาทำงาน</th><th>ใบเตือน</th><th>รวม</th><th>เกรด</th><th>โบนัส</th><th>ขึ้นเงิน</th></tr></thead>
        <tbody>{list.map((r) => (
          <tr key={r.assignment_id}>
            <td onClick={(e) => e.stopPropagation()}>{["submitted", "reviewed"].includes(r.status) && <input type="checkbox" checked={!!sel[r.assignment_id]} onChange={(e) => setSel({ ...sel, [r.assignment_id]: e.target.checked })} />}</td>
            <td className="mono" style={{ fontSize: 12 }}>{r.doc_no}</td>
            <td style={{ cursor: "pointer" }} onClick={() => onOpen(r.assignment_id)}><b>{r.name}</b><div className="muted" style={{ fontSize: 12 }}>{r.employee_id} · {r.position}</div></td>
            <td style={{ fontSize: 13 }}>{r.dept_name}</td>
            <td><AnnStatus s={r.status} />{r.status !== "approved" && <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>→ {ANN_NEXT[r.status]}</div>}</td>
            <td style={{ fontSize: 12.5 }}>{r.submitted_at ? annDate(new Date(new Date(r.submitted_at).getTime() + 7 * 3600e3).toISOString()) : "—"}</td>
            <td className="num">{r.items_rated}/{r.items_total}</td>
            <td className="num">{r.perf_pct == null ? "—" : annFmt(0.9 * r.perf_pct)}</td>
            <td className="num" style={{ color: Number(r.attendance_points) < 0 ? "var(--red)" : undefined }}>{annFmt(r.attendance_points)}</td>
            <td className="num">{Number(r.warning_points) ? "−" + annFmt(r.warning_points) : ""}</td>
            <td className="num"><AnnTotal r={r} /></td>
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
function AnnualSetup({ rows, cycle, reload, initial }) {
  const [busy, setBusy] = useAnnS(false);
  const [q, setQ] = useAnnS("");
  const [flt, setFlt] = useAnnS(initial || "all");
  // ไม่ต้องประเมิน = มีชื่อใน Bplus เพื่อทำเงินเดือนอย่างเดียว → ไม่มีใบ ไม่อยู่ในสรุปผล/รายงาน/สถิติ (ติ๊กคืนได้)
  const setExcl = async (r, on) => {
    let reason = null;
    if (on) {
      reason = window.prompt("ไม่ต้องประเมิน " + r.name + "\nเหตุผล (เช่น มีชื่อเพื่อทำเงินเดือนอย่างเดียว):", "มีชื่อใน Bplus เพื่อทำเงินเดือนอย่างเดียว");
      if (reason == null) return;
    } else if (!window.confirm("นำ " + r.name + " กลับเข้ารอบประเมิน?")) return;
    try { await annRpc("perf_set_excluded", { p_emp: r.employee_id, p_excluded: on, p_reason: reason }); toast(on ? "ตั้งเป็นไม่ต้องประเมินแล้ว" : "นำกลับเข้ารอบแล้ว", "check"); await reload(); }
    catch (e) { toast(e.message, "x"); }
  };
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
  const list = rows.filter((r) => flt === "excl" ? r.excluded : !r.excluded && (flt === "all" || (flt === "nojd" && !r.jd_id) || (flt === "out" && !r.eligible) || (flt === "noev" && !r.evaluator_id)))
    .filter((r) => !q || (r.name + r.employee_id + (r.dept_name || "")).toLowerCase().includes(q.toLowerCase()));
  return (
    <Card>
      <CardHead title="รายชื่อ & ผู้ประเมิน" sub="ผู้ประเมินตามสาย = หัวหน้าหน่วยงาน · ไม่มีหัวหน้า = ผู้จัดการ · ใช้แสดงผลและคิดขั้นทบทวน (บัญชีหน่วยงานประเมินได้ทุกคนในหน่วยงานของตน)"
        right={<div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => gen(false)}><Icon name="plus" size={14} />เพิ่มพนักงานใหม่</button>
          <button className="btn btn-soft btn-sm" disabled={busy} onClick={() => gen(true)}><Icon name="refresh" size={14} />คำนวณใหม่ (ใบที่ยังไม่เริ่ม)</button>
        </div>} />
      <div className="row wrap" style={{ gap: 10, padding: "0 20px 12px" }}>
        <Seg options={[{ value: "all", label: "ทั้งหมด" }, { value: "nojd", label: "ยังไม่มี JD" }, { value: "out", label: "ไม่อยู่ในรอบ" }, { value: "noev", label: "ไม่มีผู้ประเมิน" }, { value: "excl", label: "ไม่ต้องประเมิน (" + rows.filter((r) => r.excluded).length + ")" }]} value={flt} onChange={setFlt} />
        <input className="input" style={{ maxWidth: 240 }} placeholder="ค้นหา" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="tbl-wrap"><table className="tbl">
        <thead><tr><th>พนักงาน</th><th>ระดับ</th><th>JD</th><th>ผู้ประเมินตามสาย</th><th>ผู้ทบทวน</th><th>เข้ารอบ</th><th>ไม่ต้องประเมิน</th></tr></thead>
        <tbody>{list.map((r) => {
          const locked = r.status !== "pending";
          return (
            <tr key={r.assignment_id}>
              <td style={{ minWidth: 210 }}><b>{r.name}</b>{r.employment_status && !["ACTIVE", "PROBATION"].includes(r.employment_status) && <span style={{ marginLeft: 6 }}><Badge cls="b-red">{r.employment_status === "RESIGNED" ? "ลาออกแล้ว" : r.employment_status}</Badge></span>}
                <div className="muted" style={{ fontSize: 12 }}>{r.employee_id} · {r.dept_name} · {r.position}</div></td>
              <td><select className="select" style={{ minWidth: 150 }} disabled={locked} value={r.level} onChange={(e) => upd(r, { level: e.target.value })}>{Object.entries(ANN_LEVEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
              <td><select className="select" style={{ minWidth: 200, borderColor: r.jd_id ? undefined : "#e08a00" }} disabled={locked} value={r.jd_id || ""} onChange={(e) => upd(r, { jd_id: e.target.value || null })}>
                <option value="">— ยังไม่ผูก —</option>{jds.map((j) => <option key={j.id} value={j.id}>{j.id} · {j.title}</option>)}</select></td>
              <td><AnnPersonPick emps={emps} id={r.evaluator_id} name={r.evaluator_name} empty="—" onPick={(v) => upd(r, { evaluator_id: v })} /></td>
              <td><AnnPersonPick emps={emps} id={r.reviewer_id} name={r.reviewer_name} empty="— ไม่มี (ส่งตรงถึง HR) —" onPick={(v) => upd(r, { reviewer_id: v })} /></td>
              <td>
                <label className="row" style={{ gap: 6, fontSize: 13 }}><input type="checkbox" disabled={r.excluded} checked={!!r.eligible} onChange={(e) => upd(r, { eligible: e.target.checked, eligible_note: e.target.checked ? null : (r.eligible_note || "HR ยกเว้น") })} />{r.eligible ? "ประเมิน" : "ไม่ประเมิน"}</label>
                {!r.eligible && r.eligible_note && <div className="muted" style={{ fontSize: 11.5 }}>{r.eligible_note}</div>}
              </td>
              <td>
                <label className="row" style={{ gap: 6, fontSize: 13 }} title="มีชื่อเพื่อทำเงินเดือนอย่างเดียว — ไม่ประเมินและไม่นำไปวิเคราะห์ผล (มีผลทุกรอบ)">
                  <input type="checkbox" checked={!!r.excluded} onChange={(e) => setExcl(r, e.target.checked)} />{r.excluded ? "ไม่ต้องประเมิน" : ""}</label>
                {r.excluded && r.excluded_reason && <div className="muted" style={{ fontSize: 11.5 }}>{r.excluded_reason}</div>}
              </td>
            </tr>
          );
        })}</tbody>
      </table></div>
      <div className="muted" style={{ fontSize: 12, padding: "10px 20px 16px" }}>ระดับและ JD แก้ได้เฉพาะใบที่ยังไม่เริ่มให้คะแนน เพราะเปลี่ยนหัวข้อประเมิน ·
        <b> ไม่ต้องประเมิน</b> = มีชื่อใน Bplus เพื่อทำเงินเดือนอย่างเดียว: ไม่มีใบประเมิน ไม่นับในสรุปผล รายงาน และสถิติทุกหน้า มีผลทุกรอบจนกว่าจะเอาเครื่องหมายออก</div>
    </Card>
  );
}

/* เลือกคน: แสดงชื่อก่อน กดแล้วค่อยเปิดรายชื่อ (ถ้าสร้าง select ทุกแถวจะมีตัวเลือกหลายหมื่นอัน หน้าค้าง) */
function AnnPersonPick({ emps, id, name, empty, onPick }) {
  const [open, setOpen] = useAnnS(false);
  if (!open) return <button className="btn btn-ghost btn-sm" style={{ minWidth: 180, justifyContent: "flex-start" }} onClick={() => setOpen(true)}>{id ? (name || id) + " (" + id + ")" : empty}<Icon name="chevDown" size={13} /></button>;
  return (
    <select className="select" style={{ minWidth: 180 }} autoFocus value={id || ""} onBlur={() => setOpen(false)}
      onChange={(e) => { setOpen(false); if ((e.target.value || null) !== (id || null)) onPick(e.target.value || null); }}>
      <option value="">{empty}</option>{emps.map((x) => <option key={x.id} value={x.id}>{x.name} ({x.id})</option>)}
    </select>
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
  const del = async (d) => {
    if (!window.confirm("ลบรายการนี้?")) return;
    const { error } = await window.sb.from("perf_deductions").delete().eq("id", d.id);
    if (error) { toast("ลบไม่สำเร็จ: " + error.message, "x"); return; }
    await load(); reload();
  };
  const waive = async (d) => {
    const { error } = await window.sb.from("perf_deductions").update({ waived: !d.waived }).eq("id", d.id);
    if (error) { toast("บันทึกไม่สำเร็จ: " + error.message, "x"); return; }
    await load(); reload();
  };
  if (!data) return <Card pad><div className="muted">กำลังโหลด…</div></Card>;
  const byEmp = {}; data.forEach((d) => { (byEmp[d.employee_id] = byEmp[d.employee_id] || []).push(d); });
  const people = rows.filter((r) => byEmp[r.employee_id]).filter((r) => !q || (r.name + r.employee_id).toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <Card pad>
        <div className="row wrap" style={{ gap: 12, justifyContent: "space-between" }}>
          <div style={{ fontSize: 13.5 }}>การมาทำงานเริ่มที่ 10 คะแนนแล้วหักตามเกณฑ์ปี 2568 (หักเกิน 10 ได้) · ใบเตือนหักจากคะแนนรวม · <b>ขาดงานที่ออกใบเตือนเรื่องขาดงานแล้ว</b> ระบบหักครั้งเดียวโดยใช้ค่าที่มากกว่าให้อัตโนมัติ (ใบเตือนต้องเขียนเหตุผลว่า "ขาดงาน")</div>
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

/* แถวแก้หัวข้อ 1 ข้อ — ต้องอยู่นอก AnnualItems ไม่งั้นทุกครั้งที่หน้าวาดใหม่ ข้อความที่พิมพ์ค้างไว้จะหาย */
function AnnItemRow({ it, onSave, onDel, showW }) {
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
  const delItem = async (it) => {
    if (!window.confirm("ลบหัวข้อ \"" + it.title + "\"?\nคะแนนที่ให้ไปแล้วในข้อนี้จะไม่ถูกนับ")) return;
    const { error } = await window.sb.from("perf_jd_items").delete().eq("id", it.id);
    if (error) { toast(error.message, "x"); return; }
    load(jd); loadCounts();
  };
  const saveCommon = async (c, patch) => { const { error } = await window.sb.from("perf_common_items").update(patch).eq("id", c.id); if (error) toast(error.message, "x"); else { toast("บันทึกแล้ว", "check"); loadCounts(); } };
  const ItemRow = AnnItemRow;
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

/* ---------- HR: รายงาน (แบบเมนู Report ของระบบตัวอย่าง) — ทุกรายงานพิมพ์/บันทึก PDF และส่งออก CSV ได้ ---------- */
const ANN_REPORTS = [
  ["annual", "รายงานผลประเมินประจำปี", "ผลรายคนทุกปีที่มีในระบบ: คะแนนแต่ละส่วน คะแนนหัก คะแนนรวม เกรด (ปรับ = HR ปรับผล)"],
  ["approval", "รายงานตรวจสอบสถานะการอนุมัติ", "เลขที่ใบ วันที่ส่ง/ทบทวน/อนุมัติ ผู้อนุมัติ ค้างกี่วัน และขั้นถัดไป"],
  ["adjust", "รายงานการปรับเกรด/คะแนน", "ทุกครั้งที่ HR ปรับผล: ค่าที่ระบบคิด → ค่าที่ปรับ เหตุผล ผู้ปรับ เวลา"],
  ["deduct", "รายงานคะแนนหักการมาทำงานและใบเตือน", "สรุปรายคนจากตอกบัตร ใบเตือน และรายการที่ HR กรอก"],
  ["dept", "สรุปผลรายหน่วยงาน", "ความคืบหน้า คะแนนเฉลี่ย การกระจายเกรด และโบนัสรวมของแต่ละหน่วยงาน"],
  ["inform", "ใบแจ้งผลการประเมินรายบุคคล", "พิมพ์ใบแจ้งผลให้พนักงานลงนามรับทราบ ทีละหน่วยงาน (1 คน / 1 หน้า)"],
];
function AnnualReports({ rows, cycle, only }) {
  const [rep, setRep] = useAnnS(only || "annual");
  const [dept, setDept] = useAnnS("all");
  const [extra, setExtra] = useAnnS({});   // ข้อมูลที่โหลดเพิ่มตามรายงาน
  const [showMoney, setShowMoney] = useAnnS(false);
  const [onlyAppr, setOnlyAppr] = useAnnS(true);
  const cfg = cycle.config || {};
  const bands = cfg.bands || [];
  const depts = [...new Set(rows.map((r) => r.dept_name || r.dept))];
  const inDept = (r) => dept === "all" || (r.dept_name || r.dept) === dept;

  useAnnE(() => {
    let off = false;
    (async () => {
      try {
        if (rep === "annual" && !extra.cycles) {
          const { data: cs, error } = await window.sb.from("perf_cycles").select("id, name, year_th").order("id");
          if (error) throw new Error(error.message);
          const all = [];
          for (const c of cs || []) {
            const rs = c.id === cycle.id ? rows : (await annRpc("perf_list", { p_cycle: c.id }) || []);
            rs.forEach((r) => all.push({ ...r, _year: c.year_th || c.id }));
          }
          if (!off) setExtra((x) => ({ ...x, cycles: cs, allRows: all }));
        }
        if (rep === "adjust" && !extra.events) {
          const { data, error } = await window.sb.from("perf_events").select("*").in("action", ["adjust", "unadjust"]).order("at", { ascending: false });
          if (error) throw new Error(error.message);
          if (!off) setExtra((x) => ({ ...x, events: data || [] }));
        }
        if (rep === "deduct" && !extra.deds) {
          const { data, error } = await window.sb.from("perf_deductions").select("*").eq("cycle_id", cycle.id);
          if (error) throw new Error(error.message);
          if (!off) setExtra((x) => ({ ...x, deds: data || [] }));
        }
      } catch (e) { toast("โหลดรายงานไม่สำเร็จ: " + e.message, "x"); }
    })();
    return () => { off = true; };
  }, [rep]);

  const el = rows.filter((r) => r.eligible && inDept(r));
  const byId = {}; rows.forEach((r) => { byId[r.assignment_id] = r; });
  const days = (a, b) => Math.floor(((b ? new Date(b) : new Date()) - new Date(a)) / 864e5);
  const pct = (v) => v == null ? "" : annPct(v).toFixed(1);
  const totalTxt = (r) => r.total == null ? "" : (r.adjusted ? "(ปรับ) " : "") + annFmt(r.total);

  // แต่ละรายงาน = หัวคอลัมน์ + แถว (ข้อความ) · คอลัมน์ที่ขึ้นต้นด้วย # ชิดขวา
  let H = [], R = [], note = "", loading = false;
  if (rep === "annual") {
    if (!extra.allRows) loading = true;
    H = ["รหัส", "ชื่อ-สกุล", "ตำแหน่ง", "หน่วยงาน", "#ปี", "#A งาน JD (%)", "#B (%)", "#C พฤติกรรม (%)", "#ผลงาน (เต็ม 90)", "#มาทำงาน (เต็ม 10)", "#หักใบเตือน", "#คะแนนรวม", "เกรด"];
    R = (extra.allRows || []).filter((r) => r.eligible && inDept(r) && (!onlyAppr || r.status === "approved"))
      .sort((a, b) => String(a.employee_id).localeCompare(String(b.employee_id)) || String(a._year).localeCompare(String(b._year)))
      .map((r) => [r.employee_id, r.name, r.position, r.dept_name, r._year, pct(r.avg_a), pct(r.avg_b), pct(r.avg_c), r.perf_pct == null ? "" : (0.9 * r.perf_pct).toFixed(1), annFmt(r.attendance_points), Number(r.warning_points) ? "−" + annFmt(r.warning_points) : "0", totalTxt(r), r.grade || ""]);
    note = "A/B/C เป็นเปอร์เซ็นต์ของแต่ละส่วน (ระดับ 3 = 70%, ระดับ 5 = 100%) · ผลงาน = รวม A/B/C ตามน้ำหนักระดับตำแหน่ง × 0.9 · (ปรับ) = HR ปรับผลใน Calibration";
  } else if (rep === "approval") {
    H = ["เลขที่", "รหัส", "ชื่อ-สกุล", "หน่วยงาน", "สถานะ", "ส่งเมื่อ", "ทบทวนเมื่อ", "อนุมัติเมื่อ", "อนุมัติโดย", "#ค้าง (วัน)", "ขั้นถัดไป"];
    R = el.map((r) => [r.doc_no, r.employee_id, r.name, r.dept_name, (ANN_STATUS[r.status] || [r.status])[0], annDateTime(r.submitted_at), annDateTime(r.reviewed_at), annDateTime(r.approved_at), r.approved_by || "",
      r.submitted_at && r.status !== "approved" ? String(days(r.submitted_at)) : "", r.status === "approved" ? "เสร็จสิ้น" : ANN_NEXT[r.status]]);
    note = "ค้าง = จำนวนวันนับจากวันที่ส่งใบ จนถึงวันนี้ (เฉพาะใบที่ยังไม่อนุมัติ)";
  } else if (rep === "adjust") {
    if (!extra.events) loading = true;
    H = ["เวลา", "เลขที่", "ชื่อ-สกุล", "หน่วยงาน", "การกระทำ", "#ระบบคิด", "เกรดระบบ", "#ปรับเป็น", "เกรดที่ปรับ", "เหตุผล", "ผู้ปรับ"];
    R = (extra.events || []).filter((e) => byId[e.assignment_id] && inDept(byId[e.assignment_id])).map((e) => {
      const r = byId[e.assignment_id], d = e.data || {};
      return [annDateTime(e.at), r.doc_no, r.name, r.dept_name, e.action === "adjust" ? "ปรับผล" : "ยกเลิกการปรับ", d.calc_total == null ? "" : annFmt(d.calc_total), d.calc_grade || "",
        d.new_total == null ? "" : annFmt(d.new_total), d.new_grade || (d.new_total != null ? "(คิดจากคะแนน)" : ""), e.note || "", e.actor || ""];
    });
    note = "ทุกการปรับผลบันทึกอัตโนมัติ แก้ไขหรือลบย้อนหลังไม่ได้";
  } else if (rep === "deduct") {
    if (!extra.deds) loading = true;
    const ds = (extra.deds || []).filter((d) => !d.waived);
    const kinds = ANN_DEDUCT.map((x) => x[0]).filter((k) => ds.some((d) => d.kind === k));
    const by = {}; ds.forEach((d) => { const o = by[d.employee_id] = by[d.employee_id] || {}; o[d.kind] = (o[d.kind] || 0) + Number(d.qty || 0); });
    H = ["รหัส", "ชื่อ-สกุล", "หน่วยงาน", ...kinds.map((k) => "#" + annDeductLabel(k)), "#คะแนนมาทำงาน (เต็ม 10)", "#หักใบเตือน"];
    R = el.filter((r) => by[r.employee_id]).map((r) => [r.employee_id, r.name, r.dept_name, ...kinds.map((k) => by[r.employee_id][k] ? annFmt(by[r.employee_id][k]) : ""), annFmt(r.attendance_points), Number(r.warning_points) ? "−" + annFmt(r.warning_points) : "0"]);
    note = "ตัวเลขในช่องประเภท = จำนวนครั้ง/วัน (ไม่รวมรายการที่ตั้ง \"ไม่นับ\") · คนที่ไม่อยู่ในตารางได้คะแนนมาทำงานเต็ม 10";
  } else if (rep === "dept") {
    const g = {}; el.forEach((r) => { const k = r.dept_name || r.dept; const o = g[k] = g[k] || { n: 0, sent: 0, appr: 0, sum: 0, cnt: 0, gr: {}, bonus: 0 };
      o.n++; if (!["pending", "draft", "returned"].includes(r.status)) o.sent++; if (r.status === "approved") o.appr++;
      if (r.grade) { o.sum += Number(r.total); o.cnt++; o.gr[r.grade] = (o.gr[r.grade] || 0) + 1; o.bonus += Number(r.bonus_months || 0) * Number(r.bonus_factor == null ? 1 : r.bonus_factor); } });
    H = ["หน่วยงาน", "#ต้องประเมิน", "#ส่งแล้ว", "#อนุมัติแล้ว", "#คะแนนเฉลี่ย", ...bands.map((b) => "#" + b[1]), "#โบนัสรวม (เดือน)"];
    R = Object.entries(g).map(([k, o]) => [k, o.n, o.sent, o.appr, o.cnt ? (o.sum / o.cnt).toFixed(1) : "", ...bands.map((b) => o.gr[b[1]] || ""), o.bonus ? o.bonus.toFixed(2) : ""]);
    note = "คะแนนเฉลี่ย/เกรด นับเฉพาะใบที่ให้คะแนนครบ · โบนัสรวม = ผลรวม (เดือนโบนัสตามเกรด × สัดส่วนอายุงาน) ยังไม่คูณเงินเดือน";
  } else if (rep === "inform") {
    H = ["เลขที่", "รหัส", "ชื่อ-สกุล", "ตำแหน่ง", "หน่วยงาน", "สถานะ", "#คะแนนรวม", "เกรด"];
    R = el.filter((r) => r.grade && (!onlyAppr || r.status === "approved")).map((r) => [r.doc_no, r.employee_id, r.name, r.position, r.dept_name, (ANN_STATUS[r.status] || [r.status])[0], totalTxt(r), r.grade]);
    note = "กด \"พิมพ์ใบแจ้งผล\" เพื่อพิมพ์ทุกคนในรายการนี้ คนละ 1 หน้า";
  }

  const title = (ANN_REPORTS.find((x) => x[0] === rep) || [])[1];
  const sub = cycle.name + (dept !== "all" ? " · " + dept : "");
  const clean = (h) => h.replace(/^#/, "");
  const csv = () => window.downloadCSV(title + "-" + cycle.id + ".csv", H.map(clean), R);
  const printTable = () => annPrint(title, annPrintHead(title, sub) +
    `<table><tr>${H.map((h) => `<th${h[0] === "#" ? ' class="n"' : ""}>${annEsc(clean(h))}</th>`).join("")}</tr>${R.map((row) => `<tr>${row.map((c, i) => `<td${H[i][0] === "#" ? ' class="n"' : ""}>${String(c).startsWith("(ปรับ)") ? '<span class="adj">(ปรับ)</span>' + annEsc(String(c).slice(6)) : annEsc(c)}</td>`).join("")}</tr>`).join("")}</table>
     <div class="sub" style="margin-top:8px">${R.length} รายการ · ${annEsc(note)}</div>`, H.length > 8);
  const printInform = () => {
    const list = el.filter((r) => r.grade && (!onlyAppr || r.status === "approved"));
    if (!list.length) { toast("ไม่มีรายชื่อที่จะพิมพ์", "x"); return; }
    const SEC = { A: "A งานตามหน้าที่ (JD)", B: "B ทักษะงาน / ภาวะผู้นำ", C: "C พฤติกรรมหลัก" };
    annPrint("ใบแจ้งผลการประเมิน " + sub, list.map((r) => {
      const ps = annParts(r, (cfg.weights || {})[r.level] || {});
      const band = bands.find((b) => b[1] === r.grade);
      return `<div class="page">${annPrintHead("ใบแจ้งผลการประเมินผลการปฏิบัติงานประจำปี", cycle.name + " · เลขที่ " + r.doc_no)}
        <table><tr><td>ชื่อ-สกุล <b>${annEsc(r.name)}</b></td><td>รหัสพนักงาน <b>${annEsc(r.employee_id)}</b></td></tr><tr><td>ตำแหน่ง ${annEsc(r.position)}</td><td>หน่วยงาน ${annEsc(r.dept_name)}</td></tr>
        <tr><td colspan="2">ช่วงผลงาน ${annEsc(annDate(cycle.period_start))} – ${annEsc(annDate(cycle.period_end))}</td></tr></table>
        <h2>สรุปผลการประเมิน</h2><table><tr><th>ส่วน</th><th class="n">คะแนนที่ได้</th><th class="n">คะแนนเต็ม</th></tr>
        ${ps.map(([k, v, mx]) => `<tr><td>${SEC[k]}</td><td class="n">${v.toFixed(1)}</td><td class="n">${mx.toFixed(1)}</td></tr>`).join("")}
        <tr><td>การมาทำงาน (ลา / มาสาย / ขาดงาน)</td><td class="n">${annFmt(r.attendance_points)}</td><td class="n">10</td></tr>
        <tr><td>หักจากหนังสือเตือน</td><td class="n">${Number(r.warning_points) ? "−" + annFmt(r.warning_points) : "0"}</td><td class="n"></td></tr>
        <tr><td><b>คะแนนรวม</b></td><td class="n"><b>${annFmt(r.total)}</b></td><td class="n">100</td></tr></table>
        <div style="margin-top:12px;font-size:16px">ผลการประเมิน: เกรด <b>${annEsc(r.grade)}</b> — ${annEsc(band ? band[3] : "")}</div>
        ${showMoney ? `<div class="sub" style="margin-top:4px">โบนัส ${annFmt(r.bonus_months, 2)} เดือน${Number(r.bonus_factor) < 1 ? " × สัดส่วนอายุงาน " + r.bonus_factor : ""} · ปรับเงินเดือน ${r.raise_pct == null ? "—" : r.raise_pct + "%"} (มีผล ${annEsc(annDate(cycle.raise_effective))})</div>` : ""}
        <h2>ความเห็นของผู้ประเมิน / สิ่งที่ควรพัฒนา</h2><div style="border:1px solid #cbd5e1;min-height:60px;padding:6px">${annEsc(r.evaluator_comment || "")}</div>
        <div class="sign"><div>ผู้บังคับบัญชา</div><div>ฝ่ายบุคคล</div><div>พนักงานรับทราบ<br>วันที่ ......../......../........</div></div></div>`;
    }).join(""));
  };

  return (
    <>
      {!only && <Card pad>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
          {ANN_REPORTS.map(([id, t, d]) => (
            <button key={id} onClick={() => setRep(id)} className="btn" style={{ display: "block", textAlign: "left", padding: "10px 12px", height: "auto", whiteSpace: "normal",
              border: "1px solid " + (rep === id ? "var(--pri, #2563eb)" : "var(--border)"), background: rep === id ? "var(--pri-soft, #eef3ff)" : "transparent" }}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}><Icon name="file" size={13} /> {t}</div><div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{d}</div>
            </button>
          ))}
        </div>
      </Card>}
      <Card>
        <CardHead title={title} sub={R.length + " รายการ · " + sub}
          right={<div className="row" style={{ gap: 8 }}>
            {rep === "inform" && <button className="btn btn-pri btn-sm" onClick={printInform}><Icon name="file" size={14} />พิมพ์ใบแจ้งผล</button>}
            <button className="btn btn-soft btn-sm" disabled={loading} onClick={printTable}><Icon name="file" size={14} />พิมพ์ / PDF</button>
            <button className="btn btn-ghost btn-sm" disabled={loading} onClick={csv}><Icon name="download" size={14} />CSV</button>
          </div>} />
        <div className="row wrap" style={{ gap: 12, padding: "0 20px 12px", alignItems: "center" }}>
          <select className="select" style={{ maxWidth: 240 }} value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="all">ทุกหน่วยงาน</option>{depts.map((d) => <option key={d} value={d}>{d}</option>)}</select>
          {(rep === "annual" || rep === "inform") && <label className="row" style={{ gap: 6, fontSize: 13 }}><input type="checkbox" checked={onlyAppr} onChange={(e) => setOnlyAppr(e.target.checked)} />เฉพาะใบที่อนุมัติแล้ว</label>}
          {rep === "inform" && <label className="row" style={{ gap: 6, fontSize: 13 }}><input type="checkbox" checked={showMoney} onChange={(e) => setShowMoney(e.target.checked)} />แสดงโบนัส/ขึ้นเงินเดือนในใบแจ้ง</label>}
        </div>
        {loading ? <div className="muted" style={{ padding: "0 20px 20px" }}>กำลังโหลด…</div> : (
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr>{H.map((h) => <th key={h} className={h[0] === "#" ? "num" : undefined}>{clean(h)}</th>)}</tr></thead>
            <tbody>
              {R.slice(0, 500).map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j} className={H[j][0] === "#" ? "num" : undefined} style={{ fontSize: 13 }}>
                {String(c).startsWith("(ปรับ)") ? <><span style={{ color: "#c2410c", fontSize: 11, fontWeight: 700 }}>(ปรับ)</span>{String(c).slice(6)}</> : c}</td>)}</tr>)}
              {!R.length && <tr><td colSpan={H.length} className="muted" style={{ textAlign: "center", padding: 26 }}>ยังไม่มีข้อมูล{rep === "annual" || rep === "inform" ? (onlyAppr ? " — ยังไม่มีใบที่อนุมัติ (เอาเครื่องหมายถูก \"เฉพาะใบที่อนุมัติแล้ว\" ออกเพื่อดูทั้งหมด)" : " — ยังไม่มีใครถูกประเมินครบ") : ""}</td></tr>}
            </tbody>
          </table></div>
        )}
        <div className="muted" style={{ fontSize: 12, padding: "10px 20px 16px" }}>{note}{R.length > 500 ? " · หน้าจอแสดง 500 แถวแรก (พิมพ์/CSV ได้ครบ)" : ""}</div>
      </Card>
    </>
  );
}

/* กรอบเนื้อหาแบบ Prosoft: แถบหัวสีเทาอ่อน + เนื้อหา */
function AnnPanel({ title, sub, right, children, pad }) {
  return (
    <div className="hcm-panel">
      <div className="hcm-panel-h"><div><b>{title}</b>{sub && <span>{sub}</span>}</div>{right}</div>
      <div className={pad === false ? "" : "hcm-panel-b"}>{children}</div>
    </div>
  );
}

/* ---------- หน้าแรก (Home): สรุปผล + เอกสารรอดำเนินการ ---------- */
function AnnualHome({ rows, cycle, onOpen, go }) {
  const hr = annIsHR();
  const el = rows.filter((r) => r.eligible);
  const graded = el.filter((r) => r.grade);
  const avg = (f) => graded.length ? graded.reduce((s, r) => s + f(r), 0) / graded.length : null;
  const avgTotal = avg((r) => Number(r.total));
  const avgPerf = avg((r) => 0.9 * Number(r.perf_pct || 0));
  const avgAtt = avg((r) => Number(r.attendance_points || 0));
  const avgWarn = avg((r) => Number(r.warning_points || 0));
  const g = avgTotal == null ? null : window.bandOf(avgTotal);
  const todo = el.filter((r) => annTodoStatus(r.status) && (!hr || annHrMustFill(r)));
  const wait = el.filter((r) => annWaitStatus(r.status));
  const docs = (hr ? [...wait, ...todo] : [...todo.filter((r) => r.status === "returned"), ...todo.filter((r) => r.status !== "returned")]).slice(0, 8);
  const scope = hr ? "ทั้งองค์กร" : ([...new Set(el.map((r) => r.dept_name))].join(", ") || "หน่วยงานของคุณ");
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const dates = [["เปิดรับประเมิน", cycle.open_from], ["ปิดรับประเมิน", cycle.open_to], ["ผลงานถึงวันที่", cycle.period_end], ["จ่ายโบนัส", cycle.bonus_pay], ["เงินเดือนใหม่มีผล", cycle.raise_effective]]
    .filter((d) => d[1]).sort((a, b) => a[1].localeCompare(b[1]));
  const cnt = (f) => el.filter(f).length;
  return (
    <>
      <div className="hcm-quote">
        <span>“ ประเมินอย่างเป็นธรรม โปร่งใส ตรวจสอบได้ — เพื่อการเติบโตไปด้วยกัน ”</span>
        <AnnualCycleBadge cycle={cycle} />
      </div>
      <div className="hcm-home-grid">
        <AnnPanel title="สรุปผลการประเมิน" sub={cycle.name + " · " + scope}>
          <div className="hcm-sum">
            <div className="hcm-sum-grade">
              <div className="muted" style={{ fontSize: 12.5 }}>ณ รอบ {cycle.year_th || cycle.id}</div>
              <div className="g" style={{ color: g ? g.color : "var(--text-3)" }}>{g ? "เกรด " + g.key : "ยังไม่มีผล"}</div>
              <Icon name="trophy" size={46} color={g ? "#e8a317" : "#cbd5e1"} />
              <div className="t">{avgTotal == null ? "—" : avgTotal.toFixed(2) + " %"}</div>
              <div className="muted" style={{ fontSize: 12 }}>คะแนนรวมเฉลี่ย (100%)</div>
            </div>
            <div className="hcm-sum-side">
              {[["dashboard", "#2563eb", avgPerf, "ผลงานเฉลี่ย (เต็ม 90)"], ["clock", "#0d9488", avgAtt, "การมาทำงานเฉลี่ย (เต็ม 10)"], ["alert", "#e11d48", avgWarn, "หักใบเตือนเฉลี่ย"]].map(([ic, c, v, l]) => (
                <div key={l} className="hcm-sum-item">
                  <span className="ic" style={{ background: c + "18", color: c }}><Icon name={ic} size={22} /></span>
                  <div><div className="v" style={{ color: c }}>{v == null ? "—" : v.toFixed(2)}</div><div className="muted" style={{ fontSize: 12 }}>{l}</div></div>
                </div>
              ))}
              <div className="muted" style={{ fontSize: 12.5 }}>ให้คะแนนครบแล้ว <b>{graded.length}</b> จาก {el.length} คน</div>
            </div>
          </div>
        </AnnPanel>
        <AnnPanel title={hr ? "เอกสารรออนุมัติ / รอ HR กรอก" : "เอกสารรอประเมิน"} sub={(hr ? wait.length + " ใบรออนุมัติ · " : "") + todo.length + " ใบรอให้คะแนน"}
          right={<button className="btn btn-ghost btn-sm" onClick={() => go(hr ? "approve" : "todo")}>ดูทั้งหมด</button>} pad={false}>
          <div className="hcm-docs">
            {docs.map((r) => (
              <button key={r.assignment_id} className="hcm-doc" onClick={() => onOpen(r.assignment_id)}>
                <span className="av">{(r.name || "?").replace(/^(นาย|นางสาว|นาง)\s*/, "").trim()[0]}</span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <b>ชื่อพนักงาน : {r.name}</b>
                  <span className="muted">{r.doc_no} · {r.position} · {r.dept_name}</span>
                </span>
                <AnnStatus s={r.status} />
              </button>
            ))}
            {!docs.length && <div className="muted" style={{ padding: 22, textAlign: "center", fontSize: 13 }}>ไม่มีเอกสารค้าง</div>}
          </div>
        </AnnPanel>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14 }}>
        <Stat icon="users" label="พนักงานที่ต้องประเมิน" value={el.length} />
        <Stat icon="clock" label="ยังไม่ส่ง" value={cnt((r) => annTodoStatus(r.status))} tone="#e08a00" soft="#fdf1dc" />
        <Stat icon="checkCircle" label="รออนุมัติ" value={wait.length} tone="#0d9488" soft="#e2f4f2" />
        <Stat icon="award" label="อนุมัติแล้ว" value={cnt((r) => r.status === "approved")} tone="#16a34a" soft="#e7f6ec" />
      </div>
      <AnnPanel title="กำหนดการรอบประเมิน" sub="วันที่สำคัญของรอบนี้">
        <div className="hcm-timeline">
          {dates.map(([l, d]) => (
            <div key={l} className={"hcm-tl" + (d <= today ? " past" : "")}><span className="dot" /><b>{annDate(d)}</b><span>{l}</span></div>
          ))}
        </div>
      </AnnPanel>
    </>
  );
}
function AnnualCycleBadge({ cycle }) {
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const open = cycle.status === "open" && today >= cycle.open_from && today <= cycle.open_to;
  return <Badge cls={open ? "b-green" : "b-gray"} dot>{open ? "เปิดรับประเมินถึง " + annDate(cycle.open_to) : cycle.status === "draft" ? "ยังไม่เปิดรับ (เปิด " + annDate(cycle.open_from) + ")" : today < cycle.open_from ? "เปิดรับ " + annDate(cycle.open_from) : "ปิดรับประเมินแล้ว"}</Badge>;
}

/* ---------- ขั้นตอนการประเมิน (แผนภาพแบบหน้า Performance Management) ---------- */
function AnnualFlow({ rows, go }) {
  const hr = annIsHR();
  const el = rows.filter((r) => r.eligible);
  const n = (f) => el.filter(f).length;
  const Node = ({ ic, c, t, s, p, k }) => (
    <button className="flow-node" disabled={!p} onClick={() => p && go(p)}>
      <span className="ic" style={{ background: c + "1a", color: c }}><Icon name={ic} size={26} /></span>
      <b>{t}</b><span className="muted">{s}</span>
      {k > 0 && <span className="flow-k" style={{ background: c }}>{k}</span>}
    </button>
  );
  const main = [
    { ic: "settings", c: "#64748b", t: "ตั้งค่ารอบ & รายชื่อ", s: "ระดับ · JD · ผู้ประเมิน", p: hr ? "hub" : null },
    { ic: "eval", c: "#2563eb", t: "หน่วยงานประเมินตาม JD", s: "ให้ระดับ 1–5 ทุกข้อ", p: hr ? "forms" : "todo", k: n((r) => annTodoStatus(r.status)) },
    { ic: "checkCircle", c: "#0d9488", t: "ส่งใบ / ผู้จัดการทบทวน", s: "ตีกลับให้แก้ได้", p: "approve", k: n((r) => r.status === "submitted") },
    { ic: "award", c: "#16a34a", t: "HR อนุมัติ", s: "รายใบหรือเป็นชุด", p: "approve", k: n((r) => r.status === "reviewed") },
    { ic: "sliders", c: "#c2410c", t: "ปรับผล (Calibration)", s: "ปรับเกรดพร้อมเหตุผล", p: hr ? "calib" : null, k: n((r) => r.adjusted) },
    { ic: "trophy", c: "#7c3aed", t: "สรุปผลการประเมิน", s: "เกรด · โบนัส · ขึ้นเงินเดือน", p: "overview", k: n((r) => r.status === "approved") },
    { ic: "file", c: "#0f766e", t: "แจ้งผล & ส่ง Bplus", s: "ใบแจ้งผลรายคน · CSV", p: hr ? "reports-inform" : null },
  ];
  return (
    <>
      <AnnPanel title="ขั้นตอนการประเมินผลประจำปี" sub="กดที่กล่องเพื่อไปยังหน้านั้น · ตัวเลข = จำนวนใบที่อยู่ในขั้นนั้นตอนนี้">
        <div className="flow">
          {main.map((x, i) => <React.Fragment key={x.t}>{i > 0 && <span className="flow-arrow">→</span>}<Node {...x} /></React.Fragment>)}
        </div>
        <div className="flow flow-sub">
          <span className="flow-lab">ข้อมูลประกอบ</span>
          <Node ic="clock" c="#e08a00" t="ตอกบัตร + ใบเตือน" s="นำเข้าใน HR Core" p={hr ? "deduct" : null} />
          <span className="flow-arrow">→</span>
          <Node ic="alert" c="#e11d48" t="คะแนนหัก" s="มาทำงาน 10 − ใบเตือน" p={hr ? "deduct" : null} k={n((r) => Number(r.attendance_points) < 10 || Number(r.warning_points) > 0)} />
          <span className="flow-arrow">↗</span>
          <span className="muted" style={{ fontSize: 12.5 }}>รวมเข้าคะแนนรวมอัตโนมัติ</span>
        </div>
      </AnnPanel>
      <AnnPanel title="วิธีคิดคะแนน">
        <div style={{ fontSize: 13.5, lineHeight: 1.8 }}>
          <b>คะแนนรวม = ผลงาน (เต็ม 90) + การมาทำงาน (เต็ม 10) − หักใบเตือน</b><br />
          ผลงาน = ส่วน A งานตาม JD + B ทักษะงาน/ภาวะผู้นำ + C พฤติกรรมหลัก ถ่วงน้ำหนักตามระดับตำแหน่ง · ระดับ 3 ทุกข้อ = 70% (ตามมาตรฐาน) · ระดับ 5 = 100%<br />
          เกรด: {(window.PERF_BANDS || window.BANDS_DEFAULT).map((b) => b[1] + " ≥ " + b[0]).join(" · ")}
        </div>
      </AnnPanel>
    </>
  );
}

/* ---------- ตั้งค่าระบบ (Setup) — ไอคอนแยกหมวด ---------- */
function AnnualSetupHub({ rowsAll, go, goRoute }) {
  const nEx = rowsAll.filter((r) => r.excluded).length;
  const nNoJd = rowsAll.filter((r) => !r.excluded && r.eligible && !r.jd_id).length;
  const groups = [
    ["รอบประเมิน", [["calendar", "#2563eb", "รอบประเมิน & เกณฑ์", () => go("cycle")], ["users", "#0d9488", "รายชื่อ & ผู้ประเมิน", () => go("setup"), nNoJd ? nNoJd + " ไม่มี JD" : null],
      ["x", "#e11d48", "ไม่ต้องประเมิน", () => go("exclude"), nEx ? nEx + " คน" : null], ["list", "#7c3aed", "หัวข้อประเมิน (JD)", () => go("items")], ["alert", "#e08a00", "คะแนนหัก", () => go("deduct")]]],
    ["องค์กร & ข้อมูลพนักงาน", [["jd", "#2563eb", "จัดการ JD", () => goRoute("jd")], ["employee", "#0d9488", "รายชื่อพนักงาน", () => goRoute("employee")],
      ["layers", "#64748b", "จัดการข้อมูล", () => goRoute("manage")], ["settings", "#334155", "ตั้งค่าระบบ", () => goRoute("settings")]]],
    ["รายงาน", [["file", "#0f766e", "รายงานทั้งหมด", () => go("reports")], ["award", "#16a34a", "สรุปผลการประเมิน", () => go("overview")], ["sliders", "#c2410c", "ปรับผล (Calibration)", () => go("calib")]]],
  ];
  return groups.map(([t, items]) => (
    <AnnPanel key={t} title={t}>
      <div className="hub">
        {items.map(([ic, c, l, fn, note]) => (
          <button key={l} className="hub-tile" onClick={fn}>
            <span className="ic" style={{ background: c + "18", color: c }}><Icon name={ic} size={30} /></span>
            <span>{l}</span>{note && <span className="hub-note">{note}</span>}
          </button>
        ))}
      </div>
    </AnnPanel>
  ));
}

/* ---------- ปรับผล (Calibration): เทียบเกรดที่ระบบคิดกับเกรดที่ใช้จริง ---------- */
function AnnualCalib({ rows, cycle, onOpen }) {
  const [dept, setDept] = useAnnS("all");
  const [onlyAdj, setOnlyAdj] = useAnnS(false);
  const bands = (cycle.config && cycle.config.bands) || [];
  const done = rows.filter((r) => r.eligible && r.complete);
  const el = done.filter((r) => dept === "all" || (r.dept_name || r.dept) === dept);
  const list = el.filter((r) => !onlyAdj || r.adjusted).sort((a, b) => Number(b.total) - Number(a.total));
  const depts = [...new Set(done.map((r) => r.dept_name || r.dept))];
  return (
    <>
      <AnnPanel title="การกระจายเกรด: ระบบคิด เทียบกับ หลังปรับผล" sub={el.length + " คนที่ให้คะแนนครบ" + (dept !== "all" ? " · " + dept : "")}>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th></th>{bands.map((b) => <th key={b[1]} className="num"><AnnGrade g={b[1]} /></th>)}</tr></thead>
          <tbody>
            <tr><td>ระบบคิด</td>{bands.map((b) => <td key={b[1]} className="num">{el.filter((r) => r.calc_grade === b[1]).length || ""}</td>)}</tr>
            <tr><td><b>หลังปรับผล (ใช้จริง)</b></td>{bands.map((b) => <td key={b[1]} className="num"><b>{el.filter((r) => r.grade === b[1]).length || ""}</b></td>)}</tr>
            <tr><td className="muted">สัดส่วน</td>{bands.map((b) => <td key={b[1]} className="num muted">{el.length ? Math.round(el.filter((r) => r.grade === b[1]).length / el.length * 100) + "%" : ""}</td>)}</tr>
          </tbody>
        </table></div>
      </AnnPanel>
      <AnnPanel title={"รายชื่อ " + list.length + " คน"} sub="เรียงคะแนนมาก → น้อย · กดเปิดใบเพื่อปรับผล (ต้องใส่เหตุผลทุกครั้ง)"
        right={<div className="row wrap" style={{ gap: 10 }}>
          <select className="select" style={{ width: 200 }} value={dept} onChange={(e) => setDept(e.target.value)}><option value="all">ทุกหน่วยงาน</option>{depts.map((d) => <option key={d} value={d}>{d}</option>)}</select>
          <label className="row" style={{ gap: 6, fontSize: 13 }}><input type="checkbox" checked={onlyAdj} onChange={(e) => setOnlyAdj(e.target.checked)} />เฉพาะที่ปรับแล้ว</label>
        </div>} pad={false}>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>เลขที่</th><th>พนักงาน</th><th>หน่วยงาน</th><th>สถานะ</th><th className="num">ระบบคิด</th><th>เกรดระบบ</th><th className="num">ใช้จริง</th><th>เกรด</th><th>เหตุผลการปรับ</th><th></th></tr></thead>
          <tbody>{list.map((r) => (
            <tr key={r.assignment_id}>
              <td className="mono" style={{ fontSize: 12 }}>{r.doc_no}</td>
              <td><b>{r.name}</b><div className="muted" style={{ fontSize: 12 }}>{r.position}</div></td>
              <td style={{ fontSize: 13 }}>{r.dept_name}</td><td><AnnStatus s={r.status} /></td>
              <td className="num">{annFmt(r.calc_total)}</td><td><AnnGrade g={r.calc_grade} /></td>
              <td className="num"><AnnTotal r={r} /></td><td><AnnGrade g={r.grade} /></td>
              <td style={{ fontSize: 12.5 }}>{r.adjusted ? r.adj_reason : ""}</td>
              <td><button className="btn btn-soft btn-sm" onClick={() => onOpen(r.assignment_id)}>เปิด / ปรับ</button></td>
            </tr>))}
            {!list.length && <tr><td colSpan={10} className="muted" style={{ textAlign: "center", padding: 26 }}>{onlyAdj ? "ยังไม่มีการปรับผล" : "ยังไม่มีใบที่ให้คะแนนครบ"}</td></tr>}
          </tbody>
        </table></div>
      </AnnPanel>
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
    // กันวันที่กลับด้าน — ถ้าเปิด/ปิดสลับกัน หน่วยงานจะเข้าประเมินไม่ได้เลยโดยไม่มีใครรู้
    const bad = [["open_from", "open_to", "ช่วงเปิดรับประเมิน"], ["period_start", "period_end", "ช่วงผลงาน"]]
      .filter(([a, b]) => !c[a] || !c[b] || c[a] > c[b]).map((x) => x[2]);
    if (bad.length) { toast("วันที่ไม่ถูกต้อง: " + bad.join(", "), "x"); return; }
    if (c.status === "open" && !window.confirm("เปิดรับประเมิน " + annDate(c.open_from) + " – " + annDate(c.open_to) + "?\nบัญชีหน่วยงานจะเริ่มให้คะแนนได้ตามช่วงวันที่นี้")) return;
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
