from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import schemas, models, database
from ..auth import get_current_teacher

router = APIRouter(
    prefix="/api/faces",
    tags=["Face Registration"],
    dependencies=[Depends(get_current_teacher)]
)

@router.post("/register", response_model=schemas.FaceRegistrationResponse, status_code=status.HTTP_201_CREATED)
def register_face(
    request: schemas.FaceRegisterRequest,
    db: Session = Depends(database.get_db)
):
    """
    Store a face descriptor (128-dim) that was computed in the browser.
    The heavy face-model inference runs client-side; this endpoint only
    persists the resulting vector, keeping the server light enough for Vercel.
    """
    # Check if student exists
    db_student = db.query(models.Student).filter(models.Student.id == request.student_id).first()
    if not db_student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Optionally wipe old embeddings so each student starts fresh
    if request.clear_existing:
        db.query(models.FaceEmbedding).filter(models.FaceEmbedding.student_id == request.student_id).delete()

    new_embedding = models.FaceEmbedding(
        student_id=request.student_id,
        embedding=request.embedding,
    )
    db.add(new_embedding)
    db.commit()

    return schemas.FaceRegistrationResponse(
        student_id=request.student_id,
        message="Face successfully registered"
    )
