import { supabase } from "@/integrations/supabase/client";

interface NotifyOptions {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  broadcast?: boolean;
  userIds?: string[];
}

/**
 * Helper para administradores dispararem push + notificação in-app.
 * Falhas são silenciosas para não bloquear a ação principal.
 */
export async function sendNotification(opts: NotifyOptions) {
  try {
    const { data, error } = await supabase.functions.invoke("send-push", {
      body: {
        title: opts.title,
        body: opts.body,
        url: opts.url,
        tag: opts.tag,
        broadcast: opts.broadcast ?? !opts.userIds,
        userIds: opts.userIds,
        persistInApp: true,
      },
    });
    if (error) console.warn("[notify] error:", error);
    return data;
  } catch (err) {
    console.warn("[notify] failed:", err);
    return null;
  }
}
