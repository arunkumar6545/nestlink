// @ts-nocheck
import { useQuery } from "@tanstack/react-query";
import { Building2, AlertCircle, CheckCircle2, Clock, TrendingDown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Link } from "react-router-dom";

type HealthBand = "green" | "amber" | "red";

function computeHealth(complaintRate: number, memberActivity: number): {
  score: number;
  band: HealthBand;
} {
  const complaintScore = Math.max(0, 100 - complaintRate * 100);
  const score = Math.round(complaintScore * 0.5 + memberActivity * 0.5);
  const band: HealthBand = score >= 70 ? "green" : score >= 40 ? "amber" : "red";
  return { score, band };
}

const BAND_STYLE: Record<HealthBand, string> = {
  green: "text-emerald-400 bg-emerald-500/10 border-emerald-700/30",
  amber: "text-amber-400 bg-amber-500/10 border-amber-700/30",
  red:   "text-rose-400 bg-rose-500/10 border-rose-700/30",
};

const BAND_ICON: Record<HealthBand, React.ElementType> = {
  green: CheckCircle2,
  amber: Clock,
  red:   TrendingDown,
};

export default function HealthPage() {
  const { data: societies } = useQuery({
    queryKey: ["health-societies"],
    queryFn: async () => {
      const { data } = await supabase
        .from("societies")
        .select("id, name, city, plan, status, total_units");
      return data ?? [];
    },
  });

  const { data: complaints } = useQuery({
    queryKey: ["health-complaints"],
    queryFn: async () => {
      const { data } = await supabase
        .from("complaints")
        .select("id, society_id, status");
      return data ?? [];
    },
  });

  const { data: members } = useQuery({
    queryKey: ["health-members"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("id, society_id, last_seen_at");
      return data ?? [];
    },
  });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const cards = (societies ?? []).map((soc) => {
    const socComplaints = (complaints ?? []).filter((c) => c.society_id === soc.id);
    const open = socComplaints.filter((c) => c.status !== "resolved").length;
    const total = socComplaints.length;
    const complaintRate = total > 0 ? open / total : 0;

    const socMembers = (members ?? []).filter((m) => m.society_id === soc.id);
    const activeMembers = socMembers.filter(
      (m) => m.last_seen_at && m.last_seen_at >= thirtyDaysAgo
    ).length;
    const memberActivity = socMembers.length > 0 ? (activeMembers / socMembers.length) * 100 : 0;

    const { score, band } = computeHealth(complaintRate, memberActivity);
    const Icon = BAND_ICON[band];

    return (
      <div key={soc.id} className={`rounded-xl border ${BAND_STYLE[band]} bg-[#181825] p-5`}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-slate-500" />
              <Link to={`/societies/${soc.id}`} className="text-sm font-semibold text-white hover:underline">
                {soc.name}
              </Link>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{soc.city} · {soc.plan}</p>
          </div>
          <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${BAND_STYLE[band]}`}>
            <Icon className="h-3.5 w-3.5" />
            {score}/100
          </div>
        </div>

        <div className="h-2 rounded-full bg-slate-800 overflow-hidden mb-3">
          <div
            className={`h-full rounded-full ${band === "green" ? "bg-emerald-500" : band === "amber" ? "bg-amber-500" : "bg-rose-500"}`}
            style={{ width: `${score}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-slate-800/60 p-2">
            <p className="text-slate-400">Open</p>
            <p className="font-bold text-white mt-0.5">{open}</p>
          </div>
          <div className="rounded-lg bg-slate-800/60 p-2">
            <p className="text-slate-400">Members</p>
            <p className="font-bold text-white mt-0.5">{socMembers.length}</p>
          </div>
          <div className="rounded-lg bg-slate-800/60 p-2">
            <p className="text-slate-400">Active 30d</p>
            <p className="font-bold text-white mt-0.5">{activeMembers}</p>
          </div>
        </div>
      </div>
    );
  });

  const greenCount = cards.length > 0 ? (societies ?? []).filter((_, i) => {
    const socComplaints = (complaints ?? []).filter(c => c.society_id === (societies ?? [])[i]?.id);
    const open = socComplaints.filter(c => c.status !== "resolved").length;
    const complaintRate = socComplaints.length > 0 ? open / socComplaints.length : 0;
    const { band } = computeHealth(complaintRate, 70);
    return band === "green";
  }).length : 0;

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Society Health</h1>
          <p className="text-slate-400 text-sm mt-1">
            Health scores across {(societies ?? []).length} societies — complaint resolution, member activity
          </p>
        </div>
        <div className="flex gap-3">
          {(["green", "amber", "red"] as HealthBand[]).map((band) => {
            const Icon = BAND_ICON[band];
            return (
              <div key={band} className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${BAND_STYLE[band]}`}>
                <Icon className="h-3.5 w-3.5" />
                {band.charAt(0).toUpperCase() + band.slice(1)}
              </div>
            );
          })}
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-600">
          <AlertCircle className="h-8 w-8 mb-3" />
          <p>No societies found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards}
        </div>
      )}
    </div>
  );
}
