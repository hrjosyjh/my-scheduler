import React, { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import axios from 'axios';
import { FaCalendarPlus, FaTrash, FaCheck, FaTimes, FaSignOutAlt, FaLink, FaGlobe, FaLanguage, FaListUl, FaCalendarAlt, FaPlus, FaClock, FaCalendarCheck } from 'react-icons/fa';

// --- Multi-language Resources ---
const translations = {
  en: {
    appTitle: "📅 My Schedule",
    hello: "Hello",
    linkCalendar: "Add Calendar",
    addEvent: "Add Event",
    login: "Log In",
    signup: "Sign Up",
    username: "Username",
    password: "Password",
    createAccount: "Create Account",
    welcomeBack: "Welcome Back",
    alreadyAccount: "Already have an account?",
    noAccount: "Don't have an account?",
    logout: "Logout",
    newEvent: "New Event",
    editEvent: "Edit Event",
    title: "Title",
    desc: "Description",
    categoryColor: "Category Color",
    completed: "Completed",
    delete: "Delete",
    cancel: "Cancel",
    save: "Save",
    connect: "Connect",
    importCal: "Import External Calendar",
    importDesc: "Enter an iCal (.ics) URL from Google Calendar, Airbnb, etc.",
    calName: "Calendar Name",
    enterTitle: "Please enter a title.",
    confirmDelete: "Delete this event?",
    confirmDeleteCal: "Delete this calendar?",
    successSave: "Event saved!",
    successDel: "Event deleted!",
    connected: "External calendar connected!",
    viewCalendar: "Calendar",
    viewTodo: "To-Do List",
    quickAddPlaceholder: "Add a new task...",
    activeTasks: "Active Tasks",
    completedTasks: "Completed Tasks",
    noActiveTasks: "No active tasks. You're free! 🎉",
    noCompletedTasks: "No completed tasks yet.",
    selectDateTime: "Select Date & Time",
    myCalendars: "My Calendars",
    extCalendars: "External Calendars",
    mySchedule: "My Schedule"
  },
  ko: {
    appTitle: "📅 나의 일정 관리",
    hello: "안녕하세요",
    linkCalendar: "캘린더 추가",
    addEvent: "일정 추가",
    login: "로그인",
    signup: "회원가입",
    username: "아이디",
    password: "비밀번호",
    createAccount: "계정 생성",
    welcomeBack: "다시 오신 것을 환영해요",
    alreadyAccount: "이미 계정이 있으신가요?",
    noAccount: "계정이 없으신가요?",
    logout: "로그아웃",
    newEvent: "새 일정",
    editEvent: "일정 수정",
    title: "제목",
    desc: "상세 설명",
    categoryColor: "카테고리 색상",
    completed: "완료됨",
    delete: "삭제",
    cancel: "취소",
    save: "저장",
    connect: "연결하기",
    importCal: "외부 캘린더 가져오기",
    importDesc: "Google 캘린더 등의 iCal(.ics) 주소를 입력하세요.",
    calName: "캘린더 이름",
    enterTitle: "제목을 입력해주세요.",
    confirmDelete: "정말 삭제하시겠습니까?",
    confirmDeleteCal: "이 캘린더를 삭제하시겠습니까?",
    successSave: "일정이 저장되었습니다!",
    successDel: "일정이 삭제되었습니다!",
    connected: "외부 캘린더가 연결되었습니다!",
    viewCalendar: "달력 보기",
    viewTodo: "할 일 목록",
    quickAddPlaceholder: "새로운 할 일을 입력하세요...",
    activeTasks: "진행 중인 할 일",
    completedTasks: "완료된 할 일",
    noActiveTasks: "할 일이 없습니다. 자유를 즐기세요! 🎉",
    noCompletedTasks: "아직 완료된 할 일이 없습니다.",
    selectDateTime: "날짜 및 시간 선택",
    myCalendars: "내 캘린더",
    extCalendars: "구독한 캘린더",
    mySchedule: "기본 일정"
  }
};

const API_URL = 'http://localhost:3001/api';

// Helper to get local ISO string for datetime-local input
const getLocalISOString = (date = new Date()) => {
    const offset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date - offset)).toISOString().slice(0, 16);
    return localISOTime;
};

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  
  // Defensive: Ensure lang is valid
  const storedLang = localStorage.getItem('lang');
  const initialLang = (storedLang === 'en' || storedLang === 'ko') ? storedLang : 'ko';
  const [lang, setLang] = useState(initialLang);

  // Fallback for translations
  const t = translations[lang] || translations['ko'];

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  useEffect(() => {
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({ username: payload.username });
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      } catch (e) {
        console.error("Token invalid:", e);
        handleLogout();
      }
    }
  }, [token]);

  const toggleLang = () => {
    const newLang = lang === 'en' ? 'ko' : 'en';
    setLang(newLang);
    localStorage.setItem('lang', newLang);
  };

  const handleLogin = (newToken, username) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser({ username });
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
  };

  if (!user) {
    return <AuthScreen onLogin={handleLogin} t={t} lang={lang} toggleLang={toggleLang} />;
  }

  return <MainSchedule user={user} onLogout={handleLogout} t={t} lang={lang} toggleLang={toggleLang} />;
}

// --- Auth Component ---
function AuthScreen({ onLogin, t, lang, toggleLang }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const endpoint = isRegister ? '/auth/register' : '/auth/login';
    
    try {
      const res = await axios.post(`${API_URL}${endpoint}`, { username, password });
      if (isRegister) {
        alert(lang === 'ko' ? '가입 완료! 로그인해주세요.' : 'Registration successful! Please log in.');
        setIsRegister(false);
      } else {
        onLogin(res.data.token, res.data.username);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error occurred');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 relative p-4">
      <button 
        onClick={toggleLang} 
        className="absolute top-4 right-4 bg-white px-3 py-1 rounded shadow text-sm font-bold hover:bg-gray-50 flex items-center gap-2 z-10"
      >
        <FaLanguage className="text-lg"/> {lang === 'en' ? '한국어' : 'English'}
      </button>

      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-6 text-center text-indigo-600">
          {isRegister ? t.createAccount : t.welcomeBack}
        </h2>
        {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">{t.username}</label>
            <input 
              type="text" required 
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
              value={username} onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t.password}</label>
            <input 
              type="password" required 
              className="mt-1 block w-full border border-gray-300 rounded-md p-2"
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 transition">
            {isRegister ? t.signup : t.login}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          {isRegister ? t.alreadyAccount : t.noAccount}
          <button onClick={() => setIsRegister(!isRegister)} className="ml-1 text-indigo-600 font-semibold hover:underline">
            {isRegister ? t.login : t.signup}
          </button>
        </p>
      </div>
    </div>
  );
}

// --- Main Schedule Component ---
function MainSchedule({ user, onLogout, t, lang, toggleLang }) {
  const [events, setEvents] = useState([]);
  const [calendars, setCalendars] = useState([]);
  
  // Load visibility from LocalStorage on init
  const [visibleCalendars, setVisibleCalendars] = useState(() => {
      const saved = localStorage.getItem(`visible_calendars_${user.username}`);
      if (saved) {
          try {
              return new Set(JSON.parse(saved));
          } catch (e) {
              return new Set(['local']);
          }
      }
      return new Set(['local']);
  });

  const [viewMode, setViewMode] = useState('calendar');
  const [todoFilter, setTodoFilter] = useState('active'); // 'active' | 'completed' 

  const [modalOpen, setModalOpen] = useState(false);
  const [extModalOpen, setExtModalOpen] = useState(false);
  
  // Quick Add States
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickTaskDateTime, setQuickTaskDateTime] = useState(getLocalISOString());

  const [currentEvent, setCurrentEvent] = useState({
    id: null, title: '', start: '', end: '', allDay: false, description: '', color: '#3788d8', completed: false
  });
  const [extCalendar, setExtCalendar] = useState({ url: '', name: '', color: '#10b981' });
  const [isEditing, setIsEditing] = useState(false);
  const calendarRef = useRef(null);

  // Persist visibility changes
  useEffect(() => {
      localStorage.setItem(`visible_calendars_${user.username}`, JSON.stringify([...visibleCalendars]));
  }, [visibleCalendars, user.username]);

  useEffect(() => { 
      fetchEvents(); 
      fetchCalendars();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await axios.get(`${API_URL}/events`);
      if (response.data.message === 'success') setEvents(response.data.data);
    } catch (error) {
      if(error.response && error.response.status === 401) onLogout();
    }
  };

  const fetchCalendars = async () => {
      try {
          const response = await axios.get(`${API_URL}/calendars`);
          if (response.data.message === 'success') {
              const cals = response.data.data;
              setCalendars(cals);
              
              // If new calendars are found that aren't in LocalStorage yet, auto-enable them once
              const saved = localStorage.getItem(`visible_calendars_${user.username}`);
              if (!saved) {
                  setVisibleCalendars(prev => {
                      const next = new Set(prev);
                      cals.forEach(c => next.add(c.id));
                      return next;
                  });
              }
          }
      } catch (error) {
          console.error("Failed to fetch calendars");
      }
  };

  const deleteCalendar = async (e, id) => {
      e.stopPropagation();
      if (!window.confirm(t.confirmDeleteCal)) return;
      try {
          await axios.delete(`${API_URL}/calendars/${id}`);
          fetchCalendars();
          fetchEvents();
          setVisibleCalendars(prev => {
              const next = new Set(prev);
              next.delete(id);
              return next;
          });
      } catch { alert('Failed to delete calendar'); }
  };

  const toggleCalendarVisibility = (id) => {
      setVisibleCalendars(prev => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
      });
  };

  const saveEvent = async (eventToSave = currentEvent) => {
    if (!eventToSave.title) return alert(t.enterTitle);
    try {
      if (eventToSave.id) await axios.put(`${API_URL}/events/${eventToSave.id}`, eventToSave);
      else await axios.post(`${API_URL}/events`, eventToSave);
      setModalOpen(false);
      fetchEvents();
    } catch { alert('Failed'); }
  };

  const deleteEvent = async (id = currentEvent.id) => {
    if (!window.confirm(t.confirmDelete)) return;
    try {
      await axios.delete(`${API_URL}/events/${id}`);
      setModalOpen(false);
      fetchEvents();
    } catch { alert('Failed'); }
  };

  const toggleTaskStatus = async (event) => {
    const updatedEvent = { ...event, completed: !event.completed };
    try {
        await axios.put(`${API_URL}/events/${event.id}`, updatedEvent);
        fetchEvents();
    } catch { alert('Failed to update status'); }
  };

  const handleQuickAdd = async (e) => {
    e.preventDefault();
    if(!quickTaskTitle.trim()) return;
    
    const newTask = {
        title: quickTaskTitle,
        start: quickTaskDateTime,
        allDay: false, 
        description: '',
        color: '#3788d8',
        completed: false
    };
    try {
        await axios.post(`${API_URL}/events`, newTask);
        setQuickTaskTitle('');
        setQuickTaskDateTime(getLocalISOString()); 
        fetchEvents();
    } catch { alert('Error adding task'); }
  };

  const saveExternalCalendar = async () => {
    if(!extCalendar.url) return alert('URL required');
    try {
        const res = await axios.post(`${API_URL}/calendars`, extCalendar);
        setExtModalOpen(false);
        const newCalId = res.data.id;
        setExtCalendar({ url: '', name: '', color: '#10b981' });
        
        // Auto-enable newly added calendar
        setVisibleCalendars(prev => new Set(prev).add(newCalId));
        
        fetchCalendars();
        fetchEvents(); 
        alert(t.connected);
    } catch { alert('Failed'); }
  };

  // Filter events based on visible calendars
  const filteredEvents = events.filter(e => {
      if (e.id.toString().startsWith('ext-')) {
          const parts = e.id.toString().split('-');
          const calId = parseInt(parts[1], 10);
          return visibleCalendars.has(calId);
      } else {
          return visibleCalendars.has('local');
      }
  });

  const activeTasks = filteredEvents.filter(e => !e.completed && !e.id.toString().startsWith('ext-'));
  const completedTasks = filteredEvents.filter(e => e.completed && !e.id.toString().startsWith('ext-'));

  const formatDT = (isoStr) => {
      const d = new Date(isoStr);
      return `${d.toLocaleDateString()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-100 p-2 sm:p-4 font-sans flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 p-4 text-white flex justify-between items-center shadow-md flex-shrink-0 rounded-lg mb-2">
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">{t.appTitle}</h1>
            <div className="flex gap-2">
                 <button onClick={toggleLang} className="bg-indigo-700 px-3 py-1 rounded hover:bg-indigo-800 text-xs font-bold flex items-center gap-1">
                    <FaLanguage className="text-lg"/> {lang === 'en' ? '한글' : 'Eng'}
                </button>
                <button onClick={onLogout} className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-xs">
                    <FaSignOutAlt />
                </button>
            </div>
        </div>

        <div className="flex flex-1 overflow-hidden gap-4">
            {/* Sidebar (Calendar List) */}
            <div className="hidden lg:flex flex-col w-64 bg-white rounded-xl shadow-lg p-4 overflow-y-auto">
                <div className="mb-6">
                    <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-3">{t.myCalendars}</h3>
                    <div className="flex items-center gap-2 mb-2 p-2 rounded hover:bg-gray-50 cursor-pointer" onClick={() => toggleCalendarVisibility('local')}>
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${visibleCalendars.has('local') ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-gray-300'}`}>
                            {visibleCalendars.has('local') && <FaCheck className="text-xs" />}
                        </div>
                        <span className="text-sm font-medium text-gray-700">{t.mySchedule}</span>
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">{t.extCalendars}</h3>
                        <button onClick={() => setExtModalOpen(true)} className="text-indigo-600 hover:text-indigo-800 text-xs font-bold flex items-center gap-1">
                            <FaPlus /> {t.linkCalendar}
                        </button>
                    </div>
                    {calendars.length === 0 && <p className="text-xs text-gray-400 italic p-2">No calendars</p>}
                    {calendars.map(cal => (
                        <div key={cal.id} className="group flex items-center gap-2 mb-2 p-2 rounded hover:bg-gray-50 cursor-pointer" onClick={() => toggleCalendarVisibility(cal.id)}>
                             <div className={`w-5 h-5 rounded border flex items-center justify-center text-white`} 
                                  style={{
                                      backgroundColor: visibleCalendars.has(cal.id) ? cal.color : 'white',
                                      borderColor: cal.color
                                  }}>
                                {visibleCalendars.has(cal.id) && <FaCheck className="text-xs" />}
                            </div>
                            <span className="text-sm font-medium text-gray-700 truncate flex-1">{cal.name || 'Untitled'}</span>
                            <button 
                                onClick={(e) => deleteCalendar(e, cal.id)} 
                                className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition px-1"
                                title={t.delete}
                            >
                                <FaTrash className="text-xs" />
                            </button>
                        </div>
                    ))}
                </div>
                
                <div className="mt-auto pt-4 border-t">
                     <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                        <button onClick={() => setViewMode('calendar')} className={`flex-1 py-1.5 rounded-md text-xs font-bold flex justify-center items-center gap-1 ${viewMode === 'calendar' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:bg-gray-200'}`}>
                            <FaCalendarAlt /> {t.viewCalendar}
                        </button>
                        <button onClick={() => setViewMode('todo')} className={`flex-1 py-1.5 rounded-md text-xs font-bold flex justify-center items-center gap-1 ${viewMode === 'todo' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:bg-gray-200'}`}>
                            <FaListUl /> {t.viewTodo}
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 bg-white rounded-xl shadow-lg p-4 overflow-y-auto relative">
                {viewMode === 'calendar' && (
                    <>
                    <div className="flex justify-end gap-2 mb-4">
                         <button onClick={() => setExtModalOpen(true)} className="lg:hidden bg-gray-100 text-gray-700 px-3 py-2 rounded hover:bg-gray-200 text-sm font-bold border">
                            <FaGlobe />
                        </button>
                        <button onClick={() => {
                            setCurrentEvent({ id: null, title: '', start: getLocalISOString(), end: '', allDay: false, description: '', color: '#3788d8', completed: false });
                            setIsEditing(false);
                            setModalOpen(true);
                        }} className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 shadow-md text-sm font-bold flex items-center gap-2">
                            <FaCalendarPlus /> {t.addEvent}
                        </button>
                    </div>
                    <FullCalendar
                        ref={calendarRef}
                        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                        initialView="dayGridMonth"
                        locale={lang}
                        headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' }}
                        selectable={true}
                        editable={true}
                        events={filteredEvents}
                        select={(info) => {
                            setCurrentEvent({ id: null, title: '', start: info.startStr.length <= 10 ? info.startStr + "T09:00" : info.startStr, end: info.endStr, allDay: info.allDay, description: '', color: '#3788d8', completed: false });
                            setIsEditing(false);
                            setModalOpen(true);
                        }}
                        eventClick={(info) => {
                            const event = info.event;
                            if (!event.editable && event.id.startsWith('ext-')) return;
                            setCurrentEvent({
                                id: event.id, title: event.title, start: event.startStr.slice(0, 16), end: event.endStr ? event.endStr.slice(0, 16) : '', allDay: event.allDay,
                                description: event.extendedProps.description || '', color: event.backgroundColor, completed: event.extendedProps.completed || false
                            });
                            setIsEditing(true);
                            setModalOpen(true);
                        }}
                        eventContent={(info) => (
                            <div className={`flex items-center gap-1 px-1 overflow-hidden ${info.event.extendedProps.completed ? 'opacity-50 line-through' : ''}`}>
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor: info.event.backgroundColor}}></div>
                                <span className="truncate text-[10px] font-semibold">{info.timeText} {info.event.title}</span>
                            </div>
                        )}
                        height="100%"
                    />
                    </>
                )}

                {viewMode === 'todo' && (
                    <div className="max-w-3xl mx-auto py-4">
                        {/* Quick Add Form with Datetime Picker */}
                        <form onSubmit={handleQuickAdd} className="mb-6 flex flex-col md:flex-row gap-2 bg-indigo-50 p-4 rounded-xl shadow-inner border border-indigo-100">
                            <input 
                                type="text" 
                                className="flex-[2] border border-indigo-200 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder={t.quickAddPlaceholder}
                                value={quickTaskTitle}
                                onChange={(e) => setQuickTaskTitle(e.target.value)}
                            />
                            <div className="flex-1 flex items-center gap-2 bg-white border border-indigo-200 rounded-lg p-2">
                                <span className="text-gray-400 pl-2"><FaClock /></span>
                                <input 
                                    type="datetime-local"
                                    className="w-full focus:outline-none cursor-pointer text-sm"
                                    value={quickTaskDateTime}
                                    onChange={(e) => setQuickTaskDateTime(e.target.value)}
                                />
                            </div>
                            <button type="submit" className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-indigo-700 transition flex items-center justify-center gap-2">
                                <FaPlus /> {t.save}
                            </button>
                        </form>

                        {/* Filter Tabs */}
                        <div className="flex border-b border-gray-200 mb-6">
                            <button 
                                className={`flex-1 py-3 text-center font-bold text-sm transition border-b-2 ${todoFilter === 'active' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                onClick={() => setTodoFilter('active')}
                            >
                                {t.activeTasks} <span className="ml-1 bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full text-xs">{activeTasks.length}</span>
                            </button>
                            <button 
                                className={`flex-1 py-3 text-center font-bold text-sm transition border-b-2 ${todoFilter === 'completed' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                onClick={() => setTodoFilter('completed')}
                            >
                                {t.completedTasks} <span className="ml-1 bg-green-100 text-green-600 px-2 py-0.5 rounded-full text-xs">{completedTasks.length}</span>
                            </button>
                        </div>

                        {/* Task List */}
                        <div>
                            {todoFilter === 'active' && (
                                <div>
                                    {activeTasks.length === 0 ? (
                                        <p className="text-gray-400 text-center py-12 italic bg-gray-50 rounded-lg border border-dashed border-gray-200">{t.noActiveTasks}</p>
                                    ) : (
                                        <ul className="space-y-3">
                                            {activeTasks.map(task => (
                                                <li key={task.id} className="group flex items-center p-3 rounded-lg border border-gray-100 hover:border-indigo-200 hover:shadow-sm transition bg-white">
                                                    <button onClick={() => toggleTaskStatus(task)} className="w-6 h-6 border-2 border-gray-300 rounded-full mr-3 flex items-center justify-center hover:border-indigo-500 transition"></button>
                                                    <div className="flex-1 cursor-pointer" onClick={() => { 
                                                        setCurrentEvent({ ...task, start: task.start.slice(0, 16) }); 
                                                        setIsEditing(true); setModalOpen(true); 
                                                    }}>
                                                        <p className="font-medium text-gray-800">{task.title}</p>
                                                        <p className="text-[11px] text-indigo-500 font-bold flex items-center gap-1">
                                                            <FaClock className="text-[10px]"/> {formatDT(task.start)}
                                                        </p>
                                                    </div>
                                                    <button onClick={() => deleteEvent(task.id)} className="text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 px-2">
                                                        <FaTrash />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}

                            {todoFilter === 'completed' && (
                                <div className="opacity-80">
                                    {completedTasks.length === 0 ? (
                                        <p className="text-gray-400 text-center py-12 italic bg-gray-50 rounded-lg border border-dashed border-gray-200">{t.noCompletedTasks}</p>
                                    ) : (
                                        <ul className="space-y-3">
                                            {completedTasks.map(task => (
                                                <li key={task.id} className="group flex items-center p-3 rounded-lg border border-gray-100 bg-gray-50">
                                                    <button onClick={() => toggleTaskStatus(task)} className="w-6 h-6 border-2 border-green-500 bg-green-500 rounded-full mr-3 flex items-center justify-center text-white text-xs">
                                                        <FaCheck />
                                                    </button>
                                                    <div className="flex-1 line-through text-gray-400">
                                                        <p className="font-medium">{task.title}</p>
                                                        <p className="text-[10px]">{formatDT(task.start)}</p>
                                                    </div>
                                                    <button onClick={() => deleteEvent(task.id)} className="text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 px-2">
                                                        <FaTrash />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>

      {/* Common Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold mb-4">{isEditing ? t.editEvent : t.newEvent}</h2>
            
            <label className="block text-sm font-medium mb-1">{t.title}</label>
            <input className="w-full border p-2 rounded mb-3 focus:ring-2 focus:ring-indigo-500 outline-none" value={currentEvent.title} onChange={e => setCurrentEvent({...currentEvent, title: e.target.value})} />
            
            <label className="block text-sm font-medium mb-1">{t.selectDateTime}</label>
            <input 
                type="datetime-local" 
                className="w-full border p-2 rounded mb-3 focus:ring-2 focus:ring-indigo-500 outline-none" 
                value={currentEvent.start} 
                onChange={e => setCurrentEvent({...currentEvent, start: e.target.value})} 
            />

            <label className="block text-sm font-medium mb-1">{t.desc}</label>
            <textarea className="w-full border p-2 rounded mb-3 focus:ring-2 focus:ring-indigo-500 outline-none" rows="3" value={currentEvent.description} onChange={e => setCurrentEvent({...currentEvent, description: e.target.value})} />
            
            <div className="flex gap-4 mb-4">
                <div>
                    <label className="block text-sm font-medium mb-1">{t.categoryColor}</label>
                    <input type="color" className="h-10 w-20 cursor-pointer" value={currentEvent.color} onChange={e => setCurrentEvent({...currentEvent, color: e.target.value})} />
                </div>
                {isEditing && (
                    <div className="flex items-center pt-6">
                         <input type="checkbox" id="completed_modal" className="mr-2 h-4 w-4" checked={currentEvent.completed} onChange={e => setCurrentEvent({...currentEvent, completed: e.target.checked})} />
                         <label htmlFor="completed_modal">{t.completed}</label>
                    </div>
                )}
            </div>
            
            <div className="flex justify-between">
                {isEditing ? <button onClick={() => deleteEvent(currentEvent.id)} className="text-red-500 hover:text-red-700 font-bold">{t.delete}</button> : <div></div>}
                <div className="flex gap-2">
                    <button onClick={() => setModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">{t.cancel}</button>
                    <button onClick={() => saveEvent()} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">{t.save}</button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* External Modal */}
      {extModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><FaLink /> {t.importCal}</h2>
            <input className="w-full border p-2 rounded mb-3" placeholder="https://..." value={extCalendar.url} onChange={e => setExtCalendar({...extCalendar, url: e.target.value})} />
            <input className="w-full border p-2 rounded mb-3" placeholder={t.calName} value={extCalendar.name} onChange={e => setExtCalendar({...extCalendar, name: e.target.value})} />
            <input type="color" className="w-full h-10 p-1 rounded border mb-4 cursor-pointer" value={extCalendar.color} onChange={e => setExtCalendar({...extCalendar, color: e.target.value})} />
            <div className="flex justify-end gap-2">
                <button onClick={() => setExtModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">{t.cancel}</button>
                <button onClick={saveExternalCalendar} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">{t.connect}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
