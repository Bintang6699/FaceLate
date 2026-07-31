"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchApi } from "@/lib/api";
import { getFaceDescriptor, loadFaceModels, NoFaceDetectedError, captureVideoFrame, getFaceApi, isFacePresent } from "@/lib/face";
import { CameraIcon, ArrowLeftIcon, UserPlusIcon, Loader2, CheckCircle2Icon, RefreshCcwIcon, CheckIcon } from "lucide-react";

type CapturedFace = {
  dataUrl: string;
  descriptor: number[];
};

export default function RegisterStudentPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  // Hard guard against double submissions (state updates are async,
  // so rapid taps could otherwise slip through before `disabled` renders)
  const submittingRef = useRef(false);
  const capturingRef = useRef(false);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captures, setCaptures] = useState<CapturedFace[]>([]);
  const [step, setStep] = useState<"camera" | "form" | "success">("camera");
  const ANGLES = ["Depan", "Kiri", "Kanan", "Atas", "Bawah"];
  const [capturing, setCapturing] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [faceReady, setFaceReady] = useState(false);
  const [guidanceText, setGuidanceText] = useState("Posisikan wajah Anda di dalam bingkai");

  // Per-angle instructions shown to user
  const ANGLE_INSTRUCTIONS: Record<string, string> = {
    "Depan"  : "Hadapkan wajah lurus ke kamera",
    "Kiri"   : "Putar kepala ke KIRI perlahan",
    "Kanan"  : "Putar kepala ke KANAN perlahan",
    "Atas"   : "Tengadahkan kepala sedikit ke ATAS",
    "Bawah"  : "Tundukkan kepala sedikit ke BAWAH",
  };

  // Form fields
  const [name, setName] = useState("");
  const [className, setClassName] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    startCamera();
    // Preload AI models in the background while the user positions the camera
    loadFaceModels()
      .then(() => setModelsLoaded(true))
      .catch((e) => setError(e.message));
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  const startCamera = async () => {
    stopCamera(); // Make sure to stop current before starting new
    try {
      const ms = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
      if (videoRef.current) videoRef.current.srcObject = ms;
      setStream(ms);
      setError("");
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

  const currentAngleIndex = captures.length;

  useEffect(() => {
    let animationFrameId: number;
    let stableFrames = 0;
    // Frontal: require 12 stable frames (~1.2s). Side/Up/Down: only 8 (~0.8s)
    // because the bounding box naturally shifts and jitters more on angled poses.
    const isFrontal = ANGLES[currentAngleIndex] === "Depan";
    const requiredStableFrames = isFrontal ? 12 : 8;
    let running = true;

    const detectLoop = async () => {
      if (!running) return;

      if (!videoRef.current || !modelsLoaded || step !== "camera" || capturingRef.current || submittingRef.current) {
        animationFrameId = requestAnimationFrame(detectLoop);
        return;
      }

      const video = videoRef.current;
      if (video.readyState < 2) {
        animationFrameId = requestAnimationFrame(detectLoop);
        return;
      }

      try {
        // Use lightweight isFacePresent instead of full pipeline — much faster,
        // and critically: NOT blocked by the frontal-only landmark model.
        const faceApi = await getFaceApi();
        const opts = new faceApi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.1 });
        const detected = await faceApi.detectSingleFace(video, opts);

        if (detected) {
          const box = detected.box;
          const vW = video.videoWidth;
          const vH = video.videoHeight;

          const faceRatio = (box.width * box.height) / (vW * vH);
          const centerX   = box.x + box.width  / 2;
          const centerY   = box.y + box.height / 2;

          // For frontal: require face to be roughly centered.
          // For side/up/down angles: only check size (face will naturally be off-center).
          const sizeOk = faceRatio >= 0.04 && faceRatio <= 0.55;
          const posOk  = isFrontal
            ? Math.abs(centerX - vW / 2) < vW * 0.25 && Math.abs(centerY - vH / 2) < vH * 0.3
            : true; // side/up/down — don't enforce centering

          if (!sizeOk && faceRatio < 0.04) {
            setGuidanceText("Terlalu jauh — dekatkan wajah ke kamera");
            setFaceReady(false);
            stableFrames = 0;
          } else if (!sizeOk && faceRatio > 0.55) {
            setGuidanceText("Terlalu dekat — mundurkan wajah sedikit");
            setFaceReady(false);
            stableFrames = 0;
          } else if (!posOk) {
            setGuidanceText("Wajah kurang di tengah — geser ke tengah frame");
            setFaceReady(false);
            stableFrames = 0;
          } else {
            // Face is in a good position!
            stableFrames++;
            if (stableFrames < requiredStableFrames) {
              setGuidanceText(`✓ Posisi pas! Tahan... (${stableFrames}/${requiredStableFrames})`);
              setFaceReady(true);
            } else {
              setGuidanceText("📸 Auto-jepret!");
              setFaceReady(true);
            }

            if (stableFrames >= requiredStableFrames && !capturingRef.current) {
              stableFrames = 0;
              capturePhoto();
              return; // pause loop — capturePhoto will reset capturingRef
            }
          }
        } else {
          // No face detected — show the angle-specific instruction
          setGuidanceText(ANGLE_INSTRUCTIONS[ANGLES[currentAngleIndex]] ?? "Posisikan wajah di dalam bingkai");
          setFaceReady(false);
          stableFrames = 0;
        }
      } catch (_) {
        // ignore transient errors in the preview loop
      }

      // ~10 fps is plenty for the preview — avoids blocking the main thread
      setTimeout(() => {
        if (running) animationFrameId = requestAnimationFrame(detectLoop);
      }, 100);
    };

    if (step === "camera" && modelsLoaded && stream) {
      detectLoop();
    }

    return () => {
      running = false;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [step, modelsLoaded, stream, currentAngleIndex]);

  const capturePhoto = async () => {
    if (!videoRef.current || capturingRef.current) return;
    capturingRef.current = true;
    setCapturing(true);
    setError("");

    // Yield to the browser to paint the UI (spinner) before blocking thread with face-api
    await new Promise((resolve) => setTimeout(resolve, 100));

    try {
      // Use the helper to safely grab a canvas frame, ensuring videoWidth is handled
      const canvas = captureVideoFrame(videoRef.current, 640);
      
      // Extract the face descriptor immediately — if no face is visible the
      // user finds out NOW (and stays on the same angle), not after submitting.
      const descriptor = await getFaceDescriptor(canvas, "accurate");
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);

      const newCaptures = [...captures, { dataUrl, descriptor }];
      setCaptures(newCaptures);

      if (newCaptures.length >= ANGLES.length) {
        stopCamera();
        setStep("form");
      }
    } catch (err: any) {
      if (err instanceof NoFaceDetectedError) {
        setError(`Wajah tidak terdeteksi pada posisi ${ANGLES[captures.length]}. Coba lagi dengan pencahayaan lebih baik.`);
      } else {
        setError(err.message || "Gagal memproses wajah. Coba lagi.");
      }
    } finally {
      capturingRef.current = false;
      setCapturing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // One submission only — blocks double-taps and retried clicks
    if (submittingRef.current) return;
    if (captures.length < ANGLES.length) {
      setError("Foto wajah belum lengkap. Ulangi pengambilan foto.");
      return;
    }
    submittingRef.current = true;
    setLoading(true);
    setError("");

    try {
      // Single atomic request: student + all face embeddings in one transaction.
      // If anything fails, nothing is saved (no more orphan students).
      await fetchApi<any>("/students/register-with-faces", {
        method: "POST",
        body: JSON.stringify({
          name,
          class_name: className,
          address,
          embeddings: captures.map(c => c.descriptor),
        }),
      });

      setStep("success");
    } catch (err: any) {
      setError(err.message || "Gagal menyimpan data siswa.");
      submittingRef.current = false; // allow retry after an error
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setStep("camera");
    setCaptures([]);
    setName("");
    setClassName("");
    setAddress("");
    setError("");
    submittingRef.current = false;
    startCamera();
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
              {/* Angle badge */}
              <p className="text-indigo-600 font-medium text-base mt-1 bg-indigo-50 py-1.5 px-4 rounded-xl inline-block">
                Hadap <span className="font-bold uppercase underline">{ANGLES[currentAngleIndex]}</span>
              </p>
              {/* Angle-specific instruction below the badge */}
              <p className="text-slate-600 text-sm mt-2 font-medium">
                {ANGLE_INSTRUCTIONS[ANGLES[currentAngleIndex]]}
              </p>
            </div>

            <div className="relative bg-slate-100 rounded-xl overflow-hidden mb-5 flex items-center justify-center border-2 border-slate-300" style={{aspectRatio: '4/3'}}>
              <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`} />
              
              {!stream && (
                <div className="absolute inset-0 bg-slate-100 text-slate-400 flex flex-col items-center justify-center">
                  <CameraIcon className="w-10 h-10 mb-2 opacity-50" />
                  <p className="text-sm">{error || "Memuat kamera..."}</p>
                </div>
              )}
              
              {stream && modelsLoaded && !capturing && (
                <div className="absolute inset-0 flex flex-col items-center pointer-events-none" style={{justifyContent: 'center', paddingTop: '4%'}}>
                  {/* Oval guide — slightly taller ratio (3:4) matches a face better */}
                  <div className={`border-4 rounded-[100%] transition-all duration-300 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] flex items-center justify-center ${
                    faceReady ? 'border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.45),0_0_30px_4px_rgba(52,211,153,0.5)]' : 'border-white/60'
                  }`}
                    style={{width: '42%', paddingBottom: '56%', position: 'relative'}}
                  >
                    {faceReady && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <CheckIcon className="w-10 h-10 text-emerald-400 animate-pulse drop-shadow-lg" />
                      </div>
                    )}
                  </div>
                  {/* Guidance text pill */}
                  <div className={`mt-3 px-4 py-2 rounded-full text-sm font-semibold transition-all max-w-[90%] text-center ${
                    faceReady
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40'
                      : 'bg-black/65 backdrop-blur-sm text-white'
                  }`}>
                    {guidanceText}
                  </div>
                </div>
              )}

              {capturing && (
                <div className="absolute inset-0 bg-indigo-900/60 backdrop-blur-sm flex items-center justify-center">
                  <div className="text-center text-white">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto mb-2" />
                    <p className="text-sm font-medium">Menganalisa & Menyimpan...</p>
                  </div>
                </div>
              )}
            </div>

            {error && stream && <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">{error}</div>}

            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500">
                {modelsLoaded ? "Wajah akan dijepret otomatis jika posisi pas." : "Memuat model AI, mohon tunggu..."}
              </p>
              <button onClick={toggleCamera} className="flex items-center gap-2 text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors">
                <RefreshCcwIcon className="w-4 h-4" /> Tukar
              </button>
            </div>

            {/* Progress dots for captured angles */}
            <div className="flex items-center justify-center gap-2 mb-4">
              {ANGLES.map((a, idx) => (
                <div key={a} className={`w-2.5 h-2.5 rounded-full transition-colors ${idx < captures.length ? "bg-emerald-500" : idx === currentAngleIndex ? "bg-indigo-500 animate-pulse" : "bg-slate-200"}`} title={a} />
              ))}
            </div>

            <button onClick={capturePhoto} disabled={!stream || capturing || !modelsLoaded}
              className="w-full py-3 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-semibold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
              {capturing
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Memproses...</>
                : !modelsLoaded
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> Memuat Model AI...</>
                  : <><CameraIcon className="w-5 h-5" /> Jepret Manual ({ANGLES[currentAngleIndex]})</>
              }
            </button>
          </div>
        )}

        {/* STEP 2: Form */}
        {step === "form" && (
          <div className="p-6">
            {captures.length > 0 && (
              <div className="mb-6 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-indigo-800">{captures.length} Foto berhasil diambil</p>
                  <button onClick={resetFlow}
                    className="text-xs text-indigo-600 underline font-medium">Ulangi Kamera</button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {captures.map((c, idx) => (
                    <div key={idx} className="relative shrink-0">
                      <img src={c.dataUrl} alt={`Wajah ${idx}`} className="w-14 h-14 rounded-lg object-cover scale-x-[-1] border-2 border-white shadow-sm" />
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
              <button type="submit" disabled={loading || !className || !name}
                className="w-full py-3 bg-[#4f46e5] hover:bg-[#4338ca] text-white font-semibold rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-2">
                {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Menyimpan...</> : <><UserPlusIcon className="w-5 h-5" /> Simpan & Daftarkan</>}
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
              <button onClick={resetFlow}
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
