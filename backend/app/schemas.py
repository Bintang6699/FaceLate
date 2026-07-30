from pydantic import BaseModel, EmailStr, Field, field_validator
from uuid import UUID
from datetime import datetime
from typing import Optional, List, Dict, Any

# Face descriptors are 128-dim vectors produced in the browser by face-api.js
FACE_EMBEDDING_DIM = 128


def _validate_embedding(values: List[float]) -> List[float]:
    if len(values) != FACE_EMBEDDING_DIM:
        raise ValueError(f"Embedding must have exactly {FACE_EMBEDDING_DIM} dimensions")
    if any((v != v) or v in (float("inf"), float("-inf")) for v in values):  # NaN/Inf guard
        raise ValueError("Embedding contains invalid values")
    return values

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
class FaceRegisterRequest(BaseModel):
    student_id: UUID
    embedding: List[float]
    clear_existing: bool = False

    _check_embedding = field_validator("embedding")(_validate_embedding)

class StudentRegisterWithFacesRequest(BaseModel):
    name: str
    class_name: str
    address: Optional[str] = None
    embeddings: List[List[float]] = Field(..., min_length=1, max_length=10)

    _check_embeddings = field_validator("embeddings")(
        lambda v: [_validate_embedding(e) for e in v]
    )

class FaceRecognizeRequest(BaseModel):
    embedding: List[float]

    _check_embedding = field_validator("embedding")(_validate_embedding)

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
