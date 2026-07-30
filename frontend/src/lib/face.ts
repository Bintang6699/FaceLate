"use client";

/**
 * Browser-side face recognition.
 *
 * The 128-dim face descriptor is computed here in the browser with
 * face-api.js, because heavy models (InsightFace/ONNX) cannot run inside
 * Vercel's serverless limits. The backend only stores and compares the
 * resulting vectors via pgvector.
 *
 * NOTE: @vladmandic/face-api (TensorFlow.js) must never be evaluated during
 * Next.js server-side prerendering — it is therefore loaded lazily with a
 * dynamic import that only ever executes in the browser.
 */

const MODEL_URI = "/models";

type FaceApi = typeof import("@vladmandic/face-api");

let faceapiPromise: Promise<FaceApi> | null = null;
let loadingPromise: Promise<void> | null = null;
let modelsReady = false;

function getFaceApi(): Promise<FaceApi> {
  if (!faceapiPromise) {
    faceapiPromise = import("@vladmandic/face-api");
  }
  return faceapiPromise;
}

export function areFaceModelsReady(): boolean {
  return modelsReady;
}

/** Load all required neural network weights exactly once. */
export function loadFaceModels(): Promise<void> {
  if (modelsReady) return Promise.resolve();
  if (!loadingPromise) {
    loadingPromise = (async () => {
      const faceapi = await getFaceApi();
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URI),
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URI),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URI),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URI),
      ]);
      modelsReady = true;
    })().catch(() => {
      // Allow retry on next call if the download failed
      loadingPromise = null;
      throw new Error("Gagal memuat model AI. Periksa koneksi internet lalu muat ulang halaman.");
    });
  }
  return loadingPromise;
}

export type FaceSource = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;

export class NoFaceDetectedError extends Error {
  constructor() {
    super("Wajah tidak terdeteksi. Pastikan pencahayaan cukup dan wajah menghadap kamera.");
    this.name = "NoFaceDetectedError";
  }
}

/**
 * Detect the single most prominent face and return its 128-dim descriptor.
 * Throws NoFaceDetectedError when no face is visible.
 *
 * mode "accurate" uses SSD Mobilenet (best for registration photos),
 * mode "fast" uses TinyFaceDetector (best for the live scan loop).
 */
export async function getFaceDescriptor(
  source: FaceSource,
  mode: "accurate" | "fast" = "accurate"
): Promise<number[]> {
  await loadFaceModels();
  const faceapi = await getFaceApi();

  const detectorOptions =
    mode === "fast"
      ? new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 })
      : new faceapi.SsdMobilenetv1Options({ minConfidence: 0.35 });

  const result = await faceapi
    .detectSingleFace(source, detectorOptions)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!result) {
    throw new NoFaceDetectedError();
  }

  return Array.from(result.descriptor);
}
