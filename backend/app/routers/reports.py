from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from io import BytesIO

from .. import models, database
from ..auth import get_current_teacher

router = APIRouter(
    prefix="/api/reports",
    tags=["Reports"],
    dependencies=[Depends(get_current_teacher)]
)



@router.get("/lates/today")
def get_today_lates(db: Session = Depends(database.get_db)):
    """Get list of students who are late today."""
    from datetime import datetime, time
    today_start = datetime.combine(datetime.today(), time.min)
    
    lates = (
        db.query(models.LateHistory)
        .filter(models.LateHistory.late_time >= today_start)
        .order_by(models.LateHistory.late_time.desc())
        .all()
    )
    
    result = []
    for late in lates:
        result.append({
            "id": str(late.id),
            "student_id": str(late.student.id),
            "name": late.student.name,
            "class_name": late.student.class_name,
            "late_time": late.late_time.isoformat(),
            "notes": late.notes
        })
    return result



@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(database.get_db)):
    """Get general dashboard statistics (efficiently)."""
    from sqlalchemy import func
    total_students = db.query(func.count(models.Student.id)).scalar() or 0
    total_lates_all_time = db.query(func.sum(models.Student.total_lates)).scalar() or 0
    
    return {
        "total_students": total_students,
        "total_lates_all_time": total_lates_all_time
    }
