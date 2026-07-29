import cv2
import numpy as np

# Lazy-load InsightFace to prevent crash at startup on Vercel
# (dummy dependencies like scipy would cause import errors if loaded eagerly)
_face_app = None

def _get_face_app():
    global _face_app
    if _face_app is None:
        import insightface
        from insightface.app import FaceAnalysis
        try:
            _face_app = FaceAnalysis(name='buffalo_sc', root='/tmp', providers=['CPUExecutionProvider'])
        except Exception:
            _face_app = FaceAnalysis(name='buffalo_l', root='/tmp', providers=['CPUExecutionProvider'])
        _face_app.prepare(ctx_id=0, det_size=(640, 640), det_thresh=0.4)
    return _face_app

def extract_embedding(image_bytes: bytes) -> np.ndarray:
    """
    Extract face embedding (512-dim vector) from image bytes.
    Raises ValueError if no face is found.
    """
    face_app = _get_face_app()
    
    # Convert image bytes to numpy array
    nparr = np.frombuffer(image_bytes, np.uint8)
    
    # Decode image using OpenCV
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        raise ValueError("Invalid image data")

    # Resize image to max 640px to capture details at pitch angles
    h, w = img.shape[:2]
    max_dim = 640
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_LINEAR)
        
    # Run face detection and recognition
    faces = face_app.get(img)
    
    if len(faces) == 0:
        raise ValueError("No face detected in the image")
    
    # If multiple faces, pick the largest (most prominent) one
    if len(faces) > 1:
        faces = sorted(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]), reverse=True)
        
    # Extract the 512-dim embedding from the first (largest) face
    embedding = faces[0].embedding
    
    # Normalize the embedding (useful for cosine similarity)
    norm = np.linalg.norm(embedding)
    if norm == 0:
        return embedding
    return embedding / norm

def cosine_similarity(emb1: np.ndarray, emb2: np.ndarray) -> float:
    """Calculate cosine similarity between two embeddings"""
    return float(np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2)))
