import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPERADMIN_EMAIL = "dionemoney1@gmail.com";
const SUPERADMIN_PASSWORD = "Dionemoney1@AdmnTemp#2026$Secure";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Try to find existing user
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === SUPERADMIN_EMAIL);

    let userId: string;
    if (existing) {
      userId = existing.id;
      // Reset password to ensure it matches
      await admin.auth.admin.updateUserById(userId, {
        password: SUPERADMIN_PASSWORD,
        email_confirm: true,
      });
    } else {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: SUPERADMIN_EMAIL,
        password: SUPERADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: { name: "Super Admin" },
      });
      if (error) throw error;
      userId = created.user!.id;
    }

    // Ensure role
    await admin.from("user_roles").upsert(
      { user_id: userId, role: "superadmin" },
      { onConflict: "user_id,role" },
    );

    return new Response(JSON.stringify({ ok: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
