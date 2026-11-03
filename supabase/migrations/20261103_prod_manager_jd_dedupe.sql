-- 03/11/2569 HR สั่ง "แก้ไขทุกข้อ" — บันทึกสิ่งที่รันกับฐานจริง
-- (ส่วนข้อมูลรันแล้วด้วย execute_sql · ส่วนฟังก์ชันรันเป็น migration perf_absence_warning_no_double)

-- 1) ผจก.ฝ่ายผลิต = 120035 (ฉัตรชัย) ตามผังองค์กรที่ HR ยืนยัน 22/10/2569 · กระทบ HR Core/แดชบอร์ดด้วย
update hr_departments set manager_id = '120035' where id = 'prod' and manager_id = '120025';
update employees set supervisor_id = case when supervisor_id = '120025' then '120035' else supervisor_id end,
                     supervisor_fk = case when supervisor_fk = '120025' then '120035' else supervisor_fk end
 where dept = 'prod' and id <> '120035' and '120025' in (supervisor_id, supervisor_fk);
-- (+ บันทึก employee_history ประเภท SUPERVISOR) แล้วรัน perf_generate('2569', true) ในนาม HR

-- 2) ผูก JD ให้ 12 คนที่ยังไม่มี (180000 ตำแหน่ง "พนักงาน" ยังรอ HR ระบุ)
--    120025→JD37 · แม่บ้าน 5 คน→JD57 · พนักงานเป่า 3 คน→JD68 · 120035→JD29 · 120002→JD50 · 610219→JD33
--    เขียนทั้ง employees.jd_id (ถ้ายังว่าง) และ perf_assignments.jd_id

-- 3) ขาดงานที่มีใบเตือนเรื่องขาดงาน: หักครั้งเดียว ใช้ค่าที่มากกว่า
--    perf_sync_deductions เดิมเปลี่ยนชื่อเป็น perf_sync_deductions_base แล้วห่อด้วยตัวใหม่ที่เรียก perf_dedupe_absence ต่อท้าย
