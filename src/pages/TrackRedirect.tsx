import { useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

export default function TrackRedirect() {
  const { source } = useParams<{ source: string }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const campaign = search.get("campaign");
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-click`;
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ source: source || "direct", campaign, path: window.location.pathname }),
      keepalive: true,
    }).catch(() => {}).finally(() => {
      navigate(`/register?ref=${encodeURIComponent(source || "direct")}`, { replace: true });
    });
  }, [source, search, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
