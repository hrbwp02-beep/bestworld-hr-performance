-- ระบบประเมินประจำปีแบบใหม่ (ประเมินตาม JD เพื่อคิดโบนัส/ขึ้นเงินเดือน) — 19/10/2569
-- ออกแบบตามเอกสาร "ระบบประเมินผลประจำปี (ฉบับออกแบบใหม่)" และเกณฑ์บริษัทปี 2568
-- ตารางใหม่ทั้งหมดขึ้นต้น perf_ ไม่แก้ตารางเดิมที่แอปอื่นใช้ (employees, hr_departments, app_users อ่านอย่างเดียว)
--
-- คะแนนรวม (เต็ม 100) = ผลงาน 0.9 × [70 + (ระดับเฉลี่ย − 3) × 15]  (ถ่วงน้ำหนัก A/B/C ตามระดับตำแหน่ง)
--                      + การมาทำงาน (10 − หักการลา/มาสาย/ขาดงาน) − หักใบเตือน
-- เกรดตามช่วงปี 2568 · โบนัสตามเกรดปี 2568 · ขึ้นเงินเดือน 3% (F และอายุงาน < 1 ปีไม่ปรับ)

-- ===================== ตาราง =====================
create table if not exists public.perf_cycles (
  id text primary key,                       -- เช่น '2569'
  name text not null,
  year_th int not null,
  period_start date not null,                -- ช่วงผลงานที่ประเมิน
  period_end date not null,
  open_from date not null,                   -- เปิดรับประเมิน
  open_to date not null,
  eligible_cutoff date not null,             -- ต้องพ้นทดลองงาน (119 วัน) ณ วันนี้
  raise_effective date,                      -- เงินเดือนใหม่มีผล
  bonus_pay date,                            -- วันจ่ายโบนัส
  new_salary_pay date,                       -- จ่ายเงินเดือนใหม่ครั้งแรก
  status text not null default 'draft' check (status in ('draft','open','closed','final')),
  config jsonb not null default '{}'::jsonb, -- น้ำหนัก ช่วงเกรด โบนัส % ขึ้นเงิน คะแนนหัก
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- หัวข้อที่ใช้ร่วมทั้งบริษัท: C พฤติกรรมหลัก (core) · B ภาวะผู้นำ (lead) สำหรับหัวหน้าขึ้นไป
create table if not exists public.perf_common_items (
  id text primary key,
  kind text not null check (kind in ('core','lead')),
  seq int not null,
  title text not null,
  standard text                              -- มาตรฐานระดับ 3
);

-- หัวข้อตาม JD: A งานตามหน้าที่ · B ทักษะงาน (ใช้กับพนักงาน/เจ้าหน้าที่)
create table if not exists public.perf_jd_items (
  id uuid primary key default gen_random_uuid(),
  jd_id text not null,
  section text not null check (section in ('A','B')),
  seq int not null default 1,
  title text not null,
  standard text,                             -- มาตรฐานระดับ 3 (ทำได้ตามที่คาดหวัง)
  weight numeric not null default 1 check (weight > 0),
  kpi_ref text,                              -- จุดเชื่อม KPI ในอนาคต (ยังไม่ใช้คิดคะแนน)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists perf_jd_items_jd on public.perf_jd_items (jd_id, section, seq);

-- ใบประเมิน 1 ใบต่อคนต่อรอบ
create table if not exists public.perf_assignments (
  id uuid primary key default gen_random_uuid(),
  cycle_id text not null references public.perf_cycles(id) on delete cascade,
  employee_id text not null references public.employees(id) on delete cascade,
  level text not null default 'ops' check (level in ('ops','office','supervisor','manager')),
  jd_id text,
  evaluator_id text,                         -- ผู้ประเมิน (หัวหน้าหน่วยงาน · ไม่มีหัวหน้า = ผู้จัดการ)
  reviewer_id text,                          -- ผู้ทบทวน (ผู้จัดการ · ว่าง = ข้ามไป HR)
  eligible boolean not null default true,
  eligible_note text,
  status text not null default 'pending'
    check (status in ('pending','draft','submitted','reviewed','approved','returned')),
  evaluator_comment text,
  reviewer_comment text,
  hr_comment text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz,
  approved_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, employee_id)
);
create index if not exists perf_assignments_evaluator on public.perf_assignments (cycle_id, evaluator_id);
create index if not exists perf_assignments_reviewer on public.perf_assignments (cycle_id, reviewer_id);

-- คะแนนรายข้อ (item_id = id ของ perf_jd_items หรือ perf_common_items)
create table if not exists public.perf_scores (
  assignment_id uuid not null references public.perf_assignments(id) on delete cascade,
  item_id text not null,
  rating smallint not null check (rating between 1 and 5),
  note text,
  updated_by text,
  updated_at timestamptz not null default now(),
  primary key (assignment_id, item_id)
);

-- คะแนนหัก (การลา/มาสาย/ขาดงาน และใบเตือน) — source: timecard/warning = คิดจากระบบ · manual = HR กรอก
create table if not exists public.perf_deductions (
  id uuid primary key default gen_random_uuid(),
  cycle_id text not null references public.perf_cycles(id) on delete cascade,
  employee_id text not null references public.employees(id) on delete cascade,
  kind text not null,
  qty numeric not null default 1,
  points numeric not null,                   -- ติดลบได้ (ใช้ชดเชย เช่น ขาดงานที่รวมในใบเตือนแล้ว)
  source text not null default 'manual' check (source in ('timecard','warning','manual')),
  note text,
  waived boolean not null default false,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists perf_deductions_emp on public.perf_deductions (cycle_id, employee_id);

-- ===================== สิทธิ์ (RLS) =====================
alter table public.perf_cycles enable row level security;
alter table public.perf_common_items enable row level security;
alter table public.perf_jd_items enable row level security;
alter table public.perf_assignments enable row level security;
alter table public.perf_scores enable row level security;
alter table public.perf_deductions enable row level security;

-- อ่านแม่แบบได้ทุกคนที่ล็อกอิน · แก้ได้เฉพาะ HR/admin
create policy "perf_cycles read" on public.perf_cycles for select to authenticated using (true);
create policy "perf_cycles hr" on public.perf_cycles for all to authenticated using (public.is_hr_admin()) with check (public.is_hr_admin());
create policy "perf_common_items read" on public.perf_common_items for select to authenticated using (true);
create policy "perf_common_items hr" on public.perf_common_items for all to authenticated using (public.is_hr_admin()) with check (public.is_hr_admin());
create policy "perf_jd_items read" on public.perf_jd_items for select to authenticated using (true);
create policy "perf_jd_items hr" on public.perf_jd_items for all to authenticated using (public.is_hr_admin()) with check (public.is_hr_admin());

-- ใบประเมิน: HR เห็นทั้งหมด · ผู้ประเมิน/ผู้ทบทวนเห็นเฉพาะใบของตน · เขียนตรงได้เฉพาะ HR (คนอื่นผ่านฟังก์ชันด้านล่าง)
create policy "perf_assignments read" on public.perf_assignments for select to authenticated
  using (public.is_hr_admin() or evaluator_id = public.perf_my_emp_id() or reviewer_id = public.perf_my_emp_id());
create policy "perf_assignments hr" on public.perf_assignments for all to authenticated
  using (public.is_hr_admin()) with check (public.is_hr_admin());
create policy "perf_scores read" on public.perf_scores for select to authenticated
  using (exists (select 1 from public.perf_assignments a where a.id = assignment_id
    and (public.is_hr_admin() or a.evaluator_id = public.perf_my_emp_id() or a.reviewer_id = public.perf_my_emp_id())));
create policy "perf_scores hr" on public.perf_scores for all to authenticated
  using (public.is_hr_admin()) with check (public.is_hr_admin());
create policy "perf_deductions hr" on public.perf_deductions for all to authenticated
  using (public.is_hr_admin()) with check (public.is_hr_admin());

-- ===================== ฟังก์ชันช่วย =====================
-- วันนี้ตามเวลาไทย
create or replace function public.perf_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Bangkok')::date $$;

-- รอบเปิดรับประเมินอยู่ไหม (สถานะ open + อยู่ในช่วงวันที่)
create or replace function public.perf_cycle_is_open(p_cycle text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select status = 'open' and perf_today() between open_from and open_to
                   from perf_cycles where id = p_cycle), false)
$$;

-- ระดับตำแหน่งจากชื่อตำแหน่ง (HR แก้รายคนได้ในใบประเมิน)
create or replace function public.perf_level_of(p_position text) returns text
language sql immutable as $$
  select case
    when coalesce(p_position,'') ~ 'ผู้จัดการ|กรรมการ|ประธาน|ที่ปรึกษา' then 'manager'
    when coalesce(p_position,'') ~ 'หัวหน้า' then 'supervisor'
    when coalesce(p_position,'') ~ 'เจ้าหน้าที่|วิศวกร|วิศกร|เลขา' then 'office'
    else 'ops' end
$$;

-- หัวข้อของใบประเมิน: A จาก JD · B ทักษะจาก JD (พนักงาน/เจ้าหน้าที่) หรือภาวะผู้นำ (หัวหน้าขึ้นไป) · C พฤติกรรมหลัก
create or replace function public.perf_items(p_assignment uuid)
returns table (item_id text, section text, seq int, title text, standard text, weight numeric)
language sql stable security definer set search_path = public as $$
  select i.id::text, 'A', i.seq, i.title, i.standard, i.weight
    from perf_assignments a join perf_jd_items i on i.jd_id = a.jd_id and i.section = 'A'
   where a.id = p_assignment
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
    from perf_common_items c
   where c.kind = 'core' and exists (select 1 from perf_assignments where id = p_assignment)
$$;

-- ผลคำนวณของทุกใบในรอบที่ผู้เรียกมีสิทธิ์เห็น
-- โบนัส/ขึ้นเงินเดือนส่งออกเฉพาะ HR (ผู้ประเมินเห็นแค่คะแนนและเกรด)
create or replace function public.perf_results(p_cycle text)
returns table (
  assignment_id uuid, employee_id text, items_total int, items_rated int,
  avg_a numeric, avg_b numeric, avg_c numeric, perf_pct numeric,
  attendance_points numeric, warning_points numeric, total numeric,
  complete boolean, grade text, bonus_months numeric, bonus_factor numeric, raise_pct numeric)
language sql stable security definer set search_path = public as $$
  with c as (select * from perf_cycles where id = p_cycle),
  a as (
    select pa.*, e.hire_date
      from perf_assignments pa join employees e on e.id = pa.employee_id
     where pa.cycle_id = p_cycle
       and (is_hr_admin() or pa.evaluator_id = perf_my_emp_id() or pa.reviewer_id = perf_my_emp_id())),
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
    (coalesce(cnt.n, 0) > 0 and cnt.nr = cnt.n) as complete,
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
      from perf_deductions dd
     where dd.cycle_id = p_cycle and dd.employee_id = a.employee_id and not dd.waived) d on true
  left join lateral (
    select case when p.pct is null then null
                else round(0.9 * p.pct + 10 - coalesce(d.orange, 0) - coalesce(d.warn, 0), 1) end total) t on true
  left join lateral (
    select b->>1 grade, (b->>2)::numeric months
      from jsonb_array_elements(c.config->'bands') b
     where t.total is not null and round(t.total) >= (b->>0)::numeric
     order by (b->>0)::numeric desc limit 1) g on true
$$;

-- รายการใบประเมินพร้อมข้อมูลพนักงาน (ใช้ทั้งหน้าผู้ประเมิน ผู้ทบทวน และ HR)
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
    case when a.evaluator_id = perf_my_emp_id() then 'evaluator'
         when a.reviewer_id = perf_my_emp_id() then 'reviewer' else 'hr' end,
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

-- ข้อมูลใบประเมิน 1 ใบสำหรับหน้ากรอกคะแนน
create or replace function public.perf_get_form(p_assignment uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare a perf_assignments; v_me text := perf_my_emp_id(); v_hr boolean := is_hr_admin(); v jsonb;
begin
  select * into a from perf_assignments where id = p_assignment;
  if a.id is null then raise exception 'ไม่พบใบประเมิน'; end if;
  if not (v_hr or a.evaluator_id = v_me or a.reviewer_id = v_me) then raise exception 'ไม่มีสิทธิ์ดูใบประเมินนี้'; end if;
  select jsonb_build_object(
    'row', (select to_jsonb(l) from perf_list(a.cycle_id) l where l.assignment_id = a.id),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'item_id', i.item_id, 'section', i.section, 'seq', i.seq, 'title', i.title,
        'standard', i.standard, 'weight', i.weight, 'rating', s.rating, 'note', s.note)
        order by i.section, i.seq)
      from perf_items(a.id) i left join perf_scores s on s.assignment_id = a.id and s.item_id = i.item_id), '[]'::jsonb),
    'cycle', (select jsonb_build_object('id', id, 'name', name, 'status', status, 'open_from', open_from,
                'open_to', open_to, 'is_open', perf_cycle_is_open(id), 'config', config) from perf_cycles where id = a.cycle_id),
    'can_edit', (v_hr or a.evaluator_id = v_me) and a.status in ('pending','draft','returned') and (v_hr or perf_cycle_is_open(a.cycle_id)),
    'can_review', (v_hr or a.reviewer_id = v_me) and a.status = 'submitted',
    'is_hr', v_hr) into v;
  return v;
end $$;

-- บันทึกคะแนน (ผู้ประเมินหรือ HR) · rating ว่าง = ลบคะแนนข้อนั้น
create or replace function public.perf_save(p_assignment uuid, p_scores jsonb, p_comment text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a perf_assignments; v_me text := perf_my_emp_id(); v_hr boolean := is_hr_admin(); r jsonb; v_by text;
begin
  select * into a from perf_assignments where id = p_assignment for update;
  if a.id is null then raise exception 'ไม่พบใบประเมิน'; end if;
  if not v_hr and a.evaluator_id is distinct from v_me then raise exception 'คุณไม่ใช่ผู้ประเมินของพนักงานคนนี้'; end if;
  if a.status not in ('pending','draft','returned') then raise exception 'ใบประเมินนี้ส่งแล้ว แก้ไม่ได้ ต้องให้ผู้ทบทวนหรือ HR ตีกลับก่อน'; end if;
  if not v_hr and not perf_cycle_is_open(a.cycle_id) then raise exception 'ตอนนี้ไม่อยู่ในช่วงเปิดรับประเมิน'; end if;
  v_by := coalesce(v_me, auth.jwt()->>'email');
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
  update perf_assignments
     set status = case when status = 'pending' then 'draft' else status end,
         evaluator_comment = coalesce(p_comment, evaluator_comment), updated_at = now()
   where id = p_assignment;
  return jsonb_build_object('ok', true);
end $$;

-- ส่งใบประเมิน: ต้องให้คะแนนครบ และข้อที่ให้ 1 หรือ 5 ต้องมีเหตุผล · ไม่มีผู้ทบทวน = ข้ามไปรอ HR
create or replace function public.perf_submit(p_assignment uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a perf_assignments; v_me text := perf_my_emp_id(); v_hr boolean := is_hr_admin(); n int; nr int; nm int;
begin
  select * into a from perf_assignments where id = p_assignment for update;
  if a.id is null then raise exception 'ไม่พบใบประเมิน'; end if;
  if not v_hr and a.evaluator_id is distinct from v_me then raise exception 'คุณไม่ใช่ผู้ประเมินของพนักงานคนนี้'; end if;
  if a.status not in ('pending','draft','returned') then raise exception 'ใบประเมินนี้ส่งไปแล้ว'; end if;
  if not v_hr and not perf_cycle_is_open(a.cycle_id) then raise exception 'ตอนนี้ไม่อยู่ในช่วงเปิดรับประเมิน'; end if;
  select count(*), count(s.rating), count(*) filter (where s.rating in (1, 5) and coalesce(btrim(s.note), '') = '')
    into n, nr, nm
    from perf_items(p_assignment) i left join perf_scores s on s.assignment_id = p_assignment and s.item_id = i.item_id;
  if n = 0 then raise exception 'ใบนี้ยังไม่มีหัวข้อประเมิน — แจ้ง HR'; end if;
  if nr < n then raise exception 'ให้คะแนนยังไม่ครบ (% จาก % ข้อ)', nr, n; end if;
  if nm > 0 then raise exception 'ข้อที่ให้ระดับ 1 หรือ 5 ต้องเขียนเหตุผล (ยังขาด % ข้อ)', nm; end if;
  update perf_assignments
     set status = case when reviewer_id is null then 'reviewed' else 'submitted' end,
         submitted_at = now(),
         reviewed_at = case when reviewer_id is null then now() else null end,
         updated_at = now()
   where id = p_assignment;
  return jsonb_build_object('ok', true);
end $$;

-- ผู้ทบทวน (ผู้จัดการ) อนุมัติหรือตีกลับ
create or replace function public.perf_review(p_assignment uuid, p_action text, p_comment text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a perf_assignments; v_me text := perf_my_emp_id(); v_hr boolean := is_hr_admin();
begin
  select * into a from perf_assignments where id = p_assignment for update;
  if a.id is null then raise exception 'ไม่พบใบประเมิน'; end if;
  if not v_hr and a.reviewer_id is distinct from v_me then raise exception 'คุณไม่ใช่ผู้ทบทวนของใบนี้'; end if;
  if a.status <> 'submitted' then raise exception 'ใบนี้ไม่ได้อยู่ในขั้นรอทบทวน'; end if;
  if p_action = 'approve' then
    update perf_assignments set status = 'reviewed', reviewed_at = now(), reviewer_comment = coalesce(nullif(btrim(p_comment), ''), reviewer_comment), updated_at = now() where id = p_assignment;
  elsif p_action = 'return' then
    if coalesce(btrim(p_comment), '') = '' then raise exception 'ตีกลับต้องเขียนเหตุผล'; end if;
    update perf_assignments set status = 'returned', reviewer_comment = btrim(p_comment), updated_at = now() where id = p_assignment;
  else raise exception 'คำสั่งไม่ถูกต้อง'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- HR อนุมัติขั้นสุดท้าย / ตีกลับ / เปิดใหม่ (หลายใบพร้อมกันได้)
create or replace function public.perf_hr_decide(p_ids uuid[], p_action text, p_comment text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare n int := 0;
begin
  if not is_hr_admin() then raise exception 'เฉพาะ HR'; end if;
  if p_action = 'approve' then
    update perf_assignments set status = 'approved', approved_at = now(), approved_by = auth.jwt()->>'email',
           hr_comment = coalesce(nullif(btrim(p_comment), ''), hr_comment), updated_at = now()
     where id = any(p_ids) and status in ('submitted','reviewed');
  elsif p_action = 'return' then
    if coalesce(btrim(p_comment), '') = '' then raise exception 'ตีกลับต้องเขียนเหตุผล'; end if;
    update perf_assignments set status = 'returned', hr_comment = btrim(p_comment), approved_at = null, updated_at = now()
     where id = any(p_ids) and status in ('submitted','reviewed','approved');
  elsif p_action = 'reopen' then
    update perf_assignments set status = 'reviewed', approved_at = null, updated_at = now()
     where id = any(p_ids) and status = 'approved';
  else raise exception 'คำสั่งไม่ถูกต้อง'; end if;
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'count', n);
end $$;

-- สร้างใบประเมินให้พนักงานที่ยังทำงานทุกคน (ไม่ทับใบที่มีอยู่)
-- ผู้ประเมิน = หัวหน้าหน่วยงาน · หน่วยงานไม่มีหัวหน้า (หรือเป็นตัวหัวหน้าเอง) = ผู้จัดการ · ไม่มีทั้งคู่ = หัวหน้าตาม HR Core
-- ผู้ทบทวน = ผู้จัดการ เมื่อผู้ประเมินคือหัวหน้าหน่วยงาน
-- p_refresh = true → คำนวณผู้ประเมิน/ระดับ/JD ใหม่ให้ใบที่ยังไม่เริ่ม (pending)
create or replace function public.perf_generate(p_cycle text, p_refresh boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c perf_cycles; n_new int := 0; n_upd int := 0;
begin
  if not is_hr_admin() then raise exception 'เฉพาะ HR'; end if;
  select * into c from perf_cycles where id = p_cycle;
  if c.id is null then raise exception 'ไม่พบรอบประเมิน'; end if;

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
         when x.hire_date is not null and x.hire_date + 119 > c.eligible_cutoff then 'ยังไม่พ้นทดลองงาน ณ ' || to_char(c.eligible_cutoff, 'DD/MM/') || (extract(year from c.eligible_cutoff)::int + 543)
         end as elig_note
  from x;

  insert into perf_assignments (cycle_id, employee_id, level, jd_id, evaluator_id, reviewer_id, eligible, eligible_note)
  select p_cycle, s.employee_id, s.lvl, s.jd, s.evaluator, s.reviewer, s.elig, s.elig_note from _perf_src s
  on conflict (cycle_id, employee_id) do nothing;
  get diagnostics n_new = row_count;

  if p_refresh then
    update perf_assignments a
       set level = s.lvl, jd_id = coalesce(s.jd, a.jd_id), evaluator_id = s.evaluator, reviewer_id = s.reviewer,
           eligible = s.elig, eligible_note = s.elig_note, updated_at = now()
      from _perf_src s
     where a.cycle_id = p_cycle and a.employee_id = s.employee_id and a.status = 'pending';
    get diagnostics n_upd = row_count;
  end if;
  return jsonb_build_object('ok', true, 'created', n_new, 'refreshed', n_upd);
end $$;

-- คิดคะแนนหักจากตอกบัตร (attendance_monthly) และใบเตือน (disciplinary) ตามเกณฑ์ปี 2568
-- ลบของเดิมที่ระบบคิด (timecard/warning) แล้วคิดใหม่ · รายการที่ HR กรอกเอง (manual) ไม่ถูกแตะ
create or replace function public.perf_sync_deductions(p_cycle text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c perf_cycles; v_by text := auth.jwt()->>'email'; n_t int := 0; n_w int := 0;
  k jsonb; pq numeric; sq numeric;
begin
  if not is_hr_admin() then raise exception 'เฉพาะ HR'; end if;
  select * into c from perf_cycles where id = p_cycle;
  if c.id is null then raise exception 'ไม่พบรอบประเมิน'; end if;
  k := coalesce(c.config->'deduct', '{}'::jsonb);
  pq := coalesce((c.config->>'personal_quota')::numeric, 7);
  sq := coalesce((c.config->>'sick_quota')::numeric, 30);
  delete from perf_deductions where cycle_id = p_cycle and source in ('timecard','warning');

  insert into perf_deductions (cycle_id, employee_id, kind, qty, points, source, note, created_by)
  select p_cycle, t.employee_id, v.kind, v.qty, v.qty * coalesce((k->>v.kind)::numeric, 0), 'timecard', v.note, v_by
    from (select m.employee_id,
                 sum(coalesce(m.late_count, 0)) late, sum(coalesce(m.absent_days, 0)) absent,
                 sum(coalesce(m.personal_days, 0)) personal, sum(coalesce(m.sick_days, 0)) sick
            from attendance_monthly m join attendance_periods p on p.id = m.period_id
           where p.year_th = c.year_th
             and exists (select 1 from perf_assignments a where a.cycle_id = p_cycle and a.employee_id = m.employee_id)
           group by m.employee_id) t
    cross join lateral (values
      ('late', t.late, 'มาสาย ' || t.late || ' ครั้ง (ตอกบัตร)'),
      ('absent', t.absent, 'ขาดงาน ' || t.absent || ' วัน (ตอกบัตร)'),
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

-- สิทธิ์เรียกใช้ฟังก์ชัน: เฉพาะคนที่ล็อกอิน
revoke execute on function public.perf_cycle_is_open(text) from public, anon;
revoke execute on function public.perf_items(uuid) from public, anon;
revoke execute on function public.perf_results(text) from public, anon;
revoke execute on function public.perf_list(text) from public, anon;
revoke execute on function public.perf_get_form(uuid) from public, anon;
revoke execute on function public.perf_save(uuid, jsonb, text) from public, anon;
revoke execute on function public.perf_submit(uuid) from public, anon;
revoke execute on function public.perf_review(uuid, text, text) from public, anon;
revoke execute on function public.perf_hr_decide(uuid[], text, text) from public, anon;
revoke execute on function public.perf_generate(text, boolean) from public, anon;
revoke execute on function public.perf_sync_deductions(text) from public, anon;
grant execute on function public.perf_cycle_is_open(text), public.perf_items(uuid), public.perf_results(text),
  public.perf_list(text), public.perf_get_form(uuid), public.perf_save(uuid, jsonb, text), public.perf_submit(uuid),
  public.perf_review(uuid, text, text), public.perf_hr_decide(uuid[], text, text), public.perf_generate(text, boolean),
  public.perf_sync_deductions(text) to authenticated;

-- ===================== ข้อมูลตั้งต้น =====================
insert into public.perf_cycles (id, name, year_th, period_start, period_end, open_from, open_to, eligible_cutoff,
  raise_effective, bonus_pay, new_salary_pay, status, config)
values ('2569', 'ประเมินผลประจำปี 2569', 2569, '2026-01-01', '2026-11-30', '2026-11-24', '2026-12-15', '2026-11-30',
  '2027-01-01', '2026-12-28', '2027-01-28', 'draft',
  '{
    "weights": {"ops": {"A": 50, "B": 15, "C": 35}, "office": {"A": 60, "B": 15, "C": 25},
                "supervisor": {"A": 50, "B": 25, "C": 25}, "manager": {"A": 55, "B": 30, "C": 15}},
    "bands": [[96, "A+", 1.0, "ผลงานโดดเด่นมาก"], [90, "A", 0.9, "เกินเป้าหมาย"], [80, "B+", 0.8, "ดีมาก"],
              [70, "B", 0.7, "ตามมาตรฐาน"], [60, "C", 0.5, "ต่ำกว่าเป้าเล็กน้อย"], [50, "D", 0.2, "ต้องปรับปรุง"],
              [0, "F", 0, "ไม่ผ่านเกณฑ์"]],
    "raise_pct": 3,
    "personal_quota": 7, "sick_quota": 30,
    "deduct": {"late": 1, "absent": 5, "personal_over": 1, "sick_over": 1, "sick_no_cert": 1, "unapproved": 1, "unpaid": 1,
               "warn_verbal": 10, "warn_written_1": 15, "warn_written_2": 20, "warn_written_3": 25, "suspend": 30}
  }'::jsonb)
on conflict (id) do nothing;

insert into public.perf_common_items (id, kind, seq, title, standard) values
  ('core1', 'core', 1, 'ตรงต่อเวลาและการมาทำงาน', 'มาทำงานและเข้างานตรงเวลา แจ้งล่วงหน้าทุกครั้งที่ลาหรือมาสาย'),
  ('core2', 'core', 2, 'วินัยและความปลอดภัยในการทำงาน', 'ทำตามกฎระเบียบและขั้นตอนความปลอดภัยครบ ใช้อุปกรณ์ป้องกันตามที่กำหนด'),
  ('core3', 'core', 3, 'คุณภาพงานและความละเอียดรอบคอบ', 'งานถูกต้องตามมาตรฐาน แก้ไขซ้ำน้อย ตรวจงานตัวเองก่อนส่ง'),
  ('core4', 'core', 4, 'การทำงานเป็นทีมและการสื่อสาร', 'ช่วยเหลือเพื่อนร่วมงาน ส่งต่องานและแจ้งปัญหาชัดเจนทันเวลา'),
  ('core5', 'core', 5, 'การเรียนรู้และปรับปรุงงาน', 'เรียนรู้งานใหม่ได้ตามที่มอบหมาย และเสนอวิธีทำงานที่ดีขึ้นเมื่อพบปัญหา'),
  ('lead1', 'lead', 1, 'วางแผนและมอบหมายงาน', 'วางแผนงานของทีมล่วงหน้า มอบหมายงานชัดเจน งานเสร็จตามกำหนด'),
  ('lead2', 'lead', 2, 'สอนงานและพัฒนาลูกทีม', 'สอนงานลูกทีมใหม่ได้ ติดตามและให้คำแนะนำสม่ำเสมอ'),
  ('lead3', 'lead', 3, 'แก้ปัญหาและตัดสินใจ', 'แก้ปัญหาหน้างานได้เองในขอบเขตที่รับผิดชอบ รายงานเรื่องเกินอำนาจทันที'),
  ('lead4', 'lead', 4, 'ดูแลวินัยและความปลอดภัยของทีม', 'ทีมทำตามกฎระเบียบ อุบัติเหตุและการขาดงานในทีมได้รับการติดตาม')
on conflict (id) do nothing;

-- หัวข้อตาม JD เริ่มต้นจากข้อมูลเดิม (jd_library) — HR ตัดให้เหลือ 3–6 ข้อและเขียนมาตรฐานระดับ 3 ภายหลัง
insert into public.perf_jd_items (jd_id, section, seq, title, weight)
select j.id, 'A', row_number() over (partition by j.id order by x.ord), btrim(x.v->>'name'),
       case when nullif(x.v->>'weight', '')::numeric > 0 then (x.v->>'weight')::numeric else 1 end
  from jd_library j, jsonb_array_elements(coalesce(j.eval_a, '[]'::jsonb)) with ordinality x(v, ord)
 where coalesce(x.v->>'grp', 'a1') = 'a1' and btrim(coalesce(x.v->>'name', '')) <> ''
   and not exists (select 1 from perf_jd_items);
insert into public.perf_jd_items (jd_id, section, seq, title, weight)
select j.id, 'A', d.ord, btrim(d.v), 1
  from jd_library j, unnest(j.duties) with ordinality d(v, ord)
 where (j.eval_a is null or jsonb_array_length(j.eval_a) = 0) and btrim(coalesce(d.v, '')) <> ''
   and not exists (select 1 from perf_jd_items i where i.jd_id = j.id);
insert into public.perf_jd_items (jd_id, section, seq, title, weight)
select j.id, 'B', row_number() over (partition by j.id order by x.ord), btrim(x.v->>'name'),
       case when nullif(x.v->>'weight', '')::numeric > 0 then (x.v->>'weight')::numeric else 1 end
  from jd_library j, jsonb_array_elements(coalesce(j.eval_b, '[]'::jsonb)) with ordinality x(v, ord)
 where coalesce(x.v->>'grp', 'specific') <> 'core' and btrim(coalesce(x.v->>'name', '')) <> ''
   and not exists (select 1 from perf_jd_items i where i.jd_id = j.id and i.section = 'B');
