"use client";

import { useEffect, useRef, useState } from "react";
import { fetchApi } from "@/lib/api";
import { SaveIcon, Loader2, ShieldCheckIcon, UserIcon } from "lucide-react";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Hard guard: blocks double-taps before React re-renders the disabled state
  const savingRef = useRef(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Profile form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Password form state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const user = await fetchApi<any>("/auth/me");
        setName(user.name);
        setEmail(user.email);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setMessage(null);
    try {
      await fetchApi("/auth/me", {
        method: "PUT",
        body: JSON.stringify({ name, email }),
      });
      setMessage({ type: "success", text: "Profile updated successfully! Please login again if you changed email." });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to update profile." });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match!" });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setMessage(null);
    try {
      await fetchApi("/auth/me", {
        method: "PUT",
        body: JSON.stringify({ password: newPassword }),
      });
      setNewPassword("");
      setConfirmPassword("");
      setMessage({ type: "success", text: "Password changed successfully!" });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to change password." });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Settings</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your account credentials.</p>
      </div>

      {/* Feedback Message */}
      {message && (
        <div className={`mb-6 px-4 py-3 rounded-xl text-sm font-medium border ${
          message.type === "success"
            ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400"
            : "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400"
        }`}>
          {message.text}
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary/10 rounded-xl">
            <UserIcon className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Profile Information</h3>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              placeholder="Your full name"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              placeholder="your@email.com"
              required
            />
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-70"
            >
              {saving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <SaveIcon className="h-4 w-4 mr-2" />}
              Save Profile
            </button>
          </div>
        </form>
      </div>

      {/* Password Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-xl">
            <ShieldCheckIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Change Password</h3>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              placeholder="Min. 6 characters"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              placeholder="Repeat your new password"
              required
            />
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl shadow-sm transition-all active:scale-95 disabled:opacity-70"
            >
              {saving ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <ShieldCheckIcon className="h-4 w-4 mr-2" />}
              Change Password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
