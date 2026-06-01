// data.jsx — Mock data for Bestworld HR Performance
// ข้อมูลจำลอง บริษัท เบสท์เวิลด์ อินเตอร์พลาส จำกัด

const COMPANY = {
  name: "เบสท์เวิลด์ อินเตอร์พลาส",
  full: "บริษัท เบสท์เวิลด์ อินเตอร์พลาส จำกัด",
  cycle: "รอบประเมินปี 2568",
};

// ---------- helpers ----------
function bandOf(score) {
  if (score >= 90) return { key: "A", label: "ดีเยี่ยม", cls: "b-green", color: "#16a34a" };
  if (score >= 80) return { key: "B", label: "ดีมาก", cls: "b-teal", color: "#0d9488" };
  if (score >= 70) return { key: "C", label: "ตามเป้า", cls: "b-blue", color: "#2563eb" };
  if (score >= 60) return { key: "D", label: "ต้องพัฒนา", cls: "b-amber", color: "#e08a00" };
  return { key: "E", label: "ต่ำกว่าเกณฑ์", cls: "b-red", color: "#e11d48" };
}
function statusMeta(s) {
  return ({
    done:    { label: "ประเมินแล้ว", cls: "b-green" },
    review:  { label: "รออนุมัติ", cls: "b-amber" },
    pending: { label: "รอประเมิน", cls: "b-gray" },
    progress:{ label: "กำลังประเมิน", cls: "b-blue" },
  })[s];
}

// ---------- departments ----------
const DEPARTMENTS = [
  { id: "prod", name: "ฝ่ายผลิต", short: "ผลิต", head: 86, done: 78, score: 84.2, trend: +2.1, color: "#2563eb" },
  { id: "qc",   name: "ควบคุมคุณภาพ", short: "QC", head: 34, done: 34, score: 88.6, trend: +3.4, color: "#0d9488" },
  { id: "eng",  name: "วิศวกรรม & ซ่อมบำรุง", short: "วิศวกรรม", head: 41, done: 33, score: 81.0, trend: -0.8, color: "#7c3aed" },
  { id: "plan", name: "วางแผนการผลิต", short: "วางแผน", head: 18, done: 18, score: 86.9, trend: +1.6, color: "#0ea5e9" },
  { id: "wh",   name: "คลังสินค้า & โลจิสติกส์", short: "คลัง", head: 29, done: 21, score: 76.4, trend: -1.2, color: "#e08a00" },
  { id: "qa",   name: "ประกันคุณภาพ & R&D", short: "R&D", head: 16, done: 14, score: 90.3, trend: +4.0, color: "#16a34a" },
  { id: "sales",name: "ขาย & การตลาด", short: "ขาย", head: 22, done: 16, score: 82.5, trend: +0.9, color: "#db2777" },
  { id: "hr",   name: "ทรัพยากรบุคคล", short: "HR", head: 12, done: 12, score: 85.1, trend: +1.1, color: "#0891b2" },
  { id: "fin",  name: "บัญชี & การเงิน", short: "บัญชี", head: 14, done: 11, score: 83.7, trend: +0.4, color: "#475569" },
  { id: "purch",name: "จัดซื้อ & ซัพพลายเชน", short: "จัดซื้อ", head: 13, done: 10, score: 85.8, trend: +2.3, color: "#9333ea" },
];
const deptName = (id) => (DEPARTMENTS.find((d) => d.id === id) || {}).name || id;
const deptShort = (id) => (DEPARTMENTS.find((d) => d.id === id) || {}).short || id;

// ---------- competencies ----------
const COMPETENCIES = [
  { id: "lead", name: "ภาวะผู้นำ", en: "Leadership" },
  { id: "team", name: "การทำงานเป็นทีม", en: "Teamwork" },
  { id: "comm", name: "การสื่อสาร", en: "Communication" },
  { id: "solve", name: "การแก้ปัญหา", en: "Problem Solving" },
  { id: "disc", name: "ความมีวินัย", en: "Discipline" },
];

// ---------- employees ----------
const firstM = ["สมชาย","วิชัย","ธนากร","ประเสริฐ","อนุชา","ณัฐพล","กิตติ","สุรชัย","พงศกร","ชัยวัฒน์","เอกชัย","ภาณุ"];
const firstF = ["สุดารัตน์","พรทิพย์","วรรณภา","ศิริพร","กนกวรรณ","อรวรรณ","จิราพร","นภาพร","ปิยะดา","มัลลิกา","เบญจวรรณ","ธิดารัตน์"];
const lasts = ["ศรีสุข","วงศ์ทอง","พัฒนา","รุ่งเรือง","มั่นคง","แสงทอง","บุญมา","จันทร์เพ็ญ","ทรัพย์เจริญ","สุขสบาย","ภักดี","อินทรา","วัฒนกุล","เกษมสุข"];

function mkEmp(i, opts) {
  const female = opts.f;
  const fn = female ? firstF[i % firstF.length] : firstM[i % firstM.length];
  const ln = lasts[(i * 3 + 1) % lasts.length];
  const kpi = opts.kpi, comp = opts.comp;
  const overall = Math.round((kpi * 0.6 + comp * 0.4) * 10) / 10;
  return {
    id: "E" + String(1000 + i),
    name: fn + " " + ln,
    initials: fn[0] + ln[0],
    female,
    dept: opts.dept,
    position: opts.pos,
    level: opts.level,
    tenure: opts.tenure,
    email: "emp" + (1000 + i) + "@bestworld.co.th",
    phone: "08" + (10000000 + i * 137911).toString().slice(0, 8),
    status: opts.status,
    kpi, comp, overall,
    potential: opts.pot,          // for 9-box (1-3)
    perf: opts.perf,              // for 9-box (1-3)
    band: bandOf(overall),
    reviewer: opts.rev,
    color: ["#2563eb","#0d9488","#7c3aed","#db2777","#0ea5e9","#e08a00","#16a34a"][i % 7],
    history: opts.hist || [],
  };
}

const EMP_SEED = [
  { f:0, dept:"prod", pos:"ผู้จัดการฝ่ายผลิต", level:"ผู้จัดการ", tenure:"9 ปี 4 เดือน", status:"done", kpi:92, comp:90, pot:3, perf:3, rev:"กรรมการผู้จัดการ", hist:[78,82,85,88,91] },
  { f:1, dept:"prod", pos:"หัวหน้าแผนกฉีดพลาสติก", level:"หัวหน้างาน", tenure:"6 ปี 2 เดือน", status:"done", kpi:86, comp:83, pot:2, perf:3, rev:"ผู้จัดการฝ่ายผลิต", hist:[74,79,80,84,85] },
  { f:0, dept:"prod", pos:"พนักงานควบคุมเครื่องฉีด", level:"ปฏิบัติการ", tenure:"3 ปี 8 เดือน", status:"progress", kpi:78, comp:74, pot:2, perf:2, rev:"หัวหน้าแผนกฉีดพลาสติก", hist:[70,72,73,76] },
  { f:0, dept:"prod", pos:"พนักงานควบคุมเครื่องฉีด", level:"ปฏิบัติการ", tenure:"1 ปี 5 เดือน", status:"pending", kpi:66, comp:69, pot:2, perf:1, rev:"หัวหน้าแผนกฉีดพลาสติก", hist:[62,65] },
  { f:0, dept:"prod", pos:"หัวหน้ากะการผลิต", level:"หัวหน้างาน", tenure:"5 ปี", status:"done", kpi:81, comp:79, pot:2, perf:2, rev:"ผู้จัดการฝ่ายผลิต", hist:[72,75,77,80] },
  { f:1, dept:"qc",   pos:"ผู้จัดการแผนกควบคุมคุณภาพ", level:"ผู้จัดการ", tenure:"8 ปี 1 เดือน", status:"done", kpi:90, comp:92, pot:3, perf:3, rev:"กรรมการผู้จัดการ", hist:[82,85,87,89,91] },
  { f:1, dept:"qc",   pos:"เจ้าหน้าที่ตรวจสอบคุณภาพ", level:"ปฏิบัติการ", tenure:"4 ปี 6 เดือน", status:"done", kpi:88, comp:85, pot:3, perf:2, rev:"ผู้จัดการแผนกควบคุมคุณภาพ", hist:[78,80,83,86] },
  { f:0, dept:"qc",   pos:"เจ้าหน้าที่ตรวจสอบคุณภาพ", level:"ปฏิบัติการ", tenure:"2 ปี 3 เดือน", status:"review", kpi:84, comp:88, pot:2, perf:2, rev:"ผู้จัดการแผนกควบคุมคุณภาพ", hist:[76,80,83] },
  { f:0, dept:"eng",  pos:"วิศวกรซ่อมบำรุง", level:"วิชาชีพ", tenure:"7 ปี", status:"done", kpi:85, comp:80, pot:3, perf:2, rev:"ผู้จัดการวิศวกรรม", hist:[75,78,81,83] },
  { f:0, dept:"eng",  pos:"ผู้จัดการฝ่ายวิศวกรรม", level:"ผู้จัดการ", tenure:"11 ปี", status:"done", kpi:83, comp:81, pot:2, perf:2, rev:"กรรมการผู้จัดการ", hist:[80,81,82,82,82] },
  { f:0, dept:"eng",  pos:"ช่างเทคนิคซ่อมบำรุง", level:"ปฏิบัติการ", tenure:"3 ปี", status:"progress", kpi:74, comp:71, pot:1, perf:2, rev:"วิศวกรซ่อมบำรุง", hist:[68,70,72] },
  { f:0, dept:"eng",  pos:"ช่างเทคนิคไฟฟ้า", level:"ปฏิบัติการ", tenure:"1 ปี 2 เดือน", status:"pending", kpi:58, comp:62, pot:1, perf:1, rev:"วิศวกรซ่อมบำรุง", hist:[58] },
  { f:1, dept:"plan", pos:"ผู้จัดการวางแผนการผลิต", level:"ผู้จัดการ", tenure:"6 ปี 9 เดือน", status:"done", kpi:89, comp:87, pot:3, perf:3, rev:"กรรมการผู้จัดการ", hist:[80,83,85,87,89] },
  { f:1, dept:"plan", pos:"เจ้าหน้าที่วางแผนการผลิต", level:"ปฏิบัติการ", tenure:"3 ปี 4 เดือน", status:"done", kpi:85, comp:84, pot:2, perf:3, rev:"ผู้จัดการวางแผนการผลิต", hist:[77,80,82,84] },
  { f:1, dept:"wh",   pos:"หัวหน้าคลังสินค้า", level:"หัวหน้างาน", tenure:"5 ปี 7 เดือน", status:"review", kpi:79, comp:76, pot:2, perf:2, rev:"ผู้จัดการโลจิสติกส์", hist:[72,74,76,78] },
  { f:0, dept:"wh",   pos:"พนักงานคลังสินค้า", level:"ปฏิบัติการ", tenure:"2 ปี", status:"pending", kpi:64, comp:68, pot:1, perf:1, rev:"หัวหน้าคลังสินค้า", hist:[60,64] },
  { f:0, dept:"wh",   pos:"พนักงานขับรถยก", level:"ปฏิบัติการ", tenure:"4 ปี 1 เดือน", status:"progress", kpi:72, comp:70, pot:1, perf:2, rev:"หัวหน้าคลังสินค้า", hist:[66,68,70] },
  { f:1, dept:"qa",   pos:"ผู้จัดการ R&D", level:"ผู้จัดการ", tenure:"7 ปี 5 เดือน", status:"done", kpi:93, comp:89, pot:3, perf:3, rev:"กรรมการผู้จัดการ", hist:[84,87,89,91,93] },
  { f:1, dept:"qa",   pos:"นักวิจัยพัฒนาผลิตภัณฑ์", level:"วิชาชีพ", tenure:"3 ปี 11 เดือน", status:"done", kpi:90, comp:86, pot:3, perf:3, rev:"ผู้จัดการ R&D", hist:[82,85,87,90] },
  { f:1, dept:"sales",pos:"ผู้จัดการฝ่ายขาย", level:"ผู้จัดการ", tenure:"8 ปี", status:"done", kpi:87, comp:84, pot:3, perf:2, rev:"กรรมการผู้จัดการ", hist:[80,82,84,86,87] },
  { f:0, dept:"sales",pos:"พนักงานขายอาวุโส", level:"วิชาชีพ", tenure:"5 ปี 3 เดือน", status:"review", kpi:82, comp:80, pot:2, perf:2, rev:"ผู้จัดการฝ่ายขาย", hist:[74,77,80,82] },
  { f:1, dept:"hr",   pos:"ผู้จัดการฝ่ายทรัพยากรบุคคล", level:"ผู้จัดการ", tenure:"10 ปี", status:"done", kpi:86, comp:88, pot:3, perf:3, rev:"กรรมการผู้จัดการ", hist:[80,82,84,85,86] },
  { f:1, dept:"hr",   pos:"เจ้าหน้าที่สรรหาบุคลากร", level:"ปฏิบัติการ", tenure:"2 ปี 8 เดือน", status:"done", kpi:83, comp:85, pot:2, perf:2, rev:"ผู้จัดการฝ่ายทรัพยากรบุคคล", hist:[76,80,83] },
  { f:0, dept:"fin",  pos:"ผู้จัดการฝ่ายบัญชีการเงิน", level:"ผู้จัดการ", tenure:"9 ปี 6 เดือน", status:"done", kpi:85, comp:83, pot:2, perf:3, rev:"กรรมการผู้จัดการ", hist:[80,81,83,84,85] },
  { f:1, dept:"fin",  pos:"เจ้าหน้าที่บัญชี", level:"ปฏิบัติการ", tenure:"3 ปี 2 เดือน", status:"pending", kpi:70, comp:74, pot:1, perf:1, rev:"ผู้จัดการฝ่ายบัญชีการเงิน", hist:[66,70] },
  { f:1, dept:"purch",pos:"ผู้จัดการฝ่ายจัดซื้อ", level:"ผู้จัดการ", tenure:"7 ปี 3 เดือน", status:"done", kpi:88, comp:85, pot:3, perf:2, rev:"กรรมการผู้จัดการ", hist:[80,82,84,86,88] },
  { f:0, dept:"purch",pos:"เจ้าหน้าที่จัดซื้ออาวุโส", level:"วิชาชีพ", tenure:"4 ปี 5 เดือน", status:"review", kpi:84, comp:82, pot:2, perf:2, rev:"ผู้จัดการฝ่ายจัดซื้อ", hist:[77,80,82] },
  { f:1, dept:"purch",pos:"เจ้าหน้าที่จัดซื้อ", level:"ปฏิบัติการ", tenure:"2 ปี 1 เดือน", status:"progress", kpi:78, comp:80, pot:2, perf:2, rev:"ผู้จัดการฝ่ายจัดซื้อ", hist:[72,76,78] },
];

const EMPLOYEES = EMP_SEED.map((s, i) => mkEmp(i, s));

// company KPIs summary
const SUMMARY = {
  total: DEPARTMENTS.reduce((a, d) => a + d.head, 0),
  done: DEPARTMENTS.reduce((a, d) => a + d.done, 0),
  get pending() { return this.total - this.done; },
  avgScore: 84.7,
  avgTrend: +1.8,
  topDept: "ประกันคุณภาพ & R&D",
  topDeptScore: 90.3,
  highPotential: 9,
  atRisk: 6,
};

// performance trend (company avg by month)
const TREND = [
  { m: "ต.ค.", v: 79.2 }, { m: "พ.ย.", v: 80.1 }, { m: "ธ.ค.", v: 81.0 },
  { m: "ม.ค.", v: 81.6 }, { m: "ก.พ.", v: 82.4 }, { m: "มี.ค.", v: 82.9 },
  { m: "เม.ย.", v: 83.5 }, { m: "พ.ค.", v: 84.1 }, { m: "มิ.ย.", v: 84.7 },
];
const TREND_PREV = [
  { m: "ต.ค.", v: 76.0 }, { m: "พ.ย.", v: 76.8 }, { m: "ธ.ค.", v: 77.5 },
  { m: "ม.ค.", v: 78.0 }, { m: "ก.พ.", v: 78.6 }, { m: "มี.ค.", v: 79.3 },
  { m: "เม.ย.", v: 80.0 }, { m: "พ.ค.", v: 80.6 }, { m: "มิ.ย.", v: 81.2 },
];

// competency distribution (company avg)
const COMP_RADAR = [
  { id: "lead", name: "ภาวะผู้นำ", v: 81 },
  { id: "team", name: "ทำงานเป็นทีม", v: 87 },
  { id: "comm", name: "การสื่อสาร", v: 83 },
  { id: "solve", name: "แก้ปัญหา", v: 79 },
  { id: "disc", name: "ความมีวินัย", v: 90 },
];

// evaluation status pie
const STATUS_PIE = [
  { label: "ประเมินแล้ว", v: SUMMARY.done, color: "#16a34a" },
  { label: "กำลังประเมิน", v: 22, color: "#2563eb" },
  { label: "รออนุมัติ", v: 18, color: "#e08a00" },
  { label: "รอประเมิน", v: SUMMARY.total - SUMMARY.done - 22 - 18, color: "#cbd5e1" },
];

// KPI evaluation items (sample for a production supervisor)
const KPI_ITEMS = [
  { id:"k1", name:"ปริมาณผลผลิตตามเป้า (Output)", target:"≥ 95%", actual:"97.2%", weight:25, score:96, unit:"%" },
  { id:"k2", name:"อัตราของเสีย (Defect Rate)", target:"≤ 2.0%", actual:"1.6%", weight:20, score:92, unit:"%" },
  { id:"k3", name:"ประสิทธิภาพเครื่องจักร (OEE)", target:"≥ 85%", actual:"86.4%", weight:20, score:88, unit:"%" },
  { id:"k4", name:"ความปลอดภัย (อุบัติเหตุ = 0)", target:"0 ครั้ง", actual:"0 ครั้ง", weight:15, score:100, unit:"" },
  { id:"k5", name:"ควบคุมต้นทุนการผลิต", target:"≤ งบ", actual:"-3.1%", weight:10, score:90, unit:"" },
  { id:"k6", name:"ส่งมอบตรงเวลา (OTD)", target:"≥ 98%", actual:"96.8%", weight:10, score:82, unit:"%" },
];

// JD-based items (production supervisor)
const JD_ITEMS = [
  { id:"j1", name:"ควบคุมคุณภาพงานให้เป็นไปตามมาตรฐาน", score:4 },
  { id:"j2", name:"วางแผนการผลิตและจัดสรรกำลังคน", score:4 },
  { id:"j3", name:"ลดของเสียและปรับปรุงกระบวนการ", score:5 },
  { id:"j4", name:"ควบคุมต้นทุนการผลิตให้อยู่ในงบ", score:3 },
  { id:"j5", name:"วิเคราะห์ปัญหาหน้างานและแก้ไข", score:4 },
];

// JD library
const JD_LIBRARY = [
  { id:"JD-PRD-01", title:"ผู้จัดการฝ่ายผลิต", dept:"prod", version:"v3.2", updated:"12 มี.ค. 2568", status:"active", kpis:6, comps:5,
    duties:["กำหนดแผนการผลิตให้สอดคล้องเป้าหมายบริษัท","ควบคุมต้นทุนและประสิทธิภาพการผลิต","พัฒนาทีมงานและระบบการผลิต","ดูแลความปลอดภัยในโรงงาน"] },
  { id:"JD-PRD-02", title:"หัวหน้าแผนกฉีดพลาสติก", dept:"prod", version:"v2.0", updated:"28 ก.พ. 2568", status:"active", kpis:5, comps:5,
    duties:["ควบคุมเครื่องฉีดพลาสติกให้ได้คุณภาพ","วางแผนกำลังการผลิตรายกะ","ลดอัตราของเสีย","ดูแลการบำรุงรักษาเชิงป้องกัน"] },
  { id:"JD-QC-01", title:"ผู้จัดการแผนกควบคุมคุณภาพ", dept:"qc", version:"v4.1", updated:"05 มี.ค. 2568", status:"active", kpis:6, comps:5,
    duties:["กำหนดมาตรฐานการตรวจสอบคุณภาพ","ควบคุมระบบ ISO 9001","วิเคราะห์ข้อบกพร่องและป้องกัน","ประสานงานลูกค้าด้านคุณภาพ"] },
  { id:"JD-ENG-01", title:"วิศวกรซ่อมบำรุง", dept:"eng", version:"v2.3", updated:"18 ก.พ. 2568", status:"active", kpis:5, comps:4,
    duties:["วางแผนบำรุงรักษาเชิงป้องกัน","ลด Downtime เครื่องจักร","วิเคราะห์สาเหตุการเสีย","ควบคุมงบประมาณซ่อมบำรุง"] },
  { id:"JD-WH-01", title:"หัวหน้าคลังสินค้า", dept:"wh", version:"v1.4", updated:"22 ม.ค. 2568", status:"review",  kpis:4, comps:4,
    duties:["บริหารพื้นที่จัดเก็บและสต็อก","ควบคุมความแม่นยำสินค้าคงคลัง","จัดส่งตรงเวลา","ดูแลความปลอดภัยคลังสินค้า"] },
  { id:"JD-RND-01", title:"นักวิจัยพัฒนาผลิตภัณฑ์", dept:"qa", version:"v3.0", updated:"01 มี.ค. 2568", status:"active", kpis:5, comps:5,
    duties:["พัฒนาสูตรและผลิตภัณฑ์ใหม่","ทดสอบคุณสมบัติวัสดุ","ปรับปรุงกระบวนการผลิต","จัดทำเอกสารทางเทคนิค"] },
  { id:"JD-SAL-01", title:"พนักงานขายอาวุโส", dept:"sales", version:"v2.1", updated:"14 ก.พ. 2568", status:"draft", kpis:5, comps:4,
    duties:["ดูแลลูกค้าหลักและขยายฐานลูกค้า","บรรลุเป้ายอดขาย","วิเคราะห์ตลาดและคู่แข่ง","ประสานงานฝ่ายผลิตเรื่องคำสั่งซื้อ"] },
];

// notifications
const NOTIFS = [
  { id:1, type:"warn", title:"ใกล้ครบกำหนดประเมิน", body:"ฝ่ายผลิต เหลือ 8 คนที่ยังไม่ประเมิน ครบกำหนด 15 มิ.ย.", time:"15 นาทีที่แล้ว" },
  { id:2, type:"info", title:"รออนุมัติผลประเมิน", body:"คุณพรทิพย์ ส่งผลประเมินรอการอนุมัติจากคุณ", time:"1 ชั่วโมงที่แล้ว" },
  { id:3, type:"ok",   title:"Calibration เสร็จสมบูรณ์", body:"ฝ่าย QC ปรับเทียบคะแนนเรียบร้อยแล้ว", time:"เมื่อวานนี้" },
  { id:4, type:"info", title:"JD ฉบับใหม่รออนุมัติ", body:"JD-WH-01 หัวหน้าคลังสินค้า v1.4 รอตรวจสอบ", time:"2 วันที่แล้ว" },
];

// 9-box labels
const NINEBOX = {
  cells: [
    { x:0,y:2, label:"เพชรในตม", sub:"Potential Gem", color:"#0ea5e9" },
    { x:1,y:2, label:"ดาวรุ่ง", sub:"High Potential", color:"#16a34a" },
    { x:2,y:2, label:"ดาวเด่น", sub:"Star", color:"#15803d" },
    { x:0,y:1, label:"ต้องพัฒนา", sub:"Inconsistent", color:"#e08a00" },
    { x:1,y:1, label:"กำลังหลัก", sub:"Core Player", color:"#2563eb" },
    { x:2,y:1, label:"ผู้ทำผลงานสูง", sub:"High Performer", color:"#0d9488" },
    { x:0,y:0, label:"เสี่ยง", sub:"Risk", color:"#e11d48" },
    { x:1,y:0, label:"ทำได้ตามเกณฑ์", sub:"Effective", color:"#94a3b8" },
    { x:2,y:0, label:"ผู้เชี่ยวชาญ", sub:"Trusted Pro", color:"#64748b" },
  ],
};

Object.assign(window, {
  COMPANY, DEPARTMENTS, EMPLOYEES, COMPETENCIES, SUMMARY, TREND, TREND_PREV,
  COMP_RADAR, STATUS_PIE, KPI_ITEMS, JD_ITEMS, JD_LIBRARY, NOTIFS, NINEBOX,
  bandOf, statusMeta, deptName, deptShort,
});
