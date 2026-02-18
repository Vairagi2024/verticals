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
import httpx
import bcrypt
import base64
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Constants
JWT_SECRET = os.environ['JWT_SECRET_KEY']
INSTITUTE_CODE = os.environ['INSTITUTE_CODE']
EMERGENT_LLM_KEY = os.environ['EMERGENT_LLM_KEY']

# ===== MODELS =====

class User(BaseModel):
    user_id: str
    email: str
    name: str
    role: str  # student, teacher, admin
    grade: Optional[int] = None  # 11 or 12
    picture: Optional[str] = None
    created_at: datetime

class SessionDataResponse(BaseModel):
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    session_token: str

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    grade: int  # 11 or 12
    institute_code: str

class LoginRequest(BaseModel):
    email: str
    password: str

class Subject(BaseModel):
    subject_id: str
    name: str
    description: str
    grade: int
    icon: str

class Content(BaseModel):
    content_id: str
    subject_id: str
    type: str  # video_file, video_link, photo, document
    title: str
    description: Optional[str] = None
    data: Optional[str] = None  # base64 for files
    url: Optional[str] = None  # for links
    uploaded_by: str
    created_at: datetime

class Quiz(BaseModel):
    quiz_id: str
    subject_id: str
    title: str
    description: Optional[str] = None
    questions: List[dict]  # [{question, options: [a,b,c,d], correct: 0}]
    time_limit_mins: int
    created_by: str
    created_at: datetime

class QuizAttempt(BaseModel):
    attempt_id: str
    quiz_id: str
    student_id: str
    answers: List[int]  # indices of selected options
    score: int
    total: int
    completed_at: datetime

# ===== AUTH HELPERS =====

async def get_current_user(request: Request) -> Optional[User]:
    # Check session_token from cookie first
    session_token = request.cookies.get("session_token")
    
    # Fallback to Authorization header
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.replace("Bearer ", "")
    
    if not session_token:
        return None
    
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        return None
    
    # Check expiry with timezone-aware comparison
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

async def require_teacher(request: Request) -> User:
    user = await require_auth(request)
    if user.role not in ["teacher", "admin"]:
        raise HTTPException(status_code=403, detail="Teacher access required")
    return user

# ===== AUTH ENDPOINTS =====

@api_router.post("/auth/register")
async def register(data: RegisterRequest):
    # Validate institute code
    if data.institute_code != INSTITUTE_CODE:
        raise HTTPException(status_code=400, detail="Invalid institute code")
    
    # Check if user exists
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    password_hash = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
    
    # Create user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    created_at = datetime.now(timezone.utc)
    user_doc = {
        "user_id": user_id,
        "email": data.email,
        "name": data.name,
        "password_hash": password_hash,
        "role": "student",
        "grade": data.grade,
        "picture": None,
        "created_at": created_at
    }
    
    await db.users.insert_one(user_doc)
    
    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
    session_doc = {
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    }
    await db.user_sessions.insert_one(session_doc)
    
    # Prepare user response
    user_response = {
        "user_id": user_id,
        "email": data.email,
        "name": data.name,
        "role": "student",
        "grade": data.grade,
        "picture": None,
        "created_at": created_at.isoformat()
    }
    response = JSONResponse(content={"user": user_response, "session_token": session_token})
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    return response

@api_router.post("/auth/login")
async def login(data: LoginRequest):
    user_doc = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    if not bcrypt.checkpw(data.password.encode(), user_doc["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create session
    session_token = f"session_{uuid.uuid4().hex}"
    session_doc = {
        "user_id": user_doc["user_id"],
        "session_token": session_token,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    }
    await db.user_sessions.insert_one(session_doc)
    
    user_doc.pop("password_hash")
    response = JSONResponse(content={"user": user_doc, "session_token": session_token})
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    return response

@api_router.get("/auth/google")
async def google_auth_callback(session_id: str):
    # Exchange session_id for user data
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Invalid session")
        
        user_data = response.json()
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data["email"]}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
    else:
        # Create new user with default grade 11
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        new_user = {
            "user_id": user_id,
            "email": user_data["email"],
            "name": user_data["name"],
            "role": "student",
            "grade": 11,
            "picture": user_data.get("picture"),
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(new_user)
    
    # Create session with the session_token from response
    session_doc = {
        "user_id": user_id,
        "session_token": user_data["session_token"],
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "created_at": datetime.now(timezone.utc)
    }
    await db.user_sessions.insert_one(session_doc)
    
    # Get full user data
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    user.pop("password_hash", None)
    
    response = JSONResponse(content={"user": user, "session_token": user_data["session_token"]})
    response.set_cookie(
        key="session_token",
        value=user_data["session_token"],
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    return response

@api_router.get("/auth/me")
async def get_me(user: User = Depends(require_auth)):
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie("session_token")
    return {"message": "Logged out"}

# ===== SUBJECT ENDPOINTS =====

@api_router.get("/subjects")
async def get_subjects(user: User = Depends(require_auth)):
    subjects = await db.subjects.find({"grade": user.grade}, {"_id": 0}).to_list(100)
    return subjects

# ===== CONTENT ENDPOINTS =====

@api_router.post("/content")
async def create_content(
    subject_id: str = Form(...),
    type: str = Form(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    url: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    user: User = Depends(require_teacher)
):
    content_id = f"content_{uuid.uuid4().hex[:12]}"
    
    data = None
    if file:
        file_content = await file.read()
        data = base64.b64encode(file_content).decode()
    
    content_doc = {
        "content_id": content_id,
        "subject_id": subject_id,
        "type": type,
        "title": title,
        "description": description,
        "data": data,
        "url": url,
        "uploaded_by": user.user_id,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.content.insert_one(content_doc)
    content_doc.pop("_id", None)
    return content_doc

@api_router.get("/content/{subject_id}")
async def get_content(subject_id: str, user: User = Depends(require_auth)):
    content_list = await db.content.find(
        {"subject_id": subject_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    return content_list

@api_router.delete("/content/{content_id}")
async def delete_content(content_id: str, user: User = Depends(require_teacher)):
    result = await db.content.delete_one({"content_id": content_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Content not found")
    return {"message": "Content deleted"}

# ===== QUIZ ENDPOINTS =====

@api_router.post("/quiz")
async def create_quiz(
    subject_id: str = Form(...),
    title: str = Form(...),
    description: Optional[str] = Form(None),
    questions_json: str = Form(...),  # JSON string
    time_limit_mins: int = Form(...),
    user: User = Depends(require_teacher)
):
    import json
    questions = json.loads(questions_json)
    
    quiz_id = f"quiz_{uuid.uuid4().hex[:12]}"
    quiz_doc = {
        "quiz_id": quiz_id,
        "subject_id": subject_id,
        "title": title,
        "description": description,
        "questions": questions,
        "time_limit_mins": time_limit_mins,
        "created_by": user.user_id,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.quizzes.insert_one(quiz_doc)
    quiz_doc.pop("_id", None)
    return quiz_doc

@api_router.get("/quiz/{subject_id}")
async def get_quizzes(subject_id: str, user: User = Depends(require_auth)):
    quizzes = await db.quizzes.find(
        {"subject_id": subject_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    return quizzes

@api_router.get("/quiz/detail/{quiz_id}")
async def get_quiz_detail(quiz_id: str, user: User = Depends(require_auth)):
    quiz = await db.quizzes.find_one({"quiz_id": quiz_id}, {"_id": 0})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz

@api_router.post("/quiz/attempt")
async def submit_quiz(
    quiz_id: str = Form(...),
    answers_json: str = Form(...),  # JSON array
    user: User = Depends(require_auth)
):
    import json
    answers = json.loads(answers_json)
    
    # Get quiz
    quiz = await db.quizzes.find_one({"quiz_id": quiz_id}, {"_id": 0})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    # Calculate score
    score = 0
    for i, answer in enumerate(answers):
        if i < len(quiz["questions"]):
            if answer == quiz["questions"][i]["correct"]:
                score += 1
    
    # Save attempt
    attempt_id = f"attempt_{uuid.uuid4().hex[:12]}"
    attempt_doc = {
        "attempt_id": attempt_id,
        "quiz_id": quiz_id,
        "student_id": user.user_id,
        "answers": answers,
        "score": score,
        "total": len(quiz["questions"]),
        "completed_at": datetime.now(timezone.utc)
    }
    
    await db.quiz_attempts.insert_one(attempt_doc)
    attempt_doc.pop("_id", None)
    return attempt_doc

@api_router.get("/quiz/results/{student_id}")
async def get_student_results(student_id: str, user: User = Depends(require_auth)):
    # Students can only see their own results
    if user.role == "student" and user.user_id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    attempts = await db.quiz_attempts.find(
        {"student_id": student_id},
        {"_id": 0}
    ).sort("completed_at", -1).to_list(1000)
    
    # Enrich with quiz info
    for attempt in attempts:
        quiz = await db.quizzes.find_one({"quiz_id": attempt["quiz_id"]}, {"_id": 0})
        if quiz:
            attempt["quiz_title"] = quiz["title"]
            attempt["subject_id"] = quiz["subject_id"]
    
    return attempts

# ===== AI QUIZ GENERATION =====

@api_router.post("/ai/generate-quiz")
async def generate_quiz_ai(
    subject_id: str = Form(...),
    topic: str = Form(...),
    num_questions: int = Form(5),
    user: User = Depends(require_teacher)
):
    # Get subject info
    subject = await db.subjects.find_one({"subject_id": subject_id}, {"_id": 0})
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    
    # Generate quiz using AI
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"quiz_gen_{uuid.uuid4().hex[:8]}",
        system_message="You are an expert quiz creator for coaching institutes."
    ).with_model("openai", "gpt-5.2")
    
    prompt = f"""Create {num_questions} multiple choice questions for Grade {subject['grade']} {subject['name']} on the topic: {topic}

Return ONLY a valid JSON array with this exact structure:
[
  {{
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0
  }}
]

Where 'correct' is the index (0-3) of the correct answer.
No additional text, just the JSON array."""
    
    user_message = UserMessage(text=prompt)
    response = await chat.send_message(user_message)
    
    # Parse response
    import json
    try:
        # Clean response
        clean_response = response.strip()
        if clean_response.startswith("```json"):
            clean_response = clean_response[7:]
        if clean_response.startswith("```"):
            clean_response = clean_response[3:]
        if clean_response.endswith("```"):
            clean_response = clean_response[:-3]
        clean_response = clean_response.strip()
        
        questions = json.loads(clean_response)
        return {"questions": questions}
    except:
        raise HTTPException(status_code=500, detail="Failed to parse AI response")

# Initialize default data
@app.on_event("startup")
async def startup_event():
    # Create default subjects if not exist
    subjects = await db.subjects.count_documents({})
    if subjects == 0:
        default_subjects = [
            {"subject_id": "phys11", "name": "Physics", "description": "Physics for Grade 11", "grade": 11, "icon": "atom"},
            {"subject_id": "chem11", "name": "Chemistry", "description": "Chemistry for Grade 11", "grade": 11, "icon": "flask"},
            {"subject_id": "math11", "name": "Mathematics", "description": "Mathematics for Grade 11", "grade": 11, "icon": "calculator"},
            {"subject_id": "phys12", "name": "Physics", "description": "Physics for Grade 12", "grade": 12, "icon": "atom"},
            {"subject_id": "chem12", "name": "Chemistry", "description": "Chemistry for Grade 12", "grade": 12, "icon": "flask"},
            {"subject_id": "math12", "name": "Mathematics", "description": "Mathematics for Grade 12", "grade": 12, "icon": "calculator"},
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
