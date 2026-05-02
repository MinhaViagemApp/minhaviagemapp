import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";

/**
 * Componente invisível que roda dentro do AuthProvider para:
 * 1. Registrar o service worker / PWA quando o usuário está logado.
 * 2. Solicitar permissão e salvar o token de push em user_tokens.
 */
export function PushBootstrap() {
  const { user } = useAuth();
  usePushNotifications();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    try {
      if (window.self !== window.top) return; // evita preview/iframe
    } catch {
      return;
    }
    navigator.serviceWorker.getRegistration("/").then((reg) => {
      if (!reg) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    });
  }, [user]);

  return null;
}
