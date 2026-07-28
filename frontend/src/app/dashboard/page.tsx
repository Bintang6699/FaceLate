"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchApi } from "@/lib/api";
import { UsersIcon, ClockIcon, UserPlusIcon, ScanFaceIcon, ChevronRightIcon, CalendarIcon, DownloadIcon, CheckCircleIcon } from "lucide-react";

export default function DashboardPage() {
  const [stats, setStats] = useState({ total_students: 0, total_lates_all_time: 0 });
  const [todayLates, setTodayLates] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const loadData = async () => {
    setLoadingStats(true);
    try {
      const [statsData, latesData] = await Promise.all([
        fetchApi<any>("/reports/stats").catch(() => ({ total_students: 0, total_lates_all_time: 0 })),
        fetchApi<any[]>("/reports/lates/today").catch(() => []) 
      ]);
      setStats(statsData);
      setTodayLates(latesData);
    } catch (_) {}
    finally { setLoadingStats(false); }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDownloadTodayPDF = async () => {
    setDownloading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch(`http://localhost:8000/api/reports/lates/today/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.detail || "Gagal mengunduh PDF");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Laporan_Terlambat_Hari_Ini.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal mengunduh PDF");
    } finally {
      setDownloading(false);
    }
  };

  const todayLatesCount = todayLates.length;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8 pb-10">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Dashboard Overview</h2>
          <p className="text-slate-500 text-sm mt-1">Ringkasan data absensi dan pintasan aksi.</p>
        </div>
        <button 
          onClick={handleDownloadTodayPDF} 
          disabled={downloading || todayLatesCount === 0}
          className="bg-white dark:bg-slate-900 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-lg font-medium shadow-sm transition-all active:scale-95 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {downloading ? (
            <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin mr-2"></div>
          ) : (
            <DownloadIcon className="h-4 w-4 mr-2" />
          )}
          Export Harian (PDF)
        </button>
      </div>

      {/* ===== 2 BIG ACTION BUTTONS ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Link href="/dashboard/scan-attendance">
          <div className="group relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-7 cursor-pointer hover:shadow-xl hover:shadow-emerald-200 transition-all duration-300 hover:-translate-y-0.5 h-full flex flex-col justify-between">
            <div className="absolute top-[-30px] right-[-30px] w-32 h-32 bg-white/10 rounded-full" />
            <div className="absolute bottom-[-20px] right-[60px] w-20 h-20 bg-white/10 rounded-full" />
            <div className="relative">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <ScanFaceIcon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Scan Absensi Terlambat</h3>
              <p className="text-emerald-100 text-sm leading-relaxed mb-4">
                Sistem pendeteksi wajah untuk siswa yang sudah terdata. Data keterlambatan akan tercatat secara otomatis.
              </p>
              <div className="flex items-center text-emerald-100 text-sm font-medium group-hover:text-white transition-colors mt-auto">
                Mulai Kamera Scanner <ChevronRightIcon className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </Link>

        <Link href="/dashboard/register-student">
          <div className="group relative overflow-hidden bg-gradient-to-br from-[#4f46e5] to-[#7c3aed] rounded-2xl p-7 cursor-pointer hover:shadow-xl hover:shadow-indigo-200 transition-all duration-300 hover:-translate-y-0.5 h-full flex flex-col justify-between">
            <div className="absolute top-[-30px] right-[-30px] w-32 h-32 bg-white/10 rounded-full" />
            <div className="absolute bottom-[-20px] right-[60px] w-20 h-20 bg-white/10 rounded-full" />
            <div className="relative">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <UserPlusIcon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Daftarkan Siswa Baru</h3>
              <p className="text-indigo-200 text-sm leading-relaxed mb-4">
                Daftarkan profil wajah dan data diri siswa baru agar dapat dideteksi oleh sistem scanner absensi.
              </p>
              <div className="flex items-center text-indigo-200 text-sm font-medium group-hover:text-white transition-colors mt-auto">
                Input Data Baru <ChevronRightIcon className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex items-center gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
            <UsersIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Siswa Terdata</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{loadingStats ? "..." : stats.total_students}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex items-center gap-4">
          <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded-xl">
            <CalendarIcon className="h-6 w-6 text-red-500 dark:text-red-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Terlambat Hari Ini</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{loadingStats ? "..." : todayLatesCount}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 flex items-center gap-4">
          <div className="p-3 bg-orange-50 dark:bg-orange-900/30 rounded-xl">
            <ClockIcon className="h-6 w-6 text-orange-500 dark:text-orange-400" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Keterlambatan (All Time)</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{loadingStats ? "..." : stats.total_lates_all_time}</p>
          </div>
        </div>
      </div>

      {/* Widget Keterlambatan Hari Ini */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col mt-8">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Daftar Keterlambatan Hari Ini</h3>
            <p className="text-xs text-slate-500 mt-1">Otomatis di-reset setiap pukul 00:00.</p>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 font-medium whitespace-nowrap">Waktu</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap">Nama Siswa</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap">Kelas</th>
                <th className="px-6 py-4 font-medium whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loadingStats ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">Memuat data hari ini...</td>
                </tr>
              ) : todayLates.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 mb-3">
                      <CheckCircleIcon className="w-6 h-6" />
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 font-medium">Belum ada yang terlambat hari ini.</p>
                    <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Bagus sekali!</p>
                  </td>
                </tr>
              ) : (
                todayLates.map((late) => (
                  <tr key={late.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">
                      {new Date(late.late_time).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-200 whitespace-nowrap">
                      {late.name}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      <span className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-2 py-1 rounded-md text-xs font-semibold border border-slate-200 dark:border-slate-700">
                        {late.class_name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
                      {late.notes || "Otomatis via Face Recognition"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


