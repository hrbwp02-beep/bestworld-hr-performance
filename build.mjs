// build.mjs — รวม/แปลง JSX เป็น bundle เดียวต่อแอป (ตัด Babel-in-browser ออกจาก production)
// สร้าง dist/ สำหรับ GitHub Pages :
//   dist/index.html + dist/bundle.js            → ระบบประเมินผล
//   dist/hr-core/index.html                     → หน้า redirect ไป repo bwp-hr-core
import { transform } from "esbuild";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import path from "node:path";

// แอปที่ต้อง build : { html ต้นทาง, โฟลเดอร์ปลายทางใน dist }
const APPS = [
  { html: "index.html", out: "." },

];

async function buildApp(app) {
  const html = await readFile(app.html, "utf8");
  const baseDir = path.dirname(app.html);

  // ดึงรายชื่อไฟล์ .jsx ตามลำดับใน html (path อ้างอิงจากตำแหน่งของ html)
  const srcs = [...html.matchAll(/<script[^>]*src="([^"]+\.jsx)"[^>]*><\/script>/g)].map((m) => m[1]);
  if (!srcs.length) throw new Error("ไม่พบไฟล์ .jsx ใน " + app.html);

  let bundle = "// build จาก JSX — อย่าแก้ไฟล์นี้โดยตรง (สร้างโดย build.mjs)\n";
  for (const s of srcs) {
    const file = path.normalize(path.join(baseDir, s));
    const code = await readFile(file, "utf8");
    const res = await transform(code, { loader: "jsx", charset: "utf8", jsx: "transform", target: "es2018" });
    // เลียนแบบ babel-standalone: top-level function ถูกทำเป็น global (บน window)
    // (const/let ไม่ถูกทำ global จึงคงหุ้ม IIFE แยก scope กัน const ซ้ำชนกัน)
    const fnNames = [...new Set([...code.matchAll(/^(?:async\s+)?function\s+([A-Za-z0-9_$]+)/gm)].map((m) => m[1]))];
    const exposer = fnNames.map((n) => `try{window.${n}=${n};}catch(e){}`).join("");
    bundle += `\n/* ===== ${file} ===== */\n(function(){\n${res.code}\n${exposer}\n})();\n`;
  }

  const outDir = path.join("dist", app.out);
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "bundle.js"), bundle, "utf8");

  // index.html สำหรับ production: ตัด Babel + แท็ก jsx ออก, โหลด bundle.js แทน
  const stamp = Date.now();
  const out = html
    .replace(/\s*<script[^>]*@babel\/standalone[^>]*><\/script>/g, "")
    .replace(/\s*<script type="text\/babel"[^>]*><\/script>/g, "")
    .replace(/<\/body>/, `<script src="bundle.js?v=${stamp}"></script>\n</body>`);
  await writeFile(path.join(outDir, "index.html"), out, "utf8");

  console.log(`  ${app.html} → dist/${app.out}/  ·  ${srcs.length} ไฟล์  ·  ${(bundle.length / 1024).toFixed(0)} KB`);
}

await mkdir("dist", { recursive: true });
console.log("กำลัง build:");
for (const app of APPS) await buildApp(app);

// ไฟล์ static ที่ใช้ร่วมกัน (อยู่ราก dist — hr-core อ้างด้วย ../)
// หน้า redirect ของที่อยู่เดิม (HR Core ย้ายไป repo แยกแล้ว)
try {
  await mkdir("dist/hr-core", { recursive: true });
  await copyFile("hr-core/index.html", "dist/hr-core/index.html");
} catch (e) { console.warn("  ข้ามหน้า redirect:", e.message); }

for (const a of ["styles.css", "logo.svg"]) {
  try { await copyFile(a, path.join("dist", a)); } catch (e) { console.warn("  ข้ามไฟล์", a, e.message); }
}
console.log("สร้าง dist/ สำเร็จ");
