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

export function getFaceApi(): Promise<FaceApi> {
  if (!faceapiPromise) {
    faceapiPromise = import("@vladmandic/face-api");
  }
  return faceapiPromise;
}

export function areFaceModelsReady(): boolean {
  return modelsReady;
}

async function warmupFaceApi(faceapi: FaceApi) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 224;
    canvas.height = 224;
    // Run a tiny dummy detection to force WebGL shaders to compile NOW
    // instead of freezing the UI during the user's first actual scan.
    await faceapi.detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.1 }))
      .withFaceLandmarks()
      .withFaceDescriptor();
  } catch (e) {
    // Ignore warmup errors
  }
}

/** Load all required neural network weights exactly once. */
export function loadFaceModels(): Promise<void> {
  if (modelsReady) return Promise.resolve();
  if (!loadingPromise) {
    loadingPromise = (async () => {
      const faceapi = await getFaceApi();
      
      // Ensure TensorFlow uses WebGL backend for performance, preventing CPU freeze
      try {
        // @ts-ignore - faceapi.tf typing might not include setBackend in this version
        await faceapi.tf.setBackend('webgl');
        // @ts-ignore
        await faceapi.tf.ready();
      } catch (e) {
        console.warn("WebGL backend failed to initialize, falling back to default.", e);
      }

      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URI),
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URI),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URI),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URI),
      ]);
      
      // Warmup the model in the background
      await warmupFaceApi(faceapi);

      modelsReady = true;
    })().catch((err) => {
      // Allow retry on next call if the download failed
      loadingPromise = null;
      console.error(err);
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
 * mode "accurate"  → tries SSD MobileNet then TinyFaceDetector as fallback
 * mode "fast"      → TinyFaceDetector only (for real-time scan loop)
 *
 * KEY FIX FOR SIDE PROFILES:
 * For enrollment (accurate mode) we NO LONGER chain .withFaceLandmarks() on the
 * *initial* detection pass, because the landmark model was trained on frontal faces
 * and almost always fails on left/right/up/down poses, causing the entire chain to
 * return undefined even though the detector DID find the face.
 * Instead we:
 *   1. Detect with a very low threshold on both detectors.
 *   2. For the winning detection box, run getFaceDescriptor from the recognition net
 *      directly on the cropped+padded region — no landmarks needed.
 */
export async function getFaceDescriptor(
  source: FaceSource,
  mode: "accurate" | "fast" = "accurate"
): Promise<number[]> {
  await loadFaceModels();
  const faceapi = await getFaceApi();

  // --- FAST MODE: used by the live scan loop (attendance, not enrollment) ---
  if (mode === "fast") {
    const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.15 });
    const result = await faceapi
      .detectSingleFace(source, opts)
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (!result) throw new NoFaceDetectedError();
    return Array.from(result.descriptor);
  }

  // --- ACCURATE MODE: used during enrollment ---
  // Step 1: Detect a face bounding box using the most forgiving thresholds possible.
  // We try BOTH detectors and take whichever found a face.
  const ssdOpts  = new faceapi.SsdMobilenetv1Options({ maxResults: 1, minConfidence: 0.1 });
  const tinyOpts = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.1 });

  let detection = await faceapi.detectSingleFace(source, ssdOpts);
  if (!detection) {
    detection = await faceapi.detectSingleFace(source, tinyOpts);
  }

  if (!detection) {
    throw new NoFaceDetectedError();
  }

  // Step 2: Try the full pipeline (with landmarks) — this works well for frontal
  // and slightly angled faces.
  try {
    const fullResult = await faceapi
      .detectSingleFace(source, ssdOpts)
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (fullResult) return Array.from(fullResult.descriptor);
  } catch (_) {
    // landmark model failed — fall through to descriptor-only path
  }

  // Step 3 (FALLBACK for side profiles): landmarks failed but we DO have a bounding
  // box. Extract the descriptor directly from the raw detection box.
  // We create a cropped canvas, expand the box by 30% for context, then run the
  // recognition network directly without needing landmarks.
  try {
    const srcCanvas = document.createElement("canvas");
    let srcWidth: number, srcHeight: number;

    if (source instanceof HTMLVideoElement) {
      srcWidth  = source.videoWidth;
      srcHeight = source.videoHeight;
    } else if (source instanceof HTMLImageElement) {
      srcWidth  = source.naturalWidth;
      srcHeight = source.naturalHeight;
    } else {
      srcWidth  = (source as HTMLCanvasElement).width;
      srcHeight = (source as HTMLCanvasElement).height;
    }

    srcCanvas.width  = srcWidth;
    srcCanvas.height = srcHeight;
    const ctx = srcCanvas.getContext("2d")!;
    ctx.drawImage(source as CanvasImageSource, 0, 0, srcWidth, srcHeight);

    // Expand box by 40% so the network has enough context
    const pad = 0.4;
    const bx = Math.max(0, detection.box.x - detection.box.width  * pad);
    const by = Math.max(0, detection.box.y - detection.box.height * pad);
    const bw = Math.min(srcWidth  - bx, detection.box.width  * (1 + 2 * pad));
    const bh = Math.min(srcHeight - by, detection.box.height * (1 + 2 * pad));

    // Face recognition net expects 150×150
    const faceCanvas = document.createElement("canvas");
    faceCanvas.width  = 150;
    faceCanvas.height = 150;
    faceCanvas.getContext("2d")!.drawImage(srcCanvas, bx, by, bw, bh, 0, 0, 150, 150);

    // @ts-ignore — computeFaceDescriptor accepts a canvas directly
    const descriptor: Float32Array = await faceapi.nets.faceRecognitionNet.computeFaceDescriptor(faceCanvas);
    if (descriptor && descriptor.length === 128) {
      return Array.from(descriptor);
    }
  } catch (fallbackErr) {
    console.warn("Descriptor fallback failed:", fallbackErr);
  }

  // If everything failed, still throw so the UI can show an error
  throw new NoFaceDetectedError();
}

/**
 * Lightweight presence check for the live preview loop.
 * Returns true if ANY face is found at very low thresholds.
 * Does NOT compute descriptors — keeps the loop fast.
 */
export async function isFacePresent(source: FaceSource): Promise<boolean> {
  const faceapi = await getFaceApi();
  const tinyOpts = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.1 });
  const result = await faceapi.detectSingleFace(source, tinyOpts);
  return !!result;
}

/** Helper to extract a safely downscaled canvas from a video stream for faster mobile processing */
export function captureVideoFrame(video: HTMLVideoElement, maxDim = 480): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  let width = video.videoWidth;
  let height = video.videoHeight;
  if (!width || !height) {
    canvas.width = maxDim;
    canvas.height = maxDim;
    return canvas;
  }
  
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
  if (ctx) {
    ctx.drawImage(video, 0, 0, width, height);
  }
  return canvas;
}
