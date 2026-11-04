import { createClient } from 'jsr:@supabase/supabase-js@2';

// perf-register — ผู้ประเมินในสายการประเมิน ลงทะเบียน/ตั้งรหัสผ่านใหม่ด้วยตนเอง (HR ไม่ต้องอยู่)
// ยืนยันตัวตนด้วย รหัสพนักงาน + วันเกิด + วันเริ่มงาน (ในฐานยังไม่มีเลขบัตรประชาชน)
// ล็อกอินด้วย "รหัสพนักงาน" → อีเมลภายใน <รหัส>@staff.bwp.co.th (ไม่ใช่อีเมลจริง ไม่มีการส่งเมล)
// บัญชีที่ได้: role supervisor · ไม่มีหน่วยงาน (dept = null) → เห็นเฉพาะใบที่ตนเป็นผู้ประเมิน/ผู้อนุมัติ + ข้อมูลตัวเอง
// กันเดา: ผิดเกิน 5 ครั้งใน 24 ชม. ต่อรหัส → ล็อก · แจ้ง HR ทุกครั้งที่ลงทะเบียน/รีเซ็ตสำเร็จ

function envKey(newVar: string, legacyVar: string): string {
  try {
    const m = JSON.parse(Deno.env.get(newVar) ?? '');
    const k = m?.default ?? Object.values(m ?? {})[0];
    if (typeof k === 'string' && k) return k;
  } catch { /* ตกไปใช้ legacy */ }
  return Deno.env.get(legacyVar)!;
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const STAFF_DOMAIN = 'staff.bwp.co.th';
const HR_NOTIFY = ['hr@bwp.co.th', 'hr.admin@bestworld.co.th'];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const service = envKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });

    const body = await req.json().catch(() => ({}));
    const emp = String(body.emp_id || '').trim();
    const birth = String(body.birth_date || '').trim();
    const hire = String(body.hire_date || '').trim();
    const password = String(body.password || '');
    const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
    if (!/^\d{5,8}$/.test(emp)) return json({ ok: false, error: 'รหัสพนักงานไม่ถูกต้อง' }, 400);
    if (!isDate(birth) || !isDate(hire)) return json({ ok: false, error: 'กรอกวันเกิดและวันเริ่มงานให้ครบ' }, 400);
    if (password.length < 8) return json({ ok: false, error: 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร' }, 400);

    // กันเดาสุ่ม
    const since = new Date(Date.now() - 24 * 3600e3).toISOString();
    const { count: fails } = await admin.from('perf_register_attempts').select('id', { count: 'exact', head: true })
      .eq('employee_id', emp).eq('ok', false).gte('at', since);
    if ((fails || 0) >= 5) return json({ ok: false, error: 'ลองผิดเกิน 5 ครั้ง — ลองใหม่พรุ่งนี้ หรือติดต่อ HR' }, 429);
    const fail = async (msg: string, s = 400) => { await admin.from('perf_register_attempts').insert({ employee_id: emp, ok: false }); return json({ ok: false, error: msg }, s); };

    const { data: e } = await admin.from('employees').select('id, name, birth_date, hire_date, employment_status').eq('id', emp).maybeSingle();
    const working = e && ['ACTIVE', 'PROBATION', 'ON_LEAVE', 'SUSPENDED'].includes(String(e.employment_status || 'ACTIVE').toUpperCase());
    // ข้อความเดียวกันทุกกรณี ไม่บอกว่าข้อไหนผิด
    if (!working || String(e.birth_date || '').slice(0, 10) !== birth || String(e.hire_date || '').slice(0, 10) !== hire) {
      return fail('ข้อมูลไม่ตรงกับทะเบียนพนักงาน — ตรวจรหัส วันเกิด และวันเริ่มงานอีกครั้ง');
    }

    // ลงทะเบียนได้เฉพาะคนที่ถูกตั้งเป็นผู้ประเมินคนที่ 1 หรือ 2 ในสายการประเมิน
    const { count: lines } = await admin.from('perf_lines').select('id', { count: 'exact', head: true })
      .eq('active', true).or(`evaluator1_id.eq.${emp},evaluator2_id.eq.${emp}`);
    if (!lines) return json({ ok: false, error: 'รหัสนี้ยังไม่ได้เป็นผู้ประเมินในสายการประเมิน — ติดต่อ HR' }, 403);

    const email = `${emp}@${STAFF_DOMAIN}`;
    const { data: au } = await admin.from('app_users').select('id, email, auth_uid, active').eq('employee_id', emp).maybeSingle();
    if (au && au.email.toLowerCase() !== email) {
      return json({ ok: false, error: `มีบัญชีอยู่แล้ว (${au.email}) — ใช้บัญชีนั้นเข้าระบบ หรือให้ HR รีเซ็ตรหัสผ่าน` }, 409);
    }

    let reset = false;
    if (au) {
      // ลงทะเบียนไว้แล้ว → ตั้งรหัสผ่านใหม่ (ลืมรหัส) ด้วยการยืนยันตัวตนชุดเดิม
      if (!au.active) return json({ ok: false, error: 'บัญชีนี้ถูกปิดใช้งาน — ติดต่อ HR' }, 403);
      let uid = au.auth_uid as string | null;
      if (!uid) {
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        uid = list?.users?.find((u) => (u.email || '').toLowerCase() === email)?.id || null;
      }
      if (!uid) return json({ ok: false, error: 'ไม่พบบัญชีในระบบล็อกอิน — ติดต่อ HR' }, 500);
      const { error: uErr } = await admin.auth.admin.updateUserById(uid, { password });
      if (uErr) return json({ ok: false, error: uErr.message }, 400);
      reset = true;
    } else {
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name: e.name, employee_id: emp },
      });
      if (cErr) return json({ ok: false, error: cErr.message }, 400);
      const { error: iErr } = await admin.from('app_users').insert({
        name: e.name, email, role: 'supervisor', dept: null, active: true, employee_id: emp, auth_uid: created.user!.id,
      });
      if (iErr) { await admin.auth.admin.deleteUser(created.user!.id); return json({ ok: false, error: iErr.message }, 400); }
    }

    await admin.from('perf_register_attempts').insert({ employee_id: emp, ok: true });
    await admin.from('notifications').insert(HR_NOTIFY.map((to) => ({
      type: 'info', title: reset ? 'ผู้ประเมินตั้งรหัสผ่านใหม่' : 'ผู้ประเมินลงทะเบียนใหม่',
      body: `${e.name} (${emp}) — ถ้าไม่ใช่เจ้าตัว ให้ปิดบัญชีที่ ตั้งค่า › ผู้ใช้ระบบ`, recipient_email: to, read: false,
    })));
    return json({ ok: true, login: emp, reset });
  } catch (err) {
    return json({ ok: false, error: 'เกิดข้อผิดพลาด: ' + String((err as Error)?.message || err) }, 500);
  }
});
