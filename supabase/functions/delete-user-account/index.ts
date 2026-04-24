import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: authUser, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !authUser.user) {
      return new Response(JSON.stringify({ error: "Não autorizado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleRow } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", authUser.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem excluir usuários." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId é obrigatório." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: bookings }, { data: queries }] = await Promise.all([
      adminClient.from("bookings").select("id, trip_id, client_id").eq("client_id", userId),
      adminClient.from("trip_queries").select("id, trip_id").eq("user_id", userId),
    ]);

    const tripIds = Array.from(new Set([
      ...(bookings || []).map((row) => row.trip_id),
      ...(queries || []).map((row) => row.trip_id),
    ]));

    if (tripIds.length > 0) {
      await adminClient
        .from("bus_seats")
        .update({ status: "livre", client_id: null, passenger_name: null, updated_at: new Date().toISOString() })
        .in("trip_id", tripIds)
        .or(`client_id.eq.${userId},status.eq.pendente`);
    }

    await Promise.all([
      adminClient.from("notifications").delete().eq("user_id", userId),
      adminClient.from("payments").delete().in("trip_id", tripIds.length ? tripIds : ["00000000-0000-0000-0000-000000000000"]),
      adminClient.from("installments").delete().eq("user_id", userId),
      adminClient.from("trip_queries").delete().eq("user_id", userId),
      adminClient.from("bookings").delete().eq("client_id", userId),
      adminClient.from("clients").delete().eq("id", userId),
      adminClient.from("user_companies").delete().eq("user_id", userId),
      adminClient.from("user_roles").delete().eq("user_id", userId),
      adminClient.from("profiles").delete().eq("id", userId),
    ]);

    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      return new Response(JSON.stringify({ error: deleteAuthError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro inesperado." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});