import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return jsonResponse({ error: "Configuração do servidor incompleta." }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return jsonResponse({ error: "Token ausente." }, 401);

    const { data: authUser, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !authUser?.user) {
      console.error("Auth error:", authError?.message);
      return jsonResponse({ error: "Não autorizado." }, 401);
    }

    const { data: roleRow, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", authUser.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError) console.error("Role check error:", roleError.message);
    if (!roleRow) return jsonResponse({ error: "Apenas administradores podem excluir usuários." }, 403);

    let body: { userId?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "JSON inválido." }, 400);
    }
    const { userId } = body;
    if (!userId) return jsonResponse({ error: "userId é obrigatório." }, 400);
    if (userId === authUser.user.id) {
      return jsonResponse({ error: "Você não pode excluir seu próprio usuário por esta ação." }, 400);
    }

    const { data: targetRoleRows, error: targetRoleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (targetRoleError) {
      console.error("Target role check error:", targetRoleError.message);
      return jsonResponse({ error: "Não foi possível validar o usuário selecionado." }, 500);
    }

    if ((targetRoleRows || []).some((row) => row.role === "admin")) {
      return jsonResponse({ error: "Este fluxo exclui apenas clientes." }, 403);
    }

    // Buscar profile (sem falhar se não existir)
    const { data: profile } = await adminClient
      .from("profiles")
      .select("name, email")
      .eq("id", userId)
      .maybeSingle();

    // Buscar trip_queries e trip_seats do usuário
    const [queriesRes, seatLinksRes] = await Promise.all([
      adminClient.from("trip_queries").select("id, trip_id").eq("user_id", userId),
      adminClient.from("trip_seats").select("trip_id").eq("user_id", userId),
    ]);

    const tripIds = Array.from(new Set([
      ...(queriesRes.data || []).map((row: any) => row.trip_id),
      ...(seatLinksRes.data || []).map((row: any) => row.trip_id),
    ].filter(Boolean)));

    // Buscar clientes pelo email e/ou nome (queries separadas, evita problemas de escape no .or())
    const clientIdSet = new Set<string>();
    if (profile?.email) {
      const { data: byEmail } = await adminClient
        .from("clients")
        .select("id")
        .eq("email", profile.email);
      (byEmail || []).forEach((c: any) => clientIdSet.add(c.id));
    }
    if (profile?.name) {
      const { data: byName } = await adminClient
        .from("clients")
        .select("id")
        .ilike("name", profile.name);
      (byName || []).forEach((c: any) => clientIdSet.add(c.id));
    }
    const clientIds = Array.from(clientIdSet);

    // Liberar poltronas associadas a esses clientes
    if (tripIds.length > 0 && clientIds.length > 0) {
      const { error: seatErr } = await adminClient
        .from("bus_seats")
        .update({ status: "livre", client_id: null, passenger_name: null, updated_at: new Date().toISOString() })
        .in("trip_id", tripIds)
        .in("client_id", clientIds);
      if (seatErr) console.error("Seat release (by client) error:", seatErr.message);
    }

    // Liberar poltronas pendentes pelo nome do passageiro
    if (tripIds.length > 0 && profile?.name) {
      const { error: seatErr2 } = await adminClient
        .from("bus_seats")
        .update({ status: "livre", client_id: null, passenger_name: null, updated_at: new Date().toISOString() })
        .in("trip_id", tripIds)
        .eq("status", "pendente")
        .eq("passenger_name", profile.name);
      if (seatErr2) console.error("Seat release (pending) error:", seatErr2.message);
    }

    // Limpeza isolada — cada delete é independente, falha de um não derruba os outros
    const cleanups: { name: string; promise: PromiseLike<any> }[] = [
      { name: "notifications", promise: adminClient.from("notifications").delete().eq("user_id", userId) as unknown as PromiseLike<any> },
      { name: "installments", promise: adminClient.from("installments").delete().eq("user_id", userId) as unknown as PromiseLike<any> },
      { name: "trip_queries", promise: adminClient.from("trip_queries").delete().eq("user_id", userId) as unknown as PromiseLike<any> },
      { name: "trip_seats", promise: adminClient.from("trip_seats").delete().eq("user_id", userId) as unknown as PromiseLike<any> },
      { name: "user_companies", promise: adminClient.from("user_companies").delete().eq("user_id", userId) as unknown as PromiseLike<any> },
      { name: "user_roles", promise: adminClient.from("user_roles").delete().eq("user_id", userId) as unknown as PromiseLike<any> },
    ];
    const results = await Promise.allSettled(cleanups.map((c) => c.promise));
    results.forEach((r, i) => {
      if (r.status === "rejected") console.error(`Cleanup ${cleanups[i].name} rejected:`, r.reason);
      else if ((r.value as any)?.error) console.error(`Cleanup ${cleanups[i].name} error:`, (r.value as any).error.message);
    });

    if (clientIds.length > 0) {
      const { error: bookErr } = await adminClient.from("bookings").delete().in("client_id", clientIds);
      if (bookErr) console.error("Bookings delete error:", bookErr.message);
      const { error: clientErr } = await adminClient.from("clients").delete().in("id", clientIds);
      if (clientErr) console.error("Clients delete error:", clientErr.message);
    }

    // Profile por último (antes do auth) — só agora libera o FK conceitual
    const { error: profErr } = await adminClient.from("profiles").delete().eq("id", userId);
    if (profErr) console.error("Profile delete error:", profErr.message);

    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      console.error("Auth delete error:", deleteAuthError.message);
      return jsonResponse({ error: `Falha ao excluir do Auth: ${deleteAuthError.message}` }, 500);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    console.error("Unexpected error:", message, error);
    return jsonResponse({ error: message }, 500);
  }
});
