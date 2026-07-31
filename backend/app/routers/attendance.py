from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from datetime import datetime, timedelta
import uuid

from .. import schemas, models, database
from ..auth import get_current_teacher

router = APIRouter(
    prefix="/api/attendance",
    tags=["Attendance"],
    dependencies=[Depends(get_current_teacher)]
)

# ---------------------------------------------------------------------------
# FACE MATCHING THRESHOLD
#
# face-api.js FaceRecognitionNet produces 128-dim L2-normalised vectors.
# The canonical "same person" threshold is L2 distance < 0.6.
#
# We use 0.45 (tighter than the default 0.6) for two reasons:
#   1. Reduces false-positives when a tilted face accidentally scores close to
#      a DIFFERENT student's embedding (the main bug reported).
#   2. With multi-angle enrollment (Depan/Kiri/Kanan/Atas/Bawah) the best
#      matching angle for the correct student is almost always well below 0.45,
#      while wrong-student matches rarely fall below it.
#
# Practical consequence: similarity score shown to the teacher will be ≥ 55%
# for accepted matches; anything below that shows "wajah tidak dikenali".
# ---------------------------------------------------------------------------
FACE_MATCH_THRESHOLD = 0.45

@router.post("/recognize", response_model=schemas.AttendanceResponse)
def recognize_face(
    request: schemas.FaceRecognizeRequest,
    current_teacher: models.Teacher = Depends(get_current_teacher),
    db: Session = Depends(database.get_db)
):
    """
    Match a browser-computed face descriptor against ALL stored embeddings.

    ALGORITHM — "best-of-N per student":
    ======================================
    The old approach (global ORDER BY distance LIMIT 1) was BROKEN for multi-
    angle enrollment.  Example of the failure:
        • Student A enrolled with 5 angles; Student B also enrolled with 5 angles.
        • Camera sees Student A's face tilted left.
        • Student B's FRONTAL embedding may accidentally be closer (lower L2)
          to Student A's tilted descriptor than Student A's own LEFT embedding.
        • Old query: picks Student B → WRONG.

    Correct approach:
        1. For every student, find the MINIMUM distance across ALL their embeddings
           (i.e. their "best-matching angle" for this query frame).
        2. Pick the student with the smallest such minimum.
        3. Accept only if that minimum is below FACE_MATCH_THRESHOLD.

    This guarantees that ALL enrolled angles are considered for each student,
    and the comparison is always the best possible angle vs. the query.
    """
    distance_col = models.FaceEmbedding.embedding.l2_distance(request.embedding)

    # Subquery: minimum L2 distance per student
    # Using pgvector's l2_distance which leverages the ivfflat/hnsw index when
    # available, falling back to exact scan on small tables.
    per_student_min = (
        select(
            models.FaceEmbedding.student_id,
            func.min(distance_col).label("min_distance")
        )
        .group_by(models.FaceEmbedding.student_id)
        .subquery()
    )

    # Main query: pick the student with the overall best (smallest) min distance
    best = (
        db.execute(
            select(per_student_min.c.student_id, per_student_min.c.min_distance)
            .order_by(per_student_min.c.min_distance)
            .limit(1)
        ).first()
    )

    if not best:
        raise HTTPException(
            status_code=404,
            detail="Belum ada data wajah siswa di database. Daftarkan siswa terlebih dahulu."
        )

    best_student_id, best_distance = best[0], float(best[1])

    # Reject if the best candidate is still too far away
    if best_distance > FACE_MATCH_THRESHOLD:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Wajah tidak dikenali (skor kemiripan: {(1 - best_distance) * 100:.1f}%). "
                f"Pastikan wajah menghadap kamera dengan pencahayaan cukup, lalu coba lagi."
            )
        )

    student = db.query(models.Student).filter(
        models.Student.id == best_student_id
    ).first()

    if not student:
        raise HTTPException(status_code=404, detail="Data siswa tidak ditemukan.")

    # Convert L2 distance → similarity score in [0, 1] for UI display
    # distance=0   → similarity=1.0 (identical)
    # distance=0.45 → similarity=0.55 (threshold boundary)
    similarity = round(max(0.0, 1.0 - best_distance), 4)

    return schemas.AttendanceResponse(
        student_id=student.id,
        student_name=student.name,
        class_name=student.class_name,
        message="Wajah berhasil dikenali. Menunggu konfirmasi.",
        late_time=datetime.utcnow(),  # Temporary; frontend overwrites with client time
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

