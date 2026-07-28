from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime

from .. import schemas, models, database
from ..auth import get_current_teacher
from ..services import face_service

router = APIRouter(
    prefix="/api/attendance",
    tags=["Attendance"],
    dependencies=[Depends(get_current_teacher)]
)

@router.post("/recognize", response_model=schemas.AttendanceResponse)
async def recognize_face(
    file: UploadFile = File(...),
    current_teacher: models.Teacher = Depends(get_current_teacher),
    db: Session = Depends(database.get_db)
):
    # Read image bytes
    image_bytes = await file.read()
    
    try:
        # Extract 512-dim embedding
        embedding = face_service.extract_embedding(image_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    # Search for nearest face in database
    # Since embeddings are normalized, l2_distance or cosine_distance both work.
    # The lower the distance, the more similar they are.
    # A safe threshold for cosine similarity with insightface buffalo_l is typically around 0.4.
    # Lowered to 0.35 to tolerate pitch variations (looking up/down).
    SIMILARITY_THRESHOLD = 0.35 
    
    # Using pgvector cosine_distance
    # order_by limits to the nearest neighbor
    stmt = (
        select(models.FaceEmbedding)
        .order_by(models.FaceEmbedding.embedding.cosine_distance(embedding.tolist()))
        .limit(1)
    )
    
    nearest_face = db.scalars(stmt).first()
    
    if not nearest_face:
        raise HTTPException(status_code=404, detail="Belum ada data wajah siswa di database")
        
    # Calculate distance to see if it passes the threshold
    import numpy as np
    db_embedding = np.array(nearest_face.embedding)
    similarity = face_service.cosine_similarity(embedding, db_embedding)
    
    if similarity < SIMILARITY_THRESHOLD:
        raise HTTPException(
            status_code=404, 
            detail=f"Wajah tidak dikenali (kemiripan: {similarity:.2f}). Pastikan pencahayaan cukup dan wajah terlihat jelas."
        )
        
    student = nearest_face.student
    
    return schemas.AttendanceResponse(
        student_id=student.id,
        student_name=student.name,
        class_name=student.class_name,
        message="Wajah berhasil dikenali. Menunggu konfirmasi.",
        late_time=datetime.utcnow(), # Temporary time, frontend will use client time
        similarity=float(similarity)
    )

@router.post("/record", response_model=schemas.LateHistoryResponse)
def record_attendance(
    request: schemas.AttendanceRecordRequest,
    current_teacher: models.Teacher = Depends(get_current_teacher),
    db: Session = Depends(database.get_db)
):
    # Fetch student
    student = db.query(models.Student).filter(models.Student.id == request.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Record Late History
    new_late = models.LateHistory(
        student_id=student.id,
        teacher_id=current_teacher.id,
        late_time=request.client_time,
        notes="Detected via Face Recognition (Manual Confirm)"
    )
    db.add(new_late)
    
    # Update Student total_lates
    student.total_lates += 1
    
    # Log activity
    log = models.ActivityLog(
        teacher_id=current_teacher.id,
        action="RECORD_LATE",
        details={
            "student_id": str(student.id), 
            "similarity": float(request.similarity),
            "client_time": request.client_time.isoformat()
        }
    )
    db.add(log)
    
    db.commit()
    db.refresh(new_late)
    
    return new_late
