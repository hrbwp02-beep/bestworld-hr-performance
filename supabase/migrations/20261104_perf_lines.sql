-- 04/11/2569 สายการประเมิน (แบบ Bplus) + ผู้จัดการแก้คะแนนได้ (เก็บของเดิมไว้ตรวจสอบ) + แจ้งเตือนในสาย
-- HR สั่ง: ส่วนงานย่อยตามรายชื่อหน่วยงาน Bplus · ไม่มีหัวหน้า = ผู้จัดการประเมินตรง · ผู้จัดการแก้คะแนนเองได้ ·
--          บัญชีรายบุคคลให้ลงทะเบียนเอง (Edge Function perf-register) · โลจิสติกส์ย่อยเป็น ขนส่ง / คลังสินค้า
-- ตารางใหม่เป็นของระบบประเมิน (perf_*) ไม่แตะ hr_departments/employees ที่ใช้ร่วมกับแอปอื่น

-- ---------- 1) สายการประเมิน ----------
create table if not exists perf_lines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  dept text references hr_departments(id),
  evaluator1_id text references employees(id),   -- ผู้ประเมินคนที่ 1 (หัวหน้าส่วนงาน) — ว่าง = ผู้ประเมินคนที่ 2 ประเมินตรง
  evaluator2_id text references employees(id),   -- ผู้ประเมินคนที่ 2 (ผู้จัดการ) — ตรวจ/แก้คะแนน/อนุมัติ ก่อนถึง HR
  sort int not null default 0,
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists perf_line_members (
  employee_id text primary key references employees(id) on delete cascade,   -- 1 คนอยู่ได้ 1 สาย
  line_id uuid not null references perf_lines(id) on delete cascade,
  updated_by text,
  updated_at timestamptz not null default now()
);
create index if not exists perf_line_members_line_idx on perf_line_members (line_id);
alter table perf_lines enable row level security;
alter table perf_line_members enable row level security;
drop policy if exists "hr" on perf_lines;
create policy "hr" on perf_lines for all to authenticated using (is_hr_admin()) with check (is_hr_admin());
drop policy if exists "hr" on perf_line_members;
create policy "hr" on perf_line_members for all to authenticated using (is_hr_admin()) with check (is_hr_admin());

-- ---------- 2) สายเริ่มต้นตามรายชื่อหน่วยงาน Bplus (HR ลากย้ายคนได้ภายหลัง) ----------
do $$
declare L jsonb := '[
  ["01 บริหาร","mgmt",null,null],
  ["02 ทรัพยากรบุคคล","hr","110002",null],
  ["02-1 คนขับรถผู้บริหาร","hr","110002",null],
  ["02-2 แม่บ้านผู้บริหาร","hr","110002",null],
  ["02-3 แม่บ้าน/พ่อบ้าน","hr","110002",null],
  ["02-4 ส่วนงานความปลอดภัย","hr","110002",null],
  ["02-5 ส่วนยื่นงานราชการ","hr","110002",null],
  ["03 บัญชีการเงินและต้นทุน","fin","120001",null],
  ["04 จัดซื้อ","purch","120001",null],
  ["05 ขายและการตลาด","sales","180034","110002"],
  ["06 ขนส่ง","wh","110004","110002"],
  ["07 คลังสินค้า","wh","120035","110002"],
  ["08 วางแผนการผลิต","plan","120025",null],
  ["09 ผลิต (หัวหน้างาน/ส่วนกลาง)","prod","120035",null],
  ["09-1 ผลิต ส่วนงานเป่า","prod","180008","120035"],
  ["09-2 ผลิต ส่วนงานกรอฟิล์ม","prod","120035",null],
  ["09-3 ผลิต ส่วนงานผสมเม็ด","prod","120035",null],
  ["09-4 ผลิต ส่วนงานพิมพ์","prod","180120","120035"],
  ["09-5 ผลิต ส่วนงานสลิท","prod","120035",null],
  ["09-6 ผลิต ส่วนงานแกน","prod","120035",null],
  ["09-7 ผลิต ส่วนงานโรงซีล","prod","120035",null],
  ["10 ระบบคุณภาพ","qa","180019","110002"],
  ["11 วิจัยและพัฒนาผลิตภัณฑ์","rnd","110003",null],
  ["12 ซ่อมบำรุง","eng","180009","120025"],
  ["ผู้จัดการฝ่าย (HR ประเมิน)","mgmt",null,null]
]'::jsonb; x jsonb; i int := 0;
begin
  if exists (select 1 from perf_lines) then return; end if;
  for x in select * from jsonb_array_elements(L) loop
    i := i + 1;
    insert into perf_lines (name, dept, evaluator1_id, evaluator2_id, sort)
    values (x->>0, x->>1, nullif(x->>2, ''), nullif(x->>3, ''), i * 10);
  end loop;
end $$;

-- สมาชิกเริ่มต้น: จัดจากชื่อตำแหน่ง (ตามลำดับ) — ไม่ตรงข้อไหนเข้าสายหลักของหน่วยงาน
insert into perf_line_members (employee_id, line_id, updated_by)
select e.id, l.id, 'system'
  from employees e
  cross join lateral (
    select case
      when e.id in ('120035','120025','120001') or e.position like 'ผู้จัดการ%' then 'ผู้จัดการฝ่าย (HR ประเมิน)'
      when e.dept = 'mgmt' then '01 บริหาร'
      when e.position like '%ส่วนงานแกน%' then '09-6 ผลิต ส่วนงานแกน'
      when e.dept = 'prod' and e.position like '%เป่า%' and e.position not like 'หัวหน้า%' then '09-1 ผลิต ส่วนงานเป่า'
      when e.dept = 'prod' and e.position like '%กรอ%' then '09-2 ผลิต ส่วนงานกรอฟิล์ม'
      when e.dept = 'prod' and e.position like '%ผสมเม็ด%' then '09-3 ผลิต ส่วนงานผสมเม็ด'
      when e.dept = 'prod' and e.position like '%พิมพ์%' and e.position not like 'หัวหน้า%' then '09-4 ผลิต ส่วนงานพิมพ์'
      when e.dept = 'prod' and e.position like '%สลิท%' then '09-5 ผลิต ส่วนงานสลิท'
      when e.dept = 'prod' and e.position like '%โรงซีล%' then '09-7 ผลิต ส่วนงานโรงซีล'
      when e.id = '180008' then '09-1 ผลิต ส่วนงานเป่า'      -- หัวหน้าอยู่ในสายตัวเอง → ระบบให้ผู้ประเมินคนที่ 2 ประเมินแทน
      when e.id = '180120' then '09-4 ผลิต ส่วนงานพิมพ์'
      when e.dept = 'prod' then '09 ผลิต (หัวหน้างาน/ส่วนกลาง)'
      when e.dept = 'wh' and e.position like '%ขนส่ง%' then '06 ขนส่ง'
      when e.dept = 'wh' then '07 คลังสินค้า'
      when e.dept = 'hr' and e.position like '%ขับรถผู้บริหาร%' then '02-1 คนขับรถผู้บริหาร'
      when e.dept = 'hr' and e.position like '%ทำความสะอาด%' then '02-3 แม่บ้าน/พ่อบ้าน'
      when e.dept = 'hr' and e.position like '%จป%' then '02-4 ส่วนงานความปลอดภัย'
      when e.dept = 'hr' then '02 ทรัพยากรบุคคล'
      when e.dept = 'fin' then '03 บัญชีการเงินและต้นทุน'
      when e.dept = 'purch' then '04 จัดซื้อ'
      when e.dept = 'sales' then '05 ขายและการตลาด'
      when e.dept = 'plan' then '08 วางแผนการผลิต'
      when e.dept = 'qa' then '10 ระบบคุณภาพ'
      when e.dept = 'rnd' then '11 วิจัยและพัฒนาผลิตภัณฑ์'
      when e.dept = 'eng' then '12 ซ่อมบำรุง'
    end lname) m
  join perf_lines l on l.name = m.lname
 where upper(coalesce(e.employment_status, 'ACTIVE')) in ('ACTIVE','PROBATION','ON_LEAVE','SUSPENDED')
on conflict (employee_id) do nothing;

-- ---------- 3) ผู้ประเมินตามสาย ----------
-- ev = คนกรอกคะแนน · rv = ผู้ประเมินคนที่ 2 (ตรวจ/แก้/อนุมัติ) · คนในสายที่เป็นผู้ประเมินเอง ข้ามไปให้คนถัดไป (กันประเมินตัวเอง)
create or replace function perf_line_chain(p_emp text)
returns table(line_id uuid, line_name text, ev text, rv text)
language sql stable security definer set search_path = public as $$
  select l.id, l.name,
    case when coalesce(l.evaluator1_id, l.evaluator2_id) = p_emp
         then case when l.evaluator2_id is distinct from p_emp then l.evaluator2_id end
         else coalesce(l.evaluator1_id, l.evaluator2_id) end,
    case when l.evaluator1_id is not null and l.evaluator1_id <> p_emp
          and l.evaluator2_id is not null and l.evaluator2_id <> l.evaluator1_id and l.evaluator2_id <> p_emp
         then l.evaluator2_id end
    from perf_line_members m join perf_lines l on l.id = m.line_id and l.active
   where m.employee_id = p_emp
$$;

-- นำสายไปใช้กับใบประเมินของรอบ (ยกเว้นใบที่ HR อนุมัติแล้ว)
create or replace function perf_apply_lines(p_cycle text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_hr_admin() then raise exception 'เฉพาะ HR'; end if;
  update perf_assignments a set evaluator_id = c.ev, reviewer_id = c.rv, updated_at = now()
    from perf_assignments a2 cross join lateral perf_line_chain(a2.employee_id) c
   where a2.id = a.id and a.cycle_id = p_cycle and a.status <> 'approved'
     and (a.evaluator_id is distinct from c.ev or a.reviewer_id is distinct from c.rv);
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'updated', n);
end $$;
revoke all on function perf_apply_lines(text) from public, anon;
grant execute on function perf_apply_lines(text) to authenticated;

-- ---------- 4) ใครกรอกใบได้ ----------
create or replace function perf_acct_email(p_emp text)
returns text language sql stable security definer set search_path = public as $$
  select lower(email) from app_users where p_emp is not null and employee_id = p_emp and active order by created_at limit 1
$$;

-- ผู้ประเมินตามสายที่ลงทะเบียนแล้ว = กรอกเอง · ยังไม่ลงทะเบียน = บัญชีหน่วยงานกรอกแทนได้ (ไม่รวมหัวหน้า/ผู้จัดการ) · นอกนั้น HR
create or replace function public.perf_can_eval(p_assignment uuid)
 returns boolean language sql stable security definer set search_path to 'public' as $function$
  select coalesce((
    select is_hr_admin()
        or (a.evaluator_id is not null and a.evaluator_id = perf_my_emp_id())
        or (app_role() in ('manager','supervisor') and in_my_scope(e.dept)
            and not perf_reviewer_has_account(a.evaluator_id)
            and a.level not in ('supervisor','manager')
            and not exists (select 1 from hr_departments d
                             where d.id = e.dept and a.employee_id in (coalesce(d.supervisor_id, ''), coalesce(d.manager_id, ''))))
      from perf_assignments a join employees e on e.id = a.employee_id
     where a.id = p_assignment), false)
$function$;

-- ใครดูใบได้: ผู้กรอก · ผู้ประเมินคนที่ 2 · บัญชีหน่วยงานดูใบในหน่วยงานตน (ดูอย่างเดียวเมื่อผู้ประเมินลงทะเบียนแล้ว)
create or replace function public.perf_can_see(p_assignment uuid)
 returns boolean language sql stable security definer set search_path to 'public' as $function$
  select coalesce((
    select perf_can_eval(a.id)
        or (a.reviewer_id is not null and a.reviewer_id = perf_my_emp_id())
        or (app_role() in ('manager','supervisor') and in_my_scope(e.dept)
            and a.level not in ('supervisor','manager')
            and not exists (select 1 from hr_departments d
                             where d.id = e.dept and a.employee_id in (coalesce(d.supervisor_id, ''), coalesce(d.manager_id, ''))))
      from perf_assignments a join employees e on e.id = a.employee_id
     where a.id = p_assignment), false)
$function$;

-- โหมดทดลอง: บัญชีรายบุคคลที่เป็นผู้ประเมิน/ผู้อนุมัติของพนักงานในหน่วยงานที่เปิดทดลอง ก็เข้าได้
create or replace function public.perf_cycle_is_open(p_cycle text)
 returns boolean language sql stable security definer set search_path to 'public' as $function$
  select coalesce((
    select (c.status = 'open' and perf_today() between c.open_from and c.open_to)
        or (perf_today() <= coalesce((c.config->'trial'->>'until')::date, date '1900-01-01')
            and (exists (select 1 from jsonb_array_elements_text(coalesce(c.config->'trial'->'depts', '[]'::jsonb)) d where in_my_scope(d))
              or exists (select 1 from perf_assignments a join employees e on e.id = a.employee_id
                          where a.cycle_id = c.id and perf_my_emp_id() is not null
                            and perf_my_emp_id() in (coalesce(a.evaluator_id, ''), coalesce(a.reviewer_id, ''))
                            and c.config->'trial'->'depts' ? e.dept)))
      from perf_cycles c where c.id = p_cycle), false)
$function$;

-- ---------- 5) ผู้จัดการแก้คะแนน (เก็บคะแนนเดิมของผู้ประเมินคนที่ 1 ไว้ถาวร) ----------
alter table perf_scores
  add column if not exists orig_rating smallint,
  add column if not exists orig_note text,
  add column if not exists revise_note text,
  add column if not exists revised_by text,
  add column if not exists revised_at timestamptz;

create or replace function perf_review_save(p_assignment uuid, p_scores jsonb, p_comment text default null, p_approve boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a perf_assignments; v_hr boolean := is_hr_admin(); v_me text := coalesce(perf_my_emp_id(), auth.jwt()->>'email');
        r jsonb; cur perf_scores; v_new smallint; n int := 0; v_title text;
begin
  select * into a from perf_assignments where id = p_assignment for update;
  if a.id is null then raise exception 'ไม่พบใบประเมิน'; end if;
  if not (v_hr or (a.reviewer_id is not null and a.reviewer_id = perf_my_emp_id())) then
    raise exception 'คุณไม่ใช่ผู้ประเมินคนที่ 2 ของใบนี้';
  end if;
  if not (a.status = 'submitted' or (v_hr and a.status = 'reviewed')) then
    raise exception 'ใบนี้ไม่ได้อยู่ในขั้นรอผู้ประเมินคนที่ 2';
  end if;
  for r in select * from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb)) loop
    select * into cur from perf_scores where assignment_id = a.id and item_id = r->>'item_id';
    v_new := nullif(r->>'rating', '')::smallint;
    if cur.assignment_id is null or v_new is null or v_new = cur.rating then continue; end if;
    if v_new not between 1 and 5 then raise exception 'ระดับต้องเป็น 1–5'; end if;
    if coalesce(btrim(r->>'note'), '') = '' then raise exception 'แก้คะแนนต้องเขียนเหตุผลทุกข้อที่แก้'; end if;
    select title into v_title from perf_items(a.id) i where i.item_id = cur.item_id;
    update perf_scores set orig_rating = coalesce(orig_rating, rating), orig_note = case when orig_rating is null then note else orig_note end,
           rating = v_new, revise_note = btrim(r->>'note'), revised_by = v_me, revised_at = now(), updated_at = now()
     where assignment_id = a.id and item_id = cur.item_id;
    insert into perf_events (assignment_id, actor, action, note, data)
    values (a.id, coalesce(auth.jwt()->>'email', v_me), 'revise', btrim(r->>'note'),
            jsonb_build_object('item_id', cur.item_id, 'title', v_title, 'from', cur.rating, 'to', v_new, 'orig', coalesce(cur.orig_rating, cur.rating)));
    n := n + 1;
  end loop;
  if p_approve then
    update perf_assignments set status = 'reviewed', reviewed_at = now(),
           reviewer_comment = coalesce(nullif(btrim(p_comment), ''), reviewer_comment), updated_at = now()
     where id = a.id and status = 'submitted';
  elsif nullif(btrim(p_comment), '') is not null then
    update perf_assignments set reviewer_comment = btrim(p_comment), updated_at = now() where id = a.id;
  end if;
  return jsonb_build_object('ok', true, 'revised', n);
end $$;
revoke all on function perf_review_save(uuid, jsonb, text, boolean) from public, anon;
grant execute on function perf_review_save(uuid, jsonb, text, boolean) to authenticated;

-- รายงานการแก้คะแนนโดยผู้ประเมินคนที่ 2
create or replace function perf_revisions(p_cycle text)
returns table(assignment_id uuid, doc_no text, employee_id text, name text, dept_name text, section text, title text,
              orig_rating smallint, rating smallint, revise_note text, revised_by text, revised_by_name text, revised_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.id, a.doc_no, a.employee_id, e.name, d.name, i.section, i.title, s.orig_rating, s.rating, s.revise_note, s.revised_by,
         coalesce((select name from employees where id = s.revised_by), s.revised_by), s.revised_at
    from perf_assignments a
    join employees e on e.id = a.employee_id
    left join hr_departments d on d.id = e.dept
    join perf_scores s on s.assignment_id = a.id and s.orig_rating is not null and s.orig_rating <> s.rating
    left join lateral (select * from perf_items(a.id) x where x.item_id = s.item_id) i on true
   where a.cycle_id = p_cycle and perf_can_see(a.id)
   order by s.revised_at desc
$$;
revoke all on function perf_revisions(text) from public, anon;
grant execute on function perf_revisions(text) to authenticated;

-- ---------- 6) แจ้งเตือนในสาย (กระดิ่ง) ----------
create or replace function perf_assign_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare v_name text; v_to text; v_title text; v_body text; v_rev int;
begin
  if new.status is not distinct from old.status then return new; end if;
  select name into v_name from employees where id = new.employee_id;
  if new.status = 'submitted' then
    v_to := perf_acct_email(new.reviewer_id); v_title := 'ใบประเมินรอคุณตรวจ/อนุมัติ';
    v_body := v_name || ' · ' || new.doc_no || ' — เข้าเมนู ศูนย์อนุมัติ';
  elsif new.status = 'returned' then
    v_to := perf_acct_email(new.evaluator_id); v_title := 'ใบประเมินถูกตีกลับให้แก้';
    v_body := v_name || ' · ' || new.doc_no || coalesce(' — ' || coalesce(new.hr_comment, new.reviewer_comment), '');
  elsif new.status = 'reviewed' and old.status = 'submitted' then
    select count(*) into v_rev from perf_scores where assignment_id = new.id and orig_rating is not null and orig_rating <> rating;
    v_to := perf_acct_email(new.evaluator_id);
    v_title := case when v_rev > 0 then 'ผู้จัดการแก้คะแนน ' || v_rev || ' ข้อ แล้วอนุมัติ' else 'ผู้จัดการอนุมัติใบประเมินแล้ว' end;
    v_body := v_name || ' · ' || new.doc_no || ' — ส่งต่อ HR แล้ว';
  end if;
  if v_to is not null and v_to <> lower(coalesce(auth.jwt()->>'email', '')) then
    insert into notifications (type, title, body, recipient_email, created_at, read) values ('info', v_title, v_body, v_to, now(), false);
  end if;
  return new;
end $$;
drop trigger if exists trg_perf_assign_notify on perf_assignments;
create trigger trg_perf_assign_notify after update on perf_assignments for each row execute function perf_assign_notify();

-- ---------- 7) การลงทะเบียนด้วยตนเอง (Edge Function perf-register ใช้) ----------
create table if not exists perf_register_attempts (
  id bigserial primary key, employee_id text, ok boolean, at timestamptz not null default now()
);
alter table perf_register_attempts enable row level security;   -- ไม่มี policy: service role เท่านั้น
