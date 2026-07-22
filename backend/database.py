import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

DATABASE_URL = "sqlite:///./callmind.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    phone_number = Column(String, unique=True, index=True, nullable=False)

class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    notes = Column(String, nullable=True)
    due_time = Column(DateTime, nullable=False)
    recurrence = Column(String, default="once")  # once, daily, weekly, monthly
    category = Column(String, default="Personal")  # Health, Finance, Work, Personal
    priority = Column(String, default="Medium")  # Low, Medium, High
    status = Column(String, default="Active")  # Active, Completed, Snoozed, Missed
    snooze_count = Column(Integer, default=0)
    max_attempts = Column(Integer, default=3)
    
    assigned_to_phone = Column(String, nullable=True)
    creator_phone = Column(String, nullable=True)
    
    enable_escalation = Column(Boolean, default=False)
    trusted_contact_phone = Column(String, nullable=True)

    logs = relationship("CallLog", back_populates="reminder", cascade="all, delete-orphan")

class CallLog(Base):
    __tablename__ = "call_logs"

    id = Column(Integer, primary_key=True, index=True)
    reminder_id = Column(Integer, ForeignKey("reminders.id"), nullable=False)
    call_time = Column(DateTime, default=datetime.utcnow)
    call_status = Column(String, nullable=False)  # Answered, Missed, Snoozed, Escalated
    action_taken = Column(String, nullable=True)  # Marked Done, Snoozed 10m, Notified Trusted Contact
    speech_transcript = Column(String, nullable=True)

    reminder = relationship("Reminder", back_populates="logs")

def init_db():
    Base.metadata.create_all(bind=engine)
    # Seed default user if not exists
    db = SessionLocal()
    try:
        if not db.query(User).filter(User.username == "Ashutosh").first():
            default_user = User(username="Ashutosh", phone_number="+1234567890")
            db.add(default_user)
            db.commit()
    finally:
        db.close()
