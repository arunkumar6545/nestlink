// @ts-nocheck
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calendar, Clock, Users, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@nestlink/core";
import type { AmenitySlot } from "@nestlink/core";

export default function ResidentAmenitiesPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedAmenity, setSelectedAmenity] = useState<{ id: string; name: string; slots_json: AmenitySlot[] } | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedSlot, setSelectedSlot] = useState("");

  const { data: amenities, isLoading } = useQuery({
    queryKey: ["amenities", profile?.society_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("amenities")
        .select("*")
        .eq("society_id", profile!.society_id!);
      return data ?? [];
    },
    enabled: !!profile?.society_id,
  });

  const { data: myBookings } = useQuery({
    queryKey: ["my-bookings", profile?.id],
    queryFn: async () => {
      const { data: resident } = await supabase
        .from("residents")
        .select("id")
        .eq("user_id", profile!.id)
        .single();

      if (!resident) return [];

      const { data } = await supabase
        .from("amenity_bookings")
        .select(`*, amenities:amenity_id (name)`)
        .eq("resident_id", resident.id)
        .order("date", { ascending: false })
        .limit(5);
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAmenity || !selectedSlot) throw new Error("Select a slot");

      const { data: resident } = await supabase
        .from("residents")
        .select("id")
        .eq("user_id", profile!.id)
        .single();

      if (!resident) throw new Error("Resident not found");

      const { error } = await supabase.from("amenity_bookings").insert({
        amenity_id: selectedAmenity.id,
        resident_id: resident.id,
        date: selectedDate,
        slot: selectedSlot,
        status: "confirmed",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      toast.success("Amenity booked successfully!");
      setSelectedAmenity(null);
      setSelectedSlot("");
    },
    onError: (e: Error) => toast.error(e.message),
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
      <PageHeader title="Amenity Booking" description="Book society amenities" />

      <div className="p-8 space-y-8">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
            Available Amenities
          </h2>
          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {amenities?.map((a) => {
              const slots = (a.slots_json as AmenitySlot[]) ?? [];
              return (
                <Card
                  key={a.id}
                  className="cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
                  onClick={() => setSelectedAmenity({ id: a.id, name: a.name, slots_json: slots })}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{amenityEmojis[a.name] ?? amenityEmojis.default}</span>
                      <CardTitle className="text-base">{a.name}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> {a.capacity} capacity
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {a.open_time}–{a.close_time}
                      </span>
                    </div>
                    <Button size="sm" className="w-full">
                      <Calendar className="h-3.5 w-3.5" />
                      Book Slot
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {myBookings && myBookings.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
              My Bookings
            </h2>
            <Card>
              <CardContent className="p-0">
                {myBookings.map((b) => {
                  const amenity = b.amenities as { name: string } | null;
                  return (
                    <div key={b.id} className="flex items-center gap-4 px-5 py-3.5 border-b last:border-0">
                      <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{amenity?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(b.date)} • {b.slot}
                        </p>
                      </div>
                      <StatusBadge status={b.status} />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Booking Dialog */}
      <Dialog open={!!selectedAmenity} onOpenChange={() => { setSelectedAmenity(null); setSelectedSlot(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Book {selectedAmenity?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={selectedDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Time Slot</Label>
              <Select value={selectedSlot} onValueChange={setSelectedSlot}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a slot" />
                </SelectTrigger>
                <SelectContent>
                  {selectedAmenity?.slots_json.map((slot, i) => (
                    <SelectItem key={i} value={`${slot.start}–${slot.end}`}>
                      {slot.start} – {slot.end}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setSelectedAmenity(null); setSelectedSlot(""); }}>
                Cancel
              </Button>
              <Button onClick={() => bookMutation.mutate()} disabled={!selectedSlot || bookMutation.isPending}>
                {bookMutation.isPending ? "Booking..." : "Confirm Booking"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
