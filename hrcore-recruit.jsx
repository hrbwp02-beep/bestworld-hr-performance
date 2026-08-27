// hrcore-recruit.jsx — รับพนักงานจากระบบสรรหา (bwp-recruitment) · STEP 19
// ดึงผู้สมัครจริงผ่าน Edge Function recruit-bridge (ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์ · กุญแจไม่อยู่ในเบราว์เซอร์)
const { useState: useR1, useEffect: useRE1 } = React;

const RECRUIT_STATUS = {
  approved: { label: "อนุมัติแล้ว", cls: "b-blue" },
  contract: { label: "ทำสัญญา", cls: "b-teal" },
  probation: { label: "ทดลองงาน", cls: "b-amber" },
  hired: { label: "บรรจุแล้ว", cls: "b-green" },
};

function HRCRecruitIntake({ nav }) {
  const [rows, setRows] = useR1(null);
  const [err, setErr] = useR1("");
  const [pick, setPick] = useR1(null);
  const canCreate = HRC.can("employee.create");

  const load = async () => {
    setErr(""); setRows(null);
    const { data, error } = await window.sb.functions.invoke("recruit-bridge", { body: { action: "list_ready" } });
    if (error) { setErr(error.message || "เชื่อมต่อระบบสรรหาไม่สำเร็จ"); setRows([]); return; }
    if (!data || !data.ok) { setErr((data && data.error) || "ดึงข้อมูลไม่สำเร็จ"); setRows([]); return; }
    setRows(data.applicants || []);
  };
  useRE1(() => { load(); }, []);

  const pending = (rows || []).filter((r) => !r.already_employee_id);
  const done = (rows || []).filter((r) => r.already_employee_id);

  return (
    <div className="grid">
      <Crumb items={[{ label: "HR Core" }, { label: "รับจากสรรหา" }]} />
      <div className="page-head">
        <div><h1>รับพนักงานจากระบบสรรหา</h1><p>ผู้สมัครที่ผ่านอนุมัติจากระบบ bwp-recruitment · สร้างเป็นพนักงานใน HR Core</p></div>
        <div className="row wrap" style={{ gap: 9 }}>
          {(HRC.settings && HRC.settings.recruit_app_url) && (
            <a className="btn btn-ghost" href={HRC.settings.recruit_app_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              <Icon name="briefcase" size={16} />เปิดระบบสรรหา
            </a>
          )}
          <button className="btn btn-ghost" onClick={load}><Icon name="refresh" size={16} />โหลดใหม่</button>
        </div>
      </div>

      <div style={{ background: "var(--accent-soft)", color: "var(--accent-700)", borderRadius: 12, padding: "12px 16px", fontSize: 13, lineHeight: 1.75 }}>
        ข้อมูลผู้สมัครดึงสดจากระบบสรรหา (คนละฐานข้อมูล) ผ่านช่องทางที่ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์ ·
        เมื่อกดบรรจุ ระบบจะ <b>ตรวจซ้ำ → ออกรหัสพนักงาน → สร้างพนักงาน → บันทึกกลับไปที่ใบสมัคร → เขียน Audit</b> ให้อัตโนมัติ
      </div>

      {!canCreate && (
        <div style={{ background: "var(--red-soft)", color: "#be123c", borderRadius: 11, padding: "11px 15px", fontSize: 13 }}>
          <Icon name="lock" size={15} /> ต้องมีสิทธิ์ <b>employee.create</b> จึงจะบรรจุพนักงานได้ (ดูได้อย่างเดียว)
        </div>
      )}

      {rows === null ? <Card><LoadingState text="กำลังเชื่อมต่อระบบสรรหา…" /></Card>
        : err ? <Card><ErrorState text={err} onRetry={load} /></Card>
        : (<>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))" }}>
            <Stat icon="users" label="ผู้สมัครพร้อมบรรจุ" value={pending.length} unit="คน" tone="#2563eb" soft="#e8effb" />
            <Stat icon="checkCircle" label="บรรจุแล้ว" value={done.length} unit="คน" tone="#16a34a" soft="#e7f6ec" />
            <Stat icon="alert" label="ยังไม่จับคู่หน่วยงาน" value={pending.filter((r) => !r.dept_mapped).length} unit="คน"
              tone={pending.some((r) => !r.dept_mapped) ? "#e08a00" : "#64748b"} soft={pending.some((r) => !r.dept_mapped) ? "#fdf1dc" : "#eef1f6"} />
          </div>

          <Card>
            <CardHead title="รอบรรจุเป็นพนักงาน" sub={pending.length + " คน"} />
            <div style={{ padding: "8px 14px" }}>
              {pending.length === 0
                ? <EmptyState icon="checkCircle" title="ไม่มีผู้สมัครรอบรรจุ" sub="ผู้สมัครที่ผ่านอนุมัติในระบบสรรหาจะแสดงที่นี่" />
                : pending.map((r) => {
                  const st = RECRUIT_STATUS[r.status] || { label: r.status, cls: "b-gray" };
                  return (
                    <div key={r.candidate_id} className="between" style={{ padding: "13px 6px", borderBottom: "1px solid var(--border-2)", gap: 12 }}>
                      <div className="row" style={{ gap: 11, minWidth: 0 }}>
                        <Avatar name={r.full_name} initials={(r.first_name || "?")[0]} color="#0d9488" size={34} />
                        <div style={{ minWidth: 0 }}>
                          <div className="row wrap" style={{ gap: 7 }}>
                            <span style={{ fontWeight: 600, fontSize: 13.5 }}>{r.full_name}</span>
                            <Badge cls={st.cls} dot>{st.label}</Badge>
                            {!r.dept_mapped && <Badge cls="b-amber">ยังไม่จับคู่หน่วยงาน</Badge>}
                          </div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {r.position || "ไม่ระบุตำแหน่ง"} · {r.recruit_department || "—"}
                            {r.start_date ? " · เริ่มงาน " + r.start_date : ""}
                          </div>
                        </div>
                      </div>
                      <button className="btn btn-pri btn-sm" disabled={!canCreate} onClick={() => setPick(r)}>
                        <Icon name="plus" size={14} />บรรจุ
                      </button>
                    </div>
                  );
                })}
            </div>
          </Card>

          {done.length > 0 && (
            <Card>
              <CardHead title="บรรจุเข้า HR Core แล้ว" sub={done.length + " คน"} />
              <div style={{ padding: "8px 14px" }}>
                {done.map((r) => (
                  <div key={r.candidate_id} className="between" style={{ padding: "10px 6px", borderBottom: "1px solid var(--border-2)", gap: 10 }}>
                    <div className="row" style={{ gap: 10, minWidth: 0 }}>
                      <Avatar name={r.full_name} initials={(r.first_name || "?")[0]} color="#16a34a" size={28} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{r.full_name}</div>
                        <div className="mono muted" style={{ fontSize: 11 }}>พนักงาน {r.already_employee_id}</div>
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={() => nav("employee", r.already_employee_id)}>ดูโปรไฟล์<Icon name="chevRight" size={14} /></button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>)}

      {pick && <HireDialog applicant={pick} onClose={() => setPick(null)} onDone={load} nav={nav} />}
    </div>
  );
}

/* ---------- กล่องยืนยันการบรรจุ ---------- */
function HireDialog({ applicant: a, onClose, onDone, nav }) {
  const [deptId, setDeptId] = useR1(a.dept_id || "");
  const [positionId, setPositionId] = useR1("");
  const [supervisorId, setSupervisorId] = useR1("");
  const [etype, setEtype] = useR1("prob");
  const [markHired, setMarkHired] = useR1(true);
  const [busy, setBusy] = useR1(false);
  const [result, setResult] = useR1(null);

  const positions = (HRC.positions || []).filter((p) => !deptId || p.department_id === deptId);

  const submit = async () => {
    if (!deptId) { setResult({ ok: false, error: "กรุณาเลือกหน่วยงาน" }); return; }
    setBusy(true); setResult(null);
    const { data, error } = await window.sb.functions.invoke("recruit-bridge", {
      body: {
        action: "hire", candidate_id: a.candidate_id, dept_id: deptId,
        position_id: positionId || null, supervisor_id: supervisorId || null,
        employment_type: etype, set_status_hired: markHired,
      },
    });
    setBusy(false);
    if (error) { setResult({ ok: false, error: error.message }); return; }
    setResult(data);
    if (data && data.ok) {
      await HRC.load();
      toast("บรรจุ " + a.full_name + " เป็นพนักงาน " + data.employee_code + " แล้ว", "check");
      await onDone();
    }
  };

  return (
    <Modal title={"บรรจุเป็นพนักงาน · " + a.full_name} onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>ปิด</button>
        {!(result && result.ok) && (
          <button className="btn btn-pri" onClick={submit} disabled={busy}>
            <Icon name="check" size={15} />{busy ? "กำลังบรรจุ…" : "ยืนยันบรรจุ"}
          </button>
        )}
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: "var(--surface-2)", borderRadius: 11, padding: "12px 15px", fontSize: 13, lineHeight: 1.8 }}>
          <div><b>ข้อมูลจากระบบสรรหา</b></div>
          <div className="muted">ตำแหน่ง: {a.position || "—"} · หน่วยงาน(สรรหา): {a.recruit_department || "—"}</div>
          <div className="muted">วันเกิด: {a.birth_date || "—"} · โทร: {a.phone || "—"}</div>
          <div className="muted">เลขบัตร: {a.national_id || "—"} · เริ่มงาน: {a.start_date || "ยังไม่ระบุ (จะใช้วันนี้)"}</div>
        </div>

        <div className="field"><label>หน่วยงานใน HR Core *</label>
          <select className="select" value={deptId} onChange={(e) => { setDeptId(e.target.value); setPositionId(""); }}>
            <option value="">— เลือกหน่วยงาน —</option>
            {(HRC.departments || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {!a.dept_mapped && <span className="muted" style={{ fontSize: 11.5 }}>ยังไม่มีการจับคู่หน่วยงาน “{a.recruit_department}” — เลือกเองครั้งนี้ หรือตั้งค่าถาวรที่ตารางจับคู่</span>}
        </div>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="field"><label>ตำแหน่งใน HR Core</label>
            <select className="select" value={positionId} onChange={(e) => setPositionId(e.target.value)}>
              <option value="">— ใช้ชื่อจากสรรหา —</option>
              {positions.map((p) => <option key={p.id} value={p.id}>{p.position_name}</option>)}
            </select></div>
          <div className="field"><label>ประเภทการจ้าง</label>
            <select className="select" value={etype} onChange={(e) => setEtype(e.target.value)}>
              {(HRC.employmentTypes || []).filter((t) => t.is_active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select></div>
        </div>

        <div className="field"><label>ผู้บังคับบัญชา</label>
          <select className="select" value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)}>
            <option value="">— ไม่ระบุ —</option>
            {(HRC.employees || []).filter((e) => HRC.isActive(e) && (!deptId || e.dept === deptId)).map((e) =>
              <option key={e.id} value={e.id}>{e._fullName}</option>)}
          </select></div>

        <label className="row" style={{ gap: 9, fontSize: 13.5, cursor: "pointer" }}>
          <input type="checkbox" checked={markHired} onChange={(e) => setMarkHired(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--accent)" }} />
          เปลี่ยนสถานะในระบบสรรหาเป็น “บรรจุแล้ว (hired)”
        </label>

        {result && (
          <div style={{ borderRadius: 10, padding: "11px 14px", fontSize: 13,
            background: result.ok ? "var(--green-soft,#e7f6ec)" : "var(--red-soft)",
            color: result.ok ? "#15803d" : "#be123c" }}>
            {result.ok ? (<>
              บรรจุสำเร็จ · รหัสพนักงาน <b>{result.employee_code}</b>
              {result.linked_back === false && <div style={{ marginTop: 4 }}>⚠ สร้างพนักงานแล้ว แต่บันทึกกลับระบบสรรหาไม่สำเร็จ</div>}
              <div style={{ marginTop: 8 }}>
                <button className="btn btn-soft btn-sm" onClick={() => { onClose(); nav("employee", result.employee_id); }}>เปิดโปรไฟล์พนักงาน</button>
              </div>
            </>) : (<>ไม่สำเร็จ: {result.error}{result.employee_id ? " (พนักงาน " + result.employee_id + ")" : ""}</>)}
          </div>
        )}
      </div>
    </Modal>
  );
}

Object.assign(window, { HRCRecruitIntake, HireDialog });
