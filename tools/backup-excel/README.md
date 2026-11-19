# แบบประเมินสำรอง Excel (แยกไฟล์ต่อหน่วยงาน)

ใช้เมื่อระบบออนไลน์ใช้งานไม่ได้ หรือข้อมูลในระบบผิด · สร้างครั้งแรก 19/11/2569 → `Desktop/ระบบ HR/แบบประเมินสำรอง Excel 2569/`

- 1 ไฟล์ต่อหน่วยงาน (บัญชีหน่วยงานต้องไม่เห็นข้อมูลหน่วยงานอื่น) · แท็บ วิธีใช้ · สรุป · ใบรายคน (ชื่อแท็บ = รหัสพนักงาน) · เกณฑ์
- หัวข้อเลือกตามกฎเดียวกับ `perf_items()` (A จาก JD หรือหัวข้อเฉพาะคน, B ทักษะสำหรับ ops/office หรือภาวะผู้นำสำหรับ supervisor/manager, C พฤติกรรมหลัก, ตัดส่วนที่น้ำหนัก 0)
- สูตรเลียนแบบ `perf_results()`: เฉลี่ยถ่วงน้ำหนักข้อ → 70+(avg−3)×15 → 0.9×รวมตามน้ำหนักส่วน + (10 − หักมาทำงาน) − ใบเตือน → ROUND 1 ตำแหน่ง → เกรดจาก ROUND เป็นจำนวนเต็ม
- ช่องระดับ = Data Validation 1–5 · ชีตล็อกแบบไม่มีรหัสผ่าน (กันสูตรเสีย)

## สร้างใหม่ (เช่น หลังหน่วยงานแก้หัวข้อ หรืออัปเดตตอกบัตร)

1. รัน SQL ด้านล่าง (MCP execute_sql) แล้วบันทึกผล `j` เป็น `data.json` ในโฟลเดอร์นี้ (**อย่า commit — มีข้อมูลพนักงาน**)
2. `npm install --no-save exceljs@4.4.0 hyperformula@2.7.1`
3. `node gen.js out` → ไฟล์ใน `out/` · ตรวจ: `node verify.js` (ค่าคาดหวังใน verify.js ต้องรันทดสอบใน perf_results ใหม่แบบ rollback)

```sql
with p as (
  select a.id, a.employee_id, e.name, e.position, e.dept, d.name dept_name, a.level, a.jd_id, j.title jd_title, a.own_items,
         a.doc_no, ev.name ev1, rv.name ev2, a.evaluator_id, a.reviewer_id,
         (select l.name from perf_line_members m join perf_lines l on l.id=m.line_id where m.employee_id=a.employee_id limit 1) line_name,
         coalesce((select sum(points) from perf_deductions x where x.cycle_id='2569' and x.employee_id=a.employee_id and not x.waived and x.kind not in ('warn_verbal','warn_written_1','warn_written_2','warn_written_3','suspend')),0) orange,
         coalesce((select sum(points) from perf_deductions x where x.cycle_id='2569' and x.employee_id=a.employee_id and not x.waived and x.kind in ('warn_verbal','warn_written_1','warn_written_2','warn_written_3','suspend')),0) warn,
         (select json_agg(json_build_object('k',x.kind,'q',x.qty,'p',x.points,'n',x.note)) from perf_deductions x where x.cycle_id='2569' and x.employee_id=a.employee_id and not x.waived) deds
    from perf_assignments a join employees e on e.id=a.employee_id left join hr_departments d on d.id=e.dept
    left join jd_library j on j.id=a.jd_id left join employees ev on ev.id=a.evaluator_id left join employees rv on rv.id=a.reviewer_id
   where a.cycle_id='2569' and a.eligible and not exists (select 1 from perf_exclusions x where x.employee_id=a.employee_id))
select json_build_object(
 'cycle', (select json_build_object('name',name,'config',config,'period_start',period_start,'period_end',period_end,'open_from',open_from,'open_to',open_to) from perf_cycles where id='2569'),
 'people', (select json_agg(row_to_json(p)) from p),
 'jd_items', (select json_agg(json_build_object('jd',i.jd_id,'s',i.section,'q',i.seq,'t',i.title,'std',i.standard,'w',i.weight) order by i.jd_id,i.section,i.seq) from perf_jd_items i where i.jd_id in (select jd_id from p)),
 'person_items', (select json_agg(json_build_object('a',i.assignment_id,'s',i.section,'q',i.seq,'t',i.title,'std',i.standard,'w',i.weight) order by i.assignment_id,i.section,i.seq) from perf_person_items i where i.assignment_id in (select id from p)),
 'common', (select json_agg(json_build_object('id',c.id,'kind',c.kind,'q',c.seq,'t',c.title,'std',c.standard) order by c.kind,c.seq) from perf_common_items c)
) j;
```
