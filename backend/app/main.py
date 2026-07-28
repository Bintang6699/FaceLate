from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .routers import auth as auth_router
from .routers import students as students_router
from .routers import faces as faces_router
from .routers import attendance as attendance_router
from .routers import reports as reports_router

app = FastAPI(
    title="FaceLate AI API",
    description="Backend API for FaceLate AI (Face Recognition Tardiness Recording)",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router.router)
app.include_router(students_router.router)
app.include_router(faces_router.router)
app.include_router(attendance_router.router)
app.include_router(reports_router.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to FaceLate AI API"}
