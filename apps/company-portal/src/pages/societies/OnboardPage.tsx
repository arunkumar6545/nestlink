// @ts-nocheck
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Building2, UserCheck, CreditCard, CheckCircle2, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Step = 1 | 2 | 3;

const PLANS = [
  { value: "trial",      label: "Trial",      desc: "30-day free trial, all features",  price: "Free",      color: "border-amber-600/40 bg-amber-500/5" },
  { value: "free",       label: "Free",       desc: "Basic features, limited units",     price: "₹0/mo",     color: "border-slate-600/40 bg-slate-500/5" },
  { value: "pro",        label: "Pro",        desc: "Full features up to 500 units",     price: "₹4,999/mo", color: "border-sky-600/40 bg-sky-500/5" },
  { value: "enterprise", label: "Enterprise", desc: "Unlimited, custom SLA & support",   price: "Custom",    color: "border-violet-600/40 bg-violet-500/5" },
];

export default function OnboardPage() {
  const navigate = useNavigate();
  const [step, setStep]     = useState<Step>(1);
  const [loading, setLoading] = useState(false);

  // Step 1 — Society info
  const [name,       setName]       = useState("");
  const [address,    setAddress]    = useState("");
  const [city,       setCity]       = useState("");
  const [state,      setState]      = useState("");
  const [pincode,    setPincode]    = useState("");
  const [totalUnits, setTotalUnits] = useState("");

  // Step 2 — Admin
  const [adminName,  setAdminName]  = useState("");
  const [adminPhone, setAdminPhone] = useState("");

  // Step 3 — Plan
  const [plan, setPlan] = useState("trial");

  const steps = [
    { n: 1, label: "Society Info",   icon: Building2   },
    { n: 2, label: "Admin Details",  icon: UserCheck   },
    { n: 3, label: "Plan & Confirm", icon: CreditCard  },
  ];

  async function submit() {
    setLoading(true);
    try {
      const phone = adminPhone.startsWith("+") ? adminPhone : `+91${adminPhone}`;
      const { error } = await supabase.rpc("onboard_society", {
        p_society_name: name.trim(),
        p_address:      address.trim(),
        p_city:         city.trim(),
        p_state:        state.trim(),
        p_pincode:      pincode.trim(),
        p_total_units:  parseInt(totalUnits, 10),
        p_admin_name:   adminName.trim(),
        p_admin_phone:  phone,
        p_plan:         plan,
      });
      if (error) throw error;
      toast.success(`${name} onboarded successfully! Admin invitation sent to ${phone}.`);
      navigate("/societies");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Onboarding failed");
    } finally {
      setLoading(false);
    }
  }

  const canProceed1 = name && address && city && state && pincode && totalUnits;
  const canProceed2 = adminName && adminPhone;

  return (
    <div className="p-8 max-w-2xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Onboard New Society</h1>
        <p className="text-slate-400 text-sm mt-1">Set up a new housing society on the Nestlink platform</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map(({ n, label, icon: Icon }, i) => (
          <div key={n} className="flex items-center gap-2 flex-1">
            <div className={`flex items-center gap-2 rounded-xl px-3 py-2 flex-1 border transition-all ${
              step === n
                ? "bg-violet-600/20 border-violet-500/50 text-violet-300"
                : step > n
                ? "bg-emerald-600/10 border-emerald-500/30 text-emerald-400"
                : "bg-[#1a1a2e] border-violet-900/20 text-slate-600"
            }`}>
              {step > n
                ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                : <Icon className="h-4 w-4 shrink-0" />}
              <span className="text-xs font-semibold truncate">{label}</span>
            </div>
            {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-slate-700 shrink-0" />}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-violet-900/20 bg-[#13131f] p-7">
        {/* ── Step 1: Society Info ─────────────────────── */}
        {step === 1 && (
          <div className="space-y-4 animate-slide-up">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Building2 className="h-4 w-4 text-violet-400" /> Society Information
            </h2>
            <Field label="Society Name *" value={name} onChange={setName} placeholder="Sunrise Apartments" />
            <Field label="Address *" value={address} onChange={setAddress} placeholder="123, MG Road" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="City *"    value={city}    onChange={setCity}    placeholder="Bengaluru" />
              <Field label="State *"   value={state}   onChange={setState}   placeholder="Karnataka" />
              <Field label="Pincode *" value={pincode} onChange={setPincode} placeholder="560001" />
              <Field label="Total Units *" value={totalUnits} onChange={setTotalUnits} placeholder="200" type="number" />
            </div>
            <div className="flex justify-end pt-2">
              <button
                disabled={!canProceed1}
                onClick={() => setStep(2)}
                className="flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-semibold text-white transition-colors"
              >
                Next: Admin Details <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Admin ─────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4 animate-slide-up">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-violet-400" /> Society Admin Details
            </h2>
            <p className="text-sm text-slate-400">
              This person will receive an invitation and manage the society on Nestlink.
            </p>
            <Field label="Admin Name *"  value={adminName}  onChange={setAdminName}  placeholder="Ravi Kumar" />
            <Field label="Admin Phone *" value={adminPhone} onChange={setAdminPhone} placeholder="+919876543210" type="tel" />
            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(1)} className="text-sm text-slate-400 hover:text-white transition-colors">← Back</button>
              <button
                disabled={!canProceed2}
                onClick={() => setStep(3)}
                className="flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-semibold text-white transition-colors"
              >
                Next: Plan & Confirm <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Plan ──────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-5 animate-slide-up">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-violet-400" /> Select Plan & Confirm
            </h2>

            <div className="grid grid-cols-2 gap-3">
              {PLANS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPlan(p.value)}
                  className={`text-left rounded-xl border p-3.5 transition-all ${plan === p.value ? "border-violet-500/60 bg-violet-600/15" : `${p.color} hover:border-violet-700/40`}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-bold text-sm text-white capitalize">{p.label}</p>
                    {plan === p.value && <CheckCircle2 className="h-4 w-4 text-violet-400" />}
                  </div>
                  <p className="text-xs text-slate-400">{p.desc}</p>
                  <p className="text-sm font-semibold text-violet-300 mt-2">{p.price}</p>
                </button>
              ))}
            </div>

            {/* Summary */}
            <div className="rounded-xl border border-violet-900/30 bg-[#1a1a2e] p-4 space-y-2 text-sm">
              <p className="font-semibold text-white mb-3">Summary</p>
              {[
                ["Society", name],
                ["Location", `${city}, ${state} ${pincode}`],
                ["Total Units", totalUnits],
                ["Admin", `${adminName} · ${adminPhone}`],
                ["Plan", plan.toUpperCase()],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-slate-400">
                  <span>{k}</span>
                  <span className="text-white font-medium">{v}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-1">
              <button onClick={() => setStep(2)} className="text-sm text-slate-400 hover:text-white transition-colors">← Back</button>
              <button
                onClick={submit}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 disabled:opacity-50 px-6 py-2.5 text-sm font-semibold text-white transition-opacity shadow-lg shadow-violet-600/20"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4" /> Onboard Society</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-violet-900/30 bg-[#1a1a2e] px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/50 transition-colors"
      />
    </div>
  );
}
