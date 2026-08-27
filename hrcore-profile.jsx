// hrcore-profile.jsx — หน้าโปรไฟล์พนักงาน + ข้อมูลย่อย (เอกสาร/การศึกษา/ประสบการณ์/ทักษะ/ฉุกเฉิน/ประวัติ)
const { useState: useP1, useEffect: usePE1 } = React;

/* ============ ตัวช่วย: รายการข้อมูลย่อยแบบใช้ซ้ำได้ (CRUD) ============ */
function SubRecordList({ table, employeeId, fields, title, addLabel, icon, canEdit, renderItem, orderBy }) {
  const [rows, setRows] = useP1(null);
  const [err, setErr] = useP1("");
  const [edit, setEdit] = useP1(null);
  const [del, setDel] = useP1(null);

  const reload = async () => {
    setErr("");
    const q = window.sb.from(table).select("*").eq("employee_id", employeeId);
    const { data, error } = orderBy ? await q.order(orderBy.col, { ascending: !!orderBy.asc }) : await q;
    if (error) { setErr(error.message); setRows([]); return; }
    setRows(data || []);
  };
  usePE1(() => { reload(); }, [employeeId, table]);

  const save = async (values, id) => {
    const payload = { ...values, employee_id: employeeId };
    const { error } = id
      ? await window.sb.from(table).update(values).eq("id", id)
      : await window.sb.from(table).insert(payload);
    if (error) { toast("บันทึกไม่สำเร็จ: " + error.message, "x"); return false; }
    await HRC.audit(id ? "แก้ไข" + title : "เพิ่ม" + title, id ? "UPDATE" : "CREATE", table, id || employeeId, null, payload);
    await reload(); toast("บันทึกแล้ว", "check"); return true;
  };
  const remove = async (row) => {
    const { error } = await window.sb.from(table).delete().eq("id", row.id);
    if (error) { toast("ลบไม่สำเร็จ: " + error.message, "x"); return; }
    await HRC.audit("ลบ" + title, "DELETE", table, row.id, row, null);
    await reload(); toast("ลบแล้ว", "check"); setDel(null);
  };

  if (rows === null) return <LoadingState />;
  if (err) return <ErrorState text={err} onRetry={reload} />;

  return (
    <div>
      <div className="between" style={{ marginBottom: 12, gap: 10 }}>
        <span className="muted" style={{ fontSize: 13 }}>{rows.length} รายการ</span>
        {canEdit && <button className="btn btn-soft btn-sm" onClick={() => setEdit({})}><Icon name="plus" size={14} />{addLabel}</button>}
      </div>
      {rows.length === 0
        ? <EmptyState icon={icon} title={"ยังไม่มี" + title} sub={canEdit ? "กด " + addLabel + " เพื่อเพิ่มรายการแรก" : null} />
        : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {rows.map((r) => (
              <div key={r.id} className="between" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "12px 15px", gap: 12 }}>
                <div style={{ minWidth: 0, flex: 1 }}>{renderItem(r)}</div>
                {canEdit && (
                  <div className="row" style={{ gap: 4, flex: "0 0 auto" }}>
                    <button className="icon-btn" style={{ width: 30, height: 30 }} title="แก้ไข" onClick={() => setEdit(r)}><Icon name="edit" size={14} /></button>
                    <button className="icon-btn" style={{ width: 30, height: 30 }} title="ลบ" onClick={() => setDel(r)}><Icon name="x" size={14} color="var(--red)" /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      {edit && <SubRecordForm title={title} fields={fields} row={edit.id ? edit : null} onSave={save} onClose={() => setEdit(null)} />}
      {del && <Confirm title={"ลบ" + title} danger confirmLabel="ลบ"
        message={"ยืนยันลบรายการนี้? การลบไม่สามารถย้อนกลับได้"}
        onConfirm={() => remove(del)} onClose={() => setDel(null)} />}
    </div>
  );
}

function SubRecordForm({ title, fields, row, onSave, onClose }) {
  const [f, setF] = useP1(() => {
    const o = {}; fields.forEach((x) => { o[x.key] = row ? (row[x.key] == null ? "" : row[x.key]) : (x.def || ""); }); return o;
  });
  const [busy, setBusy] = useP1(false);
  const [err, setErr] = useP1("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    const miss = fields.find((x) => x.required && !String(f[x.key] || "").trim());
    if (miss) { setErr("กรุณากรอก " + miss.label); return; }
    setErr(""); setBusy(true);
    const values = {};
    fields.forEach((x) => {
      let v = f[x.key];
      if (v === "" || v == null) v = null;
      else if (x.type === "number") v = Number(v);
      values[x.key] = v;
    });
    const ok = await onSave(values, row ? row.id : null);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal title={(row ? "แก้ไข" : "เพิ่ม") + title} onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button className="btn btn-pri" onClick={submit} disabled={busy}><Icon name="check" size={15} />{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
        {err && <div style={{ padding: "10px 13px", borderRadius: 10, background: "var(--red-soft)", color: "#be123c", fontSize: 13 }}>{err}</div>}
        {fields.map((x) => (
          <div className="field" key={x.key}>
            <label>{x.label}{x.required && " *"}</label>
            {x.type === "select"
              ? <select className="select" value={f[x.key]} onChange={(e) => set(x.key, e.target.value)}>
                  <option value="">— ไม่ระบุ —</option>
                  {x.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              : x.type === "textarea"
                ? <textarea className="input" rows={2} value={f[x.key]} onChange={(e) => set(x.key, e.target.value)} />
                : x.type === "checkbox"
                  ? <label className="row" style={{ gap: 8, fontSize: 13.5, cursor: "pointer" }}>
                      <input type="checkbox" checked={!!f[x.key]} onChange={(e) => set(x.key, e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--accent)" }} />
                      {x.hint || "ใช่"}
                    </label>
                  : <input className="input" type={x.type || "text"} value={f[x.key]} onChange={(e) => set(x.key, e.target.value)} placeholder={x.placeholder} />}
          </div>
        ))}
      </div>
    </Modal>
  );
}

/* ============ เอกสารพนักงาน (STEP 9) ============ */
function EmployeeDocuments({ employeeId, canEdit }) {
  const [rows, setRows] = useP1(null);
  const [up, setUp] = useP1(false);
  const [del, setDel] = useP1(null);

  const reload = async () => {
    const { data, error } = await window.sb.from("employee_documents")
      .select("*").eq("employee_id", employeeId).order("created_at", { ascending: false });
    setRows(error ? [] : (data || []));
  };
  usePE1(() => { reload(); }, [employeeId]);

  const download = async (doc) => {
    if (!doc.file_url) { toast("ไม่มีไฟล์แนบ", "x"); return; }
    const { data, error } = await window.sb.storage.from("employee-docs").createSignedUrl(doc.file_url, 60);
    if (error) { toast("เปิดไฟล์ไม่ได้: " + error.message, "x"); return; }
    await HRC.audit("ดาวน์โหลดเอกสาร", "DOWNLOAD", "employee_documents", doc.id, null, { name: doc.document_name });
    window.open(data.signedUrl, "_blank");
  };
  const remove = async (doc) => {
    if (doc.file_url) await window.sb.storage.from("employee-docs").remove([doc.file_url]);
    const { error } = await window.sb.from("employee_documents").delete().eq("id", doc.id);
    if (error) { toast("ลบไม่สำเร็จ: " + error.message, "x"); return; }
    await HRC.audit("ลบเอกสาร", "DELETE", "employee_documents", doc.id, doc, null);
    await reload(); toast("ลบเอกสารแล้ว", "check"); setDel(null);
  };

  if (rows === null) return <LoadingState />;
  const expiring = rows.filter((r) => ["expired", "soon"].indexOf(HRC.docStatus(r).key) > -1);

  return (
    <div>
      {expiring.length > 0 && (
        <div style={{ background: "var(--red-soft)", color: "#be123c", borderRadius: 11, padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>
          <Icon name="alert" size={15} /> มีเอกสารหมดอายุ/ใกล้หมดอายุ {expiring.length} ฉบับ
        </div>
      )}
      <div className="between" style={{ marginBottom: 12, gap: 10 }}>
        <span className="muted" style={{ fontSize: 13 }}>{rows.length} ฉบับ</span>
        {canEdit && <button className="btn btn-soft btn-sm" onClick={() => setUp(true)}><Icon name="upload" size={14} />อัปโหลดเอกสาร</button>}
      </div>
      {rows.length === 0 ? <EmptyState icon="file" title="ยังไม่มีเอกสาร" sub={canEdit ? "อัปโหลดบัตรประชาชน สัญญาจ้าง วุฒิการศึกษา ฯลฯ" : null} /> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {rows.map((d) => {
            const st = HRC.docStatus(d);
            return (
              <div key={d.id} className="between" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "12px 15px", gap: 12 }}>
                <div className="row" style={{ gap: 11, minWidth: 0 }}>
                  <span style={{ color: "var(--accent)" }}><Icon name="file" size={18} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{d.document_name}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>
                      {HRC.DOC_TYPES[d.document_type] || d.document_type}
                      {d.expiry_date ? " · หมดอายุ " + d.expiry_date : ""}
                      {d.file_size ? " · " + Math.round(d.file_size / 1024) + " KB" : ""}
                    </div>
                  </div>
                </div>
                <div className="row" style={{ gap: 6, flex: "0 0 auto" }}>
                  <Badge cls={st.cls} dot>{st.label}</Badge>
                  {d.file_url && <button className="icon-btn" style={{ width: 30, height: 30 }} title="ดาวน์โหลด" onClick={() => download(d)}><Icon name="download" size={14} /></button>}
                  {canEdit && <button className="icon-btn" style={{ width: 30, height: 30 }} title="ลบ" onClick={() => setDel(d)}><Icon name="x" size={14} color="var(--red)" /></button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {up && <DocumentUpload employeeId={employeeId} onClose={() => setUp(false)} onDone={reload} />}
      {del && <Confirm title="ลบเอกสาร" danger confirmLabel="ลบ" message={"ยืนยันลบ " + del.document_name + " ? ไฟล์จะถูกลบถาวร"}
        onConfirm={() => remove(del)} onClose={() => setDel(null)} />}
    </div>
  );
}

function DocumentUpload({ employeeId, onClose, onDone }) {
  const [f, setF] = useP1({ document_type: "CITIZEN_ID", document_name: "", issue_date: "", expiry_date: "" });
  const [file, setFile] = useP1(null);
  const [busy, setBusy] = useP1(false);
  const [err, setErr] = useP1("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.document_name.trim()) { setErr("กรุณากรอกชื่อเอกสาร"); return; }
    if (file && file.size > 10 * 1024 * 1024) { setErr("ไฟล์ต้องไม่เกิน 10 MB"); return; }
    setErr(""); setBusy(true);
    try {
      let path = null;
      if (file) {
        const ext = (file.name.split(".").pop() || "bin").toLowerCase();
        path = employeeId + "/" + Date.now() + "." + ext;
        const upRes = await window.sb.storage.from("employee-docs").upload(path, file, { contentType: file.type, upsert: false });
        if (upRes.error) throw new Error(upRes.error.message);
      }
      const row = {
        employee_id: employeeId, document_type: f.document_type, document_name: f.document_name.trim(),
        file_url: path, file_name: file ? file.name : null, file_size: file ? file.size : null,
        mime_type: file ? file.type : null, issue_date: f.issue_date || null, expiry_date: f.expiry_date || null,
        uploaded_by: (HRC.user || {}).email || null,
      };
      const { error } = await window.sb.from("employee_documents").insert(row);
      if (error) throw new Error(error.message);
      await HRC.audit("อัปโหลดเอกสาร", "UPLOAD", "employee_documents", employeeId, null, row);
      await onDone(); toast("อัปโหลดเอกสารแล้ว", "check"); onClose();
    } catch (e) { setErr("อัปโหลดไม่สำเร็จ: " + (e.message || e)); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="อัปโหลดเอกสารพนักงาน" onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button className="btn btn-pri" onClick={save} disabled={busy}><Icon name="check" size={15} />{busy ? "กำลังอัปโหลด…" : "บันทึก"}</button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
        {err && <div style={{ padding: "10px 13px", borderRadius: 10, background: "var(--red-soft)", color: "#be123c", fontSize: 13 }}>{err}</div>}
        <div className="field"><label>ประเภทเอกสาร *</label>
          <select className="select" value={f.document_type} onChange={(e) => set("document_type", e.target.value)}>
            {Object.keys(HRC.DOC_TYPES).map((k) => <option key={k} value={k}>{HRC.DOC_TYPES[k]}</option>)}
          </select>
        </div>
        <div className="field"><label>ชื่อเอกสาร *</label>
          <input className="input" value={f.document_name} onChange={(e) => set("document_name", e.target.value)} placeholder="เช่น สำเนาบัตรประชาชน" /></div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field"><label>วันที่ออก</label><input className="input" type="date" value={f.issue_date} onChange={(e) => set("issue_date", e.target.value)} /></div>
          <div className="field"><label>วันหมดอายุ</label><input className="input" type="date" value={f.expiry_date} onChange={(e) => set("expiry_date", e.target.value)} /></div>
        </div>
        <div className="field"><label>ไฟล์แนบ (ไม่เกิน 10 MB)</label>
          <input className="input" type="file" onChange={(e) => setFile(e.target.files && e.target.files[0])} />
          <span className="muted" style={{ fontSize: 11.5 }}>ไฟล์เก็บแบบไม่เปิดสาธารณะ · เปิดดูได้เฉพาะผู้มีสิทธิ์</span>
        </div>
      </div>
    </Modal>
  );
}

/* ============ หน้าโปรไฟล์ (STEP 4) ============ */
function HRCEmployeeProfile({ employeeId, nav }) {
  const [tab, setTab] = useP1("personal");
  const [form, setForm] = useP1(false);
  const [statusOpen, setStatusOpen] = useP1(false);
  const [history, setHistory] = useP1(null);
  const [, force] = useP1(0);

  const e = (HRC.employees || []).find((x) => x.id === employeeId);
  const canEdit = HRC.can("employee.edit");
  const canDocs = HRC.can("employee.documents");

  usePE1(() => {
    if (tab !== "changes" && tab !== "worklog") return;
    (async () => {
      const { data } = await window.sb.from("employee_history")
        .select("*").eq("employee_id", employeeId).order("effective_date", { ascending: false }).order("id", { ascending: false });
      setHistory(data || []);
    })();
  }, [tab, employeeId]);

  if (!e) return <ErrorState text="ไม่พบข้อมูลพนักงานรายนี้" onRetry={() => nav("employees")} />;
  const sm = HRC.statusMeta(e._status);

  const tabs = [
    { id: "personal", label: "ข้อมูลส่วนตัว" },
    { id: "employment", label: "การจ้างงาน" },
    { id: "docs", label: "เอกสาร" },
    { id: "education", label: "การศึกษา" },
    { id: "experience", label: "ประสบการณ์" },
    { id: "skills", label: "ทักษะ" },
    { id: "emergency", label: "ผู้ติดต่อฉุกเฉิน" },
    { id: "changes", label: "ประวัติการเปลี่ยนแปลง" },
  ];

  const Row = ({ label, value }) => (
    <div className="between" style={{ padding: "9px 0", borderBottom: "1px solid var(--border-2)", gap: 14 }}>
      <span className="muted" style={{ fontSize: 13 }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 500, textAlign: "right" }}>{value == null || value === "" ? "—" : value}</span>
    </div>
  );

  return (
    <div className="grid">
      <Crumb items={[{ label: "HR Core" }, { label: "พนักงาน", onClick: () => nav("employees") }, { label: e._fullName }]} />

      {/* ---- ส่วนหัว ---- */}
      <Card className="card-pad">
        <div className="row wrap" style={{ gap: 20 }}>
          {e.photo_url
            ? <img src={e.photo_url} alt={e._fullName} style={{ width: 96, height: 96, borderRadius: 18, objectFit: "cover" }} />
            : <Avatar name={e._fullName} initials={(e._fullName || "?").trim()[0]} color={e.color || "#2563eb"} size={96} fontSize={34} />}
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="row wrap" style={{ gap: 10, marginBottom: 4 }}>
              <h1 style={{ margin: 0, fontSize: 22 }}>{e._fullName}</h1>
              <Badge cls={sm.cls} dot>{sm.label}</Badge>
              {e.source === "recruit" && <Badge cls="b-teal">มาจากระบบสรรหา</Badge>}
            </div>
            <div className="muted" style={{ fontSize: 14.5 }}>
              {e._position ? e._position.position_name : e.position} · {HRC.deptName(e.dept)}
            </div>
            <div className="row wrap" style={{ gap: 20, marginTop: 13 }}>
              {[["รหัสพนักงาน", e.employee_code], ["เริ่มงาน", HRC.fmtDate(e.hire_date)],
                ["อายุงาน", HRC.tenure(e.hire_date)], ["ประเภทการจ้าง", HRC.etypeName(e.employment_type_id)],
                ["ผู้บังคับบัญชา", e._supervisorName || "—"]].map(([k, v]) => (
                <div key={k}><div className="muted" style={{ fontSize: 11.5 }}>{k}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{v}</div></div>
              ))}
            </div>
          </div>
          <div className="row wrap" style={{ gap: 9, alignSelf: "flex-start" }}>
            {canEdit && <button className="btn btn-ghost" onClick={() => setStatusOpen(true)}><Icon name="refresh" size={16} />เปลี่ยนสถานะ</button>}
            {canEdit && <button className="btn btn-pri" onClick={() => setForm(true)}><Icon name="edit" size={16} />แก้ไขข้อมูล</button>}
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ padding: "0 8px" }}><Tabs tabs={tabs} active={tab} onChange={setTab} /></div>
        <div className="card-pad">

          {tab === "personal" && (
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 22 }}>
              <div>
                <div className="side-section" style={{ padding: "0 0 6px", color: "var(--text-3)" }}>ข้อมูลทั่วไป</div>
                <Row label="คำนำหน้า" value={e.prefix} />
                <Row label="ชื่อ" value={e.first_name} />
                <Row label="นามสกุล" value={e.last_name} />
                <Row label="ชื่อเล่น" value={e.nickname} />
                <Row label="เพศ" value={e.gender} />
                <Row label="วันเกิด" value={HRC.fmtDate(e.birth_date)} />
                <Row label="สัญชาติ" value={e.nationality} />
              </div>
              <div>
                <div className="side-section" style={{ padding: "0 0 6px", color: "var(--text-3)" }}>เอกสารประจำตัว & ติดต่อ</div>
                <Row label="เลขบัตรประชาชน" value={e.citizen_id ? <span className="mono">{e.citizen_id}</span> : null} />
                <Row label="Passport" value={e.passport_no} />
                <Row label="เบอร์โทร" value={e.phone} />
                <Row label="อีเมล" value={e.email} />
                <Row label="ที่อยู่" value={e.address} />
                <Row label="วุฒิการศึกษา" value={e.education} />
              </div>
            </div>
          )}

          {tab === "employment" && (
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 22 }}>
              <div>
                <div className="side-section" style={{ padding: "0 0 6px", color: "var(--text-3)" }}>การจ้างงาน</div>
                <Row label="รหัสพนักงาน" value={<span className="mono">{e.employee_code}</span>} />
                <Row label="วันที่เริ่มงาน" value={HRC.fmtDate(e.hire_date)} />
                <Row label="อายุงาน" value={HRC.tenure(e.hire_date)} />
                <Row label="ประเภทการจ้าง" value={HRC.etypeName(e.employment_type_id)} />
                <Row label="สถานะการจ้าง" value={<Badge cls={sm.cls} dot>{sm.label}</Badge>} />
                <Row label="สถานที่ทำงาน" value={e.work_location} />
                {e.resign_date && <Row label="วันที่พ้นสภาพ" value={HRC.fmtDate(e.resign_date)} />}
                {e.resign_reason && <Row label="เหตุผล" value={e.resign_reason} />}
              </div>
              <div>
                <div className="side-section" style={{ padding: "0 0 6px", color: "var(--text-3)" }}>ตำแหน่ง / หน่วยงาน / บังคับบัญชา</div>
                <Row label="ตำแหน่ง" value={e._position ? e._position.position_name : e.position} />
                <Row label="รหัสตำแหน่ง" value={e._position ? <span className="mono">{e._position.position_code}</span> : null} />
                <Row label="ระดับตำแหน่ง" value={e.level} />
                <Row label="หน่วยงาน" value={HRC.deptName(e.dept)} />
                <Row label="หน่วยงานแม่" value={e._dept && e._dept.parent_department_id ? HRC.deptName(e._dept.parent_department_id) : null} />
                <Row label="ผู้บังคับบัญชา" value={e._supervisorName
                  ? <button className="btn btn-ghost btn-sm" onClick={() => nav("employee", e.supervisor_fk || e.supervisor_id)}>{e._supervisorName}</button>
                  : null} />
                {e.source === "recruit" && <Row label="ที่มา" value={"ระบบสรรหา (ผู้สมัคร " + (e.source_candidate_id || "—") + ")"} />}
              </div>
            </div>
          )}

          {tab === "docs" && <EmployeeDocuments employeeId={e.id} canEdit={canDocs} />}

          {tab === "education" && (
            <SubRecordList table="employee_education" employeeId={e.id} canEdit={canEdit}
              title="ประวัติการศึกษา" addLabel="เพิ่มการศึกษา" icon="award" orderBy={{ col: "graduate_year", asc: false }}
              fields={[
                { key: "level", label: "ระดับการศึกษา", required: true, placeholder: "เช่น ปริญญาตรี" },
                { key: "institute", label: "สถาบัน", required: true },
                { key: "major", label: "สาขา" },
                { key: "graduate_year", label: "ปีที่จบ", type: "number", placeholder: "เช่น 2562" },
                { key: "detail", label: "รายละเอียด", type: "textarea" },
              ]}
              renderItem={(r) => (<>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.level}{r.major ? " · " + r.major : ""}</div>
                <div className="muted" style={{ fontSize: 12 }}>{[r.institute, r.graduate_year ? "จบปี " + r.graduate_year : null].filter(Boolean).join(" · ")}</div>
              </>)} />
          )}

          {tab === "experience" && (
            <SubRecordList table="employee_experience" employeeId={e.id} canEdit={canEdit}
              title="ประวัติการทำงาน" addLabel="เพิ่มประสบการณ์" icon="briefcase" orderBy={{ col: "start_date", asc: false }}
              fields={[
                { key: "company", label: "บริษัท", required: true },
                { key: "position", label: "ตำแหน่ง" },
                { key: "start_date", label: "วันที่เริ่ม", type: "date" },
                { key: "end_date", label: "วันที่สิ้นสุด", type: "date" },
                { key: "duties", label: "หน้าที่", type: "textarea" },
                { key: "leave_reason", label: "เหตุผลที่ออก" },
              ]}
              renderItem={(r) => (<>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.company}{r.position ? " · " + r.position : ""}</div>
                <div className="muted" style={{ fontSize: 12 }}>{HRC.fmtDate(r.start_date)} – {r.end_date ? HRC.fmtDate(r.end_date) : "ปัจจุบัน"}{r.leave_reason ? " · " + r.leave_reason : ""}</div>
              </>)} />
          )}

          {tab === "skills" && (
            <SubRecordList table="employee_skills" employeeId={e.id} canEdit={canEdit}
              title="ทักษะ" addLabel="เพิ่มทักษะ" icon="target" orderBy={{ col: "id", asc: true }}
              fields={[
                { key: "skill_name", label: "ชื่อทักษะ", required: true },
                { key: "skill_level", label: "ระดับทักษะ", type: "select",
                  options: Object.keys(HRC.SKILL_LEVELS).map((k) => ({ value: k, label: HRC.SKILL_LEVELS[k] })) },
                { key: "years_experience", label: "ประสบการณ์ (ปี)", type: "number" },
                { key: "detail", label: "รายละเอียด", type: "textarea" },
              ]}
              renderItem={(r) => (<>
                <div className="row" style={{ gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{r.skill_name}</span>
                  {r.skill_level && <Badge cls="b-blue">{HRC.SKILL_LEVELS[r.skill_level] || r.skill_level}</Badge>}
                </div>
                {(r.years_experience || r.detail) && <div className="muted" style={{ fontSize: 12 }}>
                  {[r.years_experience ? r.years_experience + " ปี" : null, r.detail].filter(Boolean).join(" · ")}</div>}
              </>)} />
          )}

          {tab === "emergency" && (
            <SubRecordList table="employee_emergency_contacts" employeeId={e.id} canEdit={canEdit}
              title="ผู้ติดต่อฉุกเฉิน" addLabel="เพิ่มผู้ติดต่อ" icon="phone" orderBy={{ col: "id", asc: true }}
              fields={[
                { key: "name", label: "ชื่อ-นามสกุล", required: true },
                { key: "relationship", label: "ความสัมพันธ์", placeholder: "เช่น คู่สมรส / บิดา" },
                { key: "phone", label: "เบอร์โทร", required: true },
                { key: "address", label: "ที่อยู่", type: "textarea" },
                { key: "is_primary", label: "ผู้ติดต่อหลัก", type: "checkbox", hint: "ติดต่อคนนี้เป็นอันดับแรก" },
              ]}
              renderItem={(r) => (<>
                <div className="row" style={{ gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{r.name}</span>
                  {r.is_primary && <Badge cls="b-green">ผู้ติดต่อหลัก</Badge>}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>{[r.relationship, r.phone].filter(Boolean).join(" · ")}</div>
              </>)} />
          )}

          {tab === "changes" && (
            history === null ? <LoadingState /> :
            history.length === 0 ? <EmptyState icon="clock" title="ยังไม่มีประวัติการเปลี่ยนแปลง" /> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {history.map((h, i) => (
                  <div key={h.id} className="row" style={{ gap: 14, alignItems: "flex-start" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", alignSelf: "stretch" }}>
                      <span style={{ width: 11, height: 11, borderRadius: 999, background: "var(--accent)", marginTop: 6, flex: "0 0 11px" }} />
                      {i < history.length - 1 && <span style={{ width: 2, flex: 1, minHeight: 26, background: "var(--border)" }} />}
                    </div>
                    <div style={{ paddingBottom: 18, minWidth: 0 }}>
                      <div className="row wrap" style={{ gap: 8 }}>
                        <span className="mono" style={{ fontSize: 12, color: "var(--text-2)" }}>{h.effective_date}</span>
                        <Badge cls="b-blue">{HRC.CHANGE_TYPES[h.change_type] || h.change_type}</Badge>
                      </div>
                      <div style={{ fontSize: 13.5, marginTop: 3 }}>
                        {h.change_type === "HIRE" ? "เริ่มงานที่ " + HRC.deptName(h.department_id)
                          : h.change_type === "TRANSFER" ? HRC.deptName(h.old_value) + " → " + HRC.deptName(h.new_value)
                          : (h.old_value || "—") + " → " + (h.new_value || "—")}
                      </div>
                      <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                        โดย {h.changed_by || "ระบบ"}{h.note ? " · " + h.note : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

        </div>
      </Card>

      {form && <HRCEmployeeForm emp={e} onClose={() => setForm(false)} onSaved={() => force((n) => n + 1)} />}
      {statusOpen && <HRCStatusDialog emp={e} onClose={() => setStatusOpen(false)} onSaved={() => force((n) => n + 1)} />}
    </div>
  );
}

Object.assign(window, { HRCEmployeeProfile, EmployeeDocuments, SubRecordList });
