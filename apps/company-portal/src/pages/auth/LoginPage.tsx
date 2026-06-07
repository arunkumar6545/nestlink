// @ts-nocheck
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2, Mail, Lock, Phone, ShieldCheck,
  ArrowRight, KeyRound, Eye, EyeOff, Info,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

type Method = "password" | "otp";
type OtpStep = "phone" | "code";

const DEFAULT_EMAIL    = "ceo@nestlink.in";
const DEFAULT_PASSWORD = "Nestlink@2024";

export default function LoginPage() {
  const navigate = useNavigate();
  const [method, setMethod] = useState<Method>("password");

  // ── Email / Password ───────────────────────────────────────────
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [showPass,    setShowPass]    = useState(false);

  // ── Phone OTP ─────────────────────────────────────────────────
  const [otpStep, setOtpStep] = useState<OtpStep>("phone");
  const [phone,   setPhone]   = useState("");
  const [otp,     setOtp]     = useState("");

  const [loading, setLoading] = useState(false);

  // ── Shared: verify role after sign-in ─────────────────────────
  async function checkRoleAndRedirect(userId: string, displayName?: string) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, name")
      .eq("id", userId)
      .single();

    if (profile?.role !== "super_admin") {
      await supabase.auth.signOut();
      toast.error("Access denied — this portal is for Nestlink staff only.");
      return;
    }
    toast.success(`Welcome, ${displayName ?? profile.name ?? "Admin"}`);
    navigate("/", { replace: true });
  }

  // ── Email + Password sign-in ───────────────────────────────────
  async function signInWithPassword() {
    if (!email.trim() || !password) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
      await checkRoleAndRedirect(data.user!.id, data.user!.user_metadata?.name);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  // ── Phone OTP ─────────────────────────────────────────────────
  async function sendOtp() {
    const normalized = phone.startsWith("+") ? phone : `+91${phone}`;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: normalized });
      if (error) throw error;
      toast.success("OTP sent");
      setPhone(normalized);
      setOtpStep("code");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to send OTP";
      if (msg.includes("SMS") || msg.includes("provider") || msg.includes("disabled")) {
        toast.info("Local dev mode — enter OTP 123456");
        setPhone(phone.startsWith("+") ? phone : `+91${phone}`);
        setOtpStep("code");
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
      const { data, error } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
      if (error) throw error;
      await checkRoleAndRedirect(data.user!.id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  function fillDefaults() {
    setEmail(DEFAULT_EMAIL);
    setPassword(DEFAULT_PASSWORD);
  }

  return (
    <div className="min-h-screen bg-[#0f0f17] flex items-center justify-center px-4">
      {/* Background glows */}
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

        {/* Default credentials hint */}
        <div
          onClick={fillDefaults}
          title="Click to autofill"
          className="mb-4 flex items-start gap-3 rounded-xl border border-violet-800/40 bg-violet-950/30 px-4 py-3 cursor-pointer hover:bg-violet-950/50 transition-colors"
        >
          <Info className="h-4 w-4 text-violet-400 mt-0.5 shrink-0" />
          <div className="text-xs leading-relaxed">
            <p className="font-semibold text-violet-300 mb-0.5">Default CEO Account</p>
            <p className="text-slate-400">
              Username: <span className="font-mono text-white">{DEFAULT_EMAIL}</span>
            </p>
            <p className="text-slate-400">
              Password: <span className="font-mono text-white">{DEFAULT_PASSWORD}</span>
            </p>
            <p className="text-slate-600 mt-1 text-[10px]">Click to autofill · Change password after first login</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-violet-900/30 bg-[#13131f] shadow-2xl shadow-black/40 overflow-hidden">
          {/* Method toggle */}
          <div className="flex border-b border-violet-900/20">
            {(["password", "otp"] as Method[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMethod(m); setOtpStep("phone"); }}
                className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                  method === m
                    ? "bg-violet-600/15 text-violet-300 border-b-2 border-violet-500"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {m === "password" ? (
                  <span className="flex items-center justify-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email & Password</span>
                ) : (
                  <span className="flex items-center justify-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Phone OTP</span>
                )}
              </button>
            ))}
          </div>

          <div className="p-7">
            {/* ─── Email + Password ──────────────────────────────── */}
            {method === "password" && (
              <div className="space-y-4 animate-slide-up">
                <div>
                  <h2 className="text-lg font-semibold text-white">Sign in to your account</h2>
                  <p className="text-sm text-slate-400 mt-0.5">Use your Nestlink staff credentials</p>
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Email</label>
                  <div className="flex items-center gap-2 rounded-xl border border-violet-900/30 bg-[#1a1a2e] px-4 py-3 focus-within:border-violet-500/50 focus-within:ring-1 focus-within:ring-violet-500/20 transition-all">
                    <Mail className="h-4 w-4 text-slate-500 shrink-0" />
                    <input
                      type="email"
                      placeholder="ceo@nestlink.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && document.getElementById("password-input")?.focus()}
                      className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none"
                      autoFocus
                      autoComplete="username"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Password</label>
                  <div className="flex items-center gap-2 rounded-xl border border-violet-900/30 bg-[#1a1a2e] px-4 py-3 focus-within:border-violet-500/50 focus-within:ring-1 focus-within:ring-violet-500/20 transition-all">
                    <Lock className="h-4 w-4 text-slate-500 shrink-0" />
                    <input
                      id="password-input"
                      type={showPass ? "text" : "password"}
                      placeholder="••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && signInWithPassword()}
                      className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="text-slate-600 hover:text-slate-400 transition-colors"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  onClick={signInWithPassword}
                  disabled={loading || !email.trim() || !password}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-600/20"
                >
                  {loading
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <><ShieldCheck className="h-4 w-4" /> Sign In <ArrowRight className="h-4 w-4" /></>
                  }
                </button>
              </div>
            )}

            {/* ─── Phone OTP ─────────────────────────────────────── */}
            {method === "otp" && otpStep === "phone" && (
              <div className="space-y-4 animate-slide-up">
                <div>
                  <h2 className="text-lg font-semibold text-white">Sign in with phone</h2>
                  <p className="text-sm text-slate-400 mt-0.5">Enter your registered mobile number</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">Phone Number</label>
                  <div className="flex items-center gap-2 rounded-xl border border-violet-900/30 bg-[#1a1a2e] px-4 py-3 focus-within:border-violet-500/50 focus-within:ring-1 focus-within:ring-violet-500/20 transition-all">
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
              </div>
            )}

            {method === "otp" && otpStep === "code" && (
              <div className="space-y-4 animate-slide-up">
                <div>
                  <button
                    onClick={() => { setOtpStep("phone"); setOtp(""); }}
                    className="text-xs text-violet-400 hover:text-violet-300 mb-2 transition-colors"
                  >
                    ← Change number
                  </button>
                  <h2 className="text-lg font-semibold text-white">Enter verification code</h2>
                  <p className="text-sm text-slate-400 mt-0.5">
                    Sent to <span className="text-violet-300 font-medium">{phone}</span>
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">6-Digit OTP</label>
                  <div className="flex items-center gap-2 rounded-xl border border-violet-900/30 bg-[#1a1a2e] px-4 py-3 focus-within:border-violet-500/50 focus-within:ring-1 focus-within:ring-violet-500/20 transition-all">
                    <KeyRound className="h-4 w-4 text-slate-500 shrink-0" />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="123456"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      onKeyDown={(e) => e.key === "Enter" && otp.length === 6 && verifyOtp()}
                      className="flex-1 bg-transparent text-lg font-mono tracking-[0.4em] text-white placeholder:text-slate-600 outline-none"
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
        </div>

        <p className="text-center text-xs text-slate-700 mt-6">
          Nestlink Technology Pvt. Ltd. — Internal Platform
        </p>
      </div>
    </div>
  );
}
