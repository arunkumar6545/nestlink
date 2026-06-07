import { useEffect, useState } from "react";
import { AlertTriangle, X, ExternalLink } from "lucide-react";
import { supabase, isLocalFallback } from "@/lib/supabase";

/**
 * Shows a dismissable warning banner when the app cannot reach Supabase.
 * Only visible in development; always hidden in production.
 */
export function ConnectivityBanner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    if (import.meta.env.PROD) return;

    async function check() {
      try {
        // A lightweight health ping — just try to read 1 row; error means DB is down
        const { error } = await supabase.from("societies").select("id").limit(1);
        if (error && (error as { code?: string }).code !== "42501") {
          setVisible(true);
        } else {
          setVisible(false);
        }
      } catch {
        setVisible(true);
      }
    }

    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [dismissed]);

  if (!visible || dismissed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full">
      <div className="bg-amber-50 border border-amber-200 rounded-xl shadow-lg p-4 flex gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900">
            {isLocalFallback
              ? "Supabase env vars not set"
              : "Cannot reach Supabase"}
          </p>
          <p className="text-xs text-amber-700 mt-1 leading-relaxed">
            {isLocalFallback
              ? "Add VITE_SUPABASE_URL to apps/web/.env.local and restart the dev server."
              : "Start local Supabase with `make start` or check your network connection."}
          </p>
          <a
            href="https://supabase.com/docs/guides/local-development"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-amber-600 hover:underline mt-2"
          >
            Local dev docs <ExternalLink className="h-3 w-3" />
          </a>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-400 hover:text-amber-600 shrink-0"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
