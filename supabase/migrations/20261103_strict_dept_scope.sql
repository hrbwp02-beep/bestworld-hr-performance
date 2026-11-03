-- 03/11/2569 HR สั่ง: บัญชีหน่วยงานต้องเห็นเฉพาะข้อมูลหน่วยงานตนเองเท่านั้น (ห้ามพลาด)
-- กระทบทุกแอปที่ใช้ฐานนี้ (HR Core / แดชบอร์ด / ประเมินผล) — ระบบสรรหาไม่ได้ใช้ตารางเหล่านี้ (grep แล้ว)
-- HR/admin ยังเห็นทั้งหมด (in_my_scope / is_hr_admin คืน true)
--
-- ก่อนแก้ (ทดสอบด้วย production@): เห็นพนักงานหน่วยงานอื่น 12 คน · ตอกบัตรหน่วยงานอื่น · app_users ทุกบัญชี ·
-- KPI หน่วยงานอื่น 59 ตัว · ทีม/JD หน่วยงานอื่น · ประวัติพนักงานทั้งบริษัท 398 แถว · หัวข้อ JD ทั้งหมด

-- 1) พนักงาน: เดิมทุกคนเห็นฝ่ายบริหาร + หัวหน้า/ผู้จัดการทุกหน่วยงาน (ทั้งแถว รวมเลขบัตร/ที่อยู่/เบอร์โทร) เพื่อผังองค์กร
--    → เหลือเฉพาะหน่วยงานในขอบเขต + ข้อมูลของตัวเอง (ผังองค์กรของบัญชีหน่วยงานจะแสดงเฉพาะหน่วยงานตน)
create or replace function public.can_see_employee(p_dept text, p_id text)
 returns boolean language sql stable security definer set search_path to 'public' as $function$
  select case when public.app_role() is null then false else
       public.in_my_scope(p_dept)                    -- หน่วยงานที่ตนดูแล (admin/hr = ทั้งหมด)
    or exists (select 1 from app_users u             -- ข้อมูลของตัวเอง
               where lower(u.email) = lower(coalesce(auth.jwt()->>'email',''))
                 and u.active and u.employee_id = p_id)
  end
$function$;

-- ตัวช่วย: พนักงานคนนี้อยู่ในขอบเขตของผู้ใช้หรือไม่ (ใช้กับตารางย่อยที่มี employee_id)
create or replace function public.can_see_employee_id(p_emp text)
 returns boolean language sql stable security definer set search_path to 'public' as $function$
  select coalesce((select public.can_see_employee(e.dept, e.id) from employees e where e.id = p_emp), false)
$function$;
revoke all on function public.can_see_employee_id(text) from public, anon;
grant execute on function public.can_see_employee_id(text) to authenticated;

-- 2) บัญชีผู้ใช้: เห็นเฉพาะแถวของตัวเอง (HR/admin เห็นทั้งหมด)
drop policy if exists "authenticated read app_users" on app_users;
create policy "read own app_user" on app_users for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt()->>'email', '')) or is_hr_admin() or hrc_is_admin());

-- 3) ข้อมูลรายบุคคล (ใบเตือน อบรม เอกสาร การศึกษา ผู้ติดต่อฉุกเฉิน ประสบการณ์ ประวัติ ทักษะ)
drop policy if exists "disciplinary read" on disciplinary;
create policy "disciplinary read in scope" on disciplinary for select to authenticated using (can_see_employee_id(employee_id));
drop policy if exists "trainings read" on hr_trainings;
create policy "trainings read in scope" on hr_trainings for select to authenticated using (can_see_employee_id(employee_id));
drop policy if exists "employee_documents_read" on employee_documents;
create policy "employee_documents_read" on employee_documents for select to authenticated using (can_see_employee_id(employee_id));
drop policy if exists "employee_education_read" on employee_education;
create policy "employee_education_read" on employee_education for select to authenticated using (can_see_employee_id(employee_id));
drop policy if exists "employee_emergency_contacts_read" on employee_emergency_contacts;
create policy "employee_emergency_contacts_read" on employee_emergency_contacts for select to authenticated using (can_see_employee_id(employee_id));
drop policy if exists "employee_experience_read" on employee_experience;
create policy "employee_experience_read" on employee_experience for select to authenticated using (can_see_employee_id(employee_id));
drop policy if exists "employee_history_read" on employee_history;
create policy "employee_history_read" on employee_history for select to authenticated using (can_see_employee_id(employee_id));
drop policy if exists "employee_skills_read" on employee_skills;
create policy "employee_skills_read" on employee_skills for select to authenticated using (can_see_employee_id(employee_id));

-- 4) KPI / ทีม / JD: เฉพาะหน่วยงานในขอบเขต
drop policy if exists "authenticated read kpi_defs" on kpi_defs;
create policy "kpi_defs read in scope" on kpi_defs for select to authenticated using (dept is null or in_my_scope(dept));
create policy "kpi_monthly read in scope" on kpi_monthly for select to authenticated
  using (exists (select 1 from kpi_defs k where k.id = kpi_monthly.kpi_id and (k.dept is null or in_my_scope(k.dept))));
drop policy if exists "authenticated read teams" on teams;
create policy "teams read in scope" on teams for select to authenticated using (dept is null or in_my_scope(dept));
drop policy if exists "authenticated read jd_library" on jd_library;
create policy "jd_library read in scope" on jd_library for select to authenticated using (dept is null or in_my_scope(dept));
drop policy if exists "perf_jd_items read" on perf_jd_items;
create policy "perf_jd_items read in scope" on perf_jd_items for select to authenticated
  using (exists (select 1 from jd_library j where j.id = perf_jd_items.jd_id and (j.dept is null or in_my_scope(j.dept))));

-- 5) ภาพรวมทั้งบริษัท (สรุปรอบเก่าแยกทุกหน่วยงาน / แนวโน้มทั้งบริษัท) → HR เท่านั้น
drop policy if exists "cycle_archive read" on cycle_archive;
drop policy if exists "auth read performance_trend" on performance_trend;

-- 6) รายชื่อคนที่ "ไม่ต้องประเมิน" → เฉพาะในขอบเขต
drop policy if exists "read" on perf_exclusions;
create policy "read in scope" on perf_exclusions for select to authenticated using (can_see_employee_id(employee_id));

-- 7) นโยบายเขียน (FOR ALL) ของตารางย่อยพนักงาน ให้สิทธิ์อ่านด้วย และไม่เช็กหน่วยงาน — ผู้จัดการมี employee.edit จึงอ่าน/แก้ของทุกหน่วยงานได้
--    → แยกเป็น insert/update/delete และต้องอยู่ในขอบเขตหน่วยงานด้วย
drop policy if exists "employee_education_write" on employee_education;
create policy "employee_education_insert" on employee_education for insert to authenticated with check (has_perm('employee.edit') and can_see_employee_id(employee_id));
create policy "employee_education_update" on employee_education for update to authenticated using (has_perm('employee.edit') and can_see_employee_id(employee_id)) with check (has_perm('employee.edit') and can_see_employee_id(employee_id));
create policy "employee_education_delete" on employee_education for delete to authenticated using (has_perm('employee.edit') and can_see_employee_id(employee_id));
drop policy if exists "employee_emergency_contacts_write" on employee_emergency_contacts;
create policy "employee_emergency_contacts_insert" on employee_emergency_contacts for insert to authenticated with check (has_perm('employee.edit') and can_see_employee_id(employee_id));
create policy "employee_emergency_contacts_update" on employee_emergency_contacts for update to authenticated using (has_perm('employee.edit') and can_see_employee_id(employee_id)) with check (has_perm('employee.edit') and can_see_employee_id(employee_id));
create policy "employee_emergency_contacts_delete" on employee_emergency_contacts for delete to authenticated using (has_perm('employee.edit') and can_see_employee_id(employee_id));
drop policy if exists "employee_experience_write" on employee_experience;
create policy "employee_experience_insert" on employee_experience for insert to authenticated with check (has_perm('employee.edit') and can_see_employee_id(employee_id));
create policy "employee_experience_update" on employee_experience for update to authenticated using (has_perm('employee.edit') and can_see_employee_id(employee_id)) with check (has_perm('employee.edit') and can_see_employee_id(employee_id));
create policy "employee_experience_delete" on employee_experience for delete to authenticated using (has_perm('employee.edit') and can_see_employee_id(employee_id));
drop policy if exists "employee_history_write" on employee_history;
create policy "employee_history_insert" on employee_history for insert to authenticated with check (has_perm('employee.edit') and can_see_employee_id(employee_id));
create policy "employee_history_update" on employee_history for update to authenticated using (has_perm('employee.edit') and can_see_employee_id(employee_id)) with check (has_perm('employee.edit') and can_see_employee_id(employee_id));
create policy "employee_history_delete" on employee_history for delete to authenticated using (has_perm('employee.edit') and can_see_employee_id(employee_id));
drop policy if exists "employee_skills_write" on employee_skills;
create policy "employee_skills_insert" on employee_skills for insert to authenticated with check (has_perm('employee.edit') and can_see_employee_id(employee_id));
create policy "employee_skills_update" on employee_skills for update to authenticated using (has_perm('employee.edit') and can_see_employee_id(employee_id)) with check (has_perm('employee.edit') and can_see_employee_id(employee_id));
create policy "employee_skills_delete" on employee_skills for delete to authenticated using (has_perm('employee.edit') and can_see_employee_id(employee_id));
drop policy if exists "employee_documents_write" on employee_documents;
create policy "employee_documents_insert" on employee_documents for insert to authenticated with check (has_perm('employee.documents') and can_see_employee_id(employee_id));
create policy "employee_documents_update" on employee_documents for update to authenticated using (has_perm('employee.documents') and can_see_employee_id(employee_id)) with check (has_perm('employee.documents') and can_see_employee_id(employee_id));
create policy "employee_documents_delete" on employee_documents for delete to authenticated using (has_perm('employee.documents') and can_see_employee_id(employee_id));
