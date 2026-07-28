"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import { CameraIcon, ArrowLeftIcon, UserPlusIcon, Loader2, CheckCircle2Icon, RefreshCcwIcon } from "lucide-react";

export default function RegisterStudentPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [capturedBlobs, setCapturedBlobs] = useState<Blob[]>([]);
  const [step, setStep] = useState<"camera" | "form" | "success">("camera");
  const ANGLES = ["Depan", "Kiri", "Kanan", "Atas", "Bawah"];
  const [currentAngleIndex, setCurrentAngleIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [classes, setClasses] = useState<any[]>([]);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  // Form fields
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [facingMode]);

  const startCamera = async () => {
    stopCamera(); // Make sure to stop current before starting new
    try {
      const ms = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
      if (videoRef.current) videoRef.current.srcObject = ms;
      setStream(ms);
    } catch {
      setError("Tidak bisa mengakses kamera. Izinkan akses kamera di browser.");
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const ms = videoRef.current.srcObject as MediaStream;
      ms.getTracks().forEach(t => t.stop());
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
      const canvas = document.createElement("canvas");
      // Optimize image size to speed up processing
      const maxDim = 320;
      let width = videoRef.current.videoWidth;
      let height = videoRef.current.videoHeight;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(videoRef.current, 0, 0, width, height);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      
      const blob = await new Promise<Blob>((res, rej) => {
        canvas.toBlob((b) => b ? res(b) : rej(), "image/jpeg", 0.7);
      });

      setCapturedImages(prev => [...prev, dataUrl]);
      setCapturedBlobs(prev => [...prev, blob]);

      if (currentAngleIndex < ANGLES.length - 1) {
        setCurrentAngleIndex(prev => prev + 1);
      } else {
        stopCamera();
        setStep("form");
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (capturedBlobs.length < 5) return;
    setLoading(true);
    setError("");

    try {
      // 1. Create student
      const student = await fetchApi<any>("/students", {
        method: "POST",
        body: JSON.stringify({ name, class_name: className, address }),
      });

      // 2. Register all 5 faces
      for (const blob of capturedBlobs) {
        const fd = new FormData();
        fd.append("student_id", student.id);
        fd.append("file", blob, "face.jpg");

        await fetchApi("/faces/register", {
          method: "POST",
          body: fd,
          headers: { Accept: "application/json" },
        });
      }

      setStep("success");
    } catch (err: any) {
      setError(err.message || "Gagal menyimpan data siswa.");
    } finally {
      setLoading(false);
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
          <h2 className="text-xl font-bold text-slate-800">Daftarkan Siswa Baru</h2>
          <p className="text-slate-500 text-xs mt-0.5">Scan wajah → Isi data siswa</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-6">
        {["Scan Wajah", "Data Siswa", "Selesai"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              (step === "camera" && i === 0) || (step === "form" && i === 1) || (step === "success" && i === 2)
                ? "bg-[#4f46e5] text-white"
                : i < (step === "form" ? 1 : step === "success" ? 2 : 0)
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-200 text-slate-500"
            }`}>{i + 1}</div>
            <span className="text-xs text-slate-500 hidden sm:block">{s}</span>
            {i < 2 && <div className="h-px w-6 bg-slate-200" />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* STEP 1: Camera */}
        {step === "camera" && (
          <div className="p-6">
            <div className="mb-4 text-center">
              <h4 className="text-lg font-bold text-slate-800">
                Tahap {currentAngleIndex + 1} dari {ANGLES.length}
              </h4>
              <p className="text-indigo-600 font-medium text-base mt-1 bg-indigo-50 py-1.5 px-4 rounded-xl inline-block">
                Hadap <span className="font-bold uppercase underline">{ANGLES[currentAngleIndex]}</span>
              </p>
            </div>

            <div className="relative aspect-video bg-slate-100 rounded-xl overflow-hidden mb-5 flex items-center justify-center border-2 border-dashed border-slate-300">
              <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`} />
              {!stream && (
                <div className="absolute inset-0 bg-slate-100 text-slate-400 flex flex-col items-center justify-center">
                  <CameraIcon className="w-10 h-10 mb-2 opacity-50" />
                  <p className="text-sm">{error || "Memuat kamera..."}</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500">Pastikan wajah berada di tengah kamera.</p>
              <button onClick={toggleCamera} className="flex items-center gap-2 text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors">
                <RefreshCcwIcon className="w-4 h-4" /> Tukar
              </button>
            </div>
            <button onClick={capturePhoto} disabled={!stream}
              className="w-full py-3 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-semibold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
              <CameraIcon className="w-5 h-5" /> Jepret Hadap {ANGLES[currentAngleIndex]}
            </button>
          </div>
        )}

        {/* STEP 2: Form */}
        {step === "form" && (
          <div className="p-6">
            {capturedImages.length > 0 && (
              <div className="mb-6 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-indigo-800">{capturedImages.length} Foto berhasil diambil</p>
                  <button onClick={() => { setStep("camera"); setCapturedImages([]); setCapturedBlobs([]); setCurrentAngleIndex(0); startCamera(); }}
                    className="text-xs text-indigo-600 underline font-medium">Ulangi Kamera</button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {capturedImages.map((img, idx) => (
                    <div key={idx} className="relative shrink-0">
                      <img src={img} alt={`Wajah ${idx}`} className="w-14 h-14 rounded-lg object-cover scale-x-[-1] border-2 border-white shadow-sm" />
                      <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md leading-none">
                        {ANGLES[idx]}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nama Lengkap</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required
                  placeholder="Nama sesuai data sekolah"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Kelas</label>
                <input type="text" value={className} onChange={e => setClassName(e.target.value)} required
                  placeholder="Contoh: IX A"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Alamat <span className="text-slate-400 font-normal">(opsional)</span></label>
                <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2}
                  placeholder="Alamat rumah siswa"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all resize-none" />
              </div>
              <button type="submit" disabled={loading || !className}
                className="w-full py-3 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-semibold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><UserPlusIcon className="w-5 h-5" /> Simpan & Daftarkan</>}
              </button>
            </form>
          </div>
        )}

        {/* STEP 3: Success */}
        {step === "success" && (
          <div className="p-10 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-5">
              <CheckCircle2Icon className="w-10 h-10 text-emerald-500" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Siswa Berhasil Terdaftar!</h3>
            <p className="text-slate-500 text-sm mb-6">Data dan wajah siswa <strong>{name}</strong> telah tersimpan.</p>
            <div className="flex gap-3 w-full">
              <button onClick={() => { setStep("camera"); setCapturedImages([]); setCapturedBlobs([]); setCurrentAngleIndex(0); setName(""); setClassName(""); setAddress(""); setError(""); startCamera(); }}
                className="flex-1 py-2.5 border border-indigo-300 text-indigo-600 font-medium rounded-xl hover:bg-indigo-50 transition-all text-sm">
                Daftar Siswa Lain
              </button>
              <button onClick={() => router.push("/dashboard")}
                className="flex-1 py-2.5 bg-[#4f46e5] text-white font-medium rounded-xl hover:bg-[#4338ca] transition-all text-sm">
                Kembali ke Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
