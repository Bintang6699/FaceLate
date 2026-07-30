from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
import re

from .. import schemas, models, database
from ..auth import get_current_teacher

router = APIRouter(
    prefix="/api/students",
    tags=["Students"],
    dependencies=[Depends(get_current_teacher)]
)

def format_class_name(raw_name: str) -> str:
    name = raw_name.strip().upper()
    name = name.replace("7", "VII").replace("8", "VIII").replace("9", "IX")
    match = re.match(r"^(VII|VIII|IX)\s*([A-Z]*)$", name)
    if match:
        roman = match.group(1)
        letter = match.group(2)
        if letter:
            return f"{roman} {letter}"
        return roman
    return name

@router.post("", response_model=schemas.StudentResponse, status_code=status.HTTP_201_CREATED)
def create_student(student_data: schemas.StudentCreate, db: Session = Depends(database.get_db)):
    formatted_class_name = format_class_name(student_data.class_name)
    
    new_student = models.Student(
        name=student_data.name,
        class_name=formatted_class_name,
        address=student_data.address
    )
    db.add(new_student)
    db.commit()
    db.refresh(new_student)
    return new_student

@router.post("/register-with-faces", response_model=schemas.StudentResponse, status_code=status.HTTP_201_CREATED)
def register_student_with_faces(request: schemas.StudentRegisterWithFacesRequest, db: Session = Depends(database.get_db)):
    """
    Atomically create a student AND all face embeddings in a single transaction.
    Prevents orphan students (created but with no usable face) that occurred
    when registration was split across multiple requests.
    Also rejects exact duplicates (same name + same class) so a double-tap
    or retry can never insert the same student twice.
    """
    formatted_class_name = format_class_name(request.class_name)

    duplicate = db.query(models.Student).filter(
        models.Student.name == request.name.strip(),
        models.Student.class_name == formatted_class_name
    ).first()
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Siswa '{request.name.strip()}' sudah terdaftar di kelas {formatted_class_name}"
        )

    new_student = models.Student(
        name=request.name.strip(),
        class_name=formatted_class_name,
        address=request.address
    )
    db.add(new_student)
    db.flush()  # get new_student.id before adding embeddings

    for emb in request.embeddings:
        db.add(models.FaceEmbedding(student_id=new_student.id, embedding=emb))

    db.commit()
    db.refresh(new_student)
    return new_student

@router.get("", response_model=List[schemas.StudentResponse])
def get_students(
    class_name: Optional[str] = None, 
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(database.get_db)
):
    query = db.query(models.Student)
    if class_name:
        query = query.filter(models.Student.class_name == class_name)
        
    students = query.offset(skip).limit(limit).all()
    return students

@router.get("/{student_id}", response_model=schemas.StudentResponse)
def get_student(student_id: UUID, db: Session = Depends(database.get_db)):
    db_student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not db_student:
        raise HTTPException(status_code=404, detail="Student not found")
    return db_student

@router.get("/{student_id}/history", response_model=List[schemas.LateHistoryResponse])
def get_student_history(student_id: UUID, db: Session = Depends(database.get_db)):
    db_student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not db_student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    histories = db.query(models.LateHistory).filter(models.LateHistory.student_id == student_id).order_by(models.LateHistory.late_time.desc()).all()
    return histories

@router.put("/{student_id}", response_model=schemas.StudentResponse)
def update_student(student_id: UUID, student_data: schemas.StudentUpdate, db: Session = Depends(database.get_db)):
    db_student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not db_student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    if student_data.name is not None:
        db_student.name = student_data.name
        
    if student_data.class_name is not None:
        db_student.class_name = format_class_name(student_data.class_name)
        
    if student_data.address is not None:
        db_student.address = student_data.address

        
    db.commit()
    db.refresh(db_student)
    return db_student

@router.delete("/class/{class_name}", status_code=status.HTTP_204_NO_CONTENT)
def delete_students_by_class(class_name: str, db: Session = Depends(database.get_db)):
    count = db.query(models.Student).filter(models.Student.class_name == class_name).delete(synchronize_session='fetch')
    db.commit()
    if count == 0:
        raise HTTPException(status_code=404, detail=f"Tidak ada siswa di kelas {class_name}")
    return None

@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_student(student_id: UUID, db: Session = Depends(database.get_db)):
    db_student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not db_student:
        raise HTTPException(status_code=404, detail="Student not found")
        
    db.delete(db_student)
    db.commit()
    return None

@router.post("/{student_id}/adjust-lates", response_model=schemas.StudentResponse)
def adjust_student_lates(student_id: UUID, request: schemas.StudentAdjustLatesRequest, db: Session = Depends(database.get_db), current_teacher: models.Teacher = Depends(get_current_teacher)):
    db_student = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not db_student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    new_total = db_student.total_lates + request.amount
    if new_total < 0:
        new_total = 0
    
    db_student.total_lates = new_total
    
    # Log activity
    log = models.ActivityLog(
        teacher_id=current_teacher.id,
        action="ADJUST_LATES_MANUAL",
        details={
            "student_id": str(student_id),
            "amount_adjusted": request.amount,
            "new_total": new_total
        }
    )
    db.add(log)
    
    db.commit()
    db.refresh(db_student)
    return db_student

@router.post("/class/{class_name}/reset-lates")
def reset_class_lates(class_name: str, db: Session = Depends(database.get_db), current_teacher: models.Teacher = Depends(get_current_teacher)):
    students = db.query(models.Student).filter(models.Student.class_name == class_name).all()
    if not students:
        raise HTTPException(status_code=404, detail=f"Tidak ada siswa di kelas {class_name}")
    
    for student in students:
        student.total_lates = 0
    
    # Log activity
    log = models.ActivityLog(
        teacher_id=current_teacher.id,
        action="RESET_CLASS_LATES",
        details={
            "class_name": class_name,
            "students_affected": len(students)
        }
    )
    db.add(log)
    
    db.commit()
    return {"message": f"Berhasil mereset data keterlambatan untuk {len(students)} siswa di kelas {class_name}"}

