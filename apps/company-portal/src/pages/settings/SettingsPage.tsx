// @ts-nocheck
import { useState } from "react";
import { toast } from "sonner";
import { Settings, Zap, CheckCircle2, Building2, CreditCard } from "lucide-react";

const PLANS = ["trial", "free", "pro", "enterprise"];

const DEFAULT_FEATURES: Record<string, Record<string, boolean>> = {
  trial:      { groups: true,  marketplace: true,  document_vault: true,  video_calls: true,  realtime: true  },
  free:       { groups: false, marketplace: true,  document_vault: false, video_calls: false, realtime: false },
  pro:        { groups: true,  marketplace: true,  document_vault: true,  video_calls: true,  realtime: true  },
  enterprise: { groups: true,  marketplace: true,  document_vault: true,  video_calls: true,  realtime: true  },
};

const FEATURE_LABELS = [
  { key: "groups",         label: "Group Chats",       desc: "Members can create and join groups" },
  { key: "marketplace",    label: "Marketplace",       desc: "Buy & Sell listings within society" },
  { key: "document_vault", label: "Document Vault",    desc: "HOA document storage and sharing" },
  { key: "video_calls",    label: "Video Calls",       desc: "WebRTC voice and video calls between members" },
  { key: "realtime",       label: "Real-time Updates", desc: "Live data sync via Supabase Realtime" },
];

export default function SettingsPage() {
  const [features, setFeatures] = useState(DEFAULT_FEATURES);
  const [saved, setSaved]       = useState(false);

  function toggle(plan: string, key: string) {
    setFeatures((prev) => ({
      ...prev,
      [plan]: { ...prev[plan], [key]: !prev[plan][key] },
    }));
    setSaved(false);
  }

  function save() {
    // In production this would write to a platform_settings table
    toast.success("Feature flags saved (local only in dev)");
    setSaved(true);
  }

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Platform Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Configure feature availability by plan and other platform defaults</p>
      </div>

      {/* Feature Flags by Plan */}
      <div className="rounded-2xl border border-violet-900/20 bg-[#13131f] overflow-hidden">
        <div className="px-5 py-4 border-b border-violet-900/15 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Zap className="h-4 w-4 text-violet-400" /> Feature Flags by Plan
          </h3>
          <button
            onClick={save}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
              saved
                ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                : "bg-violet-600 hover:bg-violet-500 text-white"
            }`}
          >
            {saved ? <><CheckCircle2 className="h-3.5 w-3.5" /> Saved</> : "Save Changes"}
          </button>
        </div>

        {/* Header row */}
        <div className="grid grid-cols-[1fr_repeat(4,auto)] px-5 py-3 border-b border-violet-900/10 gap-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Feature</span>
          {PLANS.map((p) => (
            <span key={p} className="text-[10px] font-bold uppercase tracking-widest text-slate-600 w-20 text-center capitalize">{p}</span>
          ))}
        </div>

        {FEATURE_LABELS.map(({ key, label, desc }) => (
          <div key={key} className="grid grid-cols-[1fr_repeat(4,auto)] px-5 py-4 border-b border-violet-900/10 last:border-0 items-center gap-4 hover:bg-[#1a1a2e] transition-colors">
            <div>
              <p className="text-sm font-medium text-white">{label}</p>
              <p className="text-xs text-slate-500">{desc}</p>
            </div>
            {PLANS.map((plan) => (
              <div key={plan} className="w-20 flex justify-center">
                <button
                  onClick={() => toggle(plan, key)}
                  className={`relative h-5 w-9 rounded-full transition-colors ${features[plan][key] ? "bg-violet-600" : "bg-slate-700"}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${features[plan][key] ? "translate-x-4" : "translate-x-0.5"}`} />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Platform Info */}
      <div className="rounded-2xl border border-violet-900/20 bg-[#13131f] p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Settings className="h-4 w-4 text-violet-400" /> Platform Information
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            ["Company",       "Nestlink Technology Pvt. Ltd."],
            ["Version",       "1.0.0"],
            ["Environment",   "Development (Local Supabase)"],
            ["Database",      "PostgreSQL 15 via Supabase"],
            ["Auth",          "Supabase Phone OTP"],
            ["Storage",       "Supabase Storage"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-violet-900/10 pb-3">
              <span className="text-slate-500">{k}</span>
              <span className="text-white font-medium text-right">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Plan Pricing Config */}
      <div className="rounded-2xl border border-violet-900/20 bg-[#13131f] p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-violet-400" /> Pricing Reference
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { plan: "trial",      price: "Free",       duration: "30 days",   color: "border-amber-700/30 text-amber-300" },
            { plan: "free",       price: "₹0/mo",      duration: "Unlimited", color: "border-slate-700/30 text-slate-400" },
            { plan: "pro",        price: "₹4,999/mo",  duration: "Unlimited", color: "border-sky-700/30 text-sky-300" },
            { plan: "enterprise", price: "Custom",     duration: "Custom SLA",color: "border-violet-700/30 text-violet-300" },
          ].map(({ plan, price, duration, color }) => (
            <div key={plan} className={`rounded-xl border p-3.5 bg-white/2 ${color.split(" ")[0]}`}>
              <p className={`text-xs font-bold uppercase ${color.split(" ")[1]}`}>{plan}</p>
              <p className="text-lg font-bold text-white mt-2">{price}</p>
              <p className="text-xs text-slate-500">{duration}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
