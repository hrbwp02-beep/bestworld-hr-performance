-- แก้บั๊กระบบประเมินประจำปี (ตรวจละเอียด 03/11/2569)
-- 1) บัญชีหน่วยงานประเมินตัวหัวหน้า/ผู้จัดการของหน่วยงานตัวเองได้ (เท่ากับให้คะแนนตัวเอง) → ใบของคนกลุ่มนี้ให้ HR/ผู้บริหารกรอก
-- 2) แก้หัวข้อ JD หลังส่งใบแล้ว → ใบที่อนุมัติแล้วเกรด/โบนัสหาย → ล็อกการเพิ่ม/ลบ/เปลี่ยนน้ำหนักหัวข้อของ JD ที่มีใบส่งแล้ว
-- 3) ปุ่ม "คำนวณใหม่" เขียนทับการตั้ง "ประเมิน/ไม่ประเมิน" ที่ HR ตั้งเอง → ไม่แตะช่องนี้อีก
-- 4) บัญชีหน่วยงานบันทึกใบของคนที่ไม่อยู่ในรอบได้ (ผ่าน API ตรง) → กันไว้
-- 5) ดึงตอกบัตรรวมงวดหลังวันสิ้นสุดผลงาน (เช่น ธ.ค.) → นับเฉพาะงวดที่จบไม่เกินเดือนสิ้นสุดผลงาน

-- 1) ใครประเมินได้
create or replace function public.perf_can_eval(p_assignment uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select is_hr_admin()
        or (a.evaluator_id is not null and a.evaluator_id = perf_my_emp_id())
        or (app_role() in ('manager','supervisor') and in_my_scope(e.dept)
            -- บัญชีหน่วยงานใช้ร่วมกัน: ห้ามประเมินหัวหน้า/ผู้จัดการของหน่วยงานตัวเองและคนระดับหัวหน้าขึ้นไป
            and a.level not in ('supervisor','manager')
            and not exists (select 1 from hr_departments d
                             where d.id = e.dept and a.employee_id in (coalesce(d.supervisor_id, ''), coalesce(d.manager_id, ''))))
      from perf_assignments a join employees e on e.id = a.employee_id
     where a.id = p_assignment), false)
$$;

-- 2) ล็อกหัวข้อ JD เมื่อมีใบที่ส่งแล้วใช้ JD นั้น (แก้ข้อความ/มาตรฐานได้ แต่เพิ่ม ลบ ย้าย หรือเปลี่ยนน้ำหนักไม่ได้)
create or replace function public.perf_jd_items_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_jd text;
begin
  if tg_op = 'UPDATE' and new.jd_id = old.jd_id and new.section = old.section and new.weight = old.weight then
    return new;  -- แก้แค่ข้อความ/มาตรฐาน/ลำดับ ได้เสมอ
  end if;
  for v_jd in select distinct x from unnest(array[case when tg_op <> 'INSERT' then old.jd_id end,
                                                  case when tg_op <> 'DELETE' then new.jd_id end]) x where x is not null loop
    if exists (select 1 from perf_assignments a where a.jd_id = v_jd and a.status in ('submitted','reviewed','approved')) then
      raise exception 'JD % มีใบประเมินที่ส่งแล้ว — เพิ่ม/ลบ/เปลี่ยนน้ำหนักหัวข้อไม่ได้ (แก้ข้อความได้) ถ้าจำเป็นให้ตีกลับใบเหล่านั้นก่อน', v_jd;
    end if;
  end loop;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists trg_perf_jd_items_guard on public.perf_jd_items;
create trigger trg_perf_jd_items_guard before insert or update or delete on public.perf_jd_items
  for each row execute function public.perf_jd_items_guard();

-- หัวข้อกลาง (C พฤติกรรมหลัก / B ภาวะผู้นำ) ใช้กับทุกใบ: เพิ่ม/ลบไม่ได้เมื่อมีใบส่งแล้ว
create or replace function public.perf_common_items_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.kind = old.kind then return new; end if;
  if exists (select 1 from perf_assignments where status in ('submitted','reviewed','approved')) then
    raise exception 'มีใบประเมินที่ส่งแล้ว — เพิ่ม/ลบหัวข้อกลางไม่ได้ (แก้ข้อความได้)';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
drop trigger if exists trg_perf_common_items_guard on public.perf_common_items;
create trigger trg_perf_common_items_guard before insert or update or delete on public.perf_common_items
  for each row execute function public.perf_common_items_guard();
revoke execute on function public.perf_jd_items_guard() from public, anon, authenticated;
revoke execute on function public.perf_common_items_guard() from public, anon, authenticated;

-- 3) คำนวณใหม่: ปรับเฉพาะ ระดับ / JD / ผู้ประเมิน / ผู้ทบทวน ของใบที่ยังไม่เริ่ม — ไม่แตะ ประเมิน/ไม่ประเมิน
create or replace function public.perf_generate(p_cycle text, p_refresh boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c perf_cycles; n_new int := 0; n_upd int := 0;
begin
  if not is_hr_admin() then raise exception 'เฉพาะ HR'; end if;
  select * into c from perf_cycles where id = p_cycle;
  if c.id is null then raise exception 'ไม่พบรอบประเมิน'; end if;
  drop table if exists _perf_src;
  create temp table _perf_src on commit drop as
  with w as (
    select e.* from employees e
     where upper(coalesce(e.employment_status, 'ACTIVE')) in ('ACTIVE','PROBATION','ON_LEAVE','SUSPENDED')),
  x as (
    select w.id employee_id, w.dept, w.hire_date, perf_level_of(w.position) lvl,
      coalesce(w.jd_id, (select j.id from jd_library j
                          where regexp_replace(coalesce(j.title, ''), '\s', '', 'g') = regexp_replace(coalesce(w.position, ''), '\s', '', 'g')
                            and coalesce(j.title, '') <> '' order by j.sort limit 1)) jd,
      d.supervisor_id dsup, d.manager_id dmgr, coalesce(w.supervisor_fk, w.supervisor_id) hsup
    from w left join hr_departments d on d.id = w.dept)
  select x.employee_id, x.lvl, x.jd,
    case when x.dsup is not null and x.dsup <> x.employee_id then x.dsup
         when x.dmgr is not null and x.dmgr <> x.employee_id then x.dmgr
         when x.hsup is not null and x.hsup <> x.employee_id then x.hsup end as evaluator,
    case when x.dsup is not null and x.dsup <> x.employee_id
              and x.dmgr is not null and x.dmgr <> x.employee_id and x.dmgr <> x.dsup then x.dmgr end as reviewer,
    case when x.dept = 'mgmt' then false
         when x.hire_date is not null and x.hire_date + 119 > c.eligible_cutoff then false
         else true end as elig,
    case when x.dept = 'mgmt' then 'ฝ่ายบริหาร — รอตัดสินใจว่าประเมินหรือไม่'
         when x.hire_date is not null and x.hire_date + 119 > c.eligible_cutoff
           then 'ยังไม่พ้นทดลองงาน ณ ' || to_char(c.eligible_cutoff, 'DD/MM/') || (extract(year from c.eligible_cutoff)::int + 543) end as elig_note
  from x;

  insert into perf_assignments (cycle_id, employee_id, level, jd_id, evaluator_id, reviewer_id, eligible, eligible_note)
  select p_cycle, s.employee_id, s.lvl, s.jd, s.evaluator, s.reviewer, s.elig, s.elig_note from _perf_src s
  on conflict (cycle_id, employee_id) do nothing;
  get diagnostics n_new = row_count;

  if p_refresh then
    update perf_assignments a
       set level = s.lvl, jd_id = coalesce(s.jd, a.jd_id), evaluator_id = s.evaluator, reviewer_id = s.reviewer, updated_at = now()
      from _perf_src s
     where a.cycle_id = p_cycle and a.employee_id = s.employee_id and a.status = 'pending';
    get diagnostics n_upd = row_count;
  end if;
  return jsonb_build_object('ok', true, 'created', n_new, 'refreshed', n_upd);
end $$;

-- 4) กันบันทึก/ส่งใบของคนที่ไม่อยู่ในรอบ (ยกเว้น HR)
create or replace function public.perf_save(p_assignment uuid, p_scores jsonb, p_comment text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a perf_assignments; v_hr boolean := is_hr_admin(); r jsonb; v_by text;
begin
  select * into a from perf_assignments where id = p_assignment for update;
  if a.id is null then raise exception 'ไม่พบใบประเมิน'; end if;
  if not perf_can_eval(p_assignment) then raise exception 'บัญชีนี้ไม่มีสิทธิ์ประเมินพนักงานคนนี้'; end if;
  if not v_hr and not a.eligible then raise exception 'พนักงานคนนี้ไม่อยู่ในรอบประเมิน'; end if;
  if a.status not in ('pending','draft','returned') then raise exception 'ใบประเมินนี้ส่งแล้ว แก้ไม่ได้ ต้องให้ผู้ทบทวนหรือ HR ตีกลับก่อน'; end if;
  if not v_hr and not perf_cycle_is_open(a.cycle_id) then raise exception 'ตอนนี้ไม่อยู่ในช่วงเปิดรับประเมิน'; end if;
  v_by := coalesce(perf_my_emp_id(), auth.jwt()->>'email');
  for r in select * from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb)) loop
    if not exists (select 1 from perf_items(p_assignment) i where i.item_id = r->>'item_id') then continue; end if;
    if nullif(r->>'rating', '') is null then
      delete from perf_scores where assignment_id = p_assignment and item_id = r->>'item_id';
    else
      insert into perf_scores (assignment_id, item_id, rating, note, updated_by, updated_at)
      values (p_assignment, r->>'item_id', (r->>'rating')::smallint, nullif(btrim(coalesce(r->>'note', '')), ''), v_by, now())
      on conflict (assignment_id, item_id) do update
        set rating = excluded.rating, note = excluded.note, updated_by = excluded.updated_by, updated_at = now();
    end if;
  end loop;
  update perf_assignments set status = case when status = 'pending' then 'draft' else status end,
         evaluator_comment = coalesce(p_comment, evaluator_comment), updated_at = now() where id = p_assignment;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.perf_submit(p_assignment uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a perf_assignments; v_hr boolean := is_hr_admin(); n int; nr int; nm int; v_review boolean;
begin
  select * into a from perf_assignments where id = p_assignment for update;
  if a.id is null then raise exception 'ไม่พบใบประเมิน'; end if;
  if not perf_can_eval(p_assignment) then raise exception 'บัญชีนี้ไม่มีสิทธิ์ประเมินพนักงานคนนี้'; end if;
  if not a.eligible then raise exception 'พนักงานคนนี้ไม่อยู่ในรอบประเมิน — ตั้งเป็น "ประเมิน" ก่อน'; end if;
  if a.status not in ('pending','draft','returned') then raise exception 'ใบประเมินนี้ส่งไปแล้ว'; end if;
  if not v_hr and not perf_cycle_is_open(a.cycle_id) then raise exception 'ตอนนี้ไม่อยู่ในช่วงเปิดรับประเมิน'; end if;
  select count(*), count(s.rating), count(*) filter (where s.rating in (1, 5) and coalesce(btrim(s.note), '') = '')
    into n, nr, nm
    from perf_items(p_assignment) i left join perf_scores s on s.assignment_id = p_assignment and s.item_id = i.item_id;
  if n = 0 then raise exception 'ใบนี้ยังไม่มีหัวข้อประเมิน — แจ้ง HR'; end if;
  if nr < n then raise exception 'ให้คะแนนยังไม่ครบ (% จาก % ข้อ)', nr, n; end if;
  if nm > 0 then raise exception 'ข้อที่ให้ระดับ 1 หรือ 5 ต้องเขียนเหตุผล (ยังขาด % ข้อ)', nm; end if;
  v_review := perf_reviewer_has_account(a.reviewer_id);
  update perf_assignments
     set status = case when v_review then 'submitted' else 'reviewed' end, submitted_at = now(),
         reviewed_at = case when v_review then null else now() end, updated_at = now()
   where id = p_assignment;
  return jsonb_build_object('ok', true, 'status', case when v_review then 'submitted' else 'reviewed' end);
end $$;

-- 5) ตอกบัตร: นับเฉพาะงวดของปีรอบนี้ที่จบไม่เกินเดือนสิ้นสุดผลงาน
create or replace function public.perf_sync_deductions(p_cycle text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c perf_cycles; v_by text := auth.jwt()->>'email'; n_t int := 0; n_w int := 0; k jsonb; pq numeric; sq numeric; v_last int;
begin
  if not is_hr_admin() then raise exception 'เฉพาะ HR'; end if;
  select * into c from perf_cycles where id = p_cycle;
  if c.id is null then raise exception 'ไม่พบรอบประเมิน'; end if;
  k := coalesce(c.config->'deduct', '{}'::jsonb);
  pq := coalesce((c.config->>'personal_quota')::numeric, 7);
  sq := coalesce((c.config->>'sick_quota')::numeric, 30);
  v_last := extract(month from c.period_end)::int;
  delete from perf_deductions where cycle_id = p_cycle and source in ('timecard','warning');

  insert into perf_deductions (cycle_id, employee_id, kind, qty, points, source, note, created_by)
  select p_cycle, t.employee_id, v.kind, v.qty, v.qty * coalesce((k->>v.kind)::numeric, 0), 'timecard', v.note, v_by
    from (select m.employee_id,
                 sum(coalesce(m.late_count, 0)) late, sum(coalesce(m.absent_days, 0)) absent,
                 sum(coalesce(m.personal_days, 0)) personal, sum(coalesce(m.sick_days, 0)) sick,
                 string_agg(distinct p.label, ', ') periods
            from attendance_monthly m join attendance_periods p on p.id = m.period_id
           where p.year_th = c.year_th and coalesce(p.month_to, p.month) <= v_last
             and exists (select 1 from perf_assignments a where a.cycle_id = p_cycle and a.employee_id = m.employee_id)
           group by m.employee_id) t
    cross join lateral (values
      ('late', t.late::numeric, 'มาสาย ' || t.late || ' ครั้ง (ตอกบัตร ' || t.periods || ')'),
      ('absent', t.absent::numeric, 'ขาดงาน ' || t.absent || ' วัน (ตอกบัตร ' || t.periods || ')'),
      ('personal_over', greatest(0, t.personal - pq), 'ลากิจเกินสิทธิ์ ' || pq || ' วัน'),
      ('sick_over', greatest(0, t.sick - sq), 'ลาป่วยเกินสิทธิ์ ' || sq || ' วัน')) v(kind, qty, note)
   where v.qty > 0;
  get diagnostics n_t = row_count;

  insert into perf_deductions (cycle_id, employee_id, kind, qty, points, source, note, created_by)
  select p_cycle, w.employee_id, w.kind, 1, coalesce((k->>w.kind)::numeric, 0), 'warning',
         w.type || ' ' || to_char(w.date, 'DD/MM/') || (extract(year from w.date)::int + 543) || coalesce(' · ' || w.reason, ''), v_by
    from (select d.*, case
                  when d.type ~ 'วาจา' then 'warn_verbal'
                  when d.type ~ 'ลายลักษณ์' then 'warn_written_' || least(3, row_number() over (partition by d.employee_id, (d.type ~ 'ลายลักษณ์') order by d.date, d.id))
                  when d.type ~ 'พักงาน' then 'suspend' end kind
            from disciplinary d
           where d.date between c.period_start and c.period_end
             and exists (select 1 from perf_assignments a where a.cycle_id = p_cycle and a.employee_id = d.employee_id)) w
   where w.kind is not null;
  get diagnostics n_w = row_count;
  return jsonb_build_object('ok', true, 'timecard', n_t, 'warning', n_w);
end $$;

-- รายชื่อสำหรับหน้าจอ: เพิ่มสถานะการจ้าง (เห็นคนที่ลาออกหลังสร้างใบ) และบอกว่าบัญชีนี้ประเมินใบนี้ได้ไหม
drop function if exists public.perf_list(text);
create function public.perf_list(p_cycle text)
returns table (
  assignment_id uuid, employee_id text, name text, "position" text, dept text, dept_name text,
  hire_date date, employment_status text, level text, jd_id text, jd_title text,
  evaluator_id text, evaluator_name text, reviewer_id text, reviewer_name text,
  eligible boolean, eligible_note text, status text, my_role text, can_eval boolean,
  evaluator_comment text, reviewer_comment text, hr_comment text,
  items_total int, items_rated int, avg_a numeric, avg_b numeric, avg_c numeric, perf_pct numeric,
  attendance_points numeric, warning_points numeric, total numeric, complete boolean,
  grade text, bonus_months numeric, bonus_factor numeric, raise_pct numeric)
language sql stable security definer set search_path = public as $$
  select a.id, a.employee_id, e.name, e.position, e.dept, d.name, e.hire_date, upper(coalesce(e.employment_status, 'ACTIVE')),
    a.level, a.jd_id, j.title,
    a.evaluator_id, ev.name, a.reviewer_id, rv.name, a.eligible, a.eligible_note, a.status,
    case when is_hr_admin() then 'hr'
         when a.reviewer_id is not null and a.reviewer_id = perf_my_emp_id() then 'reviewer'
         else 'evaluator' end,
    perf_can_eval(a.id),
    a.evaluator_comment, a.reviewer_comment, a.hr_comment,
    r.items_total, r.items_rated, r.avg_a, r.avg_b, r.avg_c, r.perf_pct,
    r.attendance_points, r.warning_points, r.total, r.complete, r.grade, r.bonus_months, r.bonus_factor, r.raise_pct
  from perf_results(p_cycle) r
  join perf_assignments a on a.id = r.assignment_id
  join employees e on e.id = a.employee_id
  left join hr_departments d on d.id = e.dept
  left join jd_library j on j.id = a.jd_id
  left join employees ev on ev.id = a.evaluator_id
  left join employees rv on rv.id = a.reviewer_id
  order by e.dept, e.id
$$;
revoke execute on function public.perf_list(text) from public, anon;
grant execute on function public.perf_list(text) to authenticated;
