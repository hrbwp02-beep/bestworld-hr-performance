-- 03/11/2569 พนักงานที่ "ไม่ต้องประเมิน" (มีชื่อใน Bplus เพื่อทำเงินเดือนอย่างเดียว)
-- เก็บเป็นตารางของระบบประเมินเอง ไม่แตะตาราง employees (ใช้ร่วมกับทุกแอป และ Bplus import ไม่ทับ)
-- ผล: ไม่สร้าง/ไม่นับใบประเมิน · ไม่อยู่ในสรุปผล รายงาน และสถิติของแอปประเมิน · ติ๊กคืนได้

create table if not exists perf_exclusions (
  employee_id text primary key references employees(id) on delete cascade,
  reason text,
  created_by text,
  created_at timestamptz not null default now()
);
alter table perf_exclusions enable row level security;
drop policy if exists "read" on perf_exclusions;
create policy "read" on perf_exclusions for select to authenticated using (true);
-- เขียนผ่าน perf_set_excluded() เท่านั้น

create or replace function perf_set_excluded(p_emp text, p_excluded boolean, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n int := 0;
begin
  if not is_hr_admin() then raise exception 'เฉพาะ HR'; end if;
  if not exists (select 1 from employees where id = p_emp) then raise exception 'ไม่พบพนักงาน %', p_emp; end if;
  if p_excluded then
    insert into perf_exclusions (employee_id, reason, created_by)
    values (p_emp, nullif(btrim(p_reason), ''), auth.jwt()->>'email')
    on conflict (employee_id) do update set reason = excluded.reason, created_by = excluded.created_by, created_at = now();
    -- ใบในรอบที่ยังไม่สรุปผล → ไม่อยู่ในรอบ
    update perf_assignments a set eligible = false,
           eligible_note = 'ไม่ต้องประเมิน' || coalesce(' — ' || nullif(btrim(p_reason), ''), ''), updated_at = now()
      from perf_cycles c
     where c.id = a.cycle_id and c.status <> 'final' and a.employee_id = p_emp;
  else
    delete from perf_exclusions where employee_id = p_emp;
    update perf_assignments a set eligible = true, eligible_note = null, updated_at = now()
      from perf_cycles c
     where c.id = a.cycle_id and c.status <> 'final' and a.employee_id = p_emp and a.eligible_note like 'ไม่ต้องประเมิน%';
  end if;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'forms', n);
end $$;
revoke all on function perf_set_excluded(text, boolean, text) from public, anon;
grant execute on function perf_set_excluded(text, boolean, text) to authenticated;

-- สร้างใบใหม่: คนที่ไม่ต้องประเมิน → ไม่อยู่ในรอบตั้งแต่ต้น
create or replace function public.perf_generate(p_cycle text, p_refresh boolean default false)
 returns jsonb language plpgsql security definer set search_path to 'public' as $function$
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

  if p_refresh then
    update perf_assignments a
       set level = s.lvl, jd_id = coalesce(s.jd, a.jd_id), evaluator_id = s.evaluator, reviewer_id = s.reviewer, updated_at = now()
      from _perf_src s
     where a.cycle_id = p_cycle and a.employee_id = s.employee_id and a.status = 'pending';
    get diagnostics n_upd = row_count;
  end if;
  return jsonb_build_object('ok', true, 'created', n_new, 'refreshed', n_upd);
end $function$;

-- perf_list: เพิ่มคอลัมน์ excluded / excluded_reason (ต่อท้าย)
drop function if exists perf_list(text);
create function perf_list(p_cycle text)
 returns table(assignment_id uuid, employee_id text, name text, "position" text, dept text, dept_name text, hire_date date,
               employment_status text, level text, jd_id text, jd_title text, evaluator_id text, evaluator_name text,
               reviewer_id text, reviewer_name text, eligible boolean, eligible_note text, status text, my_role text, can_eval boolean,
               evaluator_comment text, reviewer_comment text, hr_comment text, items_total integer, items_rated integer,
               avg_a numeric, avg_b numeric, avg_c numeric, perf_pct numeric, attendance_points numeric, warning_points numeric,
               total numeric, complete boolean, grade text, bonus_months numeric, bonus_factor numeric, raise_pct numeric,
               doc_no text, cycle_id text, submitted_at timestamptz, reviewed_at timestamptz, approved_at timestamptz, approved_by text,
               calc_total numeric, calc_grade text, adjusted boolean, adj_reason text, adj_by text, adj_at timestamptz,
               excluded boolean, excluded_reason text)
 language sql stable security definer set search_path = public as $function$
  select a.id, a.employee_id, e.name, e.position, e.dept, d.name, e.hire_date, upper(coalesce(e.employment_status, 'ACTIVE')),
    a.level, a.jd_id, j.title,
    a.evaluator_id, ev.name, a.reviewer_id, rv.name, a.eligible, a.eligible_note, a.status,
    case when is_hr_admin() then 'hr'
         when a.reviewer_id is not null and a.reviewer_id = perf_my_emp_id() then 'reviewer'
         else 'evaluator' end,
    perf_can_eval(a.id),
    a.evaluator_comment, a.reviewer_comment, a.hr_comment,
    r.items_total, r.items_rated, r.avg_a, r.avg_b, r.avg_c, r.perf_pct,
    r.attendance_points, r.warning_points, r.total, r.complete, r.grade, r.bonus_months, r.bonus_factor, r.raise_pct,
    a.doc_no, a.cycle_id, a.submitted_at, a.reviewed_at, a.approved_at, a.approved_by,
    r.calc_total, r.calc_grade, r.adjusted,
    case when r.adjusted then a.adj_reason end, case when r.adjusted then a.adj_by end, case when r.adjusted then a.adj_at end,
    ex.employee_id is not null, ex.reason
  from perf_results(p_cycle) r
  join perf_assignments a on a.id = r.assignment_id
  join employees e on e.id = a.employee_id
  left join hr_departments d on d.id = e.dept
  left join jd_library j on j.id = a.jd_id
  left join employees ev on ev.id = a.evaluator_id
  left join employees rv on rv.id = a.reviewer_id
  left join perf_exclusions ex on ex.employee_id = a.employee_id
  order by e.dept, e.id
$function$;
revoke all on function perf_list(text) from public, anon;
grant execute on function perf_list(text) to authenticated, service_role;
