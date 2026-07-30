"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchApi } from "@/lib/api";
import { getFaceDescriptor, loadFaceModels, NoFaceDetectedError } from "@/lib/face";
import { CameraIcon, CheckCircle2Icon, Loader2, RefreshCcwIcon } from "lucide-react";

function RegisterFaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get("id");
  const studentName = searchParams.get("name") || "Student";

  const videoRef = useRef<HTMLVideoElement>(null);
  // Hard guards so rapid taps can never fire twice
  const busyRef = useRef(false);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [loading, setLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [status, setStatus] = useState<"idle" | "capturing" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  const ANGLES = ["Depan", "Kiri", "Kanan", "Atas", "Bawah"];
  const [descriptors, setDescriptors] = useState<number[][]>([]);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const ms = videoRef.current.srcObject as MediaStream;
      ms.getTracks().forEach(track => track.stop());
    }
    setStream(prev => {
      prev?.getTracks().forEach(track => track.stop());
      return null;
    });
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStream(mediaStream);
      setStatus("idle");
      setMessage("");
    } catch {
      setStatus("error");
      setMessage("Tidak bisa mengakses kamera. Izinkan akses kamera di browser.");
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    startCamera();
    loadFaceModels()
      .then(() => setModelsLoaded(true))
      .catch((e) => {
        setStatus("error");
        setMessage(e.message);
      });
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  };

  // Capture one frame, validate a face is present, keep its descriptor locally.
  // All 5 descriptors are sent to the backend only after the full set is complete.
  const captureAngle = async () => {
    if (!videoRef.current || !studentId || busyRef.current) return;
    busyRef.current = true;
    setStatus("capturing");
    setMessage(`Memeriksa posisi ${ANGLES[descriptors.length]}...`);
    setLoading(true);

    try {
      const canvas = document.createElement("canvas");
      const maxDim = 640;
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

      const descriptor = await getFaceDescriptor(canvas, "accurate");
      const newDescriptors = [...descriptors, descriptor];
      setDescriptors(newDescriptors);

      if (newDescriptors.length >= ANGLES.length) {
        // Full set captured — submit sequentially (first request clears old data)
        setMessage("Menyimpan wajah ke server...");
        for (let i = 0; i < newDescriptors.length; i++) {
          await fetchApi<{ message: string }>("/faces/register", {
            method: "POST",
            body: JSON.stringify({
              student_id: studentId,
              embedding: newDescriptors[i],
              clear_existing: i === 0,
            }),
          });
        }
        setStatus("success");
        setMessage("Semua sisi wajah berhasil didaftarkan!");
        stopCamera();
        setTimeout(() => router.push("/dashboard/students"), 2000);
      } else {
        setStatus("idle");
        setMessage("");
      }
    } catch (err: any) {
      setStatus("error");
      if (err instanceof NoFaceDetectedError) {
        setMessage(`Wajah tidak terdeteksi pada posisi ${ANGLES[descriptors.length]}. Coba lagi.`);
      } else {
        setMessage(err.message || "Gagal menyimpan wajah.");
      }
    } finally {
      setLoading(false);
      busyRef.current = false;
    }
  };

  const retry = () => {
    setDescriptors([]);
    setStatus("idle");
    setMessage("");
    busyRef.current = false;
    startCamera();
  };

  if (!studentId) {
    return <div className="p-8 text-center text-red-500">Error: No student selected. Go back to student list.</div>;
  }

  const currentAngleIndex = descriptors.length;

  return (
    <div className="max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-500">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Daftar Wajah Siswa</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Mendaftarkan wajah <span className="font-semibold text-primary">{studentName}</span></p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl overflow-hidden p-6 text-center relative">

        {status === "success" ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <div className="h-24 w-24 bg-green-100 dark:bg-green-900/30 text-green-600 rounded-full flex items-center justify-center mb-6 animate-bounce">
              <CheckCircle2Icon className="h-12 w-12" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Pendaftaran Selesai</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-2">{message}</p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <h4 className="text-lg font-bold text-slate-800">
                Tahap {currentAngleIndex + 1} dari {ANGLES.length}
              </h4>
              <p className="text-primary font-medium text-lg mt-1 bg-primary/10 py-2 px-4 rounded-xl inline-block">
                Hadap <span className="font-bold uppercase underline">{ANGLES[currentAngleIndex]}</span>
              </p>
            </div>

            {/* Progress dots */}
            <div className="flex items-center justify-center gap-2 mb-4">
              {ANGLES.map((a, idx) => (
                <div key={a} className={`w-2.5 h-2.5 rounded-full transition-colors ${idx < descriptors.length ? "bg-emerald-500" : idx === currentAngleIndex ? "bg-indigo-500" : "bg-slate-200"}`} title={a} />
              ))}
            </div>

            <div className="relative aspect-video bg-slate-100 dark:bg-slate-950 rounded-2xl overflow-hidden mb-4 flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-800">
              {stream ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400">
                  <CameraIcon className="h-12 w-12 mb-4 opacity-50" />
                  <p>Kamera tidak aktif</p>
                </div>
              )}

              {status === "capturing" && (
                <div className="absolute inset-0 bg-indigo-900/40 flex items-center justify-center p-6 text-white text-sm">
                  <div className="text-center">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto mb-2" />
                    {message}
                  </div>
                </div>
              )}
            </div>

            {status === "error" && message && (
              <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">
                {message}
              </div>
            )}

            {stream && (
              <div className="flex justify-end mb-6">
                <button onClick={toggleCamera} className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors">
                  <RefreshCcwIcon className="w-4 h-4" /> Tukar Kamera
                </button>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {!stream ? (
                <button
                  onClick={startCamera}
                  className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 rounded-xl font-medium transition-colors w-full sm:w-auto flex items-center justify-center"
                >
                  <CameraIcon className="w-5 h-5 mr-2" />
                  Nyalakan Kamera
                </button>
              ) : (
                <>
                  <button
                    onClick={retry}
                    disabled={loading}
                    className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-xl font-medium transition-colors w-full sm:w-auto disabled:opacity-50"
                  >
                    Ulangi dari Awal
                  </button>
                  <button
                    onClick={captureAngle}
                    disabled={loading || !modelsLoaded}
                    className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium shadow-lg transition-all active:scale-95 w-full sm:w-auto flex items-center justify-center disabled:opacity-70"
                  >
                    {loading ? (
                      <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Menyimpan...</>
                    ) : !modelsLoaded ? (
                      <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Memuat Model AI...</>
                    ) : (
                      <><CameraIcon className="w-5 h-5 mr-2" /> Jepret Hadap {ANGLES[currentAngleIndex]}</>
                    )}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function RegisterFacePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    }>
      <RegisterFaceContent />
    </Suspense>
  );
}
