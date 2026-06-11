-- ============================================================================
-- 2026-06-11  Security hardening, dept scope, role-based access, notifications
-- บันทึกการเปลี่ยนแปลง schema/RLS ที่ทำผ่าน Supabase (เพื่อให้ reproduce project ใหม่ได้)
-- ============================================================================

-- ---- คอลัมน์ที่เพิ่มจากฟีเจอร์ก่อนหน้า ----
alter table app_settings   add column if not exists approval_stages jsonb;
alter table app_settings   add column if not exists hr_evaluator_id text;
alter table departments     add column if not exists supervisor_id text;
alter table departments     add column if not exists manager_id    text;
alter table app_users       add column if not exists dept_scope    jsonb;   -- หน่วยงานที่ผู้ใช้เข้าดูได้ (หลายหน่วยงานได้)
alter table app_users       add column if not exists employee_id   text;    -- ผูกบัญชี ↔ พนักงาน
alter table notifications   add column if not exists recipient_email text;  -- ผู้รับการแจ้งเตือน (null = broadcast)
alter table notifications   add column if not exists created_at timestamptz default now();
alter table notifications   add column if not exists read boolean default false;

-- ---- ฟังก์ชันสิทธิ์ (security definer: อ่าน app_users ข้าม RLS) ----
create or replace function public.app_role() returns text language sql stable security definer set search_path=public as $$
  select role from app_users where lower(email)=lower(coalesce(auth.jwt()->>'email','')) limit 1
$$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(public.app_role()='admin', false)
$$;
create or replace function public.is_hr_admin() returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(public.app_role() in ('admin','hr'), false)
$$;
create or replace function public.in_my_scope(dep text) returns boolean language sql stable security definer set search_path=public as $$
  select case when public.app_role() in ('admin','hr') then true
  else exists (
    select 1 from app_users u where lower(u.email)=lower(coalesce(auth.jwt()->>'email',''))
      and ((u.dept_scope is not null and u.dept_scope ? dep)
        or (coalesce(u.dept_scope,'[]'::jsonb)='[]'::jsonb and u.dept=dep))
  ) end
$$;

-- ---- RLS: อ่านได้ทุกผู้ล็อกอิน (เครื่องมือภายใน) · เขียนจำกัดตามบทบาท/ขอบเขต ----
-- app_users: เขียนได้เฉพาะ admin (กันยกระดับสิทธิ์)
drop policy if exists "authenticated write app_users" on app_users;
create policy "app_users write admin" on app_users for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- app_settings + ตารางมาสเตอร์: เขียนเฉพาะ hr/admin
drop policy if exists "authenticated write app_settings" on app_settings;
create policy "app_settings write hr" on app_settings for all to authenticated using (public.is_hr_admin()) with check (public.is_hr_admin());

-- employees: แก้ได้เฉพาะในขอบเขตตัวเอง · เพิ่ม/ลบเฉพาะ hr/admin
drop policy if exists "authenticated write employees" on employees;
create policy "employees update scope" on employees for update to authenticated using (public.in_my_scope(dept)) with check (public.in_my_scope(dept));
create policy "employees insert hr" on employees for insert to authenticated with check (public.is_hr_admin());
create policy "employees delete hr" on employees for delete to authenticated using (public.is_hr_admin());

-- ตารางตั้งค่า/มาสเตอร์อื่นๆ: เขียนเฉพาะ hr/admin
drop policy if exists "authenticated write departments" on departments;
create policy "departments write hr" on departments for all to authenticated using (public.is_hr_admin()) with check (public.is_hr_admin());
drop policy if exists "authenticated write competencies" on competencies;
create policy "competencies write hr" on competencies for all to authenticated using (public.is_hr_admin()) with check (public.is_hr_admin());
drop policy if exists "authenticated write jd_library" on jd_library;
create policy "jd_library write hr" on jd_library for all to authenticated using (public.is_hr_admin()) with check (public.is_hr_admin());
drop policy if exists "authenticated write jd_items" on jd_items;
create policy "jd_items write hr" on jd_items for all to authenticated using (public.is_hr_admin()) with check (public.is_hr_admin());
drop policy if exists "authenticated write kpi_defs" on kpi_defs;
create policy "kpi_defs write hr" on kpi_defs for all to authenticated using (public.is_hr_admin()) with check (public.is_hr_admin());
drop policy if exists "authenticated write kpi_items" on kpi_items;
create policy "kpi_items write hr" on kpi_items for all to authenticated using (public.is_hr_admin()) with check (public.is_hr_admin());
drop policy if exists "kpi_monthly_auth" on kpi_monthly;
create policy "kpi_monthly write hr" on kpi_monthly for all to authenticated using (public.is_hr_admin()) with check (public.is_hr_admin());
drop policy if exists "hr_roster_auth" on hr_roster;
create policy "hr_roster write hr" on hr_roster for all to authenticated using (public.is_hr_admin()) with check (public.is_hr_admin());
drop policy if exists "auth write performance_trend" on performance_trend;
create policy "performance_trend write hr" on performance_trend for all to authenticated using (public.is_hr_admin()) with check (public.is_hr_admin());
drop policy if exists "authenticated write teams" on teams;
create policy "teams write hr" on teams for all to authenticated using (public.is_hr_admin()) with check (public.is_hr_admin());

-- evaluations, notifications, submissions: ผู้ล็อกอินเขียนได้ (ผู้ประเมินส่งผล/แจ้งเตือน)
-- (คงนโยบายเดิม)
