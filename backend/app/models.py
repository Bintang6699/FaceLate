import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, ForeignKey, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector

from .database import Base

class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    late_histories = relationship("LateHistory", back_populates="teacher")
    activity_logs = relationship("ActivityLog", back_populates="teacher")



class Student(Base):
    __tablename__ = "students"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, index=True, nullable=False)
    class_name = Column(String, index=True, nullable=False)
    address = Column(Text, nullable=True)
    total_lates = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships

    face_embeddings = relationship("FaceEmbedding", back_populates="student", cascade="all, delete-orphan")
    late_histories = relationship("LateHistory", back_populates="student", cascade="all, delete-orphan")


class FaceEmbedding(Base):
    __tablename__ = "face_embeddings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), nullable=False)
    # Using 512 dimensions for InsightFace ArcFace models (adjust if using different model)
    embedding = Column(Vector(512), nullable=False) 
    image_path = Column(String, nullable=True) # URL to Supabase storage
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    student = relationship("Student", back_populates="face_embeddings")


class LateHistory(Base):
    __tablename__ = "late_histories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id"), index=True, nullable=False)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("teachers.id"), nullable=False)
    late_time = Column(DateTime, default=datetime.utcnow, index=True)
    notes = Column(Text, nullable=True)

    # Relationships
    student = relationship("Student", back_populates="late_histories")
    teacher = relationship("Teacher", back_populates="late_histories")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    teacher_id = Column(UUID(as_uuid=True), ForeignKey("teachers.id"), index=True, nullable=False)
    action = Column(String, nullable=False) # e.g. REGISTER_STUDENT, SCAN_FACE
    details = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    teacher = relationship("Teacher", back_populates="activity_logs")
