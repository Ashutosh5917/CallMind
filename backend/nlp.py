import re
from datetime import datetime, timedelta

def parse_natural_language(text: str) -> dict:
    """
    Parses natural language strings to extract reminder parameters.
    Example: "Remind me to take medicine daily at 9:30 AM"
    Returns:
        {
            "title": str,
            "due_time": str (ISO format),
            "recurrence": str ("once", "daily", "weekly", "monthly"),
            "category": str ("Health", "Finance", "Work", "Personal"),
            "priority": str ("Low", "Medium", "High")
        }
    """
    # Clean text
    text_clean = text.strip()
    
    # Defaults
    now = datetime.now()
    due_datetime = now + timedelta(hours=1) # Default to 1 hour from now
    recurrence = "once"
    category = "Personal"
    priority = "Medium"
    
    # 1. Parse Category Heuristics
    text_lower = text_clean.lower()
    health_keywords = ["medicine", "pill", "doctor", "health", "exercise", "walk", "medication", "clinic", "hospital", "dentist", "gym", "vitamins"]
    finance_keywords = ["bill", "rent", "pay", "tax", "credit", "finance", "money", "salary", "bank", "electricity", "insurance", "card", "fees"]
    work_keywords = ["meeting", "work", "office", "report", "project", "presentation", "boss", "email", "zoom", "client", "team", "task", "interview"]
    
    if any(kw in text_lower for kw in health_keywords):
        category = "Health"
    elif any(kw in text_lower for kw in finance_keywords):
        category = "Finance"
    elif any(kw in text_lower for kw in work_keywords):
        category = "Work"
    
    # 2. Extract Action / Title
    # Try to strip prefix like "remind me to", "remind us to", "remind to"
    title = text_clean
    prefix_match = re.search(r"^(remind\s+(?:me|us|him|her|them)?\s*(?:to)?\s*)", text_lower)
    if prefix_match:
        title = text_clean[prefix_match.end():]
        
    # 3. Parse Recurrence
    if "every day" in text_lower or "daily" in text_lower or "each day" in text_lower:
        recurrence = "daily"
    elif "every week" in text_lower or "weekly" in text_lower:
        recurrence = "weekly"
    elif "every month" in text_lower or "monthly" in text_lower:
        recurrence = "monthly"
    else:
        # Check specific weekdays: "every sunday", "every monday"
        weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        for i, w in enumerate(weekdays):
            if f"every {w}" in text_lower:
                recurrence = "weekly"
                # Set next occurrence of this weekday
                days_ahead = i - now.weekday()
                if days_ahead <= 0: # Target day already happened this week or is today
                    days_ahead += 7
                due_datetime = now + timedelta(days=days_ahead)
                break

    # 4. Parse Time
    # Formats like "9 AM", "9pm", "10:30 PM", "9:30am", "16:00"
    time_match = re.search(r"(\b\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)\b|\b\d{1,2}:\d{2}\b)", text_clean)
    target_hour = 12
    target_minute = 0
    time_parsed = False
    
    if time_match:
        time_str = time_match.group(1).lower().replace(" ", "")
        time_parsed = True
        try:
            if "am" in time_str or "pm" in time_str:
                meridian = "pm" if "pm" in time_str else "am"
                digits = time_str.replace("am", "").replace("pm", "")
                if ":" in digits:
                    h, m = map(int, digits.split(":"))
                else:
                    h, m = int(digits), 0
                
                if meridian == "pm" and h < 12:
                    h += 12
                if meridian == "am" and h == 12:
                    h = 0
                target_hour, target_minute = h, m
            else:
                h, m = map(int, time_str.split(":"))
                target_hour, target_minute = h, m
        except Exception:
            time_parsed = False

    # 5. Parse Date Offset
    # "tomorrow", "today", "next friday", "on friday"
    date_parsed = False
    if "tomorrow" in text_lower:
        due_datetime = now + timedelta(days=1)
        date_parsed = True
    elif "today" in text_lower:
        due_datetime = now
        date_parsed = True
    elif "next week" in text_lower:
        due_datetime = now + timedelta(days=7)
        date_parsed = True
    else:
        # Check weekdays: e.g. "on friday", "this friday"
        weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        for i, w in enumerate(weekdays):
            if f"on {w}" in text_lower or f"this {w}" in text_lower or f"next {w}" in text_lower:
                days_ahead = i - now.weekday()
                if days_ahead <= 0:
                    days_ahead += 7
                due_datetime = now + timedelta(days=days_ahead)
                date_parsed = True
                break

    # Adjust hours/minutes
    due_datetime = due_datetime.replace(hour=target_hour, minute=target_minute, second=0, microsecond=0)
    
    # If no date was parsed, and due time is in the past for today, set to tomorrow
    if not date_parsed and due_datetime < now and recurrence == "once":
        due_datetime = due_datetime + timedelta(days=1)
    elif recurrence == "daily" and due_datetime < now:
        due_datetime = due_datetime + timedelta(days=1)

    # 6. Extract clean title (remove time phrases and connectors)
    # Remove phrases like "at 9 am", "every day", "daily", "on friday", "tomorrow", etc.
    phrases_to_remove = [
        r"\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?\b",
        r"\b\d{1,2}:\d{2}\b",
        r"\bevery\s+day\b", r"\bdaily\b", r"\beach\s+day\b",
        r"\bevery\s+week\b", r"\bweekly\b",
        r"\bevery\s+month\b", r"\bmonthly\b",
        r"\btomorrow\b", r"\btoday\b",
        r"\bon\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",
        r"\bthis\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",
        r"\bnext\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",
        r"\bevery\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",
    ]
    
    clean_title = title
    for p in phrases_to_remove:
        clean_title = re.sub(p, "", clean_title, flags=re.IGNORECASE)
    
    # Clean double spaces, leading/trailing punctuation
    clean_title = re.sub(r"\s+", " ", clean_title).strip()
    clean_title = re.sub(r"^(to\s+)", "", clean_title, flags=re.IGNORECASE)
    clean_title = clean_title.rstrip(",. ")
    
    if not clean_title:
        clean_title = "Reminder"
    
    # Priority
    if "urgent" in text_lower or "asap" in text_lower or "critical" in text_lower or "important" in text_lower:
        priority = "High"
    elif "low priority" in text_lower or "whenever" in text_lower:
        priority = "Low"

    return {
        "title": clean_title,
        "due_time": due_datetime.isoformat(),
        "recurrence": recurrence,
        "category": category,
        "priority": priority
    }
