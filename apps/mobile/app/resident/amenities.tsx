import { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal, Alert, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { AmenitySlot } from "@nestlink/core";

const amenityEmojis: Record<string, string> = {
  "Swimming Pool": "🏊",
  "Gym": "🏋️",
  "Clubhouse": "🏛️",
  "Party Hall": "🎉",
  "Tennis Court": "🎾",
};

export default function AmenitiesScreen() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedAmenity, setSelectedAmenity] = useState<{
    id: string; name: string; slots_json: AmenitySlot[];
  } | null>(null);
  const [selectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedSlot, setSelectedSlot] = useState("");

  const { data: amenities, isLoading } = useQuery({
    queryKey: ["mobile-amenities", profile?.society_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("amenities")
        .select("*")
        .eq("society_id", profile!.society_id!);
      return data ?? [];
    },
    enabled: !!profile?.society_id,
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
      queryClient.invalidateQueries({ queryKey: ["mobile-amenities"] });
      setSelectedAmenity(null);
      setSelectedSlot("");
      Alert.alert("Success", "Amenity booked successfully!");
    },
    onError: (e: Error) => Alert.alert("Error", e.message),
  });

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-5 py-4 bg-white border-b border-gray-100">
        <Text className="text-xl font-bold text-gray-800">Amenities</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-3" showsVerticalScrollIndicator={false}>
        {isLoading && <ActivityIndicator className="mt-10" color="#0ea5e9" />}
        {!isLoading && amenities?.length === 0 && (
          <View className="items-center mt-20">
            <Text className="text-4xl mb-3">🏊</Text>
            <Text className="text-gray-400">No amenities configured</Text>
          </View>
        )}
        {amenities?.map((a) => {
          const slots = (a.slots_json as AmenitySlot[]) ?? [];
          return (
            <View key={a.id} className="bg-white rounded-2xl p-5 mb-3 shadow-sm">
              <View className="flex-row items-center gap-3 mb-3">
                <Text className="text-3xl">{amenityEmojis[a.name] ?? "🏟️"}</Text>
                <View>
                  <Text className="font-bold text-gray-800 text-base">{a.name}</Text>
                  <Text className="text-gray-500 text-sm">
                    Cap: {a.capacity} • {a.open_time}–{a.close_time}
                  </Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {slots.map((slot, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => {
                        setSelectedAmenity({ id: a.id, name: a.name, slots_json: slots });
                        setSelectedSlot(`${slot.start}–${slot.end}`);
                      }}
                      className="bg-primary-50 border border-primary-200 rounded-xl px-3 py-2"
                    >
                      <Text className="text-primary-600 text-xs font-medium">
                        {slot.start}–{slot.end}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          );
        })}
        <View className="h-6" />
      </ScrollView>

      {/* Booking Confirmation Modal */}
      <Modal visible={!!selectedSlot} transparent animationType="fade">
        <View className="flex-1 bg-black/50 items-center justify-center px-6">
          <View className="bg-white rounded-2xl p-6 w-full">
            <Text className="text-xl font-bold text-gray-800 mb-1">Confirm Booking</Text>
            <Text className="text-gray-500 mb-4">
              {selectedAmenity?.name} • {selectedSlot} • Today
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => { setSelectedAmenity(null); setSelectedSlot(""); }}
                className="flex-1 bg-gray-100 rounded-xl py-3 items-center"
              >
                <Text className="text-gray-700 font-bold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => bookMutation.mutate()}
                disabled={bookMutation.isPending}
                className="flex-1 bg-primary-500 rounded-xl py-3 items-center"
              >
                {bookMutation.isPending ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-white font-bold">Book Now</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
