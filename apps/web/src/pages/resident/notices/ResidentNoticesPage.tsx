// @ts-nocheck
import { useQuery } from "@tanstack/react-query";
import { Pin, Bell } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { formatRelative } from "@nestlink/core";

export default function ResidentNoticesPage() {
  const { profile } = useAuth();

  const { data: notices, isLoading } = useQuery({
    queryKey: ["resident-notices-full", profile?.society_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notices")
        .select("*")
        .eq("society_id", profile!.society_id!)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!profile?.society_id,
  });

  return (
    <div className="animate-fade-in">
      <PageHeader title="Notices & Announcements" description="Stay updated with society news" />
      <div className="p-8 space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground text-center py-10">Loading...</p>}
        {!isLoading && notices?.length === 0 && (
          <div className="text-center py-20">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No notices yet</p>
          </div>
        )}
        {notices?.map((notice) => (
          <Card key={notice.id} className={notice.pinned ? "border-primary/40 bg-primary/5" : ""}>
            <CardContent className="p-5">
              <div className="flex items-start gap-2 mb-2">
                {notice.pinned && <Pin className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />}
                <h3 className="font-semibold text-sm">{notice.title}</h3>
                <div className="ml-auto">
                  <StatusBadge status={notice.type} />
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{notice.body}</p>
              <p className="text-xs text-muted-foreground mt-3">{formatRelative(notice.created_at)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
