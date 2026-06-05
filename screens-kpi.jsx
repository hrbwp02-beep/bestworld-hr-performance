// screens-kpi.jsx — Department-based KPI module
const { useState: useK, useMemo: useKM } = React;

function TrafficDot({ score, size = 10 }) {
  const t = trafficOf(score);
  return <span title={t.l} style={{ width: size, height: size, borderRadius: 999, background: t.c, display: "inline-block", boxShadow: `0 0 0 3px ${t.c}22` }} />;
}
function TrafficLegend() {
  return (
    <div className="row wrap" style={{ gap: 14, fontSize: 12.5 }}>
      {[["#16a34a", "บรรลุเป้า (≥100%)"], ["#e08a00", "ใกล้เป้า (95–99%)"], ["#e11d48", "ต่ำกว่าเป้า (<95%)"]].map(([c, l]) => (
        <span key={l} className="row" style={{ gap: 6 }}><span style={{ width: 9, height: 9, borderRadius: 999, background: c }} />{l}</span>
      ))}
    </div>
  );
}

/* =========================================================
   KPI MODULE  (tabs)
   ========================================================= */
function KPIModule({ ctx }) {
  const [tab, setTab] = useK("overview");
  const tabs = [
    { id: "overview", label: "ภาพรวม KPI" },
    { id: "define", label: "กำหนด KPI" },
    { id: "monthly", label: "บันทึกผลรายเดือน" },
    { id: "submit", label: "ส่งรายงาน" },
    { id: "scoring", label: "คำนวณคะแนน" },
  ];
  return (
    <div className="grid">
      <div className="page-head">
        <div><h1>KPI หน่วยงาน</h1><p>กำหนด KPI แยกตามหน่วยงาน · ส่งรายงาน · คำนวณคะแนนอัตโนมัติ · {COMPANY.cycle}</p></div>
        <div className="row wrap" style={{ gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => ctx.go("exec")}><Icon name="trend" size={16} />มุมมองผู้บริหาร</button>
          <button className="btn btn-pri" onClick={() => { downloadCSV("kpi_definitions.csv", ["รหัส", "หน่วยงาน", "ตัวชี้วัด", "EN", "วิธีคิด", "น้ำหนัก%", "เป้าหมายปี", "ผลจริง", "หน่วย", "คะแนน%", "สถานะ"], (window.KPI_DEFS || []).map((k) => [k.id, deptName(k.dept), k.name, k.en, METHOD_LABEL[k.method], k.weight, k.target.y, k.actual, k.unit, kpiScore(k), k.status])); toast("ส่งออกรายงาน KPI แล้ว", "download"); }}><Icon name="download" size={16} />Export</button>
        </div>
      </div>
      <Card><div style={{ padding: "0 8px" }}><Tabs tabs={tabs} active={tab} onChange={setTab} /></div></Card>
      {tab === "overview" && <KPIOverview ctx={ctx} />}
      {tab === "define" && <KPIDefine ctx={ctx} />}
      {tab === "monthly" && <KPIMonthly ctx={ctx} />}
      {tab === "submit" && <KPISubmissions ctx={ctx} />}
      {tab === "scoring" && <KPIScoring ctx={ctx} />}
    </div>
  );
}

/* ---------- Monthly results entry ---------- */
const KPI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function KPIMonthly({ ctx }) {
  const depts = (window.DEPARTMENTS || []).filter((d) => (window.KPI_DEFS || []).some((k) => k.dept === d.id));
  const [dept, setDept] = useK((depts[0] || {}).id || "prod");
  return (
    <div className="grid fade-up">
      <Card className="card-pad">
        <div className="row wrap between" style={{ gap: 12 }}>
          <div><b style={{ fontSize: 15 }}>บันทึกผลการดำเนินงานรายเดือน · {COMPANY.cycle}</b><div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>กรอกผลแต่ละเดือนของแต่ละตัวชี้วัด · ระบบคำนวณค่าเฉลี่ย & % บรรลุเป้าให้อัตโนมัติ และอัปเดตหน้าภาพรวม/คะแนน</div></div>
          <select className="select" style={{ minWidth: 200 }} value={dept} onChange={(e) => setDept(e.target.value)}>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </Card>
      <KPIMonthlyGrid key={dept} dept={dept} ctx={ctx} />
    </div>
  );
}

function KPIMonthlyGrid({ dept, ctx }) {
  const kpis = (window.KPI_DEFS || []).filter((k) => k.dept === dept && k.status === "approved");
  const year = window.CYCLE_YEAR || 2569;
  const MON = window.KPI_MONTHLY || {};
  const [vals, setVals] = useK(() => { const o = {}; kpis.forEach((k) => { o[k.id] = {}; for (let m = 1; m <= 12; m++) { const v = (MON[k.id] || {})[m]; o[k.id][m] = v == null ? "" : String(v); } }); return o; });
  const [saving, setSaving] = useK(false);
  const setCell = (id, m, v) => setVals((s) => ({ ...s, [id]: { ...s[id], [m]: v } }));
  const avgOf = (id) => { const xs = []; for (let m = 1; m <= 12; m++) { const r = vals[id][m]; if (r !== "" && !isNaN(Number(r))) xs.push(Number(r)); } return xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length * 100) / 100 : null; };
  const save = async () => {
    setSaving(true);
    const ups = [], dels = [];
    Object.keys(vals).forEach((id) => { for (let m = 1; m <= 12; m++) { const r = vals[id][m]; if (r !== "" && !isNaN(Number(r))) ups.push({ kpi_id: id, year, month: m, value: Number(r) }); else dels.push({ id, m }); } });
    let err = null;
    if (ups.length) { const r = await window.sb.from("kpi_monthly").upsert(ups, { onConflict: "kpi_id,year,month" }); if (r.error) err = r.error.message; }
    for (const d of dels) { await window.sb.from("kpi_monthly").delete().eq("kpi_id", d.id).eq("year", year).eq("month", d.m); }
    setSaving(false);
    if (err) { toast("บันทึกไม่สำเร็จ: " + err, "x"); return; }
    await ctx.refresh();
    toast("บันทึกผลรายเดือนแล้ว", "checkCircle");
  };
  if (!kpis.length) return <Card className="card-pad"><div className="muted">หน่วยงานนี้ยังไม่มี KPI</div></Card>;
  return (
    <Card>
      <CardHead title={`ผลรายเดือน · ${deptName(dept)}`} sub={`${kpis.length} ตัวชี้วัด · ปี ${year}`} right={<button className="btn btn-pri btn-sm" onClick={save} disabled={saving}><Icon name="check" size={14} />{saving ? "กำลังบันทึก…" : "บันทึกผลรายเดือน"}</button>} />
      <div className="tbl-wrap">
        <table className="tbl" style={{ fontSize: 12.5 }}>
          <thead><tr>
            <th style={{ minWidth: 190, position: "sticky", left: 0, background: "var(--surface)", zIndex: 1 }}>ตัวชี้วัด</th>
            <th style={{ whiteSpace: "nowrap" }}>เป้าหมาย 2569</th>
            {KPI_MONTHS.map((m) => <th key={m} style={{ textAlign: "center" }}>{m}</th>)}
            <th>เฉลี่ย</th><th>% บรรลุ</th>
          </tr></thead>
          <tbody>
            {kpis.map((k) => {
              const a = avgOf(k.id);
              const tgt = k.target && k.target.y;
              const ach = (a != null && tgt) ? Math.round((k.method === "lower" ? (tgt / (a || 1)) : (a / tgt)) * 100) : null;
              const t = trafficOf(ach);
              return (
                <tr key={k.id}>
                  <td style={{ position: "sticky", left: 0, background: "var(--surface)", zIndex: 1, maxWidth: 220 }} title={(k.en ? k.en + " — " : "") + k.name}><div style={{ fontWeight: 600, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{k.en || k.name}</div>{k.section && <span className="badge b-blue" style={{ fontSize: 10 }}>{k.section}</span>}</td>
                  <td className="num" style={{ whiteSpace: "nowrap", color: "#0d9488", fontWeight: 700 }}>{k.formula || ((tgt != null ? tgt : "") + (k.unit || ""))}</td>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <td key={m} style={{ padding: 3 }}><input className="input" style={{ width: 52, padding: "5px 5px", textAlign: "center", fontSize: 12 }} value={vals[k.id][m]} onChange={(e) => setCell(k.id, m, e.target.value)} placeholder="–" /></td>
                  ))}
                  <td className="num" style={{ fontWeight: 700 }}>{a == null ? "–" : a}{a != null && k.unit ? <span className="muted" style={{ fontSize: 10 }}> {k.unit}</span> : ""}</td>
                  <td><span className="num" style={{ fontWeight: 700, color: t.c }}>{ach == null ? "–" : ach + "%"}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---------- Overview ---------- */
function KPIOverview({ ctx }) {
  const depts = KPI_DEPTS.map((id) => DEPARTMENTS.find((d) => d.id === id)).filter(Boolean);
  const achData = depts.map((d) => { const a = deptAchievement(d.id); return { ...d, score: a, color: trafficOf(a).c, short: d.short }; });
  const scoredDepts = achData.filter((d) => d.score != null);
  const avgAch = scoredDepts.length ? Math.round(scoredDepts.reduce((a, d) => a + d.score, 0) / scoredDepts.length * 10) / 10 : null;
  const barData = achData.map((d) => ({ ...d, score: d.score == null ? 0 : d.score }));
  const greenN = achData.filter((d) => d.score >= 100).length;
  // ----- report metrics, tied to the current evaluation cycle -----
  const cy = +(window.CYCLE_YEAR || 2569);
  const inCycle = (s) => String(s.id).includes("-" + cy + "-") || String(s.period || "").includes(String(cy));
  const cycleSubs = SUBMISSIONS.filter(inCycle);
  const subByDept = {}; cycleSubs.forEach((s) => { subByDept[s.dept] = s; });
  const isSubmitted = (id) => { const s = subByDept[id]; return !!s && (s.status === "submitted" || s.status === "approved"); };
  const subDone = KPI_DEPTS.filter((id) => isSubmitted(id)).length;
  const overdue = cycleSubs.filter((s) => s.status === "overdue");
  const missing = KPI_DEPTS.filter((id) => !subByDept[id]);
  const allKpis = KPI_DEFS.filter((k) => k.status === "approved").map((k) => ({ ...k, score: kpiScore(k) })).filter((k) => k.score != null);
  const topKpis = [...allKpis].sort((a, b) => b.score - a.score).slice(0, 5);
  const botKpis = [...allKpis].sort((a, b) => a.score - b.score).slice(0, 5);
  const companyTrend = KPI_MONTHS.map((m, i) => ({ m, v: Math.round((96 - (5 - i) * 0.9) * 10) / 10 }));
  const subStatusPie = ["approved", "submitted", "rejected", "overdue", "draft"].map((k) => ({
    label: SUB_STATUS[k].l, v: cycleSubs.filter((s) => s.status === k).length, color: SUB_STATUS[k].c,
  })).filter((x) => x.v > 0);
  const heatVals = depts.map((d) => deptKpiTrend(d.id).map((p) => p.v));

  return (
    <div className="grid fade-up">
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))" }}>
        <Stat icon="target" label="KPI เฉลี่ยองค์กร" value={avgAch == null ? "—" : avgAch} unit={avgAch == null ? "" : "%"} tone="#2563eb" soft="#e8effb" sub={avgAch == null ? "รอบันทึกผลจริง" : "Achievement รวม"} />
        <Stat icon="checkCircle" label="หน่วยงานบรรลุเป้า" value={greenN} unit={`/ ${achData.length}`} tone="#16a34a" soft="#e7f6ec" sub="ไฟเขียว" />
        <Stat icon="upload" label="รายงานส่งแล้ว" value={subDone} unit={`/ ${KPI_DEPTS.length}`} tone="#0d9488" soft="#e2f4f2" sub={"รอบปี " + cy} />
        <Stat icon="alert" label="รายงานค้างส่ง" value={missing.length + overdue.length} unit="ฉบับ" tone="#e11d48" soft="#fbe7ec" sub={overdue.length + " เกินกำหนด · " + missing.length + " ยังไม่ส่ง"} />
      </div>

      {/* traffic light grid */}
      <Card>
        <CardHead title="Traffic Light · สถานะ KPI ทุกหน่วยงาน" sub="ไฟจราจรแสดงระดับการบรรลุเป้าหมาย" right={<TrafficLegend />} />
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px,1fr))", padding: 18 }}>
          {achData.map((d) => {
            const t = trafficOf(d.score);
            return (
              <button key={d.id} onClick={() => ctx.goExec(d.id)} className="card" style={{ textAlign: "left", cursor: "pointer", padding: 16, border: `1px solid ${t.c}33`, background: t.soft + "55", boxShadow: "none" }}>
                <div className="between" style={{ marginBottom: 10 }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{d.name}</span>
                  <TrafficDot score={d.score} size={12} />
                </div>
                <div className="row" style={{ alignItems: "baseline", gap: 6 }}>
                  <span className="num" style={{ fontWeight: 700, fontSize: 26, color: t.c }}>{d.score == null ? "รอผล" : d.score}</span>
                  {d.score != null && <span className="muted" style={{ fontSize: 13 }}>%</span>}
                  <span className={"badge " + (d.trend >= 0 ? "b-green" : "b-red")} style={{ marginLeft: "auto", padding: "2px 8px" }}>{d.trend >= 0 ? "▲" : "▼"} {Math.abs(d.trend)}</span>
                </div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>{kpisOf(d.id).length} ตัวชี้วัด · {t.l} · รายงาน: <span style={{ color: isSubmitted(d.id) ? "#16a34a" : "#e08a00", fontWeight: 600 }}>{isSubmitted(d.id) ? "ส่งแล้ว" : "ยังไม่ส่ง"}</span></div>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="grid" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
        <Card>
          <CardHead title="KPI Achievement ตามหน่วยงาน" sub="เส้นประแดง = เป้าหมาย 100%" />
          <div className="card-pad"><BarChart data={barData} max={130} baseline={100} /></div>
        </Card>
        <Card>
          <CardHead title="สถานะการส่งรายงาน" sub="KPI Submission Status" />
          <div className="card-pad">{cycleSubs.length ? <Donut data={subStatusPie} centerLabel="รายงาน" centerValue={cycleSubs.length} size={170} /> : <div className="muted" style={{ height: 170, display: "grid", placeItems: "center", textAlign: "center" }}>ยังไม่มีรายงานรอบปี {cy}<br />— กด “ส่งรายงาน”</div>}</div>
        </Card>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
        <Card>
          <CardHead title="แนวโน้ม KPI รายเดือน" sub="ค่าเฉลี่ย Achievement ทั้งองค์กร" />
          <div className="card-pad"><LineChart data={companyTrend} height={240} min={88} max={100} /></div>
        </Card>
        <Card>
          <CardHead title="ติดตามรายงานล่าช้า" sub="Late Report Tracking" right={<Badge cls="b-amber" dot>{missing.length + overdue.length}</Badge>} />
          <div style={{ padding: "8px 12px" }}>
            {[
              ...cycleSubs.filter((s) => ["overdue", "draft", "rejected"].includes(s.status)).map((s) => ({ dept: s.dept, period: s.period, due: s.due, status: s.status, id: s.id, real: true })),
              ...missing.map((id) => ({ dept: id, period: "รอบปี " + cy, due: "—", status: "missing", id: "missing-" + id, real: false })),
            ].map((item) => {
              const st = item.status === "missing" ? { l: "ยังไม่ส่ง", cls: "b-gray" } : SUB_STATUS[item.status];
              const Tag = item.real ? "button" : "div";
              return (
                <Tag key={item.id} onClick={item.real ? () => ctx.openSub(item.id) : undefined} className="between" style={{ width: "100%", border: "none", background: "none", cursor: item.real ? "pointer" : "default", padding: "11px 10px", borderBottom: "1px solid var(--border-2)", textAlign: "left", gap: 10 }}>
                  <div><div style={{ fontWeight: 600, fontSize: 13 }}>{deptName(item.dept)}</div><div className="muted" style={{ fontSize: 11.5 }}>{item.period} · ครบกำหนด {item.due}</div></div>
                  <Badge cls={st.cls} dot>{st.l}</Badge>
                </Tag>
              );
            })}
            {missing.length + overdue.length === 0 && cycleSubs.length > 0 && <div className="muted" style={{ padding: "16px 10px", fontSize: 13 }}>ทุกหน่วยงานส่งรายงานครบแล้ว ✓</div>}
          </div>
        </Card>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Card>
          <CardHead title="KPI ที่ทำได้ดีที่สุด" sub="Top KPI Achievement" right={<Icon name="trophy" size={18} color="#e08a00" />} />
          <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {topKpis.length ? topKpis.map((k) => <KpiMiniRow key={k.id} k={k} />) : <div className="muted" style={{ fontSize: 13, padding: "12px 0" }}>ยังไม่มีผลการประเมิน KPI</div>}
          </div>
        </Card>
        <Card>
          <CardHead title="KPI ที่ต้องเร่งปรับปรุง" sub="Bottom KPI Achievement" right={<Icon name="alert" size={18} color="#e11d48" />} />
          <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {botKpis.length ? botKpis.map((k) => <KpiMiniRow key={k.id} k={k} />) : <div className="muted" style={{ fontSize: 13, padding: "12px 0" }}>ยังไม่มีผลการประเมิน KPI</div>}
          </div>
        </Card>
      </div>

      <Card>
        <CardHead title="KPI Heatmap · Achievement รายเดือน" sub="หน่วยงาน × เดือน (สีเขียว = สูง / แดง = ต่ำ)" />
        <div className="card-pad"><Heatmap rows={depts.map((d) => d.short)} cols={KPI_MONTHS} values={heatVals} min={85} max={105} /></div>
      </Card>
    </div>
  );
}

function KpiMiniRow({ k }) {
  const t = trafficOf(k.score);
  return (
    <div className="row" style={{ gap: 11 }}>
      <TrafficDot score={k.score} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k.name}</div>
        <div className="muted" style={{ fontSize: 11.5 }}>{deptShort(k.dept)} · เป้า {k.target.y}{k.unit} / จริง {k.actual}{k.unit}</div>
      </div>
      <span className="num" style={{ fontWeight: 700, color: t.c, fontSize: 15 }}>{k.score}%</span>
    </div>
  );
}

/* ---------- Add KPI modal ---------- */
function AddKPIModal({ dept, kpi, ctx, onClose }) {
  const isEdit = !!kpi;
  const [name, setName] = useK((kpi && kpi.name) || "");
  const [en, setEn] = useK((kpi && kpi.en) || "");
  const [unit, setUnit] = useK((kpi && kpi.unit) || "%");
  const [method, setMethod] = useK((kpi && kpi.method) || "higher");
  const [weight, setWeight] = useK(kpi ? String(kpi.weight) : "");
  const [target, setTarget] = useK(kpi && kpi.target ? String(kpi.target.y) : "");
  const [tgtText, setTgtText] = useK((kpi && kpi.formula) || "");
  const [freq, setFreq] = useK((kpi && kpi.frequency) || "monthly");
  const [actual, setActual] = useK(kpi ? String(kpi.actual) : "");
  const [type, setType] = useK((kpi && kpi.type) || "number");
  const [busy, setBusy] = useK(false);
  const [err, setErr] = useK("");

  const nextId = () => {
    const nums = (window.KPI_DEFS || []).map((k) => parseInt((String(k.id).match(/\d+/) || [0])[0], 10)).filter((n) => !isNaN(n));
    return "KPI-" + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0");
  };

  const save = async () => {
    if (!name.trim()) { setErr("กรุณากรอกชื่อตัวชี้วัด"); return; }
    setErr(""); setBusy(true);
    const row = {
      dept, name: name.trim(), en: en.trim() || null, unit: unit.trim() || null,
      method, weight: Number(weight) || 0,
      target_m: Number(target) || 0, target_q: Number(target) || 0, target_y: Number(target) || 0,
      formula: tgtText.trim() || null, frequency: freq,
      actual: Number(actual) || 0, type,
    };
    let error;
    if (isEdit) { ({ error } = await window.sb.from("kpi_defs").update(row).eq("id", kpi.id)); }
    else { row.id = nextId(); row.status = "approved"; row.owner = "HR"; row.trend_down = false; row.sort = 999; ({ error } = await window.sb.from("kpi_defs").insert(row)); }
    if (error) { setBusy(false); setErr("บันทึกไม่สำเร็จ: " + error.message); return; }
    await ctx.refresh();
    toast(isEdit ? "บันทึก KPI แล้ว" : "เพิ่ม KPI “" + name.trim() + "” แล้ว", "check");
    onClose();
  };

  return (
    <Modal title={(isEdit ? "แก้ไข KPI · " : "เพิ่ม KPI · ") + deptName(dept)} onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button className="btn btn-pri" onClick={save} disabled={busy}><Icon name="check" size={15} />{busy ? "กำลังบันทึก…" : "บันทึก KPI"}</button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {err && <div style={{ padding: "10px 13px", borderRadius: 10, background: "var(--red-soft)", color: "#be123c", fontSize: 13 }}>{err}</div>}
        <div className="field"><label>วัตถุประสงค์ / เป้าหมาย</label><input className="input" value={en} onChange={(e) => setEn(e.target.value)} placeholder="เช่น การต่อรองราคาและประหยัดต้นทุน" /></div>
        <div className="field"><label>ตัวชี้วัด (วิธีคิด) *</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น มูลค่าที่ประหยัดได้ ÷ มูลค่าสั่งซื้อรวม" /></div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="field"><label>วิธีคิดคะแนน</label><select className="select" value={method} onChange={(e) => setMethod(e.target.value)}><option value="higher">ยิ่งสูงยิ่งดี</option><option value="lower">ยิ่งต่ำยิ่งดี</option></select></div>
          <div className="field"><label>ประเภท</label><select className="select" value={type} onChange={(e) => setType(e.target.value)}><option value="number">ตัวเลข</option><option value="quality">เชิงคุณภาพ</option></select></div>
        </div>
        <div className="field"><label>ความถี่การรายงาน (Reporting Frequency)</label><select className="select" value={freq} onChange={(e) => setFreq(e.target.value)}><option value="monthly">รายเดือน (Monthly)</option><option value="quarterly">รายไตรมาส (Quarterly)</option><option value="yearly">รายปี (Yearly)</option></select></div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <div className="field"><label>น้ำหนัก (%)</label><input className="input" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="20" /></div>
          <div className="field"><label>เป้าหมาย</label><input className="input" type="number" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="95" /></div>
          <div className="field"><label>ผลจริง</label><input className="input" type="number" value={actual} onChange={(e) => setActual(e.target.value)} placeholder="97" /></div>
        </div>
        <div className="field"><label>หน่วย</label><input className="input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="%, ครั้ง, ชม. …" /></div>
        <div className="field"><label>เป้าหมายปี 2569 (ข้อความเต็ม)</label><input className="input" value={tgtText} onChange={(e) => setTgtText(e.target.value)} placeholder="เช่น ≥ 97%, ≥ 2 โครงการ/ปี, 0 ครั้ง" /><div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>ข้อความนี้จะแสดงเป็น “เป้าหมายปี 2569” (เว้นว่างได้ ระบบจะสร้างจากตัวเลข+หน่วยให้อัตโนมัติ)</div></div>
      </div>
    </Modal>
  );
}

/* ---------- Define KPI ---------- */
function KPIDefine({ ctx }) {
  const [dept, setDept] = useK("prod");
  const [cycle, setCycle] = useK("y");
  const [showAdd, setShowAdd] = useK(false);
  const [editKpi, setEditKpi] = useK(null);
  const approveKpi = async (k) => { const { error } = await window.sb.from("kpi_defs").update({ status: "approved" }).eq("id", k.id); if (error) { toast("อนุมัติไม่สำเร็จ", "x"); return; } await ctx.refresh(); toast("อนุมัติ KPI เข้าระบบแล้ว", "check"); };
  const rejectKpi = async (k) => { const { error } = await window.sb.from("kpi_defs").delete().eq("id", k.id); if (error) { toast("ปฏิเสธไม่สำเร็จ", "x"); return; } await ctx.refresh(); toast("ปฏิเสธ KPI แล้ว", "x"); };
  const kpis = KPI_DEFS.filter((k) => k.dept === dept);
  const approved = kpis.filter((k) => k.status === "approved");
  const proposed = kpis.filter((k) => k.status === "proposed");
  const wTotal = approved.reduce((a, k) => a + k.weight, 0);

  return (
    <div className="grid fade-up">
      <Card className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="between wrap" style={{ gap: 12 }}>
          <div className="row wrap" style={{ gap: 8 }}>
            {KPI_DEPTS.map((id) => <button key={id} className={"chip" + (dept === id ? " on" : "")} onClick={() => setDept(id)}>{deptShort(id)}</button>)}
          </div>
          <button className="btn btn-pri btn-sm" onClick={() => setShowAdd(true)}><Icon name="plus" size={15} />เพิ่ม KPI</button>
        </div>
        <div className="between wrap" style={{ gap: 12, borderTop: "1px solid var(--border-2)", paddingTop: 14 }}>
          <div className="row" style={{ gap: 10 }}>
            <span className="muted" style={{ fontSize: 13 }}>แสดงเป้าหมาย:</span>
            <Seg options={[{ value: "m", label: "รายเดือน" }, { value: "q", label: "รายไตรมาส" }, { value: "y", label: "รายปี" }]} value={cycle} onChange={setCycle} />
          </div>
          <div className="row" style={{ gap: 8 }}>
            <span className="muted" style={{ fontSize: 13 }}>น้ำหนักรวม</span>
            <Badge cls={wTotal === 100 ? "b-green" : "b-red"} dot>{wTotal}%</Badge>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead title={`ตัวชี้วัด · ${deptName(dept)}`} sub={`${approved.length} ตัวชี้วัดที่ใช้งาน`} right={<TrafficLegend />} />
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr>
              <th style={{ minWidth: 170 }}>วัตถุประสงค์ / เป้าหมาย</th><th style={{ minWidth: 220 }}>ตัวชี้วัด (วิธีคิด)</th><th>ประเภท</th>
              <th>น้ำหนัก</th><th style={{ minWidth: 120 }}>เป้าหมายปี 2569</th><th>ผลจริง</th><th style={{ minWidth: 130 }}>คะแนน</th><th></th>
            </tr></thead>
            <tbody>
              {approved.map((k) => {
                const sc = kpiScore(k); const t = trafficOf(sc);
                const tgtText = k.formula || ((k.method === "lower" ? "≤ " : k.method === "higher" ? "≥ " : "") + (k.target[cycle] != null ? k.target[cycle] : (k.target.y != null ? k.target.y : "")) + (k.unit ? " " + k.unit : ""));
                return (
                  <tr key={k.id}>
                    <td><div style={{ fontWeight: 600, fontSize: 13.5 }}>{k.en || "—"}</div>{k.section && <span className="badge b-blue" style={{ fontSize: 10.5, marginTop: 3 }}>เฉพาะส่วนงาน: {k.section}</span>}</td>
                    <td><div style={{ fontSize: 13 }}>{k.name}</div><div className="muted" style={{ fontSize: 11.5 }}>{METHOD_LABEL[k.method]} · {({ monthly: "รายเดือน", quarterly: "รายไตรมาส", yearly: "รายปี" })[k.frequency] || "รายเดือน"}</div></td>
                    <td><Badge cls={k.type === "quality" ? "b-blue" : "b-gray"}>{k.type === "quality" ? "เชิงคุณภาพ" : "ตัวเลข"}</Badge></td>
                    <td className="num" style={{ fontWeight: 600 }}>{k.weight}%</td>
                    <td><span className="num" style={{ fontWeight: 700, color: "#0d9488", fontSize: 13.5 }}>{tgtText}</span></td>
                    <td className="num" style={{ fontWeight: 600 }}>{k.actual == null ? <span className="muted-3">—</span> : <>{k.actual}<span className="muted" style={{ fontSize: 11 }}> {k.unit}</span></>}</td>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        <TrafficDot score={sc} />
                        <span className="num" style={{ fontWeight: 700, color: t.c }}>{sc == null ? "รอผล" : sc + "%"}</span>
                      </div>
                    </td>
                    <td><button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => setEditKpi(k)}><Icon name="edit" size={14} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {proposed.length > 0 && (
        <Card>
          <CardHead title="KPI ที่ผู้จัดการเสนอ" sub="รอ HR พิจารณาอนุมัติเข้าระบบ" right={<Badge cls="b-amber" dot>{proposed.length} รายการ</Badge>} />
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {proposed.map((k) => (
              <div key={k.id} className="between wrap" style={{ gap: 12, border: "1px dashed #e0b878", background: "var(--amber-soft)55", borderRadius: 12, padding: "14px 16px" }}>
                <div>
                  <div className="row" style={{ gap: 9 }}><Icon name="flag" size={16} color="#e08a00" /><b style={{ fontSize: 14 }}>{k.name}</b><span className="muted" style={{ fontSize: 12.5 }}>{k.en}</span></div>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 5 }}>เสนอโดย {k.owner} · {METHOD_LABEL[k.method]} · เป้า {k.target.y}{k.unit}</div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => rejectKpi(k)}>ปฏิเสธ</button>
                  <button className="btn btn-pri btn-sm" onClick={() => approveKpi(k)}><Icon name="check" size={14} />อนุมัติ</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {showAdd && <AddKPIModal dept={dept} ctx={ctx} onClose={() => setShowAdd(false)} />}
      {editKpi && <AddKPIModal dept={editKpi.dept} kpi={editKpi} ctx={ctx} onClose={() => setEditKpi(null)} />}
    </div>
  );
}

/* ---------- shared file helpers ---------- */
const TH_ABBR = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const TH_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
function thaiToday() { const d = new Date(); return String(d.getDate()).padStart(2, "0") + " " + TH_ABBR[d.getMonth()] + " " + (d.getFullYear() + 543); }
function fileKind(name) {
  const e = (String(name).split(".").pop() || "").toLowerCase();
  if (["xlsx", "xls", "csv"].includes(e)) return "excel";
  if (e === "pdf") return "pdf";
  if (["ppt", "pptx"].includes(e)) return "ppt";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(e)) return "image";
  return "pdf";
}
function fmtBytes(b) { return b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB"; }
async function uploadReportFiles(fileList, folder) {
  const added = [];
  for (const file of fileList) {
    const path = folder + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 6) + "-" + file.name;
    const up = await window.sb.storage.from("kpi-reports").upload(path, file, { contentType: file.type, upsert: true });
    if (up.error) { toast("อัปโหลด " + file.name + " ไม่สำเร็จ", "x"); continue; }
    const { data } = window.sb.storage.from("kpi-reports").getPublicUrl(path);
    added.push({ name: file.name, type: fileKind(file.name), size: fmtBytes(file.size), url: data.publicUrl });
  }
  return added;
}

/* ---------- New submission modal ---------- */
function NewSubmissionModal({ ctx, onClose }) {
  const cy = +(window.CYCLE_YEAR || 2569);
  const [dept, setDept] = useK(KPI_DEPTS[0]);
  const [cycle, setCycle] = useK("monthly");
  const [period, setPeriod] = useK(TH_FULL[new Date().getMonth()] + " " + cy);
  const [due, setDue] = useK("");
  const [note, setNote] = useK("");
  const [files, setFiles] = useK([]);
  const [busy, setBusy] = useK(false);
  const [uploading, setUploading] = useK(false);
  const [err, setErr] = useK("");

  const onFiles = async (ev) => {
    const list = [...ev.target.files]; if (!list.length) return;
    setUploading(true);
    const added = await uploadReportFiles(list, "new");
    setFiles((p) => [...p, ...added]);
    setUploading(false);
    ev.target.value = "";
  };
  const nextId = () => {
    const nums = (window.SUBMISSIONS || []).map((s) => parseInt((String(s.id).match(/(\d+)$/) || [])[1], 10)).filter((n) => !isNaN(n));
    return "RPT-" + cy + "-" + String((nums.length ? Math.max(...nums) : 50) + 1).padStart(3, "0");
  };
  const submit = async () => {
    if (!period.trim()) { setErr("กรุณาระบุรอบรายงาน เช่น มิถุนายน " + cy); return; }
    setErr(""); setBusy(true);
    const id = nextId(), t = thaiToday();
    const row = {
      id, dept, period: period.trim(), cycle, due: due.trim() || "—", submitted: t,
      submitter: "คุณสุดารัตน์ (HR)", status: "submitted", note: note.trim() || null, ver: "v1",
      files, versions: [{ v: "v1", date: t, by: "สุดารัตน์", note: "ฉบับแรก" }],
      audit: [{ act: "ส่งรายงาน v1", by: "คุณสุดารัตน์ (HR)", time: t }], sort: 999,
    };
    const { error } = await window.sb.from("submissions").insert(row);
    setBusy(false);
    if (error) { setErr("ส่งรายงานไม่สำเร็จ: " + error.message); return; }
    await ctx.refresh();
    toast("ส่งรายงาน " + id + " แล้ว", "check");
    onClose();
  };

  return (
    <Modal title="ส่งรายงาน KPI" onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button className="btn btn-pri" onClick={submit} disabled={busy || uploading}><Icon name="upload" size={15} />{busy ? "กำลังส่ง…" : "ส่งรายงาน"}</button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {err && <div style={{ padding: "10px 13px", borderRadius: 10, background: "var(--red-soft)", color: "#be123c", fontSize: 13 }}>{err}</div>}
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="field"><label>หน่วยงาน</label><select className="select" value={dept} onChange={(e) => setDept(e.target.value)}>{KPI_DEPTS.map((id) => <option key={id} value={id}>{deptName(id)}</option>)}</select></div>
          <div className="field"><label>รอบรายงาน</label><select className="select" value={cycle} onChange={(e) => setCycle(e.target.value)}><option value="monthly">รายเดือน</option><option value="quarterly">รายไตรมาส</option><option value="yearly">รายปี</option></select></div>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="field"><label>งวด *</label><input className="input" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder={"เช่น มิถุนายน " + cy} /></div>
          <div className="field"><label>ครบกำหนดส่ง</label><input className="input" value={due} onChange={(e) => setDue(e.target.value)} placeholder="เช่น 05 ก.ค. 2569" /></div>
        </div>
        <div className="field"><label>หมายเหตุ</label><textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="สรุปสั้นๆ เกี่ยวกับรายงานนี้" /></div>
        <div className="field">
          <label>เอกสารหลักฐาน (Excel / PDF / รูป …)</label>
          <label className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", cursor: uploading ? "default" : "pointer" }}>
            <Icon name="paperclip" size={14} />{uploading ? "กำลังอัปโหลด…" : "แนบไฟล์"}
            <input type="file" multiple accept=".xlsx,.xls,.csv,.pdf,.ppt,.pptx,image/*" onChange={onFiles} disabled={uploading} style={{ display: "none" }} />
          </label>
          {files.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {files.map((f, i) => {
                const fk = FILE_KINDS[f.type];
                return (
                  <div key={i} className="between" style={{ border: "1px solid var(--border)", borderRadius: 9, padding: "8px 11px" }}>
                    <span className="row" style={{ gap: 9, fontSize: 13, minWidth: 0 }}><Icon name={fk.icon} size={15} color={fk.c} /><span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</span><span className="muted-3" style={{ fontSize: 11.5 }}>{f.size}</span></span>
                    <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}><Icon name="x" size={14} color="var(--red)" /></button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Submissions ---------- */
function KPISubmissions({ ctx }) {
  const [filter, setFilter] = useK("all");
  const [showNew, setShowNew] = useK(false);
  const rows = SUBMISSIONS.filter((s) => filter === "all" || s.status === filter);
  const counts = { all: SUBMISSIONS.length };
  Object.keys(SUB_STATUS).forEach((k) => counts[k] = SUBMISSIONS.filter((s) => s.status === k).length);
  return (
    <div className="grid fade-up">
      <Card className="card-pad">
        <div className="between wrap" style={{ gap: 12 }}>
          <div className="row wrap" style={{ gap: 8 }}>
            <button className={"chip" + (filter === "all" ? " on" : "")} onClick={() => setFilter("all")}>ทั้งหมด <span className="mono" style={{ opacity: .7 }}>{counts.all}</span></button>
            {Object.keys(SUB_STATUS).map((k) => <button key={k} className={"chip" + (filter === k ? " on" : "")} onClick={() => setFilter(k)}>{SUB_STATUS[k].l} <span className="mono" style={{ opacity: .7 }}>{counts[k]}</span></button>)}
          </div>
          <button className="btn btn-pri btn-sm" onClick={() => setShowNew(true)}><Icon name="upload" size={15} />ส่งรายงาน</button>
        </div>
      </Card>
      {showNew && <NewSubmissionModal ctx={ctx} onClose={() => setShowNew(false)} />}
      <Card>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>รหัส</th><th>หน่วยงาน</th><th>รอบ</th><th>ครบกำหนด</th><th>ส่งจริง</th><th>ผู้ส่ง</th><th>หลักฐาน</th><th>สถานะ</th><th></th></tr></thead>
            <tbody>
              {rows.map((s) => {
                const st = SUB_STATUS[s.status];
                const late = s.status === "overdue";
                return (
                  <tr key={s.id} style={{ cursor: "pointer" }} onClick={() => ctx.openSub(s.id)}>
                    <td className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>{s.id}</td>
                    <td><div style={{ fontWeight: 600, fontSize: 13 }}>{deptName(s.dept)}</div></td>
                    <td><Badge cls="b-gray">{s.cycle === "monthly" ? "รายเดือน" : s.cycle === "quarterly" ? "รายไตรมาส" : "รายปี"}</Badge> <span className="muted" style={{ fontSize: 12 }}>{s.period}</span></td>
                    <td className="muted" style={{ fontSize: 13 }}>{s.due}</td>
                    <td className={late ? "" : "num"} style={{ fontSize: 13, color: late ? "var(--red)" : "inherit", fontWeight: late ? 600 : 400 }}>{s.submitted || "ยังไม่ส่ง"}</td>
                    <td className="muted" style={{ fontSize: 13 }}>{s.submitter}</td>
                    <td>{s.files.length > 0 ? <span className="row" style={{ gap: 5 }}><Icon name="paperclip" size={14} color="var(--text-3)" /><span className="num">{s.files.length}</span></span> : <span className="muted-3">—</span>}</td>
                    <td><Badge cls={st.cls} dot>{st.l}</Badge></td>
                    <td><Icon name="chevRight" size={16} color="var(--text-3)" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ---------- Submission drawer ---------- */
function SubmissionDrawer({ subId, onClose, ctx }) {
  const [uploading, setUploading] = useK(false);
  const s = SUBMISSIONS.find((x) => x.id === subId);
  if (!s) return null;
  const st = SUB_STATUS[s.status];
  const attach = async (ev) => {
    const list = [...ev.target.files]; if (!list.length) return;
    setUploading(true);
    const added = await uploadReportFiles(list, s.id);
    if (added.length) {
      const newFiles = [...(s.files || []), ...added];
      const newAudit = [...(s.audit || []), { act: "แนบไฟล์เพิ่ม " + added.length + " รายการ", by: "คุณสุดารัตน์ (HR)", time: thaiToday() }];
      const { error } = await window.sb.from("submissions").update({ files: newFiles, audit: newAudit }).eq("id", s.id);
      if (error) { setUploading(false); toast("แนบไฟล์ไม่สำเร็จ: " + error.message, "x"); return; }
      await ctx.refresh();
      toast("แนบไฟล์แล้ว " + added.length + " รายการ", "check");
    }
    setUploading(false); ev.target.value = "";
  };
  const steps = [
    { l: "จัดทำรายงาน", done: true }, { l: "อัปโหลดเข้าระบบ", done: s.status !== "draft" }, { l: "ผู้จัดการอนุมัติ", done: s.status === "approved" }, { l: "HR ตรวจสอบ", done: s.status === "approved" },
  ];
  return (
    <Drawer title={`รายงาน KPI · ${deptName(s.dept)}`} sub={`${s.id} · ${s.period}`} onClose={onClose} width={560}
      footer={s.status === "submitted" ? <>
        <button className="btn btn-ghost" onClick={async () => { const { error } = await window.sb.from("submissions").update({ status: "rejected" }).eq("id", s.id); if (error) { toast("ตีกลับไม่สำเร็จ", "x"); return; } await ctx.refresh(); toast("ตีกลับรายงานเพื่อแก้ไข", "refresh"); onClose(); }}>ตีกลับ</button>
        <button className="btn btn-pri" onClick={async () => { const { error } = await window.sb.from("submissions").update({ status: "approved" }).eq("id", s.id); if (error) { toast("อนุมัติไม่สำเร็จ", "x"); return; } await ctx.refresh(); toast("อนุมัติรายงาน KPI แล้ว", "checkCircle"); onClose(); }}><Icon name="check" size={15} />อนุมัติรายงาน</button>
      </> : <button className="btn btn-ghost" onClick={onClose}>ปิด</button>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {/* status workflow */}
        <div>
          <div className="between" style={{ marginBottom: 12 }}><b style={{ fontSize: 14 }}>ขั้นตอนการส่งรายงาน</b><Badge cls={st.cls} dot>{st.l}</Badge></div>
          <div className="row" style={{ gap: 0 }}>
            {steps.map((step, i) => (
              <React.Fragment key={i}>
                <div style={{ textAlign: "center", flex: 1 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 999, margin: "0 auto", display: "grid", placeItems: "center", background: step.done ? "#16a34a" : "var(--surface-3)", color: step.done ? "#fff" : "var(--text-3)" }}>
                    {step.done ? <Icon name="check" size={15} /> : <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{i + 1}</span>}
                  </div>
                  <div style={{ fontSize: 11, marginTop: 5, color: step.done ? "var(--text)" : "var(--text-3)" }}>{step.l}</div>
                </div>
                {i < steps.length - 1 && <div style={{ height: 2, flex: .5, background: step.done ? "#16a34a" : "var(--border)", marginTop: 15 }} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* meta */}
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[["รอบรายงาน", s.period], ["ครบกำหนดส่ง", s.due], ["วันที่ส่งจริง", s.submitted || "ยังไม่ส่ง"], ["ผู้ส่ง", s.submitter]].map(([k, v]) => (
            <div key={k} style={{ background: "var(--surface-2)", borderRadius: 10, padding: "10px 13px" }}><div className="muted" style={{ fontSize: 11.5 }}>{k}</div><div style={{ fontSize: 13.5, fontWeight: 600 }}>{v}</div></div>
          ))}
        </div>

        {/* evidence */}
        <div>
          <div className="between" style={{ marginBottom: 10 }}><b style={{ fontSize: 14 }}>เอกสารหลักฐาน ({s.files.length})</b>
            <label className="btn btn-soft btn-sm" style={{ cursor: uploading ? "default" : "pointer" }}><Icon name="plus" size={13} />{uploading ? "กำลังอัปโหลด…" : "แนบไฟล์"}
              <input type="file" multiple accept=".xlsx,.xls,.csv,.pdf,.ppt,.pptx,image/*" onChange={attach} disabled={uploading} style={{ display: "none" }} />
            </label>
          </div>
          {s.files.length === 0 ? <div className="placeholder-img" style={{ height: 70 }}>ยังไม่มีเอกสารแนบ</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {s.files.map((f, i) => {
                const fk = FILE_KINDS[f.type];
                return (
                  <div key={i} className="between" style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 13px" }}>
                    <div className="row" style={{ gap: 11, minWidth: 0 }}>
                      <span style={{ width: 34, height: 34, borderRadius: 8, background: fk.c + "18", color: fk.c, display: "grid", placeItems: "center", flex: "0 0 34px" }}><Icon name={fk.icon} size={17} /></span>
                      <div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div><div className="muted" style={{ fontSize: 11.5 }}>{fk.label} · {f.size}</div></div>
                    </div>
                    <div className="row" style={{ gap: 4 }}>
                      <button className="icon-btn" style={{ width: 32, height: 32 }} title="เปิดดู" onClick={() => f.url ? window.open(f.url, "_blank") : toast("ไฟล์ตัวอย่าง (ไม่มีไฟล์จริงแนบ)", "eye")}><Icon name="eye" size={15} /></button>
                      <button className="icon-btn" style={{ width: 32, height: 32 }} title="ดาวน์โหลด" onClick={() => f.url ? window.open(f.url, "_blank") : toast("ไฟล์ตัวอย่าง (ไม่มีไฟล์จริงแนบ)", "download")}><Icon name="download" size={15} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* version control */}
        {s.versions.length > 0 && (
          <div>
            <b style={{ fontSize: 14, display: "block", marginBottom: 10 }}>ประวัติเวอร์ชัน (Version Control)</b>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {s.versions.map((v, i) => (
                <div key={i} className="between" style={{ background: "var(--surface-2)", borderRadius: 9, padding: "9px 13px" }}>
                  <div className="row" style={{ gap: 9 }}><Badge cls={i === 0 ? "b-blue" : "b-gray"}>{v.v}</Badge><span style={{ fontSize: 13 }}>{v.note}</span></div>
                  <span className="muted" style={{ fontSize: 12 }}>{v.by} · {v.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* audit trail */}
        <div>
          <b style={{ fontSize: 14, display: "block", marginBottom: 10 }}>Audit Trail</b>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {s.audit.map((a, i) => (
              <div key={i} className="row" style={{ gap: 11, alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", alignSelf: "stretch" }}>
                  <span style={{ width: 9, height: 9, borderRadius: 999, background: "var(--accent)", marginTop: 5, flex: "0 0 9px" }} />
                  {i < s.audit.length - 1 && <span style={{ width: 2, flex: 1, background: "var(--border)", minHeight: 18 }} />}
                </div>
                <div style={{ paddingBottom: 14 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{a.act}</div><div className="muted" style={{ fontSize: 11.5 }}>{a.by} · {a.time}</div></div>
              </div>
            ))}
          </div>
        </div>

        {s.note && <div className="row" style={{ gap: 10, background: "var(--surface-2)", borderRadius: 10, padding: "11px 14px" }}><Icon name="flag" size={15} color="var(--text-3)" /><span style={{ fontSize: 13 }}>{s.note}</span></div>}
      </div>
    </Drawer>
  );
}

/* ---------- Scoring ---------- */
function KPIScoring({ ctx }) {
  const [method, setMethod] = useK("higher");
  const [target, setTarget] = useK(85);
  const [actual, setActual] = useK(88);
  const [lo, setLo] = useK(80);
  const [hi, setHi] = useK(95);
  const demo = { method, target: { y: +target }, actual: +actual, range: [+lo, +hi], customScore: Math.round(+actual / +target * 100) };
  const score = kpiScore(demo);
  const t = trafficOf(score);

  const methods = [
    { id: "higher", title: "Higher is Better", desc: "ยิ่งสูงยิ่งดี — เช่น OEE, ผลผลิต", formula: "Score = (Actual ÷ Target) × 100", ex: "เป้า 85% · จริง 88% → 103.5%" },
    { id: "lower", title: "Lower is Better", desc: "ยิ่งต่ำยิ่งดี — เช่น ของเสีย, Downtime", formula: "Score = (Target ÷ Actual) × 100", ex: "เป้า 3% · จริง 2% → 150%" },
    { id: "range", title: "Range Score", desc: "ดีเมื่ออยู่ในช่วงที่กำหนด", formula: "อยู่ในช่วง [Min, Max] = 100%", ex: "ช่วง 80–95 · จริง 88 → 100%" },
    { id: "custom", title: "Custom Formula", desc: "ผู้ดูแลระบบกำหนดสูตรเอง", formula: "= กำหนดสูตรอิสระ", ex: "เช่น weighted, step, ฯลฯ" },
  ];

  return (
    <div className="grid fade-up">
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(250px,1fr))" }}>
        {methods.map((m) => (
          <button key={m.id} onClick={() => setMethod(m.id)} className="card" style={{ textAlign: "left", cursor: "pointer", padding: 18, border: method === m.id ? "1.5px solid var(--accent)" : "1px solid var(--border)", boxShadow: method === m.id ? "0 0 0 3px var(--accent-soft)" : "var(--shadow-sm)" }}>
            <div className="row between"><b style={{ fontSize: 14 }}>{m.title}</b>{method === m.id && <Icon name="checkCircle" size={18} color="var(--accent)" />}</div>
            <div className="muted" style={{ fontSize: 12.5, margin: "6px 0 10px" }}>{m.desc}</div>
            <div className="mono" style={{ fontSize: 11.5, background: "var(--surface-2)", borderRadius: 7, padding: "7px 10px", color: "var(--text-2)" }}>{m.formula}</div>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 7 }}>{m.ex}</div>
          </button>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.2fr 1fr" }}>
        <Card>
          <CardHead title="เครื่องคำนวณคะแนน (Live)" sub={`วิธี: ${METHOD_LABEL[method]} · ปรับค่าเพื่อดูผลทันที`} />
          <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="row wrap" style={{ gap: 14 }}>
              <div className="field" style={{ flex: 1, minWidth: 120 }}><label>เป้าหมาย (Target)</label><input className="input" type="number" value={target} onChange={(e) => setTarget(e.target.value)} /></div>
              <div className="field" style={{ flex: 1, minWidth: 120 }}><label>ผลจริง (Actual)</label><input className="input" type="number" value={actual} onChange={(e) => setActual(e.target.value)} /></div>
            </div>
            {method === "range" && (
              <div className="row wrap" style={{ gap: 14 }}>
                <div className="field" style={{ flex: 1, minWidth: 120 }}><label>ขอบล่าง (Min)</label><input className="input" type="number" value={lo} onChange={(e) => setLo(e.target.value)} /></div>
                <div className="field" style={{ flex: 1, minWidth: 120 }}><label>ขอบบน (Max)</label><input className="input" type="number" value={hi} onChange={(e) => setHi(e.target.value)} /></div>
              </div>
            )}
            {method === "custom" && (
              <div className="field"><label>สูตรกำหนดเอง (Custom Formula)</label><input className="input mono" defaultValue="(Actual / Target) * 100" /><div className="muted" style={{ fontSize: 11.5 }}>ตัวแปรที่ใช้ได้: Actual, Target, Min, Max</div></div>
            )}
          </div>
        </Card>
        <Card className="card-pad" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
          <div className="muted" style={{ fontWeight: 600, fontSize: 13 }}>คะแนนที่คำนวณได้</div>
          <Ring value={Math.min(score, 100)} size={150} color={t.c} sub={<div className="num" style={{ fontSize: 13, fontWeight: 700, color: t.c, marginTop: 2 }}>{score}%</div>} />
          <div className="row" style={{ gap: 8 }}><TrafficDot score={score} size={12} /><span style={{ fontWeight: 600, color: t.c }}>{t.l}</span></div>
          <div className="muted" style={{ fontSize: 12, textAlign: "center" }}>เป้า {target} · จริง {actual} → <b style={{ color: t.c }}>{score}%</b></div>
        </Card>
      </div>
    </div>
  );
}

Object.assign(window, { KPIModule, SubmissionDrawer, TrafficDot, trafficOf });
