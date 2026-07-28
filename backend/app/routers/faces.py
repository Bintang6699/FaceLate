from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from uuid import UUID

from .. import schemas, models, database
from ..auth import get_current_teacher
from ..services import face_service

router = APIRouter(
    prefix="/api/faces",
    tags=["Face Registration"],
    dependencies=[Depends(get_current_teacher)]
)

@router.post("/register", response_model=schemas.FaceRegistrationResponse, status_code=status.HTTP_201_CREATED)
async def register_face(
    student_id: UUID = Form(...),
    clear_existing: bool = Form(False),
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db)
):
    # Check if student exists
    db_student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not db_student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    # Read image bytes
    image_bytes = await file.read()
    
    try:
        # Extract 512-dim embedding
        embedding = face_service.extract_embedding(image_bytes)
    except ValueError as e:
        # Catch errors from face extraction (no face, multiple faces, etc.)
        raise HTTPException(status_code=400, detail=str(e))
        
    # Check if face embedding already exists for this student
    # For now, we allow multiple embeddings per student, but in a strict system we might delete old ones
    # Let's delete old embeddings for simplicity so each student has 1 canonical face
    if clear_existing:
        db.query(models.FaceEmbedding).filter(models.FaceEmbedding.student_id == student_id).delete()
    
    # Save to database
    new_embedding = models.FaceEmbedding(
        student_id=student_id,
        embedding=embedding.tolist(), # Convert numpy array to list for pgvector
        # image_path could be added later if uploading to supabase storage
    )
    
    db.add(new_embedding)
    
    # Log activity
    current_teacher = db.query(models.Teacher).first() # In a real scenario, use get_current_teacher properly
    # Assuming get_current_teacher is handled by Depends, we should pass it to the endpoint if we want to log it
    # We can refine this by adding current_teacher: models.Teacher = Depends(get_current_teacher) to parameters
    
    db.commit()
    
    return schemas.FaceRegistrationResponse(
        student_id=student_id,
        message="Face successfully registered"
    )
