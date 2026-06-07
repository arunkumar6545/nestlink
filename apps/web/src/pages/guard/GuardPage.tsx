// @ts-nocheck
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { QrCode, CheckCircle, LogOut, ArrowRightLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime } from "@nestlink/core";

interface ScanResult {
  visitor_name: string;
  flat: string;
  purpose: string;
  valid_until: string;
  status: string;
}

export default function GuardPage() {
  const { profile, signOut } = useAuth();
  const [otp, setOtp] = useState("");
  const [action, setAction] = useState<"checkin" | "checkout">("checkin");
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);

  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (otp.length !== 6) throw new Error("OTP must be 6 digits");

      const { data: pass, error } = await supabase
        .from("visitor_passes")
        .select(`
          id, status, valid_until,
          visitors:visitor_id (name, purpose),
          flats:flat_id (number, towers (name))
        `)
        .eq("otp", otp)
        .eq("status", "active")
        .single();

      if (error || !pass) throw new Error("Invalid or expired OTP");

      const now = new Date();
      const validUntil = new Date(pass.valid_until);
      if (now > validUntil) throw new Error("Pass has expired");

      const { error: logError } = await supabase.from("visitor_logs").insert({
        pass_id: pass.id,
        guard_id: profile!.id,
        action,
        timestamp: now.toISOString(),
      });

      if (logError) throw logError;

      if (action === "checkin") {
        await supabase
          .from("visitor_passes")
          .update({ status: "used" })
          .eq("id", pass.id);
      }

      const visitor = pass.visitors as { name: string; purpose: string } | null;
      const flat = pass.flats as { number: string; towers: { name: string } | null } | null;

      return {
        visitor_name: visitor?.name ?? "Unknown",
        flat: `${flat?.towers?.name} - Flat ${flat?.number}`,
        purpose: visitor?.purpose ?? "",
        valid_until: pass.valid_until,
        status: pass.status,
      } as ScanResult;
    },
    onSuccess: (result) => {
      setLastResult(result);
      setOtp("");
      toast.success(`${action === "checkin" ? "Checked in" : "Checked out"} successfully`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold">Guard Portal</h1>
          <p className="text-sm text-slate-400">{profile?.name}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={signOut} className="text-slate-400">
          <LogOut className="h-5 w-5" />
        </Button>
      </div>

      {/* OTP Entry */}
      <Card className="bg-slate-800 border-slate-700 text-white mb-6">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
              <QrCode className="h-5 w-5 text-primary" />
            </div>
            <h2 className="font-semibold">Verify Visitor OTP</h2>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Action</Label>
            <Select value={action} onValueChange={(v) => setAction(v as "checkin" | "checkout")}>
              <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-white">
                <SelectItem value="checkin">Check In</SelectItem>
                <SelectItem value="checkout">Check Out</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Enter OTP</Label>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="6-digit OTP"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="text-center text-3xl tracking-widest font-bold h-16 bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
            />
          </div>

          <Button
            className="w-full h-12 text-base"
            disabled={otp.length !== 6 || verifyMutation.isPending}
            onClick={() => verifyMutation.mutate()}
          >
            <ArrowRightLeft className="h-5 w-5" />
            {verifyMutation.isPending ? "Verifying..." : `${action === "checkin" ? "Check In" : "Check Out"} Visitor`}
          </Button>
        </CardContent>
      </Card>

      {/* Last Result */}
      {lastResult && (
        <Card className="bg-green-900/40 border-green-700 text-white">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="h-6 w-6 text-green-400" />
              <p className="font-semibold text-green-300">Access Granted</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Visitor</span>
                <span className="font-medium">{lastResult.visitor_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Flat</span>
                <span className="font-medium">{lastResult.flat}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Purpose</span>
                <span className="font-medium">{lastResult.purpose}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Valid Until</span>
                <span className="font-medium">{formatDateTime(lastResult.valid_until)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
