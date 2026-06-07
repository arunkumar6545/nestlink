// @ts-nocheck
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Building2, User, Zap, CheckCircle2,
  ArrowLeft, ArrowRight, Loader2, Phone,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const onboardSchema = z.object({
  // Society
  society_name: z.string().min(3, "Min 3 chars").max(100),
  address: z.string().min(5).max(300),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  pincode: z.string().regex(/^\d{6}$/, "6-digit pincode"),
  total_units: z.coerce.number().int().min(1).max(50000),
  plan: z.enum(["trial", "free", "pro", "enterprise"]),
  // Admin
  admin_name: z.string().min(2, "Name required"),
  admin_phone: z.string().regex(/^\+?[0-9]{10,15}$/, "Invalid phone"),
});

type OnboardForm = z.infer<typeof onboardSchema>;

type Step = "society" | "admin" | "confirm" | "done";

const STEPS: { id: Step; label: string; icon: React.ElementType }[] = [
  { id: "society", label: "Society details", icon: Building2 },
  { id: "admin",   label: "Admin details",   icon: User },
  { id: "confirm", label: "Confirm",          icon: CheckCircle2 },
];

export default function OnboardSocietyPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("society");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ society_id: string; invitation_id: string } | null>(null);

  const form = useForm<OnboardForm>({
    resolver: zodResolver(onboardSchema),
    defaultValues: { plan: "trial", total_units: 100 },
    mode: "onTouched",
  });

  const stepOrder: Step[] = ["society", "admin", "confirm", "done"];
  const stepIndex = stepOrder.indexOf(step);

  async function handleNext() {
    if (step === "society") {
      const ok = await form.trigger(["society_name", "address", "city", "state", "pincode", "total_units", "plan"]);
      if (ok) setStep("admin");
    } else if (step === "admin") {
      const ok = await form.trigger(["admin_name", "admin_phone"]);
      if (ok) setStep("confirm");
    } else if (step === "confirm") {
      await submit();
    }
  }

  async function submit() {
    const data = form.getValues();
    setIsLoading(true);
    try {
      const phone = data.admin_phone.startsWith("+")
        ? data.admin_phone
        : `+91${data.admin_phone}`;

      const { data: res, error } = await supabase.rpc("onboard_society", {
        p_society_name: data.society_name,
        p_address: data.address,
        p_city: data.city,
        p_state: data.state,
        p_pincode: data.pincode,
        p_total_units: data.total_units,
        p_admin_name: data.admin_name,
        p_admin_phone: phone,
        p_plan: data.plan,
      });

      if (error) throw error;
      setResult(res as typeof result);
      setStep("done");
      toast.success(`${data.society_name} has been onboarded!`);
    } catch (e: Error) {
      toast.error(e.message);
    } finally {
      setIsLoading(false);
    }
  }

  const values = form.getValues();

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Back */}
      <button
        onClick={() => (step === "society" ? navigate(-1) : setStep(stepOrder[stepIndex - 1] as Step))}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-8"
      >
        <ArrowLeft className="h-4 w-4" />
        {step === "society" ? "Back" : "Previous step"}
      </button>

      {/* Title */}
      <div className="flex items-center gap-4 mb-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600">
          <Zap className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Onboard New Society</h1>
          <p className="text-slate-400 text-sm">Set up a society and create its first admin</p>
        </div>
      </div>

      {/* Stepper */}
      {step !== "done" && (
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map(({ id, label, icon: Icon }, i) => {
            const current = id === step;
            const done = stepOrder.indexOf(id) < stepIndex;
            return (
              <div key={id} className="flex items-center gap-2 flex-1">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full shrink-0 text-xs font-bold transition-all ${
                  current ? "bg-violet-600 text-white"
                    : done ? "bg-emerald-600 text-white"
                    : "bg-slate-700 text-slate-500"
                }`}>
                  {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span className={`text-sm font-medium transition-colors ${current ? "text-white" : done ? "text-emerald-400" : "text-slate-500"}`}>
                  {label}
                </span>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-2 transition-colors ${done ? "bg-emerald-600/40" : "bg-slate-700"}`} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Step: Society ─────────────────────────────────── */}
      {step === "society" && (
        <div className="rounded-xl border border-violet-900/30 bg-slate-900 p-6 space-y-5">
          <h2 className="font-semibold text-white text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-violet-400" /> Society Information
          </h2>

          <div className="space-y-2">
            <Label className="text-slate-300">Society name *</Label>
            <Input placeholder="e.g. Sunrise Residency" {...form.register("society_name")}
              className="bg-slate-800 border-violet-900/40 text-white placeholder:text-slate-600 focus-visible:ring-violet-500" />
            {form.formState.errors.society_name && (
              <p className="text-xs text-red-400">{form.formState.errors.society_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Full address *</Label>
            <Input placeholder="Street, area, landmark" {...form.register("address")}
              className="bg-slate-800 border-violet-900/40 text-white placeholder:text-slate-600 focus-visible:ring-violet-500" />
            {form.formState.errors.address && (
              <p className="text-xs text-red-400">{form.formState.errors.address.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">City *</Label>
              <Input placeholder="Bangalore" {...form.register("city")}
                className="bg-slate-800 border-violet-900/40 text-white placeholder:text-slate-600 focus-visible:ring-violet-500" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">State *</Label>
              <Input placeholder="Karnataka" {...form.register("state")}
                className="bg-slate-800 border-violet-900/40 text-white placeholder:text-slate-600 focus-visible:ring-violet-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Pincode *</Label>
              <Input placeholder="560001" maxLength={6} {...form.register("pincode")}
                className="bg-slate-800 border-violet-900/40 text-white placeholder:text-slate-600 focus-visible:ring-violet-500" />
              {form.formState.errors.pincode && (
                <p className="text-xs text-red-400">{form.formState.errors.pincode.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Total units</Label>
              <Input type="number" min={1} {...form.register("total_units")}
                className="bg-slate-800 border-violet-900/40 text-white placeholder:text-slate-600 focus-visible:ring-violet-500" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Subscription plan</Label>
            <Select value={form.watch("plan")} onValueChange={(v) => form.setValue("plan", v as OnboardForm["plan"])}>
              <SelectTrigger className="bg-slate-800 border-violet-900/40 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trial">Trial (30 days free)</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleNext} className="w-full bg-violet-600 hover:bg-violet-700">
            Next: Admin Details <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ─── Step: Admin ───────────────────────────────────── */}
      {step === "admin" && (
        <div className="rounded-xl border border-violet-900/30 bg-slate-900 p-6 space-y-5">
          <h2 className="font-semibold text-white text-base flex items-center gap-2">
            <User className="h-4 w-4 text-violet-400" /> Society Admin
          </h2>
          <p className="text-sm text-slate-400">
            This person will manage the society. They'll receive a one-time invite
            — when they sign in with this phone, they're automatically set as admin.
          </p>

          <div className="space-y-2">
            <Label className="text-slate-300">Admin name *</Label>
            <Input placeholder="Ramesh Sharma" {...form.register("admin_name")}
              className="bg-slate-800 border-violet-900/40 text-white placeholder:text-slate-600 focus-visible:ring-violet-500" />
            {form.formState.errors.admin_name && (
              <p className="text-xs text-red-400">{form.formState.errors.admin_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Admin phone *</Label>
            <div className="flex gap-2">
              <span className="flex items-center px-3 rounded-lg border border-violet-900/40 bg-slate-700 text-sm text-slate-400">
                +91
              </span>
              <Input placeholder="9876543210" {...form.register("admin_phone")}
                className="flex-1 bg-slate-800 border-violet-900/40 text-white placeholder:text-slate-600 focus-visible:ring-violet-500" />
            </div>
            {form.formState.errors.admin_phone && (
              <p className="text-xs text-red-400">{form.formState.errors.admin_phone.message}</p>
            )}
          </div>

          <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 p-3 text-xs text-violet-300">
            <p className="font-semibold mb-1">How admin onboarding works:</p>
            <ol className="space-y-1 list-decimal list-inside text-violet-300/80">
              <li>An invitation is created for this phone number</li>
              <li>You share the Nestlink app link with them</li>
              <li>They sign in with OTP — role is auto-assigned as Admin</li>
              <li>They can then invite residents and guards</li>
            </ol>
          </div>

          <Button onClick={handleNext} className="w-full bg-violet-600 hover:bg-violet-700">
            Next: Confirm <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ─── Step: Confirm ─────────────────────────────────── */}
      {step === "confirm" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-violet-900/30 bg-slate-900 p-6">
            <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-violet-400" />
              Review & Confirm
            </h2>
            <div className="space-y-3 text-sm">
              {[
                ["Society", values.society_name],
                ["Location", `${values.city}, ${values.state} ${values.pincode}`],
                ["Address", values.address],
                ["Units", values.total_units],
                ["Plan", values.plan],
                ["Admin", values.admin_name],
                ["Admin Phone", values.admin_phone?.startsWith("+") ? values.admin_phone : `+91${values.admin_phone}`],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-slate-500">{label}</span>
                  <span className="text-white font-medium text-right">{val}</span>
                </div>
              ))}
            </div>
          </div>
          <Button
            onClick={handleNext}
            disabled={isLoading}
            className="w-full bg-violet-600 hover:bg-violet-700"
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Onboarding…</>
            ) : (
              <><Zap className="h-4 w-4" /> Onboard Society</>
            )}
          </Button>
        </div>
      )}

      {/* ─── Step: Done ────────────────────────────────────── */}
      {step === "done" && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 mx-auto">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Society Onboarded!</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            <strong className="text-white">{values.society_name}</strong> has been created.
            An invitation has been sent for{" "}
            <strong className="text-white">{values.admin_name}</strong> (
            {values.admin_phone?.startsWith("+") ? values.admin_phone : `+91${values.admin_phone}`}).
            They can now sign in with OTP and will be auto-assigned as Society Admin.
          </p>
          <div className="bg-slate-800 rounded-lg p-3 text-xs text-slate-400 text-left space-y-1">
            <p className="text-slate-300 font-medium">Next steps:</p>
            <p>1. Share the Nestlink app with the admin</p>
            <p>2. They sign in with their phone number</p>
            <p>3. They'll be taken directly to the Admin portal</p>
          </div>
          <div className="flex gap-3 mt-2">
            <Button
              variant="outline"
              className="flex-1 border-violet-700/50 text-violet-300 hover:bg-violet-500/10"
              onClick={() => navigate("/superadmin/onboard")}
            >
              Onboard Another
            </Button>
            <Button
              className="flex-1 bg-violet-600 hover:bg-violet-700"
              onClick={() => navigate("/superadmin/societies")}
            >
              View All Societies
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
