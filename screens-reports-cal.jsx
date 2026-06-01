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
  ];

  return (
    <div className="grid">
      <div className="page-head">
        <div><h1>รายงานและการวิเคราะห์</h1><p>รายงานเชิงลึกสำหรับ HR และผู้บริหาร · {COMPANY.cycle}</p></div>
        <div className="row wrap" style={{ gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => toast("กำลังสร้างไฟล์ PDF…", "file")}><Icon name="file" size={16} />PDF</button>
          <button className="btn btn-pri" onClick={() => toast("กำลังสร้างไฟล์ Excel…", "fileExcel")}><Icon name="download" size={16} />Export Excel</button>
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
    { key: "A", label: "ดีเยี่ยม (90+)", color: "#16a34a", min: 90 },
    { key: "B", label: "ดีมาก (80-89)", color: "#0d9488", min: 80 },
    { key: "C", label: "ตามเป้า (70-79)", color: "#2563eb", min: 70 },
    { key: "D", label: "ต้องพัฒนา (60-69)", color: "#e08a00", min: 60 },
    { key: "E", label: "ต่ำกว่าเกณฑ์ (<60)", color: "#e11d48", min: 0 },
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
function Settings({ ctx }) {
  const [w, setW] = useS4({ kpi: 50, comp: 25, jd: 25 });
  const total = w.kpi + w.comp + w.jd;
  return (
    <div className="grid">
      <div className="page-head"><div><h1>ตั้งค่าระบบ</h1><p>กำหนดรอบประเมิน น้ำหนักคะแนน สมรรถนะ และสิทธิ์ผู้ใช้งาน</p></div></div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Card>
          <CardHead title="รอบการประเมิน" sub="กำหนดช่วงเวลาและสถานะ" />
          <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="field"><label>ชื่อรอบประเมิน</label><input className="input" defaultValue="รอบประเมินผลประจำปี 2568" /></div>
            <div className="row" style={{ gap: 12 }}>
              <div className="field" style={{ flex: 1 }}><label>เริ่มต้น</label><input className="input" type="date" defaultValue="2025-05-01" /></div>
              <div className="field" style={{ flex: 1 }}><label>ครบกำหนด</label><input className="input" type="date" defaultValue="2025-06-15" /></div>
            </div>
            <div className="between" style={{ border: "1px solid var(--border)", borderRadius: 11, padding: "12px 15px" }}>
              <div><div style={{ fontWeight: 600, fontSize: 13.5 }}>เปิดให้ประเมิน</div><div className="muted" style={{ fontSize: 12 }}>พนักงานสามารถส่งผลได้</div></div>
              <Toggle on />
            </div>
          </div>
        </Card>

        <Card>
          <CardHead title="น้ำหนักคะแนนรวม" sub="ผลรวมต้องเท่ากับ 100%" right={<Badge cls={total === 100 ? "b-green" : "b-red"} dot>{total}%</Badge>} />
          <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {[["kpi", "KPI", "#2563eb"], ["comp", "Competency", "#7c3aed"], ["jd", "JD-Based", "#0d9488"]].map(([k, l, c]) => (
              <div key={k}>
                <div className="between" style={{ marginBottom: 7 }}><span style={{ fontSize: 13.5, fontWeight: 500 }}>{l}</span><span className="mono" style={{ fontWeight: 700, color: c }}>{w[k]}%</span></div>
                <input type="range" min="0" max="100" step="5" value={w[k]} onChange={(e) => setW({ ...w, [k]: +e.target.value })} style={{ width: "100%", accentColor: c }} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title="สมรรถนะหลัก (Competency)" sub="หัวข้อที่ใช้ประเมินทั้งองค์กร" right={<button className="btn btn-soft btn-sm"><Icon name="plus" size={14} />เพิ่ม</button>} />
          <div style={{ padding: "8px 12px" }}>
            {COMPETENCIES.map((c) => (
              <div key={c.id} className="between" style={{ padding: "11px 10px", borderBottom: "1px solid var(--border-2)" }}>
                <div className="row" style={{ gap: 10 }}><Icon name="award" size={16} color="#7c3aed" /><span style={{ fontSize: 13.5 }}>{c.name}</span><span className="muted" style={{ fontSize: 12 }}>{c.en}</span></div>
                <button className="icon-btn" style={{ width: 32, height: 32 }}><Icon name="edit" size={14} /></button>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title="สิทธิ์ผู้ใช้งาน" sub="บทบาทในระบบ" right={<button className="btn btn-soft btn-sm"><Icon name="plus" size={14} />เพิ่มผู้ใช้</button>} />
          <div style={{ padding: "8px 12px" }}>
            {[["ผู้ดูแลระบบ HR", "เข้าถึงทุกฟังก์ชัน", "b-blue", 3], ["ผู้จัดการฝ่าย", "ประเมินและอนุมัติทีม", "b-teal", 9], ["หัวหน้างาน", "ประเมินผู้ใต้บังคับบัญชา", "b-green", 18], ["พนักงานทั่วไป", "ดูผลและประเมินตนเอง", "b-gray", 211]].map(([r, d, c, n]) => (
              <div key={r} className="between" style={{ padding: "11px 10px", borderBottom: "1px solid var(--border-2)" }}>
                <div><div style={{ fontWeight: 600, fontSize: 13.5 }}>{r}</div><div className="muted" style={{ fontSize: 12 }}>{d}</div></div>
                <Badge cls={c}>{n} คน</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
        <button className="btn btn-ghost">ยกเลิก</button>
        <button className="btn btn-pri" onClick={() => toast("บันทึกการตั้งค่าเรียบร้อย", "check")}><Icon name="check" size={16} />บันทึกการตั้งค่า</button>
      </div>
    </div>
  );
}

function Toggle({ on: initial }) {
  const [on, setOn] = useS4(initial);
  return (
    <button onClick={() => setOn(!on)} style={{ width: 46, height: 26, borderRadius: 999, border: "none", background: on ? "var(--accent)" : "#cbd5e1", position: "relative", cursor: "pointer", transition: "background .2s", flex: "0 0 46px" }}>
      <span style={{ position: "absolute", top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: 999, background: "#fff", transition: "left .2s", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
    </button>
  );
}

Object.assign(window, { Reports, Calibration, Settings, NineBox });
