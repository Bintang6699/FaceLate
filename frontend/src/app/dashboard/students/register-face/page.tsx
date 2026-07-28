"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchApi } from "@/lib/api";
import { CameraIcon, UploadCloudIcon, CheckCircle2Icon, Loader2, RefreshCcwIcon } from "lucide-react";

export default function RegisterFacePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get("id");
  const studentName = searchParams.get("name") || "Student";
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "capturing" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  
  const ANGLES = ["Depan", "Kiri", "Kanan", "Atas", "Bawah"];
  const [currentAngleIndex, setCurrentAngleIndex] = useState(0);

  const startCamera = async () => {
    stopCamera();
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStream(mediaStream);
    } catch (error) {
      setStatus("error");
      setMessage("Failed to access camera. Please allow permissions.");
    }
  };

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const ms = videoRef.current.srcObject as MediaStream;
      ms.getTracks().forEach(track => track.stop());
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    return () => {
      // Direct cleanup to avoid stale closures
      if (videoRef.current?.srcObject) {
        const ms = videoRef.current.srcObject as MediaStream;
        ms.getTracks().forEach(track => track.stop());
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === "user" ? "environment" : "user");
    // We don't automatically restart here because startCamera is usually triggered by a button in this UI,
    // but we can if we want. Actually, let's just let the user click "Start Camera" again, or restart if stream exists.
    if (stream) {
      setTimeout(() => startCamera(), 100);
    }
  };

  const captureAndRegister = async () => {
    if (!videoRef.current || !studentId) return;

    setStatus("capturing");
    setMessage(`Menyimpan posisi ${ANGLES[currentAngleIndex]}...`);
    setLoading(true);

    try {
      // Create canvas to draw the video frame
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
      const ctx = canvas.getContext("2d");
      
      if (!ctx) throw new Error("Canvas context failed");
      
      ctx.drawImage(videoRef.current, 0, 0, width, height);
      
      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error("Failed to create blob"));
        }, "image/jpeg", 0.7);
      });

      // Prepare form data
      const formData = new FormData();
      formData.append("student_id", studentId);
      formData.append("clear_existing", currentAngleIndex === 0 ? "true" : "false");
      formData.append("file", blob, "face.jpg");

      setMessage("Sending to AI Model...");

      // Send to API
      const res = await fetchApi<{ message: string }>("/faces/register", {
        method: "POST",
        body: formData,
        // Don't set Content-Type header when sending FormData, fetch will do it with the boundary
        headers: { "Accept": "application/json" }
      });

      if (currentAngleIndex < ANGLES.length - 1) {
        setCurrentAngleIndex(prev => prev + 1);
        setStatus("idle");
        setMessage("");
        setLoading(false);
      } else {
        setStatus("success");
        setMessage(res.message || "Semua sisi wajah berhasil didaftarkan!");
        stopCamera();
        
        // Redirect after 2s
        setTimeout(() => {
          router.push("/dashboard/students");
        }, 2000);
      }

    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "Gagal menyimpan wajah.");
      setLoading(false);
    }
  };

  if (!studentId) {
    return <div className="p-8 text-center text-red-500">Error: No student selected. Go back to student list.</div>;
  }

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
                  <p>Camera is offline</p>
                </div>
              )}

              {/* Status Overlay */}
              {status === "error" && (
                <div className="absolute inset-0 bg-red-900/80 flex items-center justify-center p-6 text-white text-sm">
                  {message}
                </div>
              )}
            </div>

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
                  Start Camera
                </button>
              ) : (
                <>
                  <button 
                    onClick={stopCamera}
                    disabled={loading}
                    className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-xl font-medium transition-colors w-full sm:w-auto"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={captureAndRegister}
                    disabled={loading}
                    className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium shadow-lg transition-all active:scale-95 w-full sm:w-auto flex items-center justify-center disabled:opacity-70"
                  >
                    {loading ? (
                      <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Menyimpan...</>
                    ) : (
                      <><CameraIcon className="w-5 h-5 mr-2" /> Jepret Hadap {ANGLES[currentAngleIndex]}</>
                    )}
                  </button>
                </>
              )}
            </div>
            {message && status === "capturing" && (
              <p className="mt-4 text-sm text-primary animate-pulse">{message}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
