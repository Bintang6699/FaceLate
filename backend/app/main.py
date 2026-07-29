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

# CORS configuration — list specific frontend origins
# (wildcard '*' is not allowed together with allow_credentials=True by browsers)
allowed_origins = [
    "http://localhost:3000",
    "https://face-late-miqp.vercel.app",
]
# Allow extra origins via env var (comma-separated)
if hasattr(settings, "FRONTEND_URL") and settings.FRONTEND_URL:
    for origin in settings.FRONTEND_URL.split(","):
        origin = origin.strip()
        if origin and origin not in allowed_origins:
            allowed_origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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
