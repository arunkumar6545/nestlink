// @ts-nocheck
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Search, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/shared/PageHeader";
import { Input } from "@/components/ui/input";
import { getInitials, formatRelative } from "@nestlink/core";

export default function MessagesPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["conversations", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data } = await supabase
        .from("conversations")
        .select(`
          id, last_message_at, last_message_preview,
          participant1:participant1_id(id, name, avatar_url, flat_number),
          participant2:participant2_id(id, name, avatar_url, flat_number)
        `)
        .or(`participant1_id.eq.${profile.id},participant2_id.eq.${profile.id}`)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      return data ?? [];
    },
    enabled: !!profile?.id,
    refetchInterval: 5000,
  });

  // Resolve "the other person" in a conversation
  function otherParticipant(conv: any) {
    const p1 = conv.participant1 as { id: string; name: string; avatar_url: string; flat_number: string };
    const p2 = conv.participant2 as { id: string; name: string; avatar_url: string; flat_number: string };
    return p1?.id === profile?.id ? p2 : p1;
  }

  const filtered = conversations?.filter((c) => {
    const other = otherParticipant(c);
    return other?.name?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Messages"
        description="Your direct conversations"
      />

      <div className="p-6 space-y-4 max-w-2xl mx-auto">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && filtered?.length === 0 && (
          <div className="flex flex-col items-center py-20 gap-3 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground/30" />
            <p className="font-medium text-muted-foreground">No conversations yet</p>
            <p className="text-sm text-muted-foreground">
              Visit a member's profile to start a chat
            </p>
          </div>
        )}

        <div className="space-y-1">
          {filtered?.map((conv) => {
            const other = otherParticipant(conv);
            return (
              <button
                key={conv.id}
                onClick={() => navigate(`/messages/${conv.id}`)}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 hover:bg-muted/60 transition-colors text-left"
              >
                {/* Avatar */}
                {other?.avatar_url ? (
                  <img src={other.avatar_url} alt={other.name} className="h-11 w-11 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary shrink-0">
                    {getInitials(other?.name ?? "?")}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm truncate">{other?.name ?? "Unknown"}</p>
                    {conv.last_message_at && (
                      <p className="text-xs text-muted-foreground shrink-0 ml-2">
                        {formatRelative(conv.last_message_at)}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {conv.last_message_preview ?? "Start a conversation"}
                  </p>
                  {other?.flat_number && (
                    <p className="text-xs text-muted-foreground/70 mt-0.5">Flat {other.flat_number}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
