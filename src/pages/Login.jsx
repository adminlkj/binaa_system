import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, Loader2, Eye, EyeOff } from "lucide-react";
import GoogleIcon from "@/components/GoogleIcon";

const BG_IMAGE =
  "https://media.base44.com/images/public/6a44ed8818188b4da27cc800/c4fc4ea30_Gemini_Generated_Image_xeuiioxeuiioxeui.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      window.location.href = "/";
    } catch (err) {
      setError(err.message || "بيانات الدخول غير صحيحة");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", "/");
  };

  return (
    <div dir="rtl" className="relative min-h-screen w-full overflow-hidden flex items-center justify-center p-4">
      {/* Animated construction background */}
      <div
        className="absolute inset-0 bg-cover bg-center animate-kenburns"
        style={{ backgroundImage: `url(${BG_IMAGE})` }}
        aria-hidden="true"
      />
      {/* Warm-to-dark gradient overlay tuned to the image tones */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/60 to-orange-900/30" aria-hidden="true" />

      {/* Glass login card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-xl shadow-2xl p-8">
          <div className="flex flex-col items-center text-center mb-7">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shadow-lg shadow-orange-500/30 mb-4">
              <LogIn className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">مرحباً بعودتك</h1>
            <p className="text-sm text-white/70 mt-1">سجّل الدخول إلى حسابك</p>
          </div>

          <Button
            variant="outline"
            className="w-full h-12 text-sm font-medium mb-6 bg-white/10 border-white/25 text-white hover:bg-white/20 hover:text-white"
            onClick={handleGoogle}
          >
            <GoogleIcon className="w-5 h-5 ml-2" />
            المتابعة عبر Google
          </Button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/20" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-transparent px-3 text-white/60">أو</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/20 border border-rose-400/30 text-rose-100 text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/90">البريد الإلكتروني</Label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" aria-hidden="true" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pr-10 h-12 bg-white/10 border-white/25 text-white placeholder:text-white/40 focus-visible:ring-orange-400/60"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-white/90">كلمة المرور</Label>
                <Link to="/forgot-password" className="text-xs text-orange-300 hover:underline">
                  نسيت كلمة المرور؟
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60" aria-hidden="true" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="px-10 h-12 bg-white/10 border-white/25 text-white placeholder:text-white/40 focus-visible:ring-orange-400/60"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-12 font-medium bg-gradient-to-l from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-0 shadow-lg shadow-orange-500/25"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جاري تسجيل الدخول...
                </>
              ) : (
                "تسجيل الدخول"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-white/70 mt-6">
            ليس لديك حساب؟{" "}
            <Link to="/register" className="text-orange-300 font-medium hover:underline">
              أنشئ حساباً
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}