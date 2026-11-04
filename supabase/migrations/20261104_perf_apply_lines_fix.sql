-- แก้บั๊ก: คนที่ถูก "เอาออกจากสาย" / สายถูกลบหรือปิด → ใบประเมินยังค้างผู้ประเมินคนเดิม
-- เดิมใช้ cross join lateral perf_line_chain() ซึ่งไม่คืนแถวเมื่อไม่อยู่ในสาย → ไม่ถูกอัปเดต
-- ใหม่: left join → ไม่อยู่ในสาย = ไม่มีผู้ประเมินในสาย (บัญชีหน่วยงานกรอกแทน หรือ HR กรอก) · ไม่แตะใบที่อนุมัติแล้ว
create or replace function public.perf_apply_lines(p_cycle text)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare n int;
begin
  if not is_hr_admin() then raise exception 'เฉพาะ HR'; end if;
  update perf_assignments a set evaluator_id = c.ev, reviewer_id = c.rv, updated_at = now()
    from perf_assignments a2 left join lateral perf_line_chain(a2.employee_id) c on true
   where a2.id = a.id and a.cycle_id = p_cycle and a.status <> 'approved'
     and (a.evaluator_id is distinct from c.ev or a.reviewer_id is distinct from c.rv);
  get diagnostics n = row_count;
  return jsonb_build_object('ok', true, 'updated', n);
end $function$;

-- ฟังก์ชันภายใน ไม่ให้เรียกตรงผ่าน /rpc
revoke execute on function public.perf_line_chain(text) from public, anon, authenticated;
revoke execute on function public.perf_acct_email(text) from public, anon, authenticated;
