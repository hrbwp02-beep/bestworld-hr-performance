-- 04/11/2569 (ต่อ) perf_list แสดงสาย/ใครกรอก · ใบประเมินแสดงคะแนนเดิมก่อนผู้จัดการแก้ · สร้างใบใหม่ใช้สายการประเมิน

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
               excluded boolean, excluded_reason text,
               line_id uuid, line_name text, evaluator_registered boolean, reviewer_registered boolean, fill_by text, revised_items integer)
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
    ex.employee_id is not null, ex.reason,
    lm.line_id, pl.name,
    perf_reviewer_has_account(a.evaluator_id), perf_reviewer_has_account(a.reviewer_id),
    -- ใครกรอกใบนี้: ผู้ประเมินตามสาย (ลงทะเบียนแล้ว) · บัญชีหน่วยงาน (แทนผู้ประเมินที่ยังไม่ลงทะเบียน) · HR
    case when a.evaluator_id is not null and perf_reviewer_has_account(a.evaluator_id) then 'evaluator'
         when a.level not in ('supervisor','manager')
          and not exists (select 1 from hr_departments hd where hd.id = e.dept and a.employee_id in (coalesce(hd.supervisor_id, ''), coalesce(hd.manager_id, '')))
         then 'dept'
         else 'hr' end,
    (select count(*)::int from perf_scores s where s.assignment_id = a.id and s.orig_rating is not null and s.orig_rating <> s.rating)
  from perf_results(p_cycle) r
  join perf_assignments a on a.id = r.assignment_id
  join employees e on e.id = a.employee_id
  left join hr_departments d on d.id = e.dept
  left join jd_library j on j.id = a.jd_id
  left join employees ev on ev.id = a.evaluator_id
  left join employees rv on rv.id = a.reviewer_id
  left join perf_exclusions ex on ex.employee_id = a.employee_id
  left join perf_line_members lm on lm.employee_id = a.employee_id
  left join perf_lines pl on pl.id = lm.line_id
  order by e.dept, e.id
$function$;
revoke all on function perf_list(text) from public, anon;
grant execute on function perf_list(text) to authenticated, service_role;

create or replace function public.perf_get_form(p_assignment uuid)
 returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
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
        'standard', i.standard, 'weight', i.weight, 'rating', s.rating, 'note', s.note,
        'orig_rating', s.orig_rating, 'orig_note', s.orig_note, 'revise_note', s.revise_note,
        'revised_by', coalesce((select name from employees where id = s.revised_by), s.revised_by), 'revised_at', s.revised_at)
        order by i.section, i.seq)
      from perf_items(a.id) i left join perf_scores s on s.assignment_id = a.id and s.item_id = i.item_id), '[]'::jsonb),
    'cycle', (select jsonb_build_object('id', id, 'name', name, 'status', status, 'open_from', open_from,
                'open_to', open_to, 'is_open', perf_cycle_is_open(id), 'config', config,
                'period_start', period_start, 'period_end', period_end) from perf_cycles where id = a.cycle_id),
    'deductions', coalesce((select jsonb_agg(jsonb_build_object('kind', d.kind, 'qty', d.qty, 'points', d.points, 'source', d.source,
        'waived', d.waived, 'note', case when v_hr then d.note end) order by d.kind)
      from perf_deductions d where d.cycle_id = a.cycle_id and d.employee_id = a.employee_id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('at', ev.at, 'actor', ev.actor, 'action', ev.action,
        'from', ev.from_status, 'to', ev.to_status, 'note', ev.note, 'data', ev.data) order by ev.at)
      from perf_events ev where ev.assignment_id = a.id), '[]'::jsonb),
    'can_edit', v_eval and a.status in ('pending','draft','returned') and (v_hr or perf_cycle_is_open(a.cycle_id)),
    'can_review', (v_hr or (a.reviewer_id is not null and a.reviewer_id = perf_my_emp_id())) and a.status = 'submitted',
    'is_reviewer', a.reviewer_id is not null and a.reviewer_id = perf_my_emp_id(),
    'is_hr', v_hr) into v;
  return v;
end $function$;

-- สร้าง/คำนวณใบใหม่ → ใช้สายการประเมินทับผู้ประเมินค่าเริ่มต้น
do $$
declare d text;
begin
  d := pg_get_functiondef('public.perf_generate(text,boolean)'::regprocedure);
  if position('perf_apply_lines' in d) = 0 then
    d := replace(d, '  return jsonb_build_object(''ok'', true, ''created'', n_new, ''refreshed'', n_upd);',
                    '  perform perf_apply_lines(p_cycle);   -- สายการประเมินมาก่อนค่าเริ่มต้นจากหน่วยงาน
  return jsonb_build_object(''ok'', true, ''created'', n_new, ''refreshed'', n_upd);');
    execute d;
  end if;
end $$;

-- นำสายไปใช้กับรอบ 2569 ตอนนี้ (ไม่แตะใบที่อนุมัติแล้ว)
update perf_assignments a set evaluator_id = c.ev, reviewer_id = c.rv, updated_at = now()
  from perf_assignments a2 cross join lateral perf_line_chain(a2.employee_id) c
 where a2.id = a.id and a.cycle_id = '2569' and a.status <> 'approved'
   and (a.evaluator_id is distinct from c.ev or a.reviewer_id is distinct from c.rv);
