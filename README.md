# CallMind — Voice Call Reminder System

CallMind is a standalone native desktop application designed to bridge the gap between silent notifications and actionable tasks. Instead of standard push alerts, CallMind calls you directly within the application shell, utilizing interactive speech synthesis and recognition to ensure critical reminders are resolved.

---

## The Problem

Most modern productivity and reminder tools rely on silent, flat notifications. Because professionals receive dozens of push alerts daily, these notifications are frequently:
- **Ignored or Dismissed**: Easily swiped away without performing the task.
- **Overlooked**: Missed entirely when the phone is face-down or muted.
- **Lacking Urgency**: Standard banners do not convey priority differences, leading to missed medications, skipped meetings, or late payments.

---

## The Solution

CallMind changes this dynamic by **calling you** on the phone (via an in-app simulated VoIP call) when a reminder is due. 
- **Voice Interactivity**: The system reads your specific task out loud using text-to-speech (TTS) synthesis and waits for a verbal response.
- **Verbal Command Capture**: You can speak directly to the caller (e.g., say *"Mark Done"* or *"Snooze"*) to update the reminder status instantly.
- **Priority-Aware Retries**: High-priority tasks execute a rigid retry loop if you decline or ignore the call (ringing again every 30 seconds).
- **Emergency Escalation**: If you remain unreachable, the system automatically triggers an escalation protocol, sending a notification to a designated trusted contact.

---

## System Requirements

To run this application locally, ensure you have:
- **Operating System**: Windows 10/11, macOS, or Linux.
- **Python**: Version 3.10 or higher.
- **Node.js**: Version 18 or higher (with `npm`).
- **Dependencies**: SQLite (pre-packaged with Python).

---

## How to Run the Project

Follow these steps to set up and run CallMind on your machine:

### 1. Set Up the Frontend
Navigate to the `frontend` directory, install dependencies, and build the static assets:
```bash
# Navigate to frontend folder
cd frontend

# Install package dependencies
npm install

# Compile the production bundle
npm run build
```

### 2. Set Up the Backend
Return to the project root and install the required Python packages:
```bash
# Navigate back to root
cd ..

# Install FastAPI, Uvicorn, SQLAlchemy, PyWebView, and other dependencies
pip install fastapi uvicorn sqlalchemy pywebview pythonnet
```

### 3. Launch the Application
Start the unified desktop application from the root directory:
```bash
python app.py
```
This will initialize the local SQLite database (`callmind.db`), start the FastAPI background server, launch the scheduler thread, and open the standalone native desktop GUI window.
