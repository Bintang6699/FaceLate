from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime, timedelta

from .. import schemas, models, database
from ..auth import get_current_teacher

router = APIRouter(
    prefix="/api/attendance",
    tags=["Attendance"],
    dependencies=[Depends(get_current_teacher)]
)

# Face descriptors come from face-api.js (FaceRecognitionNet, 128-dim).
# The established matching metric for this model is Euclidean (L2) distance;
# distances below ~0.6 mean "same person". Slightly stricter default (0.55)
# to reduce false accepts between different students.
FACE_MATCH_THRESHOLD = 0.55

@router.post("/recognize", response_model=schemas.AttendanceResponse)
def recognize_face(
    request: schemas.FaceRecognizeRequest,
    current_teacher: models.Teacher = Depends(get_current_teacher),
    db: Session = Depends(database.get_db)
):
    """
    Match a browser-computed face descriptor against the database.
    Returns the closest student if the L2 distance is below the threshold.
    """
    # pgvector L2 distance — order ascending and take the closest embedding
    distance_col = models.FaceEmbedding.embedding.l2_distance(request.embedding)
    stmt = (
        select(models.FaceEmbedding, distance_col.label("distance"))
        .order_by(distance_col)
        .limit(1)
    )

    row = db.execute(stmt).first()

    if not row:
        raise HTTPException(status_code=404, detail="Belum ada data wajah siswa di database")

    nearest_face, distance = row[0], float(row[1])

    if distance > FACE_MATCH_THRESHOLD:
        raise HTTPException(
            status_code=404,
            detail=f"Wajah tidak dikenali (jarak: {distance:.2f}). Pastikan pencahayaan cukup dan wajah terlihat jelas."
        )

    student = nearest_face.student

    # Convert distance to a 0..1 similarity score for display/logging
    similarity = max(0.0, 1.0 - distance)

    return schemas.AttendanceResponse(
        student_id=student.id,
        student_name=student.name,
        class_name=student.class_name,
        message="Wajah berhasil dikenali. Menunggu konfirmasi.",
        late_time=datetime.utcnow(),  # Temporary time, frontend will use client time
        similarity=similarity
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

    # Idempotency guard: max ONE late record per student per day (WITA calendar).
    # This is the server-side safety net so double-taps, network retries, or
    # scanning the same student twice can never insert duplicate rows, even if
    # the frontend guard is bypassed.
    WITA_OFFSET = timedelta(hours=8)
    recent = (
        db.query(models.LateHistory)
        .filter(models.LateHistory.student_id == student.id)
        .order_by(models.LateHistory.late_time.desc())
        .first()
    )
    if recent and recent.late_time:
        existing_day = (recent.late_time + WITA_OFFSET).date()
        new_day = (request.client_time + WITA_OFFSET).date()
        if existing_day == new_day:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"{student.name} sudah tercatat terlambat hari ini. Data ganda tidak disimpan."
            )

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
