// @ts-nocheck
import { useQuery } from "@tanstack/react-query";
import { Shield, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials, formatDateTime } from "@nestlink/core";

export default function GuardsPage() {
  const { profile } = useAuth();

  const { data: guards, isLoading } = useQuery({
    queryKey: ["admin-guards", profile?.society_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("role", "guard")
        .eq("society_id", profile!.society_id!);
      return data ?? [];
    },
    enabled: !!profile?.society_id,
  });

  const { data: recentLogs } = useQuery({
    queryKey: ["recent-visitor-logs", profile?.society_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("visitor_logs")
        .select(`
          id, action, timestamp, notes,
          user_profiles:guard_id (name),
          visitor_passes:pass_id (
            visitors:visitor_id (name)
          )
        `)
        .order("timestamp", { ascending: false })
        .limit(10);
      return data ?? [];
    },
    enabled: !!profile?.society_id,
  });

  return (
    <div className="animate-fade-in">
      <PageHeader title="Security Guards" description="Guard roster and recent activity" />

      <div className="p-8 space-y-8">
        {/* Guards List */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            Active Guards ({guards?.length ?? 0})
          </h2>
          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {guards?.map((g) => (
              <Card key={g.id}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={g.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(g.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-sm">{g.name}</p>
                      <p className="text-xs text-muted-foreground">{g.phone}</p>
                    </div>
                    <div className="ml-auto">
                      <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                        <Shield className="h-3 w-3" />
                        Guard
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent Logs */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            Recent Entry/Exit Logs
          </h2>
          <Card>
            <CardContent className="p-0">
              {recentLogs?.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-10">No logs yet</p>
              )}
              {recentLogs?.map((log) => {
                const guard = log.user_profiles as { name: string } | null;
                const pass = log.visitor_passes as { visitors: { name: string } | null } | null;
                const visitorName = pass?.visitors?.name ?? "Unknown";
                return (
                  <div key={log.id} className="flex items-center gap-4 px-5 py-3.5 border-b last:border-0">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 ${log.action === "checkin" ? "bg-green-100" : "bg-red-100"}`}>
                      <Clock className={`h-4 w-4 ${log.action === "checkin" ? "text-green-600" : "text-red-600"}`} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{visitorName}</p>
                      <p className="text-xs text-muted-foreground">
                        {log.action === "checkin" ? "Checked in" : "Checked out"} by {guard?.name}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(log.timestamp)}
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
