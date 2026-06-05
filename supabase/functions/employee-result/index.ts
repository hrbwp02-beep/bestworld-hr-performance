// Supabase Edge Function: employee-result
// Self-service: an employee enters ONLY their employee code (รหัสพนักงาน) and gets
// back their OWN evaluation result. Uses the service-role key (server-side only) and
// returns a minimal, safe subset — it never exposes other employees or sensitive data.
// Deployed via the Supabase MCP with verify_jwt = false (public, no login required).
//
// POST { code }  ->  { found, employee, result }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function reply(obj: Record<string, unknown>) {
  return new Response(JSON.stringify(obj), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(url, service);

    const body = await req.json().catch(() => ({}));
    const code = String(body?.code ?? "").trim();
    if (!code) return reply({ found: false, error: "กรุณากรอกรหัสพนักงาน" });

    const { data: emp } = await db.from("employees")
      .select("id, name, position, dept, level, hire_date, tenure, warnings, jd_id")
      .eq("id", code).maybeSingle();
    if (!emp) return reply({ found: false });

    // current cycle from app_settings
    let cycleYear = 2569;
    const { data: st } = await db.from("app_settings").select("cycle_name").eq("id", 1).maybeSingle();
    const ym = String(st?.cycle_name ?? "").match(/(25\d{2}|20\d{2})/);
    if (ym) cycleYear = Number(ym[1]);

    const { data: dept } = await db.from("departments").select("name").eq("id", emp.dept).maybeSingle();
    const { data: jd } = emp.jd_id ? await db.from("jd_library").select("id, title").eq("id", emp.jd_id).maybeSingle() : { data: null };
    const { data: ev } = await db.from("evaluations")
      .select("a_score, b_score, kpi_score, comp_score, overall, grade, bonus_months, raise_pct, has_warning, status, stage, evaluator, evaluator_code, comment, items, cycle_year")
      .eq("employee_id", code).eq("cycle_year", cycleYear).maybeSingle();

    return reply({
      found: true,
      cycleYear,
      employee: {
        id: emp.id, name: emp.name, position: emp.position,
        dept: dept?.name ?? emp.dept, level: emp.level, tenure: emp.tenure,
        jd: jd ? `${jd.id} · ${jd.title}` : null, warnings: emp.warnings ?? 0,
      },
      result: ev ? {
        a_score: ev.a_score, b_score: ev.b_score,
        kpi_score: ev.kpi_score, comp_score: ev.comp_score,
        overall: ev.overall, grade: ev.grade,
        bonus_months: ev.bonus_months, raise_pct: ev.raise_pct, has_warning: ev.has_warning,
        status: ev.status, stage: ev.stage,
        evaluator: ev.evaluator, evaluator_code: ev.evaluator_code,
        comment: ev.comment, items: ev.items,
      } : null,
    });
  } catch (e) {
    return reply({ found: false, error: String((e as Error)?.message ?? e) });
  }
});
