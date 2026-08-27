// hrcore-master.jsx — Dashboard · Departments (Tree) · Positions · Employment Types · Organization Chart
const { useState: useM1, useEffect: useME1 } = React;

/* ================= Dashboard (STEP 17) ================= */
function HRCDashboard({ nav }) {
  const [docs, setDocs] = useM1(null);
  useME1(() => {
    (async () => {
      const { data } = await window.sb.from("employee_documents").select("id,employee_id,document_name,expiry_date").not("expiry_date", "is", null);
      setDocs(data || []);
    })();
  }, []);

  const emps = HRC.employees || [];
  const active = emps.filter((e) => HRC.isActive(e));
  const probation = emps.filter((e) => e._status === "PROBATION");
  const now = new Date(), ym = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  const newThisMonth = emps.filter((e) => (e.hire_date || "").slice(0, 7) === ym);
  const leftThisMonth = emps.filter((e) => (e.resign_date || "").slice(0, 7) === ym);
  const expiring = (docs || []).filter((d) => ["expired", "soon"].indexOf(HRC.docStatus(d).key) > -1);

  const byDept = (HRC.departments || []).map((d) => ({
    label: d.name, n: active.filter((e) => e.dept === d.id).length, color: d.color || "#2563eb",
  })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  const byType = (HRC.employmentTypes || []).map((t, i) => ({
    label: t.name, v: active.filter((e) => e.employment_type_id === t.id).length,
    color: ["#2563eb", "#0d9488", "#7c3aed", "#e08a00", "#db2777", "#0891b2"][i % 6],
  })).filter((x) => x.v > 0);
  const maxDept = Math.max(1, ...byDept.map((x) => x.n));

  // เข้าใหม่ย้อนหลัง 6 เดือน
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    months.push({
      key, label: d.toLocaleDateString("th-TH", { month: "short" }),
      hires: emps.filter((e) => (e.hire_date || "").slice(0, 7) === key).length,
      exits: emps.filter((e) => (e.resign_date || "").slice(0, 7) === key).length,
    });
  }
  const maxFlow = Math.max(1, ...months.map((m) => Math.max(m.hires, m.exits)));

  return (
    <div className="grid">
      <Crumb items={[{ label: "HR Core" }, { label: "ภาพรวม" }]} />
      <div className="page-head">
        <div><h1>ภาพรวมข้อมูลบุคลากร</h1><p>ศูนย์กลางข้อมูลพนักงาน · BWP HR Core</p></div>
        <button className="btn btn-ghost" onClick={async () => { await HRC.load(); toast("อัปเดตข้อมูลแล้ว", "refresh"); nav("dashboard"); }}>
          <Icon name="refresh" size={16} />รีเฟรช</button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))" }}>
        <Stat icon="users" label="พนักงานทั้งหมด" value={emps.length} unit="คน" tone="#64748b" soft="#eef1f6" />
        <Stat icon="checkCircle" label="ปฏิบัติงานอยู่" value={active.length} unit="คน" tone="#16a34a" soft="#e7f6ec" />
        <Stat icon="clock" label="ทดลองงาน" value={probation.length} unit="คน" tone="#e08a00" soft="#fdf1dc" />
        <Stat icon="employee" label="เข้าใหม่เดือนนี้" value={newThisMonth.length} unit="คน" tone="#2563eb" soft="#e8effb" />
        <Stat icon="logout" label="พ้นสภาพเดือนนี้" value={leftThisMonth.length} unit="คน" tone="#e11d48" soft="#fde8ec" />
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))" }}>
        <Stat icon="briefcase" label="หน่วยงาน" value={(HRC.departments || []).length} tone="#0d9488" soft="#e2f4f2" />
        <Stat icon="jd" label="ตำแหน่งงาน" value={(HRC.positions || []).length} tone="#7c3aed" soft="#f1ebfd" />
        <Stat icon="file" label="เอกสารใกล้/หมดอายุ" value={docs === null ? "…" : expiring.length} unit="ฉบับ"
          tone={expiring.length ? "#e11d48" : "#16a34a"} soft={expiring.length ? "#fde8ec" : "#e7f6ec"} />
        <Stat icon="users" label="ผู้ใช้ระบบ" value={(HRC.users || []).length} tone="#2563eb" soft="#e8effb" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" }}>
        <Card>
          <CardHead title="พนักงานตามหน่วยงาน" sub="เฉพาะผู้ปฏิบัติงานอยู่" />
          <div className="card-pad">
            {byDept.length === 0 ? <EmptyState icon="briefcase" title="ยังไม่มีข้อมูล" /> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {byDept.map((d) => (
                  <div key={d.label} className="row" style={{ gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 12.5, minWidth: 118, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.label}</span>
                    <div style={{ flex: 1, height: 18, borderRadius: 6, background: "var(--surface-3)", overflow: "hidden" }}>
                      <div style={{ width: (d.n / maxDept * 100) + "%", height: "100%", background: d.color, borderRadius: 6 }} />
                    </div>
                    <span className="mono" style={{ fontWeight: 600, minWidth: 34, textAlign: "right", fontSize: 13 }}>{d.n}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
        <Card>
          <CardHead title="ประเภทการจ้าง" sub="สัดส่วนพนักงานปัจจุบัน" />
          <div className="card-pad" style={{ display: "grid", placeItems: "center" }}>
            {byType.length === 0 ? <EmptyState icon="users" title="ยังไม่มีข้อมูล" />
              : <Donut data={byType} centerLabel="พนักงาน" centerValue={active.length} />}
          </div>
        </Card>
      </div>

      <Card>
        <CardHead title="พนักงานเข้าใหม่ / พ้นสภาพ" sub="ย้อนหลัง 6 เดือน" />
        <div className="card-pad">
          <div className="row" style={{ gap: 18, alignItems: "flex-end", justifyContent: "space-around", minHeight: 150 }}>
            {months.map((m) => (
              <div key={m.key} style={{ textAlign: "center", flex: 1 }}>
                <div className="row" style={{ gap: 5, alignItems: "flex-end", justifyContent: "center", height: 110 }}>
                  <div title={"เข้าใหม่ " + m.hires} style={{ width: 18, height: Math.max(3, m.hires / maxFlow * 105), background: "#16a34a", borderRadius: "5px 5px 0 0" }} />
                  <div title={"พ้นสภาพ " + m.exits} style={{ width: 18, height: Math.max(3, m.exits / maxFlow * 105), background: "#e11d48", borderRadius: "5px 5px 0 0" }} />
                </div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>{m.label}</div>
                <div className="mono" style={{ fontSize: 11 }}>
                  <span style={{ color: "#16a34a" }}>{m.hires}</span> / <span style={{ color: "#e11d48" }}>{m.exits}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="row" style={{ gap: 18, justifyContent: "center", marginTop: 12, fontSize: 12.5 }}>
            <span className="row" style={{ gap: 6 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: "#16a34a" }} />เข้าใหม่</span>
            <span className="row" style={{ gap: 6 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: "#e11d48" }} />พ้นสภาพ</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ================= Departments แบบ Tree (STEP 5) ================= */
function HRCDepartments({ nav }) {
  const [edit, setEdit] = useM1(null);
  const canManage = HRC.can("department.manage");
  const depts = HRC.departments || [];
  const emps = HRC.employees || [];

  const childrenOf = (pid) => depts.filter((d) => (d.parent_department_id || null) === pid);
  const headCount = (id) => emps.filter((e) => e.dept === id && HRC.isActive(e)).length;

  const Node = ({ d, depth }) => {
    const kids = childrenOf(d.id);
    const mgr = emps.find((e) => e.id === d.manager_id);
    return (
      <div>
        <div className="between" style={{ padding: "11px 14px", marginLeft: depth * 22, borderRadius: 11,
          border: "1px solid var(--border)", background: depth === 0 ? "var(--surface-2)" : "var(--surface)",
          marginBottom: 7, gap: 12 }}>
          <div className="row" style={{ gap: 11, minWidth: 0 }}>
            <span className="tag-dot" style={{ background: d.color || "#64748b", width: 11, height: 11, flex: "0 0 11px" }} />
            <div style={{ minWidth: 0 }}>
              <div className="row" style={{ gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 13.5 }}>{d.name}</span>
                <span className="mono muted" style={{ fontSize: 11 }}>{d.department_code}</span>
                {d.status !== "ACTIVE" && <Badge cls="b-gray">ปิดใช้งาน</Badge>}
              </div>
              <div className="muted" style={{ fontSize: 11.5 }}>
                {headCount(d.id)} คน{mgr ? " · ผู้จัดการ: " + mgr._fullName : ""}
              </div>
            </div>
          </div>
          {canManage && (
            <button className="icon-btn" style={{ width: 30, height: 30 }} title="แก้ไข" onClick={() => setEdit(d)}><Icon name="edit" size={14} /></button>
          )}
        </div>
        {kids.map((k) => <Node key={k.id} d={k} depth={depth + 1} />)}
      </div>
    );
  };

  const roots = childrenOf(null);
  return (
    <div className="grid">
      <Crumb items={[{ label: "HR Core" }, { label: "หน่วยงาน" }]} />
      <div className="page-head">
        <div><h1>หน่วยงาน</h1><p>โครงสร้างแบบลำดับชั้น · {depts.length} หน่วยงาน</p></div>
        {canManage && <button className="btn btn-pri" onClick={() => setEdit({})}><Icon name="plus" size={16} />เพิ่มหน่วยงาน</button>}
      </div>
      <Card><div className="card-pad">
        {roots.length === 0 ? <EmptyState icon="briefcase" title="ยังไม่มีหน่วยงาน" />
          : roots.map((r) => <Node key={r.id} d={r} depth={0} />)}
      </div></Card>
      {edit && <HRCDeptForm dept={edit.id ? edit : null} onClose={() => setEdit(null)} />}
    </div>
  );
}

function HRCDeptForm({ dept, onClose }) {
  const isEdit = !!dept;
  const [f, setF] = useM1(() => ({
    id: (dept && dept.id) || "",
    department_code: (dept && dept.department_code) || "",
    name: (dept && dept.name) || "",
    short: (dept && dept.short) || "",
    parent_department_id: (dept && dept.parent_department_id) || "",
    manager_id: (dept && dept.manager_id) || "",
    description: (dept && dept.description) || "",
    status: (dept && dept.status) || "ACTIVE",
  }));
  const [busy, setBusy] = useM1(false);
  const [err, setErr] = useM1("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.name.trim()) { setErr("กรุณากรอกชื่อหน่วยงาน"); return; }
    if (!f.department_code.trim()) { setErr("กรุณากรอกรหัสหน่วยงาน"); return; }
    if (isEdit && f.parent_department_id === dept.id) { setErr("หน่วยงานแม่ต้องไม่ใช่ตัวเอง"); return; }
    setErr(""); setBusy(true);
    const row = {
      department_code: f.department_code.trim().toUpperCase(), name: f.name.trim(),
      short: f.short.trim() || f.name.trim(), parent_department_id: f.parent_department_id || null,
      manager_id: f.manager_id || null, description: f.description.trim() || null, status: f.status,
    };
    let error;
    if (isEdit) ({ error } = await window.sb.from("departments").update(row).eq("id", dept.id));
    else {
      row.id = f.department_code.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
      row.color = ["#2563eb", "#0d9488", "#7c3aed", "#e08a00", "#db2777"][(HRC.departments || []).length % 5];
      row.sort = (HRC.departments || []).length;
      ({ error } = await window.sb.from("departments").insert(row));
    }
    setBusy(false);
    if (error) { setErr(/duplicate|unique/i.test(error.message) ? "รหัสหน่วยงานนี้มีอยู่แล้ว" : "บันทึกไม่สำเร็จ: " + error.message); return; }
    await HRC.audit(isEdit ? "แก้ไขหน่วยงาน" : "เพิ่มหน่วยงาน", isEdit ? "UPDATE" : "CREATE", "departments", isEdit ? dept.id : row.id, dept || null, row);
    await HRC.load(); toast("บันทึกหน่วยงานแล้ว", "check"); onClose();
  };

  return (
    <HRCDrawer title={isEdit ? "แก้ไขหน่วยงาน" : "เพิ่มหน่วยงาน"} sub={isEdit ? dept.name : "กำหนดรหัสและหน่วยงานแม่"}
      onClose={onClose} width={480}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button className="btn btn-pri" onClick={save} disabled={busy}><Icon name="check" size={15} />{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {err && <div style={{ padding: "10px 13px", borderRadius: 10, background: "var(--red-soft)", color: "#be123c", fontSize: 13 }}>{err}</div>}
        <div className="field"><label>รหัสหน่วยงาน *</label>
          <input className="input mono" value={f.department_code} onChange={(e) => set("department_code", e.target.value)} disabled={isEdit} placeholder="เช่น PROD" /></div>
        <div className="field"><label>ชื่อหน่วยงาน *</label><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div className="field"><label>ชื่อย่อ</label><input className="input" value={f.short} onChange={(e) => set("short", e.target.value)} /></div>
        <div className="field"><label>หน่วยงานแม่</label>
          <select className="select" value={f.parent_department_id} onChange={(e) => set("parent_department_id", e.target.value)}>
            <option value="">— ไม่มี (ระดับบนสุด) —</option>
            {(HRC.departments || []).filter((d) => !isEdit || d.id !== dept.id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select></div>
        <div className="field"><label>ผู้จัดการหน่วยงาน</label>
          <select className="select" value={f.manager_id} onChange={(e) => set("manager_id", e.target.value)}>
            <option value="">— ไม่ระบุ —</option>
            {(HRC.employees || []).filter((e) => HRC.isActive(e)).map((e) => <option key={e.id} value={e.id}>{e._fullName}</option>)}
          </select></div>
        <div className="field"><label>สถานะ</label>
          <select className="select" value={f.status} onChange={(e) => set("status", e.target.value)}>
            <option value="ACTIVE">เปิดใช้งาน</option><option value="INACTIVE">ปิดใช้งาน</option>
          </select></div>
        <div className="field"><label>คำอธิบาย</label><textarea className="input" rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} /></div>
      </div>
    </HRCDrawer>
  );
}

/* ================= Positions (STEP 6) ================= */
function HRCPositions() {
  const [edit, setEdit] = useM1(null);
  const canManage = HRC.can("position.manage");
  const emps = HRC.employees || [];

  const columns = [
    { key: "position_code", label: "รหัส", width: 92, render: (r) => <span className="mono" style={{ fontWeight: 600 }}>{r.position_code}</span> },
    { key: "position_name", label: "ชื่อตำแหน่ง", render: (r) => <span style={{ fontWeight: 600 }}>{r.position_name}</span> },
    { key: "department_id", label: "หน่วยงาน", sortValue: (r) => HRC.deptName(r.department_id), render: (r) => HRC.deptName(r.department_id) },
    { key: "job_level", label: "ระดับ", render: (r) => <span className="muted">{r.job_level || "—"}</span> },
    { key: "count", label: "พนักงาน", align: "center", sortable: false,
      sortValue: (r) => emps.filter((e) => e.position_id === r.id).length,
      render: (r) => <span className="mono">{emps.filter((e) => e.position_id === r.id && HRC.isActive(e)).length}</span> },
    { key: "status", label: "สถานะ", align: "center",
      render: (r) => <Badge cls={r.status === "ACTIVE" ? "b-green" : "b-gray"} dot>{r.status === "ACTIVE" ? "ใช้งาน" : "ปิด"}</Badge> },
  ];

  return (
    <div className="grid">
      <Crumb items={[{ label: "HR Core" }, { label: "ตำแหน่งงาน" }]} />
      <div className="page-head">
        <div><h1>ตำแหน่งงาน</h1><p>แยกจากข้อมูลพนักงานและหน่วยงาน · {(HRC.positions || []).length} ตำแหน่ง</p></div>
        {canManage && <button className="btn btn-pri" onClick={() => setEdit({})}><Icon name="plus" size={16} />เพิ่มตำแหน่ง</button>}
      </div>
      <Card>
        <DataTable rows={HRC.positions || []} columns={columns} rowKey={(r) => r.id}
          onRowClick={canManage ? (r) => setEdit(r) : undefined}
          searchFields={["position_code", "position_name", "job_level", (r) => HRC.deptName(r.department_id)]}
          filters={[{ key: "dept", label: "หน่วยงาน", options: (HRC.departments || []).map((d) => ({ value: d.id, label: d.name })), test: (r, v) => r.department_id === v }]}
          exportName="hr_core_positions" emptyTitle="ไม่พบตำแหน่งงาน" />
      </Card>
      {edit && <HRCPositionForm pos={edit.id ? edit : null} onClose={() => setEdit(null)} />}
    </div>
  );
}

function HRCPositionForm({ pos, onClose }) {
  const isEdit = !!pos;
  const [f, setF] = useM1(() => ({
    position_code: (pos && pos.position_code) || "",
    position_name: (pos && pos.position_name) || "",
    department_id: (pos && pos.department_id) || ((HRC.departments[0] || {}).id || ""),
    job_level: (pos && pos.job_level) || "",
    description: (pos && pos.description) || "",
    status: (pos && pos.status) || "ACTIVE",
  }));
  const [busy, setBusy] = useM1(false);
  const [err, setErr] = useM1("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const levels = [...new Set((HRC.employees || []).map((e) => e.level).filter(Boolean))];

  const save = async () => {
    if (!f.position_name.trim()) { setErr("กรุณากรอกชื่อตำแหน่ง"); return; }
    if (!f.position_code.trim()) { setErr("กรุณากรอกรหัสตำแหน่ง"); return; }
    setErr(""); setBusy(true);
    const row = {
      position_code: f.position_code.trim().toUpperCase(), position_name: f.position_name.trim(),
      department_id: f.department_id || null, job_level: f.job_level || null,
      description: f.description.trim() || null, status: f.status,
    };
    let error;
    if (isEdit) ({ error } = await window.sb.from("positions").update(row).eq("id", pos.id));
    else { row.id = "pos_" + Date.now().toString(36); ({ error } = await window.sb.from("positions").insert(row)); }
    setBusy(false);
    if (error) { setErr(/duplicate|unique/i.test(error.message) ? "รหัสตำแหน่งนี้มีอยู่แล้ว" : "บันทึกไม่สำเร็จ: " + error.message); return; }
    await HRC.audit(isEdit ? "แก้ไขตำแหน่ง" : "เพิ่มตำแหน่ง", isEdit ? "UPDATE" : "CREATE", "positions", isEdit ? pos.id : row.id, pos || null, row);
    await HRC.load(); toast("บันทึกตำแหน่งแล้ว", "check"); onClose();
  };

  return (
    <HRCDrawer title={isEdit ? "แก้ไขตำแหน่งงาน" : "เพิ่มตำแหน่งงาน"} onClose={onClose} width={470}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button className="btn btn-pri" onClick={save} disabled={busy}><Icon name="check" size={15} />{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {err && <div style={{ padding: "10px 13px", borderRadius: 10, background: "var(--red-soft)", color: "#be123c", fontSize: 13 }}>{err}</div>}
        <div className="field"><label>รหัสตำแหน่ง *</label><input className="input mono" value={f.position_code} onChange={(e) => set("position_code", e.target.value)} disabled={isEdit} /></div>
        <div className="field"><label>ชื่อตำแหน่ง *</label><input className="input" value={f.position_name} onChange={(e) => set("position_name", e.target.value)} /></div>
        <div className="field"><label>หน่วยงาน</label>
          <select className="select" value={f.department_id} onChange={(e) => set("department_id", e.target.value)}>
            <option value="">— ไม่ระบุ —</option>
            {(HRC.departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select></div>
        <div className="field"><label>ระดับตำแหน่ง</label>
          <input className="input" list="hrc-levels" value={f.job_level} onChange={(e) => set("job_level", e.target.value)} />
          <datalist id="hrc-levels">{levels.map((l) => <option key={l} value={l} />)}</datalist></div>
        <div className="field"><label>สถานะ</label>
          <select className="select" value={f.status} onChange={(e) => set("status", e.target.value)}>
            <option value="ACTIVE">ใช้งาน</option><option value="INACTIVE">ปิดใช้งาน</option>
          </select></div>
        <div className="field"><label>คำอธิบาย</label><textarea className="input" rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} /></div>
      </div>
    </HRCDrawer>
  );
}

/* ================= Master Data: ประเภทการจ้าง (STEP 7) ================= */
function HRCMasterData() {
  const [rows, setRows] = useM1(HRC.employmentTypes || []);
  const [edit, setEdit] = useM1(null);
  const canManage = HRC.can("position.manage");

  const toggle = async (t) => {
    const { error } = await window.sb.from("employment_types").update({ is_active: !t.is_active }).eq("id", t.id);
    if (error) { toast("ไม่สำเร็จ: " + error.message, "x"); return; }
    await HRC.audit("เปลี่ยนสถานะประเภทการจ้าง", "STATUS_CHANGE", "employment_types", t.id, { is_active: t.is_active }, { is_active: !t.is_active });
    await HRC.load(); setRows(HRC.employmentTypes); toast("อัปเดตแล้ว", "check");
  };

  return (
    <div className="grid">
      <Crumb items={[{ label: "HR Core" }, { label: "ข้อมูลตั้งต้น" }]} />
      <div className="page-head">
        <div><h1>ข้อมูลตั้งต้น (Master Data)</h1><p>ประเภทการจ้างงาน · ปรับได้โดยไม่ต้องแก้โปรแกรม</p></div>
        {canManage && <button className="btn btn-pri" onClick={() => setEdit({})}><Icon name="plus" size={16} />เพิ่มประเภท</button>}
      </div>
      <Card>
        <CardHead title="ประเภทการจ้างงาน" sub={(HRC.employmentTypes || []).length + " ประเภท"} />
        <div style={{ padding: "8px 14px" }}>
          {(HRC.employmentTypes || []).map((t) => (
            <div key={t.id} className="between" style={{ padding: "11px 6px", borderBottom: "1px solid var(--border-2)", gap: 10 }}>
              <div className="row" style={{ gap: 11, minWidth: 0 }}>
                <span className="mono muted" style={{ fontSize: 11.5, minWidth: 84 }}>{t.code}</span>
                <span style={{ fontWeight: 600, fontSize: 13.5 }}>{t.name}</span>
                <span className="muted" style={{ fontSize: 12 }}>
                  · ใช้อยู่ {(HRC.employees || []).filter((e) => e.employment_type_id === t.id && HRC.isActive(e)).length} คน
                </span>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <Badge cls={t.is_active ? "b-green" : "b-gray"} dot>{t.is_active ? "เปิดใช้งาน" : "ปิด"}</Badge>
                {canManage && <>
                  <span title={t.is_active ? "กดเพื่อปิดใช้งาน" : "กดเพื่อเปิดใช้งาน"}><HRCToggle on={t.is_active} onChange={() => toggle(t)} /></span>
                  <button className="icon-btn" style={{ width: 30, height: 30 }} title="แก้ไข" onClick={() => setEdit(t)}><Icon name="edit" size={14} /></button>
                </>}
              </div>
            </div>
          ))}
        </div>
      </Card>
      {edit && <HRCEtypeForm et={edit.id ? edit : null} onClose={() => { setEdit(null); setRows(HRC.employmentTypes); }} />}
    </div>
  );
}

function HRCEtypeForm({ et, onClose }) {
  const isEdit = !!et;
  const [code, setCode] = useM1((et && et.code) || "");
  const [name, setName] = useM1((et && et.name) || "");
  const [busy, setBusy] = useM1(false);
  const [err, setErr] = useM1("");
  const save = async () => {
    if (!name.trim() || !code.trim()) { setErr("กรุณากรอกรหัสและชื่อ"); return; }
    setErr(""); setBusy(true);
    const row = { code: code.trim().toUpperCase(), name: name.trim() };
    let error;
    if (isEdit) ({ error } = await window.sb.from("employment_types").update(row).eq("id", et.id));
    else { row.id = code.trim().toLowerCase().replace(/[^a-z0-9]/g, ""); row.sort = (HRC.employmentTypes || []).length + 1;
           ({ error } = await window.sb.from("employment_types").insert(row)); }
    setBusy(false);
    if (error) { setErr(/duplicate|unique/i.test(error.message) ? "รหัสนี้มีอยู่แล้ว" : "บันทึกไม่สำเร็จ: " + error.message); return; }
    await HRC.load(); toast("บันทึกแล้ว", "check"); onClose();
  };
  return (
    <Modal title={isEdit ? "แก้ไขประเภทการจ้าง" : "เพิ่มประเภทการจ้าง"} onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button className="btn btn-pri" onClick={save} disabled={busy}><Icon name="check" size={15} />บันทึก</button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
        {err && <div style={{ padding: "10px 13px", borderRadius: 10, background: "var(--red-soft)", color: "#be123c", fontSize: 13 }}>{err}</div>}
        <div className="field"><label>รหัส *</label><input className="input mono" value={code} onChange={(e) => setCode(e.target.value)} disabled={isEdit} placeholder="เช่น PERMANENT" /></div>
        <div className="field"><label>ชื่อประเภท *</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
      </div>
    </Modal>
  );
}

/* ================= Organization Chart (STEP 14) ================= */
function HRCOrgChart({ nav }) {
  const emps = (HRC.employees || []).filter((e) => HRC.isActive(e));
  const byId = {}; emps.forEach((e) => { byId[e.id] = e; });
  const supOf = (e) => e.supervisor_fk || e.supervisor_id || null;
  const roots = emps.filter((e) => !supOf(e) || !byId[supOf(e)]);
  const childrenOf = (id) => emps.filter((e) => supOf(e) === id);
  const [open, setOpen] = useM1({});

  const Node = ({ e, depth }) => {
    const kids = childrenOf(e.id);
    const isOpen = open[e.id] !== false;
    return (
      <div style={{ marginLeft: depth ? 26 : 0, borderLeft: depth ? "1px solid var(--border)" : "none", paddingLeft: depth ? 14 : 0 }}>
        <div className="row" style={{ gap: 8, padding: "7px 0" }}>
          {kids.length > 0
            ? <button className="icon-btn" style={{ width: 24, height: 24, flex: "0 0 24px" }}
                aria-label={isOpen ? "ย่อ" : "ขยาย"} onClick={() => setOpen((p) => ({ ...p, [e.id]: !isOpen }))}>
                <Icon name={isOpen ? "chevDown" : "chevRight"} size={13} /></button>
            : <span style={{ width: 24, flex: "0 0 24px" }} />}
          <button className="row" onClick={() => nav("employee", e.id)}
            style={{ gap: 10, border: "1px solid var(--border)", borderRadius: 11, padding: "8px 14px 8px 8px",
                     background: "var(--surface)", cursor: "pointer", textAlign: "left", minWidth: 0 }}>
            <Avatar name={e._fullName} initials={(e._fullName || "?").trim()[0]} color={e.color || "#2563eb"} size={30} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{e._fullName}</div>
              <div className="muted" style={{ fontSize: 11.5 }}>
                {(e._position ? e._position.position_name : e.position)} · {HRC.deptName(e.dept)}
              </div>
            </div>
            {kids.length > 0 && <span className="badge b-blue" style={{ marginLeft: 8 }}>{kids.length}</span>}
          </button>
        </div>
        {isOpen && kids.map((k) => <Node key={k.id} e={k} depth={depth + 1} />)}
      </div>
    );
  };

  return (
    <div className="grid">
      <Crumb items={[{ label: "HR Core" }, { label: "ผังองค์กร" }]} />
      <div className="page-head">
        <div><h1>ผังองค์กร</h1><p>ตามสายบังคับบัญชาจริง · กดที่ชื่อเพื่อดูโปรไฟล์</p></div>
      </div>
      <Card><div className="card-pad" style={{ overflowX: "auto" }}>
        {roots.length === 0 ? <EmptyState icon="users" title="ยังไม่มีข้อมูลสายบังคับบัญชา" sub="กำหนดผู้บังคับบัญชาให้พนักงานก่อน" />
          : <div style={{ minWidth: 420 }}>{roots.map((r) => <Node key={r.id} e={r} depth={0} />)}</div>}
      </div></Card>
    </div>
  );
}

Object.assign(window, { HRCDashboard, HRCDepartments, HRCPositions, HRCMasterData, HRCOrgChart });
