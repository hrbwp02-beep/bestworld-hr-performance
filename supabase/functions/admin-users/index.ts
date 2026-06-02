// Supabase Edge Function: admin-users
// Provisions real login accounts for the HR system. Uses the service-role key
// (available only inside the function, never in client code). Only an active
// admin in public.app_users may call it.
//
// Deployed via the Supabase MCP (verify_jwt = true). Actions:
//   create         { name, email, password, role, dept, active }
//   delete         { app_user_id }
//   reset_password { app_user_id, password }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function reply(obj: Record<string, unknown>) {
  return new Response(JSON.stringify(obj), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
}
// decode a base64url JWT segment to JSON (signature already verified by the platform)
function decodeClaims(token: string): any {
  try {
    let s = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    const bin = atob(s);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return null; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");

    const claims = decodeClaims(token);
    let callerEmail: string | null = claims?.email ?? null;
    const admin = createClient(url, service);
    if (!callerEmail) {
      const { data } = await admin.auth.getUser(token);
      callerEmail = data?.user?.email ?? null;
    }
    if (!callerEmail) return reply({ ok: false, error: "ไม่ได้เข้าสู่ระบบ" });

    const { data: me } = await admin.from("app_users").select("role, active").eq("email", callerEmail).maybeSingle();
    if (!me || me.role !== "admin" || me.active === false) {
      return reply({ ok: false, error: "เฉพาะผู้ดูแลระบบ (admin) เท่านั้นที่จัดการผู้ใช้ได้" });
    }

    const body = await req.json();
    const action = body.action;

    if (action === "create") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const name = String(body.name ?? "").trim();
      if (!email || !password) return reply({ ok: false, error: "ต้องระบุอีเมลและรหัสผ่าน" });
      if (password.length < 6) return reply({ ok: false, error: "รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร" });

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { name },
      });
      if (cErr) return reply({ ok: false, error: "สร้างบัญชีไม่สำเร็จ: " + cErr.message });
      const uid = created.user!.id;

      const { error: iErr } = await admin.from("app_users").insert({
        name, email, role: body.role || "viewer", dept: body.dept || null,
        active: body.active !== false, auth_uid: uid, sort: 999,
      });
      if (iErr) {
        await admin.auth.admin.deleteUser(uid);
        return reply({ ok: false, error: "บันทึกข้อมูลผู้ใช้ไม่สำเร็จ: " + iErr.message });
      }
      return reply({ ok: true, uid });
    }

    if (action === "delete") {
      const id = body.app_user_id;
      if (!id) return reply({ ok: false, error: "ไม่พบรหัสผู้ใช้" });
      const { data: row } = await admin.from("app_users").select("id, email, auth_uid").eq("id", id).maybeSingle();
      if (!row) return reply({ ok: false, error: "ไม่พบผู้ใช้" });
      if (row.email === callerEmail) return reply({ ok: false, error: "ไม่สามารถลบบัญชีของตนเองได้" });
      if (row.auth_uid) {
        const { error: dErr } = await admin.auth.admin.deleteUser(row.auth_uid);
        if (dErr && !String(dErr.message).toLowerCase().includes("not found")) {
          return reply({ ok: false, error: "ลบบัญชี Auth ไม่สำเร็จ: " + dErr.message });
        }
      }
      await admin.from("app_users").delete().eq("id", id);
      return reply({ ok: true });
    }

    if (action === "reset_password") {
      const id = body.app_user_id;
      const password = String(body.password ?? "");
      if (!id || password.length < 6) return reply({ ok: false, error: "รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร" });
      const { data: row } = await admin.from("app_users").select("auth_uid").eq("id", id).maybeSingle();
      if (!row?.auth_uid) return reply({ ok: false, error: "ผู้ใช้นี้ยังไม่มีบัญชีล็อกอิน" });
      const { error: pErr } = await admin.auth.admin.updateUserById(row.auth_uid, { password });
      if (pErr) return reply({ ok: false, error: "ตั้งรหัสผ่านไม่สำเร็จ: " + pErr.message });
      return reply({ ok: true });
    }

    return reply({ ok: false, error: "คำสั่งไม่ถูกต้อง" });
  } catch (e) {
    return reply({ ok: false, error: String((e as Error)?.message ?? e) });
  }
});
