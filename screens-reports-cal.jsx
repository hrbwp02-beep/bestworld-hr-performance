// screens-reports-cal.jsx — Reports, Calibration, Settings
const { useState: useS4, useMemo: useM4 } = React;

/* ---------- 9-Box matrix (shared) ---------- */
function NineBox({ emps, onPick, height = 460 }) {
  const [hi, setHi] = useS4(null);
  const cellOf = (x, y) => NINEBOX.cells.find((c) => c.x === x && c.y === y);
  // group employees into cells by perf(x:1-3) potential(y:1-3)
  const grouped = {};
  emps.forEach((e) => { const key = (e.perf - 1) + "," + (e.potential - 1); (grouped[key] = grouped[key] || []).push(e); });
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column-reverse", justifyContent: "space-around", paddingBottom: 26, writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>
        <span>ศักยภาพ (Potential) →</span>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: `repeat(3, ${(height-26)/3}px)`, gap: 6 }}>
          {[2,1,0].map((y) => [0,1,2].map((x) => {
            const cell = cellOf(x, y);
            const members = grouped[x + "," + y] || [];
            const active = hi === x + "," + y;
            return (
              <div key={x+","+y} onMouseEnter={() => setHi(x+","+y)} onMouseLeave={() => setHi(null)}
                style={{ borderRadius: 12, padding: 11, background: active ? cell.color + "1f" : cell.color + "12", border: `1px solid ${cell.color}40`, position: "relative", overflow: "hidden", transition: "background .15s" }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: cell.color }}>{cell.label}</div>
                <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 7 }}>{cell.sub}</div>
                <div className="row wrap" style={{ gap: 4 }}>
                  {members.slice(0, active ? 99 : 6).map((e) => (
                    <button key={e.id} title={e.name} onClick={() => onPick && onPick(e.id)} style={{ border: "2px solid #fff", borderRadius: 999, padding: 0, cursor: "pointer", lineHeight: 0 }}>
                      <Avatar name={e.name} initials={e.initials} color={e.color} size={26} fontSize={10} />
                    </button>
                  ))}
                  {!active && members.length > 6 && <span style={{ fontSize: 11, fontWeight: 600, color: cell.color, alignSelf: "center" }}>+{members.length - 6}</span>}
                </div>
              </div>
            );
          }))}
        </div>
        <div style={{ textAlign: "center", fontSize: 11.5, fontWeight: 600, color: "var(--text-2)", marginTop: 8 }}>ผลงาน (Performance) →</div>
      </div>
    </div>
  );
}

/* =========================================================
   REPORTS
   ========================================================= */
function Reports({ ctx }) {
  const [tab, setTab] = useS4("ranking");
  const ranked = [...EMPLOYEES].sort((a, b) => b.overall - a.overall);
  const hipo = EMPLOYEES.filter((e) => e.potential === 3 && e.perf >= 2);
  const low = EMPLOYEES.filter((e) => e.overall < 72);
  const heatCols = COMPETENCIES.map((c) => c.name);
  const heatVals = DEPARTMENTS.map((d, di) => COMPETENCIES.map((c, ci) => Math.round(Math.max(58, Math.min(95, d.score + [3,6,-2,-6,8][ci] + (di%3-1)*2)))));
  const yearCompare = [
    { m: "2564", v: 78.1 }, { m: "2565", v: 79.6 }, { m: "2566", v: 81.2 }, { m: "2567", v: 82.9 }, { m: "2568", v: 84.7 },
  ];

  const tabs = [
    { id: "ranking", label: "อันดับพนักงาน" },
    { id: "ninebox", label: "9-Box Matrix" },
    { id: "talent", label: "Talent Pool" },
    { id: "heatmap", label: "Heatmap" },
    { id: "yoy", label: "เปรียบเทียบรายปี" },
    { id: "yearend", label: "สรุปสิ้นปี" },
  ];
  const promoteRec = (e) => {
    const g = e.band.key;
    if (e.warnings > 0) return { t: "ระงับ (มีใบเตือน)", c: "#e11d48" };
    if ((g === "A+" || g === "A") && e.potential >= 3) return { t: "แนะนำเลื่อนตำแหน่ง", c: "#16a34a" };
    if (g === "A+" || g === "A") return { t: "ดาวเด่น — พิจารณาเลื่อน", c: "#0d9488" };
    if (g === "D") return { t: "ต้องพัฒนา (PIP)", c: "#e08a00" };
    return { t: "คงตำแหน่ง", c: "#64748b" };
  };

  return (
    <div className="grid">
      <div className="page-head">
        <div><h1>รายงานและการวิเคราะห์</h1><p>รายงานเชิงลึกสำหรับ HR และผู้บริหาร · {COMPANY.cycle}</p></div>
        <div className="row wrap" style={{ gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => window.print()}><Icon name="file" size={16} />PDF</button>
          <button className="btn btn-pri" onClick={() => { const ranked = [...EMPLOYEES].sort((a, b) => b.overall - a.overall); downloadCSV("performance_ranking.csv", ["อันดับ", "รหัส", "ชื่อ", "หน่วยงาน", "ตำแหน่ง", "KPI", "Competency", "คะแนนรวม", "ระดับ"], ranked.map((e, i) => [i + 1, e.id, e.name, deptName(e.dept), e.position, e.kpi, e.comp, e.overall, e.band.label])); toast("ส่งออกรายงานจัดอันดับแล้ว", "fileExcel"); }}><Icon name="download" size={16} />Export Excel</button>
        </div>
      </div>

      <Card><div style={{ padding: "0 8px" }}><Tabs tabs={tabs} active={tab} onChange={setTab} /></div>

        {tab === "ranking" && (
          <div className="card-pad fade-up grid" style={{ gridTemplateColumns: "1.3fr 1fr" }}>
            <div>
              <div className="row between" style={{ marginBottom: 14 }}><b>Top Performers</b><Badge cls="b-green" dot>10 อันดับแรก</Badge></div>
              <HBar data={ranked.slice(0, 10).map((e) => ({ name: e.name + " · " + deptShort(e.dept), score: e.overall }))} />
            </div>
            <div>
              <div className="row between" style={{ marginBottom: 14 }}><b>การกระจายผลคะแนน</b></div>
              <ForcedRankBars emps={EMPLOYEES} />
            </div>
          </div>
        )}

        {tab === "ninebox" && (
          <div className="card-pad fade-up">
            <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>จัดกลุ่มพนักงานตามผลงาน (แกนนอน) และศักยภาพ (แกนตั้ง) · คลิกที่รูปเพื่อดูรายละเอียด</p>
            <NineBox emps={EMPLOYEES} onPick={ctx.openEmp} />
          </div>
        )}

        {tab === "talent" && (
          <div className="card-pad fade-up grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <div className="row between" style={{ marginBottom: 12 }}><b className="row" style={{ gap: 8 }}><Icon name="award" size={18} color="#16a34a" />High Potential</b><Badge cls="b-green">{hipo.length} คน</Badge></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {hipo.map((e) => <TalentRow key={e.id} e={e} onClick={() => ctx.openEmp(e.id)} tone="#16a34a" />)}
              </div>
            </div>
            <div>
              <div className="row between" style={{ marginBottom: 12 }}><b className="row" style={{ gap: 8 }}><Icon name="alert" size={18} color="#e11d48" />ต้องพัฒนาเร่งด่วน</b><Badge cls="b-red">{low.length} คน</Badge></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {low.map((e) => <TalentRow key={e.id} e={e} onClick={() => ctx.openEmp(e.id)} tone="#e11d48" />)}
              </div>
            </div>
          </div>
        )}

        {tab === "heatmap" && (
          <div className="card-pad fade-up">
            <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>คะแนนเฉลี่ยสมรรถนะแต่ละหน่วยงาน · สีเขียว = สูง / สีแดง = ต่ำ</p>
            <Heatmap rows={DEPARTMENTS.map((d) => d.short)} cols={heatCols} values={heatVals} />
          </div>
        )}

        {tab === "yoy" && (
          <div className="card-pad fade-up grid" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
            <div>
              <b style={{ display: "block", marginBottom: 12 }}>คะแนนเฉลี่ยองค์กรย้อนหลัง 5 ปี</b>
              <LineChart data={yearCompare} height={260} min={74} />
            </div>
            <div>
              <b style={{ display: "block", marginBottom: 12 }}>เปลี่ยนแปลงรายหน่วยงาน (YoY)</b>
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {[...DEPARTMENTS].sort((a,b)=>b.trend-a.trend).map((d) => (
                  <div key={d.id} className="between" style={{ fontSize: 13.5 }}>
                    <span className="row" style={{ gap: 9 }}><span className="tag-dot" style={{ background: d.color }} />{d.name}</span>
                    <span className={"delta " + (d.trend >= 0 ? "up" : "down")}><Icon name={d.trend >= 0 ? "arrowUp" : "arrowDown"} size={13} stroke={2.6} />{Math.abs(d.trend)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "yearend" && (
          <div className="card-pad fade-up">
            <div className="row wrap between" style={{ marginBottom: 14, gap: 10 }}>
              <div><b style={{ fontSize: 15 }}>สรุปผลการปฏิบัติงานประจำปี (Year-End Review)</b><div className="muted" style={{ fontSize: 12.5 }}>คะแนนรวม + เกรด + โบนัส + ปรับเงินเดือน + คำแนะนำเลื่อนตำแหน่ง · {COMPANY.cycle}</div></div>
              <button className="btn btn-ghost btn-sm" onClick={() => { downloadCSV("year_end_summary_" + (window.CYCLE_YEAR || 2569) + ".csv", ["รหัส", "ชื่อ", "หน่วยงาน", "ตำแหน่ง", "KPI", "Competency", "JD", "คะแนนรวม", "เกรด", "โบนัส(เท่า)", "ปรับเงิน(%)", "คำแนะนำ"], ranked.map((e) => { const o = window.evalOutcome(e.overall, e.warnings); return [e.id, e.name, deptName(e.dept), e.position, e.kpi, e.comp, (e.eval && e.eval.jd_score) || "-", e.overall, e.band.key, o.bonusMonths, o.raisePct, promoteRec(e).t]; })); toast("ส่งออกสรุปสิ้นปีแล้ว", "fileExcel"); }}><Icon name="download" size={14} />Export</button>
            </div>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", marginBottom: 14 }}>
              {[["แนะนำเลื่อนตำแหน่ง", ranked.filter((e) => promoteRec(e).t === "แนะนำเลื่อนตำแหน่ง").length, "#16a34a"], ["ดาวเด่น", ranked.filter((e) => promoteRec(e).t.startsWith("ดาวเด่น")).length, "#0d9488"], ["ได้โบนัส", ranked.filter((e) => window.evalOutcome(e.overall, e.warnings).bonusEligible).length, "#e08a00"], ["ได้ปรับเงิน", ranked.filter((e) => window.evalOutcome(e.overall, e.warnings).raiseEligible).length, "#2563eb"], ["ต้องพัฒนา (PIP)", ranked.filter((e) => promoteRec(e).t.startsWith("ต้องพัฒนา")).length, "#e11d48"]].map(([l, n, c]) => (
                <Stat key={l} icon="trophy" label={l} value={n} unit="คน" tone={c} soft={c + "18"} />
              ))}
            </div>
            <div className="tbl-wrap"><table className="tbl" style={{ fontSize: 12.5 }}>
              <thead><tr><th>#</th><th>พนักงาน</th><th>ผลงาน/KPI (70%)</th><th>สมรรถนะ (30%)</th><th>คะแนนรวม</th><th>เกรด</th><th>โบนัส</th><th>ปรับเงิน</th><th style={{ minWidth: 150 }}>คำแนะนำ (Year-End)</th></tr></thead>
              <tbody>{ranked.map((e, i) => { const o = window.evalOutcome(e.overall, e.warnings); const pr = promoteRec(e); return (
                <tr key={e.id} style={{ cursor: "pointer" }} onClick={() => ctx.openEmp(e.id)}>
                  <td className="num muted">{i + 1}</td>
                  <td><div className="row" style={{ gap: 9 }}><Avatar name={e.name} initials={e.initials} color={e.color} size={30} /><div><div style={{ fontWeight: 600 }}>{e.name}</div><div className="muted" style={{ fontSize: 11 }}>{deptShort(e.dept)} · {e.position}</div></div></div></td>
                  <td className="num">{(e.eval && e.eval.a_score != null) ? e.eval.a_score : e.kpi}</td><td className="num">{(e.eval && e.eval.b_score != null) ? e.eval.b_score : e.comp}</td>
                  <td><span className="num" style={{ fontWeight: 700, color: e.band.color }}>{e.overall}</span></td>
                  <td><span className="badge" style={{ background: e.band.color + "22", color: e.band.color, fontWeight: 700 }}>{e.band.key}</span></td>
                  <td className="num">{o.bonusEligible ? o.bonusMonths + " เท่า" : "—"}</td>
                  <td className="num" style={{ color: o.raiseEligible ? "#16a34a" : "var(--text-3)" }}>{o.raiseEligible ? "+" + o.raisePct + "%" : "—"}</td>
                  <td><span style={{ fontWeight: 600, color: pr.c, fontSize: 12.5 }}>{pr.t}</span></td>
                </tr>); })}</tbody>
            </table></div>
          </div>
        )}
      </Card>
    </div>
  );
}

function TalentRow({ e, onClick, tone }) {
  return (
    <button onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, border: "1px solid var(--border)", background: "var(--surface)", borderRadius: 11, padding: "10px 13px", cursor: "pointer", textAlign: "left" }}>
      <Avatar name={e.name} initials={e.initials} color={e.color} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 13.5 }}>{e.name}</div><div className="muted" style={{ fontSize: 12 }}>{deptShort(e.dept)} · {e.position}</div></div>
      <span className="num" style={{ fontWeight: 700, color: tone, fontSize: 16 }}>{e.overall}</span>
    </button>
  );
}

function ForcedRankBars({ emps }) {
  const bands = [
    { key: "A+", label: "ดีเยี่ยม (95-100)", color: "#15803d", min: 95 },
    { key: "A", label: "ดีมาก (90-94)", color: "#16a34a", min: 90 },
    { key: "B+", label: "ดี (85-89)", color: "#0d9488", min: 85 },
    { key: "B", label: "ค่อนข้างดี (80-84)", color: "#0891b2", min: 80 },
    { key: "C", label: "ตามเป้า (70-79)", color: "#2563eb", min: 70 },
    { key: "D", label: "ต้องพัฒนา (<70)", color: "#e11d48", min: 0 },
  ];
  const counts = bands.map((b, i) => {
    const max = i === 0 ? 200 : bands[i - 1].min;
    return emps.filter((e) => e.overall >= b.min && e.overall < max).length;
  });
  const total = emps.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {bands.map((b, i) => (
        <div key={b.key}>
          <div className="between" style={{ marginBottom: 5, fontSize: 13 }}><span>{b.label}</span><span className="mono muted">{counts[i]} คน · {Math.round(counts[i]/total*100)}%</span></div>
          <div className="pbar" style={{ height: 9 }}><span style={{ width: counts[i]/total*100 + "%", background: b.color }} /></div>
        </div>
      ))}
    </div>
  );
}

/* =========================================================
   CALIBRATION
   ========================================================= */
function Calibration({ ctx }) {
  const [tab, setTab] = useS4("matrix");
  const tabs = [
    { id: "matrix", label: "Talent Matrix" },
    { id: "compare", label: "เทียบระหว่างแผนก" },
    { id: "forced", label: "Forced Ranking" },
    { id: "successor", label: "ผู้สืบทอดตำแหน่ง" },
  ];
  const successors = [
    { role: "ผู้จัดการฝ่ายผลิต", current: "สมชาย ศรีสุข", ready: [{ id: "E1001", t: "พร้อมทันที" }, { id: "E1004", t: "1-2 ปี" }] },
    { role: "ผู้จัดการแผนก QC", current: "สุดารัตน์ วงศ์ทอง", ready: [{ id: "E1006", t: "พร้อมทันที" }] },
    { role: "ผู้จัดการ R&D", current: "กนกวรรณ มั่นคง", ready: [{ id: "E1018", t: "1-2 ปี" }] },
  ];

  return (
    <div className="grid">
      <div className="page-head">
        <div><h1>Calibration & Talent Review</h1><p>ปรับเทียบคะแนนให้เป็นมาตรฐานเดียวกัน และวางแผนผู้สืบทอดตำแหน่ง</p></div>
        <button className="btn btn-pri" onClick={() => toast("เปิดรอบ Calibration ใหม่", "calibration")}><Icon name="calibration" size={16} />เริ่ม Calibration</button>
      </div>

      <Card><div style={{ padding: "0 8px" }}><Tabs tabs={tabs} active={tab} onChange={setTab} /></div>

        {tab === "matrix" && (
          <div className="card-pad fade-up">
            <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>ใช้ในที่ประชุม Calibration เพื่อพิจารณาตำแหน่งของพนักงานร่วมกัน · ลากเพื่อปรับกลุ่ม (เดโม: คลิกเพื่อดู)</p>
            <NineBox emps={EMPLOYEES} onPick={ctx.openEmp} />
          </div>
        )}

        {tab === "compare" && (
          <div className="card-pad fade-up">
            <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>เปรียบเทียบค่าเฉลี่ยคะแนนระหว่างหน่วยงานก่อน-หลังปรับเทียบ</p>
            <BarChart data={DEPARTMENTS} baseline={SUMMARY.avgScore} />
            <div className="row wrap" style={{ gap: 18, marginTop: 16, justifyContent: "center" }}>
              <span className="row" style={{ gap: 7, fontSize: 12.5 }}><span style={{ width: 14, height: 0, borderTop: "1.5px dashed #e11d48" }} />ค่าเฉลี่ยองค์กร {SUMMARY.avgScore}</span>
            </div>
          </div>
        )}

        {tab === "forced" && (
          <div className="card-pad fade-up grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <b style={{ display: "block", marginBottom: 12 }}>การกระจายปัจจุบัน</b>
              <ForcedRankBars emps={EMPLOYEES} />
            </div>
            <div>
              <b style={{ display: "block", marginBottom: 12 }}>เป้าหมายการกระจาย (Bell Curve)</b>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[["ดีเยี่ยม", 10, "#16a34a"], ["ดีมาก", 20, "#0d9488"], ["ตามเป้า", 40, "#2563eb"], ["ต้องพัฒนา", 20, "#e08a00"], ["ต่ำกว่าเกณฑ์", 10, "#e11d48"]].map(([l, p, c]) => (
                  <div key={l}><div className="between" style={{ marginBottom: 5, fontSize: 13 }}><span>{l}</span><span className="mono muted">{p}%</span></div><div className="pbar" style={{ height: 9 }}><span style={{ width: p + "%", background: c }} /></div></div>
                ))}
              </div>
              <div className="row" style={{ gap: 10, background: "var(--amber-soft)", borderRadius: 10, padding: "11px 14px", marginTop: 16 }}>
                <Icon name="alert" size={17} color="#b45309" /><span style={{ fontSize: 12.5, color: "#b45309" }}>กลุ่ม "ดีเยี่ยม" สูงกว่าเป้า 4% แนะนำปรับเทียบในที่ประชุม</span>
              </div>
            </div>
          </div>
        )}

        {tab === "successor" && (
          <div className="card-pad fade-up" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>แผนผู้สืบทอดตำแหน่งสำคัญ (Succession Planning)</p>
            {successors.map((s, i) => (
              <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
                <div className="between wrap" style={{ gap: 12 }}>
                  <div>
                    <div className="row" style={{ gap: 9 }}><Icon name="briefcase" size={17} color="#2563eb" /><b style={{ fontSize: 15 }}>{s.role}</b></div>
                    <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>ปัจจุบัน: {s.current}</div>
                  </div>
                  <Badge cls="b-blue" dot>{s.ready.length} ผู้สืบทอด</Badge>
                </div>
                <div className="row wrap" style={{ gap: 10, marginTop: 14 }}>
                  {s.ready.map((r) => {
                    const e = EMPLOYEES.find((x) => x.id === r.id);
                    if (!e) return null;
                    return (
                      <button key={r.id} onClick={() => ctx.openEmp(e.id)} className="row" style={{ gap: 10, border: "1px solid var(--border)", borderRadius: 999, padding: "6px 14px 6px 6px", background: "var(--surface)", cursor: "pointer" }}>
                        <Avatar name={e.name} initials={e.initials} color={e.color} size={32} />
                        <div style={{ textAlign: "left" }}><div style={{ fontWeight: 600, fontSize: 13 }}>{e.name}</div><div className="muted" style={{ fontSize: 11.5 }}>{r.t}</div></div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* =========================================================
   SETTINGS
   ========================================================= */
/* ---------- Add / Edit app user (permissions) ---------- */
function UserModal({ user, ctx, onClose }) {
  const isEdit = !!user;
  const [f, setF] = useS4(() => ({
    name: (user && user.name) || "", email: (user && user.email) || "",
    role: (user && user.role) || "viewer", dept: (user && user.dept) || "", active: user ? !!user.active : true,
    password: "",
  }));
  const [busy, setBusy] = useS4(false);
  const [err, setErr] = useS4("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const genPwd = () => set("password", "Bw" + Math.random().toString(36).slice(2, 8) + Math.floor(Math.random() * 90 + 10) + "!");

  const save = async () => {
    if (!f.name.trim()) { setErr("กรุณากรอกชื่อผู้ใช้"); return; }
    if (!f.email.trim()) { setErr("กรุณากรอกอีเมล"); return; }
    setErr(""); setBusy(true);
    if (isEdit) {
      // editing only updates role/dept/active (email/login are fixed)
      const { error } = await window.sb.from("app_users").update({ name: f.name.trim(), role: f.role, dept: f.dept || null, active: !!f.active }).eq("id", user.id);
      if (error) { setBusy(false); setErr("บันทึกไม่สำเร็จ: " + error.message); return; }
      await ctx.refresh(); toast("อัปเดตสิทธิ์ผู้ใช้แล้ว", "check"); onClose(); return;
    }
    // creating a NEW user → provision a real login account via the secure edge function
    if (f.password.length < 6) { setBusy(false); setErr("กรุณาตั้งรหัสผ่านอย่างน้อย 6 ตัวอักษร"); return; }
    const { data, error } = await window.sb.functions.invoke("admin-users", {
      body: { action: "create", name: f.name.trim(), email: f.email.trim(), password: f.password, role: f.role, dept: f.dept || null, active: f.active },
    });
    if (error || !data || !data.ok) { setBusy(false); setErr((data && data.error) || (error && error.message) || "สร้างบัญชีไม่สำเร็จ"); return; }
    await ctx.refresh();
    toast("สร้างบัญชี “" + f.name.trim() + "” แล้ว — ล็อกอินได้ทันที", "check");
    onClose();
  };

  return (
    <Modal title={isEdit ? "แก้ไขสิทธิ์ผู้ใช้งาน" : "เพิ่มผู้ใช้งาน"} onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button className="btn btn-pri" onClick={save} disabled={busy}><Icon name="check" size={15} />{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {err && <div style={{ padding: "10px 13px", borderRadius: 10, background: "var(--red-soft)", color: "#be123c", fontSize: 13 }}>{err}</div>}
        <div className="field"><label>ชื่อ-นามสกุล *</label><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="เช่น สมชาย ศรีสุข" /></div>
        <div className="field"><label>อีเมล (ใช้ล็อกอิน) *</label><input className="input" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="name@bestworld.co.th" disabled={isEdit} /></div>
        {!isEdit && (
          <div className="field"><label>รหัสผ่านเริ่มต้น *</label>
            <div className="row" style={{ gap: 8 }}>
              <input className="input" value={f.password} onChange={(e) => set("password", e.target.value)} placeholder="อย่างน้อย 6 ตัวอักษร" />
              <button type="button" className="btn btn-ghost btn-sm" onClick={genPwd}>สุ่ม</button>
            </div>
            <span className="muted" style={{ fontSize: 12 }}>ผู้ใช้จะล็อกอินด้วยอีเมล + รหัสนี้ได้ทันที (แนะนำให้เปลี่ยนภายหลัง)</span>
          </div>
        )}
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="field"><label>บทบาท / สิทธิ์</label><select className="select" value={f.role} onChange={(e) => set("role", e.target.value)}>{ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></div>
          <div className="field"><label>หน่วยงาน</label><select className="select" value={f.dept} onChange={(e) => set("dept", e.target.value)}><option value="">— ไม่ระบุ —</option>{(window.DEPARTMENTS || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        </div>
        <div style={{ background: "var(--surface-2)", borderRadius: 10, padding: "12px 14px" }}>
          <div className="row" style={{ gap: 8, marginBottom: 8 }}><Icon name="lock" size={15} color="var(--accent-700)" /><b style={{ fontSize: 13 }}>สิทธิ์ของบทบาท “{roleMeta(f.role).label}”</b></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {(roleMeta(f.role).perms || [roleMeta(f.role).desc]).map((p, i) => (
              <div key={i} className="row" style={{ gap: 8, fontSize: 12.5, color: "var(--text-2)" }}><Icon name="check" size={14} color="#16a34a" stroke={2.6} />{p}</div>
            ))}
          </div>
        </div>
        <label className="row" style={{ gap: 8, fontSize: 13.5, cursor: "pointer" }}><input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--accent)" }} /> เปิดใช้งานบัญชี (ปิดเพื่อระงับการเข้าถึงชั่วคราว)</label>
      </div>
    </Modal>
  );
}

/* ---------- Add / Edit competency ---------- */
function CompetencyModal({ comp, ctx, onClose }) {
  const isEdit = !!comp;
  const [name, setName] = useS4((comp && comp.name) || "");
  const [en, setEn] = useS4((comp && comp.en) || "");
  const [busy, setBusy] = useS4(false);
  const [err, setErr] = useS4("");
  const save = async () => {
    if (!name.trim()) { setErr("กรุณากรอกชื่อสมรรถนะ"); return; }
    setErr(""); setBusy(true);
    let error;
    if (isEdit) { ({ error } = await window.sb.from("competencies").update({ name: name.trim(), en: en.trim() || null }).eq("id", comp.id)); }
    else { ({ error } = await window.sb.from("competencies").insert({ id: "comp_" + Date.now().toString(36), name: name.trim(), en: en.trim() || null, sort: (window.COMPETENCIES || []).length })); }
    if (error) { setBusy(false); setErr("บันทึกไม่สำเร็จ: " + error.message); return; }
    await ctx.refresh();
    toast(isEdit ? "แก้ไขสมรรถนะแล้ว" : "เพิ่มสมรรถนะแล้ว", "check");
    onClose();
  };
  return (
    <Modal title={isEdit ? "แก้ไขสมรรถนะ" : "เพิ่มสมรรถนะหลัก"} onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button className="btn btn-pri" onClick={save} disabled={busy}><Icon name="check" size={15} />{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {err && <div style={{ padding: "10px 13px", borderRadius: 10, background: "var(--red-soft)", color: "#be123c", fontSize: 13 }}>{err}</div>}
        <div className="field"><label>ชื่อสมรรถนะ (ไทย) *</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น ความคิดสร้างสรรค์" /></div>
        <div className="field"><label>ชื่อภาษาอังกฤษ</label><input className="input" value={en} onChange={(e) => setEn(e.target.value)} placeholder="เช่น Creativity" /></div>
      </div>
    </Modal>
  );
}

function Settings({ ctx }) {
  const s = window.APP_SETTINGS || {};
  const [cycleName, setCycleName] = useS4(s.cycle_name || "รอบประเมินผลประจำปี 2569");
  const [startDate, setStartDate] = useS4(s.start_date || "2025-05-01");
  const [endDate, setEndDate] = useS4(s.end_date || "2025-06-15");
  const [evalOpen, setEvalOpen] = useS4(s.eval_open !== false);
  const [w, setW] = useS4({ kpi: s.w_kpi != null ? s.w_kpi : 50, comp: s.w_comp != null ? s.w_comp : 25, jd: s.w_jd != null ? s.w_jd : 25 });
  const [userModal, setUserModal] = useS4(null);   // false=add(via {}), object=edit, null=closed
  const [compModal, setCompModal] = useS4(null);
  const [deptModal, setDeptModal] = useS4(null);
  const [busy, setBusy] = useS4(false);
  const [tiers, setTiers] = useS4(() => JSON.parse(JSON.stringify(s.bonus_tiers || window.BONUS_TIERS_DEFAULT)));
  const setTier = (g, f, v) => setTiers((p) => ({ ...p, [g]: { ...p[g], [f]: v === "" ? 0 : Number(v) } }));
  // ลำดับสายอนุมัติ / สายบังคับบัญชา (approval workflow)
  const [stages, setStages] = useS4(() => {
    const src = (Array.isArray(s.approval_stages) && s.approval_stages.length) ? s.approval_stages : (window.DEFAULT_APPROVAL_STAGES || []);
    return JSON.parse(JSON.stringify(src));
  });
  const slug = (str) => "stage_" + Math.random().toString(36).slice(2, 7);
  const addStage = () => setStages((p) => [...p, { key: slug(), label: "" }]);
  const setStageLabel = (i, v) => setStages((p) => p.map((x, j) => j === i ? { ...x, label: v } : x));
  const delStage = (i) => setStages((p) => p.filter((_, j) => j !== i));
  const moveStage = (i, d) => setStages((p) => { const a = [...p]; const j = i + d; if (j < 0 || j >= a.length) return p; [a[i], a[j]] = [a[j], a[i]]; return a; });
  const total = w.kpi + w.comp + w.jd;
  const users = window.APP_USERS || [];
  const me = window.CURRENT_USER || {};

  const saveSettings = async () => {
    const cleanStages = stages.map((x) => ({ key: x.key || ("stage_" + Math.random().toString(36).slice(2, 7)), label: (x.label || "").trim() })).filter((x) => x.label);
    if (!cleanStages.length) { toast("ต้องมีอย่างน้อย 1 ขั้นในสายอนุมัติ", "x"); return; }
    setBusy(true);
    const { error } = await window.sb.from("app_settings").update({
      cycle_name: cycleName, start_date: startDate || null, end_date: endDate || null,
      w_kpi: w.kpi, w_comp: w.comp, w_jd: w.jd, eval_open: evalOpen, bonus_tiers: tiers,
      approval_stages: cleanStages, updated_at: new Date().toISOString(),
    }).eq("id", 1);
    setBusy(false);
    if (error) { toast("บันทึกไม่สำเร็จ: " + error.message, "x"); return; }
    await ctx.refresh();
    toast("บันทึกการตั้งค่าเรียบร้อย", "check");
  };
  // ---- ผู้ประเมินรายหน่วยงาน ----
  const evaluatorOptions = (window.EMPLOYEES || []).slice().sort((a, b) => (deptName(a.dept) + a.name).localeCompare(deptName(b.dept) + b.name, "th"));
  // ผู้ประเมินปัจจุบันของหน่วยงาน = supervisor_id ที่พบบ่อยที่สุดในหน่วยงานนั้น
  const deptEvaluator = (deptId) => {
    const counts = {};
    (window.EMPLOYEES || []).forEach((e) => { if (e.dept === deptId && e.supervisor_id) counts[e.supervisor_id] = (counts[e.supervisor_id] || 0) + 1; });
    let best = "", bn = 0; Object.entries(counts).forEach(([k, n]) => { if (n > bn) { bn = n; best = k; } });
    return best;
  };
  const setDeptEvaluator = async (deptId, empId) => {
    const ev = (window.EMPLOYEES || []).find((x) => x.id === empId);
    let q = window.sb.from("employees").update({ supervisor_id: empId || null, reviewer: ev ? ev.name : null }).eq("dept", deptId);
    if (empId) q = q.neq("id", empId); // ไม่ตั้งให้คนคนนั้นเป็นหัวหน้าของตัวเอง
    const { error } = await q;
    if (error) { toast("อัปเดตไม่สำเร็จ: " + error.message, "x"); return; }
    await ctx.refresh();
    toast(empId ? ("ตั้งผู้ประเมินของ" + deptName(deptId) + " เป็น " + (ev ? ev.name : "") + " แล้ว") : ("ล้างผู้ประเมินของ" + deptName(deptId) + "แล้ว"), "check");
  };

  const delUser = async (u) => {
    if (!window.confirm("ลบผู้ใช้ " + u.name + " และบัญชีล็อกอินออกจากระบบ?")) return;
    const { data, error } = await window.sb.functions.invoke("admin-users", { body: { action: "delete", app_user_id: u.id } });
    if (error || !data || !data.ok) { toast((data && data.error) || "ลบไม่สำเร็จ", "x"); return; }
    await ctx.refresh(); toast("ลบผู้ใช้แล้ว", "check");
  };
  const toggleUser = async (u, v) => {
    const { error } = await window.sb.from("app_users").update({ active: v }).eq("id", u.id);
    if (error) { toast("อัปเดตไม่สำเร็จ", "x"); return; }
    await ctx.refresh();
  };
  // set / reset login password — provisions a real login when the user has none yet
  const pwdUser = async (u) => {
    const hasLogin = !!u.auth_uid;
    const verb = hasLogin ? "ตั้งรหัสผ่านใหม่ให้" : "สร้างบัญชีล็อกอินให้";
    const pwd = window.prompt(verb + " " + u.name + "\nกรอกรหัสผ่าน (อย่างน้อย 6 ตัวอักษร):", "");
    if (pwd == null) return;
    if (pwd.length < 6) { toast("รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร", "x"); return; }
    const { data, error } = await window.sb.functions.invoke("admin-users", {
      body: { action: hasLogin ? "reset_password" : "provision", app_user_id: u.id, password: pwd },
    });
    if (error || !data || !data.ok) { toast((data && data.error) || "ดำเนินการไม่สำเร็จ", "x"); return; }
    await ctx.refresh();
    toast(hasLogin ? "ตั้งรหัสผ่านใหม่แล้ว" : "สร้างบัญชีล็อกอินแล้ว — ผู้ใช้ล็อกอินได้ทันที", "check");
  };
  const delComp = async (c) => {
    if (!window.confirm("ลบสมรรถนะ " + c.name + "?")) return;
    const { error } = await window.sb.from("competencies").delete().eq("id", c.id);
    if (error) { toast("ลบไม่สำเร็จ: " + error.message, "x"); return; }
    await ctx.refresh(); toast("ลบสมรรถนะแล้ว", "check");
  };
  const delDept = async (d) => {
    const nEmp = (window.EMPLOYEES || []).filter((e) => e.dept === d.id).length;
    const nKpi = (window.KPI_DEFS || []).filter((k) => k.dept === d.id).length;
    const nJd = (window.JD_LIBRARY || []).filter((j) => j.dept === d.id || j.kpi_dept === d.id).length;
    if (nEmp || nKpi || nJd) { toast(`ลบไม่ได้: หน่วยงานนี้มีพนักงาน ${nEmp} คน · KPI ${nKpi} · JD ${nJd} — ย้าย/ลบข้อมูลที่เกี่ยวข้องก่อน`, "x"); return; }
    if (!window.confirm("ลบหน่วยงาน “" + d.name + "” ออกจากระบบ?")) return;
    const { error } = await window.sb.from("departments").delete().eq("id", d.id);
    if (error) { toast("ลบไม่สำเร็จ: " + error.message, "x"); return; }
    await ctx.refresh(); toast("ลบหน่วยงานแล้ว", "check");
  };

  return (
    <div className="grid">
      <div className="page-head"><div><h1>ตั้งค่าระบบ</h1><p>กำหนดรอบประเมิน น้ำหนักคะแนน สมรรถนะ และสิทธิ์ผู้ใช้งาน</p></div></div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Card>
          <CardHead title="รอบการประเมิน" sub="กำหนดช่วงเวลาและสถานะ" />
          <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="field"><label>ชื่อรอบประเมิน</label><input className="input" value={cycleName} onChange={(e) => setCycleName(e.target.value)} /></div>
            <div className="row" style={{ gap: 12 }}>
              <div className="field" style={{ flex: 1 }}><label>เริ่มต้น</label><input className="input" type="date" value={startDate || ""} onChange={(e) => setStartDate(e.target.value)} /></div>
              <div className="field" style={{ flex: 1 }}><label>ครบกำหนด</label><input className="input" type="date" value={endDate || ""} onChange={(e) => setEndDate(e.target.value)} /></div>
            </div>
            <div className="between" style={{ border: "1px solid var(--border)", borderRadius: 11, padding: "12px 15px" }}>
              <div><div style={{ fontWeight: 600, fontSize: 13.5 }}>เปิดให้ประเมิน</div><div className="muted" style={{ fontSize: 12 }}>พนักงานสามารถส่งผลได้</div></div>
              <Toggle on={evalOpen} onChange={setEvalOpen} />
            </div>
          </div>
        </Card>

        <Card>
          <CardHead title="น้ำหนักคะแนนรวม" sub="ส่วน A + ส่วน B = 100% (ตามแบบประเมิน)" right={<Badge cls={(w.kpi + w.comp) === 100 ? "b-green" : "b-red"} dot>{w.kpi + w.comp}%</Badge>} />
          <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {[["kpi", "ส่วน A · ผลงาน/KPI (จากหน้าที่ JD + KPI หน่วยงาน)", "#2563eb"], ["comp", "ส่วน B · สมรรถนะ (Core + เฉพาะตำแหน่ง)", "#7c3aed"]].map(([k, l, c]) => (
              <div key={k}>
                <div className="between" style={{ marginBottom: 7 }}><span style={{ fontSize: 13, fontWeight: 500 }}>{l}</span><span className="mono" style={{ fontWeight: 700, color: c }}>{w[k]}%</span></div>
                <input type="range" min="0" max="100" step="5" value={w[k]} onChange={(e) => setW({ ...w, [k]: +e.target.value, jd: 0 })} style={{ width: "100%", accentColor: c }} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title="สายบังคับบัญชา / ลำดับการประเมิน" sub="ลำดับขั้นการอนุมัติผลประเมิน · จากบนลงล่าง" right={<button className="btn btn-soft btn-sm" onClick={addStage}><Icon name="plus" size={14} />เพิ่มขั้น</button>} />
          <div style={{ padding: "10px 14px" }}>
            <div style={{ fontSize: 12, background: "var(--accent-soft)", color: "var(--accent-700)", borderRadius: 9, padding: "9px 12px", marginBottom: 12, lineHeight: 1.7 }}>
              เมื่อพนักงานส่งผลประเมิน ระบบจะส่งให้อนุมัติ<b>ตามลำดับนี้</b> · ใช้ลูกศรเพื่อสลับลำดับ · ต้องมีอย่างน้อย 1 ขั้น · กด <b>“บันทึกการตั้งค่า”</b> ด้านล่างเพื่อยืนยัน
            </div>
            {stages.map((st, i) => (
              <div key={st.key || i} className="row" style={{ gap: 8, padding: "8px 4px", borderBottom: "1px solid var(--border-2)" }}>
                <span style={{ width: 26, height: 26, borderRadius: 8, background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", fontSize: 12.5, fontWeight: 700, flex: "0 0 26px" }}>{i + 1}</span>
                <input className="input" style={{ flex: 1 }} value={st.label} placeholder="เช่น ผู้จัดการฝ่าย" onChange={(e) => setStageLabel(i, e.target.value)} />
                <button className="icon-btn" style={{ width: 30, height: 30 }} title="เลื่อนขึ้น" disabled={i === 0} onClick={() => moveStage(i, -1)}><Icon name="chevUp" size={15} /></button>
                <button className="icon-btn" style={{ width: 30, height: 30 }} title="เลื่อนลง" disabled={i === stages.length - 1} onClick={() => moveStage(i, 1)}><Icon name="chevDown" size={15} /></button>
                <button className="icon-btn" style={{ width: 30, height: 30 }} title="ลบขั้น" disabled={stages.length <= 1} onClick={() => delStage(i)}><Icon name="x" size={15} color="var(--red)" /></button>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title="ผู้ประเมินรายหน่วยงาน" sub="เลือกผู้ประเมิน (หัวหน้า) ของแต่ละหน่วยงาน · เปลี่ยนแล้วอัปเดตข้อมูลพนักงานทั้งหน่วยงานทันที" />
          <div style={{ padding: "8px 12px", maxHeight: 380, overflowY: "auto" }}>
            <div style={{ fontSize: 12, background: "var(--accent-soft)", color: "var(--accent-700)", borderRadius: 9, padding: "9px 12px", margin: "4px 2px 10px", lineHeight: 1.7 }}>
              เมื่อเลือกผู้ประเมิน ระบบจะตั้งให้เป็น<b>ผู้บังคับบัญชา/ผู้ประเมิน</b>ของพนักงานทุกคนในหน่วยงานนั้นทันที และจะเป็นค่าตั้งต้นในฟอร์มประเมิน
            </div>
            {(window.DEPARTMENTS || []).map((dp) => {
              const cur = deptEvaluator(dp.id);
              return (
                <div key={dp.id} className="between" style={{ padding: "10px 8px", borderBottom: "1px solid var(--border-2)", gap: 10 }}>
                  <div className="row" style={{ gap: 10, minWidth: 0 }}>
                    <span className="tag-dot" style={{ background: dp.color, width: 11, height: 11 }} />
                    <span style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{dp.name}</span>
                  </div>
                  <select className="select" style={{ maxWidth: 280, flex: "0 1 280px" }} value={cur} onChange={(e) => setDeptEvaluator(dp.id, e.target.value)}>
                    <option value="">— ไม่กำหนด —</option>
                    {evaluatorOptions.map((o) => <option key={o.id} value={o.id}>{o.name} · {deptShort(o.dept)}{o.position ? " · " + o.position : ""}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHead title="สมรรถนะหลัก (Core Competency · B1)" sub="ใช้ประเมินเหมือนกันทั้งองค์กร · สมรรถนะเฉพาะตำแหน่ง (B2) กำหนดราย JD" right={<button className="btn btn-soft btn-sm" onClick={() => setCompModal({})}><Icon name="plus" size={14} />เพิ่ม</button>} />
          <div style={{ padding: "8px 12px" }}>
            {COMPETENCIES.map((c) => (
              <div key={c.id} className="between" style={{ padding: "11px 10px", borderBottom: "1px solid var(--border-2)" }}>
                <div className="row" style={{ gap: 10 }}><Icon name="award" size={16} color="#7c3aed" /><span style={{ fontSize: 13.5 }}>{c.name}</span><span className="muted" style={{ fontSize: 12 }}>{c.en}</span></div>
                <div className="row" style={{ gap: 4 }}>
                  <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => setCompModal(c)}><Icon name="edit" size={14} /></button>
                  <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => delComp(c)}><Icon name="x" size={15} color="var(--red)" /></button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title="สิทธิ์ผู้ใช้งาน" sub={`${users.length} ผู้ใช้ในระบบ`} right={<button className="btn btn-soft btn-sm" onClick={() => setUserModal({})}><Icon name="plus" size={14} />เพิ่มผู้ใช้</button>} />
          <div style={{ padding: "8px 12px" }}>
            <div style={{ fontSize: 12, background: "var(--accent-soft)", color: "var(--accent-700)", borderRadius: 9, padding: "9px 12px", margin: "4px 2px 10px", lineHeight: 1.7 }}>
              กำหนด<b>บทบาทและสิทธิ์</b>ของผู้ใช้แต่ละคน · สลับสวิตช์เพื่อ<b>เปิด/ปิดการเข้าถึง</b> · <Icon name="edit" size={12} /> แก้ไข · <Icon name="lock" size={12} /> รหัสผ่าน · <Icon name="x" size={12} /> ลบ
            </div>
            {users.length === 0 && <div className="muted" style={{ padding: "16px 10px", fontSize: 13 }}>ยังไม่มีผู้ใช้ — กด “เพิ่มผู้ใช้”</div>}
            {users.map((u) => {
              const rm = roleMeta(u.role);
              const isMe = !!me.email && (u.email || "").toLowerCase() === me.email.toLowerCase();
              const hasLogin = !!u.auth_uid;
              return (
                <div key={u.id} className="between" style={{ padding: "11px 10px", borderBottom: "1px solid var(--border-2)", gap: 10 }}>
                  <div className="row" style={{ gap: 11, minWidth: 0 }}>
                    <Avatar name={u.name} size={34} color={u.active ? "#2563eb" : "#94a3b8"} />
                    <div style={{ minWidth: 0 }}>
                      <div className="row" style={{ gap: 7 }}>
                        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{u.name}</span>
                        {isMe && <Badge cls="b-blue">คุณ</Badge>}
                        {!u.active && <Badge cls="b-gray">ปิดใช้งาน</Badge>}
                        {!hasLogin && <Badge cls="b-amber">ยังไม่มีบัญชีล็อกอิน</Badge>}
                      </div>
                      <div className="muted" style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}{u.dept ? " · " + deptShort(u.dept) : ""}</div>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <Badge cls={rm.cls} dot>{rm.label}</Badge>
                    <span title={isMe ? "ไม่สามารถระงับบัญชีของตนเองได้" : (u.active ? "กำลังเปิดใช้งาน — กดเพื่อระงับการเข้าถึง" : "ถูกระงับ — กดเพื่อเปิดใช้งาน")}>
                      <Toggle on={u.active} onChange={(v) => { if (isMe) { toast("ไม่สามารถระงับบัญชีของตนเองได้", "x"); return; } toggleUser(u, v); }} />
                    </span>
                    <button className="icon-btn" style={{ width: 32, height: 32 }} title={hasLogin ? "ตั้งรหัสผ่านใหม่" : "สร้างบัญชีล็อกอิน"} onClick={() => pwdUser(u)}><Icon name="lock" size={14} color={hasLogin ? "var(--text-2)" : "#d97706"} /></button>
                    <button className="icon-btn" style={{ width: 32, height: 32 }} title="แก้ไขบทบาท/ข้อมูล" onClick={() => setUserModal(u)}><Icon name="edit" size={14} /></button>
                    {!isMe && <button className="icon-btn" style={{ width: 32, height: 32 }} title="ลบผู้ใช้" onClick={() => delUser(u)}><Icon name="x" size={15} color="var(--red)" /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHead title="หน่วยงาน (Department)" sub={`${(window.DEPARTMENTS || []).length} หน่วยงาน`} right={<button className="btn btn-soft btn-sm" onClick={() => setDeptModal({})}><Icon name="plus" size={14} />เพิ่มหน่วยงาน</button>} />
          <div style={{ padding: "8px 12px", maxHeight: 320, overflowY: "auto" }}>
            {(window.DEPARTMENTS || []).map((dp) => (
              <div key={dp.id} className="between" style={{ padding: "11px 10px", borderBottom: "1px solid var(--border-2)", gap: 10 }}>
                <div className="row" style={{ gap: 10, minWidth: 0 }}>
                  <span className="tag-dot" style={{ background: dp.color, width: 11, height: 11 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{dp.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{dp.short} · {dp.head} คน · เฉลี่ย {dp.score}</div>
                  </div>
                </div>
                <div className="row" style={{ gap: 4 }}>
                  <button className="icon-btn" style={{ width: 32, height: 32 }} title="แก้ไข" onClick={() => setDeptModal(dp)}><Icon name="edit" size={14} /></button>
                  <button className="icon-btn" style={{ width: 32, height: 32 }} title="ลบหน่วยงาน" onClick={() => delDept(dp)}><Icon name="x" size={15} color="var(--red)" /></button>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHead title="เกณฑ์โบนัส & ปรับเงินเดือน" sub="กำหนดตามเกรดผลประเมิน (มีใบเตือน = ไม่ปรับเงิน)" />
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>เกรด</th><th>เกณฑ์</th><th style={{ width: 130 }}>โบนัส (เท่า)</th><th style={{ width: 130 }}>ปรับเงิน (%)</th></tr></thead>
              <tbody>
                {[["A+", "ดีเยี่ยม (95-100)", "#15803d"], ["A", "ดีมาก (90-94)", "#16a34a"], ["B+", "ดี (85-89)", "#0d9488"], ["B", "ค่อนข้างดี (80-84)", "#0891b2"], ["C", "ตามเป้า (70-79)", "#2563eb"], ["D", "ต้องพัฒนา (<70)", "#e11d48"]].map(([g, lab, c]) => (
                  <tr key={g}>
                    <td><span className="badge" style={{ background: c + "22", color: c, fontWeight: 700 }}>{g}</span></td>
                    <td className="muted" style={{ fontSize: 13 }}>{lab}</td>
                    <td><input className="input" type="number" min="0" step="0.5" value={(tiers[g] || {}).bonus ?? 0} onChange={(e) => setTier(g, "bonus", e.target.value)} style={{ padding: "6px 10px" }} /></td>
                    <td><input className="input" type="number" min="0" step="1" value={(tiers[g] || {}).raise ?? 0} onChange={(e) => setTier(g, "raise", e.target.value)} style={{ padding: "6px 10px" }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
        <button className="btn btn-ghost" onClick={() => ctx.go("dashboard")}>ยกเลิก</button>
        <button className="btn btn-pri" onClick={saveSettings} disabled={busy}><Icon name="check" size={16} />{busy ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}</button>
      </div>

      {userModal && <UserModal user={userModal.id ? userModal : null} ctx={ctx} onClose={() => setUserModal(null)} />}
      {compModal && <CompetencyModal comp={compModal.id ? compModal : null} ctx={ctx} onClose={() => setCompModal(null)} />}
      {deptModal && <DepartmentModal dep={deptModal.id ? deptModal : null} ctx={ctx} onClose={() => setDeptModal(null)} />}
    </div>
  );
}

function Toggle({ on: initial, onChange }) {
  const [on, setOn] = useS4(initial);
  return (
    <button onClick={() => { const v = !on; setOn(v); onChange && onChange(v); }} style={{ width: 46, height: 26, borderRadius: 999, border: "none", background: on ? "var(--accent)" : "#cbd5e1", position: "relative", cursor: "pointer", transition: "background .2s", flex: "0 0 46px" }}>
      <span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: 999, background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
    </button>
  );
}

Object.assign(window, { Reports, Calibration, Settings, NineBox });
