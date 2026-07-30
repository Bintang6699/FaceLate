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


@router.get("/students/pdf/{class_name}")
def download_students_pdf(class_name: str, db: Session = Depends(database.get_db)):
    """Generate a PDF report of all students in a class."""
    from datetime import datetime
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

    students = (
        db.query(models.Student)
        .filter(models.Student.class_name == class_name)
        .order_by(models.Student.name)
        .all()
    )
    if not students:
        raise HTTPException(status_code=404, detail=f"Tidak ada siswa di kelas {class_name}")

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, title=f"Data Siswa {class_name}")
    styles = getSampleStyleSheet()

    elements = [
        Paragraph(f"Data Siswa Kelas {class_name}", styles["Title"]),
        Paragraph(
            f"SMP Negeri 01 Dompu — dicetak {datetime.now().strftime('%d-%m-%Y %H:%M')}",
            styles["Normal"],
        ),
        Spacer(1, 18),
    ]

    table_data = [["No", "Nama", "Kelas", "Alamat", "Total Terlambat"]]
    for idx, s in enumerate(students, start=1):
        table_data.append([str(idx), s.name, s.class_name, s.address or "-", str(s.total_lates)])

    table = Table(table_data, colWidths=[30, 160, 60, 180, 90], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4f46e5")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(table)

    doc.build(elements)
    buffer.seek(0)

    safe_class = class_name.replace(" ", "_")
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Data_Siswa_{safe_class}.pdf"'},
    )
