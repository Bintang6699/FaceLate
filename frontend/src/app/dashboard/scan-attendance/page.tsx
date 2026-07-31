"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import { getFaceDescriptor, loadFaceModels, NoFaceDetectedError, captureVideoFrame } from "@/lib/face";
import { CameraIcon, ArrowLeftIcon, ScanFaceIcon, CheckCircle2Icon, XCircleIcon, Loader2, ClockIcon, RefreshCcwIcon } from "lucide-react";

type RecognizeResult = {
  student_id: string;
  student_name: string;
  class_name: string;
  similarity: number;
  late_time: string;
  message: string;
};

export default function ScanAttendancePage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  // Hard guards so rapid taps / overlapping intervals can never fire twice
  const scanningRef = useRef(false);
  const recordingRef = useRef(false);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [error, setError] = useState("");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [autoScan, setAutoScan] = useState(true);

  // Result popup state
  const [result, setResult] = useState<RecognizeResult | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [popupType, setPopupType] = useState<"success" | "error">("success");
  const [errorTitle, setErrorTitle] = useState("Wajah Tidak atau Belum Terdaftar");
  const [recording, setRecording] = useState(false);
  const [clientTime, setClientTime] = useState<Date>(new Date());

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const ms = videoRef.current.srcObject as MediaStream;
      ms.getTracks().forEach(t => t.stop());
    }
    setStream(prev => {
      prev?.getTracks().forEach(t => t.stop());
      return null;
    });
  }, []);

  useEffect(() => {
    startCamera();
    // Preload AI models in the background
    loadFaceModels()
      .then(() => setModelsLoaded(true))
      .catch((e) => setError(e.message));
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  const startCamera = async () => {
    stopCamera();
    try {
      const ms = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
      if (videoRef.current) videoRef.current.srcObject = ms;
      setStream(ms);
      setError("");
    } catch {
      setError("Tidak bisa mengakses kamera. Izinkan akses di browser.");
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  };

  const doScan = useCallback(async () => {
    if (!videoRef.current || scanningRef.current || !modelsLoaded) return;
    scanningRef.current = true;
    setScanning(true);
    setShowPopup(false);
    setError("");

    // Yield to the browser to paint the UI (spinner) before blocking thread with face-api
    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      // Capture at 640px for better quality — "accurate" mode handles tilted
      // faces via dual-detector + descriptor-only fallback (no landmark dependency).
      const frameCanvas = captureVideoFrame(videoRef.current, 640);

      // Use "accurate" mode so side-profile scans use the same robust pipeline
      // as enrollment (SSD → Tiny fallback → direct descriptor crop).
      const descriptor = await getFaceDescriptor(frameCanvas, "accurate");

      const data = await fetchApi<RecognizeResult>("/attendance/recognize", {
        method: "POST",
        body: JSON.stringify({ embedding: descriptor }),
      });

      setResult(data);
      setClientTime(new Date()); // capture client time right after successful recognition
      setPopupType("success");
      setShowPopup(true);
    } catch (err: any) {
      // No face in frame — stay silent and keep scanning
      if (err instanceof NoFaceDetectedError) {
        return;
      }

      const msg = err.message || "Wajah tidak dikenali.";

      // In auto-scan mode, transient network errors stay silent so the
      // loop doesn't spam popups; real "not recognized" answers are shown.
      if (autoScan && (msg === "Failed to fetch" || msg.includes("NetworkError"))) {
        return;
      }

      setResult(null);
      setErrorTitle("Wajah Tidak atau Belum Terdaftar");
      setError(msg);
      setPopupType("error");
      setShowPopup(true);
    } finally {
      scanningRef.current = false;
      setScanning(false);
    }
  }, [autoScan, modelsLoaded]);

  // Auto-scan loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoScan && stream && modelsLoaded && !showPopup && !scanning) {
      interval = setInterval(() => {
        doScan();
      }, 1500); // Trigger every 1.5s
    }
    return () => clearInterval(interval);
  }, [autoScan, stream, modelsLoaded, showPopup, scanning, doScan]);

  const recordAttendance = async () => {
    // One tap only — blocks double submissions that would duplicate records
    if (!result || recordingRef.current) return;
    recordingRef.current = true;
    setRecording(true);
    try {
      await fetchApi("/attendance/record", {
        method: "POST",
        body: JSON.stringify({
          student_id: result.student_id,
          client_time: clientTime.toISOString(),
          similarity: result.similarity
        })
      });
      setShowPopup(false);
      setResult(null);
      // Automatically resume scan if autoScan is on, handled by useEffect
    } catch (err: any) {
      // e.g. 409 duplicate guard from the backend — show it in the popup
      // instead of alert() so the user understands why nothing was saved.
      setResult(null);
      setErrorTitle("Gagal Mencatat Absensi");
      setError(err.message || "Gagal mencatat absensi.");
      setPopupType("error");
      setShowPopup(true);
    } finally {
      recordingRef.current = false;
      setRecording(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Scan Absensi Terlambat</h2>
          <p className="text-slate-500 text-xs mt-0.5">Untuk siswa yang sudah terdaftar sebelumnya</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-6">

        {/* Camera View */}
        <div className="relative aspect-video bg-slate-100 rounded-xl overflow-hidden mb-5 flex items-center justify-center">
          <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""} ${!stream ? 'hidden' : ''}`} />
          {!stream && (
            <div className="text-slate-400 flex flex-col items-center">
              <CameraIcon className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm">{error || "Memuat kamera..."}</p>
            </div>
          )}

          {/* Scanning overlay */}
          {scanning && (
            <div className="absolute inset-0 bg-emerald-900/40 flex items-center justify-center">
              <div className="text-center text-white">
                <Loader2 className="w-10 h-10 animate-spin mx-auto mb-2" />
                <p className="text-sm font-medium">Menganalisa wajah...</p>
              </div>
            </div>
          )}

          {/* Scan frame guide */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-48 h-48 border-2 border-dashed border-white/50 rounded-3xl" />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between mb-5 gap-3">
          <p className="text-sm text-slate-500">
            {!modelsLoaded
              ? "Memuat model AI, mohon tunggu..."
              : autoScan
                ? "Arahkan wajah siswa ke kamera (Otomatis Scan)..."
                : "Arahkan wajah siswa ke kamera, pastikan terang."}
          </p>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => setAutoScan(!autoScan)}
              className={`flex-1 sm:flex-none items-center justify-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${autoScan ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              <ScanFaceIcon className="w-4 h-4 inline" /> {autoScan ? "Auto-Scan Aktif" : "Auto-Scan Mati"}
            </button>
            <button onClick={toggleCamera} className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors">
              <RefreshCcwIcon className="w-4 h-4" /> Tukar
            </button>
          </div>
        </div>

        {!autoScan && (
          <button onClick={doScan} disabled={scanning || !stream || !modelsLoaded}
            className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-emerald-100">
            {scanning
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Memproses...</>
              : <><ScanFaceIcon className="w-5 h-5" /> Scan Wajah Sekarang</>
            }
          </button>
        )}
      </div>

      {/* ===== POPUP RESULT ===== */}
      {showPopup && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full animate-in zoom-in-90 duration-300">
            {popupType === "success" && result ? (
              <>
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
                  <CheckCircle2Icon className="w-8 h-8 text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 text-center mb-1">Wajah Dikenali!</h3>
                <p className="text-center text-emerald-600 text-sm font-medium mb-5">Konfirmasi kehadiran?</p>

                {/* Student Info Card */}
                <div className="bg-slate-50 rounded-2xl p-5 space-y-3 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">Nama</span>
                    <span className="text-sm font-semibold text-slate-800">{result.student_name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">Kelas</span>
                    <span className="text-sm font-semibold text-slate-800">{result.class_name}</span>
                  </div>

                  {/* Confidence bar */}
                  <div className="pt-1">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs text-slate-500">Kemiripan Wajah</span>
                      <span className={`text-sm font-bold ${
                        result.similarity >= 0.75 ? 'text-emerald-600'
                        : result.similarity >= 0.60 ? 'text-amber-500'
                        : 'text-red-500'
                      }`}>{(result.similarity * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          result.similarity >= 0.75 ? 'bg-emerald-500'
                          : result.similarity >= 0.60 ? 'bg-amber-400'
                          : 'bg-red-400'
                        }`}
                        style={{ width: `${Math.min(100, result.similarity * 100).toFixed(1)}%` }}
                      />
                    </div>
                    <p className={`text-[10px] mt-1 font-medium ${
                      result.similarity >= 0.75 ? 'text-emerald-600'
                      : result.similarity >= 0.60 ? 'text-amber-500'
                      : 'text-red-500'
                    }`}>
                      {result.similarity >= 0.75 ? '✓ Kepercayaan tinggi'
                        : result.similarity >= 0.60 ? '⚠ Kepercayaan sedang — periksa kembali wajah siswa'
                        : '✗ Kepercayaan rendah — konfirmasi secara manual'}
                    </p>
                  </div>

                  <div className="flex justify-between items-center border-t border-slate-200 pt-2">
                    <span className="text-xs text-slate-500 flex items-center gap-1"><ClockIcon className="w-3 h-3" />Waktu (WITA)</span>
                    <span className="text-sm font-semibold text-slate-800">
                      {clientTime.toLocaleTimeString("id-ID", { timeZone: "Asia/Makassar", hour: '2-digit', minute: '2-digit', second: '2-digit' })} WITA
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setShowPopup(false)} disabled={recording}
                    className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all text-sm font-medium disabled:opacity-50">
                    Batal
                  </button>
                  <button onClick={recordAttendance} disabled={recording}
                    className="flex-1 py-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                    {recording && <Loader2 className="w-4 h-4 animate-spin" />}
                    Accept
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
                  <XCircleIcon className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 text-center mb-2">{errorTitle}</h3>
                <p className="text-center text-slate-500 text-sm mb-6">{error || "Pastikan siswa sudah terdaftar, atau coba ulangi scan dengan pencahayaan yang lebih baik."}</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowPopup(false)}
                    className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all text-sm font-medium">
                    Tutup
                  </button>
                  <button onClick={() => router.push('/dashboard/register-student')}
                    className="flex-1 py-2.5 bg-[#4f46e5] text-white rounded-xl hover:bg-[#4338ca] transition-all text-sm font-medium">
                    Daftar Siswa
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
