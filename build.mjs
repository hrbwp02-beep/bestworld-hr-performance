// build.mjs — รวม/แปลง JSX เป็น bundle.js เดียว (ตัด Babel-in-browser ออกจาก production)
// รันบน GitHub Actions: node build.mjs  →  สร้างโฟลเดอร์ dist/ สำหรับ GitHub Pages
import { transform } from "esbuild";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";

const html = await readFile("index.html", "utf8");

// ดึงรายชื่อไฟล์ .jsx ตามลำดับใน index.html
const order = [...html.matchAll(/<script[^>]*src="([^"]+\.jsx)"[^>]*><\/script>/g)].map((m) => m[1]);
if (!order.length) throw new Error("ไม่พบไฟล์ .jsx ใน index.html");

// แปลง JSX → JS (classic runtime: React.createElement, อ่าน React จาก global UMD) แล้วต่อกันเป็นไฟล์เดียว
let bundle = "// build จาก JSX — อย่าแก้ไฟล์นี้โดยตรง (สร้างโดย build.mjs)\n";
for (const f of order) {
  const code = await readFile(f, "utf8");
  const res = await transform(code, { loader: "jsx", charset: "utf8", jsx: "transform", target: "es2018" });
  // เลียนแบบ babel-standalone: top-level function ถูกทำเป็น global (บน window) — ดึงชื่อมาจาก source
  // (const/let ไม่ถูกทำ global จึงคงหุ้ม IIFE แยก scope กัน const ซ้ำชนกัน เช่น KPI_MONTHS)
  const fnNames = [...new Set([...code.matchAll(/^(?:async\s+)?function\s+([A-Za-z0-9_$]+)/gm)].map((m) => m[1]))];
  const exposer = fnNames.map((n) => `try{window.${n}=${n};}catch(e){}`).join("");
  bundle += `\n/* ===== ${f} ===== */\n(function(){\n${res.code}\n${exposer}\n})();\n`;
}

await mkdir("dist", { recursive: true });
const stamp = Date.now();
await writeFile(`dist/bundle.js`, bundle, "utf8");

// สร้าง index.html สำหรับ production: เอา Babel + แท็ก jsx ออก, โหลด bundle.js แทน
let out = html
  .replace(/\s*<script[^>]*@babel\/standalone[^>]*><\/script>/g, "")
  .replace(/\s*<script type="text\/babel"[^>]*><\/script>/g, "")
  .replace(/<\/body>/, `<script src="bundle.js?v=${stamp}"></script>\n</body>`);
await writeFile("dist/index.html", out, "utf8");

// คัดลอกไฟล์ static ที่ใช้ตอนรัน
for (const a of ["styles.css", "logo.svg"]) {
  try { await copyFile(a, `dist/${a}`); } catch (e) { console.warn("ข้ามไฟล์", a, e.message); }
}

console.log(`สร้าง dist/ สำเร็จ · รวม ${order.length} ไฟล์ · bundle ${(bundle.length / 1024).toFixed(0)} KB`);
