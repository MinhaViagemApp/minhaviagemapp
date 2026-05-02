import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { VAPID_PUBLIC_KEY, detectPlatform, urlBase64ToUint8Array } from "@/lib/push";

/**
 * Registra o service worker, solicita permissão de notificações e salva
 * o token (subscription) na tabela user_tokens. Roda uma vez por sessão.
 */
export function usePushNotifications() {
  const { user } = useAuth();
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!user || registeredRef.current) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    // Evita problemas no preview do editor (iframe)
    try {
      if (window.self !== window.top) return;
    } catch {
      return;
    }

    registeredRef.current = true;

    const setup = async () => {
      try {
        const registration =
          (await navigator.serviceWorker.getRegistration("/")) ||
          (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));

        await navigator.serviceWorker.ready;

        // Pede permissão somente se ainda não foi decidida
        let permission = Notification.permission;
        if (permission === "default") {
          permission = await Notification.requestPermission();
        }
        if (permission !== "granted") return;

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });
        }

        const json = subscription.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

        await supabase.from("user_tokens").upsert(
          {
            user_id: user.id,
            endpoint: json.endpoint,
            p256dh: json.keys.p256dh,
            auth: json.keys.auth,
            platform: detectPlatform(),
            user_agent: navigator.userAgent,
          },
          { onConflict: "user_id,endpoint" }
        );
      } catch (err) {
        console.warn("[push] falha ao configurar notificações:", err);
      }
    };

    void setup();
  }, [user]);
}
