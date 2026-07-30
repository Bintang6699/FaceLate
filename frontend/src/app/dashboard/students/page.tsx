"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fetchApi, API_BASE_URL } from "@/lib/api";
import { CameraIcon, UserPlusIcon, TrashIcon, EditIcon, AlertTriangleIcon, SearchIcon, LayersIcon, ClockIcon, DownloadIcon, PlusIcon, MinusIcon, RefreshCcwIcon } from "lucide-react";

export default function StudentsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Modals
  const [editStudent, setEditStudent] = useState<any | null>(null);
  const [bulkDeleteClass, setBulkDeleteClass] = useState<string | null>(null);
  const [resetLatesClass, setResetLatesClass] = useState<string | null>(null);
  const [historyStudent, setHistoryStudent] = useState<any | null>(null);
  const [historyData, setHistoryData] = useState<any[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [downloadClass, setDownloadClass] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  // Hard guard so rapid taps can never fire the same mutation twice
  const actionRef = useRef(false);

  const loadHistory = async (student: any) => {
    setHistoryStudent(student);
    setLoadingHistory(true);
    setHistoryData(null);
    try {
      const data = await fetchApi<any[]>(`/students/${student.id}/history`);
      setHistoryData(data);
    } catch (e) {
      alert("Gagal memuat histori keterlambatan");
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const studentsData = await fetchApi<any[]>("/students");
      setStudents(studentsData);
    } catch (error) {
      console.error("Failed to load students", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteStudent = async (id: string) => {
    if (!confirm("Yakin ingin menghapus data siswa ini?")) return;
    if (actionRef.current) return;
    actionRef.current = true;
    try {
      await fetchApi(`/students/${id}`, { method: "DELETE" });
      loadData();
    } catch (e) {
      alert("Gagal menghapus siswa");
    } finally {
      actionRef.current = false;
    }
  };

  const handleBulkDelete = async () => {
    if (!bulkDeleteClass || actionRef.current) return;
    actionRef.current = true;
    setBusyAction(true);
    try {
      await fetchApi(`/students/class/${encodeURIComponent(bulkDeleteClass)}`, { method: "DELETE" });
      setBulkDeleteClass(null);
      loadData();
    } catch (e) {
      alert("Gagal menghapus data kelas");
    } finally {
      actionRef.current = false;
      setBusyAction(false);
    }
  };

  const handleAdjustLates = async (id: string, amount: number) => {
    if (actionRef.current) return;
    actionRef.current = true;
    try {
      await fetchApi(`/students/${id}/adjust-lates`, {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
      loadData();
    } catch (e) {
      alert("Gagal mengubah nilai keterlambatan");
    } finally {
      actionRef.current = false;
    }
  };

  const handleResetClassLates = async () => {
    if (!resetLatesClass || actionRef.current) return;
    actionRef.current = true;
    setBusyAction(true);
    try {
      await fetchApi(`/students/class/${encodeURIComponent(resetLatesClass)}/reset-lates`, {
        method: "POST"
      });
      setResetLatesClass(null);
      loadData();
      alert(`Berhasil mereset nilai absensi kelas ${resetLatesClass}`);
    } catch (e) {
      alert("Gagal mereset absen kelas");
    } finally {
      actionRef.current = false;
      setBusyAction(false);
    }
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStudent || actionRef.current) return;
    actionRef.current = true;
    setSavingEdit(true);
    try {
      await fetchApi(`/students/${editStudent.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editStudent.name,
          class_name: editStudent.class_name,
          address: editStudent.address
        }),
      });
      setEditStudent(null);
      loadData();
    } catch (e) {
      alert("Gagal mengupdate siswa");
    } finally {
      actionRef.current = false;
      setSavingEdit(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.class_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get unique classes for bulk delete
  const uniqueClasses = Array.from(new Set(students.map(s => s.class_name))).sort();

  const handleDownloadPDF = async () => {
    if (!downloadClass) return;
    setDownloading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch(`${API_BASE_URL}/reports/students/pdf/${encodeURIComponent(downloadClass)}`, {
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
      a.download = `Data_Siswa_${downloadClass.replace(" ", "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setDownloadClass(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Gagal mengunduh PDF");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Manajemen Siswa</h2>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mt-1">Kelola data siswa, edit informasi, dan hapus kelas (lulusan).</p>
        </div>
        <div className="flex gap-2 sm:gap-3 flex-wrap w-full sm:w-auto">
          <button onClick={() => setDownloadClass("")} className="flex-1 sm:flex-none justify-center bg-white dark:bg-slate-900 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-medium shadow-sm transition-all active:scale-95 flex items-center">
            <DownloadIcon className="h-4 w-4 sm:mr-2 mr-1" />
            <span className="hidden sm:inline">Download PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>
          <button onClick={() => setResetLatesClass("")} className="flex-1 sm:flex-none justify-center bg-white dark:bg-slate-900 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-medium shadow-sm transition-all active:scale-95 flex items-center">
            <RefreshCcwIcon className="h-4 w-4 sm:mr-2 mr-1" />
            <span className="hidden sm:inline">Reset Absen Kelas</span>
            <span className="sm:hidden">Reset</span>
          </button>
          <button onClick={() => setBulkDeleteClass("")} className="flex-1 sm:flex-none justify-center bg-white dark:bg-slate-900 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-medium shadow-sm transition-all active:scale-95 flex items-center">
            <LayersIcon className="h-4 w-4 sm:mr-2 mr-1" />
            <span className="hidden sm:inline">Hapus Kelas</span>
            <span className="sm:hidden">Hapus</span>
          </button>
          <Link href="/dashboard/register-student" className="flex-1 sm:flex-none justify-center bg-primary hover:bg-primary/90 text-primary-foreground px-3 sm:px-4 py-2 rounded-lg text-sm sm:text-base font-medium shadow-sm transition-all active:scale-95 flex items-center">
            <UserPlusIcon className="h-4 w-4 sm:mr-2 mr-1" />
            <span className="hidden sm:inline">Tambah Siswa</span>
            <span className="sm:hidden">Tambah</span>
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center">
          <div className="relative w-full max-w-sm">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Cari nama atau kelas..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-3 md:px-6 py-3 md:py-4 font-medium whitespace-nowrap">Nama</th>
                <th className="px-3 md:px-6 py-3 md:py-4 font-medium whitespace-nowrap">Kelas</th>
                <th className="px-3 md:px-6 py-3 md:py-4 font-medium hidden md:table-cell whitespace-nowrap">Alamat</th>
                <th className="px-3 md:px-6 py-3 md:py-4 font-medium whitespace-nowrap text-center sm:text-left">Terlambat</th>
                <th className="px-3 md:px-6 py-3 md:py-4 font-medium text-right whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Memuat data siswa...</td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    Tidak ada data siswa ditemukan.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-3 md:px-6 py-3 md:py-4 font-medium text-slate-900 dark:text-slate-200 whitespace-nowrap min-w-[120px]">{student.name}</td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      <span className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-2 py-1 md:px-2.5 md:py-1 rounded-md text-xs font-semibold border border-slate-200 dark:border-slate-700">
                        {student.class_name}
                      </span>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-slate-500 dark:text-slate-400 hidden md:table-cell max-w-xs truncate" title={student.address}>
                      {student.address || "-"}
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-slate-600 dark:text-slate-300">
                      <div className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2">
                        <button onClick={() => handleAdjustLates(student.id, -1)} className="p-1 sm:p-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 transition-colors active:scale-95" title="Kurangi 1">
                          <MinusIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                        </button>
                        
                        {student.total_lates > 3 ? (
                          <div className="flex items-center px-2 py-1 sm:px-3 sm:py-1 rounded-full bg-red-100 border border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800/50 dark:text-red-400 animate-pulse">
                            <AlertTriangleIcon className="w-3 h-3 sm:mr-1 hidden sm:block" />
                            <span className="font-bold text-xs sm:text-sm">{student.total_lates}</span>
                          </div>
                        ) : student.total_lates > 0 ? (
                          <div className="flex items-center px-2 py-1 sm:px-3 sm:py-1 rounded-full bg-orange-100 border border-orange-200 text-orange-700 dark:bg-orange-900/30 dark:border-orange-800/50 dark:text-orange-400">
                            <span className="font-semibold text-xs sm:text-sm">{student.total_lates}</span>
                          </div>
                        ) : (
                          <div className="flex items-center px-2 py-1 sm:px-3 sm:py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800/30 dark:text-emerald-400">
                            <span className="font-medium text-xs sm:text-sm">0</span>
                          </div>
                        )}

                        <button onClick={() => handleAdjustLates(student.id, 1)} className="p-1 sm:p-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 transition-colors active:scale-95" title="Tambah 1">
                          <PlusIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-3 md:py-4 text-right whitespace-nowrap">
                      <Link 
                        href={`/dashboard/students/register-face?id=${student.id}&name=${encodeURIComponent(student.name)}`}
                        className="inline-flex items-center justify-center p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                        title="Daftar Wajah"
                      >
                        <CameraIcon className="h-4 w-4 md:h-5 md:w-5" />
                      </Link>
                      <button onClick={() => loadHistory(student)} className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ml-1" title="Lihat Histori Terlambat">
                        <ClockIcon className="h-4 w-4 md:h-5 md:w-5 inline" />
                      </button>
                      <button onClick={() => setEditStudent(student)} className="p-2 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors ml-1" title="Edit Siswa">
                        <EditIcon className="h-4 w-4 md:h-5 md:w-5 inline" />
                      </button>
                      <button onClick={() => handleDeleteStudent(student.id)} className="p-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ml-1" title="Hapus Siswa">
                        <TrashIcon className="h-4 w-4 md:h-5 md:w-5 inline" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Student Modal */}
      {editStudent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Edit Data Siswa</h3>
              <p className="text-slate-500 text-sm mb-6">Perbaiki nama, kelas, atau alamat siswa.</p>
              
              <form onSubmit={handleUpdateStudent} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Nama Lengkap</label>
                  <input type="text" value={editStudent.name} onChange={e => setEditStudent({...editStudent, name: e.target.value})} required
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Kelas</label>
                  <input type="text" value={editStudent.class_name} onChange={e => setEditStudent({...editStudent, class_name: e.target.value})} required
                    placeholder="Contoh: IX A"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  <p className="text-xs text-slate-500 mt-1">Gunakan angka/romawi lalu jenis kelas. (Bisa langsung ketik 9A)</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Alamat</label>
                  <textarea value={editStudent.address || ""} onChange={e => setEditStudent({...editStudent, address: e.target.value})} rows={2}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setEditStudent(null)} disabled={savingEdit} className="flex-1 px-4 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium transition-colors disabled:opacity-50">Batal</button>
                  <button type="submit" disabled={savingEdit} className="flex-1 px-4 py-2.5 text-white bg-primary hover:bg-primary/90 rounded-xl font-medium transition-colors disabled:opacity-50">
                    {savingEdit ? "Menyimpan..." : "Simpan"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Modal */}
      {bulkDeleteClass !== null && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                <TrashIcon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Hapus Data Per Kelas</h3>
              <p className="text-slate-500 text-sm mb-6">Fitur ini berguna untuk menghapus siswa yang sudah lulus (misal: seluruh kelas IX) sekaligus.</p>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Pilih Kelas yang Akan Dihapus</label>
                <select 
                  value={bulkDeleteClass} 
                  onChange={(e) => setBulkDeleteClass(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
                >
                  <option value="">-- Pilih Kelas --</option>
                  {uniqueClasses.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="bg-orange-50 border border-orange-200 text-orange-800 px-4 py-3 rounded-xl text-sm mb-6">
                <strong>Peringatan!</strong> Tindakan ini tidak bisa dibatalkan. Semua data siswa beserta data absensi di kelas tersebut akan terhapus.
              </div>
              
              <div className="flex gap-3">
                <button type="button" onClick={() => setBulkDeleteClass(null)} disabled={busyAction} className="flex-1 px-4 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium transition-colors disabled:opacity-50">Batal</button>
                <button type="button" onClick={handleBulkDelete} disabled={!bulkDeleteClass || busyAction} className="flex-1 px-4 py-2.5 text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-colors">{busyAction ? "Memproses..." : "Hapus Semua"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Lates Modal */}
      {resetLatesClass !== null && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                <RefreshCcwIcon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Reset Absen Keterlambatan Kelas</h3>
              <p className="text-slate-500 text-sm mb-6">Fitur ini berguna untuk mereset jumlah keterlambatan (menjadi 0) seluruh siswa dalam satu kelas.</p>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Pilih Kelas yang Akan Direset</label>
                <select 
                  value={resetLatesClass} 
                  onChange={(e) => setResetLatesClass(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  <option value="">-- Pilih Kelas --</option>
                  {uniqueClasses.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-xl text-sm mb-6">
                Nilai keterlambatan seluruh siswa di kelas terpilih akan menjadi 0.
              </div>
              
              <div className="flex gap-3">
                <button type="button" onClick={() => setResetLatesClass(null)} disabled={busyAction} className="flex-1 px-4 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium transition-colors disabled:opacity-50">Batal</button>
                <button type="button" onClick={handleResetClassLates} disabled={!resetLatesClass || busyAction} className="flex-1 px-4 py-2.5 text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-colors">{busyAction ? "Memproses..." : "Reset Kelas"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyStudent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/30">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Histori Keterlambatan</h3>
                <p className="text-slate-500 text-sm">Siswa: <strong>{historyStudent.name}</strong> ({historyStudent.class_name})</p>
              </div>
              <button onClick={() => setHistoryStudent(null)} className="text-slate-400 hover:text-slate-600 p-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-full transition-colors">
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              {loadingHistory ? (
                <div className="text-center py-8 text-slate-500 flex flex-col items-center">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
                  Memuat data histori...
                </div>
              ) : historyData && historyData.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ClockIcon className="w-8 h-8" />
                  </div>
                  Siswa ini belum pernah terlambat. Bersih!
                </div>
              ) : (
                <div className="space-y-4">
                  {historyData?.map(history => (
                    <div key={history.id} className="flex items-start gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700">
                      <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 mt-0.5 shadow-sm border border-orange-200">
                        <AlertTriangleIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200 text-base">
                          {new Date(history.late_time).toLocaleDateString("id-ID", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                        <p className="text-sm text-primary font-bold mt-0.5">
                          Pukul {new Date(history.late_time).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-xs text-slate-500 mt-2 border-t border-slate-200 dark:border-slate-700 pt-2">
                          <span className="font-medium">Catatan:</span> {history.notes || "Otomatis via Face Recognition"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Download PDF Modal */}
      {downloadClass !== null && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                <DownloadIcon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Download Data Siswa (PDF)</h3>
              <p className="text-slate-500 text-sm mb-6">Pilih kelas untuk mengunduh data siswa dalam format PDF.</p>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Pilih Kelas</label>
                <select 
                  value={downloadClass} 
                  onChange={(e) => setDownloadClass(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <option value="">-- Pilih Kelas --</option>
                  {uniqueClasses.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex gap-3">
                <button type="button" onClick={() => setDownloadClass(null)} className="flex-1 px-4 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium transition-colors">Batal</button>
                <button type="button" onClick={handleDownloadPDF} disabled={!downloadClass || downloading} className="flex-1 px-4 py-2.5 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
                  {downloading ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Mengunduh...</>
                  ) : (
                    <><DownloadIcon className="w-4 h-4" /> Download PDF</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

