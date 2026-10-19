-- ปรับระบบประเมินประจำปีให้รองรับบัญชีแบบหน่วยงาน (19/10/2569)
-- app_users เปลี่ยนเป็นบัญชีรายหน่วยงาน (เช่น maintenance@, production@) ส่วนใหญ่ไม่ผูก employee_id
-- กติกาใหม่:
--   ผู้ประเมินได้ = HR/admin · หรือบัญชีส่วนตัวที่เป็น evaluator_id · หรือบัญชีหน่วยงานที่ครอบคลุมหน่วยงานของพนักงาน (in_my_scope)
--   ขั้นผู้จัดการทบทวน ใช้เฉพาะเมื่อผู้ทบทวนมีบัญชีส่วนตัว — ถ้าไม่มี ใบประเมินส่งตรงถึง HR

create or replace function public.perf_can_eval(p_assignment uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select is_hr_admin()
        or (a.evaluator_id is not null and a.evaluator_id = perf_my_emp_id())
        or (app_role() in ('manager','supervisor') and in_my_scope(e.dept))
      from perf_assignments a join employees e on e.id = a.employee_id
     where a.id = p_assignment), false)
$$;

create or replace function public.perf_can_see(p_assignment uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select perf_can_eval(a.id) or (a.reviewer_id is not null and a.reviewer_id = perf_my_emp_id())
      from perf_assignments a where a.id = p_assignment), false)
$$;

-- ผู้ทบทวนมีบัญชีส่วนตัวที่ใช้งานอยู่ไหม
create or replace function public.perf_reviewer_has_account(p_emp text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_emp is not null and exists (select 1 from app_users u where u.employee_id = p_emp and u.active)
$$;

drop policy if exists "perf_assignments read" on public.perf_assignments;
create policy "perf_assignments read" on public.perf_assignments for select to authenticated
  using (public.perf_can_see(id));
drop policy if exists "perf_scores read" on public.perf_scores;
create policy "perf_scores read" on public.perf_scores for select to authenticated
  using (public.perf_can_see(assignment_id));

create or replace function public.perf_results(p_cycle text)
returns table (
  assignment_id uuid, employee_id text, items_total int, items_rated int,
  avg_a numeric, avg_b numeric, avg_c numeric, perf_pct numeric,
  attendance_points numeric, warning_points numeric, total numeric,
  complete boolean, grade text, bonus_months numeric, bonus_factor numeric, raise_pct numeric)
language sql stable security definer set search_path = public as $$
  with c as (select * from perf_cycles where id = p_cycle),
  a as (
    select pa.*, e.hire_date from perf_assignments pa join employees e on e.id = pa.employee_id
     where pa.cycle_id = p_cycle and perf_can_see(pa.id)),
  sc as (
    select a.id aid, i.section, i.weight, s.rating
      from a cross join lateral perf_items(a.id) i
      left join perf_scores s on s.assignment_id = a.id and s.item_id = i.item_id),
  cnt as (select aid, count(*)::int n, count(rating)::int nr from sc group by aid),
  sec as (
    select aid,
      sum(weight * rating) filter (where section = 'A' and rating is not null) / nullif(sum(weight) filter (where section = 'A' and rating is not null), 0) av_a,
      sum(weight * rating) filter (where section = 'B' and rating is not null) / nullif(sum(weight) filter (where section = 'B' and rating is not null), 0) av_b,
      sum(weight * rating) filter (where section = 'C' and rating is not null) / nullif(sum(weight) filter (where section = 'C' and rating is not null), 0) av_c
    from sc group by aid)
  select a.id, a.employee_id, coalesce(cnt.n, 0), coalesce(cnt.nr, 0),
    round(sec.av_a, 2), round(sec.av_b, 2), round(sec.av_c, 2), round(p.pct, 2),
    10 - coalesce(d.orange, 0), coalesce(d.warn, 0), t.total,
    (coalesce(cnt.n, 0) > 0 and cnt.nr = cnt.n),
    case when coalesce(cnt.n, 0) > 0 and cnt.nr = cnt.n and a.eligible then g.grade end,
    case when is_hr_admin() and coalesce(cnt.n, 0) > 0 and cnt.nr = cnt.n and a.eligible then g.months end,
    case when is_hr_admin() then
      case when a.hire_date is null or a.hire_date <= c.period_start then 1::numeric
           else round(greatest(0, ((c.period_start + interval '1 year')::date - a.hire_date))::numeric
                      / ((c.period_start + interval '1 year')::date - c.period_start), 4) end end,
    case when is_hr_admin() and coalesce(cnt.n, 0) > 0 and cnt.nr = cnt.n and a.eligible then
      case when g.grade is null or g.grade = 'F' then 0::numeric
           when a.hire_date is not null and c.raise_effective is not null and a.hire_date > c.raise_effective - 365 then 0::numeric
           else coalesce((c.config->>'raise_pct')::numeric, 0) end end
  from a cross join c
  left join cnt on cnt.aid = a.id
  left join sec on sec.aid = a.id
  left join lateral (
    select sum(x.w * (70 + (x.v - 3) * 15)) / nullif(sum(x.w), 0) pct
      from (values (coalesce((c.config->'weights'->a.level->>'A')::numeric, 0), sec.av_a),
                   (coalesce((c.config->'weights'->a.level->>'B')::numeric, 0), sec.av_b),
                   (coalesce((c.config->'weights'->a.level->>'C')::numeric, 0), sec.av_c)) x(w, v)
     where x.v is not null and x.w > 0) p on true
  left join lateral (
    select sum(dd.points) filter (where dd.kind not in ('warn_verbal','warn_written_1','warn_written_2','warn_written_3','suspend')) orange,
           sum(dd.points) filter (where dd.kind in ('warn_verbal','warn_written_1','warn_written_2','warn_written_3','suspend')) warn
      from perf_deductions dd where dd.cycle_id = p_cycle and dd.employee_id = a.employee_id and not dd.waived) d on true
  left join lateral (
    select case when p.pct is null then null
                else round(0.9 * p.pct + 10 - coalesce(d.orange, 0) - coalesce(d.warn, 0), 1) end total) t on true
  left join lateral (
    select b->>1 grade, (b->>2)::numeric months
      from jsonb_array_elements(c.config->'bands') b
     where t.total is not null and round(t.total) >= (b->>0)::numeric
     order by (b->>0)::numeric desc limit 1) g on true
$$;

create or replace function public.perf_list(p_cycle text)
returns table (
  assignment_id uuid, employee_id text, name text, "position" text, dept text, dept_name text,
  hire_date date, level text, jd_id text, jd_title text,
  evaluator_id text, evaluator_name text, reviewer_id text, reviewer_name text,
  eligible boolean, eligible_note text, status text, my_role text,
  evaluator_comment text, reviewer_comment text, hr_comment text,
  items_total int, items_rated int, avg_a numeric, avg_b numeric, avg_c numeric, perf_pct numeric,
  attendance_points numeric, warning_points numeric, total numeric, complete boolean,
  grade text, bonus_months numeric, bonus_factor numeric, raise_pct numeric)
language sql stable security definer set search_path = public as $$
  select a.id, a.employee_id, e.name, e.position, e.dept, d.name, e.hire_date, a.level, a.jd_id, j.title,
    a.evaluator_id, ev.name, a.reviewer_id, rv.name, a.eligible, a.eligible_note, a.status,
    case when is_hr_admin() then 'hr'
         when a.reviewer_id is not null and a.reviewer_id = perf_my_emp_id() then 'reviewer'
         else 'evaluator' end,
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

create or replace function public.perf_get_form(p_assignment uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare a perf_assignments; v_hr boolean := is_hr_admin(); v_eval boolean; v jsonb;
begin
  select * into a from perf_assignments where id = p_assignment;
  if a.id is null then raise exception 'ไม่พบใบประเมิน'; end if;
  if not perf_can_see(p_assignment) then raise exception 'ไม่มีสิทธิ์ดูใบประเมินนี้'; end if;
  v_eval := perf_can_eval(p_assignment);
  select jsonb_build_object(
    'row', (select to_jsonb(l) from perf_list(a.cycle_id) l where l.assignment_id = a.id),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'item_id', i.item_id, 'section', i.section, 'seq', i.seq, 'title', i.title,
        'standard', i.standard, 'weight', i.weight, 'rating', s.rating, 'note', s.note)
        order by i.section, i.seq)
      from perf_items(a.id) i left join perf_scores s on s.assignment_id = a.id and s.item_id = i.item_id), '[]'::jsonb),
    'cycle', (select jsonb_build_object('id', id, 'name', name, 'status', status, 'open_from', open_from,
                'open_to', open_to, 'is_open', perf_cycle_is_open(id), 'config', config) from perf_cycles where id = a.cycle_id),
    'can_edit', v_eval and a.status in ('pending','draft','returned') and (v_hr or perf_cycle_is_open(a.cycle_id)),
    'can_review', (v_hr or (a.reviewer_id is not null and a.reviewer_id = perf_my_emp_id())) and a.status = 'submitted',
    'is_hr', v_hr) into v;
  return v;
end $$;

create or replace function public.perf_save(p_assignment uuid, p_scores jsonb, p_comment text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a perf_assignments; v_hr boolean := is_hr_admin(); r jsonb; v_by text;
begin
  select * into a from perf_assignments where id = p_assignment for update;
  if a.id is null then raise exception 'ไม่พบใบประเมิน'; end if;
  if not perf_can_eval(p_assignment) then raise exception 'บัญชีนี้ไม่มีสิทธิ์ประเมินพนักงานคนนี้'; end if;
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

revoke execute on function public.perf_can_eval(uuid) from public, anon;
revoke execute on function public.perf_can_see(uuid) from public, anon;
revoke execute on function public.perf_reviewer_has_account(text) from public, anon;
grant execute on function public.perf_can_eval(uuid), public.perf_can_see(uuid), public.perf_reviewer_has_account(text) to authenticated;

-- ปิดคำเตือนความปลอดภัยของ Supabase (19/10/2569)
alter function public.perf_today() set search_path = public;
alter function public.perf_level_of(text) set search_path = public;
revoke execute on function public.perf_chain(text) from public, anon;
revoke execute on function public.perf_cycle_open() from public, anon;
revoke execute on function public.perf_my_emp_id() from public, anon;
grant execute on function public.perf_chain(text), public.perf_cycle_open(), public.perf_my_emp_id() to authenticated;
