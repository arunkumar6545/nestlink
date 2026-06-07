// @ts-nocheck
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, MessageSquare, Phone, Video,
  Heart, MessageCircle, Send, Loader2, Edit,
  Home, Calendar, Shield,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { getInitials, formatRelative } from "@nestlink/core";

export default function MemberProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isSelf = userId === profile?.id;

  const [newPost, setNewPost] = useState("");
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  // ── Member info ────────────────────────────────────────────────
  const { data: member } = useQuery({
    queryKey: ["member-profile", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_profiles")
        .select("id, name, phone, role, flat_number, avatar_url, created_at, society_id")
        .eq("id", userId)
        .single();
      return data;
    },
    enabled: !!userId,
  });

  // ── Member posts ───────────────────────────────────────────────
  const { data: posts, isLoading: postsLoading } = useQuery({
    queryKey: ["member-posts", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("member_posts")
        .select(`
          id, content, media_url, media_type, likes_count, comments_count, created_at,
          my_like:post_likes(user_id)
        `)
        .eq("author_id", userId)
        .order("created_at", { ascending: false });
      // Inject liked flag
      return (data ?? []).map((p) => ({
        ...p,
        liked: (p.my_like as { user_id: string }[])?.some((l) => l.user_id === profile?.id) ?? false,
      }));
    },
    enabled: !!userId && !!profile?.id,
  });

  // ── Shared groups ──────────────────────────────────────────────
  const { data: sharedGroups } = useQuery({
    queryKey: ["shared-groups", userId, profile?.id],
    queryFn: async () => {
      if (!profile?.id || isSelf) return [];
      const { data } = await supabase
        .from("group_members")
        .select("group:group_id(id, name, purpose)")
        .eq("user_id", profile.id)
        .in(
          "group_id",
          (await supabase.from("group_members").select("group_id").eq("user_id", userId!)).data?.map((m) => m.group_id) ?? []
        );
      return (data ?? []).map((d) => d.group);
    },
    enabled: !!userId && !!profile?.id && !isSelf,
  });

  // ── Create post (self only) ────────────────────────────────────
  const postMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from("member_posts").insert({
        society_id: profile!.society_id,
        author_id: profile!.id,
        content: content.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-posts", userId] });
      setNewPost("");
      toast.success("Post shared!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Like / unlike ──────────────────────────────────────────────
  const likeMutation = useMutation({
    mutationFn: async ({ postId, liked }: { postId: string; liked: boolean }) => {
      if (liked) {
        await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", profile!.id);
      } else {
        await supabase.from("post_likes").insert({ post_id: postId, user_id: profile!.id });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["member-posts"] }),
  });

  // ── Comment ────────────────────────────────────────────────────
  const commentMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      const { error } = await supabase.from("post_comments").insert({
        post_id: postId,
        author_id: profile!.id,
        content: content.trim(),
      });
      if (error) throw error;
    },
    onSuccess: (_, { postId }) => {
      queryClient.invalidateQueries({ queryKey: ["member-posts"] });
      queryClient.invalidateQueries({ queryKey: ["post-comments", postId] });
      setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
    },
  });

  // ── Start DM / Call ────────────────────────────────────────────
  async function openDM() {
    const { data: convId } = await supabase.rpc("get_or_create_conversation", {
      other_user_id: userId,
    });
    if (convId) navigate(`/messages/${convId}`);
  }

  async function startCall(callType: "voice" | "video") {
    const callId = crypto.randomUUID();
    const { error } = await supabase.from("call_logs").insert({
      id: callId, caller_id: profile!.id, callee_id: userId,
      call_type: callType, status: "ringing",
    });
    if (!error) navigate(`/call/${callId}?type=${callType}&callee=${userId}`);
  }

  const ROLE_LABEL: Record<string, string> = {
    admin: "🛡 Admin", resident: "🏠 Resident",
    guard: "🔐 Guard", staff: "🔧 Staff", super_admin: "⭐ Super Admin",
  };

  if (!member) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      {/* Back */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b bg-background/90 backdrop-blur-sm">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <p className="font-semibold text-sm">{member.name}'s Profile</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Profile card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              {member.avatar_url ? (
                <img src={member.avatar_url} alt={member.name} className="h-20 w-20 rounded-2xl object-cover ring-2 ring-primary/20" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/70 to-primary text-white text-2xl font-bold ring-2 ring-primary/20">
                  {getInitials(member.name ?? "?")}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold">{member.name}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {ROLE_LABEL[member.role] ?? member.role}
                </p>

                <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  {member.flat_number && (
                    <p className="flex items-center gap-2">
                      <Home className="h-3.5 w-3.5" />
                      Flat {member.flat_number}
                    </p>
                  )}
                  <p className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Member since {new Date(member.created_at).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                  </p>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            {!isSelf ? (
              <div className="flex gap-3 mt-5">
                <Button className="flex-1" onClick={openDM}>
                  <MessageSquare className="h-4 w-4" /> Message
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => startCall("voice")}>
                  <Phone className="h-4 w-4 text-emerald-600" /> Voice Call
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => startCall("video")}>
                  <Video className="h-4 w-4 text-sky-600" /> Video Call
                </Button>
              </div>
            ) : (
              <Button variant="outline" className="mt-5 w-full" onClick={() => navigate("/resident/profile")}>
                <Edit className="h-4 w-4" /> Edit Profile
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Shared groups */}
        {!isSelf && sharedGroups && sharedGroups.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Shared Groups
            </p>
            <div className="flex flex-wrap gap-2">
              {sharedGroups.map((g) => (
                <span key={g.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-sm cursor-pointer hover:bg-primary/10 transition-colors"
                  onClick={() => navigate(`/resident/groups/${g.id}`)}>
                  <Shield className="h-3 w-3 text-primary" />
                  {g.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Posts */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold flex items-center gap-2">
              Posts
              <span className="text-sm text-muted-foreground font-normal">({posts?.length ?? 0})</span>
            </p>
          </div>

          {/* New post form (self only) */}
          {isSelf && (
            <div className="mb-5 flex gap-3 items-start">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white text-sm font-bold shrink-0">
                {getInitials(profile.name ?? "?")}
              </div>
              <div className="flex-1 space-y-2">
                <Textarea
                  placeholder="Share something with your society…"
                  className="resize-none min-h-[80px]"
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  maxLength={2000}
                />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{newPost.length}/2000</span>
                  <Button
                    size="sm"
                    onClick={() => newPost.trim() && postMutation.mutate(newPost)}
                    disabled={!newPost.trim() || postMutation.isPending}
                  >
                    {postMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (
                      <><Send className="h-3.5 w-3.5" /> Post</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Posts list */}
          {postsLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!postsLoading && posts?.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No posts yet</p>
            </div>
          )}
          <div className="space-y-4">
            {posts?.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                author={member}
                onLike={() => likeMutation.mutate({ postId: post.id, liked: post.liked })}
                showComments={expandedComments.has(post.id)}
                onToggleComments={() => setExpandedComments((prev) => {
                  const next = new Set(prev);
                  next.has(post.id) ? next.delete(post.id) : next.add(post.id);
                  return next;
                })}
                commentInput={commentInputs[post.id] ?? ""}
                onCommentChange={(v) => setCommentInputs((prev) => ({ ...prev, [post.id]: v }))}
                onCommentSubmit={() => {
                  const c = commentInputs[post.id]?.trim();
                  if (c) commentMutation.mutate({ postId: post.id, content: c });
                }}
                currentUserId={profile?.id}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PostCard ─────────────────────────────────────────────────────

function PostCard({ post, author, onLike, showComments, onToggleComments, commentInput, onCommentChange, onCommentSubmit, currentUserId }) {
  const { data: comments } = useQuery({
    queryKey: ["post-comments", post.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("post_comments")
        .select("id, content, created_at, author:author_id(id, name)")
        .eq("post_id", post.id)
        .order("created_at")
        .limit(20);
      return data ?? [];
    },
    enabled: showComments,
  });

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Author + time */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary shrink-0">
            {getInitials(author.name ?? "?")}
          </div>
          <div>
            <p className="text-sm font-semibold">{author.name}</p>
            <p className="text-xs text-muted-foreground">{formatRelative(post.created_at)}</p>
          </div>
        </div>

        {/* Content */}
        <p className="text-sm leading-relaxed whitespace-pre-line">{post.content}</p>

        {/* Media */}
        {post.media_url && post.media_type === "image" && (
          <img src={post.media_url} alt="post" className="rounded-xl w-full object-cover max-h-72" />
        )}

        {/* Actions */}
        <div className="flex items-center gap-4 pt-1 text-sm text-muted-foreground">
          <button
            onClick={onLike}
            className={`flex items-center gap-1.5 transition-colors ${post.liked ? "text-red-500" : "hover:text-red-400"}`}
          >
            <Heart className={`h-4 w-4 ${post.liked ? "fill-red-500" : ""}`} />
            {post.likes_count}
          </button>
          <button
            onClick={onToggleComments}
            className="flex items-center gap-1.5 hover:text-primary transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            {post.comments_count}
          </button>
        </div>

        {/* Comments section */}
        {showComments && (
          <div className="space-y-3 border-t pt-3">
            {comments?.map((c) => {
              const a = c.author as { id: string; name: string };
              return (
                <div key={c.id} className="flex gap-2.5 items-start">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold shrink-0">
                    {getInitials(a?.name ?? "?")}
                  </div>
                  <div className="flex-1 bg-muted rounded-xl px-3 py-1.5">
                    <p className="text-xs font-semibold">{a?.name}</p>
                    <p className="text-xs mt-0.5">{c.content}</p>
                  </div>
                </div>
              );
            })}
            <div className="flex gap-2 items-center">
              <input
                className="flex-1 bg-muted rounded-full px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
                placeholder="Write a comment…"
                value={commentInput}
                onChange={(e) => onCommentChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onCommentSubmit()}
              />
              <button
                onClick={onCommentSubmit}
                disabled={!commentInput?.trim()}
                className="p-1.5 rounded-full bg-primary text-white disabled:opacity-40"
              >
                <Send className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
