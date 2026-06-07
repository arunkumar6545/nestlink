// @ts-nocheck
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, MessageSquare, Phone, Video, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useSocietyStore } from "@/store/society";
import { PageHeader } from "@/components/shared/PageHeader";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getInitials } from "@nestlink/core";

const ROLE_COLORS: Record<string, string> = {
  admin:   "bg-purple-100 text-purple-700",
  resident: "bg-sky-100 text-sky-700",
  guard:   "bg-amber-100 text-amber-700",
  staff:   "bg-green-100 text-green-700",
  super_admin: "bg-red-100 text-red-700",
};

export default function MemberDirectoryPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const activeSocietyId = useSocietyStore((s) => s.activeSocietyId);
  const societyId = activeSocietyId ?? profile?.society_id;
  const [search, setSearch] = useState("");

  const { data: members, isLoading } = useQuery({
    queryKey: ["member-directory", societyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("id, name, phone, role, flat_number, avatar_url, created_at")
        .eq("society_id", societyId)
        .order("name");
      return data ?? [];
    },
    enabled: !!societyId,
  });

  const filtered = members?.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.name?.toLowerCase().includes(q) ||
      m.flat_number?.toLowerCase().includes(q) ||
      m.role?.toLowerCase().includes(q) ||
      m.phone?.includes(q)
    );
  });

  // Quick DM — create/find conversation then navigate
  async function openDM(memberId: string) {
    const { data: convId } = await supabase.rpc("get_or_create_conversation", {
      other_user_id: memberId,
    });
    if (convId) navigate(`/messages/${convId}`);
  }

  // Start a call
  async function startCall(memberId: string, callType: "voice" | "video") {
    const callId = crypto.randomUUID();
    const { error } = await supabase.from("call_logs").insert({
      id: callId,
      caller_id: profile!.id,
      callee_id: memberId,
      call_type: callType,
      status: "ringing",
    });
    if (!error) navigate(`/call/${callId}?type=${callType}&callee=${memberId}`);
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Member Directory"
        description="Find and connect with your society members"
      />

      <div className="p-8 space-y-6">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, flat, role or phone…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Count */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>{filtered?.length ?? 0} member{filtered?.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-48 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered?.map((member) => {
              const isSelf = member.id === profile?.id;
              return (
                <div
                  key={member.id}
                  className="group relative flex flex-col items-center gap-3 rounded-2xl border bg-card p-5 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => navigate(`/members/${member.id}`)}
                >
                  {/* Avatar */}
                  <div className="relative">
                    {member.avatar_url ? (
                      <img
                        src={member.avatar_url}
                        alt={member.name}
                        className="h-16 w-16 rounded-full object-cover ring-2 ring-primary/20"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/80 to-primary text-white text-xl font-bold ring-2 ring-primary/20">
                        {getInitials(member.name ?? "?")}
                      </div>
                    )}
                    {isSelf && (
                      <span className="absolute -bottom-1 -right-1 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-white">
                        You
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="text-center min-w-0 w-full">
                    <p className="font-semibold text-sm truncate">{member.name}</p>
                    {member.flat_number && (
                      <p className="text-xs text-muted-foreground">Flat {member.flat_number}</p>
                    )}
                    <div className="mt-1.5 flex justify-center">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${ROLE_COLORS[member.role] ?? "bg-muted text-muted-foreground"}`}>
                        {member.role?.replace("_", " ")}
                      </span>
                    </div>
                  </div>

                  {/* Quick actions (show on hover, hidden for self) */}
                  {!isSelf && (
                    <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-2xl bg-card/90 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                      <button
                        onClick={(e) => { e.stopPropagation(); openDM(member.id); }}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white hover:bg-primary/90 transition-colors shadow-md"
                        title="Send message"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); startCall(member.id, "voice"); }}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-md"
                        title="Voice call"
                      >
                        <Phone className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); startCall(member.id, "video"); }}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-600 text-white hover:bg-sky-700 transition-colors shadow-md"
                        title="Video call"
                      >
                        <Video className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!isLoading && filtered?.length === 0 && (
          <div className="flex flex-col items-center py-20 gap-3">
            <Users className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground font-medium">No members found</p>
          </div>
        )}
      </div>
    </div>
  );
}
