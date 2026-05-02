// Configuração de Web Push (chave pública VAPID)
// A chave pública pode ficar no código — apenas a privada é segredo.
export const VAPID_PUBLIC_KEY =
  "BEDgXC17SY6pUu6d_Aduc5_r77p5dAb7CQRMn-ZyKZxwLKOKkLgIjS1SIIu41sqR4w5fnFQsUDK2C16j6l6DHOM";

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

export function detectPlatform(): string {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/mac/i.test(ua)) return "macos";
  if (/win/i.test(ua)) return "windows";
  return "web";
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // @ts-ignore iOS
    window.navigator.standalone === true
  );
}
