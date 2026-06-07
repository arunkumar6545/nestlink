// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Phone, Video, Reply, X, Send, Loader2, User,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { getInitials, formatRelative } from "@nestlink/core";

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  is_deleted: boolean;
  reply_to_id: string | null;
  created_at: string;
  sender?: { name: string };
  reply_to?: { content: string; sender?: { name: string } };
}

export default function DirectChatPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  // ── Conversation info ─────────────────────────────────────────
  const { data: conversation } = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("conversations")
        .select(`
          id,
          participant1:participant1_id(id, name, avatar_url, flat_number),
          participant2:participant2_id(id, name, avatar_url, flat_number)
        `)
        .eq("id", conversationId)
        .single();
      return data;
    },
    enabled: !!conversationId,
  });

  const other = conversation
    ? (conversation.participant1 as { id: string; name: string; avatar_url: string }).id === profile?.id
      ? conversation.participant2 as { id: string; name: string; avatar_url: string; flat_number: string }
      : conversation.participant1 as { id: string; name: string; avatar_url: string; flat_number: string }
    : null;

  // ── Messages ──────────────────────────────────────────────────
  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: ["dm", conversationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("direct_messages")
        .select(`
          id, conversation_id, sender_id, content, message_type, is_deleted, reply_to_id, created_at,
          sender:sender_id(name),
          reply_to:reply_to_id(content, sender:sender_id(name))
        `)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(100);
      return (data ?? []) as Message[];
    },
    enabled: !!conversationId,
  });

  // ── Realtime subscription ─────────────────────────────────────
  useEffect(() => {
    if (!conversationId) return;
    const channel = (supabase as any)
      .channel(`dm-${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "direct_messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, async (payload: { new: Message }) => {
        const { data: full } = await supabase
          .from("direct_messages")
          .select("id, conversation_id, sender_id, content, message_type, is_deleted, reply_to_id, created_at, sender:sender_id(name), reply_to:reply_to_id(content, sender:sender_id(name))")
          .eq("id", payload.new.id)
          .single();
        if (full) {
          queryClient.setQueryData<Message[]>(["dm", conversationId], (prev) => [...(prev ?? []), full as Message]);
        }
      })
      .subscribe();

    return () => { (supabase as any).removeChannel(channel); };
  }, [conversationId, queryClient]);

  // ── Auto-scroll ───────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Mark read ─────────────────────────────────────────────────
  useEffect(() => {
    if (!conversationId || !profile?.id) return;
    supabase.from("direct_messages")
      .update({ is_read: true })
      .eq("conversation_id", conversationId)
      .neq("sender_id", profile.id)
      .eq("is_read", false)
      .then(() => {});
  }, [conversationId, messages, profile?.id]);

  // ── Send ──────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: async ({ content, replyToId }: { content: string; replyToId?: string }) => {
      const { error } = await supabase.from("direct_messages").insert({
        conversation_id: conversationId,
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
  });

  function handleSend() {
    const t = input.trim();
    if (!t) return;
    sendMutation.mutate({ content: t, replyToId: replyTo?.id });
  }

  // ── Call actions ──────────────────────────────────────────────
  async function startCall(callType: "voice" | "video") {
    if (!other) return;
    const callId = crypto.randomUUID();
    const { error } = await supabase.from("call_logs").insert({
      id: callId, caller_id: profile!.id, callee_id: other.id,
      call_type: callType, status: "ringing",
    });
    if (!error) navigate(`/call/${callId}?type=${callType}&callee=${other.id}`);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-background/90 backdrop-blur-sm sticky top-0 z-10 shrink-0">
        <button onClick={() => navigate("/messages")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>

        <button onClick={() => other && navigate(`/members/${other.id}`)} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
          {other?.avatar_url ? (
            <img src={other.avatar_url} alt={other.name} className="h-9 w-9 rounded-full object-cover shrink-0" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary shrink-0">
              {getInitials(other?.name ?? "?")}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{other?.name ?? "…"}</p>
            {other?.flat_number && (
              <p className="text-xs text-muted-foreground">Flat {other.flat_number}</p>
            )}
          </div>
        </button>

        <div className="flex gap-1 shrink-0">
          <button onClick={() => startCall("voice")} className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors" title="Voice call">
            <Phone className="h-4 w-4" />
          </button>
          <button onClick={() => startCall("video")} className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors" title="Video call">
            <Video className="h-4 w-4" />
          </button>
          <button onClick={() => other && navigate(`/members/${other.id}`)} className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors" title="View profile">
            <User className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {isLoading && <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
        {!isLoading && messages?.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-16 gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <MessageSquare className="h-7 w-7 text-primary" />
            </div>
            <p className="font-semibold text-muted-foreground">Start the conversation</p>
            <p className="text-sm text-muted-foreground">Say hello to {other?.name ?? "them"}!</p>
          </div>
        )}

        {messages?.map((msg, i) => {
          const isMine = msg.sender_id === profile?.id;
          const prevMsg = messages[i - 1];
          const showSenderName = !isMine && prevMsg?.sender_id !== msg.sender_id;
          const sender = msg.sender as { name: string } | null;

          return (
            <div key={msg.id} className={cn("flex gap-2 group", isMine ? "flex-row-reverse" : "flex-row")}>
              {/* Avatar for other */}
              <div className={cn("shrink-0 w-8", isMine && "hidden")}>
                {showSenderName && other?.avatar_url ? (
                  <img src={other.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : showSenderName ? (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                    {getInitials(sender?.name ?? "?")}
                  </div>
                ) : null}
              </div>

              <div className={cn("max-w-[70%] flex flex-col", isMine ? "items-end" : "items-start")}>
                {/* Reply preview */}
                {msg.reply_to_id && msg.reply_to && (
                  <div className="border-l-2 border-primary px-2.5 py-1 mb-1 bg-muted/50 rounded-lg text-xs text-muted-foreground max-w-full">
                    <p className="font-semibold text-primary text-[11px]">
                      {(msg.reply_to as { sender?: { name: string } })?.sender?.name ?? "Unknown"}
                    </p>
                    <p className="truncate">{(msg.reply_to as { content: string }).content}</p>
                  </div>
                )}

                <div className={cn(
                  "relative rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  isMine
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted rounded-tl-sm",
                  msg.is_deleted && "opacity-60 italic"
                )}>
                  {msg.content}

                  {/* Hover: reply button */}
                  {!msg.is_deleted && (
                    <button
                      onClick={() => setReplyTo(msg)}
                      className={cn(
                        "absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md bg-background border shadow-sm text-muted-foreground hover:text-foreground",
                        isMine ? "-left-8" : "-right-8"
                      )}
                    >
                      <Reply className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground px-1 mt-0.5">
                  {formatRelative(msg.created_at)}
                  {isMine && <span className="ml-1">{msg.is_read ? "✓✓" : "✓"}</span>}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Reply bar */}
      {replyTo && (
        <div className="flex items-center gap-3 px-4 py-2 border-t bg-muted/30 shrink-0">
          <Reply className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-primary">
              {(replyTo.sender as { name: string })?.name ?? "Unknown"}
            </p>
            <p className="text-xs text-muted-foreground truncate">{replyTo.content}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="border-t p-3 bg-background shrink-0">
        <div className="flex items-end gap-2 bg-muted rounded-xl px-3 py-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder="Message…"
            className="flex-1 bg-transparent resize-none text-sm outline-none min-h-[20px] max-h-32 py-1 leading-relaxed"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sendMutation.isPending}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-40 transition-all hover:bg-primary/90 shrink-0"
          >
            {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
