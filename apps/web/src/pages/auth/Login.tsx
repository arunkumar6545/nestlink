import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Building2, Phone, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { loginSchema, verifyOtpSchema } from "@nestlink/core";
import type { z } from "zod";

type LoginForm = z.infer<typeof loginSchema>;
type OtpForm = z.infer<typeof verifyOtpSchema>;

export default function Login() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const otpForm = useForm<OtpForm>({
    resolver: zodResolver(verifyOtpSchema),
    defaultValues: { type: "sms" },
  });

  async function onPhoneSubmit(data: LoginForm) {
    setIsLoading(true);
    const formatted = data.phone.startsWith("+") ? data.phone : `+91${data.phone}`;

    const { error } = await supabase.auth.signInWithOtp({ phone: formatted });

    if (error) {
      toast.error(error.message);
    } else {
      setPhone(formatted);
      setStep("otp");
      toast.success("OTP sent to your phone");
    }
    setIsLoading(false);
  }

  async function onOtpSubmit(data: OtpForm) {
    setIsLoading(true);
    const { data: authData, error } = await supabase.auth.verifyOtp({
      phone,
      token: data.otp,
      type: "sms",
    });

    if (error) {
      toast.error(error.message);
      setIsLoading(false);
      return;
    }

    if (authData.user) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("role")
        .eq("id", authData.user.id)
        .single();

      const role = profile?.role ?? "resident";
      if (role === "super_admin") navigate("/superadmin");
      else if (role === "admin") navigate("/admin");
      else if (role === "guard") navigate("/guard");
      else navigate("/resident");
      toast.success("Welcome back!");
    }
    setIsLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg mb-4">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Nestlink</h1>
          <p className="text-slate-400 text-sm mt-1">Your society's digital backbone</p>
        </div>

        <Card className="shadow-2xl border-slate-700/50 bg-slate-800/50 backdrop-blur text-white">
          <CardHeader>
            <CardTitle className="text-white">
              {step === "phone" ? "Sign in to Nestlink" : "Verify your phone"}
            </CardTitle>
            <CardDescription className="text-slate-400">
              {step === "phone"
                ? "Enter your phone number to receive a one-time password"
                : `Enter the 6-digit OTP sent to ${phone}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "phone" ? (
              <form onSubmit={loginForm.handleSubmit(onPhoneSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-slate-200">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+91 9876543210"
                      className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus-visible:ring-primary"
                      {...loginForm.register("phone")}
                    />
                  </div>
                  {loginForm.formState.errors.phone && (
                    <p className="text-sm text-red-400">{loginForm.formState.errors.phone.message}</p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Send OTP <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp" className="text-slate-200">One-Time Password</Label>
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    placeholder="123456"
                    maxLength={6}
                    className="text-center text-2xl tracking-widest bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus-visible:ring-primary"
                    {...otpForm.register("otp")}
                  />
                  {otpForm.formState.errors.otp && (
                    <p className="text-sm text-red-400">{otpForm.formState.errors.otp.message}</p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Verify & Sign In <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-slate-400"
                  onClick={() => setStep("phone")}
                >
                  Change phone number
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
