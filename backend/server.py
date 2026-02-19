from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, Form
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client['vertical_studies']

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Constants
JWT_SECRET = os.environ['JWT_SECRET_KEY']
ADMIN_EMAIL = "Chemistryby.sandeep@gmail.com"
ADMIN_PASSWORD_HASH = bcrypt.hashpw("Vairagi@2024".encode(), bcrypt.gensalt()).decode()
ADMIN_NAME = "Sandeep Vaishnava"

# ===== MODELS =====

class User(BaseModel):
    user_id: str
    email: Optional[str] = None
    mobile: Optional[str] = None
    name: str
    role: str  # admin, teacher, student
    batch_code: Optional[str] = None
    profile_pic: Optional[str] = None
    created_at: datetime

class StudentLoginRequest(BaseModel):
    mobile: str
    batch_code: str

class TeacherLoginRequest(BaseModel):
    email: str
    password: str

class Batch(BaseModel):
    batch_id: str
    batch_code: str
    batch_name: str
    year: int
    active: bool
    created_by: str
    created_at: datetime

class Subject(BaseModel):
    subject_id: str
    name: str
    teacher_name: str
    teacher_id: Optional[str] = None
    description: str
    icon: str
    color: str

class Chapter(BaseModel):
    chapter_id: str
    subject_id: str
    chapter_name: str
    chapter_number: int
    description: Optional[str] = None

class Topic(BaseModel):
    topic_id: str
    chapter_id: str
    topic_name: str
    topic_number: int
    description: Optional[str] = None

class Video(BaseModel):
    video_id: str
    topic_id: str
    title: str
    description: Optional[str] = None
    video_type: str  # upload or youtube
    video_url: Optional[str] = None
    video_data: Optional[str] = None
    duration: Optional[int] = None
    uploaded_by: str
    created_at: datetime

class PDF(BaseModel):
    pdf_id: str
    topic_id: str
    title: str
    description: Optional[str] = None
    pdf_data: str
    uploaded_by: str
    created_at: datetime

class Test(BaseModel):
    test_id: str
    chapter_id: Optional[str] = None
    subject_id: Optional[str] = None
    test_type: str  # chapter or full
    title: str
    description: Optional[str] = None
    duration_mins: int
    total_marks: int
    passing_marks: int
    created_by: str
    created_at: datetime

class Question(BaseModel):
    question_id: str
    test_id: str
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_answer: int  # 0-3
    marks: int
    solution_text: Optional[str] = None
    solution_image: Optional[str] = None

# ===== AUTH HELPERS =====

async def get_current_user(request: Request) -> Optional[User]:
    session_token = request.cookies.get("session_token")
    
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.replace("Bearer ", "")
    
    if not session_token:
        return None
    
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        return None
    
    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at <= datetime.now(timezone.utc):
        return None
    
    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if user_doc:
        return User(**user_doc)
    return None

async def require_auth(request: Request) -> User:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

async def require_admin(request: Request) -> User:
    user = await require_auth(request)
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def require_teacher_or_admin(request: Request) -> User:
    user = await require_auth(request)
    if user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Teacher or admin access required")
    return user

# ===== AUTH ENDPOINTS =====

@api_router.post("/auth/login/student")
async def login_student(data: StudentLoginRequest):
    # Find user by mobile and batch code
    user_doc = await db.users.find_one({
        "mobile": data.mobile,
        "batch_code": data.batch_code,
        "role": "student"
    }, {"_id": 0})
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid mobile number or batch code")
    
    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
    session_doc = {
        "user_id": user_doc["user_id"],
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
        "created_at": datetime.now(timezone.utc)
    }
    await db.user_sessions.insert_one(session_doc)
    
    response = JSONResponse(content={
        "user": {
            "user_id": user_doc["user_id"],
            "name": user_doc["name"],
            "mobile": user_doc["mobile"],
            "role": user_doc["role"],
            "batch_code": user_doc.get("batch_code"),
        },
        "session_token": session_token
    })
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=30 * 24 * 60 * 60
    )
    return response

@api_router.post("/auth/login/teacher")
async def login_teacher(data: TeacherLoginRequest):
    user_doc = await db.users.find_one({"email": data.email, "role": "teacher"}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not bcrypt.checkpw(data.password.encode(), user_doc["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    session_token = f"session_{uuid.uuid4().hex}"
    session_doc = {
        "user_id": user_doc["user_id"],
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
        "created_at": datetime.now(timezone.utc)
    }
    await db.user_sessions.insert_one(session_doc)
    
    response = JSONResponse(content={
        "user": {
            "user_id": user_doc["user_id"],
            "name": user_doc["name"],
            "email": user_doc["email"],
            "role": user_doc["role"],
        },
        "session_token": session_token
    })
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=30 * 24 * 60 * 60
    )
    return response

@api_router.post("/auth/login/admin")
async def login_admin(data: TeacherLoginRequest):
    user_doc = await db.users.find_one({"email": data.email, "role": "admin"}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not bcrypt.checkpw(data.password.encode(), user_doc["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    session_token = f"session_{uuid.uuid4().hex}"
    session_doc = {
        "user_id": user_doc["user_id"],
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
        "created_at": datetime.now(timezone.utc)
    }
    await db.user_sessions.insert_one(session_doc)
    
    response = JSONResponse(content={
        "user": {
            "user_id": user_doc["user_id"],
            "name": user_doc["name"],
            "email": user_doc["email"],
            "role": user_doc["role"],
        },
        "session_token": session_token
    })
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=30 * 24 * 60 * 60
    )
    return response

@api_router.get("/auth/me")
async def get_me(user: User = Depends(require_auth)):
    return user

@api_router.post("/auth/logout")
async def logout(request: Request):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    return {"message": "Logged out"}

# Initialize default data
@app.on_event("startup")
async def startup_event():
    # Create admin user if not exists
    admin_exists = await db.users.find_one({"email": ADMIN_EMAIL})
    if not admin_exists:
        admin_user = {
            "user_id": f"admin_{uuid.uuid4().hex[:12]}",
            "email": ADMIN_EMAIL,
            "name": ADMIN_NAME,
            "password_hash": ADMIN_PASSWORD_HASH,
            "role": "admin",
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(admin_user)
        print(f"✅ Admin user created: {ADMIN_EMAIL}")
    
    # Create default subjects
    subjects_count = await db.subjects.count_documents({})
    if subjects_count == 0:
        default_subjects = [
            {
                "subject_id": "physics",
                "name": "Physics",
                "teacher_name": "Jatin Goyal",
                "teacher_id": None,
                "description": "Complete Physics course for JEE/NEET",
                "icon": "atom",
                "color": "#FF6B6B"
            },
            {
                "subject_id": "chemistry",
                "name": "Chemistry",
                "teacher_name": "Sandeep Vaishnava",
                "teacher_id": None,
                "description": "Complete Chemistry course for JEE/NEET",
                "icon": "flask",
                "color": "#4ECDC4"
            },
            {
                "subject_id": "mathematics",
                "name": "Mathematics",
                "teacher_name": "Binay Singh",
                "teacher_id": None,
                "description": "Complete Mathematics course for JEE/NEET",
                "icon": "calculator",
                "color": "#95E1D3"
            },
        ]
        await db.subjects.insert_many(default_subjects)
        print("✅ Default subjects created")

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
