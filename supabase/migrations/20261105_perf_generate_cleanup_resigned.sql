-- 05/11/2569 พนักงานลาออกหลังสร้างใบประเมินแล้ว → ใบค้างอยู่ (EV2569-0018, EV2569-0059 ลบมือไปแล้ว)
-- ให้ perf_generate (ปุ่ม "สร้าง/อัปเดตใบ" ของ HR) เก็บกวาดเองทุกครั้ง:
--   ลบใบของคนที่ไม่ได้ทำงานแล้ว เฉพาะใบที่ยัง "รอประเมิน" และยังไม่มีคะแนนเลย (ใบที่มีคะแนน/ส่งแล้วไม่แตะ)
--   และเอาคนที่ลาออกออกจากสายการประเมิน (perf_line_members)
delete from perf_line_members m using employees e
 where e.id = m.employee_id
   and upper(coalesce(e.employment_status, 'ACTIVE')) not in ('ACTIVE','PROBATION','ON_LEAVE','SUSPENDED');

create or replace function public.perf_generate(p_cycle text, p_refresh boolean default false)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare c perf_cycles; n_new int := 0; n_upd int := 0; n_del int := 0;
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
      d.supervisor_id dsup, d.manager_id dmgr, coalesce(w.supervisor_fk, w.supervisor_id) hsup,
      ex.employee_id is not null excl, ex.reason excl_reason
    from w left join hr_departments d on d.id = w.dept
           left join perf_exclusions ex on ex.employee_id = w.id)
  select x.employee_id, x.lvl, x.jd,
    case when x.dsup is not null and x.dsup <> x.employee_id then x.dsup
         when x.dmgr is not null and x.dmgr <> x.employee_id then x.dmgr
         when x.hsup is not null and x.hsup <> x.employee_id then x.hsup end as evaluator,
    case when x.dsup is not null and x.dsup <> x.employee_id
              and x.dmgr is not null and x.dmgr <> x.employee_id and x.dmgr <> x.dsup then x.dmgr end as reviewer,
    case when x.excl then false
         when x.dept = 'mgmt' then false
         when x.hire_date is not null and x.hire_date + 119 > c.eligible_cutoff then false
         else true end as elig,
    case when x.excl then 'ไม่ต้องประเมิน' || coalesce(' — ' || x.excl_reason, '')
         when x.dept = 'mgmt' then 'ฝ่ายบริหาร — รอตัดสินใจว่าประเมินหรือไม่'
         when x.hire_date is not null and x.hire_date + 119 > c.eligible_cutoff
           then 'ยังไม่พ้นทดลองงาน ณ ' || to_char(c.eligible_cutoff, 'DD/MM/') || (extract(year from c.eligible_cutoff)::int + 543) end as elig_note
  from x;

  insert into perf_assignments (cycle_id, employee_id, level, jd_id, evaluator_id, reviewer_id, eligible, eligible_note)
  select p_cycle, s.employee_id, s.lvl, s.jd, s.evaluator, s.reviewer, s.elig, s.elig_note from _perf_src s
  on conflict (cycle_id, employee_id) do nothing;
  get diagnostics n_new = row_count;

  -- ใหม่: ลบใบเปล่าของคนที่ลาออก/พ้นสภาพแล้ว (ยังไม่มีคะแนน และยังรอประเมิน)
  delete from perf_assignments a
   where a.cycle_id = p_cycle and a.status = 'pending'
     and not exists (select 1 from _perf_src s where s.employee_id = a.employee_id)
     and not exists (select 1 from perf_scores sc where sc.assignment_id = a.id);
  get diagnostics n_del = row_count;
  delete from perf_line_members m using employees e
   where e.id = m.employee_id
     and upper(coalesce(e.employment_status, 'ACTIVE')) not in ('ACTIVE','PROBATION','ON_LEAVE','SUSPENDED');

  if p_refresh then
    update perf_assignments a
       set level = s.lvl, jd_id = coalesce(s.jd, a.jd_id), evaluator_id = s.evaluator, reviewer_id = s.reviewer, updated_at = now()
      from _perf_src s
     where a.cycle_id = p_cycle and a.employee_id = s.employee_id and a.status = 'pending';
    get diagnostics n_upd = row_count;
  end if;
  perform perf_apply_lines(p_cycle);
  return jsonb_build_object('ok', true, 'created', n_new, 'refreshed', n_upd, 'removed', n_del);
end $function$;
