// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, Lock, Globe, FileText, Trash2, ExternalLink, Search,
  Loader2, Download, ToggleLeft, ToggleRight, Filter,
  BookOpen, Scale, DollarSign, Wrench, Megaphone, Map, Archive,
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatRelative } from "@nestlink/core";

// ─── Constants ────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "minutes",     label: "Meeting Minutes",    icon: BookOpen,  color: "bg-blue-100 text-blue-700" },
  { value: "bylaws",      label: "Bylaws & Rules",     icon: Scale,     color: "bg-purple-100 text-purple-700" },
  { value: "financial",   label: "Financial Reports",  icon: DollarSign,color: "bg-emerald-100 text-emerald-700" },
  { value: "legal",       label: "Legal Documents",    icon: Scale,     color: "bg-red-100 text-red-700" },
  { value: "maintenance", label: "Maintenance Records",icon: Wrench,    color: "bg-orange-100 text-orange-700" },
  { value: "notice",      label: "Official Notices",   icon: Megaphone, color: "bg-amber-100 text-amber-700" },
  { value: "plans",       label: "Plans & Maps",       icon: Map,       color: "bg-sky-100 text-sky-700" },
  { value: "other",       label: "Other",              icon: Archive,   color: "bg-gray-100 text-gray-700" },
];

const catInfo = (c: string) => CATEGORIES.find((x) => x.value === c) ?? CATEGORIES[7];

const HOA_ROLES = ["admin", "hoa_president", "hoa_secretary", "hoa_treasurer", "hoa_member"];

// ─── Main Component ───────────────────────────────────────────────

export default function DocumentVaultPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const activeSocietyId = useSocietyStore((s) => s.activeSocietyId);
  const societyId = activeSocietyId ?? profile?.society_id;

  const isHoa = HOA_ROLES.includes(profile?.role ?? "");
  const canUpload = isHoa;
  const canManage = ["admin", "hoa_president", "hoa_secretary"].includes(profile?.role ?? "");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [search, setSearch]         = useState("");
  const [filterCat, setFilterCat]   = useState("all");

  // Form state
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [category,    setCategory]    = useState("other");
  const [fileUrl,     setFileUrl]     = useState("");
  const [fileName,    setFileName]    = useState("");
  const [isPublic,    setIsPublic]    = useState(false);

  // ── Documents ─────────────────────────────────────────────────
  const { data: docs, isLoading } = useQuery({
    queryKey: ["documents", societyId, filterCat, isHoa],
    queryFn: async () => {
      let q = supabase
        .from("society_documents")
        .select(`
          id, title, description, category, file_url, file_name, file_size,
          is_public, created_at,
          uploader:uploaded_by(id, name)
        `)
        .eq("society_id", societyId)
        .order("created_at", { ascending: false });
      if (filterCat !== "all") q = q.eq("category", filterCat);
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!societyId,
  });

  // ── Upload ────────────────────────────────────────────────────
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !fileUrl.trim() || !fileName.trim()) throw new Error("Title, file URL and file name are required");
      const { error } = await supabase.from("society_documents").insert({
        society_id: societyId,
        uploaded_by: profile!.id,
        title: title.trim(),
        description: description.trim() || null,
        category,
        file_url: fileUrl.trim(),
        file_name: fileName.trim(),
        is_public: isPublic,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document added to vault");
      setUploadOpen(false);
      setTitle(""); setDescription(""); setFileUrl(""); setFileName(""); setIsPublic(false); setCategory("other");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Toggle public/private ─────────────────────────────────────
  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ id, isPublic }: { id: string; isPublic: boolean }) => {
      const { error } = await supabase.from("society_documents").update({ is_public: !isPublic }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Visibility updated");
    },
  });

  // ── Delete ────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("society_documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Document deleted");
    },
  });

  const filteredDocs = docs?.filter((d) =>
    d.title?.toLowerCase().includes(search.toLowerCase()) ||
    d.file_name?.toLowerCase().includes(search.toLowerCase())
  );

  const publicDocs  = filteredDocs?.filter((d) => d.is_public);
  const privateDocs = filteredDocs?.filter((d) => !d.is_public);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Document Vault"
        description={isHoa
          ? "HOA-managed repository of society documents, reports and records"
          : "Official society documents shared by the HOA committee"}
        action={canUpload && (
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4" /> Add Document</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add to Document Vault</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-1">
                <div className="space-y-1.5">
                  <Label>Document Title *</Label>
                  <Input placeholder="e.g. AGM Minutes — March 2026" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea placeholder="Brief description of the document…" className="resize-none" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <Label>File URL *</Label>
                  <Input placeholder="https://drive.google.com/… or any hosted URL" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Paste a Google Drive, Dropbox or any direct link.</p>
                </div>

                <div className="space-y-1.5">
                  <Label>File Name *</Label>
                  <Input placeholder="AGM_Minutes_March2026.pdf" value={fileName} onChange={(e) => setFileName(e.target.value)} />
                </div>

                {/* Visibility toggle */}
                <button
                  type="button"
                  onClick={() => setIsPublic(!isPublic)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-all ${
                    isPublic ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"
                  }`}
                >
                  {isPublic
                    ? <Globe className="h-4 w-4 text-emerald-600 shrink-0" />
                    : <Lock className="h-4 w-4 text-amber-600 shrink-0" />}
                  <div className="flex-1 text-left">
                    <p className={`font-semibold text-sm ${isPublic ? "text-emerald-700" : "text-amber-700"}`}>
                      {isPublic ? "Public — visible to all residents" : "Private — HOA committee only"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isPublic ? "All society members can view this document" : "Only HOA members and admins can view this"}
                    </p>
                  </div>
                  {isPublic
                    ? <ToggleRight className="h-5 w-5 text-emerald-600 shrink-0" />
                    : <ToggleLeft className="h-5 w-5 text-amber-600 shrink-0" />}
                </button>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setUploadOpen(false)}>Cancel</Button>
                  <Button className="flex-1" disabled={uploadMutation.isPending || !title.trim() || !fileUrl.trim()} onClick={() => uploadMutation.mutate()}>
                    {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add to Vault"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      />

      <div className="p-8 space-y-6">
        {/* Access level banner */}
        <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${isHoa ? "bg-purple-50 border-purple-200" : "bg-sky-50 border-sky-200"}`}>
          {isHoa ? <Lock className="h-4 w-4 text-purple-600 shrink-0" /> : <Globe className="h-4 w-4 text-sky-600 shrink-0" />}
          <p className="text-sm">
            {isHoa
              ? <><strong>HOA Access:</strong> You can view all documents (public and private) and manage the vault.</>
              : <><strong>Resident Access:</strong> You can view documents shared publicly by the HOA committee.</>}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search documents…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-48">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
          </div>
        )}

        {/* Private section (HOA only) */}
        {isHoa && privateDocs && privateDocs.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-amber-700 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              Private Documents — HOA Only ({privateDocs.length})
            </p>
            {privateDocs.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} canManage={canManage}
                onToggle={() => toggleVisibilityMutation.mutate({ id: doc.id, isPublic: doc.is_public })}
                onDelete={() => deleteMutation.mutate(doc.id)}
              />
            ))}
          </div>
        )}

        {/* Public section */}
        {publicDocs && publicDocs.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-emerald-700 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              Public Documents — Shared with All Residents ({publicDocs.length})
            </p>
            {publicDocs.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} canManage={canManage}
                onToggle={() => toggleVisibilityMutation.mutate({ id: doc.id, isPublic: doc.is_public })}
                onDelete={() => deleteMutation.mutate(doc.id)}
              />
            ))}
          </div>
        )}

        {!isLoading && filteredDocs?.length === 0 && (
          <div className="flex flex-col items-center py-20 gap-3">
            <FileText className="h-12 w-12 text-muted-foreground/30" />
            <p className="text-muted-foreground font-medium">No documents yet</p>
            {canUpload && <p className="text-sm text-muted-foreground">Click "Add Document" to add the first one</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DocumentRow ──────────────────────────────────────────────────

function DocumentRow({ doc, canManage, onToggle, onDelete }) {
  const info = catInfo(doc.category);
  const Icon = info.icon;
  const uploader = doc.uploader as { name: string } | null;

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4 flex items-center gap-4">
        {/* Icon */}
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${info.color}`}>
          <Icon className="h-5 w-5" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm">{doc.title}</p>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${info.color}`}>{info.label}</span>
            <span className={`flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${doc.is_public ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
              {doc.is_public ? <Globe className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
              {doc.is_public ? "Public" : "Private"}
            </span>
          </div>
          {doc.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{doc.description}</p>}
          <p className="text-xs text-muted-foreground mt-0.5">
            {doc.file_name} · Uploaded by {uploader?.name ?? "Unknown"} · {formatRelative(doc.created_at)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-1 shrink-0">
          <a
            href={doc.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Open document"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          {canManage && (
            <>
              <button
                onClick={onToggle}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                title={doc.is_public ? "Make private" : "Make public"}
              >
                {doc.is_public ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
              </button>
              <button
                onClick={() => {
                  if (confirm("Delete this document?")) onDelete();
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
