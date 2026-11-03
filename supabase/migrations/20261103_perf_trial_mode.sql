-- 03/11/2569 โหมดทดลองประเมินรายหน่วยงาน
-- perf_cycles.config.trial = {"depts": ["sales"], "until": "2026-11-13"}
-- บัญชีหน่วยงานที่อยู่ในรายชื่อ ให้คะแนน/ส่งใบได้ก่อนเปิดรอบจริง จนถึงวัน until
-- ก่อนเปิดจริง HR กด "ล้างข้อมูลทดลอง" (perf_trial_reset) ใบกลับเป็นยังไม่เริ่ม หัวข้อ JD ปลดล็อก

create or replace function public.perf_cycle_is_open(p_cycle text)
 returns boolean language sql stable security definer set search_path to 'public' as $function$
  select coalesce((
    select (status = 'open' and perf_today() between open_from and open_to)
        or (perf_today() <= coalesce((config->'trial'->>'until')::date, date '1900-01-01')
            and exists (select 1 from jsonb_array_elements_text(coalesce(config->'trial'->'depts', '[]'::jsonb)) d where in_my_scope(d)))
      from perf_cycles where id = p_cycle), false)
$function$;

create or replace function perf_trial_reset(p_cycle text, p_dept text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ids uuid[]; n int;
begin
  if not is_hr_admin() then raise exception 'เฉพาะ HR'; end if;
  select array_agg(a.id) into ids from perf_assignments a join employees e on e.id = a.employee_id
   where a.cycle_id = p_cycle and e.dept = p_dept;
  if ids is null then return jsonb_build_object('ok', true, 'forms', 0); end if;
  update perf_assignments set status = 'pending', evaluator_comment = null, reviewer_comment = null, hr_comment = null,
         submitted_at = null, reviewed_at = null, approved_at = null, approved_by = null,
         adj_total = null, adj_grade = null, adj_reason = null, adj_by = null, adj_at = null, updated_at = now()
   where id = any(ids);
  get diagnostics n = row_count;
  delete from perf_scores where assignment_id = any(ids);
  delete from perf_events where assignment_id = any(ids);   -- ลบหลัง update เพื่อลบประวัติที่ trigger เพิ่งบันทึกด้วย
  return jsonb_build_object('ok', true, 'forms', n);
end $$;
revoke all on function perf_trial_reset(text, text) from public, anon;
grant execute on function perf_trial_reset(text, text) to authenticated;

-- เปิดทดลอง: ฝ่ายขายและการตลาด ถึง 13/11/2569 (กำหนดทดสอบเดิม)
update perf_cycles set config = jsonb_set(config, '{trial}', '{"depts": ["sales"], "until": "2026-11-13"}'::jsonb), updated_at = now()
 where id = '2569';
