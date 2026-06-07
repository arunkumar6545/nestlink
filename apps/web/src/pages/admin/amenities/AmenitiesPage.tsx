// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Clock, Users, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createAmenitySchema } from "@nestlink/core";
import type { z } from "zod";

type AmenityForm = z.infer<typeof createAmenitySchema>;

export default function AmenitiesPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const societyId = profile?.society_id;

  const { data: amenities, isLoading } = useQuery({
    queryKey: ["admin-amenities", societyId],
    queryFn: async () => {
      if (!societyId) return [];
      const { data } = await supabase
        .from("amenities")
        .select("*")
        .eq("society_id", societyId)
        .order("name");
      return data ?? [];
    },
    enabled: !!societyId,
  });

  const form = useForm<AmenityForm>({
    resolver: zodResolver(createAmenitySchema),
    defaultValues: {
      capacity: 20,
      open_time: "06:00",
      close_time: "22:00",
      slots_json: [
        { start: "06:00", end: "09:00", max_bookings: 5 },
        { start: "09:00", end: "12:00", max_bookings: 5 },
        { start: "16:00", end: "19:00", max_bookings: 5 },
        { start: "19:00", end: "22:00", max_bookings: 5 },
      ],
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: AmenityForm) => {
      const { error } = await supabase.from("amenities").insert({
        ...data,
        society_id: societyId!,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-amenities"] });
      toast.success("Amenity added");
      setOpen(false);
      form.reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("amenities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-amenities"] });
      toast.success("Amenity removed");
    },
  });

  const amenityEmojis: Record<string, string> = {
    "Clubhouse": "🏛️",
    "Swimming Pool": "🏊",
    "Gym": "🏋️",
    "Party Hall": "🎉",
    "Tennis Court": "🎾",
    "Basketball Court": "🏀",
    "Children's Park": "🛝",
    default: "🏟️",
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Amenities"
        description="Manage society amenities and booking slots"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                Add Amenity
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Amenity</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={form.handleSubmit((d) => createMutation.mutate(d))}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input placeholder="e.g. Swimming Pool" {...form.register("name")} />
                  {form.formState.errors.name && (
                    <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Capacity</Label>
                    <Input
                      type="number"
                      {...form.register("capacity", { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Opens</Label>
                    <Input type="time" {...form.register("open_time")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Closes</Label>
                    <Input type="time" {...form.register("close_time")} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Adding..." : "Add Amenity"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-8">
        {isLoading && <p className="text-muted-foreground text-sm text-center py-10">Loading...</p>}
        {!isLoading && amenities?.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-20">No amenities yet</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {amenities?.map((a) => {
            const slots = (a.slots_json as Array<{ start: string; end: string; max_bookings: number }>) ?? [];
            return (
              <Card key={a.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">
                        {amenityEmojis[a.name] ?? amenityEmojis.default}
                      </span>
                      <CardTitle className="text-base">{a.name}</CardTitle>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive h-8 w-8"
                      onClick={() => deleteMutation.mutate(a.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {a.capacity} capacity
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {a.open_time} – {a.close_time}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Slots</p>
                    <div className="flex flex-wrap gap-1.5">
                      {slots.map((slot, i) => (
                        <span
                          key={i}
                          className="text-xs bg-muted rounded-md px-2 py-1"
                        >
                          {slot.start}–{slot.end}
                        </span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
