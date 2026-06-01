// screens-people.jsx — Employee list, Employee profile, Department KPI
const { useState: useS2, useMemo: useM2 } = React;

/* =========================================================
   ADD / EDIT EMPLOYEE modal (writes to Supabase)
   ========================================================= */
function EmployeeModal({ emp, ctx, onClose }) {
  const isEdit = !!emp;
  const [f, setF] = useS2(() => ({
    name: (emp && emp.name) || "", dept: (emp && emp.dept) || (DEPARTMENTS[0] ? DEPARTMENTS[0].id : "prod"),
    position: (emp && emp.position) || "", level: (emp && emp.level) || "ปฏิบัติการ",
    tenure: (emp && emp.tenure) || "", email: (emp && emp.email) || "", phone: (emp && emp.phone) || "",
    status: (emp && emp.status) || "pending", kpi: emp ? emp.kpi : "", comp: emp ? emp.comp : "",
    potential: emp ? emp.potential : 2, perf: emp ? emp.perf : 2, reviewer: (emp && emp.reviewer) || "",
    female: emp ? !!emp.female : false,
  }));
  const [busy, setBusy] = useS2(false);
  const [err, setErr] = useS2("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const palette = ["#2563eb", "#0d9488", "#7c3aed", "#db2777", "#0ea5e9", "#e08a00", "#16a34a"];
  const nextId = () => {
    const nums = (window.EMPLOYEES || []).map((x) => parseInt(String(x.id).replace(/\D/g, ""), 10)).filter((n) => !isNaN(n));
    return "E" + String((nums.length ? Math.max(...nums) : 999) + 1);
  };

  const save = async () => {
    if (!f.name.trim()) { setErr("กรุณากรอกชื่อ-นามสกุล"); return; }
    if (!f.position.trim()) { setErr("กรุณากรอกตำแหน่ง"); return; }
    setErr(""); setBusy(true);
    const row = {
      name: f.name.trim(), female: !!f.female, dept: f.dept, position: f.position.trim(),
      level: f.level, tenure: f.tenure || null, email: f.email.trim() || null, phone: f.phone.trim() || null,
      status: f.status, kpi: Number(f.kpi) || 0, comp: Number(f.comp) || 0,
      potential: Number(f.potential) || 1, perf: Number(f.perf) || 1, reviewer: f.reviewer || null,
    };
    let error;
    if (isEdit) {
      ({ error } = await window.sb.from("employees").update(row).eq("id", emp.id));
    } else {
      row.id = nextId();
      row.color = palette[(window.EMPLOYEES || []).length % 7];
      row.history = [];
      row.sort = (window.EMPLOYEES || []).length;
      ({ error } = await window.sb.from("employees").insert(row));
    }
    if (error) { setBusy(false); setErr("บันทึกไม่สำเร็จ: " + error.message); return; }
    await ctx.refresh();
    toast(isEdit ? "บันทึกข้อมูลพนักงานแล้ว" : "เพิ่มพนักงาน “" + f.name.trim() + "” แล้ว", "check");
    onClose();
  };

  return (
    <Modal title={isEdit ? "แก้ไขข้อมูลพนักงาน" : "เพิ่มพนักงานใหม่"} onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button className="btn btn-pri" onClick={save} disabled={busy}><Icon name="check" size={15} />{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {err && <div style={{ padding: "10px 13px", borderRadius: 10, background: "var(--red-soft)", color: "#be123c", fontSize: 13 }}>{err}</div>}
        <div className="field"><label>ชื่อ-นามสกุล *</label><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="เช่น สมชาย ศรีสุข" /></div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="field"><label>หน่วยงาน</label><select className="select" value={f.dept} onChange={(e) => set("dept", e.target.value)}>{(window.DEPARTMENTS || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div className="field"><label>ระดับ</label><select className="select" value={f.level} onChange={(e) => set("level", e.target.value)}>{["ผู้จัดการ", "หัวหน้างาน", "วิชาชีพ", "ปฏิบัติการ"].map((l) => <option key={l} value={l}>{l}</option>)}</select></div>
        </div>
        <div className="field"><label>ตำแหน่ง *</label><input className="input" value={f.position} onChange={(e) => set("position", e.target.value)} placeholder="เช่น หัวหน้าแผนกฉีดพลาสติก" /></div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="field"><label>อีเมล</label><input className="input" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="name@bestworld.co.th" /></div>
          <div className="field"><label>เบอร์โทร</label><input className="input" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="08xxxxxxxx" /></div>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="field"><label>อายุงาน</label><input className="input" value={f.tenure} onChange={(e) => set("tenure", e.target.value)} placeholder="เช่น 3 ปี 4 เดือน" /></div>
          <div className="field"><label>สถานะการประเมิน</label><select className="select" value={f.status} onChange={(e) => set("status", e.target.value)}>{[["pending", "รอประเมิน"], ["progress", "กำลังประเมิน"], ["review", "รออนุมัติ"], ["done", "ประเมินแล้ว"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
          <div className="field"><label>คะแนน KPI</label><input className="input" type="number" value={f.kpi} onChange={(e) => set("kpi", e.target.value)} placeholder="0-100" /></div>
          <div className="field"><label>Competency</label><input className="input" type="number" value={f.comp} onChange={(e) => set("comp", e.target.value)} placeholder="0-100" /></div>
          <div className="field"><label>ศักยภาพ</label><select className="select" value={f.potential} onChange={(e) => set("potential", +e.target.value)}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
          <div className="field"><label>ผลงาน</label><select className="select" value={f.perf} onChange={(e) => set("perf", +e.target.value)}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}</select></div>
        </div>
        <div className="field"><label>ผู้ประเมิน (หัวหน้า)</label><input className="input" value={f.reviewer} onChange={(e) => set("reviewer", e.target.value)} placeholder="ชื่อผู้บังคับบัญชา" /></div>
        <label className="row" style={{ gap: 8, fontSize: 13.5, cursor: "pointer" }}><input type="checkbox" checked={f.female} onChange={(e) => set("female", e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--accent)" }} /> เพศหญิง</label>
      </div>
    </Modal>
  );
}

/* =========================================================
   EMPLOYEE LIST
   ========================================================= */
function EmployeeList({ ctx }) {
  const [q, setQ] = useS2("");
  const [dept, setDept] = useS2("all");
  const [status, setStatus] = useS2("all");
  const [view, setView] = useS2("table");
  const [showAdd, setShowAdd] = useS2(false);

  const rows = useM2(() => EMPLOYEES.filter((e) =>
    (dept === "all" || e.dept === dept) &&
    (status === "all" || e.status === status) &&
    (q === "" || e.name.includes(q) || e.position.includes(q) || e.id.includes(q))
  ), [q, dept, status]);

  const counts = { all: EMPLOYEES.length, done: 0, pending: 0, review: 0, progress: 0 };
  EMPLOYEES.forEach((e) => counts[e.status]++);

  return (
    <div className="grid">
      <div className="page-head">
        <div><h1>พนักงาน</h1><p>รายชื่อพนักงานและสถานะการประเมินทั้งหมด {EMPLOYEES.length} คน</p></div>
        <div className="row wrap" style={{ gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => { downloadCSV("employees.csv", ["รหัส", "ชื่อ", "หน่วยงาน", "ตำแหน่ง", "สถานะ", "KPI", "Competency", "คะแนนรวม"], rows.map((e) => [e.id, e.name, deptName(e.dept), e.position, (statusMeta(e.status) || {}).label || e.status, e.kpi, e.comp, e.overall])); toast("ส่งออกรายชื่อ " + rows.length + " คนแล้ว", "fileExcel"); }}><Icon name="download" size={16} />Export</button>
          <button className="btn btn-pri" onClick={() => setShowAdd(true)}><Icon name="plus" size={16} />เพิ่มพนักงาน</button>
        </div>
      </div>
      {showAdd && <EmployeeModal emp={null} ctx={ctx} onClose={() => setShowAdd(false)} />}

      {/* filter bar */}
      <Card className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="row wrap" style={{ gap: 12 }}>
          <div className="search" style={{ flex: 1, minWidth: 220 }}>
            <Icon name="search" size={18} />
            <input placeholder="ค้นหาชื่อ ตำแหน่ง หรือรหัสพนักงาน…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="select" style={{ width: "auto", minWidth: 170 }} value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="all">ทุกหน่วยงาน</option>
            {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <div className="seg hide-xs">
            <button className={view === "table" ? "on" : ""} onClick={() => setView("table")}><Icon name="list" size={16} /></button>
            <button className={view === "grid" ? "on" : ""} onClick={() => setView("grid")}><Icon name="grid" size={16} /></button>
          </div>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          {[["all","ทั้งหมด"],["done","ประเมินแล้ว"],["progress","กำลังประเมิน"],["review","รออนุมัติ"],["pending","รอประเมิน"]].map(([k, l]) => (
            <button key={k} className={"chip" + (status === k ? " on" : "")} onClick={() => setStatus(k)}>{l}<span className="mono" style={{ opacity: .7 }}>{counts[k]}</span></button>
          ))}
        </div>
      </Card>

      {view === "table" ? (
        <Card>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr>
                <th>พนักงาน</th><th>หน่วยงาน</th><th>อายุงาน</th><th>สถานะ</th><th>KPI</th><th>Competency</th><th>คะแนนรวม</th><th></th>
              </tr></thead>
              <tbody>
                {rows.map((e) => {
                  const sm = statusMeta(e.status);
                  return (
                    <tr key={e.id} style={{ cursor: "pointer" }} onClick={() => ctx.openEmp(e.id)}>
                      <td>
                        <div className="row" style={{ gap: 11 }}>
                          <Avatar name={e.name} initials={e.initials} color={e.color} size={38} />
                          <div><div style={{ fontWeight: 600, fontSize: 13.5 }}>{e.name}</div><div className="muted" style={{ fontSize: 12 }}>{e.position}</div></div>
                        </div>
                      </td>
                      <td><Badge cls="b-gray">{deptShort(e.dept)}</Badge></td>
                      <td className="muted" style={{ fontSize: 13 }}>{e.tenure}</td>
                      <td><Badge cls={sm.cls} dot>{sm.label}</Badge></td>
                      <td className="num" style={{ fontWeight: 600 }}>{e.kpi}</td>
                      <td className="num" style={{ fontWeight: 600 }}>{e.comp}</td>
                      <td>
                        <div className="row" style={{ gap: 8 }}>
                          <span className="num" style={{ fontWeight: 700, color: e.band.color, fontSize: 14 }}>{e.overall}</span>
                          <span className={"badge " + e.band.cls} style={{ padding: "2px 7px" }}>{e.band.key}</span>
                        </div>
                      </td>
                      <td onClick={(ev) => ev.stopPropagation()}>
                        <div className="row" style={{ gap: 4, justifyContent: "flex-end" }}>
                          <button className="icon-btn" style={{ width: 34, height: 34 }} title="ดูข้อมูล" onClick={() => ctx.openEmp(e.id)}><Icon name="eye" size={16} /></button>
                          <button className="icon-btn" style={{ width: 34, height: 34 }} title="ประเมิน" onClick={() => ctx.startEval(e.id)}><Icon name="eval" size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && <div className="card-pad muted" style={{ textAlign: "center", padding: 40 }}>ไม่พบพนักงานตามเงื่อนไข</div>}
        </Card>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
          {rows.map((e) => {
            const sm = statusMeta(e.status);
            return (
              <Card key={e.id} className="card-pad" style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: 12 }} >
                <div onClick={() => ctx.openEmp(e.id)} style={{ display: "contents" }}>
                  <div className="row" style={{ gap: 12 }}>
                    <Avatar name={e.name} initials={e.initials} color={e.color} size={48} />
                    <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name}</div><div className="muted" style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.position}</div></div>
                  </div>
                  <div className="between"><Badge cls="b-gray">{deptShort(e.dept)}</Badge><Badge cls={sm.cls} dot>{sm.label}</Badge></div>
                  <div className="between" style={{ borderTop: "1px solid var(--border-2)", paddingTop: 12 }}>
                    <div><div className="muted" style={{ fontSize: 11 }}>คะแนนรวม</div><div className="num" style={{ fontWeight: 700, fontSize: 20, color: e.band.color }}>{e.overall}</div></div>
                    <span className={"badge " + e.band.cls} dot>{e.band.label}</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   EMPLOYEE PROFILE
   ========================================================= */
function EmployeeProfile({ ctx, empId }) {
  const e = EMPLOYEES.find((x) => x.id === empId) || EMPLOYEES[0];
  const [editing, setEditing] = useS2(false);
  const yrs = ["2564","2565","2566","2567","2568"];
  const hist = e.history.map((v, i) => ({ m: yrs[yrs.length - e.history.length + i], v }));
  const radar = COMPETENCIES.map((c, i) => ({ id: c.id, name: c.name, v: Math.max(55, Math.min(98, e.comp + [4,-3,2,-5,6][i])) }));
  const sm = statusMeta(e.status);

  return (
    <div className="grid">
      <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => ctx.go("employee")}><Icon name="chevLeft" size={15} />กลับไปหน้าพนักงาน</button>

      {/* header */}
      <Card className="card-pad">
        <div className="row wrap" style={{ gap: 20 }}>
          <div style={{ position: "relative" }}>
            <div className="placeholder-img" style={{ width: 104, height: 104, borderRadius: 18 }}>รูปพนักงาน<br/>104×104</div>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="row wrap" style={{ gap: 10, marginBottom: 4 }}>
              <h1 style={{ margin: 0, fontSize: 23 }}>{e.name}</h1>
              <Badge cls={sm.cls} dot>{sm.label}</Badge>
            </div>
            <div className="muted" style={{ fontSize: 15 }}>{e.position} · {deptName(e.dept)}</div>
            <div className="row wrap" style={{ gap: 18, marginTop: 14 }}>
              {[["รหัสพนักงาน", e.id], ["ระดับ", e.level], ["อายุงาน", e.tenure], ["ผู้ประเมิน", e.reviewer]].map(([k, v]) => (
                <div key={k}><div className="muted" style={{ fontSize: 11.5 }}>{k}</div><div style={{ fontSize: 13.5, fontWeight: 600 }}>{v}</div></div>
              ))}
            </div>
          </div>
          <div className="row wrap" style={{ gap: 9, alignSelf: "flex-start" }}>
            <button className="btn btn-ghost" onClick={() => { downloadCSV("employee_" + e.id + ".csv", ["รหัส", "ชื่อ", "หน่วยงาน", "ตำแหน่ง", "ระดับ", "อายุงาน", "สถานะ", "KPI", "Competency", "คะแนนรวม", "ผู้ประเมิน"], [[e.id, e.name, deptName(e.dept), e.position, e.level, e.tenure, (statusMeta(e.status) || {}).label || e.status, e.kpi, e.comp, e.overall, e.reviewer]]); toast("ส่งออกข้อมูลพนักงานแล้ว", "download"); }}><Icon name="download" size={16} />Export</button>
            <button className="btn btn-ghost" onClick={() => setEditing(true)}><Icon name="edit" size={16} />แก้ไข</button>
            <button className="btn btn-pri" onClick={() => ctx.startEval(e.id)}><Icon name="eval" size={16} />ประเมินผล</button>
          </div>
        </div>
      </Card>
      {editing && <EmployeeModal emp={e} ctx={ctx} onClose={() => setEditing(false)} />}

      <div className="grid" style={{ gridTemplateColumns: "320px 1fr" }}>
        {/* left column */}
        <div className="grid">
          <Card>
            <CardHead title="คะแนนรวม" sub={COMPANY.cycle} />
            <div className="card-pad" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <Ring value={e.overall} size={150} label={e.band.label} />
              <div className="row" style={{ gap: 0, width: "100%", textAlign: "center" }}>
                <div style={{ flex: 1 }}><div className="num" style={{ fontWeight: 700, fontSize: 20, color: "#2563eb" }}>{e.kpi}</div><div className="muted" style={{ fontSize: 12 }}>KPI (60%)</div></div>
                <div style={{ width: 1, background: "var(--border)" }} />
                <div style={{ flex: 1 }}><div className="num" style={{ fontWeight: 700, fontSize: 20, color: "#7c3aed" }}>{e.comp}</div><div className="muted" style={{ fontSize: 12 }}>Competency (40%)</div></div>
              </div>
            </div>
          </Card>
          <Card>
            <CardHead title="ข้อมูลติดต่อ" />
            <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[["mail", e.email], ["phone", e.phone], ["briefcase", deptName(e.dept)], ["calendar", "เข้าทำงาน " + e.tenure + "ที่แล้ว"]].map(([ic, v]) => (
                <div key={ic} className="row" style={{ gap: 11 }}><span style={{ color: "var(--text-3)" }}><Icon name={ic} size={17} /></span><span style={{ fontSize: 13.5 }}>{v}</span></div>
              ))}
            </div>
          </Card>
        </div>

        {/* right column */}
        <div className="grid">
          <Card>
            <CardHead title="สมรรถนะ (Competency)" sub="ผลประเมิน 5 ด้านหลัก" />
            <div className="card-pad row" style={{ gap: 20, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ flex: "0 0 250px", maxWidth: 250, margin: "0 auto" }}><Radar data={radar} size={230} /></div>
              <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 13 }}>
                {radar.map((c) => (
                  <div key={c.id}>
                    <div className="between" style={{ marginBottom: 4 }}><span style={{ fontSize: 13 }}>{c.name}</span><span className="mono" style={{ fontWeight: 600, fontSize: 13 }}>{c.v}</span></div>
                    <ScoreBar value={c.v} />
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Card>
              <CardHead title="ประวัติการประเมิน" sub="คะแนนรวมย้อนหลัง" />
              <div className="card-pad"><LineChart data={hist} height={210} min={60} /></div>
            </Card>
            <Card>
              <CardHead title="KPI หลัก" sub="ผลงานเทียบเป้าหมาย" />
              <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                {KPI_ITEMS.slice(0, 5).map((k) => (
                  <div key={k.id}>
                    <div className="between" style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 12.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "70%" }}>{k.name}</span>
                      <span className="mono" style={{ fontWeight: 600, fontSize: 12.5 }}>{k.actual}</span>
                    </div>
                    <ScoreBar value={k.score} height={6} />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   DEPARTMENT KPI
   ========================================================= */
function DepartmentKPI({ ctx }) {
  const [sel, setSel] = useS2(DEPARTMENTS[0].id);
  const d = DEPARTMENTS.find((x) => x.id === sel);
  const members = EMPLOYEES.filter((e) => e.dept === sel);
  const deptTrend = TREND.map((p, i) => ({ m: p.m, v: Math.round((p.v + d.trend * 2 + (d.score - SUMMARY.avgScore)) * 10) / 10 }));

  return (
    <div className="grid">
      <div className="page-head">
        <div><h1>KPI ตามหน่วยงาน</h1><p>เปรียบเทียบผลการดำเนินงานของแต่ละหน่วยงาน</p></div>
        <button className="btn btn-ghost" onClick={() => { downloadCSV("department_kpi.csv", ["รหัส", "หน่วยงาน", "พนักงาน", "ประเมินแล้ว", "คะแนนเฉลี่ย", "แนวโน้ม"], DEPARTMENTS.map((d) => [d.id, d.name, d.head, d.done, d.score, d.trend])); toast("ส่งออกรายงานหน่วยงานแล้ว", "download"); }}><Icon name="download" size={16} />Export</button>
      </div>

      {/* dept cards */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(215px, 1fr))" }}>
        {DEPARTMENTS.map((dep) => {
          const active = dep.id === sel;
          const pct = Math.round(dep.done / dep.head * 100);
          return (
            <button key={dep.id} onClick={() => setSel(dep.id)} className="card" style={{ textAlign: "left", cursor: "pointer", padding: 18, border: active ? "1.5px solid var(--accent)" : "1px solid var(--border)", boxShadow: active ? "0 0 0 3px var(--accent-soft)" : "var(--shadow-sm)", background: "var(--surface)" }}>
              <div className="between" style={{ marginBottom: 12 }}>
                <span className="tag-dot" style={{ background: dep.color, width: 11, height: 11 }} />
                <span className={"delta " + (dep.trend >= 0 ? "up" : "down")}><Icon name={dep.trend >= 0 ? "arrowUp" : "arrowDown"} size={12} stroke={2.6} />{Math.abs(dep.trend)}</span>
              </div>
              <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 2 }}>{dep.name}</div>
              <div className="num" style={{ fontWeight: 700, fontSize: 26, color: window.bandOf(dep.score).color }}>{dep.score}</div>
              <div className="muted" style={{ fontSize: 11.5, margin: "8px 0 5px" }}>ประเมินแล้ว {dep.done}/{dep.head} ({pct}%)</div>
              <ScoreBar value={pct} color={dep.color} height={5} />
            </button>
          );
        })}
      </div>

      {/* selected dept detail */}
      <div className="grid" style={{ gridTemplateColumns: "1.5fr 1fr" }}>
        <Card>
          <CardHead title={`แนวโน้มคะแนน · ${d.name}`} sub="ค่าเฉลี่ยหน่วยงานรายเดือน" right={<span className="tag-dot" style={{ background: d.color, width: 12, height: 12 }} />} />
          <div className="card-pad"><LineChart data={deptTrend} height={240} /></div>
        </Card>
        <Card>
          <CardHead title="KPI หลักของหน่วยงาน" />
          <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {KPI_ITEMS.slice(0, 5).map((k) => (
              <div key={k.id}>
                <div className="between" style={{ marginBottom: 5 }}>
                  <span style={{ fontSize: 13 }}>{k.name}</span>
                  <span className="mono" style={{ fontWeight: 600, fontSize: 13, color: window.bandOf(k.score).color }}>{k.score}</span>
                </div>
                <ScoreBar value={k.score} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHead title={`สมาชิกในหน่วยงาน (${members.length} คน)`} sub={d.name}
          right={<button className="btn btn-ghost btn-sm" onClick={() => ctx.go("employee")}>ดูทั้งหมด</button>} />
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>พนักงาน</th><th>ตำแหน่ง</th><th>สถานะ</th><th>KPI</th><th>Comp.</th><th>รวม</th></tr></thead>
            <tbody>
              {members.map((e) => {
                const m = statusMeta(e.status);
                return (
                  <tr key={e.id} style={{ cursor: "pointer" }} onClick={() => ctx.openEmp(e.id)}>
                    <td><div className="row" style={{ gap: 10 }}><Avatar name={e.name} initials={e.initials} color={e.color} size={34} /><span style={{ fontWeight: 600, fontSize: 13.5 }}>{e.name}</span></div></td>
                    <td className="muted" style={{ fontSize: 13 }}>{e.position}</td>
                    <td><Badge cls={m.cls} dot>{m.label}</Badge></td>
                    <td className="num">{e.kpi}</td>
                    <td className="num">{e.comp}</td>
                    <td><span className="num" style={{ fontWeight: 700, color: e.band.color }}>{e.overall}</span></td>
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

Object.assign(window, { EmployeeList, EmployeeProfile, DepartmentKPI });
