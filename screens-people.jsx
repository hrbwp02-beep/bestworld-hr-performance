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
    hire_date: (emp && emp.hire_date) || "", birth_date: (emp && emp.birth_date) || "", email: (emp && emp.email) || "", phone: (emp && emp.phone) || "",
    status: (emp && emp.status) || "pending", kpi: emp ? emp.kpi : "", comp: emp ? emp.comp : "",
    potential: emp ? emp.potential : 2, perf: emp ? emp.perf : 2, reviewer: (emp && emp.reviewer) || "",
    photo_url: (emp && emp.photo_url) || "", jd_id: (emp && emp.jd_id) || "", warnings: emp ? (emp.warnings || 0) : 0,
    supervisor_id: (emp && emp.supervisor_id) || "",
  }));
  const [busy, setBusy] = useS2(false);
  const [err, setErr] = useS2("");
  const [uploading, setUploading] = useS2(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const onPhoto = async (ev) => {
    const file = ev.target.files[0]; if (!file) return;
    setUploading(true);
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = (isEdit ? emp.id : "new") + "/" + Date.now() + "." + ext;
    const up = await window.sb.storage.from("employee-photos").upload(path, file, { upsert: true, contentType: file.type });
    if (up.error) { setUploading(false); toast("อัปโหลดรูปไม่สำเร็จ: " + up.error.message, "x"); return; }
    const { data } = window.sb.storage.from("employee-photos").getPublicUrl(path);
    set("photo_url", data.publicUrl);
    setUploading(false);
  };
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
      name: f.name.trim(), dept: f.dept, position: f.position.trim(),
      level: f.level, hire_date: f.hire_date || null, birth_date: f.birth_date || null, tenure: f.hire_date ? tenureFrom(f.hire_date) : null,
      email: f.email.trim() || null, phone: f.phone.trim() || null,
      status: f.status, kpi: Number(f.kpi) || 0, comp: Number(f.comp) || 0,
      potential: Number(f.potential) || 1, perf: Number(f.perf) || 1, reviewer: f.reviewer || null,
      photo_url: f.photo_url || null, jd_id: f.jd_id || null, warnings: Number(f.warnings) || 0,
      supervisor_id: f.supervisor_id || null,
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
        <div className="row" style={{ gap: 16, alignItems: "center" }}>
          {f.photo_url
            ? <Avatar name={f.name} src={f.photo_url} size={68} />
            : <div className="placeholder-img" style={{ width: 68, height: 68, borderRadius: 999, fontSize: 10, flex: "0 0 68px" }}>รูป</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <label className="btn btn-ghost btn-sm" style={{ cursor: uploading ? "default" : "pointer" }}>
              <Icon name="upload" size={14} />{uploading ? "กำลังอัปโหลด…" : (f.photo_url ? "เปลี่ยนรูป" : "อัปโหลดรูป")}
              <input type="file" accept="image/*" onChange={onPhoto} disabled={uploading} style={{ display: "none" }} />
            </label>
            {f.photo_url && <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--red)" }} onClick={() => set("photo_url", "")}>ลบรูป</button>}
          </div>
        </div>
        <div className="field"><label>ชื่อ-นามสกุล *</label><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="เช่น สมชาย ศรีสุข" /></div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="field"><label>หน่วยงาน</label><select className="select" value={f.dept} onChange={(e) => set("dept", e.target.value)}>{(window.DEPARTMENTS || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
          <div className="field"><label>ระดับ</label><select className="select" value={f.level} onChange={(e) => set("level", e.target.value)}>{[...new Set([...(window.LEVELS || []), ...(window.EMPLOYEES || []).map((x) => x.level).filter(Boolean), f.level].filter(Boolean))].map((l) => <option key={l} value={l}>{l}</option>)}</select></div>
        </div>
        <div className="field"><label>ตำแหน่ง *</label><input className="input" value={f.position} onChange={(e) => setF((p) => ({ ...p, position: e.target.value, level: levelFromPosition(e.target.value) }))} placeholder="เช่น หัวหน้าแผนกฉีดพลาสติก" /><span className="muted" style={{ fontSize: 12 }}>ระดับจะถูกแนะนำจากตำแหน่งโดยอัตโนมัติ (เปลี่ยนเองได้)</span></div>
        <div className="field"><label>Job Description (ผูกตามตำแหน่ง)</label><select className="select" value={f.jd_id} onChange={(e) => set("jd_id", e.target.value)}><option value="">— ไม่ผูก —</option>{(window.JD_LIBRARY || []).map((j) => <option key={j.id} value={j.id}>{j.id} · {j.title}</option>)}</select></div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="field"><label>อีเมล</label><input className="input" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="name@bestworld.co.th" /></div>
          <div className="field"><label>เบอร์โทร</label><input className="input" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="08xxxxxxxx" /></div>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="field"><label>วันเข้างาน</label><input className="input" type="date" value={f.hire_date || ""} onChange={(e) => set("hire_date", e.target.value)} /><span className="muted" style={{ fontSize: 12 }}>อายุงาน: {f.hire_date ? tenureFrom(f.hire_date) : "—"}</span></div>
          <div className="field"><label>วันเกิด (ใช้ยืนยันตัวตนเมื่อพนักงานดูผลเอง)</label><input className="input" type="date" value={f.birth_date || ""} onChange={(e) => set("birth_date", e.target.value)} /></div>
          <div className="field"><label>สถานะการประเมิน</label><select className="select" value={f.status} onChange={(e) => set("status", e.target.value)}>{[["pending", "รอประเมิน"], ["progress", "กำลังประเมิน"], ["review", "รออนุมัติ"], ["done", "ประเมินแล้ว"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        </div>
        {isEdit && <div className="muted" style={{ fontSize: 12.5, background: "var(--surface-2)", borderRadius: 9, padding: "10px 13px", lineHeight: 1.7 }}>
          <Icon name="alert" size={13} /> คะแนน KPI/สมรรถนะ มาจาก<b>ฟอร์มประเมิน</b> (ปัจจุบัน KPI {f.kpi || 0} · สมรรถนะ {f.comp || 0}) — แก้ไขที่ฟอร์มประเมิน ไม่ใช่ที่นี่
        </div>}
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="field"><label>ศักยภาพ (Potential) · แกนตั้ง 9-Box</label><select className="select" value={f.potential} onChange={(e) => set("potential", +e.target.value)}>{[[1, "1 · ต่ำ"], [2, "2 · ปานกลาง"], [3, "3 · สูง"]].map(([n, l]) => <option key={n} value={n}>{l}</option>)}</select></div>
          <div className="field"><label>ผลงาน (Performance) · แกนนอน 9-Box</label><select className="select" value={f.perf} onChange={(e) => set("perf", +e.target.value)}>{[[1, "1 · ต่ำ"], [2, "2 · ปานกลาง"], [3, "3 · สูง"]].map(([n, l]) => <option key={n} value={n}>{l}</option>)}</select></div>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
          <div className="field"><label>ผู้ประเมิน (หัวหน้า)</label><input className="input" value={f.reviewer} onChange={(e) => set("reviewer", e.target.value)} placeholder="ชื่อผู้บังคับบัญชา" /></div>
          <div className="field"><label>ผู้บังคับบัญชา (สายอนุมัติ)</label><select className="select" value={f.supervisor_id} onChange={(e) => set("supervisor_id", e.target.value)}><option value="">— ไม่ระบุ —</option>{(window.EMPLOYEES || []).filter((x) => !emp || x.id !== emp.id).slice().sort((a, b) => (a.dept || "").localeCompare(b.dept || "")).map((x) => <option key={x.id} value={x.id}>{x.name} · {deptShort(x.dept)} ({x.position})</option>)}</select></div>
          <div className="field"><label>ใบเตือน (ใบ)</label><input className="input" type="number" min="0" value={f.warnings} onChange={(e) => set("warnings", e.target.value)} /><span className="muted" style={{ fontSize: 12 }}>มีใบเตือน = ไม่ปรับเงิน</span></div>
        </div>
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
    const row = { name: f.name.trim(), short: f.short.trim() || f.name.trim(), color: f.color };
    let error;
    if (isEdit) { ({ error } = await window.sb.from("departments").update(row).eq("id", dep.id)); }
    else { row.id = id; row.head = 0; row.done = 0; row.score = 0; row.trend = 0; row.sort = (window.DEPARTMENTS || []).length; ({ error } = await window.sb.from("departments").insert(row)); }
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
        {isEdit && <div className="muted" style={{ fontSize: 12.5, background: "var(--surface-2)", borderRadius: 9, padding: "10px 13px", lineHeight: 1.7 }}>
          <Icon name="alert" size={13} /> จำนวนพนักงาน <b>{dep.head} คน</b> · ประเมินแล้ว <b>{dep.done} คน</b> · คะแนนเฉลี่ย <b>{dep.score}</b> — ค่าเหล่านี้<b>คำนวณอัตโนมัติ</b>จากข้อมูลพนักงานจริง ไม่ต้องกรอกเอง
        </div>}
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
                          <Avatar name={e.name} initials={e.initials} color={e.color} src={e.photo_url} size={38} />
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
                    <Avatar name={e.name} initials={e.initials} color={e.color} src={e.photo_url} size={48} />
                    <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name}</div><div className="muted" style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.position}</div></div>
                  </div>
                  <div className="between"><Badge cls="b-gray">{deptShort(e.dept)}</Badge><Badge cls={sm.cls} dot>{sm.label}</Badge></div>
                  <div className="between" style={{ borderTop: "1px solid var(--border-2)", paddingTop: 12 }}>
                    <div><div className="muted" style={{ fontSize: 11 }}>คะแนนรวม</div><div className="num" style={{ fontWeight: 700, fontSize: 20, color: e.band.color }}>{e.overall}</div></div>
                    <span className={"badge " + e.band.cls}><span className="bdot" />{e.band.label}</span>
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
  const empJd = (window.JD_LIBRARY || []).find((j) => j.id === e.jd_id);
  const supervisor = (window.EMPLOYEES || []).find((x) => x.id === e.supervisor_id);
  const outcome = window.evalOutcome(e.overall, e.warnings);
  const ev = e.eval || null; // ใบประเมินจริงของรอบนี้ (ถ้ามี)
  const W = window.APP_SETTINGS || {};
  const wK = W.w_kpi != null ? W.w_kpi : 50, wC = W.w_comp != null ? W.w_comp : 25, wJ = W.w_jd != null ? W.w_jd : 25;
  const empSection = window.sectionOf(e.position);
  // ===== อ้างอิงข้อมูลจริงจากใบประเมิน 2 ส่วน (A ผลงาน/KPI · B สมรรถนะ) =====
  const evItems = ev && ev.items ? ev.items : null;
  // ส่วน A — ใช้คะแนนรายข้อจริง (items.a) ถ้ามี; ไม่งั้นใช้แม่แบบจาก JD (ยังไม่ให้คะแนน)
  const aRows = (evItems && evItems.a && evItems.a.length)
    ? evItems.a.map((x, i) => ({ id: "a" + i, name: x.name, weight: x.weight, grp: x.grp || "a1", score: x.score }))
    : (() => {
        // ยังไม่ประเมิน → แสดงแม่แบบ A1 (หน้าที่ JD) + A2 (KPI หน่วยงานจริง)
        const a1 = ((empJd && empJd.eval_a) || []).filter((x) => (x.grp || "a1") === "a1");
        const a1base = a1.length ? a1 : ((empJd && empJd.duties) || []).map((n) => ({ name: n }));
        const a1rows = a1base.map((x, i) => ({ id: "a1_" + i, name: x.name, weight: x.weight, grp: "a1", score: null }));
        const kd = (empJd && (empJd.kpi_dept || empJd.dept)) || e.dept;
        let dk = (window.KPI_DEFS || []).filter((k) => k.dept === kd && k.status === "approved");
        if (dk.some((k) => k.section)) { const ip = /พิมพ์|สลิท/.test(empSection); dk = dk.filter((k) => !k.section || (ip ? k.section === "พิมพ์" : k.section === "เป่า")); }
        const a2rows = dk.map((k, i) => ({ id: "a2_" + i, name: k.en || k.name, weight: null, grp: "a2", score: null }));
        return [...a1rows, ...a2rows];
      })();
  // ส่วน B — ใช้คะแนนรายข้อจริง (items.b) ถ้ามี; ไม่งั้นใช้แม่แบบ
  const bRows = (evItems && evItems.b && evItems.b.length)
    ? evItems.b.map((x, i) => ({ id: "b" + i, name: x.name, weight: x.weight, grp: x.grp || "specific", score: x.score }))
    : (evItems && evItems.comp && evItems.comp.length)
      ? evItems.comp.map((c, i) => ({ id: "b" + i, name: c.name, weight: null, grp: "specific", score: c.score }))
      : ((empJd && empJd.eval_b) || []).map((x, i) => ({ id: "b" + i, name: x.name, weight: x.weight, grp: x.grp || "specific", score: null }));

  return (
    <div className="grid">
      <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => ctx.go("employee")}><Icon name="chevLeft" size={15} />กลับไปหน้าพนักงาน</button>

      {/* header */}
      <Card className="card-pad">
        <div className="row wrap" style={{ gap: 20 }}>
          <div style={{ position: "relative" }}>
            {e.photo_url
              ? <img src={e.photo_url} alt={e.name} style={{ width: 104, height: 104, borderRadius: 18, objectFit: "cover", display: "block" }} />
              : <div className="placeholder-img" style={{ width: 104, height: 104, borderRadius: 18 }}>รูปพนักงาน<br/>104×104</div>}
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="row wrap" style={{ gap: 10, marginBottom: 4 }}>
              <h1 style={{ margin: 0, fontSize: 23 }}>{e.name}</h1>
              <Badge cls={sm.cls} dot>{sm.label}</Badge>
              {e.warnings > 0 && <Badge cls="b-red" dot>ใบเตือน {e.warnings}</Badge>}
            </div>
            <div className="muted" style={{ fontSize: 15 }}>{e.position} · {deptName(e.dept)}</div>
            <div className="row wrap" style={{ gap: 18, marginTop: 14 }}>
              {[["รหัสพนักงาน", e.id], ["ระดับ", dash(e.level)], ["วันเข้างาน", dash(e.hire_date)], ["อายุงาน", dash(e.tenure)], ["ผู้บังคับบัญชา", supervisor ? supervisor.name : dash(e.reviewer)]].map(([k, v]) => (
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
                  <div style={{ flex: 1 }}><div className="num" style={{ fontWeight: 700, fontSize: 19, color: "#2563eb" }}>{ev ? (ev.a_score != null ? ev.a_score : ev.kpi_score) : e.kpi}</div><div className="muted" style={{ fontSize: 11.5 }}>ผลงาน/KPI ({wK}%)</div></div>
                  <div style={{ width: 1, background: "var(--border)" }} />
                  <div style={{ flex: 1 }}><div className="num" style={{ fontWeight: 700, fontSize: 19, color: "#7c3aed" }}>{ev ? (ev.b_score != null ? ev.b_score : ev.comp_score) : e.comp}</div><div className="muted" style={{ fontSize: 11.5 }}>สมรรถนะ ({wC}%)</div></div>
                  {wJ > 0 && (<><div style={{ width: 1, background: "var(--border)" }} />
                  <div style={{ flex: 1 }}><div className="num" style={{ fontWeight: 700, fontSize: 19, color: "#0d9488" }}>{ev && ev.jd_score != null ? ev.jd_score : "—"}</div><div className="muted" style={{ fontSize: 11.5 }}>ตาม JD ({wJ}%)</div></div></>)}
                </div>
                <div style={{ width: "100%", borderTop: "1px solid var(--border-2)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div className="between" style={{ fontSize: 13 }}><span className="muted">เกรด</span><span className="badge" style={{ background: outcome.color + "22", color: outcome.color, fontWeight: 700 }}>{outcome.grade} · {outcome.gradeLabel}</span></div>
                  <div className="between" style={{ fontSize: 13 }}><span className="muted">โบนัส</span>{outcome.bonusEligible ? <span style={{ fontWeight: 700, color: "#16a34a" }}>{outcome.bonusMonths} เท่า</span> : <span className="muted" style={{ fontWeight: 600 }}>ไม่ได้รับ</span>}</div>
                  <div className="between" style={{ fontSize: 13 }}><span className="muted">ปรับเงินเดือน</span>{outcome.raiseEligible ? <span style={{ fontWeight: 700, color: "#16a34a" }}>+{outcome.raisePct}%</span> : <span style={{ fontWeight: 700, color: "var(--red)" }}>ไม่ปรับ{outcome.hasWarning ? " (มีใบเตือน)" : ""}</span>}</div>
                  {ev && (ev.evaluator || ev.evaluator_code) && <div className="between" style={{ fontSize: 13 }}><span className="muted">ผู้ประเมิน</span><span style={{ fontWeight: 600, textAlign: "right" }}>{ev.evaluator || "—"}{ev.evaluator_code ? <span className="muted" style={{ fontWeight: 400 }}> · รหัส {ev.evaluator_code}</span> : ""}</span></div>}
                </div>
              </>)}
            </div>
          </Card>
          <Card>
            <CardHead title="ข้อมูลติดต่อ" />
            <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[["mail", e.email || "ยังไม่ระบุอีเมล"], ["phone", e.phone || "ยังไม่ระบุเบอร์โทร"], ["briefcase", e.position + " · " + deptName(e.dept)], ["jd", empJd ? (empJd.id + " · " + empJd.title) : "ยังไม่ผูก JD"], ["calendar", e.hire_date ? ("เข้างาน " + e.hire_date + " (" + e.tenure + ")") : "ยังไม่ระบุวันเข้างาน"]].map(([ic, v], idx) => (
                <div key={idx} className="row" style={{ gap: 11 }}><span style={{ color: "var(--text-3)" }}><Icon name={ic} size={17} /></span><span style={{ fontSize: 13.5, color: ((ic === "mail" && !e.email) || (ic === "phone" && !e.phone) || (ic === "calendar" && !e.hire_date)) ? "var(--text-3)" : "var(--text)" }}>{v}</span></div>
              ))}
            </div>
          </Card>
        </div>

        {/* right column */}
        <div className="grid">
          {/* ส่วน A · ผลงาน/KPI (A1 รายบุคคล + A2 ร่วมทีม) */}
          <Card>
            <CardHead title="ส่วน A · ผลงาน/KPI" sub={(empJd ? empJd.id + " · " : "") + aRows.length + " ข้อ · น้ำหนัก " + wK + "%" + (ev ? " · คะแนน " + (ev.a_score != null ? ev.a_score : ev.kpi_score) : "")} />
            {notRated ? (
              <div className="card-pad muted" style={{ textAlign: "center", padding: "34px 0" }}>ยังไม่มีผลประเมินสำหรับรอบนี้</div>
            ) : aRows.length === 0 ? (
              <div className="card-pad muted" style={{ textAlign: "center", padding: "22px 0" }}>ยังไม่ผูกแบบประเมิน (ส่วน A) กับตำแหน่งนี้</div>
            ) : (
              <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[["a1", "A1 · KPI รายบุคคล (จากหน้าที่ JD)", "#2563eb"], ["a2", "A2 · KPI ร่วมของหน่วยงาน", "#0d9488"]].map(([grp, label, col]) => {
                  const rows = aRows.filter((x) => (x.grp || "a1") === grp);
                  if (!rows.length) return null;
                  return (
                    <div key={grp}>
                      <div className="muted" style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 7 }}>{label}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {rows.map((c) => (
                          <div key={c.id}>
                            <div className="between" style={{ marginBottom: 4, gap: 10 }}><span className="row" style={{ gap: 8, fontSize: 12.5, minWidth: 0 }}><span style={{ color: col, flex: "0 0 auto" }}><Icon name="target" size={13} /></span><span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span></span><span className="mono" style={{ fontWeight: 600, fontSize: 12.5, flex: "0 0 auto" }}>{c.score != null ? c.score : (c.weight ? c.weight + "%" : "—")}</span></div>
                            {c.score != null && <ScoreBar value={c.score} color={col} />}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Card>
              <CardHead title="ประวัติการประเมิน" sub="คะแนนรวมย้อนหลัง" />
              <div className="card-pad">{hist.length ? <LineChart data={hist} height={210} min={60} /> : <div className="muted" style={{ height: 210, display: "grid", placeItems: "center", textAlign: "center" }}>ยังไม่มีประวัติการประเมินย้อนหลัง</div>}</div>
            </Card>
            <Card>
              <CardHead title="ส่วน B · สมรรถนะ" sub={bRows.length + " ด้าน · น้ำหนัก " + wC + "%" + (ev ? " · คะแนน " + (ev.b_score != null ? ev.b_score : ev.comp_score) : "")} />
              {notRated ? (
                <div className="card-pad muted" style={{ textAlign: "center", padding: "22px 0" }}>ยังไม่มีผลประเมินสมรรถนะ</div>
              ) : (
                <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[["core", "B1 · สมรรถนะหลัก (Core)"], ["specific", "B2 · เฉพาะตำแหน่ง"]].map(([grp, label]) => {
                    const rows = bRows.filter((x) => (x.grp || "specific") === grp);
                    if (!rows.length) return null;
                    return (
                      <div key={grp}>
                        <div className="muted" style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 7 }}>{label}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {rows.map((c) => (
                            <div key={c.id}>
                              <div className="between" style={{ marginBottom: 4, gap: 10 }}><span className="row" style={{ gap: 8, fontSize: 12.5, minWidth: 0 }}><span style={{ color: "#7c3aed", flex: "0 0 auto" }}><Icon name="award" size={13} /></span><span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span></span><span className="mono" style={{ fontWeight: 600, fontSize: 12.5, flex: "0 0 auto" }}>{c.score != null ? c.score : (c.weight ? c.weight + "%" : "—")}</span></div>
                              {c.score != null && <ScoreBar value={c.score} color="#7c3aed" />}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}


/* =========================================================
   EVALUATION TRACKING — ติดตามงานที่ต้องประเมิน แยกหน่วยงาน
   ========================================================= */
function EvalTracking({ ctx }) {
  const [open, setOpen] = useS2({});
  const [view, setView] = useS2("pending");
  const cy = +(window.CYCLE_YEAR || 2569);
  const groups = (DEPARTMENTS || []).map((d) => {
    const emps = EMPLOYEES.filter((e) => e.dept === d.id);
    const done = emps.filter((e) => e.status === "done").length;
    const pendingList = emps.filter((e) => e.status !== "done");
    return { d, total: emps.length, done, pendingList, pct: emps.length ? Math.round(done / emps.length * 100) : 0 };
  }).filter((g) => g.total > 0);
  const totalEmp = EMPLOYEES.length;
  const totalDone = EMPLOYEES.filter((e) => e.status === "done").length;
  const fullDepts = groups.filter((g) => g.pendingList.length === 0).length;
  const shown = view === "pending" ? groups.filter((g) => g.pendingList.length > 0) : groups;
  const toggle = (id) => setOpen((p) => ({ ...p, [id]: !p[id] }));
  const exportCSV = () => { downloadCSV("eval_pending_" + cy + ".csv", ["รหัส", "ชื่อ", "หน่วยงาน", "ตำแหน่ง", "สถานะ"],
    EMPLOYEES.filter((e) => e.status !== "done").map((e) => [e.id, e.name, deptName(e.dept), e.position, (statusMeta(e.status) || {}).label || e.status])); toast("ส่งออกรายชื่อค้างประเมินแล้ว", "download"); };

  return (
    <div className="grid">
      <div className="page-head">
        <div><h1>ติดตามการประเมินผล</h1><p>สถานะและรายชื่อที่ต้องประเมิน แยกตามหน่วยงาน · รอบประเมินปี {cy}</p></div>
        <div className="row wrap" style={{ gap: 10 }}>
          <div className="seg"><Seg options={[{ value: "pending", label: "เฉพาะค้างประเมิน" }, { value: "all", label: "ทุกหน่วยงาน" }]} value={view} onChange={setView} /></div>
          <button className="btn btn-ghost" onClick={exportCSV}><Icon name="download" size={16} />ส่งออกรายชื่อค้างประเมิน</button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px,1fr))" }}>
        <Stat icon="users" label="พนักงานทั้งหมด" value={totalEmp} unit="คน" tone="#2563eb" soft="#e8effb" />
        <Stat icon="checkCircle" label="ประเมินแล้ว" value={totalDone} unit="คน" tone="#16a34a" soft="#e7f6ec" sub={totalEmp ? Math.round(totalDone / totalEmp * 100) + "% ของทั้งหมด" : ""} />
        <Stat icon="clock" label="รอประเมิน" value={totalEmp - totalDone} unit="คน" tone="#e08a00" soft="#fdf1dc" />
        <Stat icon="trophy" label="หน่วยงานเสร็จครบ" value={fullDepts} unit={"/ " + groups.length} tone="#0d9488" soft="#e2f4f2" />
      </div>

      <div className="grid">
        {shown.map((g) => {
          const isOpen = !!open[g.d.id];
          return (
            <Card key={g.d.id}>
              <button className="between" onClick={() => toggle(g.d.id)} style={{ width: "100%", border: "none", background: "none", cursor: "pointer", padding: "16px 20px", gap: 14, textAlign: "left" }}>
                <div className="row" style={{ gap: 12, minWidth: 0, flex: 1 }}>
                  <span className="tag-dot" style={{ background: g.d.color, width: 12, height: 12 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="row" style={{ gap: 8 }}><b style={{ fontSize: 15 }}>{g.d.name}</b>{g.pendingList.length > 0 ? <Badge cls="b-amber" dot>ค้าง {g.pendingList.length}</Badge> : <Badge cls="b-green" dot>ครบ</Badge>}</div>
                    <div style={{ marginTop: 8, maxWidth: 440 }}><ScoreBar value={g.pct} color={g.pct === 100 ? "#16a34a" : g.d.color} /></div>
                  </div>
                </div>
                <div className="row" style={{ gap: 14 }}>
                  <div style={{ textAlign: "right" }}><div className="num" style={{ fontWeight: 700, fontSize: 18 }}>{g.done}/{g.total}</div><div className="muted" style={{ fontSize: 11.5 }}>ประเมินแล้ว · {g.pct}%</div></div>
                  <Icon name={isOpen ? "chevDown" : "chevRight"} size={18} color="var(--text-3)" />
                </div>
              </button>
              {isOpen && g.pendingList.length > 0 && (
                <div style={{ borderTop: "1px solid var(--border-2)", padding: "6px 10px 10px" }}>
                  {g.pendingList.map((e) => { const sm = statusMeta(e.status); return (
                    <div key={e.id} className="between" style={{ gap: 10, padding: "9px 10px", borderBottom: "1px solid var(--border-2)" }}>
                      <button className="row" onClick={() => ctx.openEmp(e.id)} style={{ gap: 11, border: "none", background: "none", cursor: "pointer", minWidth: 0, flex: 1, textAlign: "left", padding: 0 }}>
                        <Avatar name={e.name} initials={e.initials} color={e.color} src={e.photo_url} size={34} />
                        <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name}</div><div className="muted" style={{ fontSize: 12 }}>{e.position}</div></div>
                      </button>
                      <div className="row" style={{ gap: 8 }}>
                        <Badge cls={sm.cls} dot>{sm.label}</Badge>
                        <button className="btn btn-pri btn-sm" onClick={() => ctx.startEval(e.id)}><Icon name="eval" size={14} />ประเมิน</button>
                      </div>
                    </div>
                  ); })}
                </div>
              )}
              {isOpen && g.pendingList.length === 0 && <div className="muted" style={{ padding: "0 20px 16px", fontSize: 13 }}>ทุกคนในหน่วยงานนี้ประเมินครบแล้ว ✓</div>}
            </Card>
          );
        })}
        {shown.length === 0 && <Card className="card-pad"><div className="muted" style={{ textAlign: "center", padding: "22px 0" }}>ทุกหน่วยงานประเมินครบแล้ว 🎉</div></Card>}
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
                    <td><div className="row" style={{ gap: 10 }}><Avatar name={e.name} initials={e.initials} color={e.color} src={e.photo_url} size={34} /><span style={{ fontWeight: 600, fontSize: 13.5 }}>{e.name}</span></div></td>
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

/* =========================================================
   HR DATA DASHBOARD — ข้อมูลพนักงานเชิงประชากร (แยกจากระบบประเมิน)
   ========================================================= */
function HRBars({ rows, palette }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  const total = rows.reduce((s, r) => s + r.n, 0) || 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      {rows.map((r, i) => {
        const c = (palette && palette[i % palette.length]) || "#2563eb";
        return (
          <div key={r.label} className="row" style={{ gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: 12.5, minWidth: 116, textAlign: "right", color: "var(--text-2)" }}>{r.label}</span>
            <div style={{ flex: 1, background: "var(--surface-3)", borderRadius: 7, height: 20, overflow: "hidden" }}>
              <div style={{ width: (r.n / max * 100) + "%", height: "100%", background: c, borderRadius: 7 }} />
            </div>
            <span className="num" style={{ fontWeight: 700, minWidth: 70, textAlign: "right", fontSize: 12.5 }}>{r.n} · {Math.round(r.n / total * 100)}%</span>
          </div>
        );
      })}
    </div>
  );
}

// แท่งแนวตั้ง (histogram) สำหรับช่วงอายุ/อายุงาน
function HRVBars({ rows, palette }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  const total = rows.reduce((s, r) => s + r.n, 0) || 1;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 200, padding: "6px 4px 0" }}>
      {rows.map((r, i) => {
        const c = (palette && palette[i % palette.length]) || "#2563eb";
        const h = Math.max(4, Math.round(r.n / max * 140));
        return (
          <div key={r.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 0 }}>
            <div className="num" style={{ fontWeight: 700, fontSize: 14, color: c }}>{r.n}</div>
            <div style={{ width: "62%", maxWidth: 50, height: h, background: "linear-gradient(180deg," + c + "," + c + "cc)", borderRadius: "9px 9px 0 0" }} />
            <div className="muted" style={{ fontSize: 10.5 }}>{Math.round(r.n / total * 100)}%</div>
            <div style={{ fontSize: 11, color: "var(--text-2)", textAlign: "center", lineHeight: 1.25, fontWeight: 500 }}>{r.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// พีระมิดระดับตำแหน่ง (บนแคบ→ล่างกว้าง)
function HRPyramid({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  const total = rows.reduce((s, r) => s + r.n, 0) || 1;
  const colors = ["#15803d", "#0d9488", "#2563eb", "#e08a00", "#64748b", "#9333ea"];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, alignItems: "center", padding: "12px 6px" }}>
      {rows.map((r, i) => {
        const w = 34 + (r.n / max) * 66; const c = colors[i % colors.length];
        return (
          <div key={r.label} style={{ width: w + "%", minWidth: 150, background: c, color: "#fff", borderRadius: 9, padding: "9px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, boxShadow: "0 2px 6px " + c + "55" }}>
            <span style={{ fontWeight: 600 }}>{r.label}</span>
            <span className="num" style={{ fontWeight: 700 }}>{r.n} · {Math.round(r.n / total * 100)}%</span>
          </div>
        );
      })}
    </div>
  );
}

// ผังองค์กรแบบต้นไม้ (ตำแหน่งสูงบนสุด + เส้นเชื่อม · ไม่ระบุชื่อ)
function HROrgStructure({ employees }) {
  const LRANK = { "ผู้บริหารระดับสูง": 0, "ผู้บริหาร": 1, "ผู้จัดการ": 1, "ผู้ช่วยผู้จัดการ": 2, "หัวหน้างาน": 3, "วิศวกร": 4, "วิชาชีพ": 4, "เจ้าหน้าที่": 5, "ช่างฝีมือ": 6, "พนักงาน": 7, "ปฏิบัติการ": 7 };
  const rankOf = (lv) => LRANK[lv] != null ? LRANK[lv] : (/ผู้จัดการ|ผจก|กรรมการ|ประธาน/.test(lv || "") ? 1 : /หัวหน้า/.test(lv || "") ? 3 : /เจ้าหน้าที่/.test(lv || "") ? 5 : 8);
  const col = (r) => r <= 0 ? "#1e3a8a" : r <= 1 ? "#15803d" : r <= 2 ? "#0d9488" : r <= 3 ? "#0891b2" : r <= 5 ? "#2563eb" : "#64748b";
  const LINE = "var(--border)";
  // หาตำแหน่งสูงสุด (root)
  let rootEmp = null; employees.forEach((e) => { if (!rootEmp || rankOf(e.level) < rankOf(rootEmp.level)) rootEmp = e; });
  const rootPos = rootEmp ? rootEmp.position : "องค์กร"; const rootDept = rootEmp ? rootEmp.dept : null;
  const byDept = {}; employees.forEach((e) => { (byDept[e.dept] = byDept[e.dept] || []).push(e); });
  const depts = Object.keys(byDept).map((id) => {
    const list = byDept[id]; const posMap = {};
    list.forEach((e) => { if (id === rootDept && e.position === rootPos) return; const p = e.position || "-"; (posMap[p] = posMap[p] || { position: p, level: e.level, n: 0 }).n++; });
    const positions = Object.values(posMap).sort((a, b) => rankOf(a.level) - rankOf(b.level) || b.n - a.n);
    return { id, name: window.deptName(id), head: list.length, positions, minRank: positions.length ? Math.min(...positions.map((p) => rankOf(p.level))) : 9 };
  }).filter((d) => d.positions.length).sort((a, b) => a.minRank - b.minRank);
  const Box = ({ label, sub, count, r, w }) => (
    <div style={{ width: w || 168, border: "1px solid var(--border)", borderRadius: 9, overflow: "hidden", background: "var(--surface)", boxShadow: "var(--shadow-sm)", flex: "0 0 auto" }}>
      <div style={{ background: col(r), color: "#fff", padding: "7px 10px", fontSize: 12, fontWeight: 700, lineHeight: 1.3, minHeight: 34, display: "flex", alignItems: "center" }}>{label}</div>
      <div className="between" style={{ padding: "5px 10px", fontSize: 11.5 }}><span className="muted">{sub || "จำนวน"}</span><span className="num" style={{ fontWeight: 700 }}>{count != null ? count : 1}{sub ? "" : " คน"}</span></div>
    </div>
  );
  const vline = (h) => <div style={{ width: 2, height: h, background: LINE, margin: "0 auto" }} />;
  return (
    <div style={{ overflowX: "auto", paddingBottom: 10 }}>
      <div style={{ minWidth: "min-content", display: "flex", flexDirection: "column", alignItems: "center", padding: "4px 10px" }}>
        <Box label={rootPos} r={0} sub="ระดับสูงสุด" count={1} w={210} />
        {vline(16)}
        <div style={{ height: 2, background: LINE, alignSelf: "stretch", margin: "0 90px" }} />
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          {depts.map((d) => (
            <div key={d.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              {vline(14)}
              <Box label={d.name} sub="พนักงาน" count={d.head} r={d.minRank} />
              {vline(10)}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                {d.positions.map((p, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && vline(8)}
                    <Box label={p.position} count={p.n} r={rankOf(p.level)} />
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HRDataDashboard({ ctx }) {
  const R = window.EMPLOYEES || []; // ใช้ฐานพนักงานรวม (เชื่อมข้อมูลแล้ว)
  const total = R.length;
  const genderOf = (x) => x.gender || (x.female ? "หญิง" : "ชาย");
  const tenYears = (x) => { if (x.tenure_years != null) return x.tenure_years; if (!x.hire_date) return null; const d = new Date(x.hire_date); if (isNaN(d)) return null; return (Date.now() - d) / (365.25 * 86400 * 1000); };
  const dist = (mapFn, order) => {
    const o = {}; R.forEach((x) => { const k = mapFn(x) || "(ไม่ระบุ)"; o[k] = (o[k] || 0) + 1; });
    let arr = Object.entries(o).map(([label, n]) => ({ label, n }));
    if (order) arr.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
    else arr.sort((a, b) => b.n - a.n);
    return arr;
  };
  const ageRange = (a) => a == null ? "(ไม่ระบุ)" : a < 30 ? "ต่ำกว่า 30 ปี" : a < 40 ? "30–39 ปี" : a < 50 ? "40–49 ปี" : "50 ปีขึ้นไป";
  const tenRange = (t) => t == null ? "(ไม่ระบุ)" : t < 2 ? "ต่ำกว่า 2 ปี" : t < 5 ? "2–5 ปี" : t < 10 ? "5–10 ปี" : "10 ปีขึ้นไป";
  const withAge = R.filter((x) => x.age != null);
  const avgAge = withAge.length ? Math.round(withAge.reduce((s, x) => s + x.age, 0) / withAge.length * 10) / 10 : 0;
  const tens = R.map(tenYears).filter((t) => t != null);
  const avgTen = tens.length ? Math.round(tens.reduce((s, t) => s + t, 0) / tens.length * 10) / 10 : 0;
  const male = R.filter((x) => genderOf(x) === "ชาย").length, female = R.filter((x) => genderOf(x) === "หญิง").length;
  const thai = R.filter((x) => x.nationality === "ไทย").length;
  const genderPie = [{ label: "ชาย", v: male, color: "#2563eb" }, { label: "หญิง", v: female, color: "#db2777" }];
  const GEN_ORDER = ["Baby Boomer", "Gen X", "Gen Y / Millennials", "Gen Z"];
  const EDU_ORDER = ["ประถมศึกษา", "มัธยมต้น", "มัธยมปลาย", "ปวช.", "ปวส.", "ปริญญาตรี", "ปริญญาโท", "(ไม่ระบุ)"];
  const AGE_ORDER = ["ต่ำกว่า 30 ปี", "30–39 ปี", "40–49 ปี", "50 ปีขึ้นไป", "(ไม่ระบุ)"];
  const TEN_ORDER = ["ต่ำกว่า 2 ปี", "2–5 ปี", "5–10 ปี", "10 ปีขึ้นไป", "(ไม่ระบุ)"];
  const LV_ORDER = ["ผู้บริหารระดับสูง", "ผู้บริหาร", "หัวหน้างาน", "เจ้าหน้าที่", "พนักงาน"];
  const PB = ["#2563eb", "#0d9488", "#7c3aed", "#e08a00", "#db2777", "#0891b2", "#16a34a", "#64748b"];
  const exportCSV = () => {
    downloadCSV("hr_employees.csv", ["รหัส", "รหัส HR", "ชื่อ", "หน่วยงาน", "ตำแหน่ง", "วันเกิด", "อายุ", "วันเริ่มงาน", "อายุงาน", "เพศ", "สัญชาติ", "พื้นที่", "วุฒิการศึกษา", "ระดับ", "Generation"],
      R.map((x) => [x.id, x.hr_code || "-", x.name, deptName(x.dept), x.position, x.birth_date || "-", x.age != null ? x.age : "-", x.hire_date || "-", x.tenure || "-", genderOf(x), x.nationality || "-", x.area || "-", x.education || "-", x.level, x.generation || "-"]));
    toast("ส่งออกข้อมูลพนักงานแล้ว", "download");
  };
  // ตรวจสอบความครบถ้วนของข้อมูล
  const CHECKS = [
    { k: "jd_id", label: "ผูก JD", test: (e) => !!e.jd_id },
    { k: "supervisor_id", label: "ผู้บังคับบัญชา", test: (e) => !!e.supervisor_id },
    { k: "email", label: "อีเมล", test: (e) => !!e.email },
    { k: "phone", label: "เบอร์โทร", test: (e) => !!e.phone },
    { k: "birth_date", label: "วันเกิด", test: (e) => !!e.birth_date },
    { k: "hire_date", label: "วันเข้างาน", test: (e) => !!e.hire_date },
    { k: "education", label: "วุฒิการศึกษา", test: (e) => !!e.education },
  ];
  const incomplete = R.map((e) => ({ e, missing: CHECKS.filter((c) => !c.test(e)) })).filter((x) => x.missing.length);
  const completeCount = total - incomplete.length;
  const pctComplete = total ? Math.round(completeCount / total * 100) : 0;
  const fieldMissing = CHECKS.map((c) => ({ label: c.label, n: R.filter((e) => !c.test(e)).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  const exportIncomplete = () => {
    downloadCSV("employees_incomplete.csv", ["รหัส", "ชื่อ", "หน่วยงาน", "ตำแหน่ง", "ข้อมูลที่ยังขาด"],
      incomplete.map(({ e, missing }) => [e.id, e.name, deptName(e.dept), e.position, missing.map((m) => m.label).join(", ")]));
    toast("ส่งออกรายชื่อข้อมูลไม่ครบแล้ว", "download");
  };

  return (
    <div className="grid">
      <div className="page-head">
        <div><h1>แดชบอร์ดข้อมูลพนักงาน</h1><p>ข้อมูลเชิงประชากร · พนักงานทั้งหมด {total} คน</p></div>
        <button className="btn btn-pri" onClick={exportCSV}><Icon name="download" size={16} />Export Excel</button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))" }}>
        <Stat icon="users" label="พนักงานทั้งหมด" value={total} unit="คน" tone="#2563eb" soft="#e8effb" />
        <Stat icon="calendar" label="อายุเฉลี่ย" value={avgAge} unit="ปี" tone="#7c3aed" soft="#f1ebfd" />
        <Stat icon="briefcase" label="อายุงานเฉลี่ย" value={avgTen} unit="ปี" tone="#0d9488" soft="#e2f4f2" />
        <Stat icon="employee" label="ชาย / หญิง" value={male + " / " + female} tone="#e08a00" soft="#fdf1dc" />
        <Stat icon="trophy" label="สัญชาติไทย" value={total ? Math.round(thai / total * 100) : 0} unit="%" tone="#16a34a" soft="#e7f6ec" sub={thai + " คน"} />
      </div>

      {/* แถวโดนัท 3 วง — สัดส่วน */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px,1fr))" }}>
        <Card><CardHead title="การกระจายตามเพศ" sub="Gender" /><div className="card-pad" style={{ display: "grid", placeItems: "center" }}><Donut data={genderPie} centerLabel="พนักงาน" centerValue={total} /></div></Card>
        <Card><CardHead title="ช่วงอายุ (Generation)" sub="Baby Boomer → Gen Z" /><div className="card-pad" style={{ display: "grid", placeItems: "center" }}><Donut data={dist((x) => x.generation, GEN_ORDER).map((r, i) => ({ label: r.label, v: r.n, color: PB[i % PB.length] }))} centerLabel="รุ่น" /></div></Card>
        <Card><CardHead title="สัญชาติ" sub="Nationality" /><div className="card-pad" style={{ display: "grid", placeItems: "center" }}><Donut data={dist((x) => x.nationality).map((r, i) => ({ label: r.label, v: r.n, color: PB[i % PB.length] }))} centerLabel="สัญชาติ" /></div></Card>
      </div>

      {/* แถวแท่งแนวตั้ง — การกระจายช่วง */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px,1fr))" }}>
        <Card><CardHead title="การกระจายตามช่วงอายุ" sub="Age distribution" /><div className="card-pad"><HRVBars rows={dist((x) => ageRange(x.age), AGE_ORDER)} palette={["#0ea5e9", "#2563eb", "#7c3aed", "#db2777", "#94a3b8"]} /></div></Card>
        <Card><CardHead title="การกระจายตามช่วงอายุงาน" sub="Tenure distribution" /><div className="card-pad"><HRVBars rows={dist((x) => tenRange(tenYears(x)), TEN_ORDER)} palette={["#16a34a", "#0d9488", "#0891b2", "#e08a00", "#94a3b8"]} /></div></Card>
      </div>

      {/* แถวแท่งแนวนอน + พีระมิด */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(330px,1fr))" }}>
        <Card><CardHead title="จำนวนพนักงานตามหน่วยงาน" sub="Headcount by department" /><div className="card-pad"><HRBars rows={dist((x) => deptName(x.dept))} palette={PB} /></div></Card>
        <Card><CardHead title="ระดับการศึกษา" sub="Education" /><div className="card-pad"><HRBars rows={dist((x) => x.education || "(ไม่ระบุ)", EDU_ORDER)} palette={PB} /></div></Card>
        <Card><CardHead title="โครงสร้างระดับตำแหน่ง" sub="Organization pyramid" /><div className="card-pad"><HRPyramid rows={dist((x) => x.level, LV_ORDER)} /></div></Card>
      </div>

      {/* โครงสร้างองค์กรตามตำแหน่งงาน */}
      <Card>
        <CardHead title="โครงสร้างองค์กร (ตามตำแหน่งงาน)" sub="ผังต้นไม้ · ตำแหน่งสูงสุดอยู่บนสุด · ตัวเลข = จำนวนคนต่อตำแหน่ง (เลื่อนแนวนอนเพื่อดูทุกหน่วยงาน)" />
        <div className="card-pad"><HROrgStructure employees={R} /></div>
      </Card>

      {/* ตรวจสอบความครบถ้วนของข้อมูล */}
      <Card>
        <CardHead title="ตรวจสอบความครบถ้วนของข้อมูลพนักงาน"
          sub={"ข้อมูลครบ " + completeCount + "/" + total + " คน (" + pctComplete + "%) · ยังไม่ครบ " + incomplete.length + " คน"}
          right={incomplete.length > 0 ? <button className="btn btn-ghost btn-sm" onClick={exportIncomplete}><Icon name="download" size={14} />ส่งออกที่ไม่ครบ</button> : <Badge cls="b-green" dot>ครบทุกคน</Badge>} />
        <div className="card-pad">
          <div style={{ height: 8, borderRadius: 6, background: "var(--surface-3)", overflow: "hidden", marginBottom: 14 }}>
            <div style={{ width: pctComplete + "%", height: "100%", background: pctComplete >= 90 ? "#16a34a" : pctComplete >= 60 ? "#e08a00" : "#e11d48" }} />
          </div>
          <div className="row wrap" style={{ gap: 8, marginBottom: 14 }}>
            {fieldMissing.length === 0 ? <span className="badge b-green"><span className="bdot" />ข้อมูลครบทุกฟิลด์</span> : fieldMissing.map((f) => <span key={f.label} className="badge b-amber">{f.label}: ขาด {f.n}</span>)}
          </div>
          {incomplete.length > 0 && (
            <div className="tbl-wrap" style={{ maxHeight: 360, overflowY: "auto" }}>
              <table className="tbl" style={{ fontSize: 12.5 }}>
                <thead><tr><th>พนักงาน</th><th>หน่วยงาน</th><th>ข้อมูลที่ยังขาด</th><th></th></tr></thead>
                <tbody>{incomplete.map(({ e, missing }) => (
                  <tr key={e.id} style={{ cursor: "pointer" }} title="คลิกเพื่อดู/แก้ไขข้อมูลพนักงาน" onClick={() => ctx.openEmp(e.id)}>
                    <td><div className="row" style={{ gap: 9 }}><Avatar name={e.name} initials={e.initials} color={e.color} size={28} /><div><div style={{ fontWeight: 600 }}>{e.name}</div><div className="muted" style={{ fontSize: 11 }}>รหัส {e.id}</div></div></div></td>
                    <td className="muted">{deptName(e.dept)}</td>
                    <td><div className="row wrap" style={{ gap: 5 }}>{missing.map((m) => <span key={m.k} className="badge b-red" style={{ fontSize: 10.5 }}>{m.label}</span>)}</div></td>
                    <td><Icon name="chevRight" size={15} color="var(--text-3)" /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

Object.assign(window, { EmployeeList, EmployeeProfile, DepartmentKPI, HRDataDashboard });
