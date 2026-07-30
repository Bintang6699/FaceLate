"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { fetchApi } from "@/lib/api";
import { getFaceDescriptor, loadFaceModels, NoFaceDetectedError } from "@/lib/face";
import { CameraIcon, CheckCircleIcon, XCircleIcon, Loader2, PlayIcon, SquareIcon } from "lucide-react";

export default function AttendanceCameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Hard guard so overlapping intervals can never run two scans at once
  const scanningRef = useRef(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isAutoScanning, setIsAutoScanning] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [status, setStatus] = useState<"idle" | "scanning" | "success" | "error">("idle");
  const [message, setMessage] = useState("Ready to scan");
  const [recentStudent, setRecentStudent] = useState<{name: string, similarity: number} | null>(null);

  // Initialize Camera + preload AI models
  useEffect(() => {
    let cancelled = false;
    const initCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        if (cancelled) {
          mediaStream.getTracks().forEach(t => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setStream(mediaStream);
      } catch (err) {
        console.error(err);
        setStatus("error");
        setMessage("Camera access denied or unavailable.");
      }
    };
    initCamera();
    loadFaceModels()
      .then(() => setModelsLoaded(true))
      .catch((e) => {
        setStatus("error");
        setMessage(e.message);
      });

    return () => {
      cancelled = true;
      if (videoRef.current?.srcObject) {
        const ms = videoRef.current.srcObject as MediaStream;
        ms.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const captureAndRecognize = useCallback(async () => {
    if (!videoRef.current || scanningRef.current || !modelsLoaded) return;
    scanningRef.current = true;

    setStatus("scanning");
    setMessage("Analyzing face...");
    setRecentStudent(null);

    try {
      // Face detection + descriptor run in the browser; backend only matches vectors
      const descriptor = await getFaceDescriptor(videoRef.current, "fast");

      const res = await fetchApi<any>("/attendance/recognize", {
        method: "POST",
        body: JSON.stringify({ embedding: descriptor }),
      });

      setStatus("success");
      setMessage("Success!");
      setRecentStudent({
        name: res.student_name,
        similarity: res.similarity
      });

    } catch (err: any) {
      if (err instanceof NoFaceDetectedError) {
        // No face in frame — quietly go back to idle
        setStatus("idle");
        setMessage("Ready to scan");
        scanningRef.current = false;
        return;
      }
      setStatus("error");
      setMessage(err.message || "Face not recognized.");
    }

    scanningRef.current = false;

    // Reset status after a delay
    setTimeout(() => {
      setStatus("idle");
      setMessage("Ready to scan");
    }, 3000);

  }, [modelsLoaded]);

  // Auto-scan interval
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAutoScanning && stream && modelsLoaded && status === "idle") {
      interval = setInterval(() => {
        captureAndRecognize();
      }, 4000); // Trigger every 4 seconds when idle
    }
    return () => clearInterval(interval);
  }, [isAutoScanning, stream, modelsLoaded, status, captureAndRecognize]);


  return (
    <div className="min-h-screen bg-black flex flex-col relative overflow-hidden">
      {/* Background Video */}
      <div className="absolute inset-0 z-0 flex items-center justify-center bg-slate-900">
        {stream ? (
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover transform scale-x-[-1] opacity-70"
          />
        ) : (
          <div className="text-white/50 flex flex-col items-center">
            <CameraIcon className="w-16 h-16 mb-4" />
            <p>Initializing Camera...</p>
          </div>
        )}
      </div>

      {/* Overlay UI */}
      <div className="z-10 relative flex-1 flex flex-col p-6 sm:p-12 justify-between">
        
        {/* Header */}
        <header className="flex justify-between items-start">
          <div className="glass px-6 py-4 rounded-2xl flex items-center">
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">FaceLate AI</h1>
              <p className="text-white/70 text-sm">Attendance System</p>
            </div>
          </div>
          
          <div className="glass px-4 py-2 rounded-xl flex items-center gap-3">
            <span className="text-white text-sm font-medium">Auto-Scan</span>
            <button 
              onClick={() => setIsAutoScanning(!isAutoScanning)}
              className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${isAutoScanning ? 'bg-primary' : 'bg-white/20'}`}
            >
              <span className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${isAutoScanning ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </header>

        {/* Center Reticle & Status */}
        <div className="flex-1 flex flex-col items-center justify-center">
          {/* Target Box */}
          <div className="relative w-64 h-64 sm:w-80 sm:h-80 mb-8">
            <div className={`absolute inset-0 border-2 border-dashed rounded-3xl transition-colors duration-500 ${
              status === "scanning" ? "border-blue-400 animate-spin-slow" : 
              status === "success" ? "border-green-400" :
              status === "error" ? "border-red-400" : "border-white/50"
            }`}></div>
            
            {status === "scanning" && (
              <div className="absolute inset-0 bg-blue-500/10 backdrop-blur-[2px] rounded-3xl animate-pulse flex items-center justify-center">
                <div className="w-full h-1 bg-blue-400/50 animate-scan"></div>
              </div>
            )}
          </div>

          {/* Status Message */}
          <div className={`glass px-8 py-6 rounded-3xl text-center max-w-sm w-full transition-all duration-300 transform ${
            status !== "idle" ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}>
            {status === "success" && (
              <div className="flex flex-col items-center animate-in zoom-in">
                <CheckCircleIcon className="w-12 h-12 text-green-400 mb-3" />
                <h3 className="text-2xl font-bold text-white">{recentStudent?.name}</h3>
                <p className="text-green-300 font-medium mt-1">Attendance Recorded</p>
                <p className="text-white/50 text-xs mt-2">Similarity: {(recentStudent?.similarity! * 100).toFixed(1)}%</p>
              </div>
            )}
            
            {status === "error" && (
              <div className="flex flex-col items-center animate-in zoom-in">
                <XCircleIcon className="w-12 h-12 text-red-400 mb-3" />
                <h3 className="text-xl font-bold text-white text-center">{message}</h3>
                <p className="text-red-300/80 text-sm mt-2">Please look directly at the camera.</p>
              </div>
            )}
            
            {status === "scanning" && (
              <div className="flex flex-col items-center">
                <Loader2 className="w-10 h-10 text-blue-400 animate-spin mb-3" />
                <h3 className="text-lg font-medium text-white">{message}</h3>
              </div>
            )}
          </div>
        </div>

        {/* Footer / Manual Controls */}
        <footer className="flex justify-center">
          {!isAutoScanning && (
            <button 
              onClick={captureAndRecognize}
              disabled={status !== "idle" || !stream || !modelsLoaded}
              className="glass hover:bg-white/10 active:bg-white/20 transition-all px-8 py-4 rounded-full flex items-center justify-center text-white font-bold tracking-wide shadow-2xl disabled:opacity-50"
            >
              <CameraIcon className="w-6 h-6 mr-3" />
              Capture Manually
            </button>
          )}
        </footer>
        
      </div>
      
      {/* Custom styles for scan animation */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes scan {
          0% { transform: translateY(-120px); }
          50% { transform: translateY(120px); }
          100% { transform: translateY(-120px); }
        }
        .animate-scan {
          animation: scan 2s linear infinite;
        }
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
      `}} />
    </div>
  );
}
