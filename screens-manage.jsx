// screens-manage.jsx — หน้าจัดการข้อมูล (Data Management) · เฉพาะ HR/Admin
// รวมงานจัดการข้อมูลที่ทำทีละคนไม่ไหว: แก้เป็นกลุ่ม, สถานะการจ้างงาน, เติมข้อมูลที่ขาด, สำรองข้อมูล
const { useState: useS6, useMemo: useM6 } = React;

const EMP_STATUS = {
  active: { label: "ทำงานอยู่", cls: "b-green" },
  resigned: { label: "ลาออก", cls: "b-gray" },
  terminated: { label: "พ้นสภาพ", cls: "b-red" },
  retired: { label: "เกษียณ", cls: "b-blue" },
};
const empStatusOf = (e) => EMP_STATUS[(e && e.employment_status) || "active"] || EMP_STATUS.active;

function DataManagement({ ctx }) {
  const role = (window.CURRENT_USER || {}).role;
  const isHR = role === "admin" || role === "hr";
  const [tab, setTab] = useS6("employees");
  const [q, setQ] = useS6("");
  const [fDept, setFDept] = useS6("all");
  const [fStatus, setFStatus] = useS6("active");
  const [sel, setSel] = useS6({});          // { [empId]: true }
  const [bulk, setBulk] = useS6(null);      // ชนิดของ modal งานกลุ่ม
  const [editEmp, setEditEmp] = useS6(null);
  const [busy, setBusy] = useS6(false);

  const ALL = window.EMPLOYEES_ALL || window.EMPLOYEES || [];
  const DEPTS = window.DEPARTMENTS || [];

  if (!isHR) {
    return (
      <div className="grid">
        <div className="page-head"><div><h1>จัดการข้อมูล</h1><p>สำหรับฝ่ายบุคคลและผู้ดูแลระบบ</p></div></div>
        <Card><div className="card-pad" style={{ textAlign: "center", padding: "40px 20px" }}>
          <span style={{ color: "var(--text-3)" }}><Icon name="lock" size={38} /></span>
          <div style={{ fontWeight: 600, marginTop: 12 }}>เฉพาะฝ่ายบุคคล (HR) และผู้ดูแลระบบ</div>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>บัญชีของคุณไม่มีสิทธิ์เข้าหน้านี้</div>
        </div></Card>
      </div>
    );
  }

  const rows = useM6(() => ALL.filter((e) => {
    const st = (e.employment_status || "active");
    if (fStatus !== "all" && st !== fStatus) return false;
    if (fDept !== "all" && e.dept !== fDept) return false;
    if (q) { const s = q.toLowerCase(); return (e.name || "").toLowerCase().includes(s) || String(e.id).includes(s) || (e.position || "").toLowerCase().includes(s); }
    return true;
  }), [ALL, q, fDept, fStatus]);

  const selIds = Object.keys(sel).filter((k) => sel[k]);
  const selCount = selIds.length;
  const allChecked = rows.length > 0 && rows.every((e) => sel[e.id]);
  const toggleAll = () => { if (allChecked) setSel({}); else { const o = {}; rows.forEach((e) => { o[e.id] = true; }); setSel(o); } };
  const toggleOne = (id) => setSel((p) => ({ ...p, [id]: !p[id] }));
  const clearSel = () => setSel({});

  const counts = {
    active: ALL.filter((e) => (e.employment_status || "active") === "active").length,
    left: ALL.filter((e) => (e.employment_status || "active") !== "active").length,
  };

  // ---- ตรวจความครบถ้วน (เฉพาะพนักงานที่ทำงานอยู่) ----
  const CHECKS = [
    { k: "birth_date", label: "วันเกิด", why: "ใช้ยืนยันตัวตนตอนดูผลประเมินด้วยตนเอง" },
    { k: "hire_date", label: "วันเข้างาน", why: "ใช้คำนวณอายุงานและสถิติ" },
    { k: "jd_id", label: "ผูก JD", why: "ใช้สร้างหัวข้อประเมินส่วน A" },
    { k: "supervisor_id", label: "ผู้ประเมิน", why: "ใช้กำหนดสายอนุมัติ" },
    { k: "email", label: "อีเมล", why: "ใช้แจ้งเตือนและบัญชีล็อกอิน" },
    { k: "phone", label: "เบอร์โทร", why: "ใช้ติดต่อ" },
  ];
  const activeEmps = ALL.filter((e) => (e.employment_status || "active") === "active");
  const missing = activeEmps.map((e) => ({ e, miss: CHECKS.filter((c) => !e[c.k]) })).filter((x) => x.miss.length);
  const missByField = CHECKS.map((c) => ({ ...c, n: activeEmps.filter((e) => !e[c.k]).length })).filter((x) => x.n > 0);

  // ---- งานกลุ่ม ----
  const runBulk = async (patch, okMsg) => {
    if (!selCount) return;
    setBusy(true);
    const { error } = await window.sb.from("employees").update(patch).in("id", selIds);
    setBusy(false);
    if (error) { toast("ไม่สำเร็จ: " + error.message, "x"); return; }
    await window.audit("แก้ไขข้อมูลพนักงานเป็นกลุ่ม", "employees", { count: selCount, patch });
    await ctx.refresh(); clearSel(); setBulk(null);
    toast(okMsg + " " + selCount + " คน", "check");
  };

  // ---- สำรองข้อมูล ----
  const TABLES = [
    { t: "employees", label: "พนักงาน" }, { t: "departments", label: "หน่วยงาน" },
    { t: "evaluations", label: "ผลการประเมิน" }, { t: "kpi_defs", label: "นิยาม KPI" },
    { t: "kpi_monthly", label: "ผล KPI รายเดือน" }, { t: "jd_library", label: "Job Description" },
    { t: "competencies", label: "สมรรถนะ" }, { t: "trainings", label: "ประวัติอบรม" },
    { t: "disciplinary", label: "ใบเตือน/วินัย" }, { t: "app_users", label: "ผู้ใช้ระบบ" },
  ];
  const [dumping, setDumping] = useS6("");
  const dumpTable = async (t, label) => {
    setDumping(t);
    const { data, error } = await window.sb.from(t).select("*");
    setDumping("");
    if (error) { toast("ดึงข้อมูลไม่สำเร็จ: " + error.message, "x"); return; }
    if (!data || !data.length) { toast("ตาราง " + label + " ยังไม่มีข้อมูล", "info"); return; }
    const cols = Object.keys(data[0]);
    const val = (v) => (v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v));
    window.downloadCSV(t + "_backup.csv", cols, data.map((r) => cols.map((c) => val(r[c]))));
    toast("ส่งออก " + label + " (" + data.length + " แถว)", "download");
  };

  const tabs = [
    { id: "employees", label: "พนักงาน & สถานะ", count: rows.length },
    { id: "missing", label: "ข้อมูลไม่ครบ", count: missing.length },
    { id: "backup", label: "สำรองข้อมูล" },
  ];

  return (
    <div className="grid">
      <div className="page-head">
        <div><h1>จัดการข้อมูล</h1><p>แก้ไขเป็นกลุ่ม · สถานะการจ้างงาน · เติมข้อมูลที่ขาด · สำรองข้อมูล</p></div>
        <button className="btn btn-pri" onClick={() => setEditEmp({})}><Icon name="plus" size={16} />เพิ่มพนักงาน</button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px,1fr))" }}>
        <Stat icon="users" label="ทำงานอยู่" value={counts.active} unit="คน" tone="#16a34a" soft="#e7f6ec" />
        <Stat icon="employee" label="ลาออก/พ้นสภาพ" value={counts.left} unit="คน" tone="#64748b" soft="#eef1f6" />
        <Stat icon="alert" label="ข้อมูลไม่ครบ" value={missing.length} unit="คน" tone="#e08a00" soft="#fdf1dc" sub={missByField.length + " ฟิลด์ที่ขาด"} />
        <Stat icon="briefcase" label="หน่วยงาน" value={DEPTS.length} tone="#2563eb" soft="#e8effb" />
      </div>

      <Card><div style={{ padding: "0 8px" }}><Tabs tabs={tabs} active={tab} onChange={setTab} /></div>

        {/* ===== พนักงาน & สถานะ ===== */}
        {tab === "employees" && (
          <div className="fade-up">
            <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 4 }}>
              <div className="row wrap" style={{ gap: 10 }}>
                <input className="input" style={{ flex: "1 1 200px", minWidth: 160 }} placeholder="ค้นหาชื่อ / รหัส / ตำแหน่ง" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหาพนักงาน" />
                <select className="select" style={{ flex: "0 1 190px" }} value={fDept} onChange={(e) => setFDept(e.target.value)} aria-label="กรองหน่วยงาน">
                  <option value="all">ทุกหน่วยงาน</option>
                  {DEPTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <select className="select" style={{ flex: "0 1 170px" }} value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="กรองสถานะการจ้าง">
                  <option value="active">ทำงานอยู่</option>
                  <option value="resigned">ลาออก</option>
                  <option value="terminated">พ้นสภาพ</option>
                  <option value="retired">เกษียณ</option>
                  <option value="all">ทุกสถานะ</option>
                </select>
              </div>

              {selCount > 0 && (
                <div className="row wrap" style={{ gap: 8, background: "var(--accent-soft)", borderRadius: 11, padding: "10px 13px" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent-700)" }}>เลือกไว้ {selCount} คน</span>
                  <div className="spacer" style={{ flex: 1 }} />
                  <button className="btn btn-ghost btn-sm" onClick={() => setBulk("dept")}><Icon name="briefcase" size={14} />ย้ายหน่วยงาน</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setBulk("sup")}><Icon name="employee" size={14} />ตั้งผู้ประเมิน</button>
                  {fStatus === "active" || fStatus === "all"
                    ? <button className="btn btn-ghost btn-sm" style={{ color: "var(--red)" }} onClick={() => setBulk("resign")}><Icon name="logout" size={14} />บันทึกพ้นสภาพ</button>
                    : <button className="btn btn-ghost btn-sm" style={{ color: "#16a34a" }} onClick={() => runBulk({ employment_status: "active", resign_date: null, resign_reason: null }, "คืนสถานะทำงานให้")}><Icon name="refresh" size={14} />คืนสถานะทำงาน</button>}
                  <button className="btn btn-ghost btn-sm" onClick={clearSel}>ล้างการเลือก</button>
                </div>
              )}
            </div>

            <div className="card-pad" style={{ paddingTop: 6, overflowX: "auto" }}>
              {rows.length === 0 ? <div className="muted" style={{ textAlign: "center", padding: "28px 0", fontSize: 13 }}>ไม่พบพนักงานตามเงื่อนไข</div> : (
                <table className="tbl" style={{ minWidth: 720, fontSize: 13 }}>
                  <thead><tr>
                    <th scope="col" style={{ width: 36 }}><input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="เลือกทั้งหมด" style={{ width: 15, height: 15, accentColor: "var(--accent)" }} /></th>
                    <th scope="col">พนักงาน</th>
                    <th scope="col">หน่วยงาน / ตำแหน่ง</th>
                    <th scope="col">ผู้ประเมิน</th>
                    <th scope="col" style={{ textAlign: "center" }}>สถานะการจ้าง</th>
                    <th scope="col" style={{ width: 44 }}></th>
                  </tr></thead>
                  <tbody>
                    {rows.slice(0, 300).map(({ ...e }) => {
                      const sm = empStatusOf(e);
                      const sup = ALL.find((x) => x.id === e.supervisor_id);
                      return (
                        <tr key={e.id} style={{ background: sel[e.id] ? "var(--accent-soft)" : undefined }}>
                          <td><input type="checkbox" checked={!!sel[e.id]} onChange={() => toggleOne(e.id)} aria-label={"เลือก " + e.name} style={{ width: 15, height: 15, accentColor: "var(--accent)" }} /></td>
                          <td>
                            <div className="row" style={{ gap: 9 }}>
                              <Avatar name={e.name} initials={e.initials} color={e.color} size={28} />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 600 }}>{e.name}</div>
                                <div className="muted mono" style={{ fontSize: 11 }}>{e.id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="muted" style={{ minWidth: 150 }}>{deptShort(e.dept)}<div style={{ fontSize: 11.5 }}>{e.position}</div></td>
                          <td className="muted">{sup ? sup.name : <span style={{ color: "var(--red)" }}>ยังไม่กำหนด</span>}</td>
                          <td style={{ textAlign: "center" }}>
                            <Badge cls={sm.cls} dot>{sm.label}</Badge>
                            {e.resign_date && <div className="muted mono" style={{ fontSize: 10.5, marginTop: 2 }}>{e.resign_date}</div>}
                          </td>
                          <td><button className="icon-btn" style={{ width: 30, height: 30 }} title="แก้ไขข้อมูล" onClick={() => setEditEmp(e)}><Icon name="edit" size={14} /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {rows.length > 300 && <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>แสดง 300 รายการแรกจาก {rows.length} — ใช้ตัวกรองเพื่อดูให้แคบลง</div>}
            </div>
          </div>
        )}

        {/* ===== ข้อมูลไม่ครบ ===== */}
        {tab === "missing" && (
          <div className="card-pad fade-up">
            {missing.length === 0 ? (
              <div style={{ textAlign: "center", padding: "34px 0" }}>
                <span style={{ color: "#16a34a" }}><Icon name="checkCircle" size={38} /></span>
                <div style={{ fontWeight: 600, marginTop: 10 }}>ข้อมูลพนักงานครบทุกคน</div>
              </div>
            ) : (<>
              <div className="row wrap" style={{ gap: 8, marginBottom: 14 }}>
                {missByField.map((f) => (
                  <span key={f.k} className="badge b-amber" title={f.why}>{f.label}: ขาด {f.n}</span>
                ))}
              </div>
              <div className="tbl-wrap" style={{ maxHeight: 460, overflowY: "auto" }}>
                <table className="tbl" style={{ fontSize: 13 }}>
                  <thead><tr>
                    <th scope="col">พนักงาน</th><th scope="col">หน่วยงาน</th>
                    <th scope="col">ข้อมูลที่ยังขาด</th><th scope="col" style={{ width: 44 }}></th>
                  </tr></thead>
                  <tbody>
                    {missing.map(({ e, miss }) => (
                      <tr key={e.id} style={{ cursor: "pointer" }} onClick={() => setEditEmp(e)} title="คลิกเพื่อเติมข้อมูล">
                        <td><div className="row" style={{ gap: 9 }}><Avatar name={e.name} initials={e.initials} color={e.color} size={26} /><div><div style={{ fontWeight: 600 }}>{e.name}</div><div className="muted mono" style={{ fontSize: 11 }}>{e.id}</div></div></div></td>
                        <td className="muted">{deptShort(e.dept)}</td>
                        <td><div className="row wrap" style={{ gap: 5 }}>{miss.map((m) => <span key={m.k} className="badge b-red" style={{ fontSize: 10.5 }}>{m.label}</span>)}</div></td>
                        <td><Icon name="chevRight" size={15} color="var(--text-3)" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>คลิกที่แถวเพื่อเปิดฟอร์มแก้ไขและเติมข้อมูลได้ทันที</div>
            </>)}
          </div>
        )}

        {/* ===== สำรองข้อมูล ===== */}
        {tab === "backup" && (
          <div className="card-pad fade-up">
            <div style={{ fontSize: 12.5, background: "var(--accent-soft)", color: "var(--accent-700)", borderRadius: 10, padding: "10px 13px", marginBottom: 14, lineHeight: 1.7 }}>
              ส่งออกข้อมูลแต่ละตารางเป็นไฟล์ CSV เพื่อเก็บสำรองหรือนำไปวิเคราะห์ต่อ · แนะนำให้สำรองก่อนแก้ไขข้อมูลจำนวนมาก
            </div>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(230px,1fr))", gap: 10 }}>
              {TABLES.map((x) => (
                <button key={x.t} className="between" onClick={() => dumpTable(x.t, x.label)} disabled={dumping === x.t}
                  style={{ border: "1px solid var(--border)", borderRadius: 11, padding: "12px 15px", background: "var(--surface)", cursor: "pointer", gap: 10, textAlign: "left" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text)" }}>{x.label}</div>
                    <div className="muted mono" style={{ fontSize: 11 }}>{x.t}</div>
                  </div>
                  <Icon name="download" size={16} color={dumping === x.t ? "var(--text-3)" : "var(--accent)"} />
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {editEmp && <EmployeeModal emp={editEmp.id ? editEmp : null} ctx={ctx} onClose={() => setEditEmp(null)} />}
      {bulk && <BulkModal kind={bulk} count={selCount} ctx={ctx} busy={busy} onRun={runBulk} onClose={() => setBulk(null)} />}
    </div>
  );
}

/* ---------- งานกลุ่ม: ย้ายหน่วยงาน / ตั้งผู้ประเมิน / บันทึกพ้นสภาพ ---------- */
function BulkModal({ kind, count, busy, onRun, onClose }) {
  const [dept, setDept] = useS6("");
  const [sup, setSup] = useS6("");
  const [status, setStatus] = useS6("resigned");
  const [date, setDate] = useS6(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useS6("");
  const emps = (window.EMPLOYEES || []).slice().sort((a, b) => (a.name || "").localeCompare(b.name || "", "th"));

  const title = kind === "dept" ? "ย้ายหน่วยงาน" : kind === "sup" ? "ตั้งผู้ประเมิน" : "บันทึกพ้นสภาพการเป็นพนักงาน";
  const submit = () => {
    if (kind === "dept") { if (!dept) { toast("กรุณาเลือกหน่วยงาน", "x"); return; } onRun({ dept }, "ย้ายหน่วยงานให้"); }
    else if (kind === "sup") {
      if (!sup) { toast("กรุณาเลือกผู้ประเมิน", "x"); return; }
      const p = emps.find((x) => x.id === sup);
      onRun({ supervisor_id: sup, reviewer: p ? p.name : null }, "ตั้งผู้ประเมินให้");
    } else {
      if (!date) { toast("กรุณาระบุวันที่", "x"); return; }
      onRun({ employment_status: status, resign_date: date, resign_reason: reason.trim() || null, status: "pending" }, "บันทึกพ้นสภาพ");
    }
  };

  return (
    <Modal title={title + " · " + count + " คน"} onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button className="btn btn-pri" onClick={submit} disabled={busy}><Icon name="check" size={15} />{busy ? "กำลังบันทึก…" : "ยืนยัน"}</button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {kind === "dept" && (
          <div className="field"><label>ย้ายไปหน่วยงาน *</label>
            <select className="select" value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">— เลือกหน่วยงาน —</option>
              {(window.DEPARTMENTS || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <span className="muted" style={{ fontSize: 12 }}>ผู้ประเมินเดิมจะยังคงอยู่ — ตั้งใหม่ได้จากเมนู “ตั้งผู้ประเมิน”</span>
          </div>
        )}
        {kind === "sup" && (
          <div className="field"><label>ผู้ประเมิน (หัวหน้า) *</label>
            <select className="select" value={sup} onChange={(e) => setSup(e.target.value)}>
              <option value="">— เลือกผู้ประเมิน —</option>
              {emps.map((o) => <option key={o.id} value={o.id}>{o.name} · {deptShort(o.dept)}</option>)}
            </select>
          </div>
        )}
        {kind === "resign" && (<>
          <div style={{ fontSize: 12.5, background: "var(--red-soft)", color: "#be123c", borderRadius: 10, padding: "10px 13px", lineHeight: 1.7 }}>
            พนักงานที่บันทึกพ้นสภาพจะ<b>ไม่ถูกนับในสถิติและรายชื่อประเมิน</b> แต่ข้อมูลและประวัติยังเก็บไว้ครบ · คืนสถานะได้ภายหลัง
          </div>
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="field"><label>ประเภท</label>
              <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="resigned">ลาออก</option><option value="terminated">พ้นสภาพ/เลิกจ้าง</option><option value="retired">เกษียณ</option>
              </select>
            </div>
            <div className="field"><label>วันที่มีผล *</label><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          <div className="field"><label>เหตุผล (ถ้ามี)</label><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เช่น ย้ายถิ่นฐาน / หางานใหม่" /></div>
        </>)}
      </div>
    </Modal>
  );
}

Object.assign(window, { DataManagement, empStatusOf, EMP_STATUS });
