// @ts-nocheck
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Building2, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useSocietyStore } from "@/store/society";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const createSocietySchema = z.object({
  name: z.string().min(3, "At least 3 characters").max(100),
  address: z.string().min(5).max(300),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  pincode: z.string().regex(/^\d{6}$/, "6-digit pincode"),
  total_units: z.coerce.number().int().min(1).max(10000),
});

type CreateSocietyForm = z.infer<typeof createSocietySchema>;

export default function CreateSocietyPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { setSocieties, setActiveSociety } = useSocietyStore();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<CreateSocietyForm>({
    resolver: zodResolver(createSocietySchema),
    defaultValues: { total_units: 50 },
  });

  async function onSubmit(data: CreateSocietyForm) {
    if (!profile?.id) return;
    setIsLoading(true);
    try {
      const { data: society, error } = await supabase
        .from("societies")
        .insert({
          name: data.name,
          address: data.address,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          total_units: data.total_units,
          admin_id: profile.id,
          plan: "free",
        })
        .select("id, name, address, city, logo_url, plan")
        .single();

      if (error) throw error;

      // Update profile's society_id if they don't have one yet
      if (!profile.society_id) {
        await supabase
          .from("user_profiles")
          .update({ society_id: society.id })
          .eq("id", profile.id);
      }

      queryClient.invalidateQueries({ queryKey: ["user-societies"] });
      setActiveSociety(society.id);
      toast.success(`${society.name} created!`);
      navigate("/admin");
    } catch (e: Error) {
      toast.error(e.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="flex items-center gap-4 mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Create a new society</h1>
            <p className="text-muted-foreground text-sm">
              Set up a new society to manage independently
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Society details</CardTitle>
            <CardDescription>
              You can manage multiple societies and switch between them from the sidebar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label>Society name *</Label>
                <Input
                  placeholder="e.g. Sunrise Apartments"
                  {...form.register("name")}
                />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Full address *</Label>
                <Input
                  placeholder="e.g. 42, MG Road, Near Central Mall"
                  {...form.register("address")}
                />
                {form.formState.errors.address && (
                  <p className="text-xs text-destructive">{form.formState.errors.address.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>City *</Label>
                  <Input placeholder="Bangalore" {...form.register("city")} />
                  {form.formState.errors.city && (
                    <p className="text-xs text-destructive">{form.formState.errors.city.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>State *</Label>
                  <Input placeholder="Karnataka" {...form.register("state")} />
                  {form.formState.errors.state && (
                    <p className="text-xs text-destructive">{form.formState.errors.state.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Pincode *</Label>
                  <Input
                    placeholder="560001"
                    maxLength={6}
                    {...form.register("pincode")}
                  />
                  {form.formState.errors.pincode && (
                    <p className="text-xs text-destructive">{form.formState.errors.pincode.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Total units</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10000}
                    {...form.register("total_units")}
                  />
                  {form.formState.errors.total_units && (
                    <p className="text-xs text-destructive">{form.formState.errors.total_units.message}</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
                  ) : (
                    <><Building2 className="h-4 w-4" /> Create Society</>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
