import time
import threading
from datetime import datetime, timedelta
from backend.database import SessionLocal, Reminder, CallLog

# We will store active WebSocket connections here to broadcast events
active_connections = set()

# Dict to track calls that are currently ringing or active
# Format: { reminder_id: { "triggered_at": datetime, "retries_done": int } }
active_calls = {}

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class ReminderScheduler:
    def __init__(self):
        self.running = False
        self.thread = None

    def start(self):
        self.running = True
        self.thread = threading.Thread(target=self._loop, daemon=True)
        self.thread.start()

    def stop(self):
        self.running = False

    def _loop(self):
        print("CallMind background scheduler started.")
        while self.running:
            try:
                self._check_reminders()
            except Exception as e:
                print(f"Error in scheduler check: {e}")
            time.sleep(3) # Check every 3 seconds for high responsiveness

    def _check_reminders(self):
        db = SessionLocal()
        try:
            now = datetime.now()
            
            # 1. Query all active or snoozed reminders that are due
            due_reminders = db.query(Reminder).filter(
                Reminder.status.in_(["Active", "Snoozed"]),
                Reminder.due_time <= now
            ).all()

            for reminder in due_reminders:
                # If it's already being processed (ringing), skip
                if reminder.id in active_calls:
                    # Check if the call has timed out (e.g. ringing for more than 40 seconds)
                    call_info = active_calls[reminder.id]
                    if now - call_info["triggered_at"] > timedelta(seconds=40):
                        print(f"Call {reminder.id} timed out (no answer from user). Processing retry/escalation.")
                        self.handle_call_outcome(reminder.id, "Missed", "No response from user. Call timed out.", db)
                    continue

                # Trigger new call
                print(f"Triggering reminder call for: {reminder.title} (Priority: {reminder.priority})")
                active_calls[reminder.id] = {
                    "triggered_at": now,
                    "retry_count": reminder.snooze_count
                }
                
                # Broadcast via WebSocket
                self.broadcast_event({
                    "type": "incoming_call",
                    "reminder": {
                        "id": reminder.id,
                        "title": reminder.title,
                        "notes": reminder.notes,
                        "priority": reminder.priority,
                        "category": reminder.category,
                        "recurrence": reminder.recurrence,
                        "enable_escalation": reminder.enable_escalation,
                        "trusted_contact_phone": reminder.trusted_contact_phone
                    }
                })

        finally:
            db.close()

    def broadcast_event(self, data: dict):
        # We will import the manager here to avoid circular imports
        from backend.main import manager
        import asyncio
        
        # Run async function in the FastAPI event loop
        loop = manager.loop
        if loop and loop.is_running():
            asyncio.run_coroutine_threadsafe(manager.broadcast(data), loop)

    def handle_call_outcome(self, reminder_id: int, outcome: str, notes: str, db):
        """
        Processes what happens after a call concludes:
        - Answered / Marked Completed: mark Completed, reschedule if recurring.
        - Snoozed: reschedule due_time by snooze duration (e.g., 5 mins or user specified), reset active status.
        - Missed / Declined: apply Priority-Aware Retry logic or Emergency Escalation.
        """
        if reminder_id in active_calls:
            del active_calls[reminder_id]

        reminder = db.query(Reminder).filter(Reminder.id == reminder_id).first()
        if not reminder:
            return

        now = datetime.now()
        log = CallLog(
            reminder_id=reminder_id,
            call_time=now,
            call_status=outcome,
            action_taken=notes
        )
        db.add(log)

        if outcome == "Completed":
            if reminder.recurrence == "once":
                reminder.status = "Completed"
            else:
                # Reschedule based on recurrence
                reminder.status = "Active"
                reminder.snooze_count = 0
                if reminder.recurrence == "daily":
                    reminder.due_time = reminder.due_time + timedelta(days=1)
                elif reminder.recurrence == "weekly":
                    reminder.due_time = reminder.due_time + timedelta(weeks=1)
                elif reminder.recurrence == "monthly":
                    # Simple monthly approximation (30 days)
                    reminder.due_time = reminder.due_time + timedelta(days=30)
            
            self.broadcast_event({"type": "refresh_reminders"})
            print(f"Reminder {reminder.id} marked as Completed.")

        elif outcome == "Snoozed":
            # Reschedule due_time to a few minutes later (default 2 minutes for testing)
            snooze_minutes = 2
            reminder.due_time = now + timedelta(minutes=snooze_minutes)
            reminder.status = "Snoozed"
            reminder.snooze_count += 1
            
            self.broadcast_event({"type": "refresh_reminders"})
            print(f"Reminder {reminder.id} snoozed for {snooze_minutes} minutes.")

        elif outcome == "Missed" or outcome == "Declined":
            # Priority-aware retry logic
            priority = reminder.priority.lower()
            current_attempts = reminder.snooze_count  # We use snooze_count here to track continuous failed attempts

            if priority == "high":
                max_retries = 3
                retry_delay = 30 # seconds for demo/testing responsiveness
                
                if current_attempts < max_retries:
                    # Schedule retry call in 30 seconds
                    reminder.due_time = now + timedelta(seconds=retry_delay)
                    reminder.snooze_count += 1
                    reminder.status = "Active"
                    notes = f"High priority retry #{reminder.snooze_count} scheduled in {retry_delay}s."
                    print(f"High-priority reminder {reminder.id} missed. Retrying in {retry_delay} seconds...")
                else:
                    # Escalation check
                    if reminder.enable_escalation and reminder.trusted_contact_phone:
                        reminder.status = "Missed"
                        notes = f"High priority call failed after {max_retries} attempts. Escalated to Trusted Contact: {reminder.trusted_contact_phone}."
                        print(f"CRITICAL: Escalating reminder {reminder.id} to {reminder.trusted_contact_phone}!")
                        self.broadcast_event({
                            "type": "escalation_alert",
                            "reminder": {
                                "id": reminder.id,
                                "title": reminder.title,
                                "trusted_contact_phone": reminder.trusted_contact_phone
                            }
                        })
                    else:
                        reminder.status = "Missed"
                        notes = f"High priority call failed after {max_retries} attempts. No escalation contact."
                        print(f"Reminder {reminder.id} missed. Max retries reached.")
            
            elif priority == "medium":
                max_retries = 1
                retry_delay = 60 # seconds (1 minute)
                
                if current_attempts < max_retries:
                    reminder.due_time = now + timedelta(seconds=retry_delay)
                    reminder.snooze_count += 1
                    reminder.status = "Active"
                    notes = f"Medium priority retry scheduled in {retry_delay}s."
                    print(f"Medium-priority reminder {reminder.id} missed. Retrying in {retry_delay} seconds...")
                else:
                    reminder.status = "Missed"
                    notes = "Medium priority call failed after 1 retry. Fallback to notification."
                    print(f"Reminder {reminder.id} marked Missed after retry.")
            
            else: # Low priority
                reminder.status = "Missed"
                notes = "Low priority call missed. No retry scheduled."
                print(f"Reminder {reminder.id} marked Missed (Low priority).")

            log.action_taken = notes
            self.broadcast_event({"type": "refresh_reminders"})

        db.commit()

# Single global instance of the scheduler
scheduler = ReminderScheduler()
