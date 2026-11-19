// ตรวจสูตรใน Excel ด้วย HyperFormula: ใส่คะแนนชุดเดียวกับที่ทดสอบในฐาน แล้วเทียบผลกับ perf_results
const ExcelJS = require("exceljs");
const { HyperFormula } = require("hyperformula");
const fs = require("fs");

const expect = { // จาก perf_results (ทดสอบแล้ว rollback)
  "120025": { perf: 62.55, att: -5, total: 57.6, grade: "D" },
  "180008": { perf: 62.442, att: 10, total: 72.4, grade: "B" },
  "180025": { perf: 60.975, att: 10, total: 71.0, grade: "B" },
  "180213": { perf: 60.975, att: 8, total: 69.0, grade: "C" },
  "610168": { perf: 60.975, att: -5, total: 56.0, grade: "D" },
};
const files = { "120025": "ซ่อมบำรุง", "180008": "ฝ่ายผลิต", "180025": "ฝ่ายผลิต", "180213": "ทรัพยากรบุคคล", "610168": "ฝ่ายผลิต" };

async function load(file) {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(file);
  const sheets = {};
  for (const ws of wb.worksheets) {
    const rows = [];
    ws.eachRow({ includeEmpty: true }, (row, rn) => {
      const arr = [];
      row.eachCell({ includeEmpty: true }, (cell, cn) => {
        const v = cell.value;
        let out = null;
        if (v && typeof v === "object" && v.formula) out = "=" + v.formula;
        else if (v && typeof v === "object" && v.text) out = v.text;
        else if (v && typeof v === "object" && v.richText) out = v.richText.map((x) => x.text).join("");
        else out = v === undefined ? null : v;
        arr[cn - 1] = out;
      });
      rows[rn - 1] = arr;
    });
    for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
    sheets[ws.name] = rows;
  }
  return sheets;
}

(async () => {
  let fail = 0;
  const cache = {};
  for (const [emp, dept] of Object.entries(files)) {
    const file = "out/แบบประเมินสำรอง 2569 - " + dept + ".xlsx";
    if (!cache[file]) cache[file] = await load(file);
    const sheets = JSON.parse(JSON.stringify(cache[file]));
    const s = sheets[emp];
    // ใส่ระดับตามลำดับข้อ (A→B→C ตามข้อ) แบบเดียวกับที่ใส่ในฐาน: ((rn*7+3) % 5) + 1
    let rn = 0, at = {};
    s.forEach((row, i) => {
      if (["A", "B", "C"].includes(row[0]) && typeof row[1] === "number") { rn++; row[5] = ((rn * 7 + 3) % 5) + 1; }
      if (typeof row[0] === "string") at[row[0]] = i;
    });
    const hf = HyperFormula.buildFromSheets(sheets, { licenseKey: "gpl-v3" });
    const sid = hf.getSheetId(emp);
    const g = (label) => hf.getCellValue({ sheet: sid, row: at[label], col: 6 });
    const got = { perf: g("ผลงานรวม (เต็ม 90)"), att: g("การมาทำงาน (เต็ม 10)"), total: g("คะแนนรวม (เต็ม 100)"), grade: g("เกรด"), cnt: g("ให้คะแนนแล้ว (ข้อ)") };
    const e = expect[emp];
    const ok = Math.abs(got.perf - e.perf) < 0.001 && Math.abs(got.att - e.att) < 1e-9 && Math.abs(got.total - e.total) < 1e-9 && got.grade === e.grade;
    if (!ok) fail++;
    // แท็บสรุปต้องดึงค่าเดียวกัน
    const ss = hf.getSheetId("สรุป");
    const sumRows = sheets["สรุป"]; const ri = sumRows.findIndex((r) => r && (r[1] === emp));
    const sumTotal = hf.getCellValue({ sheet: ss, row: ri, col: 14 }), sumGrade = hf.getCellValue({ sheet: ss, row: ri, col: 15 });
    console.log(emp, ok && sumTotal === got.total && sumGrade === got.grade ? "ตรงกัน" : "ไม่ตรง", JSON.stringify(got), "สรุป:", sumTotal, sumGrade, "ฐาน:", JSON.stringify(e));
    // ตรวจว่าไม่มี error ในทุกแท็บของไฟล์นี้
    let errs = 0;
    for (const name of Object.keys(sheets)) { const id = hf.getSheetId(name); const vals = hf.getSheetValues(id); vals.forEach((r) => r.forEach((v) => { if (v && typeof v === "object" && v.type) { errs++; if (errs < 4) console.log("  error", name, v.type, v.message); } })); }
    if (errs) { fail++; console.log("  errors:", errs); }
    hf.destroy();
  }
  // ใบที่ยังไม่ให้คะแนน: ต้องว่าง ไม่ error
  const sh = await load("out/แบบประเมินสำรอง 2569 - บัญชีการเงินและต้นทุน.xlsx");
  const hf = HyperFormula.buildFromSheets(sh, { licenseKey: "gpl-v3" });
  let errs = 0; for (const n of Object.keys(sh)) hf.getSheetValues(hf.getSheetId(n)).forEach((r) => r.forEach((v) => { if (v && typeof v === "object" && v.type) errs++; }));
  console.log("ไฟล์ที่ยังไม่กรอก: error", errs);
  console.log(fail ? "FAIL " + fail : "ALL OK");
})();
