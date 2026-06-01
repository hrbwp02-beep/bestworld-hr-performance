// screens-eval-jd.jsx — Evaluation form + JD Management
const { useState: useS3, useMemo: useM3 } = React;

/* =========================================================
   EVALUATION
   ========================================================= */
function Evaluation({ ctx }) {
  const e = EMPLOYEES.find((x) => x.id === ctx.evalEmp) || EMPLOYEES[0];
  const [tab, setTab] = useS3("kpi");
  const [kpi, setKpi] = useS3(() => KPI_ITEMS.map((k) => ({ ...k })));
  const [comp, setComp] = useS3(() => COMPETENCIES.map((c) => ({ ...c, score: 4, note: "" })));
  const [jd, setJd] = useS3(() => JD_ITEMS.map((j) => ({ ...j, note: "" })));
  const [submitted, setSubmitted] = useS3(false);

  const kpiTotal = useM3(() => {
    const w = kpi.reduce((a, k) => a + k.weight, 0);
    return Math.round(kpi.reduce((a, k) => a + k.score * k.weight, 0) / w * 10) / 10;
  }, [kpi]);
  const compTotal = useM3(() => Math.round(comp.reduce((a, c) => a + c.score * 20, 0) / comp.length * 10) / 10, [comp]);
  const jdTotal = useM3(() => Math.round(jd.reduce((a, j) => a + j.score * 20, 0) / jd.length * 10) / 10, [jd]);
  const overall = Math.round((kpiTotal * 0.5 + compTotal * 0.25 + jdTotal * 0.25) * 10) / 10;
  const band = window.bandOf(overall);

  const tabs = [
    { id: "kpi", label: "A · KPI", count: kpiTotal },
    { id: "comp", label: "B · Competency", count: compTotal },
    { id: "jd", label: "C · ตาม JD", count: jdTotal },
    { id: "approve", label: "สรุป & อนุมัติ" },
  ];

  const Stepper = () => (
    <div className="row wrap" style={{ gap: 0 }}>
      {[["KPI", "น้ำหนัก 50%", kpiTotal, "#2563eb"], ["Competency", "น้ำหนัก 25%", compTotal, "#7c3aed"], ["JD-Based", "น้ำหนัก 25%", jdTotal, "#0d9488"]].map(([n, w, v, c], i) => (
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
          <div className="row" style={{ gap: 10 }}>
            <button className="btn btn-ghost" onClick={() => toast("บันทึกฉบับร่างแล้ว", "check")}>บันทึกร่าง</button>
            <button className="btn btn-pri" onClick={() => { setTab("approve"); }}>ไปขั้นอนุมัติ <Icon name="chevRight" size={15} /></button>
          </div>
        </div>
        <hr className="divider" style={{ margin: "18px 0" }} />
        <Stepper />
      </Card>

      <Card>
        <div style={{ padding: "0 8px" }}><Tabs tabs={tabs} active={tab} onChange={setTab} /></div>

        {/* A. KPI */}
        {tab === "kpi" && (
          <div className="card-pad fade-up">
            <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>คะแนน KPI คำนวณอัตโนมัติจากผลงานจริงเทียบเป้าหมาย ถ่วงน้ำหนักตามความสำคัญ</p>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th style={{ minWidth: 220 }}>หัวข้อ KPI</th><th>เป้าหมาย</th><th>ผลจริง</th><th style={{ width: 80 }}>น้ำหนัก</th><th style={{ width: 150 }}>คะแนน</th></tr></thead>
                <tbody>
                  {kpi.map((k, i) => (
                    <tr key={k.id}>
                      <td style={{ fontWeight: 500, fontSize: 13.5 }}>{k.name}</td>
                      <td className="num muted" style={{ fontSize: 13 }}>{k.target}</td>
                      <td>
                        <input className="input" defaultValue={k.actual} style={{ padding: "6px 10px", width: 90, fontFamily: "var(--mono)" }}
                          onChange={(ev) => { const v = [...kpi]; v[i] = { ...v[i], actual: ev.target.value }; setKpi(v); }} />
                      </td>
                      <td className="num">{k.weight}%</td>
                      <td>
                        <div className="row" style={{ gap: 8 }}>
                          <div style={{ flex: 1 }}><ScoreBar value={k.score} height={6} /></div>
                          <span className="num" style={{ fontWeight: 700, color: window.bandOf(k.score).color, minWidth: 26 }}>{k.score}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr style={{ background: "var(--surface-2)" }}>
                  <td colSpan="3" style={{ fontWeight: 600 }}>คะแนน KPI รวม (ถ่วงน้ำหนัก)</td>
                  <td className="num">{kpi.reduce((a,k)=>a+k.weight,0)}%</td>
                  <td className="num" style={{ fontWeight: 700, fontSize: 16, color: "#2563eb" }}>{kpiTotal}</td>
                </tr></tfoot>
              </table>
            </div>
          </div>
        )}

        {/* B. Competency */}
        {tab === "comp" && (
          <div className="card-pad fade-up" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>ให้คะแนนสมรรถนะหลัก 5 ด้าน (1–5 ดาว) พร้อมความคิดเห็นประกอบ</p>
            {comp.map((c, i) => (
              <div key={c.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
                <div className="between wrap" style={{ gap: 12 }}>
                  <div><div style={{ fontWeight: 600, fontSize: 14.5 }}>{c.name}</div><div className="muted" style={{ fontSize: 12.5 }}>{c.en}</div></div>
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
              <span style={{ fontSize: 13.5, color: "var(--accent-700)" }}>หัวข้อดึงอัตโนมัติจาก <b>JD-PRD-02 · {e.position}</b> (v2.0)</span>
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
                  {[["KPI (50%)", kpiTotal, "#2563eb"], ["Competency (25%)", compTotal, "#7c3aed"], ["JD-Based (25%)", jdTotal, "#0d9488"]].map(([l, v, c]) => (
                    <div key={l} className="between" style={{ fontSize: 13.5 }}><span className="muted">{l}</span><span className="num" style={{ fontWeight: 700, color: c }}>{v}</span></div>
                  ))}
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
                <textarea className="input" placeholder="ความคิดเห็นสรุปจากผู้ประเมิน…" style={{ marginTop: 8 }} />
                <div className="row wrap" style={{ gap: 10, marginTop: 16 }}>
                  <button className="btn btn-ghost" onClick={() => toast("ส่งกลับเพื่อแก้ไข", "refresh")}><Icon name="refresh" size={15} />ส่งกลับแก้ไข</button>
                  <button className="btn btn-pri" style={{ flex: 1 }} onClick={() => { setSubmitted(true); toast("อนุมัติผลการประเมินเรียบร้อย", "checkCircle"); }}>
                    <Icon name="check" size={16} />{submitted ? "อนุมัติแล้ว" : "อนุมัติผลการประเมิน"}
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
function JDManagement({ ctx }) {
  const [open, setOpen] = useS3(null);
  const [dept, setDept] = useS3("all");
  const list = JD_LIBRARY.filter((j) => dept === "all" || j.dept === dept);
  const stMeta = { active: { l: "ใช้งาน", c: "b-green" }, review: { l: "รอตรวจสอบ", c: "b-amber" }, draft: { l: "ฉบับร่าง", c: "b-gray" } };
  const jd = open ? JD_LIBRARY.find((j) => j.id === open) : null;

  return (
    <div className="grid">
      <div className="page-head">
        <div><h1>จัดการ Job Description</h1><p>คลัง JD แยกตามตำแหน่ง · เชื่อมโยง KPI และ Competency · ควบคุมเวอร์ชัน</p></div>
        <button className="btn btn-pri" onClick={() => toast("เปิดฟอร์มสร้าง JD ใหม่", "plus")}><Icon name="plus" size={16} />สร้าง JD</button>
      </div>

      <div className="row wrap" style={{ gap: 8 }}>
        <button className={"chip" + (dept === "all" ? " on" : "")} onClick={() => setDept("all")}>ทุกหน่วยงาน</button>
        {DEPARTMENTS.slice(0, 7).map((d) => <button key={d.id} className={"chip" + (dept === d.id ? " on" : "")} onClick={() => setDept(d.id)}>{d.short}</button>)}
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
            <button className="btn btn-pri" onClick={() => { toast("บันทึก JD แล้ว", "check"); setOpen(null); }}><Icon name="edit" size={15} />แก้ไข JD</button>
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
              <b style={{ fontSize: 14, display: "block", marginBottom: 10 }}>เชื่อมโยง KPI ({jd.kpis} หัวข้อ)</b>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {KPI_ITEMS.slice(0, jd.kpis).map((k) => (
                  <div key={k.id} className="between" style={{ border: "1px solid var(--border)", borderRadius: 9, padding: "9px 13px" }}>
                    <span className="row" style={{ gap: 9, fontSize: 13 }}><Icon name="target" size={15} color="#2563eb" />{k.name}</span>
                    <span className="num muted" style={{ fontSize: 12 }}>{k.weight}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <b style={{ fontSize: 14, display: "block", marginBottom: 10 }}>เชื่อมโยง Competency ({jd.comps} ด้าน)</b>
              <div className="row wrap" style={{ gap: 8 }}>
                {COMPETENCIES.slice(0, jd.comps).map((c) => <Badge key={c.id} cls="b-blue" dot>{c.name}</Badge>)}
              </div>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}

Object.assign(window, { Evaluation, JDManagement });
