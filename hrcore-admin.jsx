// hrcore-admin.jsx — Users · Roles & Permissions · Audit Logs · รับพนักงานจากระบบสรรหา
const { useState: useA1, useEffect: useAE1 } = React;

/* ================= Users (STEP 15) ================= */
function HRCUsers() {
  const [edit, setEdit] = useA1(null);
  const canManage = HRC.can("user.manage");
  const users = HRC.users || [];
  const empName = (id) => { const e = (HRC.employees || []).find((x) => x.id === id); return e ? e._fullName : null; };

  const columns = [
    { key: "name", label: "ผู้ใช้", render: (r) => (
      <div className="row" style={{ gap: 9 }}>
        <Avatar name={r.name} initials={(r.name || "?").trim()[0]} color={r.active ? "#2563eb" : "#94a3b8"} size={28} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{r.name}</div>
          <div className="muted" style={{ fontSize: 11.5 }}>{r.email}</div>
        </div>
      </div>) },
    { key: "role_code", label: "บทบาท", render: (r) => <Badge cls="b-blue">{r.role_code || "—"}</Badge> },
    { key: "employee_id", label: "ผูกกับพนักงาน", sortValue: (r) => empName(r.employee_id) || "",
      render: (r) => r.employee_id
        ? <span>{empName(r.employee_id) || r.employee_id}<span className="mono muted" style={{ fontSize: 11 }}> · {r.employee_id}</span></span>
        : <span style={{ color: "var(--red)" }}>ยังไม่ผูก</span> },
    { key: "auth_uid", label: "บัญชีล็อกอิน", align: "center", sortValue: (r) => (r.auth_uid ? 1 : 0),
      render: (r) => <Badge cls={r.auth_uid ? "b-green" : "b-amber"} dot>{r.auth_uid ? "มี" : "ยังไม่มี"}</Badge> },
    { key: "active", label: "สถานะ", align: "center", sortValue: (r) => (r.active ? 1 : 0),
      render: (r) => <Badge cls={r.active ? "b-green" : "b-gray"} dot>{r.active ? "ใช้งาน" : "ระงับ"}</Badge> },
  ];

  return (
    <div className="grid">
      <Crumb items={[{ label: "HR Core" }, { label: "ผู้ใช้ระบบ" }]} />
      <div className="page-head">
        <div><h1>ผู้ใช้ระบบ</h1><p>บัญชีผู้ใช้ต้องผูกกับพนักงานใน HR Core · ไม่เก็บข้อมูลพนักงานซ้ำ</p></div>
      </div>
      <Card>
        <DataTable rows={users} columns={columns} rowKey={(r) => r.id}
          onRowClick={canManage ? (r) => setEdit(r) : undefined}
          searchFields={["name", "email", "role_code", (r) => empName(r.employee_id) || ""]}
          filters={[{ key: "role", label: "บทบาท", options: [...new Set(users.map((u) => u.role_code).filter(Boolean))].map((c) => ({ value: c, label: c })), test: (r, v) => r.role_code === v }]}
          exportName="hr_core_users" emptyTitle="ไม่พบผู้ใช้" />
      </Card>
      {edit && <HRCUserForm user={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function HRCUserForm({ user, onClose }) {
  const [roleCode, setRoleCode] = useA1(user.role_code || "EMPLOYEE");
  const [empId, setEmpId] = useA1(user.employee_id || "");
  const [active, setActive] = useA1(!!user.active);
  const [roles, setRoles] = useA1([]);
  const [busy, setBusy] = useA1(false);
  const [err, setErr] = useA1("");

  useAE1(() => { (async () => {
    const { data } = await window.sb.from("roles").select("*").order("rank");
    setRoles(data || []);
  })(); }, []);

  const save = async () => {
    setErr(""); setBusy(true);
    const before = { role_code: user.role_code, employee_id: user.employee_id, active: user.active };
    const after = { role_code: roleCode, employee_id: empId || null, active };
    const { error } = await window.sb.from("app_users").update(after).eq("id", user.id);
    setBusy(false);
    if (error) { setErr("บันทึกไม่สำเร็จ: " + error.message); return; }
    await HRC.audit("แก้ไขสิทธิ์ผู้ใช้", "UPDATE", "app_users", user.id, before, after);
    await HRC.load(); toast("บันทึกผู้ใช้แล้ว", "check"); onClose();
  };

  return (
    <HRCDrawer title="แก้ไขผู้ใช้ระบบ" sub={user.email} onClose={onClose} width={460}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button className="btn btn-pri" onClick={save} disabled={busy}><Icon name="check" size={15} />{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {err && <div style={{ padding: "10px 13px", borderRadius: 10, background: "var(--red-soft)", color: "#be123c", fontSize: 13 }}>{err}</div>}
        <div className="field"><label>บทบาท (Role)</label>
          <select className="select" value={roleCode} onChange={(e) => setRoleCode(e.target.value)}>
            {roles.map((r) => <option key={r.code} value={r.code}>{r.code} · {r.name}</option>)}
          </select></div>
        <div className="field"><label>ผูกกับพนักงาน</label>
          <select className="select" value={empId} onChange={(e) => setEmpId(e.target.value)}>
            <option value="">— ไม่ผูก —</option>
            {(HRC.employees || []).map((e) => <option key={e.id} value={e.id}>{e.employee_code} · {e._fullName}</option>)}
          </select>
          <span className="muted" style={{ fontSize: 11.5 }}>ข้อมูลพนักงานดึงจาก HR Core เท่านั้น ไม่เก็บซ้ำในบัญชีผู้ใช้</span>
        </div>
        <label className="row" style={{ gap: 9, fontSize: 13.5, cursor: "pointer" }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--accent)" }} />
          เปิดใช้งานบัญชี
        </label>
      </div>
    </HRCDrawer>
  );
}

/* ================= Roles & Permissions (STEP 16) ================= */
function HRCRoles() {
  const [roles, setRoles] = useA1(null);
  const [perms, setPerms] = useA1([]);
  const [matrix, setMatrix] = useA1({});
  const [busy, setBusy] = useA1("");
  const canManage = HRC.can("role.manage");

  const reload = async () => {
    const [r, p, rp] = await Promise.all([
      window.sb.from("roles").select("*").order("rank"),
      window.sb.from("permissions").select("*").order("grp"),
      window.sb.from("role_permissions").select("*"),
    ]);
    setRoles(r.data || []); setPerms(p.data || []);
    const m = {}; (rp.data || []).forEach((x) => { m[x.role_code + "|" + x.permission_code] = true; });
    setMatrix(m);
  };
  useAE1(() => { reload(); }, []);

  const toggle = async (role, perm) => {
    if (!canManage) return;
    const key = role + "|" + perm, on = !!matrix[key];
    setBusy(key);
    const { error } = on
      ? await window.sb.from("role_permissions").delete().eq("role_code", role).eq("permission_code", perm)
      : await window.sb.from("role_permissions").insert({ role_code: role, permission_code: perm });
    setBusy("");
    if (error) { toast("ไม่สำเร็จ: " + error.message, "x"); return; }
    await HRC.audit((on ? "ถอน" : "ให้") + "สิทธิ์ " + perm + " แก่ " + role, "UPDATE", "role_permissions", role, { perm, had: on }, { perm, had: !on });
    setMatrix((p) => ({ ...p, [key]: !on }));
    await HRC.loadPermissions();
  };

  if (roles === null) return <LoadingState />;
  const groups = [...new Set(perms.map((p) => p.grp))];

  return (
    <div className="grid">
      <Crumb items={[{ label: "HR Core" }, { label: "บทบาทและสิทธิ์" }]} />
      <div className="page-head">
        <div><h1>บทบาทและสิทธิ์</h1><p>ตารางสิทธิ์ (RBAC) · ตรวจสอบซ้ำที่ฐานข้อมูลเสมอ</p></div>
      </div>
      {!canManage && (
        <div style={{ background: "var(--accent-soft)", color: "var(--accent-700)", borderRadius: 11, padding: "11px 15px", fontSize: 13 }}>
          <Icon name="lock" size={15} /> คุณดูได้อย่างเดียว — ต้องมีสิทธิ์ <b>role.manage</b> จึงจะแก้ไขได้
        </div>
      )}
      <Card>
        <CardHead title="ตารางสิทธิ์" sub={roles.length + " บทบาท · " + perms.length + " สิทธิ์"} />
        <div className="card-pad" style={{ overflowX: "auto" }}>
          <table className="tbl" style={{ minWidth: 760, fontSize: 12.5 }}>
            <thead><tr>
              <th scope="col" style={{ minWidth: 190 }}>สิทธิ์</th>
              {roles.map((r) => <th key={r.code} scope="col" style={{ textAlign: "center", whiteSpace: "nowrap" }}>{r.code}</th>)}
            </tr></thead>
            <tbody>
              {groups.map((g) => (
                <React.Fragment key={g}>
                  <tr><td colSpan={roles.length + 1} style={{ background: "var(--surface-2)", fontWeight: 700, fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-3)" }}>{g}</td></tr>
                  {perms.filter((p) => p.grp === g).map((p) => (
                    <tr key={p.code}>
                      <td><div style={{ fontWeight: 600 }}>{p.name}</div><div className="mono muted" style={{ fontSize: 10.5 }}>{p.code}</div></td>
                      {roles.map((r) => {
                        const key = r.code + "|" + p.code, on = !!matrix[key];
                        return (
                          <td key={r.code} style={{ textAlign: "center" }}>
                            <button aria-label={(on ? "ถอน" : "ให้") + "สิทธิ์"} disabled={!canManage || busy === key}
                              onClick={() => toggle(r.code, p.code)}
                              style={{ width: 24, height: 24, borderRadius: 7, cursor: canManage ? "pointer" : "default",
                                border: "1px solid " + (on ? "transparent" : "var(--border)"),
                                background: on ? "#16a34a" : "var(--surface)", color: "#fff", display: "grid", placeItems: "center" }}>
                              {on && <Icon name="check" size={13} />}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ================= Audit Logs (STEP 18) ================= */
function HRCAudit() {
  const [rows, setRows] = useA1(null);
  const [err, setErr] = useA1("");
  const [detail, setDetail] = useA1(null);

  const reload = async () => {
    setErr("");
    const { data, error } = await window.sb.from("audit_log").select("*").order("at", { ascending: false }).limit(400);
    if (error) { setErr(error.message); setRows([]); return; }
    setRows(data || []);
  };
  useAE1(() => { reload(); }, []);

  if (rows === null) return <LoadingState />;
  if (err) return <ErrorState text={err} onRetry={reload} />;

  const TYPE_CLS = { CREATE: "b-green", UPDATE: "b-blue", DELETE: "b-red", STATUS_CHANGE: "b-amber",
    UPLOAD: "b-teal", DOWNLOAD: "b-gray", LOGIN: "b-gray", LOGOUT: "b-gray" };

  const columns = [
    { key: "at", label: "เวลา", width: 150, render: (r) => <span className="mono" style={{ fontSize: 11.5 }}>{r.at ? new Date(r.at).toLocaleString("th-TH") : "—"}</span> },
    { key: "actor_email", label: "ผู้ทำ", render: (r) => <span style={{ fontSize: 12.5 }}>{r.actor_email || "ระบบ"}</span> },
    { key: "action_type", label: "ประเภท", align: "center",
      render: (r) => r.action_type ? <Badge cls={TYPE_CLS[r.action_type] || "b-gray"}>{r.action_type}</Badge> : <span className="muted">—</span> },
    { key: "action", label: "การกระทำ", render: (r) => <span style={{ fontWeight: 600, fontSize: 12.5 }}>{r.action}</span> },
    { key: "entity", label: "ข้อมูล", render: (r) => <span className="mono muted" style={{ fontSize: 11.5 }}>{r.entity || "—"}{r.entity_id ? " · " + r.entity_id : ""}</span> },
    { key: "diff", label: "", width: 60, sortable: false, export: false,
      render: (r) => (r.before || r.after) ? <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setDetail(r); }}>ดู</button> : null },
  ];

  return (
    <div className="grid">
      <Crumb items={[{ label: "HR Core" }, { label: "บันทึกการใช้งาน" }]} />
      <div className="page-head">
        <div><h1>บันทึกการใช้งาน (Audit Log)</h1><p>บันทึกทุกการเปลี่ยนแปลงสำคัญ · แสดง 400 รายการล่าสุด</p></div>
        <button className="btn btn-ghost" onClick={reload}><Icon name="refresh" size={16} />รีเฟรช</button>
      </div>
      <Card>
        <DataTable rows={rows} columns={columns} rowKey={(r) => r.id} pageSize={30}
          searchFields={["actor_email", "action", "entity", "entity_id", "action_type"]}
          filters={[{ key: "type", label: "ประเภท", options: [...new Set(rows.map((r) => r.action_type).filter(Boolean))].map((t) => ({ value: t, label: t })), test: (r, v) => r.action_type === v }]}
          exportName="hr_core_audit" emptyTitle="ยังไม่มีบันทึก" />
      </Card>
      {detail && <AuditDetail row={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function AuditDetail({ row, onClose }) {
  const before = row.before || {}, after = row.after || {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    .filter((k) => ["updated_at", "created_at"].indexOf(k) === -1);
  const show = (v) => v == null ? "—" : (typeof v === "object" ? JSON.stringify(v) : String(v));

  return (
    <HRCDrawer title="รายละเอียดการเปลี่ยนแปลง" sub={row.action + " · " + (row.entity || "") + (row.entity_id ? " " + row.entity_id : "")}
      onClose={onClose} width={520}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="muted" style={{ fontSize: 12.5 }}>
          โดย {row.actor_email || "ระบบ"} · {row.at ? new Date(row.at).toLocaleString("th-TH") : ""}
        </div>
        {keys.length === 0 ? <EmptyState icon="file" title="ไม่มีความเปลี่ยนแปลงของฟิลด์" /> : (
          <table className="tbl" style={{ fontSize: 12.5 }}>
            <thead><tr><th scope="col">ฟิลด์</th><th scope="col">ก่อน</th><th scope="col">หลัง</th></tr></thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k}>
                  <td className="mono" style={{ fontSize: 11.5 }}>{k}</td>
                  <td style={{ color: "var(--red)" }}>{show(before[k])}</td>
                  <td style={{ color: "#16a34a" }}>{show(after[k])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </HRCDrawer>
  );
}

Object.assign(window, { HRCUsers, HRCRoles, HRCAudit });
