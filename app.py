import os
import sys
import time
import threading
import uvicorn
import webview

# Add current directory to python path to ensure backend imports work
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from backend.scheduler import scheduler
from backend.database import init_db

def start_fastapi():
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, log_level="warning")

class WindowAPI:
    def __init__(self):
        self._maximized = False

    def minimize(self):
        win = webview.active_window()
        if win:
            try:
                win.minimize()
            except Exception as e:
                print(f"Minimize error: {e}")

    def toggle_maximize(self):
        win = webview.active_window()
        if win:
            try:
                if self._maximized:
                    win.restore()
                    self._maximized = False
                else:
                    win.maximize()
                    self._maximized = True
            except Exception as e:
                print(f"Maximize error: {e}")

    def close(self):
        win = webview.active_window()
        if win:
            try:
                win.destroy()
            except Exception as e:
                print(f"Close error: {e}")

if __name__ == "__main__":
    print("Initializing CallMind database...")
    init_db()

    print("Starting background scheduler...")
    scheduler.start()

    print("Launching backend server...")
    t = threading.Thread(target=start_fastapi, daemon=True)
    t.start()

    # Wait for FastAPI server to initialize
    time.sleep(1.5)

    # Determine load URL (FastAPI localhost:8000 or Vite dev server localhost:5173)
    url = "http://127.0.0.1:8000"
    if os.environ.get("CALLMIND_DEV") == "1":
        url = "http://localhost:5173"

    print(f"Opening native window: {url}")
    
    # Custom API object
    api = WindowAPI()

    # Create the window as transparent and frameless
    window = webview.create_window(
        title="CallMind — Call Reminder System",
        url=url,
        width=1100,
        height=800,
        resizable=True,
        min_size=(950, 650),
        transparent=True,
        frameless=True,
        js_api=api
    )

    # Apply native DWM blur behind the transparent window
    def setup_acrylic(win):
        import ctypes
        import time
        from ctypes import wintypes

        time.sleep(1.0)
        hwnd = None

        # Thread-safe retrieval of HWND using user32 FindWindowW to prevent COM thread violations on win.native
        try:
            user32 = ctypes.windll.user32
            hwnd = user32.FindWindowW(None, "CallMind — Call Reminder System")
        except Exception as e:
            print(f"Error calling FindWindowW: {e}")

        if not hwnd:
            print("Native handle could not be retrieved via FindWindowW.")
            return

        print(f"Applying native OS-level transparent blur to HWND: {hwnd}")
        
        try:
            user32 = ctypes.windll.user32
            dwmapi = ctypes.windll.dwmapi
            
            # Struct for Accent Policy
            class ACCENT_POLICY(ctypes.Structure):
                _fields_ = [
                    ("AccentState", ctypes.c_int),
                    ("AccentFlags", ctypes.c_int),
                    ("GradientColor", ctypes.c_int),
                    ("AnimationId", ctypes.c_int),
                ]
                
            class WINDOWCOMPOSITIONATTRIBDATA(ctypes.Structure):
                _fields_ = [
                    ("Attribute", ctypes.c_int),
                    ("Data", ctypes.c_void_p),
                    ("SizeOfData", ctypes.c_size_t),
                ]
                
            accent = ACCENT_POLICY()
            accent.AccentState = 4 # ACCENT_ENABLE_ACRYLICBLURBEHIND
            accent.GradientColor = 0x01000000 # Low opacity ABGR tint
            
            data = WINDOWCOMPOSITIONATTRIBDATA()
            data.Attribute = 19 # WCA_ACCENT_POLICY
            data.Data = ctypes.cast(ctypes.pointer(accent), ctypes.c_void_p)
            data.SizeOfData = ctypes.sizeof(accent)
            
            user32.SetWindowCompositionAttribute(hwnd, ctypes.byref(data))
            
            # Windows 11 DWM backdrop configuration (Acrylic = 3)
            dwmapi.DwmSetWindowAttribute.argtypes = [wintypes.HWND, ctypes.c_ulong, ctypes.c_void_p, ctypes.c_ulong]
            attr_value = ctypes.c_int(3)
            dwmapi.DwmSetWindowAttribute(
                hwnd,
                38, # DWMWA_SYSTEMBACKDROP_TYPE
                ctypes.byref(attr_value),
                ctypes.sizeof(attr_value)
            )
            print("Native backdrop compositor attributes applied successfully.")
        except Exception as e:
            print(f"Error applying OS-level transparent blur: {e}")

    # Start the desktop window event loop with the callback
    webview.start(setup_acrylic, window)

    # Clean up background scheduler
    print("Shutting down background threads...")
    scheduler.stop()
    print("CallMind exited successfully.")
