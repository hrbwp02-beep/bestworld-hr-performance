-- ระบบประเมินผล: ป้องกันข้อมูลใบประเมินเพี้ยน (14/10/2569)
-- 1) ใบประเมิน 1 ใบต่อพนักงาน 1 คนต่อรอบปี (เดิมไม่มี → หัวหน้าบันทึกซ้ำแล้วเกิดใบซ้ำ)
-- 2) กันการเดินสายอนุมัติโดยคนที่ไม่ใช่เจ้าของขั้นนั้น
-- 3) กันแก้คะแนนเมื่อรอบปิด หรือเมื่อส่งเข้าสายอนุมัติแล้ว (ต้องตีกลับก่อน)
-- HR/admin และ Edge Function (service role) ไม่ถูกจำกัด
-- ชื่อฟังก์ชันขึ้นต้น perf_ ทั้งหมด เพื่อไม่ชนกับระบบอื่นที่ใช้ฐานเดียวกัน

create unique index if not exists evaluations_emp_cycle_uniq
  on public.evaluations (employee_id, cycle_year);

-- รหัสพนักงานของผู้ล็อกอิน (จาก app_users)
create or replace function public.perf_my_emp_id()
returns text language sql stable security definer set search_path = public as $$
  select employee_id from app_users
  where lower(email) = lower(coalesce(auth.jwt()->>'email', '')) and active
  limit 1
$$;

-- สายประเมินของพนักงาน: หัวหน้างาน → ผู้จัดการ → HR (ข้ามขั้นที่ไม่มีคน และไม่ให้ประเมินตัวเอง)
-- ต้องตรงกับ APPROVAL_STAGES ใน screens-eval-jd.jsx
create or replace function public.perf_chain(p_emp text)
returns table (stage text, owner_id text, ord int)
language sql stable security definer set search_path = public as $$
  with e as (select id, dept from employees where id = p_emp),
  d as (select hd.supervisor_id, hd.manager_id from hr_departments hd join e on hd.id = e.dept),
  raw as (
    select 'supervisor'::text, (select supervisor_id from d), 1
    union all select 'manager', (select manager_id from d), 2
    union all select 'hr', (select hr_evaluator_id from app_settings where id = 1), 3
  )
  select * from raw r(stage, owner_id, ord)
  where owner_id is not null and owner_id <> p_emp
  order by ord
$$;

-- รอบประเมินเปิดอยู่หรือไม่ (สวิตช์เปิดรอบ + อยู่ในช่วงวันที่ ตามเวลาไทย)
create or replace function public.perf_cycle_open()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select eval_open
      and (start_date is null or (now() at time zone 'Asia/Bangkok')::date >= start_date)
      and (end_date   is null or (now() at time zone 'Asia/Bangkok')::date <= end_date)
    from app_settings where id = 1), false)
$$;

create or replace function public.perf_eval_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_me text;
  v_first text;
  v_old_stage text;
  v_scores_changed boolean;
begin
  -- คำสั่งตรงจากฐาน (ไม่มี JWT) หรือ Edge Function ที่ใช้ service role → ผ่าน
  if coalesce(current_setting('request.jwt.claims', true), '') = ''
     or coalesce(auth.jwt()->>'role', '') = 'service_role' then
    return new;
  end if;
  if public.is_hr_admin() then return new; end if;

  v_me := public.perf_my_emp_id();

  -- ผู้ใช้ทั่วไปแก้ผลประเมินตนเอง/การรับทราบผลแทนพนักงานไม่ได้ (ทำผ่านหน้าพนักงานเท่านั้น)
  if tg_op = 'UPDATE' and (new.self_assessment is distinct from old.self_assessment
      or new.ack_status is distinct from old.ack_status
      or new.ack_comment is distinct from old.ack_comment) then
    raise exception 'แก้ผลประเมินตนเอง/การรับทราบผลของพนักงานไม่ได้';
  end if;

  v_scores_changed := case when tg_op = 'INSERT'
    then new.items is not null or new.overall is not null
    else (new.items, new.overall, new.kpi_score, new.comp_score, new.grade)
         is distinct from (old.items, old.overall, old.kpi_score, old.comp_score, old.grade) end;
  v_old_stage := case when tg_op = 'UPDATE' then coalesce(old.stage, 'draft') else 'draft' end;

  if v_scores_changed then
    if not public.perf_cycle_open() then
      raise exception 'รอบประเมินปิดอยู่ (หรือเลยช่วงวันที่ประเมิน) — ติดต่อฝ่ายบุคคล';
    end if;
    if v_old_stage <> 'draft' then
      raise exception 'ใบประเมินนี้ส่งเข้าสายอนุมัติแล้ว แก้คะแนนไม่ได้ ต้องตีกลับก่อน';
    end if;
  end if;

  -- สร้างใบใหม่: เป็นร่าง หรือส่งเข้าขั้นแรกของสายเท่านั้น
  if tg_op = 'INSERT' then
    if coalesce(new.stage, 'draft') <> 'draft' then
      select stage into v_first from public.perf_chain(new.employee_id) limit 1;
      if new.stage is distinct from v_first then
        raise exception 'ต้องส่งเข้าขั้นแรกของสายอนุมัติ (%)', coalesce(v_first, '-');
      end if;
    end if;
    if new.status = 'done' or new.stage = 'approved' then
      raise exception 'อนุมัติผลประเมินโดยตรงไม่ได้ ต้องผ่านสายอนุมัติ';
    end if;
    return new;
  end if;

  -- เปลี่ยนขั้น
  if coalesce(new.stage, 'draft') is distinct from v_old_stage then
    if v_old_stage = 'draft' then
      -- ส่งเข้าสาย: ต้องเข้าขั้นแรก
      select stage into v_first from public.perf_chain(new.employee_id) limit 1;
      if new.stage is distinct from v_first then
        raise exception 'ต้องส่งเข้าขั้นแรกของสายอนุมัติ (%)', coalesce(v_first, '-');
      end if;
    elsif not exists (select 1 from public.perf_chain(new.employee_id) c
                      where c.stage = v_old_stage and c.owner_id = v_me) then
      raise exception 'คุณไม่ใช่ผู้อนุมัติของขั้นนี้';
    end if;
  elsif new.status is distinct from old.status and new.status = 'done' then
    raise exception 'อนุมัติผลประเมินโดยตรงไม่ได้ ต้องผ่านสายอนุมัติ';
  end if;

  return new;
end $$;

drop trigger if exists trg_perf_eval_guard on public.evaluations;
create trigger trg_perf_eval_guard before insert or update on public.evaluations
  for each row execute function public.perf_eval_guard();

-- ฟังก์ชันช่วยใช้ภายใน ไม่ต้องเปิดให้เรียกจากหน้าเว็บโดยตรง (ยกเว้น perf_cycle_open ใช้แสดงผลได้)
revoke execute on function public.perf_eval_guard() from public, anon, authenticated;
revoke execute on function public.perf_chain(text) from anon;
revoke execute on function public.perf_my_emp_id() from anon;
