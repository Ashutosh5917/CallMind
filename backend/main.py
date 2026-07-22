import asyncio
from datetime import datetime, timedelta
from typing import List
from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.database import SessionLocal, Reminder, CallLog, User, init_db
from backend.nlp import parse_natural_language

app = FastAPI(title="CallMind Backend")

# Enable CORS for local react development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database
init_db()

# Pydantic schemas
class ReminderCreate(BaseModel):
    title: str
    notes: str | None = None
    due_time: str # ISO format string
    recurrence: str = "once" # once, daily, weekly, monthly
    category: str = "Personal" # Health, Finance, Work, Personal
    priority: str = "Medium" # Low, Medium, High
    enable_escalation: bool = False
    trusted_contact_phone: str | None = None
    assigned_to_phone: str | None = None
    creator_phone: str | None = None

class ReminderResponse(BaseModel):
    id: int
    title: str
    notes: str | None = None
    due_time: datetime
    recurrence: str
    category: str
    priority: str
    status: str
    snooze_count: int
    enable_escalation: bool
    trusted_contact_phone: str | None = None
    assigned_to_phone: str | None = None
    creator_phone: str | None = None

    class Config:
        from_attributes = True

class CallOutcome(BaseModel):
    outcome: str # Completed, Snoozed, Missed, Declined
    notes: str = ""

class NLPRequest(BaseModel):
    text: str

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.loop = None

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"WebSocket client connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"WebSocket client disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, data: dict):
        # Send data to all active connections
        for connection in self.active_connections:
            try:
                await connection.send_json(data)
            except Exception as e:
                print(f"Error sending message over websocket: {e}")

manager = ConnectionManager()

# Database Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.on_event("startup")
def startup_event():
    # Cache event loop in connection manager so background threads can schedule tasks
    manager.loop = asyncio.get_event_loop()

# API Endpoints
@app.post("/api/nlp")
def parse_nlp(payload: NLPRequest):
    return parse_natural_language(payload.text)

@app.get("/api/reminders", response_model=List[ReminderResponse])
def get_reminders(db: Session = Depends(get_db)):
    # Return active, completed, snoozed and missed reminders
    return db.query(Reminder).order_by(Reminder.due_time.asc()).all()

@app.post("/api/reminders", response_model=ReminderResponse)
async def create_reminder(reminder_in: ReminderCreate, db: Session = Depends(get_db)):
    try:
        due = datetime.fromisoformat(reminder_in.due_time)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid due_time format. Use ISO format.")
        
    reminder = Reminder(
        title=reminder_in.title,
        notes=reminder_in.notes,
        due_time=due,
        recurrence=reminder_in.recurrence,
        category=reminder_in.category,
        priority=reminder_in.priority,
        enable_escalation=reminder_in.enable_escalation,
        trusted_contact_phone=reminder_in.trusted_contact_phone,
        assigned_to_phone=reminder_in.assigned_to_phone,
        creator_phone=reminder_in.creator_phone,
        status="Active",
        snooze_count=0
    )
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    
    # Broadcast refresh event
    await manager.broadcast({"type": "refresh_reminders"})
    return reminder

@app.put("/api/reminders/{reminder_id}", response_model=ReminderResponse)
async def update_reminder(reminder_id: int, reminder_in: ReminderCreate, db: Session = Depends(get_db)):
    reminder = db.query(Reminder).filter(Reminder.id == reminder_id).first()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
        
    try:
        due = datetime.fromisoformat(reminder_in.due_time)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid due_time format. Use ISO format.")

    reminder.title = reminder_in.title
    reminder.notes = reminder_in.notes
    reminder.due_time = due
    reminder.recurrence = reminder_in.recurrence
    reminder.category = reminder_in.category
    reminder.priority = reminder_in.priority
    reminder.enable_escalation = reminder_in.enable_escalation
    reminder.trusted_contact_phone = reminder_in.trusted_contact_phone
    reminder.assigned_to_phone = reminder_in.assigned_to_phone
    
    db.commit()
    db.refresh(reminder)
    
    # Broadcast refresh event
    await manager.broadcast({"type": "refresh_reminders"})
    return reminder

@app.delete("/api/reminders/{reminder_id}")
async def delete_reminder(reminder_id: int, db: Session = Depends(get_db)):
    reminder = db.query(Reminder).filter(Reminder.id == reminder_id).first()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    
    # Clean active call registry if deleting
    from backend.scheduler import active_calls
    if reminder_id in active_calls:
        del active_calls[reminder_id]

    db.delete(reminder)
    db.commit()
    
    # Broadcast refresh event
    await manager.broadcast({"type": "refresh_reminders"})
    return {"status": "success"}

@app.post("/api/reminders/{reminder_id}/call-completed")
def call_completed(reminder_id: int, payload: CallOutcome, db: Session = Depends(get_db)):
    from backend.scheduler import scheduler
    # Delegate processing to the scheduler outcome handler
    scheduler.handle_call_outcome(reminder_id, payload.outcome, payload.notes, db)
    return {"status": "success"}

@app.get("/api/test-call/{reminder_id}")
def trigger_test_call(reminder_id: int, db: Session = Depends(get_db)):
    """Forces a reminder to trigger a call immediately for testing/demoing."""
    reminder = db.query(Reminder).filter(Reminder.id == reminder_id).first()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    
    # Set due time to now and save
    reminder.due_time = datetime.now()
    reminder.status = "Active"
    reminder.snooze_count = 0
    db.commit()
    
    # Clear any active call records so it runs immediately
    from backend.scheduler import active_calls
    if reminder_id in active_calls:
        del active_calls[reminder_id]
        
    return {"status": "success", "message": f"Test call scheduled for reminder: {reminder.title}"}

@app.get("/api/insights")
def get_insights(db: Session = Depends(get_db)):
    # Fetch Call Logs
    logs = db.query(CallLog).order_by(CallLog.call_time.desc()).limit(15).all()
    logs_data = []
    for l in logs:
        # Get title
        rem = db.query(Reminder).filter(Reminder.id == l.reminder_id).first()
        title = rem.title if rem else "Deleted Reminder"
        logs_data.append({
            "id": l.id,
            "title": title,
            "call_time": l.call_time.isoformat(),
            "call_status": l.call_status,
            "action_taken": l.action_taken
        })

    # Stats: total reminders, completed count, missed count
    total_active = db.query(Reminder).filter(Reminder.status.in_(["Active", "Snoozed"])).count()
    total_completed = db.query(Reminder).filter(Reminder.status == "Completed").count()
    total_missed = db.query(Reminder).filter(Reminder.status == "Missed").count()
    
    # Streaks and insights
    # Calculate streak (simple mock logic: number of consecutive completed reminders in log)
    all_logs = db.query(CallLog).order_by(CallLog.call_time.desc()).all()
    streak = 0
    for log in all_logs:
        if log.call_status == "Completed":
            streak += 1
        elif log.call_status in ["Missed", "Declined"]:
            break # break streak on miss

    # Category breakdown
    categories = ["Health", "Finance", "Work", "Personal"]
    category_counts = {}
    for cat in categories:
        completed = db.query(Reminder).filter(Reminder.category == cat, Reminder.status == "Completed").count()
        total = db.query(Reminder).filter(Reminder.category == cat).count()
        category_counts[cat] = {
            "completed": completed,
            "total": total,
            "rate": round((completed / total * 100), 1) if total > 0 else 0
        }

    return {
        "summary": {
            "active": total_active,
            "completed": total_completed,
            "missed": total_missed,
            "streak": streak
        },
        "category_breakdown": category_counts,
        "recent_logs": logs_data
    }

# WebSockets Endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive, listen for any messages from client
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# Mount static files at the root
import os
from fastapi.staticfiles import StaticFiles

frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
else:
    @app.get("/")
    def read_root():
        return {"message": "CallMind API is running. Frontend build not found. Run 'npm run build' inside frontend directory."}

