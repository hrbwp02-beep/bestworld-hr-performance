// สร้างแบบประเมินสำรอง (Excel) แยกไฟล์ต่อหน่วยงาน จาก data.json (ดึงจากฐาน perf_* รอบ 2569)
// สูตรคะแนนเลียนแบบ perf_results(): ระดับเฉลี่ยถ่วงน้ำหนักต่อส่วน → % (ระดับ 3 = 70) → ผลงาน 90 ตามน้ำหนักส่วน + มาทำงาน 10 − ใบเตือน
// ใช้: node gen.js <โฟลเดอร์ปลายทาง>
const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

const D = JSON.parse(fs.readFileSync(path.join(__dirname, "data.json"), "utf8"));
const OUT = process.argv[2];
const cfg = D.cycle.config;
const W = cfg.weights;
const BANDS = cfg.bands.slice().sort((a, b) => a[0] - b[0]); // น้อย → มาก สำหรับ MATCH
const FONT = "Tahoma";
const LEVEL = { ops: "พนักงานปฏิบัติการ", office: "เจ้าหน้าที่สำนักงาน", supervisor: "หัวหน้างาน", manager: "ผู้จัดการขึ้นไป" };
const SECNAME = { A: "A · งานตามหน้าที่ (JD)", B_skill: "B · ทักษะงานตามตำแหน่ง", B_lead: "B · ภาวะผู้นำ", C: "C · พฤติกรรมหลัก" };
const DEDUCT = { late: "มาสาย", absent: "ขาดงาน", personal_over: "ลากิจเกินสิทธิ์", sick_over: "ลาป่วยเกินสิทธิ์", sick_no_cert: "ลาป่วยไม่มีใบรับรองแพทย์", unapproved: "ลาโดยไม่ได้รับอนุมัติ", unpaid: "ลาไม่รับค่าจ้าง", warn_verbal: "หนังสือเตือนด้วยวาจา", warn_written_1: "หนังสือเตือนลายลักษณ์อักษร ครั้งที่ 1", warn_written_2: "หนังสือเตือนลายลักษณ์อักษร ครั้งที่ 2", warn_written_3: "หนังสือเตือนลายลักษณ์อักษร ครั้งที่ 3", suspend: "พักงาน", adjust: "ปรับคะแนน" };
const thDate = (s) => { if (!s) return "—"; const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return d + "/" + m + "/" + (y + 543); };

// สี
const C = { navy: "FF1E3A5F", head: "FFDCE6F1", sec: "FFEEF2F7", input: "FFFFF2CC", hr: "FFE2EFDA", line: "FFB7C3D0", white: "FFFFFFFF", note: "FF5B6B7A" };
const border = { top: { style: "thin", color: { argb: C.line } }, left: { style: "thin", color: { argb: C.line } }, bottom: { style: "thin", color: { argb: C.line } }, right: { style: "thin", color: { argb: C.line } } };
const fill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const f = (o = {}) => ({ name: FONT, size: 10, ...o });

// หัวข้อของแต่ละคน — กฎเดียวกับ perf_items()
function itemsOf(p) {
  const src = p.own_items ? (D.person_items || []).filter((i) => i.a === p.id) : D.jd_items.filter((i) => i.jd === p.jd_id);
  const lv = p.level, wt = W[lv] || {};
  const out = [];
  const push = (key, list) => { if ((wt[key[0]] == null ? 1 : wt[key[0]]) > 0 && list.length) out.push({ key, list }); };
  push("A", src.filter((i) => i.s === "A").map((i) => ({ t: i.t, std: i.std, w: Number(i.w) })));
  if (lv === "ops" || lv === "office") push("B_skill", src.filter((i) => i.s === "B").map((i) => ({ t: i.t, std: i.std, w: Number(i.w) })));
  else push("B_lead", D.common.filter((c) => c.kind === "lead").map((c) => ({ t: c.t, std: c.std, w: 1 })));
  push("C", D.common.filter((c) => c.kind === "core").map((c) => ({ t: c.t, std: c.std, w: 1 })));
  return out;
}

function personSheet(wb, p) {
  const ws = wb.addWorksheet(p.employee_id, { views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } } });
  ws.columns = [{ width: 7 }, { width: 5 }, { width: 42 }, { width: 42 }, { width: 9 }, { width: 11 }, { width: 28 }];
  const wt = W[p.level] || {};
  let r = 1;
  ws.mergeCells("A1:G1"); ws.getCell("A1").value = "แบบประเมินผลการปฏิบัติงานประจำปี 2569 (ฉบับสำรอง Excel)";
  ws.getCell("A1").font = f({ size: 15, bold: true, color: { argb: C.navy } });
  ws.mergeCells("A2:G2"); ws.getCell("A2").value = "บริษัท เบสท์เวิลด์ อินเตอร์พลาส จำกัด · ช่วงผลงาน " + thDate(D.cycle.period_start) + " – " + thDate(D.cycle.period_end) + " · เลขที่ใบในระบบ " + (p.doc_no || "—");
  ws.getCell("A2").font = f({ color: { argb: C.note } });
  // ข้อมูลพนักงาน
  const info = [["ชื่อ-สกุล", p.name, "รหัสพนักงาน", p.employee_id], ["ตำแหน่ง", p.position, "ระดับ", LEVEL[p.level] || p.level],
    ["หน่วยงาน / สาย", (p.dept_name || p.dept) + (p.line_name ? " · " + p.line_name : ""), "ผู้ประเมินคนที่ 1", p.ev1 || "—"],
    ["JD", (p.jd_id || "—") + (p.jd_title ? " · " + p.jd_title : "") + (p.own_items ? " (หัวข้อเฉพาะบุคคล)" : ""), "ผู้ประเมินคนที่ 2", p.ev2 || "—"]];
  r = 4;
  for (const [l1, v1, l2, v2] of info) {
    ws.mergeCells(`A${r}:B${r}`); ws.getCell(`A${r}`).value = l1; ws.getCell(`C${r}`).value = v1; ws.getCell(`E${r}`).value = l2; ws.mergeCells(`F${r}:G${r}`); ws.getCell(`F${r}`).value = v2;
    for (const c of ["A", "E"]) { ws.getCell(`${c}${r}`).font = f({ bold: true, color: { argb: C.note } }); }
    for (const c of ["C", "F"]) ws.getCell(`${c}${r}`).font = f({ bold: c === "C" && r === 4 });
    r++;
  }
  ws.mergeCells(`A${r}:G${r}`);
  ws.getCell(`A${r}`).value = "น้ำหนักส่วนของระดับนี้: A " + (wt.A || 0) + "% · B " + (wt.B || 0) + "% · C " + (wt.C || 0) + "%   ·   ช่องสีเหลือง = ผู้ประเมินกรอก (ระดับ 1–5)";
  ws.getCell(`A${r}`).font = f({ size: 9, color: { argb: C.note } });
  r += 2;
  // หัวตาราง
  const hdr = r;
  ["ส่วน", "ข้อ", "หัวข้อประเมิน", "มาตรฐานระดับ 3 (ทำได้ตามที่คาดหวัง)", "น้ำหนักข้อ", "ระดับ 1–5", "หมายเหตุ / หลักฐาน"].forEach((t, i) => {
    const c = ws.getRow(r).getCell(i + 1); c.value = t; c.font = f({ bold: true, color: { argb: C.white } }); c.fill = fill(C.navy); c.border = border;
    c.alignment = { vertical: "middle", horizontal: i >= 4 ? "center" : "left", wrapText: true };
  });
  ws.getRow(r).height = 30;
  r++;
  const secs = itemsOf(p), ranges = {};
  let nItems = 0;
  for (const s of secs) {
    ws.mergeCells(`A${r}:G${r}`); const sc = ws.getCell(`A${r}`);
    sc.value = SECNAME[s.key] + " — น้ำหนัก " + (wt[s.key[0]] || 0) + "%"; sc.font = f({ bold: true, color: { argb: C.navy } }); sc.fill = fill(C.sec); sc.border = border;
    r++;
    const r0 = r;
    s.list.forEach((it, i) => {
      const row = ws.getRow(r);
      row.getCell(1).value = s.key[0]; row.getCell(2).value = i + 1; row.getCell(3).value = it.t; row.getCell(4).value = it.std || ""; row.getCell(5).value = it.w;
      for (let k = 1; k <= 7; k++) { const c = row.getCell(k); c.font = f(k === 4 ? { size: 9, color: { argb: C.note } } : {}); c.border = border; c.alignment = { vertical: "top", wrapText: true, horizontal: k === 1 || k === 2 || k === 5 || k === 6 ? "center" : "left" }; }
      const rc = row.getCell(6); rc.fill = fill(C.input); rc.font = f({ bold: true, size: 12 }); rc.protection = { locked: false }; rc.alignment = { vertical: "middle", horizontal: "center" };
      rc.dataValidation = { type: "whole", operator: "between", allowBlank: true, formulae: [1, 5], showErrorMessage: true, errorStyle: "stop", errorTitle: "ระดับไม่ถูกต้อง", error: "ใส่ได้เฉพาะตัวเลข 1 ถึง 5",
        showInputMessage: true, promptTitle: "ระดับ 1–5", prompt: "1 ต่ำกว่าที่คาดหวังมาก · 2 ต่ำกว่าที่คาดหวัง · 3 ตามที่คาดหวัง · 4 ดีกว่าที่คาดหวัง · 5 โดดเด่น" };
      const nc = row.getCell(7); nc.fill = fill("FFFFFBEA"); nc.protection = { locked: false };
      const len = Math.max(String(it.t).length / 38, String(it.std || "").length / 44);
      row.height = Math.max(20, Math.ceil(len) * 14 + 6);
      r++; nItems++;
    });
    ranges[s.key[0]] = { w: `E${r0}:E${r - 1}`, r: `F${r0}:F${r - 1}` };
  }
  const allR = `F${hdr + 1}:F${r - 1}`;
  r += 1;
  // สรุปคะแนน
  ws.mergeCells(`A${r}:G${r}`); ws.getCell(`A${r}`).value = "สรุปคะแนน (ระบบคำนวณให้อัตโนมัติ)"; ws.getCell(`A${r}`).font = f({ size: 12, bold: true, color: { argb: C.navy } });
  r++;
  const sh = r;
  ["ส่วน", "", "", "น้ำหนักส่วน (%)", "ระดับเฉลี่ย", "คิดเป็น %", "คะแนนที่ได้ (จาก 90)"].forEach((t, i) => {
    const c = ws.getRow(r).getCell(i + 1); c.value = t || null; c.font = f({ bold: true }); c.fill = fill(C.head); c.border = border; c.alignment = { horizontal: i >= 3 ? "center" : "left", wrapText: true };
  });
  ws.mergeCells(`A${r}:C${r}`);
  r++;
  const rowOf = {};
  for (const k of ["A", "B", "C"]) {
    const s = secs.find((x) => x.key[0] === k);
    ws.mergeCells(`A${r}:C${r}`);
    ws.getCell(`A${r}`).value = s ? SECNAME[s.key] : ({ A: SECNAME.A, B: "B", C: SECNAME.C })[k] + " (ไม่มีหัวข้อ)";
    ws.getCell(`D${r}`).value = s ? (wt[k] || 0) : 0;
    if (s) {
      const g = ranges[k];
      ws.getCell(`E${r}`).value = { formula: `IF(COUNT(${g.r})=0,"",SUMPRODUCT(${g.w},${g.r})/SUMIF(${g.r},"<>",${g.w}))` };
      ws.getCell(`F${r}`).value = { formula: `IF(E${r}="","",70+(E${r}-3)*15)` };
    } else { ws.getCell(`E${r}`).value = ""; ws.getCell(`F${r}`).value = ""; }
    rowOf[k] = r; r++;
  }
  const [ra, rb, rc] = [rowOf.A, rowOf.B, rowOf.C];
  const effW = `(IF(F${ra}="",0,D${ra})+IF(F${rb}="",0,D${rb})+IF(F${rc}="",0,D${rc}))`;
  for (const k of ["A", "B", "C"]) { const x = rowOf[k]; ws.getCell(`G${x}`).value = { formula: `IF(OR(F${x}="",${effW}=0),"",0.9*D${x}*F${x}/${effW})` }; }
  const lines = [
    ["ผลงานรวม (เต็ม 90)", { formula: `IF(${effW}=0,"",SUM(G${ra}:G${rc}))` }, "perf"],
    ["คะแนนที่ถูกหักจากการมาทำงาน (HR กรอก/ตรวจ)", Number(p.orange) || 0, "ded"],
    ["การมาทำงาน (เต็ม 10)", null, "att"],
    ["หักจากหนังสือเตือน (HR กรอก/ตรวจ)", Number(p.warn) || 0, "warn"],
    ["คะแนนรวม (เต็ม 100)", null, "total"],
    ["ให้คะแนนแล้ว (ข้อ)", { formula: `COUNT(${allR})&" / ${nItems}"` }, "cnt"],
    ["เกรด", null, "grade"],
    ["ความหมาย", null, "mean"],
  ];
  const at = {};
  for (const [lab, val, key] of lines) { at[key] = r; ws.mergeCells(`A${r}:F${r}`); ws.getCell(`A${r}`).value = lab; ws.getCell(`G${r}`).value = val; r++; }
  ws.getCell(`G${at.att}`).value = { formula: `10-G${at.ded}` };
  ws.getCell(`G${at.total}`).value = { formula: `IF(G${at.perf}="","",ROUND(G${at.perf}+G${at.att}-G${at.warn},1))` };
  const mins = `'เกณฑ์'!$A$5:$A$${4 + BANDS.length}`, grades = `'เกณฑ์'!$B$5:$B$${4 + BANDS.length}`, means = `'เกณฑ์'!$C$5:$C$${4 + BANDS.length}`;
  ws.getCell(`G${at.grade}`).value = { formula: `IF(G${at.total}="","",IF(COUNT(${allR})<${nItems},"ยังไม่ครบ",INDEX(${grades},MATCH(MAX(0,ROUND(G${at.total},0)),${mins},1))))` };
  ws.getCell(`G${at.mean}`).value = { formula: `IF(OR(G${at.grade}="",G${at.grade}="ยังไม่ครบ"),"",INDEX(${means},MATCH(G${at.grade},${grades},0)))` };
  for (let x = sh + 1; x < r; x++) {
    for (let k = 1; k <= 7; k++) { const c = ws.getRow(x).getCell(k); c.border = border; c.font = f(); if (k >= 4) c.alignment = { horizontal: "center", vertical: "middle" }; }
  }
  for (const k of ["A", "B", "C"]) { ws.getCell(`E${rowOf[k]}`).numFmt = "0.00"; ws.getCell(`F${rowOf[k]}`).numFmt = "0.0"; ws.getCell(`G${rowOf[k]}`).numFmt = "0.00"; }
  for (const k of ["perf", "ded", "att", "warn", "total"]) ws.getCell(`G${at[k]}`).numFmt = "0.0";
  for (const k of ["ded", "warn"]) { ws.getCell(`G${at[k]}`).fill = fill(C.hr); ws.getCell(`G${at[k]}`).font = f({ color: { argb: "FF0000FF" } }); }
  for (const k of ["perf", "total", "grade"]) { ws.getCell(`A${at[k]}`).font = f({ bold: true }); ws.getCell(`G${at[k]}`).font = f({ bold: true, size: k === "grade" ? 14 : 11 }); }
  ws.getCell(`G${at.grade}`).fill = fill(C.head);
  // รายการคะแนนหัก (ข้อมูลจากระบบ ณ วันที่ส่งออก)
  r++;
  ws.mergeCells(`A${r}:G${r}`);
  const ds = (p.deds || []).map((d) => (DEDUCT[d.k] || d.k) + " " + d.q + " → หัก " + d.p + (d.n ? " (" + d.n + ")" : ""));
  ws.getCell(`A${r}`).value = "รายละเอียดคะแนนหัก (จากระบบ ณ " + thDate(new Date().toISOString()) + " · ข้อมูลตอกบัตรถึง ส.ค. 2569 HR จะอัปเดต): " + (ds.length ? ds.join(" · ") : "ไม่มี");
  ws.getCell(`A${r}`).font = f({ size: 9, color: { argb: C.note } }); ws.getCell(`A${r}`).alignment = { wrapText: true, vertical: "top" };
  ws.getRow(r).height = Math.max(18, Math.ceil(ws.getCell(`A${r}`).value.length / 150) * 13 + 4);
  r += 2;
  // ความเห็นและลายเซ็น
  for (const lab of ["ความเห็นของผู้ประเมินคนที่ 1 (จุดเด่น / สิ่งที่ควรพัฒนา)", "ความเห็นของผู้ประเมินคนที่ 2"]) {
    ws.mergeCells(`A${r}:G${r}`); ws.getCell(`A${r}`).value = lab; ws.getCell(`A${r}`).font = f({ bold: true }); r++;
    ws.mergeCells(`A${r}:G${r + 2}`); const c = ws.getCell(`A${r}`); c.fill = fill("FFFFFBEA"); c.border = border; c.protection = { locked: false }; c.alignment = { wrapText: true, vertical: "top" };
    r += 4;
  }
  r++;
  const sign = [["A", "C", "ผู้ประเมินคนที่ 1"], ["D", "D", "ผู้ประเมินคนที่ 2"], ["E", "G", "ฝ่ายบุคคล"]];
  for (const [a, b, lab] of sign) {
    if (a !== b) ws.mergeCells(`${a}${r}:${b}${r}`); ws.getCell(`${a}${r}`).value = "ลงชื่อ ......................................";
    if (a !== b) ws.mergeCells(`${a}${r + 1}:${b}${r + 1}`); ws.getCell(`${a}${r + 1}`).value = "(" + lab + ")";
    if (a !== b) ws.mergeCells(`${a}${r + 2}:${b}${r + 2}`); ws.getCell(`${a}${r + 2}`).value = "วันที่ ......../......../........";
    for (let k = 0; k < 3; k++) { ws.getCell(`${a}${r + k}`).alignment = { horizontal: "center" }; ws.getCell(`${a}${r + k}`).font = f(); }
  }
  ws.pageSetup.printTitlesRow = `${hdr}:${hdr}`;
  ws.pageSetup.printArea = `A1:G${r + 2}`;
  ws.protect("", { selectLockedCells: true, selectUnlockedCells: true, formatColumns: true, formatRows: true });
  return { sheet: p.employee_id, nItems, at, rowOf, allR };
}

function criteriaSheet(wb) {
  const ws = wb.addWorksheet("เกณฑ์", { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 16 }, { width: 10 }, { width: 26 }, { width: 4 }, { width: 24 }, { width: 10 }, { width: 10 }, { width: 10 }];
  ws.getCell("A1").value = "เกณฑ์การประเมินปี 2569 (ตามที่ตั้งไว้ในระบบ — อย่าแก้ สูตรในทุกใบอ้างอิงตารางนี้)"; ws.getCell("A1").font = f({ size: 12, bold: true, color: { argb: C.navy } });
  ws.getCell("A3").value = "ตารางเกรด (ระบบปัดคะแนนรวมเป็นจำนวนเต็มก่อนตัดเกรด)"; ws.getCell("A3").font = f({ bold: true });
  ["คะแนนรวมตั้งแต่", "เกรด", "ความหมาย"].forEach((t, i) => { const c = ws.getRow(4).getCell(i + 1); c.value = t; c.font = f({ bold: true }); c.fill = fill(C.head); c.border = border; });
  BANDS.forEach((b, i) => { const row = ws.getRow(5 + i); row.getCell(1).value = b[0]; row.getCell(2).value = b[1]; row.getCell(3).value = b[3]; for (let k = 1; k <= 3; k++) { row.getCell(k).border = border; row.getCell(k).font = f(); } });
  ws.getCell("E3").value = "น้ำหนักส่วนตามระดับ (%)"; ws.getCell("E3").font = f({ bold: true });
  ["ระดับ", "A", "B", "C"].forEach((t, i) => { const c = ws.getRow(4).getCell(5 + i); c.value = t; c.font = f({ bold: true }); c.fill = fill(C.head); c.border = border; });
  ["ops", "office", "supervisor", "manager"].forEach((lv, i) => { const row = ws.getRow(5 + i); row.getCell(5).value = LEVEL[lv]; ["A", "B", "C"].forEach((k, j) => { row.getCell(6 + j).value = W[lv][k]; }); for (let k = 5; k <= 8; k++) { row.getCell(k).border = border; row.getCell(k).font = f(); } });
  ws.protect("", { selectLockedCells: true, selectUnlockedCells: true });
}

function guideSheet(wb, deptName, n) {
  const ws = wb.addWorksheet("วิธีใช้", { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 4 }, { width: 30 }, { width: 70 }];
  const T = (r, t, o) => { ws.mergeCells(`B${r}:C${r}`); const c = ws.getCell(`B${r}`); c.value = t; c.font = f(o || {}); c.alignment = { wrapText: true, vertical: "top" }; };
  T(1, "แบบประเมินผลการปฏิบัติงานประจำปี 2569 — ฉบับสำรอง Excel", { size: 15, bold: true, color: { argb: C.navy } });
  T(2, "หน่วยงาน: " + deptName + " · " + n + " คน · ข้อมูลจากระบบ ณ " + thDate(new Date().toISOString()), { color: { argb: C.note } });
  T(4, "ไฟล์นี้ใช้เมื่อไร", { bold: true, size: 12 });
  T(5, "ใช้ประเมินแทนเมื่อระบบออนไลน์ (bwp-hr-eval.vercel.app) ใช้งานไม่ได้ หรือข้อมูลในระบบผิด หัวข้อและสูตรคิดคะแนนตรงกับระบบ ณ วันที่ส่งออก ถ้าหน่วยงานแก้หัวข้อในระบบภายหลัง HR จะส่งไฟล์ใหม่ให้");
  ws.getRow(5).height = 30;
  T(7, "วิธีกรอก", { bold: true, size: 12 });
  const steps = ["เปิดแท็บ \"สรุป\" ดูรายชื่อทั้งหมด กดที่รหัสพนักงานเพื่อไปที่ใบของคนนั้น (แท็บชื่อตามรหัสพนักงาน)",
    "ในแต่ละใบ ใส่ระดับ 1–5 ในช่องสีเหลือง \"ระดับ 1–5\" ทุกข้อ เทียบกับ \"มาตรฐานระดับ 3\" ของข้อนั้น",
    "เขียนหมายเหตุ/หลักฐานประกอบได้ในช่องข้างกัน (ไม่บังคับ แต่ควรมีสำหรับระดับ 1, 2 และ 5)",
    "ระบบคิดระดับเฉลี่ย คะแนนรวม และเกรดให้เอง เกรดจะขึ้นเมื่อให้คะแนนครบทุกข้อ",
    "เขียนความเห็นของผู้ประเมิน แล้วพิมพ์ลงนาม หรือส่งไฟล์กลับให้ HR"];
  steps.forEach((s, i) => { ws.getCell(`B${8 + i}`).value = (i + 1) + "."; ws.getCell(`B${8 + i}`).font = f({ bold: true }); ws.getCell(`B${8 + i}`).alignment = { horizontal: "right", vertical: "top" }; ws.getCell(`C${8 + i}`).value = s; ws.getCell(`C${8 + i}`).font = f(); ws.getCell(`C${8 + i}`).alignment = { wrapText: true, vertical: "top" }; ws.getRow(8 + i).height = 28; });
  T(14, "สีของช่อง", { bold: true, size: 12 });
  const leg = [[C.input, "สีเหลือง = ผู้ประเมินกรอก (ระดับ 1–5, หมายเหตุ, ความเห็น)"], [C.hr, "สีเขียว ตัวเลขน้ำเงิน = คะแนนหักจากการมาทำงาน/ใบเตือน HR กรอกและตรวจ (ข้อมูลตอกบัตรในไฟล์นี้ถึง ส.ค. 2569)"], [C.head, "ช่องอื่น = ระบบคิดให้ ล็อกไว้กันสูตรเสีย (Review > Unprotect Sheet ไม่มีรหัสผ่าน ใช้เฉพาะ HR)"]];
  leg.forEach(([col, t], i) => { const c = ws.getCell(`B${15 + i}`); c.fill = fill(col); c.border = border; ws.getCell(`C${15 + i}`).value = t; ws.getCell(`C${15 + i}`).font = f(); ws.getCell(`C${15 + i}`).alignment = { wrapText: true }; ws.getRow(15 + i).height = 28; });
  T(19, "ความหมายของระดับ", { bold: true, size: 12 });
  [[5, "โดดเด่น", "100%"], [4, "ดีกว่าที่คาดหวัง", "85%"], [3, "ตามที่คาดหวัง (ตรงมาตรฐานระดับ 3)", "70%"], [2, "ต่ำกว่าที่คาดหวัง", "55%"], [1, "ต่ำกว่าที่คาดหวังมาก", "40%"]].forEach(([lv, t, pc], i) => {
    ws.getCell(`B${20 + i}`).value = "ระดับ " + lv + " · คิดเป็น " + pc; ws.getCell(`C${20 + i}`).value = t; ws.getCell(`B${20 + i}`).font = f({ bold: true }); ws.getCell(`C${20 + i}`).font = f(); });
  T(26, "คะแนนคิดอย่างไร", { bold: true, size: 12 });
  T(27, "คะแนนรวม 100 = ผลงาน 90 + การมาทำงาน 10 − หักจากหนังสือเตือน · ในแต่ละส่วน (A/B/C) ระดับเฉลี่ยถ่วงตาม \"น้ำหนักข้อ\" แล้วแปลงเป็น % (ระดับ 3 = 70%) จากนั้นรวมตามน้ำหนักส่วนของระดับตำแหน่ง (ดูแท็บ \"เกณฑ์\")");
  ws.getRow(27).height = 44;
  T(29, "ตัวอย่าง (ไม่ใช่ข้อมูลจริง)", { bold: true, size: 12 });
  const ex = [["ส่วน A 4 ข้อ น้ำหนัก 2,1,1,1 ให้ระดับ 4,3,3,2", "ระดับเฉลี่ย A = (2×4+3+3+2) ÷ 5 = 3.20 → 73%"],
    ["ส่วน B ระดับเฉลี่ย 3.00 · ส่วน C ระดับเฉลี่ย 3.40", "B = 70% · C = 76%"],
    ["พนักงานปฏิบัติการ (A50 B15 C35)", "ผลงาน = 0.9 × (50×73 + 15×70 + 35×76) ÷ 100 = 66.24"],
    ["มาสาย 2 ครั้ง (หัก 2) ไม่มีใบเตือน", "คะแนนรวม = 66.24 + 8 − 0 = 74.2 → ปัด 74 → เกรด B ตามมาตรฐาน"]];
  ex.forEach(([a, b], i) => { ws.getCell(`B${30 + i}`).value = a; ws.getCell(`C${30 + i}`).value = b; ws.getCell(`B${30 + i}`).font = f(); ws.getCell(`C${30 + i}`).font = f({ color: { argb: C.navy } }); ws.getCell(`B${30 + i}`).alignment = { wrapText: true }; ws.getRow(30 + i).height = 28; });
  T(35, "ข้อควรระวัง: ไฟล์นี้มีข้อมูลประเมินของพนักงานในหน่วยงาน ห้ามส่งต่อนอกหน่วยงาน · ผลที่ใช้จริงคือผลที่ HR บันทึกเข้าระบบแล้วเท่านั้น", { bold: true, color: { argb: "FFB91C1C" } });
  ws.getRow(35).height = 30;
  ws.protect("", { selectLockedCells: true, selectUnlockedCells: true });
}

function summarySheet(ws, list, metas) {
  const H = ["ลำดับ", "รหัส", "ชื่อ-สกุล", "ตำแหน่ง", "ระดับ", "JD", "ผู้ประเมินคนที่ 1", "ให้คะแนนแล้ว", "A ระดับเฉลี่ย", "B ระดับเฉลี่ย", "C ระดับเฉลี่ย", "ผลงาน (90)", "มาทำงาน (10)", "หักใบเตือน", "คะแนนรวม", "เกรด"];
  ws.columns = [6, 9, 26, 30, 16, 9, 24, 11, 9, 9, 9, 10, 10, 9, 10, 10].map((w) => ({ width: w }));
  ws.mergeCells("A1:P1"); ws.getCell("A1").value = "สรุปผลการประเมิน 2569 — " + (list[0].dept_name || list[0].dept); ws.getCell("A1").font = f({ size: 14, bold: true, color: { argb: C.navy } });
  ws.mergeCells("A2:P2"); ws.getCell("A2").value = "ทุกช่องดึงจากใบรายคนอัตโนมัติ (สีเขียว = ลิงก์จากแท็บอื่น) · กดรหัสเพื่อเปิดใบของคนนั้น"; ws.getCell("A2").font = f({ color: { argb: C.note } });
  H.forEach((t, i) => { const c = ws.getRow(4).getCell(i + 1); c.value = t; c.font = f({ bold: true, color: { argb: C.white } }); c.fill = fill(C.navy); c.border = border; c.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; });
  ws.getRow(4).height = 30;
  list.forEach((p, i) => {
    const m = metas[i], q = `'${m.sheet}'!`, r = 5 + i, row = ws.getRow(r);
    row.getCell(1).value = i + 1;
    row.getCell(2).value = { text: p.employee_id, hyperlink: `#'${m.sheet}'!A1` };
    row.getCell(3).value = p.name; row.getCell(4).value = p.position; row.getCell(5).value = LEVEL[p.level] || p.level; row.getCell(6).value = p.jd_id || ""; row.getCell(7).value = p.ev1 || "";
    row.getCell(8).value = { formula: `${q}G${m.at.cnt}` };
    row.getCell(9).value = { formula: `${q}E${m.rowOf.A}` }; row.getCell(10).value = { formula: `${q}E${m.rowOf.B}` }; row.getCell(11).value = { formula: `${q}E${m.rowOf.C}` };
    row.getCell(12).value = { formula: `${q}G${m.at.perf}` }; row.getCell(13).value = { formula: `${q}G${m.at.att}` }; row.getCell(14).value = { formula: `${q}G${m.at.warn}` };
    row.getCell(15).value = { formula: `${q}G${m.at.total}` }; row.getCell(16).value = { formula: `${q}G${m.at.grade}` };
    for (let k = 1; k <= 16; k++) { const c = row.getCell(k); c.border = border; c.font = f(k >= 8 ? { color: { argb: "FF008000" } } : {}); c.alignment = { vertical: "middle", horizontal: k <= 2 || k >= 8 ? "center" : "left", wrapText: k === 4 }; }
    row.getCell(2).font = f({ color: { argb: "FF0563C1" }, underline: true });
    [9, 10, 11].forEach((k) => { row.getCell(k).numFmt = "0.00"; }); [12, 13, 14, 15].forEach((k) => { row.getCell(k).numFmt = "0.0"; });
    row.getCell(16).font = f({ bold: true, color: { argb: "FF008000" } });
  });
  const last = 4 + list.length;
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: last, column: 16 } };
  let r = last + 2;
  ws.getCell(`C${r}`).value = "จำนวนคนต่อเกรด"; ws.getCell(`C${r}`).font = f({ bold: true }); r++;
  for (const b of BANDS.slice().reverse()) {
    ws.getCell(`C${r}`).value = b[1] + " · " + b[3]; ws.getCell(`D${r}`).value = { formula: `COUNTIF($P$5:$P$${last},"${b[1]}")` };
    ws.getCell(`C${r}`).font = f(); ws.getCell(`D${r}`).font = f(); r++;
  }
  ws.getCell(`C${r}`).value = "ยังให้คะแนนไม่ครบ"; ws.getCell(`D${r}`).value = { formula: `COUNTIF($P$5:$P$${last},"ยังไม่ครบ")+COUNTBLANK($P$5:$P$${last})` }; ws.getCell(`C${r}`).font = f(); ws.getCell(`D${r}`).font = f();
  r++;
  ws.getCell(`C${r}`).value = "คะแนนรวมเฉลี่ย (คนที่มีคะแนน)"; ws.getCell(`D${r}`).value = { formula: `IFERROR(AVERAGE($O$5:$O$${last}),"")` }; ws.getCell(`D${r}`).numFmt = "0.0"; ws.getCell(`C${r}`).font = f(); ws.getCell(`D${r}`).font = f();
  ws.protect("", { selectLockedCells: true, selectUnlockedCells: true, autoFilter: true, sort: true, formatColumns: true });
}

async function build(deptId, list) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ฝ่ายทรัพยากรบุคคล BWP"; wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;
  const deptName = list[0].dept_name || deptId;
  guideSheet(wb, deptName, list.length);
  // แท็บสรุปสร้างก่อน (ให้อยู่ลำดับที่ 2) แล้วเติมเนื้อหาหลังรู้ตำแหน่งเซลล์ของแต่ละใบ
  const sum = wb.addWorksheet("สรุป", { views: [{ state: "frozen", ySplit: 4, showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  const metas = list.map((p) => personSheet(wb, p));
  criteriaSheet(wb);
  summarySheet(sum, list, metas);
  wb.views = [{ activeTab: 0 }];
  const file = path.join(OUT, "แบบประเมินสำรอง 2569 - " + deptName.replace(/[\\/:*?"<>|]/g, "-") + ".xlsx");
  await wb.xlsx.writeFile(file);
  return { file, metas };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const cmp = (a, b) => String(a.line_name || "zz").localeCompare(String(b.line_name || "zz"), "th", { numeric: true }) || String(a.employee_id).localeCompare(String(b.employee_id), "en", { numeric: true });
  const by = {}; D.people.forEach((p) => { (by[p.dept] = by[p.dept] || []).push(p); });
  const report = [];
  for (const [dep, list] of Object.entries(by)) {
    list.sort(cmp);
    const { file, metas } = await build(dep, list);
    report.push({ dept: dep, name: list[0].dept_name, n: list.length, items: metas.reduce((s, m) => s + m.nItems, 0), file: path.basename(file) });
  }
  fs.writeFileSync(path.join(__dirname, "report.json"), JSON.stringify(report, null, 1));
  console.log(report.map((x) => x.name + " · " + x.n + " คน · " + x.items + " ข้อ").join("\n"));
})();
