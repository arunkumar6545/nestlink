// @ts-nocheck
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Phone, ShieldCheck, ArrowRight, KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type Step = "phone" | "otp";

export default function LoginPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendOtp() {
    const normalized = phone.startsWith("+") ? phone : `+91${phone}`;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: normalized });
      if (error) throw error;
      toast.success("OTP sent — check your phone");
      setPhone(normalized);
      setStep("otp");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to send OTP";
      // In local dev Supabase disables SMS — still advance to OTP step
      if (msg.includes("SMS") || msg.includes("provider") || msg.includes("disabled")) {
        toast.info("Local dev: use OTP 123456 for test number, or check Supabase Studio → Authentication → Users");
        setPhone(phone.startsWith("+") ? phone : `+91${phone}`);
        setStep("otp");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: "sms",
      });
      if (error) throw error;

      // Check super_admin role
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role, name")
        .eq("id", data.user!.id)
        .single();

      if (profile?.role !== "super_admin") {
        await supabase.auth.signOut();
        toast.error("Access denied — this portal is for Nestlink staff only.");
        setStep("phone");
        setOtp("");
        return;
      }

      toast.success(`Welcome back, ${profile.name || "Admin"}`);
      navigate("/", { replace: true });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f17] flex items-center justify-center px-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-indigo-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/25">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight">Nestlink</span>
          </div>
          <p className="text-slate-400 text-sm">Company Portal — Staff Access Only</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-violet-900/30 bg-[#13131f] p-8 shadow-2xl shadow-black/40">
          {step === "phone" ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-white">Sign in to your account</h2>
                <p className="text-sm text-slate-400 mt-1">Enter your registered phone number</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Phone Number</label>
                <div className="flex items-center gap-2 rounded-xl border border-violet-900/30 bg-[#1a1a2e] px-4 py-3 focus-within:border-violet-500/50 focus-within:ring-1 focus-within:ring-violet-500/30 transition-all">
                  <Phone className="h-4 w-4 text-slate-500 shrink-0" />
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && phone.trim() && sendOtp()}
                    className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none"
                    autoFocus
                  />
                </div>
              </div>

              <button
                onClick={sendOtp}
                disabled={loading || !phone.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-600/20"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Send OTP <ArrowRight className="h-4 w-4" /></>}
              </button>

              <p className="text-center text-xs text-slate-600">
                Only Nestlink super admins can access this portal
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <button
                  onClick={() => { setStep("phone"); setOtp(""); }}
                  className="text-xs text-violet-400 hover:text-violet-300 mb-3 transition-colors"
                >
                  ← Change number
                </button>
                <h2 className="text-lg font-semibold text-white">Enter verification code</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Sent to <span className="text-violet-300 font-medium">{phone}</span>
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">6-digit OTP</label>
                <div className="flex items-center gap-2 rounded-xl border border-violet-900/30 bg-[#1a1a2e] px-4 py-3 focus-within:border-violet-500/50 focus-within:ring-1 focus-within:ring-violet-500/30 transition-all">
                  <KeyRound className="h-4 w-4 text-slate-500 shrink-0" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && otp.length === 6 && verifyOtp()}
                    className="flex-1 bg-transparent text-lg font-mono tracking-widest text-white placeholder:text-slate-600 outline-none"
                    autoFocus
                  />
                </div>
              </div>

              <button
                onClick={verifyOtp}
                disabled={loading || otp.length !== 6}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-600/20"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Verify & Sign In <ShieldCheck className="h-4 w-4" /></>}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-700 mt-6">
          Nestlink Technology Pvt. Ltd. — Internal Platform
        </p>
      </div>
    </div>
  );
}
