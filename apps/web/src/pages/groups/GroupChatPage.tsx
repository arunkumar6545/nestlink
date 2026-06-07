// @ts-nocheck
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, Send, Users, Settings, MoreVertical,
  Loader2, Smile, Reply, X, ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRelative } from "@nestlink/core";

// ─── Types ────────────────────────────────────────────────────────

interface Message {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  reply_to_id: string | null;
  is_deleted: boolean;
  created_at: string;
  sender?: { name: string; role: string };
  reply_to?: { content: string; sender?: { name: string } };
}

// ─── Main Component ───────────────────────────────────────────────

export default function GroupChatPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const basePath = pathname.startsWith("/admin") ? "/admin" : "/resident";
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showMembers, setShowMembers] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── Group info ────────────────────────────────────────────────
  const { data: group } = useQuery({
    queryKey: ["group", groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from("groups")
        .select("id, name, description, purpose, type, member_count, created_by")
        .eq("id", groupId)
        .single();
      return data;
    },
    enabled: !!groupId,
  });

  // ── Am I admin of this group? ─────────────────────────────────
  const { data: myMembership } = useQuery({
    queryKey: ["my-group-membership", groupId, profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("group_members")
        .select("role")
        .eq("group_id", groupId)
        .eq("user_id", profile!.id)
        .single();
      return data;
    },
    enabled: !!groupId && !!profile?.id,
  });

  const isAdmin = myMembership?.role === "admin";

  // ── Messages ──────────────────────────────────────────────────
  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: ["group-messages", groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from("group_messages")
        .select(`
          id, group_id, sender_id, content, message_type,
          reply_to_id, is_deleted, created_at,
          sender:sender_id(name, role),
          reply_to:reply_to_id(content, sender:sender_id(name))
        `)
        .eq("group_id", groupId)
        .order("created_at", { ascending: true })
        .limit(100);
      return (data ?? []) as Message[];
    },
    enabled: !!groupId,
  });

  // ── Realtime subscription ──────────────────────────────────────
  useEffect(() => {
    if (!groupId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = (supabase as any)
      .channel(`group-chat-${groupId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "group_messages",
        filter: `group_id=eq.${groupId}`,
      }, async (payload: { new: Message }) => {
        // Fetch sender info for the new message
        const { data: full } = await supabase
          .from("group_messages")
          .select(`
            id, group_id, sender_id, content, message_type,
            reply_to_id, is_deleted, created_at,
            sender:sender_id(name, role),
            reply_to:reply_to_id(content, sender:sender_id(name))
          `)
          .eq("id", payload.new.id)
          .single();

        if (full) {
          queryClient.setQueryData<Message[]>(["group-messages", groupId], (prev) => [
            ...(prev ?? []),
            full as Message,
          ]);
        }
      })
      .subscribe();

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).removeChannel(channel);
    };
  }, [groupId, queryClient]);

  // ── Auto-scroll to bottom ─────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ──────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: async ({ content, replyToId }: { content: string; replyToId?: string }) => {
      const { error } = await supabase.from("group_messages").insert({
        group_id: groupId,
        sender_id: profile!.id,
        content: content.trim(),
        message_type: "text",
        reply_to_id: replyToId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setInput("");
      setReplyTo(null);
      inputRef.current?.focus();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;
    sendMutation.mutate({ content: trimmed, replyToId: replyTo?.id });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ── Delete message ────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (msgId: string) => {
      const { error } = await supabase
        .from("group_messages")
        .update({ is_deleted: true, content: "This message was deleted" })
        .eq("id", msgId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-messages", groupId] });
    },
  });

  // ── Group members ─────────────────────────────────────────────
  const { data: members } = useQuery({
    queryKey: ["group-members-list", groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from("group_members")
        .select(`
          role, joined_at,
          user:user_id(id, name, phone, role)
        `)
        .eq("group_id", groupId)
        .order("role");
      return data ?? [];
    },
    enabled: !!groupId,
  });

  // ── Group members sidebar content ─────────────────────────────
  const MembersSidebar = useCallback(() => (
    <div className="w-64 border-l flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <p className="font-semibold text-sm flex items-center gap-2">
          <Users className="h-4 w-4" />
          Members ({group?.member_count ?? 0})
        </p>
        <button onClick={() => setShowMembers(false)} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {members?.map((m) => {
          const u = m.user as { id: string; name: string; phone: string; role: string };
          return (
            <div key={u?.id} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-muted/50">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary shrink-0">
                {u?.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{u?.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{u?.role}</p>
              </div>
              {m.role === "admin" && (
                <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
              )}
            </div>
          );
        })}
      </div>
      {isAdmin && (
        <div className="p-3 border-t">
          <Button
            size="sm"
            variant="outline"
            className="w-full"
              onClick={() => navigate(`${basePath}/groups/${groupId}/manage`)}
          >
            <Settings className="h-3.5 w-3.5 mr-1.5" />
            Manage Group
          </Button>
        </div>
      )}
    </div>
  ), [members, group, isAdmin, groupId, navigate]);

  const PURPOSE_EMOJI: Record<string, string> = {
    general: "💬", sports: "🏏", cultural: "🎭",
    welfare: "🤝", emergency: "🚨", parents: "👨‍👩‍👧", other: "📌",
  };

  return (
    <div className="flex h-full">
      {/* ── Main chat area ────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-background/90 backdrop-blur-sm sticky top-0 z-10">
          <button
            onClick={() => navigate(`${basePath}/groups`)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-xl shrink-0">
            {PURPOSE_EMOJI[group?.purpose ?? "general"] ?? "💬"}
          </div>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{group?.name ?? "Loading…"}</p>
            <p className="text-xs text-muted-foreground">
              {group?.member_count ?? 0} members · {
                group?.type === "open" ? "Open group"
                  : group?.type === "invite_only" ? "Invite only"
                  : "Request to join"
              }
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowMembers((p) => !p)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors",
                showMembers
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">{group?.member_count}</span>
            </button>
            {isAdmin && (
              <button
                onClick={() => navigate(`${basePath}/groups/${groupId}/manage`)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
              >
                <Settings className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          {isLoading && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && messages?.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full py-16 gap-3 text-center">
              <div className="text-5xl">{PURPOSE_EMOJI[group?.purpose ?? "general"]}</div>
              <p className="font-semibold text-muted-foreground">No messages yet</p>
              <p className="text-sm text-muted-foreground">Be the first to say something!</p>
            </div>
          )}

          {messages?.map((msg, i) => {
            const isMine = msg.sender_id === profile?.id;
            const showAvatar = !isMine && (i === 0 || messages[i - 1].sender_id !== msg.sender_id);
            const showName = showAvatar;
            const sender = msg.sender as { name: string; role: string } | null;

            return (
              <div key={msg.id} className={cn("flex gap-2 group", isMine ? "flex-row-reverse" : "flex-row")}>
                {/* Avatar */}
                <div className={cn("shrink-0 w-8", isMine ? "hidden" : "")}>
                  {showAvatar ? (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {sender?.name?.charAt(0)?.toUpperCase() ?? "?"}
                    </div>
                  ) : null}
                </div>

                {/* Bubble */}
                <div className={cn("max-w-[70%] space-y-1", isMine ? "items-end" : "items-start", "flex flex-col")}>
                  {showName && !isMine && (
                    <p className="text-xs text-muted-foreground ml-1">
                      {sender?.name}
                      {sender?.role === "admin" && (
                        <span className="ml-1 text-primary font-semibold">Admin</span>
                      )}
                    </p>
                  )}

                  {/* Reply preview */}
                  {msg.reply_to_id && msg.reply_to && (
                    <div className={cn(
                      "rounded-t-lg border-l-2 border-primary px-3 py-1.5 text-xs text-muted-foreground bg-muted/50 max-w-full",
                      isMine ? "rounded-l-none" : ""
                    )}>
                      <p className="font-semibold text-primary text-[11px]">
                        {(msg.reply_to as { sender?: { name: string } })?.sender?.name ?? "Unknown"}
                      </p>
                      <p className="truncate">{(msg.reply_to as { content: string })?.content}</p>
                    </div>
                  )}

                  <div className={cn(
                    "relative rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    isMine
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted rounded-tl-sm",
                    msg.is_deleted && "opacity-60 italic",
                    msg.reply_to_id && "rounded-tl-sm rounded-tr-sm"
                  )}>
                    {msg.content}

                    {/* Hover actions */}
                    {!msg.is_deleted && (
                      <div className={cn(
                        "absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1",
                        isMine ? "-left-20" : "-right-20"
                      )}>
                        <button
                          onClick={() => setReplyTo(msg)}
                          className="p-1.5 rounded-lg bg-background border shadow-sm text-muted-foreground hover:text-foreground"
                          title="Reply"
                        >
                          <Reply className="h-3 w-3" />
                        </button>
                        {(isMine || isAdmin) && (
                          <button
                            onClick={() => deleteMutation.mutate(msg.id)}
                            className="p-1.5 rounded-lg bg-background border shadow-sm text-muted-foreground hover:text-destructive"
                            title="Delete"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <p className={cn("text-[10px] text-muted-foreground px-1", isMine ? "text-right" : "")}>
                    {formatRelative(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Reply preview bar */}
        {replyTo && (
          <div className="flex items-center gap-3 px-4 py-2 border-t bg-muted/30">
            <Reply className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-primary">
                Replying to {(replyTo.sender as { name: string })?.name ?? "Unknown"}
              </p>
              <p className="text-xs text-muted-foreground truncate">{replyTo.content}</p>
            </div>
            <button
              onClick={() => setReplyTo(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Input */}
        <div className="border-t p-3 bg-background">
          <div className="flex items-end gap-2 bg-muted rounded-xl px-3 py-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
              className="flex-1 bg-transparent resize-none text-sm outline-none min-h-[20px] max-h-32 py-1 leading-relaxed"
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sendMutation.isPending}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40 transition-all hover:bg-primary/90 shrink-0"
            >
              {sendMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-1.5">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>

      {/* ── Members sidebar ─────────────────────────────── */}
      {showMembers && <MembersSidebar />}
    </div>
  );
}
