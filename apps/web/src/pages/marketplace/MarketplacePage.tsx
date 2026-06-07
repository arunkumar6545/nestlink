// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Plus, Search, Tag, Heart, HeartOff, MessageSquare,
  ShoppingBag, Loader2, CheckCircle, X, Filter,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useSocietyStore } from "@/store/society";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatRelative } from "@nestlink/core";

// ─── Constants ────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "furniture",   label: "Furniture",    emoji: "🛋️" },
  { value: "electronics", label: "Electronics",  emoji: "📱" },
  { value: "vehicle",     label: "Vehicle",      emoji: "🚗" },
  { value: "appliance",   label: "Appliance",    emoji: "🏠" },
  { value: "books",       label: "Books",        emoji: "📚" },
  { value: "kids",        label: "Kids",         emoji: "🧸" },
  { value: "clothing",    label: "Clothing",     emoji: "👗" },
  { value: "property",    label: "Property",     emoji: "🏢" },
  { value: "services",    label: "Services",     emoji: "🔧" },
  { value: "other",       label: "Other",        emoji: "📦" },
];

const CONDITIONS = [
  { value: "new",       label: "Brand New",   color: "bg-emerald-100 text-emerald-700" },
  { value: "like_new",  label: "Like New",    color: "bg-sky-100 text-sky-700" },
  { value: "good",      label: "Good",        color: "bg-amber-100 text-amber-700" },
  { value: "fair",      label: "Fair",        color: "bg-orange-100 text-orange-700" },
];

const catEmoji = (c: string) => CATEGORIES.find((x) => x.value === c)?.emoji ?? "📦";
const catLabel = (c: string) => CATEGORIES.find((x) => x.value === c)?.label ?? c;
const condColor = (c: string) => CONDITIONS.find((x) => x.value === c)?.color ?? "bg-muted text-muted-foreground";
const condLabel = (c: string) => CONDITIONS.find((x) => x.value === c)?.label ?? c;

// ─── Schema ───────────────────────────────────────────────────────

const listingSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(1000).optional(),
  price: z.number().min(0),
  is_free: z.boolean().default(false),
  category: z.enum(["furniture","electronics","vehicle","appliance","books","kids","clothing","property","services","other"]),
  condition: z.enum(["new","like_new","good","fair"]),
  image_url: z.string().url("Must be a valid URL").optional().or(z.literal("")),
});
type ListingForm = z.infer<typeof listingSchema>;

// ─── Main Component ───────────────────────────────────────────────

export default function MarketplacePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activeSocietyId = useSocietyStore((s) => s.activeSocietyId);
  const societyId = activeSocietyId ?? profile?.society_id;

  const [createOpen, setCreateOpen]     = useState(false);
  const [search, setSearch]             = useState("");
  const [filterCat, setFilterCat]       = useState("all");
  const [filterStatus, setFilterStatus] = useState("active");
  const [expandedId, setExpandedId]     = useState<string | null>(null);

  const form = useForm<ListingForm>({
    resolver: zodResolver(listingSchema),
    defaultValues: { price: 0, is_free: false, category: "other", condition: "good" },
  });

  // ── Listings ──────────────────────────────────────────────────
  const { data: listings, isLoading } = useQuery({
    queryKey: ["marketplace", societyId, filterStatus, filterCat],
    queryFn: async () => {
      let q = supabase
        .from("marketplace_listings")
        .select(`
          id, title, description, price, is_free, category, condition,
          status, images, views_count, created_at,
          seller:seller_id(id, name, phone, flat_number),
          saved:listing_saves(user_id)
        `)
        .eq("society_id", societyId)
        .order("created_at", { ascending: false });
      if (filterStatus !== "all") q = q.eq("status", filterStatus);
      if (filterCat !== "all") q = q.eq("category", filterCat);
      const { data } = await q;
      return (data ?? []).map((l) => ({
        ...l,
        isSaved: (l.saved as { user_id: string }[])?.some((s) => s.user_id === profile?.id) ?? false,
        isMine: (l.seller as { id: string })?.id === profile?.id,
      }));
    },
    enabled: !!societyId,
  });

  // ── My saved listings ──────────────────────────────────────────
  const { data: savedListings } = useQuery({
    queryKey: ["saved-listings", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("listing_saves")
        .select("listing:listing_id(id, title, price, is_free, category, condition, status, images, created_at, seller:seller_id(name))")
        .eq("user_id", profile!.id);
      return (data ?? []).map((s) => s.listing);
    },
    enabled: !!profile?.id,
  });

  // ── Create listing ─────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (data: ListingForm) => {
      const images = data.image_url ? [data.image_url] : [];
      const { error } = await supabase.from("marketplace_listings").insert({
        society_id: societyId,
        seller_id: profile!.id,
        title: data.title,
        description: data.description ?? null,
        price: data.is_free ? 0 : data.price,
        is_free: data.is_free,
        category: data.category,
        condition: data.condition,
        images,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace"] });
      toast.success("Listing created!");
      setCreateOpen(false);
      form.reset({ price: 0, is_free: false, category: "other", condition: "good" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Mark as sold / withdraw ────────────────────────────────────
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("marketplace_listings").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace"] });
      toast.success("Listing updated");
    },
  });

  // ── Save / unsave ─────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async ({ id, saved }: { id: string; saved: boolean }) => {
      if (saved) {
        await supabase.from("listing_saves").delete().eq("listing_id", id).eq("user_id", profile!.id);
      } else {
        await supabase.from("listing_saves").insert({ listing_id: id, user_id: profile!.id });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["marketplace"] }),
  });

  // ── Contact seller (open DM) ───────────────────────────────────
  async function contactSeller(sellerId: string) {
    const { data: convId } = await supabase.rpc("get_or_create_conversation", { other_user_id: sellerId });
    if (convId) navigate(`/messages/${convId}`);
  }

  const filteredListings = listings?.filter((l) =>
    l.title?.toLowerCase().includes(search.toLowerCase()) ||
    (l.seller as { name: string })?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Marketplace"
        description="Buy, sell and give away items within your society"
        action={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4" /> Post a Listing</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create a listing</DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4 mt-1">
                <div className="space-y-1.5">
                  <Label>Title *</Label>
                  <Input placeholder="e.g. Wooden dining table with 6 chairs" {...form.register("title")} />
                  {form.formState.errors.title && <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea placeholder="Describe the item — condition, dimensions, reason for selling…" className="resize-none" rows={3} {...form.register("description")} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select value={form.watch("category")} onValueChange={(v) => form.setValue("category", v as ListingForm["category"])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Condition</Label>
                    <Select value={form.watch("condition")} onValueChange={(v) => form.setValue("condition", v as ListingForm["condition"])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONDITIONS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>Price (₹)</Label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" {...form.register("is_free")} className="rounded" />
                      Free / Give away
                    </label>
                  </div>
                  {!form.watch("is_free") && (
                    <Input type="number" min={0} placeholder="0" {...form.register("price", { valueAsNumber: true })} />
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Image URL (optional)</Label>
                  <Input placeholder="https://…" {...form.register("image_url")} />
                </div>

                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>Cancel</Button>
                  <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                    {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post Listing"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-8 space-y-6">
        {/* Search + Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search listings…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-40">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="sold">Sold</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="browse">
          <TabsList>
            <TabsTrigger value="browse">Browse ({filteredListings?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="mine">My Listings</TabsTrigger>
            <TabsTrigger value="saved">Saved ({savedListings?.length ?? 0})</TabsTrigger>
          </TabsList>

          {/* ── Browse ─────────────────────────────────────────── */}
          <TabsContent value="browse" className="mt-5">
            {isLoading && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-56 rounded-2xl bg-muted animate-pulse" />)}
              </div>
            )}
            {!isLoading && filteredListings?.length === 0 && (
              <div className="flex flex-col items-center py-20 gap-3">
                <ShoppingBag className="h-12 w-12 text-muted-foreground/30" />
                <p className="text-muted-foreground font-medium">No listings found</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredListings?.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  onSave={() => saveMutation.mutate({ id: listing.id, saved: listing.isSaved })}
                  onContact={() => contactSeller((listing.seller as { id: string }).id)}
                  onMarkSold={() => statusMutation.mutate({ id: listing.id, status: "sold" })}
                  onWithdraw={() => statusMutation.mutate({ id: listing.id, status: "withdrawn" })}
                  expanded={expandedId === listing.id}
                  onExpand={() => setExpandedId(expandedId === listing.id ? null : listing.id)}
                />
              ))}
            </div>
          </TabsContent>

          {/* ── My Listings ────────────────────────────────────── */}
          <TabsContent value="mine" className="mt-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {listings?.filter((l) => l.isMine).map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  onSave={() => {}}
                  onContact={() => {}}
                  onMarkSold={() => statusMutation.mutate({ id: listing.id, status: "sold" })}
                  onWithdraw={() => statusMutation.mutate({ id: listing.id, status: "withdrawn" })}
                  expanded={expandedId === listing.id}
                  onExpand={() => setExpandedId(expandedId === listing.id ? null : listing.id)}
                  isOwner
                />
              ))}
              {listings?.filter((l) => l.isMine).length === 0 && (
                <div className="col-span-full text-center py-16 text-muted-foreground">
                  <p>You haven't posted any listings yet</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Saved ──────────────────────────────────────────── */}
          <TabsContent value="saved" className="mt-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {savedListings?.map((listing) => (
                <SavedCard key={listing?.id} listing={listing} />
              ))}
              {savedListings?.length === 0 && (
                <div className="col-span-full text-center py-16 text-muted-foreground">
                  <p>No saved listings — tap ❤️ on any listing to save it</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─── ListingCard ──────────────────────────────────────────────────

function ListingCard({ listing, onSave, onContact, onMarkSold, onWithdraw, expanded, onExpand, isOwner = false }) {
  const seller = listing.seller as { id: string; name: string; phone: string; flat_number: string };
  const img = listing.images?.[0];

  return (
    <Card className={`overflow-hidden flex flex-col hover:shadow-md transition-all ${listing.status !== "active" ? "opacity-70" : ""}`}>
      {/* Image / emoji placeholder */}
      <div className="h-36 bg-muted flex items-center justify-center relative shrink-0">
        {img ? (
          <img src={img} alt={listing.title} className="h-full w-full object-cover" />
        ) : (
          <span className="text-5xl">{catEmoji(listing.category)}</span>
        )}
        {listing.status === "sold" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="bg-white text-black text-xs font-bold px-3 py-1 rounded-full">SOLD</span>
          </div>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onSave(); }}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 shadow hover:bg-white transition-colors"
        >
          {listing.isSaved
            ? <Heart className="h-3.5 w-3.5 fill-red-500 text-red-500" />
            : <Heart className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
      </div>

      <CardContent className="p-3 flex flex-col gap-2 flex-1">
        {/* Price */}
        <div className="flex items-center justify-between">
          <p className="font-bold text-lg text-primary">
            {listing.is_free ? <span className="text-emerald-600">FREE</span> : `₹${Number(listing.price).toLocaleString("en-IN")}`}
          </p>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${condColor(listing.condition)}`}>
            {condLabel(listing.condition)}
          </span>
        </div>

        <p className="font-semibold text-sm leading-snug line-clamp-2">{listing.title}</p>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{catEmoji(listing.category)} {catLabel(listing.category)}</span>
          <span>·</span>
          <span>{formatRelative(listing.created_at)}</span>
        </div>

        {seller && (
          <p className="text-xs text-muted-foreground">
            by {seller.name}{seller.flat_number ? ` · Flat ${seller.flat_number}` : ""}
          </p>
        )}

        {/* Expand for description */}
        {listing.description && (
          <button onClick={onExpand} className="text-xs text-primary text-left">
            {expanded ? "▲ Hide details" : "▼ View details"}
          </button>
        )}
        {expanded && listing.description && (
          <p className="text-xs text-muted-foreground leading-relaxed border-t pt-2 mt-1">
            {listing.description}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-auto pt-2">
          {!isOwner && listing.status === "active" && (
            <Button size="sm" className="flex-1 h-8 text-xs" onClick={onContact}>
              <MessageSquare className="h-3 w-3 mr-1" /> Message
            </Button>
          )}
          {isOwner && listing.status === "active" && (
            <>
              <Button size="sm" variant="outline" className="flex-1 h-8 text-xs text-emerald-600 border-emerald-200" onClick={onMarkSold}>
                <CheckCircle className="h-3 w-3 mr-1" /> Sold
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs text-muted-foreground" onClick={onWithdraw}>
                <X className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SavedCard({ listing }) {
  if (!listing) return null;
  return (
    <Card className="overflow-hidden flex flex-col">
      <div className="h-24 bg-muted flex items-center justify-center">
        {listing.images?.[0]
          ? <img src={listing.images[0]} alt="" className="h-full w-full object-cover" />
          : <span className="text-3xl">{catEmoji(listing.category)}</span>}
      </div>
      <CardContent className="p-3">
        <p className="font-semibold text-sm line-clamp-1">{listing.title}</p>
        <p className="font-bold text-primary text-sm mt-1">
          {listing.is_free ? "FREE" : `₹${Number(listing.price).toLocaleString("en-IN")}`}
        </p>
        {listing.status === "sold" && (
          <span className="text-xs text-red-500 font-semibold">Sold</span>
        )}
      </CardContent>
    </Card>
  );
}
