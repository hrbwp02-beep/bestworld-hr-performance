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
    hire_date: (emp && emp.hire_date) || "", email: (emp && emp.email) || "", phone: (emp && emp.phone) || "",
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
      level: f.level, hire_date: f.hire_date || null, tenure: f.hire_date ? tenureFrom(f.hire_date) : null,
      email: f.email.trim() || null, phone: f.phone.trim() || null,
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
          <div className="field"><label>ระดับ</label><select className="select" value={f.level} onChange={(e) => set("level", e.target.value)}>{[...new Set([...(window.LEVELS || []), ...(window.EMPLOYEES || []).map((x) => x.level).filter(Boolean), f.level].filter(Boolean))].map((l) => <option key={l} value={l}>{l}</option>)}</select></div>
        </div>
        <div className="field"><label>ตำแหน่ง *</label><input className="input" value={f.position} onChange={(e) => setF((p) => ({ ...p, position: e.target.value, level: levelFromPosition(e.target.value) }))} placeholder="เช่น หัวหน้าแผนกฉีดพลาสติก" /><span className="muted" style={{ fontSize: 12 }}>ระดับจะถูกแนะนำจากตำแหน่งโดยอัตโนมัติ (เปลี่ยนเองได้)</span></div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="field"><label>อีเมล</label><input className="input" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="name@bestworld.co.th" /></div>
          <div className="field"><label>เบอร์โทร</label><input className="input" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="08xxxxxxxx" /></div>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="field"><label>วันเข้างาน</label><input className="input" type="date" value={f.hire_date || ""} onChange={(e) => set("hire_date", e.target.value)} /><span className="muted" style={{ fontSize: 12 }}>อายุงาน: {f.hire_date ? tenureFrom(f.hire_date) : "—"}</span></div>
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

/* ---------- Excel import ---------- */
function downloadEmpTemplate() {
  downloadCSV("employee_import_template.csv",
    ["รหัสพนักงาน", "ชื่อ-นามสกุล", "หน่วยงาน", "ตำแหน่ง", "ระดับ", "วันเข้างาน", "อีเมล", "เบอร์โทร", "KPI", "Competency"],
    [["EMP001", "สมหญิง ใจดี", "prod", "พนักงานควบคุมเครื่องฉีด", "ปฏิบัติการ", "2023-03-15", "somying@bestworld.co.th", "0810000000", "78", "80"]]);
}

function ImportEmployeesModal({ ctx, onClose }) {
  const [rows, setRows] = useS2([]);
  const [errors, setErrors] = useS2([]);
  const [fileName, setFileName] = useS2("");
  const [busy, setBusy] = useS2(false);
  const [updateMode, setUpdateMode] = useS2(true);

  const deptKey = (v) => {
    const s = String(v || "").trim();
    const d = (window.DEPARTMENTS || []).find((x) => x.id === s || x.name === s || x.short === s);
    return d ? d.id : null;
  };
  const iso = (y, mo, d) => (y > 2400 ? y - 543 : y) + "-" + String(mo).padStart(2, "0") + "-" + String(d).padStart(2, "0");
  const TH_MON = { "ม.ค.": 1, "มกราคม": 1, "ก.พ.": 2, "กุมภาพันธ์": 2, "มี.ค.": 3, "มีนาคม": 3, "เม.ย.": 4, "เมษายน": 4, "พ.ค.": 5, "พฤษภาคม": 5, "มิ.ย.": 6, "มิถุนายน": 6, "ก.ค.": 7, "กรกฎาคม": 7, "ส.ค.": 8, "สิงหาคม": 8, "ก.ย.": 9, "กันยายน": 9, "ต.ค.": 10, "ตุลาคม": 10, "พ.ย.": 11, "พฤศจิกายน": 11, "ธ.ค.": 12, "ธันวาคม": 12 };
  const fmtDate = (v) => {
    if (v == null || v === "") return null;
    // real Date cell (use local parts to avoid UTC off-by-one)
    if (v instanceof Date && !isNaN(v.getTime())) return iso(v.getFullYear(), v.getMonth() + 1, v.getDate());
    let s = String(v).trim();
    if (!s) return null;
    // Excel serial number
    if (/^\d+(\.\d+)?$/.test(s) && window.XLSX && window.XLSX.SSF) {
      const dc = window.XLSX.SSF.parse_date_code(Number(s));
      if (dc && dc.y) return iso(dc.y, dc.m, dc.d);
    }
    // ISO: YYYY-MM-DD or YYYY/MM/DD (year may be Buddhist)
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) return iso(+m[1], +m[2], +m[3]);
    // Thai month name: "2 ม.ค. 2569" / "2 มกราคม 2569"
    m = s.match(/^(\d{1,2})\s*([^\d\s]+)\.?\s*(\d{2,4})$/);
    if (m && TH_MON[m[2]] != null) { let y = +m[3]; if (y < 100) y += 2500; return iso(y, TH_MON[m[2]], +m[1]); }
    // DD/MM/YYYY (or - .) — Thai style, day first; year may be Buddhist or 2-digit
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (m) {
      let a = +m[1], b = +m[2], y = +m[3], d, mo;
      if (a > 12 && b <= 12) { d = a; mo = b; }
      else if (b > 12 && a <= 12) { d = b; mo = a; }
      else { d = a; mo = b; } // ambiguous → assume DD/MM
      if (y < 100) y += (y >= 50 ? 2443 : 2543); // 2-digit → Buddhist-era guess, iso() converts to CE
      if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return iso(y, mo, d);
    }
    const dd = new Date(s); return isNaN(dd.getTime()) ? null : iso(dd.getFullYear(), dd.getMonth() + 1, dd.getDate());
  };

  const onFile = async (ev) => {
    const file = ev.target.files[0]; if (!file) return;
    setFileName(file.name);
    try {
      const isCsv = /\.csv$/i.test(file.name) || file.type === "text/csv";
      // CSV must be decoded as UTF-8 text (SheetJS treats raw bytes as Latin-1);
      // real .xlsx is a zip with UTF-8 inside, so the binary path is correct there.
      const wb = isCsv
        ? window.XLSX.read(await file.text(), { type: "string", raw: true }) // raw: keep cells as text so we control date parsing (Thai DD/MM)
        : window.XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const data = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
      const ok = [], errs = [];
      data.forEach((r, i) => {
        const get = (...keys) => { for (const k of keys) { const kk = Object.keys(r).find((x) => x.trim().toLowerCase() === k.toLowerCase()); if (kk != null && r[kk] !== "") return r[kk]; } return ""; };
        const name = String(get("ชื่อ-นามสกุล", "ชื่อ", "name")).trim();
        const dept = deptKey(get("หน่วยงาน", "แผนก", "dept"));
        if (!name) { errs.push({ row: i + 2, msg: "ไม่มีชื่อ" }); return; }
        if (!dept) { errs.push({ row: i + 2, msg: "หน่วยงานไม่ถูกต้อง (" + get("หน่วยงาน", "แผนก", "dept") + ")" }); return; }
        ok.push({
          code: String(get("รหัสพนักงาน", "รหัส", "employee_id", "empid", "emp_id", "code")).trim(),
          name, dept, position: String(get("ตำแหน่ง", "position") || "-").trim(),
          level: String(get("ระดับ", "level")).trim() || levelFromPosition(get("ตำแหน่ง", "position")),
          hire_date: fmtDate(get("วันเข้างาน", "วันที่เข้างาน", "hire_date")),
          email: String(get("อีเมล", "email")).trim() || null,
          phone: String(get("เบอร์โทร", "เบอร์", "phone")).trim() || null,
          status: "pending",
          kpi: Number(get("kpi")) || 0, comp: Number(get("competency", "comp")) || 0,
          potential: Number(get("ศักยภาพ", "potential")) || 2, perf: Number(get("ผลงาน", "perf")) || 2,
          reviewer: String(get("ผู้ประเมิน", "reviewer")).trim() || null,
        });
      });
      setRows(ok); setErrors(errs);
    } catch (e) { toast("อ่านไฟล์ไม่สำเร็จ: " + e.message, "x"); }
  };

  const doImport = async () => {
    if (!rows.length) return;
    setBusy(true);
    const norm = (s) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
    const existing = window.EMPLOYEES || [];
    const byId = {};
    existing.forEach((e) => { byId[e.id] = e; });
    const byKey = {};
    existing.forEach((e) => { const k = norm(e.name) + "|" + e.dept; if (!(k in byKey)) byKey[k] = e; });
    const palette = ["#2563eb", "#0d9488", "#7c3aed", "#db2777", "#0ea5e9", "#e08a00", "#16a34a"];
    const nums = existing.map((x) => parseInt(String(x.id).replace(/\D/g, ""), 10)).filter((n) => !isNaN(n));
    let next = (nums.length ? Math.max(...nums) : 999) + 1;

    const inserts = [], updates = [], seen = {};
    rows.forEach((r) => {
      // match by real employee code first (authoritative), else by name+dept in update mode
      const match = r.code ? byId[r.code] : (updateMode ? byKey[norm(r.name) + "|" + r.dept] : null);
      if (match) {
        const fields = {};
        if (r.code) { fields.name = r.name; fields.dept = r.dept; } // code is the key → name/dept may be corrected
        if (r.hire_date) { fields.hire_date = r.hire_date; fields.tenure = tenureFrom(r.hire_date); }
        if (r.position && r.position !== "-") fields.position = r.position;
        if (r.level) fields.level = r.level;
        if (r.email) fields.email = r.email;
        if (r.phone) fields.phone = r.phone;
        if (Object.keys(fields).length) updates.push({ id: match.id, fields });
      } else {
        inserts.push(r);
      }
    });
    const payload = [];
    inserts.forEach((r, i) => {
      const { code, ...rest } = r;
      const id = code || ("E" + (next + i));
      if (seen[id]) return; // avoid duplicate ids within the same file
      seen[id] = 1;
      payload.push({ ...rest, id, tenure: r.hire_date ? tenureFrom(r.hire_date) : null, color: palette[(existing.length + i) % 7], history: [], sort: existing.length + i });
    });

    let okIns = 0, okUpd = 0, errMsg = null;
    try {
      if (payload.length) { const { error } = await window.sb.from("employees").insert(payload); if (error) errMsg = error.message; else okIns = payload.length; }
      // run updates in parallel chunks
      for (let i = 0; i < updates.length; i += 25) {
        const chunk = updates.slice(i, i + 25);
        const res = await Promise.all(chunk.map((u) => window.sb.from("employees").update(u.fields).eq("id", u.id)));
        res.forEach((rr) => { if (rr.error) errMsg = rr.error.message; else okUpd++; });
      }
      if (errMsg && !okIns && !okUpd) { toast("นำเข้าไม่สำเร็จ: " + errMsg, "x"); return; }
      await ctx.refresh();
      toast("สำเร็จ — เพิ่มใหม่ " + okIns + " · อัปเดต " + okUpd + (errMsg ? " (บางรายการพลาด)" : ""), "check");
      onClose();
    } catch (e) {
      toast("เกิดข้อผิดพลาด: " + (e && e.message ? e.message : e), "x");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="นำเข้าพนักงานจาก Excel" onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>ปิด</button>
        <button className="btn btn-pri" onClick={doImport} disabled={busy || !rows.length}><Icon name="upload" size={15} />{busy ? "กำลังนำเข้า…" : ("นำเข้า " + rows.length + " รายการ")}</button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="muted" style={{ fontSize: 13, lineHeight: 1.7 }}>รองรับ <b>.xlsx / .xls / .csv</b> · คอลัมน์: <b>รหัสพนักงาน</b> (ถ้ามี — ใช้แทนรหัสอัตโนมัติ), ชื่อ-นามสกุล, หน่วยงาน, ตำแหน่ง, ระดับ, วันเข้างาน, อีเมล, เบอร์โทร, KPI, Competency · วันเข้างานรับทั้ง <b>วว/ดด/ปปปป</b>, ปี พ.ศ./ค.ศ. และวันที่ของ Excel · <a href="#" onClick={(e) => { e.preventDefault(); downloadEmpTemplate(); }} style={{ color: "var(--accent)", fontWeight: 600 }}>ดาวน์โหลดเทมเพลต</a></div>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="input" />
        <label className="row" style={{ gap: 8, fontSize: 12.5, cursor: "pointer", alignItems: "flex-start" }}><input type="checkbox" checked={updateMode} onChange={(e) => setUpdateMode(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--accent)", marginTop: 1 }} /> <span>อัปเดตถ้ามีชื่อซ้ำ (จับคู่ ชื่อ+หน่วยงาน) แทนการสร้างใหม่ — ใช้ตอนนำเข้าไฟล์เดิมซ้ำเพื่อเติมข้อมูลที่ขาด</span></label>
        {fileName && <div className="muted" style={{ fontSize: 12.5 }}>ไฟล์: {fileName} · พร้อมนำเข้า <b style={{ color: "var(--green)" }}>{rows.length}</b> · ข้าม <b style={{ color: "var(--amber)" }}>{errors.length}</b>{rows.filter((r) => !r.hire_date).length > 0 && <> · <b style={{ color: "var(--amber)" }}>ไม่มีวันเข้างาน {rows.filter((r) => !r.hire_date).length}</b></>}</div>}
        {errors.length > 0 && <div style={{ padding: "10px 13px", borderRadius: 10, background: "var(--amber-soft)", color: "#b45309", fontSize: 12.5, maxHeight: 110, overflowY: "auto" }}>{errors.slice(0, 12).map((e, i) => <div key={i}>แถว {e.row}: {e.msg}</div>)}</div>}
        {rows.length > 0 && (
          <div className="tbl-wrap" style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
            <table className="tbl"><thead><tr><th>รหัส</th><th>ชื่อ</th><th>หน่วยงาน</th><th>วันเข้างาน</th></tr></thead>
              <tbody>{rows.slice(0, 50).map((r, i) => <tr key={i}><td className="mono" style={{ fontSize: 12 }}>{r.code || "(อัตโนมัติ)"}</td><td>{r.name}</td><td>{deptShort(r.dept)}</td><td className="mono" style={{ color: r.hire_date ? "var(--text)" : "var(--amber)", fontWeight: r.hire_date ? 400 : 600 }}>{r.hire_date || "ไม่มี"}</td></tr>)}</tbody></table>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ---------- Add / Edit Department ---------- */
function DepartmentModal({ dep, ctx, onClose }) {
  const isEdit = !!dep;
  const [f, setF] = useS2(() => ({
    id: (dep && dep.id) || "", name: (dep && dep.name) || "", short: (dep && dep.short) || "",
    color: (dep && dep.color) || "#2563eb", head: dep ? dep.head : 0, done: dep ? dep.done : 0,
    score: dep ? dep.score : 0, trend: dep ? dep.trend : 0,
  }));
  const [busy, setBusy] = useS2(false);
  const [err, setErr] = useS2("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const palette = ["#2563eb", "#0d9488", "#7c3aed", "#db2777", "#0ea5e9", "#e08a00", "#16a34a", "#0891b2", "#9333ea", "#475569"];

  const save = async () => {
    if (!f.name.trim()) { setErr("กรุณากรอกชื่อหน่วยงาน"); return; }
    let id = isEdit ? dep.id : (f.id.trim() || "dept_" + Date.now().toString(36));
    if (!isEdit && (window.DEPARTMENTS || []).some((d) => d.id === id)) { setErr("รหัสหน่วยงานนี้มีอยู่แล้ว"); return; }
    setErr(""); setBusy(true);
    const row = { name: f.name.trim(), short: f.short.trim() || f.name.trim(), color: f.color, head: Number(f.head) || 0, done: Number(f.done) || 0, score: Number(f.score) || 0, trend: Number(f.trend) || 0 };
    let error;
    if (isEdit) { ({ error } = await window.sb.from("departments").update(row).eq("id", dep.id)); }
    else { row.id = id; row.sort = (window.DEPARTMENTS || []).length; ({ error } = await window.sb.from("departments").insert(row)); }
    if (error) { setBusy(false); setErr("บันทึกไม่สำเร็จ: " + error.message); return; }
    await ctx.refresh();
    toast(isEdit ? "บันทึกหน่วยงานแล้ว" : "เพิ่มหน่วยงาน “" + f.name.trim() + "” แล้ว", "check");
    onClose();
  };

  return (
    <Modal title={isEdit ? "แก้ไขหน่วยงาน" : "เพิ่มหน่วยงาน"} onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose} disabled={busy}>ยกเลิก</button>
        <button className="btn btn-pri" onClick={save} disabled={busy}><Icon name="check" size={15} />{busy ? "กำลังบันทึก…" : "บันทึก"}</button>
      </>}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {err && <div style={{ padding: "10px 13px", borderRadius: 10, background: "var(--red-soft)", color: "#be123c", fontSize: 13 }}>{err}</div>}
        {!isEdit && <div className="field"><label>รหัสหน่วยงาน (อังกฤษ เช่น mkt)</label><input className="input" value={f.id} onChange={(e) => set("id", e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())} placeholder="เว้นว่างเพื่อสร้างอัตโนมัติ" /></div>}
        <div className="grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
          <div className="field"><label>ชื่อหน่วยงาน *</label><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="เช่น การตลาด" /></div>
          <div className="field"><label>ชื่อย่อ</label><input className="input" value={f.short} onChange={(e) => set("short", e.target.value)} placeholder="การตลาด" /></div>
        </div>
        <div className="field"><label>สีประจำหน่วยงาน</label>
          <div className="row wrap" style={{ gap: 8 }}>
            {palette.map((c) => <button key={c} onClick={() => set("color", c)} style={{ width: 28, height: 28, borderRadius: 8, background: c, border: f.color === c ? "3px solid var(--text)" : "2px solid #fff", boxShadow: "0 0 0 1px var(--border)", cursor: "pointer" }} />)}
          </div>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
          <div className="field"><label>จำนวนพนักงาน</label><input className="input" type="number" value={f.head} onChange={(e) => set("head", e.target.value)} /></div>
          <div className="field"><label>ประเมินแล้ว</label><input className="input" type="number" value={f.done} onChange={(e) => set("done", e.target.value)} /></div>
          <div className="field"><label>คะแนนเฉลี่ย</label><input className="input" type="number" value={f.score} onChange={(e) => set("score", e.target.value)} /></div>
          <div className="field"><label>แนวโน้ม</label><input className="input" type="number" value={f.trend} onChange={(e) => set("trend", e.target.value)} /></div>
        </div>
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
  const [showImport, setShowImport] = useS2(false);

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
          <button className="btn btn-ghost" onClick={() => setShowImport(true)}><Icon name="upload" size={16} />นำเข้า Excel</button>
          <button className="btn btn-ghost" onClick={() => { downloadCSV("employees.csv", ["รหัส", "ชื่อ", "หน่วยงาน", "ตำแหน่ง", "อายุงาน", "สถานะ", "KPI", "Competency", "คะแนนรวม"], rows.map((e) => [e.id, e.name, deptName(e.dept), e.position, e.tenure, (statusMeta(e.status) || {}).label || e.status, e.kpi, e.comp, e.overall])); toast("ส่งออกรายชื่อ " + rows.length + " คนแล้ว", "fileExcel"); }}><Icon name="download" size={16} />Export</button>
          <button className="btn btn-pri" onClick={() => setShowAdd(true)}><Icon name="plus" size={16} />เพิ่มพนักงาน</button>
        </div>
      </div>
      {showAdd && <EmployeeModal emp={null} ctx={ctx} onClose={() => setShowAdd(false)} />}
      {showImport && <ImportEmployeesModal ctx={ctx} onClose={() => setShowImport(false)} />}

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <Stat icon="users" label="พนักงานทั้งหมด" value={EMPLOYEES.length} unit="คน" tone="#2563eb" soft="#e8effb" />
        <Stat icon="checkCircle" label="ประเมินแล้ว" value={EMPLOYEES.filter((e) => e.status === "done").length} unit="คน" tone="#16a34a" soft="#e7f6ec" />
        <Stat icon="target" label="คะแนนเฉลี่ย" value={EMPLOYEES.length ? Math.round(EMPLOYEES.reduce((a, e) => a + e.overall, 0) / EMPLOYEES.length * 10) / 10 : 0} tone="#7c3aed" soft="#f1ebfd" />
        <Stat icon="trophy" label="ผลงานดีเยี่ยม (A)" value={EMPLOYEES.filter((e) => e.overall >= 90).length} unit="คน" tone="#0d9488" soft="#e2f4f2" />
      </div>

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
  const delEmp = async () => {
    if (!window.confirm("ลบพนักงาน " + e.name + " ออกจากระบบ?")) return;
    const { error } = await window.sb.from("employees").delete().eq("id", e.id);
    if (error) { toast("ลบไม่สำเร็จ: " + error.message, "x"); return; }
    await ctx.refresh(); toast("ลบพนักงานแล้ว", "check"); ctx.go("employee");
  };
  const yrs = ["2565","2566","2567","2568","2569"];
  const hist = e.history.map((v, i) => ({ m: yrs[yrs.length - e.history.length + i], v }));
  const radar = COMPETENCIES.map((c, i) => ({ id: c.id, name: c.name, v: Math.max(55, Math.min(98, e.comp + [4,-3,2,-5,6][i % 5])) }));
  const sm = statusMeta(e.status);
  const notRated = (e.kpi === 0 && e.comp === 0); // imported but not evaluated yet
  const dash = (v) => (v == null || v === "" ? "—" : v);

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
              {[["รหัสพนักงาน", e.id], ["ระดับ", dash(e.level)], ["วันเข้างาน", dash(e.hire_date)], ["อายุงาน", dash(e.tenure)], ["ผู้ประเมิน", dash(e.reviewer)]].map(([k, v]) => (
                <div key={k}><div className="muted" style={{ fontSize: 11.5 }}>{k}</div><div style={{ fontSize: 13.5, fontWeight: 600 }}>{v}</div></div>
              ))}
            </div>
          </div>
          <div className="row wrap" style={{ gap: 9, alignSelf: "flex-start" }}>
            <button className="btn btn-ghost" onClick={() => { downloadCSV("employee_" + e.id + ".csv", ["รหัส", "ชื่อ", "หน่วยงาน", "ตำแหน่ง", "ระดับ", "อายุงาน", "สถานะ", "KPI", "Competency", "คะแนนรวม", "ผู้ประเมิน"], [[e.id, e.name, deptName(e.dept), e.position, e.level, e.tenure, (statusMeta(e.status) || {}).label || e.status, e.kpi, e.comp, e.overall, e.reviewer]]); toast("ส่งออกข้อมูลพนักงานแล้ว", "download"); }}><Icon name="download" size={16} />Export</button>
            <button className="btn btn-ghost" onClick={() => setEditing(true)}><Icon name="edit" size={16} />แก้ไข</button>
            <button className="btn btn-ghost" onClick={delEmp} style={{ color: "var(--red)" }}><Icon name="x" size={16} />ลบ</button>
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
              {notRated ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "22px 0" }}>
                  <span style={{ color: "var(--text-3)" }}><Icon name="clock" size={38} /></span>
                  <div className="muted" style={{ fontSize: 14, fontWeight: 600 }}>ยังไม่ได้ประเมินรอบนี้</div>
                  <button className="btn btn-pri btn-sm" onClick={() => ctx.startEval(e.id)}><Icon name="eval" size={15} />เริ่มประเมิน</button>
                </div>
              ) : (<>
                <Ring value={e.overall} size={150} label={e.band.label} />
                <div className="row" style={{ gap: 0, width: "100%", textAlign: "center" }}>
                  <div style={{ flex: 1 }}><div className="num" style={{ fontWeight: 700, fontSize: 20, color: "#2563eb" }}>{e.kpi}</div><div className="muted" style={{ fontSize: 12 }}>KPI (60%)</div></div>
                  <div style={{ width: 1, background: "var(--border)" }} />
                  <div style={{ flex: 1 }}><div className="num" style={{ fontWeight: 700, fontSize: 20, color: "#7c3aed" }}>{e.comp}</div><div className="muted" style={{ fontSize: 12 }}>Competency (40%)</div></div>
                </div>
              </>)}
            </div>
          </Card>
          <Card>
            <CardHead title="ข้อมูลติดต่อ" />
            <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[["mail", e.email || "ยังไม่ระบุอีเมล"], ["phone", e.phone || "ยังไม่ระบุเบอร์โทร"], ["briefcase", e.position + " · " + deptName(e.dept)], ["calendar", e.hire_date ? ("เข้างาน " + e.hire_date + " (" + e.tenure + ")") : "ยังไม่ระบุวันเข้างาน"]].map(([ic, v], idx) => (
                <div key={idx} className="row" style={{ gap: 11 }}><span style={{ color: "var(--text-3)" }}><Icon name={ic} size={17} /></span><span style={{ fontSize: 13.5, color: ((ic === "mail" && !e.email) || (ic === "phone" && !e.phone) || (ic === "calendar" && !e.hire_date)) ? "var(--text-3)" : "var(--text)" }}>{v}</span></div>
              ))}
            </div>
          </Card>
        </div>

        {/* right column */}
        <div className="grid">
          <Card>
            <CardHead title="สมรรถนะ (Competency)" sub="ผลประเมิน 5 ด้านหลัก" />
            {notRated ? (
              <div className="card-pad muted" style={{ textAlign: "center", padding: "34px 0" }}>ยังไม่มีผลประเมินสมรรถนะสำหรับรอบนี้</div>
            ) : (
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
            )}
          </Card>

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Card>
              <CardHead title="ประวัติการประเมิน" sub="คะแนนรวมย้อนหลัง" />
              <div className="card-pad">{hist.length ? <LineChart data={hist} height={210} min={60} /> : <div className="muted" style={{ height: 210, display: "grid", placeItems: "center", textAlign: "center" }}>ยังไม่มีประวัติการประเมินย้อนหลัง</div>}</div>
            </Card>
            <Card>
              <CardHead title="KPI หลัก" sub="ผลงานเทียบเป้าหมาย" />
              <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                {notRated ? <div className="muted" style={{ textAlign: "center", padding: "22px 0" }}>ยังไม่มีข้อมูล KPI รายบุคคล</div> : KPI_ITEMS.slice(0, 5).map((k) => (
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
  const [deptModal, setDeptModal] = useS2(null);
  const d = DEPARTMENTS.find((x) => x.id === sel) || DEPARTMENTS[0];
  const members = EMPLOYEES.filter((e) => e.dept === sel);
  const deptTrend = TREND.map((p, i) => ({ m: p.m, v: Math.round((p.v + d.trend * 2 + (d.score - SUMMARY.avgScore)) * 10) / 10 }));

  return (
    <div className="grid">
      <div className="page-head">
        <div><h1>KPI ตามหน่วยงาน</h1><p>เปรียบเทียบผลการดำเนินงานของแต่ละหน่วยงาน</p></div>
        <div className="row wrap" style={{ gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => { downloadCSV("department_kpi.csv", ["รหัส", "หน่วยงาน", "พนักงาน", "ประเมินแล้ว", "คะแนนเฉลี่ย", "แนวโน้ม"], DEPARTMENTS.map((d) => [d.id, d.name, d.head, d.done, d.score, d.trend])); toast("ส่งออกรายงานหน่วยงานแล้ว", "download"); }}><Icon name="download" size={16} />Export</button>
          <button className="btn btn-pri" onClick={() => setDeptModal({})}><Icon name="plus" size={16} />เพิ่มหน่วยงาน</button>
        </div>
      </div>
      {deptModal && <DepartmentModal dep={deptModal.id ? deptModal : null} ctx={ctx} onClose={() => setDeptModal(null)} />}

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
          <CardHead title={`แนวโน้มคะแนน · ${d.name}`} sub="ค่าเฉลี่ยหน่วยงานรายเดือน" right={<div className="row" style={{ gap: 10 }}><button className="btn btn-ghost btn-sm" onClick={() => setDeptModal(d)}><Icon name="edit" size={14} />แก้ไขหน่วยงาน</button><span className="tag-dot" style={{ background: d.color, width: 12, height: 12 }} /></div>} />
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
