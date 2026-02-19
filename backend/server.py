from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, Form
from fastapi.responses import JSONResponse, FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
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
FRONTEND_DIR = ROOT_DIR.parent / "frontend" / "public"
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
    email: str
    password: str
    batch_code: str

class TeacherLoginRequest(BaseModel):
    email: str
    password: str

class StudentRegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    batch_code: str

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
    # Find user by email and batch code
    user_doc = await db.users.find_one({
        "email": data.email,
        "batch_code": data.batch_code,
        "role": "student"
    }, {"_id": 0})
    
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid email or batch code")
    
    # Verify password
    if not bcrypt.checkpw(data.password.encode(), user_doc["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid password")
    
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
            "email": user_doc["email"],
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

@api_router.post("/auth/register/student")
async def register_student(data: StudentRegisterRequest):
    # Check if email exists
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Verify batch exists
    batch = await db.batches.find_one({"batch_code": data.batch_code})
    if not batch:
        raise HTTPException(status_code=400, detail="Invalid batch code")
    
    # Hash password
    password_hash = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
    
    student_id = f"student_{uuid.uuid4().hex[:12]}"
    student_doc = {
        "user_id": student_id,
        "email": data.email,
        "name": data.name,
        "password_hash": password_hash,
        "role": "student",
        "batch_code": data.batch_code,
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(student_doc)
    
    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
    session_doc = {
        "user_id": student_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
        "created_at": datetime.now(timezone.utc)
    }
    await db.user_sessions.insert_one(session_doc)
    
    response = JSONResponse(content={
        "user": {
            "user_id": student_id,
            "name": data.name,
            "email": data.email,
            "role": "student",
            "batch_code": data.batch_code,
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

# ===== ADMIN ENDPOINTS =====

@api_router.post("/admin/batch/create")
async def create_batch(
    batch_code: str = Form(...),
    batch_name: str = Form(...),
    year: int = Form(...),
    user: User = Depends(require_admin)
):
    # Check if batch code exists
    existing = await db.batches.find_one({"batch_code": batch_code})
    if existing:
        raise HTTPException(status_code=400, detail="Batch code already exists")
    
    batch_id = f"batch_{uuid.uuid4().hex[:12]}"
    batch_doc = {
        "batch_id": batch_id,
        "batch_code": batch_code,
        "batch_name": batch_name,
        "year": year,
        "active": True,
        "created_by": user.user_id,
        "created_at": datetime.now(timezone.utc)
    }
    await db.batches.insert_one(batch_doc)
    return {"message": "Batch created", "batch_id": batch_id}

@api_router.get("/admin/batches")
async def get_batches(user: User = Depends(require_admin)):
    batches = await db.batches.find({}, {"_id": 0}).to_list(1000)
    return batches

@api_router.post("/admin/teacher/add")
async def add_teacher(
    name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    subject_id: Optional[str] = Form(None),
    user: User = Depends(require_admin)
):
    # Check if email exists
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    teacher_id = f"teacher_{uuid.uuid4().hex[:12]}"
    
    teacher_doc = {
        "user_id": teacher_id,
        "email": email,
        "name": name,
        "password_hash": password_hash,
        "role": "teacher",
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(teacher_doc)
    
    # Update subject if provided
    if subject_id:
        await db.subjects.update_one(
            {"subject_id": subject_id},
            {"$set": {"teacher_id": teacher_id}}
        )
    
    return {"message": "Teacher added", "teacher_id": teacher_id}

@api_router.post("/admin/student/add")
async def add_student(
    name: str = Form(...),
    mobile: str = Form(...),
    batch_code: str = Form(...),
    user: User = Depends(require_admin)
):
    # Check if mobile exists in this batch
    existing = await db.users.find_one({"mobile": mobile, "batch_code": batch_code})
    if existing:
        raise HTTPException(status_code=400, detail="Student already exists in this batch")
    
    # Verify batch exists
    batch = await db.batches.find_one({"batch_code": batch_code})
    if not batch:
        raise HTTPException(status_code=400, detail="Invalid batch code")
    
    student_id = f"student_{uuid.uuid4().hex[:12]}"
    student_doc = {
        "user_id": student_id,
        "mobile": mobile,
        "name": name,
        "role": "student",
        "batch_code": batch_code,
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(student_doc)
    
    return {"message": "Student added", "student_id": student_id}

@api_router.get("/admin/teachers")
async def get_teachers(user: User = Depends(require_admin)):
    teachers = await db.users.find({"role": "teacher"}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return teachers

@api_router.get("/admin/students")
async def get_students(batch_code: Optional[str] = None, user: User = Depends(require_admin)):
    query = {"role": "student"}
    if batch_code:
        query["batch_code"] = batch_code
    students = await db.users.find(query, {"_id": 0}).to_list(1000)
    return students

@api_router.get("/admin/analytics")
async def get_admin_analytics(user: User = Depends(require_admin)):
    total_students = await db.users.count_documents({"role": "student"})
    total_teachers = await db.users.count_documents({"role": "teacher"})
    total_batches = await db.batches.count_documents({})
    total_tests = await db.tests.count_documents({})
    total_videos = await db.videos.count_documents({})
    
    return {
        "total_students": total_students,
        "total_teachers": total_teachers,
        "total_batches": total_batches,
        "total_tests": total_tests,
        "total_videos": total_videos
    }

# Admin: Get all users (teachers and students)
@api_router.get("/admin/users")
async def get_all_users(user: User = Depends(require_admin)):
    users = await db.users.find(
        {"role": {"$in": ["teacher", "student"]}},
        {"_id": 0, "password_hash": 0}
    ).to_list(10000)
    return users

# Admin: Change password for any user
class ChangePasswordRequest(BaseModel):
    new_password: str

@api_router.put("/admin/users/{user_id}/password")
async def admin_change_password(
    user_id: str,
    data: ChangePasswordRequest,
    user: User = Depends(require_admin)
):
    # Find the target user
    target_user = await db.users.find_one({"user_id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Don't allow changing admin password through this endpoint
    if target_user.get("role") == "admin":
        raise HTTPException(status_code=403, detail="Cannot change admin password through this endpoint")
    
    # Validate password length
    if len(data.new_password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
    
    # Hash new password
    new_password_hash = bcrypt.hashpw(data.new_password.encode(), bcrypt.gensalt()).decode()
    
    # Update password
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"password_hash": new_password_hash}}
    )
    
    # Invalidate all existing sessions for this user
    await db.user_sessions.delete_many({"user_id": user_id})
    
    return {"message": f"Password changed successfully for user {target_user.get('name', user_id)}"}

# ===== CONTENT MANAGEMENT =====

@api_router.get("/content/subjects")
async def get_subjects(user: User = Depends(require_auth)):
    subjects = await db.subjects.find({}, {"_id": 0}).to_list(100)
    return subjects

@api_router.post("/content/chapter/create")
async def create_chapter(
    subject_id: str = Form(...),
    chapter_name: str = Form(...),
    chapter_number: int = Form(...),
    description: Optional[str] = Form(None),
    user: User = Depends(require_teacher_or_admin)
):
    chapter_id = f"chapter_{uuid.uuid4().hex[:12]}"
    chapter_doc = {
        "chapter_id": chapter_id,
        "subject_id": subject_id,
        "chapter_name": chapter_name,
        "chapter_number": chapter_number,
        "description": description
    }
    await db.chapters.insert_one(chapter_doc)
    return {"message": "Chapter created", "chapter_id": chapter_id}

@api_router.get("/content/chapters/{subject_id}")
async def get_chapters(subject_id: str, user: User = Depends(require_auth)):
    chapters = await db.chapters.find(
        {"subject_id": subject_id},
        {"_id": 0}
    ).sort("chapter_number", 1).to_list(1000)
    return chapters

@api_router.post("/content/topic/create")
async def create_topic(
    chapter_id: str = Form(...),
    topic_name: str = Form(...),
    topic_number: int = Form(...),
    description: Optional[str] = Form(None),
    user: User = Depends(require_teacher_or_admin)
):
    topic_id = f"topic_{uuid.uuid4().hex[:12]}"
    topic_doc = {
        "topic_id": topic_id,
        "chapter_id": chapter_id,
        "topic_name": topic_name,
        "topic_number": topic_number,
        "description": description
    }
    await db.topics.insert_one(topic_doc)
    return {"message": "Topic created", "topic_id": topic_id}

@api_router.get("/content/topics/{chapter_id}")
async def get_topics(chapter_id: str, user: User = Depends(require_auth)):
    topics = await db.topics.find(
        {"chapter_id": chapter_id},
        {"_id": 0}
    ).sort("topic_number", 1).to_list(1000)
    return topics

@api_router.post("/content/video/upload")
async def upload_video(
    topic_id: str = Form(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    video_type: str = Form(...),
    video_url: Optional[str] = Form(None),
    duration: Optional[int] = Form(None),
    file: Optional[UploadFile] = File(None),
    user: User = Depends(require_teacher_or_admin)
):
    video_id = f"video_{uuid.uuid4().hex[:12]}"
    video_data = None
    
    if video_type == "upload" and file:
        content = await file.read()
        video_data = base64.b64encode(content).decode()
    
    video_doc = {
        "video_id": video_id,
        "topic_id": topic_id,
        "title": title,
        "description": description,
        "video_type": video_type,
        "video_url": video_url,
        "video_data": video_data,
        "duration": duration,
        "uploaded_by": user.user_id,
        "created_at": datetime.now(timezone.utc)
    }
    await db.videos.insert_one(video_doc)
    return {"message": "Video uploaded", "video_id": video_id}

@api_router.get("/content/videos/{topic_id}")
async def get_videos(topic_id: str, user: User = Depends(require_auth)):
    videos = await db.videos.find(
        {"topic_id": topic_id},
        {"_id": 0, "video_data": 0}
    ).to_list(1000)
    return videos

@api_router.get("/content/video/{video_id}")
async def get_video_detail(video_id: str, user: User = Depends(require_auth)):
    video = await db.videos.find_one({"video_id": video_id}, {"_id": 0})
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return video

@api_router.post("/content/pdf/upload")
async def upload_pdf(
    topic_id: str = Form(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    file: UploadFile = File(...),
    user: User = Depends(require_teacher_or_admin)
):
    pdf_id = f"pdf_{uuid.uuid4().hex[:12]}"
    content = await file.read()
    pdf_data = base64.b64encode(content).decode()
    
    pdf_doc = {
        "pdf_id": pdf_id,
        "topic_id": topic_id,
        "title": title,
        "description": description,
        "pdf_data": pdf_data,
        "uploaded_by": user.user_id,
        "created_at": datetime.now(timezone.utc)
    }
    await db.pdfs.insert_one(pdf_doc)
    return {"message": "PDF uploaded", "pdf_id": pdf_id}

@api_router.get("/content/pdfs/{topic_id}")
async def get_pdfs(topic_id: str, user: User = Depends(require_auth)):
    pdfs = await db.pdfs.find(
        {"topic_id": topic_id},
        {"_id": 0, "pdf_data": 0}
    ).to_list(1000)
    return pdfs

@api_router.get("/content/pdf/{pdf_id}")
async def get_pdf_detail(pdf_id: str, user: User = Depends(require_auth)):
    pdf = await db.pdfs.find_one({"pdf_id": pdf_id}, {"_id": 0})
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found")
    return pdf

# ===== TEST SYSTEM =====

@api_router.post("/test/create")
async def create_test(
    test_type: str = Form(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    chapter_id: Optional[str] = Form(None),
    subject_id: Optional[str] = Form(None),
    duration_mins: int = Form(...),
    total_marks: int = Form(...),
    passing_marks: int = Form(...),
    questions_json: str = Form(...),
    user: User = Depends(require_teacher_or_admin)
):
    import json
    questions_data = json.loads(questions_json)
    
    test_id = f"test_{uuid.uuid4().hex[:12]}"
    test_doc = {
        "test_id": test_id,
        "chapter_id": chapter_id,
        "subject_id": subject_id,
        "test_type": test_type,
        "title": title,
        "description": description,
        "duration_mins": duration_mins,
        "total_marks": total_marks,
        "passing_marks": passing_marks,
        "created_by": user.user_id,
        "created_at": datetime.now(timezone.utc)
    }
    await db.tests.insert_one(test_doc)
    
    # Insert questions
    for q_data in questions_data:
        question_id = f"question_{uuid.uuid4().hex[:12]}"
        question_doc = {
            "question_id": question_id,
            "test_id": test_id,
            "question_text": q_data["question_text"],
            "option_a": q_data["option_a"],
            "option_b": q_data["option_b"],
            "option_c": q_data["option_c"],
            "option_d": q_data["option_d"],
            "correct_answer": q_data["correct_answer"],
            "marks": q_data.get("marks", 4),
            "solution_text": q_data.get("solution_text"),
            "solution_image": q_data.get("solution_image")
        }
        await db.questions.insert_one(question_doc)
    
    return {"message": "Test created", "test_id": test_id}

@api_router.get("/tests")
async def get_tests(chapter_id: Optional[str] = None, subject_id: Optional[str] = None, user: User = Depends(require_auth)):
    query = {}
    if chapter_id:
        query["chapter_id"] = chapter_id
    if subject_id:
        query["subject_id"] = subject_id
    
    tests = await db.tests.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return tests

@api_router.get("/test/{test_id}")
async def get_test(test_id: str, user: User = Depends(require_auth)):
    test = await db.tests.find_one({"test_id": test_id}, {"_id": 0})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    questions = await db.questions.find(
        {"test_id": test_id},
        {"_id": 0, "correct_answer": 0, "solution_text": 0, "solution_image": 0}
    ).to_list(1000)
    
    test["questions"] = questions
    return test

@api_router.post("/test/submit")
async def submit_test(
    test_id: str = Form(...),
    answers_json: str = Form(...),
    time_taken: int = Form(...),
    user: User = Depends(require_auth)
):
    import json
    answers = json.loads(answers_json)
    
    # Get all questions
    questions = await db.questions.find({"test_id": test_id}, {"_id": 0}).to_list(1000)
    
    # Calculate score
    score = 0
    for q in questions:
        q_id = q["question_id"]
        if q_id in answers and answers[q_id] == q["correct_answer"]:
            score += q["marks"]
    
    # Calculate rank
    existing_attempts = await db.test_attempts.find({"test_id": test_id}).sort("score", -1).to_list(10000)
    rank = 1
    for attempt in existing_attempts:
        if attempt["score"] > score:
            rank += 1
        elif attempt["score"] == score and attempt["time_taken"] < time_taken:
            rank += 1
    
    # Save attempt
    attempt_id = f"attempt_{uuid.uuid4().hex[:12]}"
    attempt_doc = {
        "attempt_id": attempt_id,
        "test_id": test_id,
        "student_id": user.user_id,
        "answers": answers,
        "score": score,
        "rank": rank,
        "time_taken": time_taken,
        "completed_at": datetime.now(timezone.utc)
    }
    await db.test_attempts.insert_one(attempt_doc)
    
    # Update ranks for all attempts
    all_attempts = await db.test_attempts.find({"test_id": test_id}).sort([("score", -1), ("time_taken", 1)]).to_list(10000)
    for idx, att in enumerate(all_attempts):
        await db.test_attempts.update_one(
            {"attempt_id": att["attempt_id"]},
            {"$set": {"rank": idx + 1}}
        )
    
    return {
        "message": "Test submitted",
        "score": score,
        "rank": rank,
        "attempt_id": attempt_id
    }

@api_router.get("/test/leaderboard/{test_id}")
async def get_leaderboard(test_id: str, user: User = Depends(require_auth)):
    attempts = await db.test_attempts.find(
        {"test_id": test_id},
        {"_id": 0}
    ).sort([("score", -1), ("time_taken", 1)]).to_list(100)
    
    # Enrich with student names
    for attempt in attempts:
        student = await db.users.find_one({"user_id": attempt["student_id"]}, {"_id": 0})
        if student:
            attempt["student_name"] = student["name"]
    
    return attempts

@api_router.get("/student/results")
async def get_student_results(user: User = Depends(require_auth)):
    if user.role != "student":
        raise HTTPException(status_code=403, detail="Student access only")
    
    attempts = await db.test_attempts.find(
        {"student_id": user.user_id},
        {"_id": 0}
    ).sort("completed_at", -1).to_list(1000)
    
    # Enrich with test info
    for attempt in attempts:
        test = await db.tests.find_one({"test_id": attempt["test_id"]}, {"_id": 0})
        if test:
            attempt["test_title"] = test["title"]
            attempt["total_marks"] = test["total_marks"]
    
    return attempts

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

# ===== STATIC FILE SERVING =====
# Serve HTML pages from frontend/public directory under /api/ prefix

@api_router.get("/page/{filename}")
async def serve_page(filename: str):
    """Serve HTML pages - access via /api/page/index, /api/page/dashboard etc"""
    file_path = FRONTEND_DIR / f"{filename}.html"
    if file_path.exists():
        return FileResponse(file_path, media_type="text/html")
    raise HTTPException(status_code=404, detail="Page not found")

@api_router.get("/home")
async def serve_home():
    """Serve home page - access via /api/home"""
    file_path = FRONTEND_DIR / "index.html"
    if file_path.exists():
        return FileResponse(file_path, media_type="text/html")
    return HTMLResponse("<h1>Welcome to Vertical Studies</h1>")

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
