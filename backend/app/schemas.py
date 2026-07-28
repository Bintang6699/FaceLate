from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime
from typing import Optional, List, Dict, Any

# --- TEACHER SCHEMAS ---
class TeacherBase(BaseModel):
    email: EmailStr
    name: str

class TeacherCreate(TeacherBase):
    password: str

class TeacherResponse(TeacherBase):
    id: UUID
    created_at: datetime

    model_config = {"from_attributes": True}

class TeacherUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None


# --- STUDENT SCHEMAS ---
class StudentBase(BaseModel):
    name: str
    class_name: str
    address: Optional[str] = None

class StudentCreate(StudentBase):
    pass

class StudentUpdate(BaseModel):
    name: Optional[str] = None
    class_name: Optional[str] = None
    address: Optional[str] = None

class StudentResponse(StudentBase):
    id: UUID
    total_lates: int
    created_at: datetime

    model_config = {"from_attributes": True}

class StudentAdjustLatesRequest(BaseModel):
    amount: int


# --- FACE & ATTENDANCE SCHEMAS ---
class FaceRegistrationResponse(BaseModel):
    student_id: UUID
    message: str
    image_path: Optional[str] = None

class AttendanceResponse(BaseModel):
    student_id: UUID
    student_name: str
    class_name: str
    message: str
    late_time: datetime
    similarity: float

class AttendanceRecordRequest(BaseModel):
    student_id: UUID
    client_time: datetime
    similarity: float

class LateHistoryResponse(BaseModel):
    id: UUID
    late_time: datetime
    notes: Optional[str] = None
    
    model_config = {"from_attributes": True}


# --- AUTH SCHEMAS ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
