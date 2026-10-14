// employee-result — พนักงานดูผลประเมินของตัวเอง (ไม่ต้องล็อกอิน)
// ใช้ API key ระบบใหม่ (SUPABASE_SECRET_KEYS) ถ้าไม่มีจึงถอยกลับไปใช้ของเดิม
//
// 14/10/2569: ซิงก์กับเวอร์ชันที่ deploy อยู่ (v2) แล้วแก้เพิ่ม
//  - ไม่ส่งคะแนน/เกรด/โบนัส/% ขึ้นเงินเดือน จนกว่าใบประเมินจะอนุมัติครบ (status = done)
//  - รับทราบผล/อุทธรณ์ได้เฉพาะใบที่อนุมัติครบแล้ว
//  - ประเมินตนเองได้เฉพาะตอนรอบเปิด และหัวหน้ายังไม่ส่งใบเข้าสายอนุมัติ

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// อ่าน secret key แบบใหม่ก่อน ถ้าไม่มีค่อยใช้ legacy (รองรับช่วงเปลี่ยนผ่าน)
function secretKey(): string {
  try {
    const m = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "");
    const k = m?.default ?? Object.values(m ?? {})[0];
    if (typeof k === "string" && k) return k;
  } catch { /* ตกไปใช้ legacy */ }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}
function keyMode(): string {
  try {
    const m = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "");
    if (m?.default ?? Object.values(m ?? {})[0]) return "new";
  } catch { /* noop */ }
  return "legacy";
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function reply(obj: Record<string, unknown>) {
  return new Response(JSON.stringify(obj), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
}

// วันที่ปัจจุบันตามเวลาไทย (YYYY-MM-DD)
function todayTH(): string {
  return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const db = createClient(url, secretKey());

    const body = await req.json().catch(() => ({}));

    // ตรวจสุขภาพ: บอกว่ากำลังใช้ key แบบไหน และต่อฐานได้จริงไหม (ไม่คืนค่า key)
    if (body?.action === "healthcheck") {
      const { count, error } = await db.from("hr_departments").select("id", { count: "exact", head: true });
      return reply({ ok: !error, key_mode: keyMode(), db_ok: !error, departments: count ?? null, error: error?.message ?? null });
    }

    const code = String(body?.code ?? "").trim();
    const birthdate = String(body?.birthdate ?? "").trim();
    if (!code) return reply({ found: false, error: "กรุณากรอกรหัสพนักงาน" });

    const { data: emp } = await db.from("employees")
      .select("id, name, position, dept, level, hire_date, tenure, warnings, jd_id, birth_date")
      .eq("id", code).maybeSingle();
    if (!emp) return reply({ found: false });

    if (emp.birth_date) {
      if (!birthdate) return reply({ found: false, needDob: true });
      if (String(emp.birth_date) !== birthdate) return reply({ found: false });
    }

    // รอบปัจจุบัน + สถานะเปิดรอบ จาก app_settings
    let cycleYear = 2569;
    const { data: st } = await db.from("app_settings").select("cycle_name, eval_open, start_date, end_date").eq("id", 1).maybeSingle();
    const ym = String(st?.cycle_name ?? "").match(/(25\d{2}|20\d{2})/);
    if (ym) cycleYear = Number(ym[1]);
    const t = todayTH();
    const cycleOpen = st?.eval_open !== false
      && (!st?.start_date || t >= String(st.start_date))
      && (!st?.end_date || t <= String(st.end_date));

    const action = String(body?.action ?? "lookup");
    if (action === "acknowledge") {
      const ackComment = String(body?.comment ?? "").trim();
      const ackStatus = body?.appeal ? "appealed" : "acknowledged";
      const { data: evRow } = await db.from("evaluations").select("id, status").eq("employee_id", code).eq("cycle_year", cycleYear).maybeSingle();
      if (!evRow || evRow.status !== "done") return reply({ found: true, ok: false, error: "ยังไม่มีผลประเมินที่อนุมัติแล้วให้รับทราบ" });
      await db.from("evaluations").update({ ack_status: ackStatus, ack_comment: ackComment || null, ack_at: new Date().toISOString() }).eq("id", evRow.id);
      return reply({ found: true, ok: true });
    }
    if (action === "self_assess") {
      if (!cycleOpen) return reply({ found: true, ok: false, error: "รอบประเมินปิดอยู่ ประเมินตนเองไม่ได้" });
      const self = body?.self ?? null;
      const { data: evRow } = await db.from("evaluations").select("id, status").eq("employee_id", code).eq("cycle_year", cycleYear).maybeSingle();
      if (evRow && (evRow.status === "review" || evRow.status === "done")) {
        return reply({ found: true, ok: false, error: "หัวหน้าส่งผลประเมินแล้ว แก้การประเมินตนเองไม่ได้" });
      }
      if (evRow) await db.from("evaluations").update({ self_assessment: self, self_at: new Date().toISOString() }).eq("id", evRow.id);
      else await db.from("evaluations").insert({ employee_id: code, cycle_year: cycleYear, status: "progress", stage: "draft", self_assessment: self, self_at: new Date().toISOString() });
      return reply({ found: true, ok: true });
    }

    const { data: dept } = await db.from("hr_departments").select("name").eq("id", emp.dept).maybeSingle();
    const { data: jd } = emp.jd_id ? await db.from("jd_library").select("id, title").eq("id", emp.jd_id).maybeSingle() : { data: null };
    const { data: ev } = await db.from("evaluations")
      .select("a_score, b_score, kpi_score, comp_score, overall, grade, bonus_months, raise_pct, has_warning, status, stage, evaluator, evaluator_code, comment, items, cycle_year, self_assessment, self_at, ack_status, ack_comment, ack_at, goals, idp")
      .eq("employee_id", code).eq("cycle_year", cycleYear).maybeSingle();

    // คะแนนเปิดเผยได้เมื่ออนุมัติครบแล้วเท่านั้น
    const approved = ev?.status === "done";
    return reply({
      found: true,
      cycleYear,
      cycleOpen,
      employee: {
        id: emp.id, name: emp.name, position: emp.position,
        dept: dept?.name ?? emp.dept, level: emp.level, tenure: emp.tenure,
        jd: jd ? `${jd.id} · ${jd.title}` : null, warnings: emp.warnings ?? 0,
      },
      result: ev ? {
        status: ev.status, stage: ev.stage,
        self_assessment: ev.self_assessment, self_at: ev.self_at,
        goals: ev.goals, idp: ev.idp,
        ...(approved ? {
          a_score: ev.a_score, b_score: ev.b_score,
          kpi_score: ev.kpi_score, comp_score: ev.comp_score,
          overall: ev.overall, grade: ev.grade,
          bonus_months: ev.bonus_months, raise_pct: ev.raise_pct, has_warning: ev.has_warning,
          evaluator: ev.evaluator, evaluator_code: ev.evaluator_code,
          comment: ev.comment, items: ev.items,
          ack_status: ev.ack_status, ack_comment: ev.ack_comment, ack_at: ev.ack_at,
        } : {}),
      } : null,
    });
  } catch (e) {
    return reply({ found: false, error: String((e as Error)?.message ?? e) });
  }
});
