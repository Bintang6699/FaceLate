from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta

from .. import schemas, models, auth, database
from ..config import settings

router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)

@router.post("/register", response_model=schemas.TeacherResponse, status_code=status.HTTP_201_CREATED)
def register_teacher(teacher_data: schemas.TeacherCreate, db: Session = Depends(database.get_db)):
    # Check if teacher exists
    db_teacher = db.query(models.Teacher).filter(models.Teacher.email == teacher_data.email).first()
    if db_teacher:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    hashed_password = auth.get_password_hash(teacher_data.password)
    
    # Create new teacher
    new_teacher = models.Teacher(
        email=teacher_data.email,
        name=teacher_data.name,
        password_hash=hashed_password
    )
    db.add(new_teacher)
    db.commit()
    db.refresh(new_teacher)
    
    return new_teacher


@router.post("/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    # Find teacher by email
    teacher = db.query(models.Teacher).filter(models.Teacher.email == form_data.username).first()
    
    if not teacher or not auth.verify_password(form_data.password, teacher.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Generate JWT token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": teacher.email}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=schemas.TeacherResponse)
def get_me(current_teacher: models.Teacher = Depends(auth.get_current_teacher)):
    return current_teacher


@router.put("/me", response_model=schemas.TeacherResponse)
def update_profile(
    data: schemas.TeacherUpdate,
    current_teacher: models.Teacher = Depends(auth.get_current_teacher),
    db: Session = Depends(database.get_db)
):
    # Update email if provided
    if data.email:
        existing = db.query(models.Teacher).filter(
            models.Teacher.email == data.email
        ).first()
        if existing and existing.id != current_teacher.id:
            raise HTTPException(status_code=400, detail="Email already in use")
        current_teacher.email = data.email

    # Update name if provided
    if data.name:
        current_teacher.name = data.name

    # Update password if provided
    if data.password:
        current_teacher.password_hash = auth.get_password_hash(data.password)

    db.commit()
    db.refresh(current_teacher)
    return current_teacher
