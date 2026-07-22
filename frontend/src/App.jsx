import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  Calendar, 
  Check, 
  Clock, 
  ListTodo, 
  LogOut, 
  Phone, 
  PhoneCall, 
  PhoneOff, 
  Plus, 
  RefreshCw, 
  Settings, 
  TrendingUp, 
  Trash2, 
  User as UserIcon, 
  Users, 
  Volume2, 
  VolumeX, 
  AlertTriangle, 
  Sparkles, 
  Moon, 
  Sun,
  Mic,
  MessageSquare,
  MicOff,
  UserCheck,
  ShieldAlert
} from 'lucide-react';

const API_BASE = 'http://127.0.0.1:8000/api';
const WS_URL = 'ws://127.0.0.1:8000/ws';

// Synth Audio Helper using Web Audio API
const audioSynth = {
  ctx: null,
  ringInterval: null,
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  },
  playRingtone() {
    this.init();
    if (this.ringInterval) return;
    
    const playTone = () => {
      if (!this.ctx) return;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(453, this.ctx.currentTime); // Standard UK ringtone
      osc2.frequency.setValueAtTime(400, this.ctx.currentTime);

      gain.gain.setValueAtTime(0, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime + 0.4);
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);

      gain.gain.setValueAtTime(0, this.ctx.currentTime + 0.7);
      gain.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + 0.8);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime + 1.1);
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.2);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(this.ctx.currentTime + 2.0);
      osc2.stop(this.ctx.currentTime + 2.0);
    };

    playTone();
    this.ringInterval = setInterval(playTone, 3000);
  },
  stopRingtone() {
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
  },
  playChime() {
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, this.ctx.currentTime); // C5
    osc.frequency.exponentialRampToValueAtTime(1046.50, this.ctx.currentTime + 0.15); // C6
    
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  },
  playBeep() {
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, this.ctx.currentTime); // A5
    
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  },
  playAlert() {
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(330, this.ctx.currentTime + 0.2);
    
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
  }
};

const cleanVoiceName = (fullName) => {
  let name = fullName;
  name = name.replace(/^microsoft\s+/i, '');
  name = name.replace(/\s+desktop\s+/i, ' ');
  name = name.replace(/\s+-\s+english.*/i, '');
  name = name.replace(/\s+\(united.*/i, '');
  name = name.replace(/\s+\(great.*/i, '');
  name = name.replace(/\s+-\s+.*$/i, '');
  name = name.replace(/\([^\)]+\)/g, '');
  return name.trim();
};

const getVoiceSecondaryName = (fullName, lang) => {
  let lower = fullName.toLowerCase();
  let type = "System Voice";
  
  if (lower.includes('natural')) type = "Premium Neural Voice";
  else if (lower.includes('google')) type = "Google Cloud Voice";
  else if (lower.includes('zira') || lower.includes('hazel') || lower.includes('haruka') || lower.includes('heera') || lower.includes('helena')) type = "Female Voice";
  else if (lower.includes('david') || lower.includes('ravi') || lower.includes('mark') || lower.includes('george')) type = "Male Voice";
  
  let country = lang.toUpperCase();
  if (lang.includes('en-US') || lang.includes('en_US')) country = "US Accent";
  else if (lang.includes('en-GB') || lang.includes('en_GB')) country = "UK Accent";
  else if (lang.includes('en-IN') || lang.includes('en_IN')) country = "Indian Accent";
  
  return `${type} • ${country}`;
};

export default function App() {
  // Navigation & UI States
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, create, insights, delegated, settings
  const [theme, setTheme] = useState(() => localStorage.getItem('callmind_theme') || 'light');
  const [isGlassActive, setIsGlassActive] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('All');
  
  // Data States
  const [reminders, setReminders] = useState([]);
  const [insights, setInsights] = useState({
    summary: { active: 0, completed: 0, missed: 0, streak: 0 },
    category_breakdown: {},
    recent_logs: []
  });

  // NLP Creation States
  const [nlpInput, setNlpInput] = useState('');
  const [nlpPreview, setNlpPreview] = useState(null);
  
  // Manual Form States
  const [manualTitle, setManualTitle] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [manualTime, setManualTime] = useState('');
  const [manualCategory, setManualCategory] = useState('Personal');
  const [manualPriority, setManualPriority] = useState('Medium');
  const [manualRecurrence, setManualRecurrence] = useState('once');
  const [manualEscalation, setManualEscalation] = useState(false);
  const [manualEscalationPhone, setManualEscalationPhone] = useState('');
  const [manualAssigneePhone, setManualAssigneePhone] = useState('');

  // Call Simulator States
  const [currentCall, setCurrentCall] = useState(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [callTranscript, setCallTranscript] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [speechResultText, setSpeechResultText] = useState('');
  const [ttsActive, setTtsActive] = useState(false);
  const [alertNotification, setAlertNotification] = useState(null);

  // Speech Recognition Reference
  const recognitionRef = useRef(null);

  // Voice Selection States
  const [voices, setVoices] = useState([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState(() => localStorage.getItem('callmind_voice') || '');

  // Sync Theme
  useEffect(() => {
    localStorage.setItem('callmind_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Sync Glassmorphism
  useEffect(() => {
    document.documentElement.setAttribute('data-glass', 'false');
  }, []);

  // Sync Voice Selection
  useEffect(() => {
    if (selectedVoiceName) {
      localStorage.setItem('callmind_voice', selectedVoiceName);
    }
  }, [selectedVoiceName]);

  // Initialize Speech Synthesis Voices
  useEffect(() => {
    const updateVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      const englishVoices = allVoices.filter(v => v.lang.includes('en'));
      setVoices(englishVoices.length ? englishVoices : allVoices);
      
      // Default selection if none selected
      if (!selectedVoiceName && allVoices.length) {
        const defaultVoice = englishVoices.find(v => v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Zira') || v.name.includes('Hazel')) || englishVoices[0] || allVoices[0];
        if (defaultVoice) setSelectedVoiceName(defaultVoice.name);
      }
    };

    updateVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, [selectedVoiceName]);

  // Play testing voice sample
  const playVoiceSample = () => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("Hi Ashutosh, this is your selected test voice. How do I sound?");
    const voicesList = window.speechSynthesis.getVoices();
    const selectedVoice = voicesList.find(v => v.name === selectedVoiceName);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    window.speechSynthesis.speak(utterance);
  };

  // Load Data
  const fetchData = async () => {
    try {
      const remRes = await fetch(`${API_BASE}/reminders`);
      if (remRes.ok) {
        const remData = await remRes.json();
        setReminders(remData);
      }
    } catch (e) {
      console.error("Error fetching reminders:", e);
    }

    try {
      const insRes = await fetch(`${API_BASE}/insights`);
      if (insRes.ok) {
        const insData = await insRes.json();
        setInsights(insData);
      }
    } catch (e) {
      console.error("Error fetching insights:", e);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Connect WebSockets
    let ws = new WebSocket(WS_URL);
    
    ws.onopen = () => console.log("Connected to CallMind WebSocket");
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("WebSocket event:", data);
      
      if (data.type === 'incoming_call') {
        audioSynth.playRingtone();
        setCurrentCall(data.reminder);
        setIsCallActive(false);
        setCallTranscript([{ sender: 'System', text: 'Incoming voice call reminder...' }]);
      } else if (data.type === 'refresh_reminders') {
        fetchData();
      } else if (data.type === 'escalation_alert') {
        audioSynth.playAlert();
        setAlertNotification({
          title: `🚨 Emergency Escalation Triggered!`,
          message: `Critical reminder "${data.reminder.title}" went unanswered. SMS escalation sent to: ${data.reminder.trusted_contact_phone}`
        });
        fetchData();
        // Clear alert after 8 seconds
        setTimeout(() => setAlertNotification(null), 8000);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket closed. Attempting reconnect...");
      setTimeout(() => {
        // Simple reconnect
        fetchData();
      }, 5000);
    };

    return () => {
      ws.close();
      audioSynth.stopRingtone();
    };
  }, []);

  // Natural Language Parse Handler
  const handleNlpParse = async (e) => {
    e.preventDefault();
    if (!nlpInput.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/nlp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: nlpInput })
      });
      const data = await res.json();
      setNlpPreview(data);
      setNlpInput(''); // Clear text from input field on parse review
    } catch (e) {
      console.error(e);
    }
  };

  const cancelNlpPreview = () => {
    if (nlpPreview) {
      setNlpInput(nlpPreview.title); // Restore parsed title so they can edit
    }
    setNlpPreview(null);
  };

  const confirmNlpReminder = async () => {
    if (!nlpPreview) return;
    try {
      const res = await fetch(`${API_BASE}/reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: nlpPreview.title,
          notes: "",
          due_time: nlpPreview.due_time,
          recurrence: nlpPreview.recurrence,
          category: nlpPreview.category,
          priority: nlpPreview.priority,
          enable_escalation: false
        })
      });
      if (res.ok) {
        audioSynth.playChime();
        setNlpInput('');
        setNlpPreview(null);
        setActiveTab('dashboard');
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Manual Form Submit
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualTitle || !manualTime) return;
    
    // Convert datetime-local value to ISO string
    const localTime = new Date(manualTime);
    
    try {
      const res = await fetch(`${API_BASE}/reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: manualTitle,
          notes: manualNotes,
          due_time: localTime.toISOString(),
          recurrence: manualRecurrence,
          category: manualCategory,
          priority: manualPriority,
          enable_escalation: manualEscalation,
          trusted_contact_phone: manualEscalation ? manualEscalationPhone : null,
          assigned_to_phone: manualAssigneePhone || null
        })
      });
      if (res.ok) {
        audioSynth.playChime();
        setManualTitle('');
        setManualNotes('');
        setManualTime('');
        setManualCategory('Personal');
        setManualPriority('Medium');
        setManualRecurrence('once');
        setManualEscalation(false);
        setManualEscalationPhone('');
        setManualAssigneePhone('');
        setActiveTab('dashboard');
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Delete Reminder
  const deleteReminder = async (id) => {
    try {
      await fetch(`${API_BASE}/reminders/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // Force Test Call
  const testCallReminder = async (id) => {
    try {
      await fetch(`${API_BASE}/test-call/${id}`);
    } catch (e) {
      console.error(e);
    }
  };

  // Mark Completed directly from UI
  const markCompletedDirect = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/reminders/${id}/call-completed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome: 'Completed', notes: 'Completed manually from dashboard.' })
      });
      if (res.ok) {
        audioSynth.playChime();
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // VoIP call interaction logic
  const acceptCall = () => {
    audioSynth.stopRingtone();
    setIsCallActive(true);
    setCallTranscript(prev => [...prev, { sender: 'System', text: 'Call answered.' }]);
    
    // Play greeting TTS
    triggerTTS();
  };

  const declineCall = async () => {
    audioSynth.stopRingtone();
    const reminderId = currentCall.id;
    setCurrentCall(null);
    setIsCallActive(false);
    
    // Submit Missed response to backend
    try {
      await fetch(`${API_BASE}/reminders/${reminderId}/call-completed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome: 'Declined', notes: 'Call declined by user.' })
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // Trigger TTS reading out the reminder
  const triggerTTS = () => {
    if (!currentCall) return;
    setTtsActive(true);
    
    const message = `Hello Ashutosh. This is your reminder: ${currentCall.title}. ${currentCall.notes || ''}. Please say "Mark Done" to complete, or say "Snooze" to be called back in two minutes.`;
    
    const utterance = new SpeechSynthesisUtterance(message);
    
    // Find the selected voice
    const voicesList = window.speechSynthesis.getVoices();
    const selectedVoice = voicesList.find(v => v.name === selectedVoiceName);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    
    utterance.onend = () => {
      setTtsActive(false);
      setCallTranscript(prev => [...prev, { sender: 'CallMind', text: `"${currentCall.title}"` }]);
      // Start listening for response automatically
      startListening();
    };

    window.speechSynthesis.speak(utterance);
  };

  // Start Speech Recognition
  const startListening = () => {
    const SpeechReq = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechReq) {
      setCallTranscript(prev => [...prev, { sender: 'System', text: 'Speech recognition not supported in this browser. Please use keypad below.' }]);
      return;
    }

    audioSynth.playBeep();
    const recognition = new SpeechReq();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognitionRef.current = recognition;
    setIsListening(true);

    recognition.onresult = (event) => {
      const speechText = event.results[0][0].transcript.toLowerCase();
      setSpeechResultText(speechText);
      setCallTranscript(prev => [...prev, { sender: 'Ashutosh', text: speechText }]);
      handleVoiceCommand(speechText);
    };

    recognition.onerror = (e) => {
      console.error("Speech Error:", e);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  // Process natural voice commands
  const handleVoiceCommand = async (command) => {
    if (!currentCall) return;
    const reminderId = currentCall.id;

    if (command.includes('done') || command.includes('complete') || command.includes('finish') || command.includes('yes')) {
      // Completed
      window.speechSynthesis.speak(new SpeechSynthesisUtterance("Understood. Marking as completed. Thank you."));
      setTimeout(async () => {
        await submitCallOutcome(reminderId, 'Completed', `Marked complete via voice command: "${command}"`);
      }, 2000);
    } else if (command.includes('snooze') || command.includes('later') || command.includes('snooze this') || command.includes('wait')) {
      // Snoozed
      window.speechSynthesis.speak(new SpeechSynthesisUtterance("Okay, I will call you back in 2 minutes."));
      setTimeout(async () => {
        await submitCallOutcome(reminderId, 'Snoozed', `Snoozed via voice command: "${command}"`);
      }, 2000);
    } else {
      // Unrecognized
      const utterance = new SpeechSynthesisUtterance("Sorry, I didn't get that. Say snooze to snooze, or say mark done to complete.");
      utterance.onend = () => startListening(); // Try listening again
      window.speechSynthesis.speak(utterance);
    }
  };

  // Submit outcome to DB
  const submitCallOutcome = async (id, outcome, notes) => {
    try {
      await fetch(`${API_BASE}/reminders/${id}/call-completed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome, notes })
      });
      // Close overlay
      setCurrentCall(null);
      setIsCallActive(false);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // Keypad simulation
  const handleKeypress = async (key) => {
    if (!currentCall) return;
    const reminderId = currentCall.id;
    audioSynth.playBeep();
    
    if (key === '1') {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance("Snoozing reminder."));
      await submitCallOutcome(reminderId, 'Snoozed', 'Snoozed via keypress [1].');
    } else if (key === '2') {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance("Marking complete."));
      await submitCallOutcome(reminderId, 'Completed', 'Completed via keypress [2].');
    }
  };

  // Filter reminders
  const filteredReminders = reminders.filter(r => {
    if (categoryFilter === 'All') return true;
    return r.category === categoryFilter;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Custom Draggable Title Bar */}
      <div 
        className="pywebview-drag" 
        style={{ 
          height: '40px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '0 20px', 
          background: isGlassActive ? 'rgba(0, 0, 0, 0.05)' : 'var(--bg-secondary)',
          borderBottom: isGlassActive ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.03)',
          zIndex: 1000,
          cursor: 'move'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PhoneCall size={14} color="var(--accent)" />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>CallMind</span>
        </div>
        
        {/* Title Bar Window Controls */}
        <div className="no-drag" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            type="button"
            className="nm-btn" 
            style={{ width: '22px', height: '22px', borderRadius: '50%', padding: 0, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none', background: isGlassActive ? 'rgba(255,255,255,0.08)' : 'var(--bg-primary)' }}
            onClick={() => window.pywebview?.api?.minimize()}
            title="Minimize"
          >
            —
          </button>
          <button 
            type="button"
            className="nm-btn" 
            style={{ width: '22px', height: '22px', borderRadius: '50%', padding: 0, fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none', background: isGlassActive ? 'rgba(255,255,255,0.08)' : 'var(--bg-primary)' }}
            onClick={() => window.pywebview?.api?.toggle_maximize()}
            title="Maximize"
          >
            ❑
          </button>
          <button 
            type="button"
            className="nm-btn" 
            style={{ width: '22px', height: '22px', borderRadius: '50%', padding: 0, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', border: 'none' }}
            onClick={() => window.pywebview?.api?.close()}
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="app-container" style={{ flex: 1, overflow: 'hidden', height: 'calc(100vh - 40px)' }}>
      {/* Background Animated Blobs for Glassmorphism */}
      <div className="glass-bg-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      {/* Left Sidebar Navigation */}
      <aside className="sidebar">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
            <div className="nm-btn nm-btn-circle" style={{ width: '40px', height: '40px', background: 'var(--accent)', color: 'white', border: 'none' }}>
              <PhoneCall size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.5px' }}>CallMind</h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Desktop Client v1.0</p>
            </div>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <button 
              className={`nm-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
              style={{ justifyContent: 'flex-start', padding: '12px 16px', gap: '12px' }}
              onClick={() => setActiveTab('dashboard')}
            >
              <ListTodo size={18} />
              <span>Dashboard</span>
            </button>
            
            <button 
              className={`nm-btn ${activeTab === 'create' ? 'active' : ''}`}
              style={{ justifyContent: 'flex-start', padding: '12px 16px', gap: '12px' }}
              onClick={() => setActiveTab('create')}
            >
              <Plus size={18} />
              <span>Create Manual</span>
            </button>

            <button 
              className={`nm-btn ${activeTab === 'insights' ? 'active' : ''}`}
              style={{ justifyContent: 'flex-start', padding: '12px 16px', gap: '12px' }}
              onClick={() => setActiveTab('insights')}
            >
              <TrendingUp size={18} />
              <span>Insights & Streaks</span>
            </button>

            <button 
              className={`nm-btn ${activeTab === 'delegated' ? 'active' : ''}`}
              style={{ justifyContent: 'flex-start', padding: '12px 16px', gap: '12px' }}
              onClick={() => setActiveTab('delegated')}
            >
              <Users size={18} />
              <span>Delegated Calls</span>
            </button>

            <button 
              className={`nm-btn ${activeTab === 'settings' ? 'active' : ''}`}
              style={{ justifyContent: 'flex-start', padding: '12px 16px', gap: '12px' }}
              onClick={() => setActiveTab('settings')}
            >
              <Settings size={18} />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        <div>
          <div className="nm-inset" style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#cbd5e0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a5568', fontWeight: 600 }}>
              A
            </div>
            <div>
              <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>Ashutosh</p>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>+1 234 567 890</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="main-content">
        
        {/* Top Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.5px' }}>
              {activeTab === 'dashboard' && 'My Reminders'}
              {activeTab === 'create' && 'Set Up Reminder'}
              {activeTab === 'insights' && 'Analytics & Streaks'}
              {activeTab === 'delegated' && 'Delegated Tasks'}
              {activeTab === 'settings' && 'System Settings'}
            </h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              {activeTab === 'dashboard' && 'Manage your smart phone-call notifications.'}
              {activeTab === 'create' && 'Create a specific priority reminder.'}
              {activeTab === 'insights' && 'Review your productivity metrics.'}
              {activeTab === 'delegated' && 'Reminders assigned to others.'}
              {activeTab === 'settings' && 'Customize voice, appearance, and glassmorphic styles.'}
            </p>
          </div>
          
          <button className="nm-btn nm-btn-circle" style={{ width: '40px', height: '40px' }} onClick={fetchData}>
            <RefreshCw size={16} />
          </button>
        </header>

        {/* Global Notification Banner */}
        {alertNotification && (
          <div className="nm-flat" style={{ padding: '16px', background: 'var(--danger-light)', borderLeft: '5px solid var(--danger)', borderRadius: '12px', display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px' }}>
            <ShieldAlert size={24} color="var(--danger)" />
            <div>
              <h4 style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{alertNotification.title}</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{alertNotification.message}</p>
            </div>
          </div>
        )}

        {/* Tab 1: Dashboard Panel */}
        {activeTab === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, overflow: 'hidden' }}>
                      {/* Natural Language Prompt */}
            <div className="nm-flat" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <form onSubmit={handleNlpParse} style={{ display: 'flex', gap: '12px' }}>
                <input 
                  type="text" 
                  className="nm-input" 
                  style={{ flex: 1 }} 
                  placeholder='Try saying: "Remind me to take my medicine daily at 9:30 PM" or "Call electricity board on Friday at 4pm"' 
                  value={nlpInput}
                  onChange={(e) => setNlpInput(e.target.value)}
                />
                <button type="submit" className="nm-btn-accent" style={{ padding: '0 24px', borderRadius: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Sparkles size={16} />
                  <span>Parse NLP</span>
                </button>
              </form>

              {/* NLP Confirmation Card Preview (outside form to avoid submit conflicts) */}
              {nlpPreview && (
                <div className="nm-inset" style={{ padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', animation: 'fadeIn 0.3s ease', marginTop: '4px' }}>
                  <div style={{ display: 'flex', gap: '20px' }}>
                    <div>
                      <span className="badge badge-personal" style={{ marginBottom: '8px' }}>Parsed Preview</span>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{nlpPreview.title}</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)', gap: '4px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> {new Date(nlpPreview.due_time).toLocaleString()}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><RefreshCw size={12} /> Recurrence: <strong>{nlpPreview.recurrence}</strong></span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)', gap: '4px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Bell size={12} /> Category: <strong>{nlpPreview.category}</strong></span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><AlertTriangle size={12} /> Priority: <strong>{nlpPreview.priority}</strong></span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" className="nm-btn" style={{ padding: '10px 16px' }} onClick={cancelNlpPreview}>Cancel</button>
                    <button type="button" className="nm-btn-accent" style={{ padding: '10px 20px', background: 'var(--success)' }} onClick={confirmNlpReminder}>
                      Confirm & Create
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Tabs Filter */}
            <div style={{ display: 'flex', gap: '12px' }}>
              {['All', 'Health', 'Finance', 'Work', 'Personal'].map(cat => (
                <button
                  key={cat}
                  className={`nm-btn ${categoryFilter === cat ? 'active' : ''}`}
                  style={{ padding: '8px 16px', borderRadius: '12px', fontSize: '0.85rem' }}
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Reminders List Grid */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
              {filteredReminders.length === 0 ? (
                <div className="nm-inset" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)', borderRadius: '24px' }}>
                  <Bell size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                  <p style={{ fontWeight: 600 }}>No reminders found in this category.</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Create one above using natural language or fill the manual form.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                  {filteredReminders.map(rem => {
                    // Category border styling
                    let catColor = 'var(--text-muted)';
                    let badgeClass = 'badge-personal';
                    if (rem.category === 'Health') { catColor = 'var(--cat-health)'; badgeClass = 'badge-health'; }
                    if (rem.category === 'Finance') { catColor = 'var(--cat-finance)'; badgeClass = 'badge-finance'; }
                    if (rem.category === 'Work') { catColor = 'var(--cat-work)'; badgeClass = 'badge-work'; }

                    // Priority badges
                    let priColor = 'var(--text-secondary)';
                    if (rem.priority === 'High') priColor = 'var(--danger)';
                    if (rem.priority === 'Low') priColor = 'var(--text-muted)';

                    return (
                      <div 
                        key={rem.id} 
                        className="nm-flat-card" 
                        style={{ 
                          padding: '20px', 
                          borderLeft: `5px solid ${catColor}`,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '16px'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <span className={`badge ${badgeClass}`}>{rem.category}</span>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: priColor, textTransform: 'uppercase' }}>
                              {rem.priority} Priority
                            </span>
                          </div>
                          
                          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '6px', textDecoration: rem.status === 'Completed' ? 'line-through' : 'none', opacity: rem.status === 'Completed' ? 0.5 : 1, wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                            {rem.title}
                          </h3>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: rem.notes ? 'block' : 'none', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                            {rem.notes}
                          </p>
                        </div>

                        <div>
                          <div className="nm-inset" style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                              <Clock size={14} />
                              <span>{new Date(rem.due_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                              <Calendar size={14} />
                              <span>{new Date(rem.due_time).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                            </span>
                            <span style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--accent)' }}>
                              {rem.recurrence !== 'once' ? rem.recurrence : ''}
                            </span>
                          </div>

                          {/* Extra Status details */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                            <span>Status: <strong style={{ color: rem.status === 'Completed' ? 'var(--success)' : rem.status === 'Missed' ? 'var(--danger)' : 'var(--accent)' }}>{rem.status}</strong></span>
                            {rem.enable_escalation && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--warning)', fontWeight: 600 }}>
                                <ShieldAlert size={12} /> Escalation Active
                              </span>
                            )}
                          </div>

                          {/* Card Action Controls */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                            {rem.status === 'Active' || rem.status === 'Snoozed' ? (
                              <>
                                <button 
                                  className="nm-btn" 
                                  style={{ flex: 1, padding: '8px', gap: '6px', color: 'var(--success)' }}
                                  onClick={() => markCompletedDirect(rem.id)}
                                >
                                  <Check size={14} />
                                  <span style={{ fontSize: '0.8rem' }}>Done</span>
                                </button>
                                
                                <button 
                                  className="nm-btn" 
                                  style={{ padding: '8px 12px', color: 'var(--accent)' }}
                                  title="Test Caller Simulation"
                                  onClick={() => testCallReminder(rem.id)}
                                >
                                  <Phone size={14} />
                                </button>
                              </>
                            ) : null}

                            <button 
                              className="nm-btn" 
                              style={{ flex: rem.status !== 'Active' && rem.status !== 'Snoozed' ? 1 : 'initial', padding: '8px 12px', color: 'var(--danger)', gap: '6px' }}
                              onClick={() => deleteReminder(rem.id)}
                            >
                              <Trash2 size={14} />
                              {rem.status !== 'Active' && rem.status !== 'Snoozed' && <span style={{ fontSize: '0.8rem' }}>Delete History</span>}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Create Manual Reminder */}
        {activeTab === 'create' && (
          <div className="nm-flat" style={{ padding: '32px', maxWidth: '700px', margin: '0 auto', width: '100%', overflowY: 'auto' }}>
            <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Reminder Title</label>
                <input 
                  type="text" 
                  className="nm-input" 
                  style={{ width: '100%' }}
                  placeholder="Pay internet bill, take vitamins..."
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Optional Notes</label>
                <textarea 
                  className="nm-input" 
                  style={{ width: '100%', minHeight: '80px', resize: 'vertical' }}
                  placeholder="Add details, account numbers, or medicine dosage..."
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Due Date & Time</label>
                  <input 
                    type="datetime-local" 
                    className="nm-input" 
                    style={{ width: '100%' }}
                    value={manualTime}
                    onChange={(e) => setManualTime(e.target.value)}
                    required
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Recurrence</label>
                  <select 
                    className="nm-input" 
                    style={{ width: '100%' }}
                    value={manualRecurrence}
                    onChange={(e) => setManualRecurrence(e.target.value)}
                  >
                    <option value="once">Once</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Category</label>
                  <select 
                    className="nm-input" 
                    style={{ width: '100%' }}
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                  >
                    <option value="Personal">Personal</option>
                    <option value="Health">Health</option>
                    <option value="Finance">Finance</option>
                    <option value="Work">Work</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Call Alert Priority</label>
                  <select 
                    className="nm-input" 
                    style={{ width: '100%' }}
                    value={manualPriority}
                    onChange={(e) => setManualPriority(e.target.value)}
                  >
                    <option value="Low">Low (Single Call Fallback)</option>
                    <option value="Medium">Medium (1 Retry Call)</option>
                    <option value="High">High (3 Persistent Retries + Escalation)</option>
                  </select>
                </div>
              </div>

              {/* Emergency Escalation */}
              <div className="nm-inset" style={{ padding: '16px', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Enable Emergency Escalation</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>If calls go unanswered, we'll notify a trusted contact.</p>
                  </div>
                  <input 
                    type="checkbox" 
                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                    checked={manualEscalation}
                    onChange={(e) => setManualEscalation(e.target.checked)}
                  />
                </div>
                
                {manualEscalation && (
                  <div style={{ animation: 'fadeIn 0.3s ease' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>Trusted Contact Phone Number</label>
                    <input 
                      type="tel" 
                      className="nm-input" 
                      style={{ width: '100%' }}
                      placeholder="e.g. +1 555-019-2834 (Spouse / Doctor)"
                      value={manualEscalationPhone}
                      onChange={(e) => setManualEscalationPhone(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>

              {/* Assignee / Shared Reminder */}
              <div className="nm-inset" style={{ padding: '16px', borderRadius: '12px' }}>
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '4px' }}>Delegate This Reminder</h4>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Assign this call to another phone number instead of yourself.</p>
                  <input 
                    type="tel" 
                    className="nm-input" 
                    style={{ width: '100%' }}
                    placeholder="Enter recipient phone number (optional)"
                    value={manualAssigneePhone}
                    onChange={(e) => setManualAssigneePhone(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', marginTop: '10px' }}>
                <button type="button" className="nm-btn" style={{ flex: 1, padding: '12px' }} onClick={() => setActiveTab('dashboard')}>
                  Cancel
                </button>
                <button type="submit" className="nm-btn-accent" style={{ flex: 2, padding: '12px' }}>
                  Schedule Call Alert
                </button>
              </div>

            </form>
          </div>
        )}

        {/* Tab 3: Insights & Analytics */}
        {activeTab === 'insights' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
            
            {/* Stat Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
              <div className="nm-flat" style={{ padding: '20px', textAlign: 'center' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Streaks 🔥</p>
                <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--warning)' }}>{insights.summary.streak} Days</h2>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Consecutive call completions</p>
              </div>
              <div className="nm-flat" style={{ padding: '20px', textAlign: 'center' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Active Alerts 🔔</p>
                <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent)' }}>{insights.summary.active}</h2>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Scheduled upcoming calls</p>
              </div>
              <div className="nm-flat" style={{ padding: '20px', textAlign: 'center' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Completed Calls ✅</p>
                <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--success)' }}>{insights.summary.completed}</h2>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Marked done during call</p>
              </div>
              <div className="nm-flat" style={{ padding: '20px', textAlign: 'center' }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Missed Alerts ❌</p>
                <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--danger)' }}>{insights.summary.missed}</h2>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Logged call timeouts</p>
              </div>
            </div>

            {/* Custom SVG Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
              
              {/* Category Performance Chart */}
              <div className="nm-flat" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '20px' }}>Category Answer Rate (%)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {['Health', 'Finance', 'Work', 'Personal'].map(cat => {
                    const data = insights.category_breakdown[cat] || { rate: 0, completed: 0, total: 0 };
                    let barColor = 'var(--text-muted)';
                    if (cat === 'Health') barColor = 'var(--cat-health)';
                    if (cat === 'Finance') barColor = 'var(--cat-finance)';
                    if (cat === 'Work') barColor = 'var(--cat-work)';
                    if (cat === 'Personal') barColor = 'var(--cat-personal)';

                    return (
                      <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ width: '80px', fontSize: '0.85rem', fontWeight: 600 }}>{cat}</span>
                        <div className="nm-inset" style={{ flex: 1, height: '16px', borderRadius: '8px', overflow: 'hidden', padding: '2px' }}>
                          <div 
                            style={{ 
                              height: '100%', 
                              width: `${data.rate || 0}%`, 
                              background: barColor, 
                              borderRadius: '6px',
                              transition: 'width 1s ease-in-out'
                            }} 
                          />
                        </div>
                        <span style={{ width: '45px', fontSize: '0.85rem', fontWeight: 700, textAlign: 'right' }}>
                          {data.rate}%
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', width: '60px' }}>
                          ({data.completed}/{data.total})
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Response habits radial graph */}
              <div className="nm-flat" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', alignSelf: 'flex-start' }}>Overall Compliance</h3>
                
                <div style={{ position: 'relative', width: '150px', height: '150px' }}>
                  {/* Neumorphic SVG Radial Progress */}
                  <svg width="150" height="150" viewBox="0 0 150 150">
                    <circle cx="75" cy="75" r="60" fill="none" stroke="var(--bg-secondary)" strokeWidth="12" />
                    <circle 
                      cx="75" 
                      cy="75" 
                      r="60" 
                      fill="none" 
                      stroke="var(--accent)" 
                      strokeWidth="12" 
                      strokeDasharray="377" 
                      strokeDashoffset={377 - (377 * (insights.summary.completed / (insights.summary.completed + insights.summary.missed || 1)))}
                      strokeLinecap="round"
                      transform="rotate(-90 75 75)"
                      style={{ transition: 'stroke-dashoffset 1s ease' }}
                    />
                  </svg>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 700 }}>
                      {Math.round((insights.summary.completed / (insights.summary.completed + insights.summary.missed || 1)) * 100)}%
                    </h2>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Success Rate</p>
                  </div>
                </div>
              </div>

            </div>

            {/* Recent Call Logs Table */}
            <div className="nm-flat" style={{ padding: '24px', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>Recent Call Log Activity</h3>
              <div className="nm-inset" style={{ borderRadius: '16px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '12px 16px' }}>Reminder</th>
                      <th style={{ padding: '12px 16px' }}>Call Timestamp</th>
                      <th style={{ padding: '12px 16px' }}>Outcome Status</th>
                      <th style={{ padding: '12px 16px' }}>Actions Taken</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insights.recent_logs.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>No call history logged yet.</td>
                      </tr>
                    ) : (
                      insights.recent_logs.map(log => (
                        <tr key={log.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.02)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600 }}>{log.title}</td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{new Date(log.call_time).toLocaleString()}</td>
                          <td style={{ padding: '12px 16px' }}>
                            <span 
                              className="badge" 
                              style={{ 
                                padding: '3px 8px', 
                                borderRadius: '4px',
                                backgroundColor: log.call_status === 'Completed' ? 'var(--success-light)' : log.call_status === 'Snoozed' ? 'var(--warning-light)' : 'var(--danger-light)',
                                color: log.call_status === 'Completed' ? 'var(--success)' : log.call_status === 'Snoozed' ? 'var(--warning)' : 'var(--danger)'
                              }}
                            >
                              {log.call_status}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{log.action_taken}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* Tab 4: Delegated & Shared Reminders */}
        {activeTab === 'delegated' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, overflowY: 'auto' }}>
            <div className="nm-flat" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>Assign Calls to Team Members & Family</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                When the scheduled time arrives, CallMind will ring their phones directly instead of yours. You can track their response compliance below.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {reminders.filter(r => r.assigned_to_phone).length === 0 ? (
                <div className="nm-inset" style={{ padding: '48px', gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-secondary)', borderRadius: '24px' }}>
                  <Users size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
                  <p style={{ fontWeight: 600 }}>No delegated reminders scheduled.</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Use the "Create Manual" tab and supply a recipient phone number to delegate.</p>
                </div>
              ) : (
                reminders.filter(r => r.assigned_to_phone).map(rem => (
                  <div key={rem.id} className="nm-flat-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="badge badge-work">Delegated</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)' }}>{rem.priority} Priority</span>
                    </div>

                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{rem.title}</h3>
                    
                    <div className="nm-inset" style={{ padding: '10px', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <p style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                        <UserCheck size={14} /> Assigned to: <strong>{rem.assigned_to_phone}</strong>
                      </p>
                      <p style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                        <Clock size={14} /> Due: {new Date(rem.due_time).toLocaleString()}
                      </p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', marginTop: '6px' }}>
                      <span>Call Status: <strong style={{ color: rem.status === 'Completed' ? 'var(--success)' : rem.status === 'Missed' ? 'var(--danger)' : 'var(--accent)' }}>{rem.status}</strong></span>
                      <button className="nm-btn" style={{ padding: '6px 12px', color: 'var(--danger)' }} onClick={() => deleteReminder(rem.id)}>
                        Recall Alert
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Settings Panel */}
        {activeTab === 'settings' && (
          <div className="nm-flat" style={{ padding: '32px', maxWidth: '750px', margin: '0 auto', width: '100%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              
              {/* Voice Settings Section */}
              <div style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.05)', paddingBottom: '24px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🗣️ Caller Voice Configuration
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Configure the text-to-speech voice when CallMind rings you. Pick a voice that sounds natural to you.
                </p>
                
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Select System Voice</label>
                    <select 
                      className="nm-input" 
                      style={{ width: '100%', cursor: 'pointer', padding: '12px 16px' }}
                      value={selectedVoiceName}
                      onChange={(e) => setSelectedVoiceName(e.target.value)}
                    >
                      {voices.map(v => (
                        <option key={v.name} value={v.name}>
                          {cleanVoiceName(v.name)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button 
                    type="button" 
                    className="nm-btn" 
                    style={{ padding: '12px 20px', gap: '8px', color: 'var(--accent)' }}
                    onClick={playVoiceSample}
                  >
                    <Volume2 size={16} />
                    <span>Test Voice Sound</span>
                  </button>
                </div>

                {selectedVoiceName && (
                  <div className="nm-inset" style={{ padding: '12px', borderRadius: '12px', marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                        {cleanVoiceName(selectedVoiceName)}
                      </p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {getVoiceSecondaryName(
                          selectedVoiceName, 
                          voices.find(v => v.name === selectedVoiceName)?.lang || 'en-US'
                        )}
                      </p>
                    </div>
                    <span className="badge badge-health" style={{ textTransform: 'none' }}>Active Voice Selected</span>
                  </div>
                )}
              </div>

              {/* Theme / Appearance Section */}
              <div style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.05)', paddingBottom: '24px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🎨 Appearance & Themes
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Choose your default color palette interface mode.
                </p>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <button 
                    type="button"
                    className={`nm-btn ${theme === 'light' ? 'active' : ''}`}
                    style={{ flex: 1, padding: '16px', gap: '10px' }}
                    onClick={() => setTheme('light')}
                  >
                    <Sun size={20} color={theme === 'light' ? 'var(--accent)' : 'inherit'} />
                    <span style={{ fontWeight: 600 }}>Light Soft-morphism</span>
                  </button>

                  <button 
                    type="button"
                    className={`nm-btn ${theme === 'dark' ? 'active' : ''}`}
                    style={{ flex: 1, padding: '16px', gap: '10px' }}
                    onClick={() => setTheme('dark')}
                  >
                    <Moon size={20} color={theme === 'dark' ? 'var(--accent)' : 'inherit'} />
                    <span style={{ fontWeight: 600 }}>Dark Soft-morphism</span>
                  </button>
                </div>
              </div>



            </div>
          </div>
        )}

      </main>

      {/* Standalone Desktop In-App VoIP Call Simulator Overlay */}
      {currentCall && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(15px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'fadeIn 0.25s ease'
        }}>
          
          <div className="nm-flat" style={{
            width: '380px',
            background: 'var(--bg-secondary)',
            borderRadius: '32px',
            padding: '32px',
            textAlign: 'center',
            boxShadow: '15px 15px 30px rgba(0, 0, 0, 0.3), -15px -15px 30px rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            
            {/* Call State: Ringing vs Active */}
            {!isCallActive ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                <div style={{ position: 'relative', margin: '20px 0' }}>
                  {/* Double Ringing pulse wave */}
                  <div className="ringing-circle" style={{
                    width: '96px',
                    height: '96px',
                    borderRadius: '50%',
                    background: 'var(--accent-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent)'
                  }}>
                    <PhoneCall className="shake-icon" size={44} />
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>Incoming Reminder Call</h4>
                  <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '6px 0', color: 'var(--text-primary)' }}>{currentCall.title}</h2>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Priority: {currentCall.priority} | CallMind Automated Voice</p>
                </div>

                <div style={{ display: 'flex', gap: '32px', width: '100%', justifyContent: 'center', marginTop: '30px' }}>
                  {/* Decline button */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                    <button 
                      className="nm-btn nm-btn-circle" 
                      style={{ background: 'var(--danger)', color: 'white', border: 'none', width: '60px', height: '60px' }}
                      onClick={declineCall}
                    >
                      <PhoneOff size={24} />
                    </button>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Decline</span>
                  </div>

                  {/* Accept button */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                    <button 
                      className="nm-btn nm-btn-circle" 
                      style={{ background: 'var(--success)', color: 'white', border: 'none', width: '60px', height: '60px', animation: 'scaleUp 1s infinite alternate' }}
                      onClick={acceptCall}
                    >
                      <Phone size={24} />
                    </button>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Accept</span>
                  </div>
                </div>
              </div>
            ) : (
              // Call Active Screen
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '12px' }}>
                  <div style={{ textAlign: 'left' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{currentCall.title}</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }}></span>
                      Active call (0:08)
                    </p>
                  </div>
                  <Volume2 size={24} className={ttsActive ? 'shake-icon' : ''} color="var(--accent)" />
                </div>

                {/* Live Speech Dialogue Logger */}
                <div className="nm-inset" style={{ height: '180px', overflowY: 'auto', padding: '16px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left', fontSize: '0.85rem' }}>
                  {callTranscript.map((log, idx) => (
                    <div key={idx} style={{ alignSelf: log.sender === 'Ashutosh' ? 'flex-end' : 'flex-start' }}>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: log.sender === 'Ashutosh' ? 'right' : 'left' }}>{log.sender}</p>
                      <div style={{ 
                        background: log.sender === 'Ashutosh' ? 'var(--accent-light)' : 'var(--bg-primary)',
                        color: log.sender === 'Ashutosh' ? 'var(--accent)' : 'var(--text-primary)',
                        padding: '8px 12px',
                        borderRadius: '12px',
                        marginTop: '2px',
                        fontWeight: 500,
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word'
                      }}>
                        {log.text}
                      </div>
                    </div>
                  ))}
                </div>

                {/* STT Microphone visual status */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', minHeight: '32px' }}>
                  {isListening ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 600 }}>
                      <Mic size={14} className="shake-icon" />
                      Listening for voice response...
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      Speak or use the keypad controls below.
                    </span>
                  )}
                </div>

                {/* Voice Commands Guide */}
                <div className="nm-inset" style={{ padding: '12px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '4px solid var(--accent)', marginBottom: '10px' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', margin: 0 }}>
                    🗣️ Voice Commands Guide
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem', textAlign: 'left', padding: '0 4px' }}>
                    <p style={{ margin: 0 }}>Say <strong>"Mark Done"</strong> or <strong>"Complete"</strong> to finish.</p>
                    <p style={{ margin: 0 }}>Say <strong>"Snooze"</strong> or <strong>"Later"</strong> to call back in 2 mins.</p>
                  </div>
                </div>

                {/* Keypad Fallback Options */}
                <div className="nm-inset" style={{ padding: '12px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>Response Keypad Options</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button className="nm-btn" style={{ padding: '10px', fontSize: '0.8rem', gap: '4px' }} onClick={() => handleKeypress('1')}>
                      <strong style={{ color: 'var(--warning)' }}>Press 1</strong> Snooze
                    </button>
                    <button className="nm-btn" style={{ padding: '10px', fontSize: '0.8rem', gap: '4px' }} onClick={() => handleKeypress('2')}>
                      <strong style={{ color: 'var(--success)' }}>Press 2</strong> Mark Done
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: '10px' }}>
                  <button 
                    className="nm-btn" 
                    style={{ background: 'var(--danger)', color: 'white', border: 'none', padding: '12px 32px', borderRadius: '24px', width: '100%', gap: '8px' }}
                    onClick={declineCall}
                  >
                    <PhoneOff size={16} />
                    <span>Hang Up</span>
                  </button>
                </div>

              </div>
            )}

          </div>
        </div>
      )}

    </div>
  </div>
  );
}
