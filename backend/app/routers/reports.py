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

@router.get("/students/pdf/{class_name}")
def download_students_pdf(
    class_name: str,
    db: Session = Depends(database.get_db)
):
    """Generate PDF report of students filtered by class_name."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_LEFT

    students = (
        db.query(models.Student)
        .filter(models.Student.class_name == class_name)
        .order_by(models.Student.name)
        .all()
    )

    if not students:
        raise HTTPException(status_code=404, detail=f"Tidak ada siswa di kelas {class_name}")

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20*mm,
        leftMargin=20*mm,
        topMargin=20*mm,
        bottomMargin=20*mm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        alignment=TA_CENTER,
        spaceAfter=4*mm,
        textColor=colors.HexColor('#1e293b'),
    )
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Normal'],
        fontSize=10,
        alignment=TA_CENTER,
        spaceAfter=8*mm,
        textColor=colors.HexColor('#64748b'),
    )

    elements = []

    # Title
    elements.append(Paragraph("SMP Negeri 01 Dompu", title_style))
    elements.append(Paragraph(f"Data Siswa Kelas {class_name}", subtitle_style))
    elements.append(Spacer(1, 4*mm))

    # Table header
    table_data = [["No", "Nama Lengkap", "Kelas", "Alamat", "Total Terlambat"]]

    for i, student in enumerate(students, 1):
        table_data.append([
            str(i),
            student.name,
            student.class_name,
            student.address or "-",
            str(student.total_lates),
        ])

    col_widths = [12*mm, 55*mm, 22*mm, 50*mm, 28*mm]
    table = Table(table_data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        # Header
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4f46e5')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        # Body
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('ALIGN', (0, 1), (0, -1), 'CENTER'),   # No column center
        ('ALIGN', (4, 1), (4, -1), 'CENTER'),    # Total Terlambat center
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
        ('TOPPADDING', (0, 1), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))

    elements.append(table)
    elements.append(Spacer(1, 6*mm))

    # Footer with total count
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#64748b'),
    )
    elements.append(Paragraph(f"Total Siswa: <b>{len(students)}</b>", footer_style))

    doc.build(elements)
    buffer.seek(0)

    safe_name = class_name.replace(" ", "_")
    filename = f"Data_Siswa_{safe_name}.pdf"

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
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

@router.get("/lates/today/pdf")
def download_today_lates_pdf(db: Session = Depends(database.get_db)):
    """Generate PDF report of today's late students."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER
    from datetime import datetime, time

    today_start = datetime.combine(datetime.today(), time.min)
    
    lates = (
        db.query(models.LateHistory)
        .filter(models.LateHistory.late_time >= today_start)
        .order_by(models.LateHistory.late_time.asc())
        .all()
    )

    if not lates:
        raise HTTPException(status_code=404, detail="Tidak ada siswa terlambat hari ini")

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20*mm,
        leftMargin=20*mm,
        topMargin=20*mm,
        bottomMargin=20*mm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        alignment=TA_CENTER,
        spaceAfter=4*mm,
        textColor=colors.HexColor('#1e293b'),
    )
    subtitle_style = ParagraphStyle(
        'CustomSubtitle',
        parent=styles['Normal'],
        fontSize=10,
        alignment=TA_CENTER,
        spaceAfter=8*mm,
        textColor=colors.HexColor('#64748b'),
    )

    elements = []
    date_str = datetime.today().strftime("%d %B %Y")
    
    elements.append(Paragraph("SMP Negeri 01 Dompu", title_style))
    elements.append(Paragraph(f"Laporan Keterlambatan Harian - {date_str}", subtitle_style))
    elements.append(Spacer(1, 4*mm))

    table_data = [["No", "Nama Lengkap", "Kelas", "Jam Kedatangan", "Keterangan"]]

    for i, late in enumerate(lates, 1):
        table_data.append([
            str(i),
            late.student.name,
            late.student.class_name,
            late.late_time.strftime("%H:%M:%S"),
            late.notes or "Face Recognition",
        ])

    col_widths = [12*mm, 60*mm, 25*mm, 35*mm, 45*mm]
    table = Table(table_data, colWidths=col_widths, repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4f46e5')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('ALIGN', (0, 1), (0, -1), 'CENTER'),
        ('ALIGN', (2, 1), (3, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
        ('TOPPADDING', (0, 1), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
    ]))

    elements.append(table)
    elements.append(Spacer(1, 6*mm))

    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#64748b'),
    )
    elements.append(Paragraph(f"Total Siswa Terlambat: <b>{len(lates)}</b>", footer_style))

    doc.build(elements)
    buffer.seek(0)

    filename = f"Laporan_Terlambat_{datetime.today().strftime('%Y%m%d')}.pdf"

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

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
