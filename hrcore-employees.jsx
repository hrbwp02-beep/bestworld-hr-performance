// hrcore-employees.jsx — โมดูลพนักงาน: รายชื่อ / เพิ่ม / แก้ไข / เปลี่ยนสถานะ
const { useState: useE1, useMemo: useEM1 } = React;

/* ================= รายชื่อพนักงาน (STEP 3) ================= */
function HRCEmployees({ nav }) {
  const [form, setForm] = useE1(null);       // {} = เพิ่มใหม่, object = แก้ไข
  const [statusFor, setStatusFor] = useE1(null);
  const rows = HRC.employees || [];

  const columns = [
    { key: "employee_code", label: "รหัส", width: 92,
      render: (r) => <span className="mono" style={{ fontWeight: 600 }}>{r.employee_code}</span> },
    { key: "name", label: "ชื่อ-นามสกุล", sortValue: (r) => r._fullName,
      render: (r) => (
        <div className="row" style={{ gap: 9 }}>
          <Avatar name={r._fullName} initials={(r._fullName || "?").trim()[0]} color={r.color || "#2563eb"} size={28} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{r._fullName}</div>
            {r.nickname && <div className="muted" style={{ fontSize: 11 }}>({r.nickname})</div>}
          </div>
        </div>
      ) },
    { key: "position", label: "ตำแหน่ง", sortValue: (r) => (r._position ? r._position.position_name : r.position),
      render: (r) => <span>{r._position ? r._position.position_name : (r.position || "—")}</span> },
    { key: "dept", label: "หน่วยงาน", sortValue: (r) => HRC.deptName(r.dept),
      render: (r) => HRC.deptName(r.dept) },
    { key: "employment_type_id", label: "ประเภทการจ้าง", sortValue: (r) => HRC.etypeName(r.employment_type_id),
      render: (r) => <span className="muted">{HRC.etypeName(r.employment_type_id)}</span> },
    { key: "hire_date", label: "เริ่มงาน", align: "center", sortValue: (r) => r.hire_date || "",
      render: (r) => <span className="mono" style={{ fontSize: 12 }}>{r.hire_date || "—"}</span> },
    { key: "_status", label: "สถานะ", align: "center",
      render: (r) => { const m = HRC.statusMeta(r._status); return <Badge cls={m.cls} dot>{m.label}</Badge>; },
      exportValue: (r) => HRC.statusMeta(r._status).label },
  ];

  const filters = [
    { key: "dept", label: "หน่วยงาน", options: (HRC.departments || []).map((d) => ({ value: d.id, label: d.name })),
      test: (r, v) => r.dept === v },
    { key: "status", label: "สถานะ", width: 170,
      options: Object.keys(HRC.EMP_STATUS).map((k) => ({ value: k, label: HRC.EMP_STATUS[k].label })),
      test: (r, v) => r._status === v },
    { key: "etype", label: "ประเภทการจ้าง", options: (HRC.employmentTypes || []).map((t) => ({ value: t.id, label: t.name })),
      test: (r, v) => r.employment_type_id === v },
  ];

  return (
    <div className="grid">
      <Crumb items={[{ label: "HR Core" }, { label: "พนักงาน" }]} />
      <div className="page-head">
        <div><h1>พนักงาน</h1><p>ข้อมูลบุคลากรทั้งหมด · {rows.length} คน</p></div>
        {HRC.can("employee.create") && (
          <button className="btn btn-pri" onClick={() => setForm({})}><Icon name="plus" size={16} />เพิ่มพนักงาน</button>
        )}
      </div>

      <Card>
        <DataTable
          rows={rows} columns={columns} filters={filters}
          rowKey={(r) => r.id}
          onRowClick={(r) => nav("employee", r.id)}
          searchFields={["employee_code", "name", "nickname", "phone", "email", (r) => (r._position ? r._position.position_name : ""), (r) => HRC.deptName(r.dept)]}
          exportName="hr_core_employees"
          emptyTitle="ไม่พบพนักงาน"
          emptySub="ลองเปลี่ยนคำค้นหรือตัวกรอง"
        />
      </Card>

      {form && <HRCEmployeeForm emp={form.id ? form : null} onClose={() => setForm(null)} />}
      {statusFor && <HRCStatusDialog emp={statusFor} onClose={() => setStatusFor(null)} />}
    </div>
  );
}

/* ================= ฟอร์มเพิ่ม/แก้ไขพนักงาน ================= */
function HRCEmployeeForm({ emp, onClose, onSaved }) {
  const isEdit = !!emp;
  const [f, setF] = useE1(() => ({
    employee_code: (emp && emp.employee_code) || "",
    prefix: (emp && emp.prefix) || "นาย",
    first_name: (emp && emp.first_name) || "",
    last_name: (emp && emp.last_name) || "",
    nickname: (emp && emp.nickname) || "",
    gender: (emp && emp.gender) || "ชาย",
    birth_date: (emp && emp.birth_date) || "",
    nationality: (emp && emp.nationality) || "ไทย",
    citizen_id: (emp && emp.citizen_id) || "",
    passport_no: (emp && emp.passport_no) || "",
    phone: (emp && emp.phone) || "",
    email: (emp && emp.email) || "",
    address: (emp && emp.address) || "",
    hire_date: (emp && emp.hire_date) || "",
    employment_type_id: (emp && emp.employment_type_id) || "prob",
    employment_status: (emp && emp.employment_status) || "PROBATION",
    dept: (emp && emp.dept) || ((HRC.departments[0] || {}).id || ""),
    position_id: (emp && emp.position_id) || "",
    supervisor_fk: (emp && (emp.supervisor_fk || emp.supervisor_id)) || "",
    work_location: (emp && emp.work_location) || "",
    education: (emp && emp.education) || "",
  }));
  const [busy, setBusy] = useE1(false);
  const [err, setErr] = useE1("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const deptPositions = useEM1(
    () => (HRC.positions || []).filter((p) => !f.dept || p.department_id === f.dept || p.id === f.position_id),
    [f.dept, f.position_id]);

  const validate = () => {
    if (!f.first_name.trim()) return "กรุณากรอกชื่อ";
    if (!f.last_name.trim()) return "กรุณากรอกนามสกุล";
    if (!f.dept) return "กรุณาเลือกหน่วยงาน";
    if (!f.hire_date) return "กรุณาระบุวันที่เริ่มงาน";
    if (f.citizen_id && !/^\d{13}$/.test(f.citizen_id.replace(/\D/g, "")) && f.citizen_id.replace(/\D/g, "").length > 0)
      return "เลขบัตรประชาชนต้องมี 13 หลัก";
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) return "รูปแบบอีเมลไม่ถูกต้อง";
    return "";
  };

  const save = async () => {
    const v = validate();
    if (v) { setErr(v); return; }
    setErr(""); setBusy(true);
    try {
      const pos = HRC.posMap[f.position_id];
      const row = {
        prefix: f.prefix, first_name: f.first_name.trim(), last_name: f.last_name.trim(),
        name: [f.prefix, f.first_name.trim(), f.last_name.trim()].filter(Boolean).join(" ").replace(/^(นาย|นางสาว|นาง)\s/, "$1"),
        nickname: f.nickname.trim() || null, gender: f.gender, birth_date: f.birth_date || null,
        nationality: f.nationality || null, citizen_id: f.citizen_id.replace(/\D/g, "") || null,
        passport_no: f.passport_no.trim() || null, phone: f.phone.trim() || null,
        email: f.email.trim() || null, address: f.address.trim() || null,
        hire_date: f.hire_date || null, employment_type_id: f.employment_type_id || null,
        employment_status: f.employment_status, dept: f.dept,
        position_id: f.position_id || null, position: pos ? pos.position_name : (emp ? emp.position : "-"),
        supervisor_fk: f.supervisor_fk || null, supervisor_id: f.supervisor_fk || null,
        work_location: f.work_location.trim() || null, education: f.education || null,
      };
      let error;
      if (isEdit) {
        ({ error } = await window.sb.from("employees").update(row).eq("id", emp.id));
      } else {
        const { data: code, error: cErr } = await window.sb.rpc("next_employee_code");
        if (cErr) throw new Error(cErr.message);
        row.id = code; row.employee_code = code;
        row.status = "pending"; row.source = "manual";
        row.created_by = (HRC.user || {}).email || null;
        ({ error } = await window.sb.from("employees").insert(row));
      }
      if (error) throw new Error(error.message);
      await HRC.load();
      toast(isEdit ? "บันทึกข้อมูลพนักงานแล้ว" : "เพิ่มพนักงาน " + row.name + " แล้ว", "check");
      if (onSaved) onSaved();
      onClose();
    } catch (e) {
      const m = String(e.message || e);
      setErr(/duplicate|unique/i.test(m)
        ? (/citizen/i.test(m) ? "เลขบัตรประชาชนนี้มีในระบบแล้ว" : "รหัสพนักงานนี้มีอยู่แล้ว")
        : "บันทึกไม่สำเร็จ: " + m);
    } finally { setBusy(false); }
  };

  const F = ({ label, children, req }) => (
    <div className="field"><label>{label}{req && " *"}</label>{children}</div>
  );

  return (
    <HRCDrawer title={isEdit ? "แก้ไขข้อมูลพนักงาน" : "เพิ่มพนักงานใหม่"}
      sub={isEdit ? emp.employee_code + " · " + emp._fullName : "รหัสพนักงานจะออกให้อัตโนมัติ"}
      onClose={onClose} width={560}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button className="btn btn-pri" onClick={save} disabled={busy}><Icon name="check" size={15} />{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
        {err && <div style={{ padding: "10px 13px", borderRadius: 10, background: "var(--red-soft)", color: "#be123c", fontSize: 13 }}>{err}</div>}

        <div className="side-section" style={{ padding: 0, color: "var(--text-3)" }}>ข้อมูลส่วนตัว</div>
        <div className="grid" style={{ gridTemplateColumns: "90px 1fr 1fr", gap: 10 }}>
          <F label="คำนำหน้า"><select className="select" value={f.prefix} onChange={(e) => set("prefix", e.target.value)}>
            {["นาย", "นาง", "นางสาว", "MR.", "MS."].map((x) => <option key={x} value={x}>{x}</option>)}</select></F>
          <F label="ชื่อ" req><input className="input" value={f.first_name} onChange={(e) => set("first_name", e.target.value)} /></F>
          <F label="นามสกุล" req><input className="input" value={f.last_name} onChange={(e) => set("last_name", e.target.value)} /></F>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <F label="ชื่อเล่น"><input className="input" value={f.nickname} onChange={(e) => set("nickname", e.target.value)} /></F>
          <F label="เพศ"><select className="select" value={f.gender} onChange={(e) => set("gender", e.target.value)}>
            {["ชาย", "หญิง"].map((x) => <option key={x} value={x}>{x}</option>)}</select></F>
          <F label="วันเกิด"><input className="input" type="date" value={f.birth_date || ""} onChange={(e) => set("birth_date", e.target.value)} /></F>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <F label="สัญชาติ"><input className="input" value={f.nationality} onChange={(e) => set("nationality", e.target.value)} /></F>
          <F label="เลขบัตรประชาชน"><input className="input mono" value={f.citizen_id} onChange={(e) => set("citizen_id", e.target.value)} placeholder="13 หลัก" /></F>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <F label="Passport"><input className="input" value={f.passport_no} onChange={(e) => set("passport_no", e.target.value)} /></F>
          <F label="เบอร์โทร"><input className="input" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></F>
        </div>
        <F label="อีเมล"><input className="input" value={f.email} onChange={(e) => set("email", e.target.value)} /></F>
        <F label="ที่อยู่"><textarea className="input" rows={2} value={f.address} onChange={(e) => set("address", e.target.value)} /></F>

        <div className="side-section" style={{ padding: "6px 0 0", color: "var(--text-3)" }}>ข้อมูลการจ้างงาน</div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <F label="วันที่เริ่มงาน" req><input className="input" type="date" value={f.hire_date || ""} onChange={(e) => set("hire_date", e.target.value)} /></F>
          <F label="ประเภทการจ้าง"><select className="select" value={f.employment_type_id} onChange={(e) => set("employment_type_id", e.target.value)}>
            {(HRC.employmentTypes || []).filter((t) => t.is_active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></F>
        </div>
        <F label="สถานะการจ้าง"><select className="select" value={f.employment_status} onChange={(e) => set("employment_status", e.target.value)}>
          {Object.keys(HRC.EMP_STATUS).map((k) => <option key={k} value={k}>{HRC.EMP_STATUS[k].label}</option>)}</select></F>

        <div className="side-section" style={{ padding: "6px 0 0", color: "var(--text-3)" }}>หน่วยงานและตำแหน่ง</div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <F label="หน่วยงาน" req><select className="select" value={f.dept} onChange={(e) => { set("dept", e.target.value); set("position_id", ""); }}>
            {(HRC.departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></F>
          <F label="ตำแหน่ง"><select className="select" value={f.position_id} onChange={(e) => set("position_id", e.target.value)}>
            <option value="">— ไม่ระบุ —</option>
            {deptPositions.map((p) => <option key={p.id} value={p.id}>{p.position_name}</option>)}</select></F>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <F label="ผู้บังคับบัญชา"><select className="select" value={f.supervisor_fk} onChange={(e) => set("supervisor_fk", e.target.value)}>
            <option value="">— ไม่ระบุ —</option>
            {(HRC.employees || []).filter((x) => !emp || x.id !== emp.id).map((x) =>
              <option key={x.id} value={x.id}>{x._fullName} · {HRC.deptName(x.dept)}</option>)}</select></F>
          <F label="สถานที่ทำงาน"><input className="input" value={f.work_location} onChange={(e) => set("work_location", e.target.value)} placeholder="เช่น สำนักงานใหญ่" /></F>
        </div>
      </div>
    </HRCDrawer>
  );
}

/* ================= เปลี่ยนสถานะการจ้าง (ไม่ Hard Delete · STEP 3) ================= */
function HRCStatusDialog({ emp, onClose, onSaved }) {
  const [status, setStatus] = useE1(emp._status === "ACTIVE" ? "RESIGNED" : "ACTIVE");
  const [date, setDate] = useE1(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useE1("");
  const [busy, setBusy] = useE1(false);
  const leaving = ["RESIGNED", "TERMINATED", "RETIRED"].indexOf(status) > -1;

  const save = async () => {
    setBusy(true);
    const patch = { employment_status: status };
    if (leaving) { patch.resign_date = date; patch.resign_reason = reason.trim() || null; }
    else { patch.resign_date = null; patch.resign_reason = null; }
    const { error } = await window.sb.from("employees").update(patch).eq("id", emp.id);
    setBusy(false);
    if (error) { toast("ไม่สำเร็จ: " + error.message, "x"); return; }
    await HRC.load();
    toast("เปลี่ยนสถานะเป็น " + HRC.statusMeta(status).label + " แล้ว", "check");
    if (onSaved) onSaved();
    onClose();
  };

  return (
    <Modal title={"เปลี่ยนสถานะ · " + emp._fullName} onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button className="btn btn-pri" onClick={save} disabled={busy}><Icon name="check" size={15} />{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 12.5, background: "var(--accent-soft)", color: "var(--accent-700)", borderRadius: 10, padding: "10px 13px", lineHeight: 1.7 }}>
          ระบบไม่ลบข้อมูลพนักงาน · ใช้การเปลี่ยนสถานะแทน ประวัติทั้งหมดจะยังอยู่ครบและย้อนกลับได้
        </div>
        <div className="field"><label>สถานะใหม่</label>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.keys(HRC.EMP_STATUS).map((k) => <option key={k} value={k}>{HRC.EMP_STATUS[k].label}</option>)}
          </select>
        </div>
        {leaving && (<>
          <div className="field"><label>วันที่มีผล</label><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="field"><label>เหตุผล</label><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="เช่น ย้ายถิ่นฐาน" /></div>
        </>)}
      </div>
    </Modal>
  );
}

Object.assign(window, { HRCEmployees, HRCEmployeeForm, HRCStatusDialog });
