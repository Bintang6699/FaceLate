"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Hard guard: blocks double-taps before React re-renders the disabled state
  const submittingRef = useRef(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError("");

    try {
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);

      const response = await fetchApi<{ access_token: string }>("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
        requireAuth: false,
      });

      localStorage.setItem("token", response.access_token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Email atau password salah.");
      submittingRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#f0f4ff]">
      {/* Left Panel - Decorative */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#4f46e5] to-[#7c3aed] flex-col items-center justify-center p-16 relative overflow-hidden">
        {/* Circles decoration */}
        <div className="absolute top-[-80px] left-[-80px] w-80 h-80 bg-white/10 rounded-full" />
        <div className="absolute bottom-[-60px] right-[-60px] w-64 h-64 bg-white/10 rounded-full" />
        <div className="absolute top-1/2 right-[-30px] w-40 h-40 bg-white/5 rounded-full" />

        <div className="relative z-10 text-center text-white">
          {/* Logo / Icon */}
          <div className="w-24 h-24 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-8 backdrop-blur-sm">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold mb-3 tracking-tight">FaceLate AI</h1>
          <p className="text-indigo-200 text-lg max-w-xs leading-relaxed">
            Sistem pencatatan keterlambatan siswa berbasis pengenalan wajah
          </p>
          <div className="mt-10 flex flex-col gap-3 text-left max-w-xs mx-auto">
            {["Deteksi wajah otomatis real-time", "Data terstruktur per kelas", "Catatan keterlambatan akurat"].map((f) => (
              <div key={f} className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
                <div className="w-2 h-2 rounded-full bg-indigo-300 flex-shrink-0" />
                <span className="text-sm text-indigo-100">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-16">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-3xl font-bold text-[#4f46e5]">FaceLate AI</h1>
            <p className="text-slate-500 text-sm mt-1">Sistem Absensi Pengenalan Wajah</p>
          </div>

          <div className="bg-white rounded-3xl shadow-xl shadow-indigo-100 p-8 lg:p-10">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-800">Selamat Datang</h2>
              <p className="text-slate-500 mt-1 text-sm">Masuk ke panel guru / admin</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl mb-5 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all text-sm"
                  placeholder="email@sekolah.sch.id"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all text-sm"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#4f46e5] hover:bg-[#4338ca] active:scale-[0.98] text-white font-semibold rounded-xl shadow-md shadow-indigo-200 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center mt-2"
              >
                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Masuk"}
              </button>
            </form>

            <p className="text-center text-xs text-slate-400 mt-8">
              SMP Negeri 01 Dompu &mdash; FaceLate AI &copy; 2026
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

