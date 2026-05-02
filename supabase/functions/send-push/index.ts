// Edge Function: envia Web Push (VAPID) para usuários alvo e cria notificações in-app.
// Chamada por administradores via supabase.functions.invoke("send-push", { body: {...} }).
import webpush from "https://esm.sh/web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  // Alvos: se "broadcast" envia para todos os clients da empresa.
  // Se userIds for fornecido, envia apenas para esses.
  broadcast?: boolean;
  userIds?: string[];
  // Persistir notificação in-app (sininho)
  persistInApp?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@minhaviagem.app";

    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleRow } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as PushPayload;
    if (!payload?.title || !payload?.body) {
      return new Response(JSON.stringify({ error: "title and body required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Resolver lista de user_ids alvo
    let targetUserIds: string[] = payload.userIds || [];

    if (payload.broadcast) {
      // Pega a empresa do admin
      const { data: company } = await admin
        .from("user_companies")
        .select("company_id")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (company?.company_id) {
        const { data: clients } = await admin
          .from("clients")
          .select("email")
          .eq("company_id", company.company_id);
        const emails = (clients || []).map((c: any) => c.email).filter(Boolean);

        if (emails.length > 0) {
          // @ts-ignore - usar admin auth listUsers via filter por email
          const { data: profiles } = await admin
            .from("profiles")
            .select("id, email")
            .in("email", emails);
          targetUserIds = Array.from(
            new Set([...(targetUserIds || []), ...(profiles || []).map((p: any) => p.id)])
          );
        }
      }
    }

    if (targetUserIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: "no targets" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persistir in-app
    if (payload.persistInApp !== false) {
      const rows = targetUserIds.map((uid) => ({
        user_id: uid,
        title: payload.title,
        message: payload.body,
      }));
      await admin.from("notifications").insert(rows);
    }

    // Buscar tokens
    const { data: tokens } = await admin
      .from("user_tokens")
      .select("id, endpoint, p256dh, auth, user_id")
      .in("user_id", targetUserIds);

    const message = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || "/",
      tag: payload.tag,
    });

    let sent = 0;
    let failed = 0;
    const expired: string[] = [];

    await Promise.all(
      (tokens || []).map(async (t: any) => {
        try {
          await webpush.sendNotification(
            { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
            message
          );
          sent++;
        } catch (err: any) {
          failed++;
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            expired.push(t.id);
          }
          console.warn("push failed", err?.statusCode, err?.body);
        }
      })
    );

    if (expired.length > 0) {
      await admin.from("user_tokens").delete().in("id", expired);
    }

    return new Response(
      JSON.stringify({ ok: true, sent, failed, targets: targetUserIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("send-push error", err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
