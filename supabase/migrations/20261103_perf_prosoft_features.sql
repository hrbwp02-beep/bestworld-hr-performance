-- 03/11/2569 ฟีเจอร์เพิ่มตามคุณสมบัติ Prosoft HCM
-- 1) ส่วนที่น้ำหนัก 0 ในระดับตำแหน่งนั้น ไม่อยู่ในใบ (เลือกประเมินเฉพาะบางแบบได้)
-- 2) perf_recall: ผู้ประเมินดึงใบที่ส่งแล้ว (ยังไม่อนุมัติ) กลับมาแก้
-- 3) perf_gap: วิเคราะห์ Gap ระดับที่ได้ เทียบระดับที่คาดหวัง (3) รายหัวข้อ × หน่วยงาน
-- 4) perf_notify_pending: HR ส่งแจ้งเตือนในระบบ ถึงบัญชีหน่วยงานที่ยังมีใบรอให้คะแนน

create or replace function public.perf_items(p_assignment uuid)
 returns table(item_id text, section text, seq integer, title text, standard text, weight numeric)
 language sql stable security definer set search_path to 'public' as $function$
  with w as (
    select a.level, c.config->'weights'->a.level wt
      from perf_assignments a join perf_cycles c on c.id = a.cycle_id where a.id = p_assignment),
  x as (
    select i.id::text item_id, 'A' section, i.seq, i.title, i.standard, i.weight
      from perf_assignments a join perf_jd_items i on i.jd_id = a.jd_id and i.section = 'A' where a.id = p_assignment
    union all
    select i.id::text, 'B', i.seq, i.title, i.standard, i.weight
      from perf_assignments a join perf_jd_items i on i.jd_id = a.jd_id and i.section = 'B'
     where a.id = p_assignment and a.level in ('ops','office')
    union all
    select c.id, 'B', c.seq, c.title, c.standard, 1::numeric
      from perf_assignments a cross join perf_common_items c
     where a.id = p_assignment and a.level in ('supervisor','manager') and c.kind = 'lead'
    union all
    select c.id, 'C', c.seq, c.title, c.standard, 1::numeric
      from perf_common_items c where c.kind = 'core' and exists (select 1 from perf_assignments where id = p_assignment))
  select x.* from x cross join w
   where coalesce((w.wt->>x.section)::numeric, 1) > 0
$function$;

create or replace function perf_recall(p_assignment uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a perf_assignments;
begin
  select * into a from perf_assignments where id = p_assignment for update;
  if a.id is null then raise exception 'ไม่พบใบประเมิน'; end if;
  if not perf_can_eval(p_assignment) then raise exception 'บัญชีนี้ไม่ใช่ผู้ประเมินของใบนี้'; end if;
  if a.status not in ('submitted','reviewed') then raise exception 'ดึงกลับได้เฉพาะใบที่ส่งแล้วแต่ยังไม่อนุมัติ'; end if;
  if not is_hr_admin() and not perf_cycle_is_open(a.cycle_id) then raise exception 'ตอนนี้ไม่อยู่ในช่วงเปิดรับประเมิน'; end if;
  update perf_assignments set status = 'draft', submitted_at = null, reviewed_at = null, updated_at = now() where id = p_assignment;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function perf_recall(uuid) from public, anon;
grant execute on function perf_recall(uuid) to authenticated;

create or replace function perf_gap(p_cycle text)
returns table(section text, title text, dept text, dept_name text, n_rated integer, avg_rating numeric, gap numeric, n_below integer, n_above integer)
language sql stable security definer set search_path = public as $$
  select i.section, i.title, e.dept, d.name, count(s.rating)::int, round(avg(s.rating), 2), round(avg(s.rating) - 3, 2),
         count(*) filter (where s.rating < 3)::int, count(*) filter (where s.rating > 3)::int
    from perf_assignments a
    join employees e on e.id = a.employee_id
    left join hr_departments d on d.id = e.dept
    cross join lateral perf_items(a.id) i
    join perf_scores s on s.assignment_id = a.id and s.item_id = i.item_id
   where a.cycle_id = p_cycle and a.eligible and perf_can_see(a.id)
     and not exists (select 1 from perf_exclusions x where x.employee_id = a.employee_id)
   group by i.section, i.title, e.dept, d.name
$$;
revoke all on function perf_gap(text) from public, anon;
grant execute on function perf_gap(text) to authenticated;

create or replace function perf_notify_pending(p_cycle text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c perf_cycles; u record; n int := 0; k int;
begin
  if not is_hr_admin() then raise exception 'เฉพาะ HR'; end if;
  select * into c from perf_cycles where id = p_cycle;
  for u in select email, case when jsonb_typeof(dept_scope) = 'array' and jsonb_array_length(dept_scope) > 0
                         then array(select jsonb_array_elements_text(dept_scope)) else array[dept] end depts from app_users
            where active and role in ('manager','supervisor') and email is not null loop
    -- นับเฉพาะใบที่บัญชีหน่วยงานประเมินได้ (ไม่รวมหัวหน้า/ผู้จัดการที่ HR กรอก)
    select count(*) into k from perf_assignments a join employees e on e.id = a.employee_id
     where a.cycle_id = p_cycle and a.eligible and a.status in ('pending','draft','returned')
       and e.dept = any(u.depts) and a.level not in ('supervisor','manager')
       and not exists (select 1 from hr_departments d where d.id = e.dept and a.employee_id in (coalesce(d.supervisor_id, ''), coalesce(d.manager_id, '')))
       and not exists (select 1 from perf_exclusions x where x.employee_id = a.employee_id);
    if k > 0 then
      insert into notifications (type, title, body, recipient_email, created_at, read)
      values ('warn', 'ใบประเมินรอให้คะแนน ' || k || ' ใบ',
              c.name || ' · ปิดรับประเมิน ' || to_char(c.open_to, 'DD/MM/') || (extract(year from c.open_to)::int + 543) || ' — เข้าเมนู งานของฉัน',
              lower(u.email), now(), false);
      n := n + 1;
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'accounts', n);
end $$;
revoke all on function perf_notify_pending(text) from public, anon;
grant execute on function perf_notify_pending(text) to authenticated;
