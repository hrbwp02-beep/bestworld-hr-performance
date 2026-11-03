-- 03/11/2569 ปรับระบบประเมินประจำปีให้มีข้อมูลแบบระบบตัวอย่าง (Prosoft HCM)
-- 1) เลขที่เอกสารของใบประเมิน (เช่น EV2569-0001)
-- 2) ประวัติการดำเนินการของแต่ละใบ (perf_events) — ใคร ทำอะไร เมื่อไร
-- 3) HR ปรับผล (Calibration) พร้อมเหตุผล — คะแนน/เกรดที่ปรับจะมีเครื่องหมาย (ปรับ) และเก็บค่าที่ระบบคิดไว้ด้วย
-- ใช้เฉพาะแอปประเมินผล (grep แล้ว ไม่มีแอปอื่นเรียก perf_results / perf_list / perf_get_form)

-- ---------- 1) คอลัมน์ใหม่ ----------
alter table perf_assignments
  add column if not exists doc_no text,
  add column if not exists adj_total numeric,
  add column if not exists adj_grade text,
  add column if not exists adj_reason text,
  add column if not exists adj_by text,
  add column if not exists adj_at timestamptz;

-- เลขที่เอกสารให้ใบเดิม (เรียงตามหน่วยงาน แล้วรหัสพนักงาน)
with n as (
  select a.id, 'EV' || a.cycle_id || '-' || lpad(row_number() over (partition by a.cycle_id order by e.dept, a.employee_id)::text, 4, '0') no
    from perf_assignments a join employees e on e.id = a.employee_id where a.doc_no is null)
update perf_assignments a set doc_no = n.no from n where n.id = a.id;
create unique index if not exists perf_assignments_doc_no_uq on perf_assignments (doc_no);

create or replace function perf_assign_docno() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.doc_no is null then
    select 'EV' || new.cycle_id || '-' || lpad((coalesce(max(substring(doc_no from '-(\d+)$')::int), 0) + 1)::text, 4, '0')
      into new.doc_no from perf_assignments where cycle_id = new.cycle_id;
  end if;
  return new;
end $$;
drop trigger if exists trg_perf_assign_docno on perf_assignments;
create trigger trg_perf_assign_docno before insert on perf_assignments for each row execute function perf_assign_docno();

-- ---------- 2) ประวัติการดำเนินการ ----------
create table if not exists perf_events (
  id bigserial primary key,
  assignment_id uuid not null references perf_assignments(id) on delete cascade,
  at timestamptz not null default now(),
  actor text,
  action text not null,          -- status | adjust | unadjust
  from_status text,
  to_status text,
  note text,
  data jsonb
);
create index if not exists perf_events_assignment_idx on perf_events (assignment_id, at);
alter table perf_events enable row level security;
drop policy if exists "read" on perf_events;
create policy "read" on perf_events for select to authenticated using (perf_can_see(assignment_id));
-- ไม่มี policy เขียน: บันทึกผ่าน trigger เท่านั้น แก้/ลบย้อนหลังไม่ได้

create or replace function perf_assign_log() returns trigger language plpgsql security definer set search_path = public as $$
declare v_actor text := coalesce(nullif(auth.jwt()->>'email', ''), 'system');
begin
  if new.status is distinct from old.status then
    insert into perf_events (assignment_id, actor, action, from_status, to_status, note)
    values (new.id, v_actor, 'status', old.status, new.status,
            case new.status when 'returned' then coalesce(new.hr_comment, new.reviewer_comment)
                            when 'approved' then new.hr_comment
                            when 'reviewed' then new.reviewer_comment end);
  end if;
  if (new.adj_total, new.adj_grade) is distinct from (old.adj_total, old.adj_grade) then
    insert into perf_events (assignment_id, actor, action, note, data)
    values (new.id, v_actor, case when new.adj_total is null and new.adj_grade is null then 'unadjust' else 'adjust' end,
            new.adj_reason,
            jsonb_build_object('old_total', old.adj_total, 'old_grade', old.adj_grade, 'new_total', new.adj_total, 'new_grade', new.adj_grade)
              || coalesce(nullif(current_setting('perf.calc', true), '')::jsonb, '{}'::jsonb));
  end if;
  return new;
end $$;
drop trigger if exists trg_perf_assign_log on perf_assignments;
create trigger trg_perf_assign_log after update on perf_assignments for each row execute function perf_assign_log();

-- ---------- 3) คิดคะแนน: ใช้ค่าที่ HR ปรับถ้ามี ----------
drop function if exists perf_list(text);
drop function if exists perf_results(text);

create function perf_results(p_cycle text)
 returns table(assignment_id uuid, employee_id text, items_total integer, items_rated integer, avg_a numeric, avg_b numeric, avg_c numeric,
               perf_pct numeric, attendance_points numeric, warning_points numeric, total numeric, complete boolean, grade text,
               bonus_months numeric, bonus_factor numeric, raise_pct numeric, calc_total numeric, calc_grade text, adjusted boolean)
 language sql stable security definer set search_path = public as $function$
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
    10 - coalesce(d.orange, 0), coalesce(d.warn, 0), f.total,
    k.ok,
    case when k.ok and a.eligible then g.grade end,
    case when is_hr_admin() and k.ok and a.eligible then g.months end,
    case when is_hr_admin() then
      case when a.hire_date is null or a.hire_date <= c.period_start then 1::numeric
           else round(greatest(0, ((c.period_start + interval '1 year')::date - a.hire_date))::numeric
                      / ((c.period_start + interval '1 year')::date - c.period_start), 4) end end,
    case when is_hr_admin() and k.ok and a.eligible then
      case when g.grade is null or g.grade = 'F' then 0::numeric
           when a.hire_date is not null and c.raise_effective is not null and a.hire_date > c.raise_effective - 365 then 0::numeric
           else coalesce((c.config->>'raise_pct')::numeric, 0) end end,
    t.total,
    case when k.ok and a.eligible then g0.grade end,
    f.adj
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
  left join lateral (select coalesce(cnt.n, 0) > 0 and cnt.nr = cnt.n ok) k on true
  -- t = คะแนนที่ระบบคิด · f = คะแนนที่ใช้จริง (ถ้า HR ปรับ ใช้ค่าที่ปรับ — ปรับได้เฉพาะใบที่ให้คะแนนครบ)
  left join lateral (
    select case when p.pct is null then null
                else round(0.9 * p.pct + 10 - coalesce(d.orange, 0) - coalesce(d.warn, 0), 1) end total) t on true
  left join lateral (
    select case when k.ok and a.adj_total is not null then a.adj_total else t.total end total,
           (k.ok and (a.adj_total is not null or a.adj_grade is not null)) adj) f on true
  left join lateral (
    select b->>1 grade from jsonb_array_elements(c.config->'bands') b
     where t.total is not null and round(t.total) >= (b->>0)::numeric
     order by (b->>0)::numeric desc limit 1) g0 on true
  left join lateral (
    select b->>1 grade, (b->>2)::numeric months
      from jsonb_array_elements(c.config->'bands') b
     where case when k.ok and a.adj_grade is not null then b->>1 = a.adj_grade
                else f.total is not null and round(f.total) >= (b->>0)::numeric end
     order by (b->>0)::numeric desc limit 1) g on true
$function$;

create function perf_list(p_cycle text)
 returns table(assignment_id uuid, employee_id text, name text, "position" text, dept text, dept_name text, hire_date date,
               employment_status text, level text, jd_id text, jd_title text, evaluator_id text, evaluator_name text,
               reviewer_id text, reviewer_name text, eligible boolean, eligible_note text, status text, my_role text, can_eval boolean,
               evaluator_comment text, reviewer_comment text, hr_comment text, items_total integer, items_rated integer,
               avg_a numeric, avg_b numeric, avg_c numeric, perf_pct numeric, attendance_points numeric, warning_points numeric,
               total numeric, complete boolean, grade text, bonus_months numeric, bonus_factor numeric, raise_pct numeric,
               doc_no text, cycle_id text, submitted_at timestamptz, reviewed_at timestamptz, approved_at timestamptz, approved_by text,
               calc_total numeric, calc_grade text, adjusted boolean, adj_reason text, adj_by text, adj_at timestamptz)
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
    case when r.adjusted then a.adj_reason end, case when r.adjusted then a.adj_by end, case when r.adjusted then a.adj_at end
  from perf_results(p_cycle) r
  join perf_assignments a on a.id = r.assignment_id
  join employees e on e.id = a.employee_id
  left join hr_departments d on d.id = e.dept
  left join jd_library j on j.id = a.jd_id
  left join employees ev on ev.id = a.evaluator_id
  left join employees rv on rv.id = a.reviewer_id
  order by e.dept, e.id
$function$;

revoke all on function perf_results(text) from public, anon;
revoke all on function perf_list(text) from public, anon;
grant execute on function perf_results(text) to authenticated, service_role;
grant execute on function perf_list(text) to authenticated, service_role;

-- ---------- 4) HR ปรับผล ----------
create or replace function perf_adjust(p_assignment uuid, p_total numeric, p_grade text, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a perf_assignments; r record; v_bands jsonb;
begin
  if not is_hr_admin() then raise exception 'เฉพาะ HR'; end if;
  select * into a from perf_assignments where id = p_assignment for update;
  if a.id is null then raise exception 'ไม่พบใบประเมิน'; end if;
  select * into r from perf_list(a.cycle_id) l where l.assignment_id = a.id;
  perform set_config('perf.calc', jsonb_build_object('calc_total', r.calc_total, 'calc_grade', r.calc_grade)::text, true);
  if p_total is null and coalesce(btrim(p_grade), '') = '' then
    update perf_assignments set adj_total = null, adj_grade = null, adj_reason = nullif(btrim(p_reason), ''),
           adj_by = auth.jwt()->>'email', adj_at = now(), updated_at = now() where id = a.id;
    return jsonb_build_object('ok', true, 'cleared', true);
  end if;
  if coalesce(btrim(p_reason), '') = '' then raise exception 'ปรับผลต้องเขียนเหตุผล'; end if;
  if not a.eligible then raise exception 'พนักงานคนนี้ไม่อยู่ในรอบประเมิน'; end if;
  if not r.complete then raise exception 'ใบนี้ยังให้คะแนนไม่ครบ — ปรับผลได้หลังให้คะแนนครบ'; end if;
  if p_total is not null and (p_total < -100 or p_total > 100) then raise exception 'คะแนนต้องอยู่ระหว่าง -100 ถึง 100'; end if;
  select config->'bands' into v_bands from perf_cycles where id = a.cycle_id;
  if nullif(btrim(p_grade), '') is not null and not exists (select 1 from jsonb_array_elements(v_bands) b where b->>1 = btrim(p_grade)) then
    raise exception 'ไม่มีเกรด % ในเกณฑ์ของรอบนี้', p_grade;
  end if;
  update perf_assignments set adj_total = round(p_total, 1), adj_grade = nullif(btrim(p_grade), ''), adj_reason = btrim(p_reason),
         adj_by = auth.jwt()->>'email', adj_at = now(), updated_at = now() where id = a.id;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function perf_adjust(uuid, numeric, text, text) from public, anon;
grant execute on function perf_adjust(uuid, numeric, text, text) to authenticated;

-- ---------- 5) ใบประเมิน: แนบรายการหักคะแนนและประวัติ ----------
create or replace function perf_get_form(p_assignment uuid)
 returns jsonb language plpgsql stable security definer set search_path = public as $function$
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
                'open_to', open_to, 'is_open', perf_cycle_is_open(id), 'config', config,
                'period_start', period_start, 'period_end', period_end) from perf_cycles where id = a.cycle_id),
    -- หมายเหตุใบเตือนเห็นเฉพาะ HR (บัญชีหน่วยงานเห็นประเภทและคะแนนที่หัก)
    'deductions', coalesce((select jsonb_agg(jsonb_build_object('kind', d.kind, 'qty', d.qty, 'points', d.points, 'source', d.source,
        'waived', d.waived, 'note', case when v_hr then d.note end) order by d.kind)
      from perf_deductions d where d.cycle_id = a.cycle_id and d.employee_id = a.employee_id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('at', ev.at, 'actor', ev.actor, 'action', ev.action,
        'from', ev.from_status, 'to', ev.to_status, 'note', ev.note, 'data', ev.data) order by ev.at)
      from perf_events ev where ev.assignment_id = a.id), '[]'::jsonb),
    'can_edit', v_eval and a.status in ('pending','draft','returned') and (v_hr or perf_cycle_is_open(a.cycle_id)),
    'can_review', (v_hr or (a.reviewer_id is not null and a.reviewer_id = perf_my_emp_id())) and a.status = 'submitted',
    'is_hr', v_hr) into v;
  return v;
end $function$;
