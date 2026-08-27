// hrcore-core.jsx — HR Core : ชั้นข้อมูลและสิทธิ์ (services/lib)
// ใช้ Supabase เดียวกับระบบประเมิน · employees = Single Source of Truth
const HRC = {};

/* ---------- ค่าคงที่ (ไม่ hard-code ใน UI) ---------- */
HRC.EMP_STATUS = {
  ACTIVE:     { label: "ทำงานอยู่",  cls: "b-green" },
  PROBATION:  { label: "ทดลองงาน",  cls: "b-amber" },
  ON_LEAVE:   { label: "ลาพักงาน",  cls: "b-blue"  },
  SUSPENDED:  { label: "พักงาน",     cls: "b-amber" },
  RESIGNED:   { label: "ลาออก",      cls: "b-gray"  },
  TERMINATED: { label: "เลิกจ้าง",   cls: "b-red"   },
  RETIRED:    { label: "เกษียณ",     cls: "b-blue"  },
};
HRC.statusMeta = (s) => HRC.EMP_STATUS[(s || "ACTIVE").toUpperCase()] || HRC.EMP_STATUS.ACTIVE;
HRC.ACTIVE_SET = ["ACTIVE", "PROBATION", "ON_LEAVE", "SUSPENDED"];

HRC.DOC_TYPES = {
  CITIZEN_ID: "บัตรประชาชน", PASSPORT: "Passport", WORK_PERMIT: "Work Permit", VISA: "Visa",
  CONTRACT: "สัญญาจ้าง", EDUCATION: "วุฒิการศึกษา", CERTIFICATE: "ใบรับรอง",
  RESIGNATION: "เอกสารลาออก", OTHER: "เอกสารอื่น ๆ",
};
HRC.SKILL_LEVELS = { BASIC: "พื้นฐาน", INTERMEDIATE: "ปานกลาง", ADVANCED: "ชำนาญ", EXPERT: "เชี่ยวชาญ" };
HRC.CHANGE_TYPES = {
  HIRE: "เริ่มงาน", TRANSFER: "ย้ายหน่วยงาน", PROMOTION: "เปลี่ยนตำแหน่ง", SUPERVISOR: "เปลี่ยนหัวหน้า",
  EMPLOYMENT_TYPE: "เปลี่ยนประเภทการจ้าง", STATUS: "เปลี่ยนสถานะ", INFO: "แก้ไขข้อมูล", RESIGN: "พ้นสภาพ",
};

/* ---------- สิทธิ์ (ตรวจซ้ำที่ฝั่ง DB ด้วย RLS เสมอ) ---------- */
HRC.perms = [];
HRC.can = (code) => HRC.perms.indexOf(code) > -1;
HRC.loadPermissions = async () => {
  try {
    const { data, error } = await window.sb.rpc("my_permissions");
    HRC.perms = error ? [] : (data || []);
  } catch (e) { HRC.perms = []; }
  return HRC.perms;
};

/* ---------- ผู้ใช้ปัจจุบัน ---------- */
HRC.loadCurrentUser = async () => {
  const { data } = await window.sb.auth.getUser();
  const email = (data && data.user && data.user.email || "").toLowerCase();
  if (!email) return null;
  const { data: u } = await window.sb.from("app_users").select("*").ilike("email", email).maybeSingle();
  HRC.user = u || { email, name: email.split("@")[0], role: "viewer" };
  return HRC.user;
};

/* ---------- โหลดข้อมูลหลัก ---------- */
HRC.load = async () => {
  const [emps, depts, poss, etypes, users, settings] = await Promise.all([
    window.sb.from("employees").select("*").order("employee_code"),
    window.sb.from("departments").select("*").order("sort"),
    window.sb.from("positions").select("*").order("position_name"),
    window.sb.from("employment_types").select("*").order("sort"),
    window.sb.from("app_users").select("*"),
    window.sb.from("app_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  const err = [emps, depts, poss, etypes, users].find((r) => r.error);
  if (err) throw new Error(err.error.message);

  HRC.departments = depts.data || [];
  HRC.positions = poss.data || [];
  HRC.employmentTypes = etypes.data || [];
  HRC.users = users.data || [];
  HRC.settings = settings.data || {};

  const dMap = {}; HRC.departments.forEach((d) => { dMap[d.id] = d; });
  const pMap = {}; HRC.positions.forEach((p) => { pMap[p.id] = p; });
  const eMap = {}; HRC.employmentTypes.forEach((t) => { eMap[t.id] = t; });
  HRC.deptMap = dMap; HRC.posMap = pMap; HRC.etypeMap = eMap;

  HRC.employees = (emps.data || []).map((e) => ({
    ...e,
    _status: (e.employment_status || "ACTIVE").toUpperCase(),
    _dept: dMap[e.dept] || null,
    _position: pMap[e.position_id] || null,
    _etype: eMap[e.employment_type_id] || null,
    _fullName: e.name || [e.first_name, e.last_name].filter(Boolean).join(" "),
  }));
  const nameById = {}; HRC.employees.forEach((e) => { nameById[e.id] = e._fullName; });
  HRC.employees.forEach((e) => { e._supervisorName = nameById[e.supervisor_fk || e.supervisor_id] || null; });
  return HRC;
};

HRC.deptName = (id) => (HRC.deptMap && HRC.deptMap[id] ? HRC.deptMap[id].name : (id || "—"));
HRC.posName = (id) => (HRC.posMap && HRC.posMap[id] ? HRC.posMap[id].position_name : "—");
HRC.etypeName = (id) => (HRC.etypeMap && HRC.etypeMap[id] ? HRC.etypeMap[id].name : "—");
HRC.isActive = (e) => HRC.ACTIVE_SET.indexOf(e._status || "ACTIVE") > -1;

/* ---------- เขียน audit จากฝั่งแอป (DB มี trigger อยู่แล้วสำหรับ employees) ---------- */
HRC.audit = async (action, actionType, entity, entityId, before, after) => {
  try {
    await window.sb.from("audit_log").insert({
      actor_email: (HRC.user || {}).email || null, action, action_type: actionType,
      entity, entity_id: entityId ? String(entityId) : null, before: before || null, after: after || null,
    });
  } catch (e) { /* ไม่ให้ล้มงานหลัก */ }
};

/* ---------- ตัวช่วยทั่วไป ---------- */
HRC.fmtDate = (d) => { if (!d) return "—"; try { const x = new Date(d); return x.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" }); } catch (e) { return String(d); } };
HRC.tenure = (d) => {
  if (!d) return "—";
  const s = new Date(d); if (isNaN(s)) return "—";
  const m = Math.max(0, Math.floor((Date.now() - s) / (30.44 * 86400000)));
  const y = Math.floor(m / 12), mm = m % 12;
  return (y ? y + " ปี " : "") + mm + " เดือน";
};
HRC.docStatus = (doc) => {
  if (!doc.expiry_date) return { key: "none", label: "ไม่มีวันหมดอายุ", cls: "b-gray" };
  const days = Math.ceil((new Date(doc.expiry_date) - Date.now()) / 86400000);
  if (days < 0) return { key: "expired", label: "หมดอายุแล้ว", cls: "b-red", days };
  if (days <= 60) return { key: "soon", label: "ใกล้หมดอายุ (" + days + " วัน)", cls: "b-amber", days };
  return { key: "ok", label: "ยังไม่หมดอายุ", cls: "b-green", days };
};

window.HRC = HRC;
