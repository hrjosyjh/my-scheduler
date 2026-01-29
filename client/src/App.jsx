import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import axios from 'axios';
import { FaCalendarPlus, FaTrash, FaCheck, FaSignOutAlt, FaLink, FaLanguage, FaListUl, FaCalendarAlt, FaPlus, FaClock, FaBars, FaChevronLeft, FaChevronRight, FaEdit } from 'react-icons/fa';

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
    connectProviders: "Connect Providers",
    connectGoogle: "Connect Google",
    connectNaverWorks: "Connect NAVER WORKS",
    calendar: "Calendar",
    localCalendar: "Local",
    edit: "Edit",
    editCal: "Edit External Calendar",
    updatedCal: "External calendar updated!",
    mySchedule: "My Schedule",
    today: "Today",
    month: "Month",
    week: "Week",
    day: "Day",
    menu: "Menu"
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
    connectProviders: "계정 연결",
    connectGoogle: "Google 연결",
    connectNaverWorks: "NAVER WORKS 연결",
    calendar: "캘린더",
    localCalendar: "로컬",
    edit: "수정",
    editCal: "외부 캘린더 수정",
    updatedCal: "외부 캘린더가 업데이트되었습니다!",
    mySchedule: "기본 일정",
    today: "오늘",
    month: "월",
    week: "주",
    day: "일",
    menu: "메뉴"
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
  const [token, setToken] = useState(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
    }
    return storedToken;
  });

  const user = useMemo(() => {
    if (!token) return null;
    try {
      const payloadPart = token.split('.')[1];
      if (!payloadPart) return null;
      const payload = JSON.parse(atob(payloadPart));
      if (!payload?.username) return null;
      return { username: payload.username };
    } catch (e) {
      console.error('Failed to parse auth token', e);
      return null;
    }
  }, [token]);
  
  // Defensive: Ensure lang is valid
  const storedLang = localStorage.getItem('lang');
  const initialLang = (storedLang === 'en' || storedLang === 'ko') ? storedLang : 'ko';
  const [lang, setLang] = useState(initialLang);

  useEffect(() => {
    document.documentElement.dataset.lang = lang;
    document.documentElement.dataset.theme = 'dark';
  }, [lang]);

  // Fallback for translations
  const t = translations[lang] || translations['ko'];

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  useEffect(() => {
    if (!token) {
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
      return;
    }

    try {
      const payloadPart = token.split('.')[1];
      if (!payloadPart) throw new Error('Invalid token');
      const payload = JSON.parse(atob(payloadPart));
      if (!payload?.username) throw new Error('Invalid token');

      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } catch (e) {
      console.error('Invalid auth token', e);
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  const toggleLang = () => {
    const newLang = lang === 'en' ? 'ko' : 'en';
    setLang(newLang);
    localStorage.setItem('lang', newLang);
  };

  const handleLogin = (newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
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
    <div className="min-h-screen flex items-center justify-center app-auth-bg relative p-4">
      <button 
        onClick={toggleLang} 
        className="absolute top-4 right-4 app-iconbtn flex items-center gap-2 z-10"
      >
        <FaLanguage className="text-lg"/> {lang === 'en' ? '한국어' : 'English'}
      </button>

      <div className="app-auth-card w-full max-w-sm">
        <h2 className="text-2xl font-bold mb-6 text-center text-slate-900">
          {isRegister ? t.createAccount : t.welcomeBack}
        </h2>
        {error && <div className="bg-red-100 text-red-700 p-2 rounded mb-4 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">{t.username}</label>
            <input 
              type="text" required 
              className="mt-1 block w-full app-field"
              value={username} onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t.password}</label>
            <input 
              type="password" required 
              className="mt-1 block w-full app-field"
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="w-full app-primarybtn py-2">
            {isRegister ? t.signup : t.login}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          {isRegister ? t.alreadyAccount : t.noAccount}
          <button onClick={() => setIsRegister(!isRegister)} className="ml-1 text-blue-700 font-semibold hover:underline">
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
  const [connectedCalendars, setConnectedCalendars] = useState([]);
  
  // Load visibility from LocalStorage on init
  const [visibleCalendars, setVisibleCalendars] = useState(() => {
      const saved = localStorage.getItem(`visible_calendars_${user.username}`);
      if (saved) {
           try {
                return new Set(JSON.parse(saved));
             } catch {
                 return new Set(['local']);
             }
      }
      return new Set(['local']);
  });

  const [hiddenExternalEventIds, setHiddenExternalEventIds] = useState(() => {
      const saved = localStorage.getItem(`hidden_external_events_${user.username}`);
      if (!saved) return new Set();
      try {
          const parsed = JSON.parse(saved);
          if (!Array.isArray(parsed)) return new Set();
          return new Set(parsed.map(String));
      } catch {
          return new Set();
      }
  });

  const [externalOverrideMap, setExternalOverrideMap] = useState(() => {
      const saved = localStorage.getItem(`external_overrides_${user.username}`);
      if (!saved) return {};
      try {
          const parsed = JSON.parse(saved);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
          return parsed;
      } catch {
          return {};
      }
  });

  const [viewMode, setViewMode] = useState('calendar');
  const [todoFilter, setTodoFilter] = useState('active'); // 'active' | 'completed' 

  const [modalOpen, setModalOpen] = useState(false);
  const [extModalOpen, setExtModalOpen] = useState(false);
  const [extIsEditing, setExtIsEditing] = useState(false);
  const [extEditId, setExtEditId] = useState(null);
  
  // Quick Add States
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickTaskDateTime, setQuickTaskDateTime] = useState(getLocalISOString());

  const [currentEvent, setCurrentEvent] = useState({
    id: null, connectedCalendarId: '', title: '', start: '', end: '', allDay: false, description: '', color: '#3788d8', completed: false
  });
  const [extCalendar, setExtCalendar] = useState({ url: '', name: '', color: '#10b981' });
  const [isEditing, setIsEditing] = useState(false);
  const calendarRef = useRef(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [calendarView, setCalendarView] = useState('dayGridMonth');
  const [calendarTitle, setCalendarTitle] = useState('');

  // Persist visibility changes
  useEffect(() => {
      localStorage.setItem(`visible_calendars_${user.username}`, JSON.stringify([...visibleCalendars]));
  }, [visibleCalendars, user.username]);

  // Load per-user hidden/override state
  useEffect(() => {
      const hiddenSaved = localStorage.getItem(`hidden_external_events_${user.username}`);
      const overridesSaved = localStorage.getItem(`external_overrides_${user.username}`);

      if (hiddenSaved) {
          try {
              const parsed = JSON.parse(hiddenSaved);
              setHiddenExternalEventIds(new Set(Array.isArray(parsed) ? parsed.map(String) : []));
          } catch {
              setHiddenExternalEventIds(new Set());
          }
      } else {
          setHiddenExternalEventIds(new Set());
      }

      if (overridesSaved) {
          try {
              const parsed = JSON.parse(overridesSaved);
              setExternalOverrideMap(parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {});
          } catch {
              setExternalOverrideMap({});
          }
      } else {
          setExternalOverrideMap({});
      }
  }, [user.username]);

  useEffect(() => {
      localStorage.setItem(
          `hidden_external_events_${user.username}`,
          JSON.stringify([...hiddenExternalEventIds])
      );
  }, [hiddenExternalEventIds, user.username]);

  useEffect(() => {
      localStorage.setItem(
          `external_overrides_${user.username}`,
          JSON.stringify(externalOverrideMap)
      );
  }, [externalOverrideMap, user.username]);

  const fetchEvents = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/events`);
      if (response.data.message === 'success') setEvents(response.data.data);
    } catch (error) {
      if(error.response && error.response.status === 401) onLogout();
    }
  }, [onLogout]);

  const fetchCalendars = useCallback(async () => {
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
             console.error("Failed to fetch calendars", error);
         }
    }, [user.username]);

  const fetchConnectedCalendars = useCallback(async () => {
      try {
          const response = await axios.get(`${API_URL}/connected-calendars`);
          if (response.data.message === 'success') setConnectedCalendars(response.data.data || []);
      } catch (error) {
          if (error.response && error.response.status === 401) {
              onLogout();
              return;
          }
          // Non-fatal: user may not have any provider connected
      }
  }, [onLogout]);

  useEffect(() => {
      fetchEvents();
      fetchCalendars();

      const connectedProvider = new URLSearchParams(window.location.search).get('connected');
      fetchConnectedCalendars();
      if (connectedProvider) {
          const url = new URL(window.location.href);
          url.searchParams.delete('connected');
          window.history.replaceState({}, '', url.toString());
      }
  }, [fetchEvents, fetchCalendars, fetchConnectedCalendars]);

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
      const eventId = eventToSave.id?.toString();

      // External events are read-only; saving creates a local override and hides the external source event
      if (eventId && eventId.startsWith('ext-')) {
        const { id: _id, connectedCalendarId: _cc, ...payload } = eventToSave;
        const cleanTitle = (payload.title || '').replace(/^\[Ext\]\s*/i, '');
        const titleToSave = cleanTitle.trim() ? cleanTitle : payload.title;
        const res = await axios.post(`${API_URL}/events`, { ...payload, title: titleToSave });
        const newLocalId = res.data?.data?.id;

        setHiddenExternalEventIds(prev => {
          const next = new Set(prev);
          next.add(eventId);
          return next;
        });
        setExternalOverrideMap(prev => ({ ...prev, [eventId]: newLocalId }));

        setModalOpen(false);
        fetchEvents();
        return;
      }

      const { connectedCalendarId, ...payload } = eventToSave;
      if (eventToSave.id) {
          await axios.put(`${API_URL}/events/${eventToSave.id}`, payload);
      } else {
          const ccId = connectedCalendarId ? Number(connectedCalendarId) : null;
          await axios.post(`${API_URL}/events`, ccId ? { ...payload, connectedCalendarId: ccId } : payload);
      }
      setModalOpen(false);
      fetchEvents();
    } catch { alert('Failed'); }
  };

  const deleteEvent = async (id = currentEvent.id) => {
    if (!window.confirm(t.confirmDelete)) return;
    try {
      const eventId = id?.toString();
      if (eventId && eventId.startsWith('ext-')) {
        setHiddenExternalEventIds(prev => {
          const next = new Set(prev);
          next.add(eventId);
          return next;
        });
        setModalOpen(false);
        return;
      }

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
        if (extIsEditing) {
            await axios.put(`${API_URL}/calendars/${extEditId}`, extCalendar);
            setExtModalOpen(false);
            setExtIsEditing(false);
            setExtEditId(null);
            setExtCalendar({ url: '', name: '', color: '#10b981' });
            fetchCalendars();
            fetchEvents();
            alert(t.updatedCal);
            return;
        }

        const res = await axios.post(`${API_URL}/calendars`, extCalendar);
        setExtModalOpen(false);
        const newCalId = res.data.id;
        setExtCalendar({ url: '', name: '', color: '#10b981' });

        // Auto-enable newly added calendar
        setVisibleCalendars(prev => new Set(prev).add(newCalId));

        fetchCalendars();
        fetchEvents();
        alert(t.connected);
    } catch (err) {
        if (err.response?.status === 401) {
            onLogout();
            return;
        }
        alert(err.response?.data?.error || err.message || 'Failed');
    }
  };

  const openAddExternalCalendar = () => {
      setExtIsEditing(false);
      setExtEditId(null);
      setExtCalendar({ url: '', name: '', color: '#10b981' });
      setExtModalOpen(true);
  };

  const openEditExternalCalendar = (e, cal) => {
      e.stopPropagation();
      setExtIsEditing(true);
      setExtEditId(cal.id);
      setExtCalendar({ url: cal.url || '', name: cal.name || '', color: cal.color || '#10b981' });
      setExtModalOpen(true);
  };

  const closeExternalCalendarModal = () => {
      setExtModalOpen(false);
      setExtIsEditing(false);
      setExtEditId(null);
      setExtCalendar({ url: '', name: '', color: '#10b981' });
  };

  // Filter events based on visible calendars
  const filteredEvents = events.filter(e => {
      const id = e.id?.toString() || '';
      if (id.startsWith('ext-')) {
          if (hiddenExternalEventIds.has(id)) return false;
          const parts = id.split('-');
          const calId = parseInt(parts[1], 10);
          return visibleCalendars.has(calId);
      } else {
          return visibleCalendars.has('local');
      }
  });

  const activeTasks = filteredEvents.filter(e => !e.completed && !e.id.toString().startsWith('ext-') && !e.is_provider_linked);
  const completedTasks = filteredEvents.filter(e => e.completed && !e.id.toString().startsWith('ext-') && !e.is_provider_linked);

  const formatDT = (isoStr) => {
      const d = new Date(isoStr);
      return `${d.toLocaleDateString()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const withCalendarApi = (fn) => {
      const api = calendarRef.current?.getApi();
      if (!api) return;
      fn(api);
  };

  const handleToday = () => {
      withCalendarApi((api) => api.today());
  };

  const handlePrev = () => {
      withCalendarApi((api) => api.prev());
  };

  const handleNext = () => {
      withCalendarApi((api) => api.next());
  };

  const handleChangeView = (type) => {
      setCalendarView(type);
      withCalendarApi((api) => api.changeView(type));
  };

  const openNewEventModal = () => {
      setCurrentEvent({ id: null, connectedCalendarId: '', title: '', start: getLocalISOString(), end: '', allDay: false, description: '', color: '#3788d8', completed: false });
      setIsEditing(false);
      setModalOpen(true);
  };

  const connectProvider = async (provider) => {
      try {
          const res = await axios.get(`${API_URL}/oauth/${provider}/start`);
          if (res.data?.authUrl) {
              window.location.href = res.data.authUrl;
              return;
          }
          alert('Failed');
      } catch (err) {
          if (err.response?.status === 401) {
              onLogout();
              return;
          }
          alert(err.response?.data?.error || err.message || 'Failed');
      }
  };

  const SidebarContent = ({ compact }) => (
      <div className={`app-sidebar-inner ${compact ? 'compact' : ''}`}>
          <div className="app-sidebar-section">
              <h3 className="app-sidebar-label">{t.myCalendars}</h3>
              <button type="button" className="app-calrow" onClick={() => toggleCalendarVisibility('local')}
                  aria-pressed={visibleCalendars.has('local')}
              >
                  <span className="app-calcheck" aria-hidden="true">
                      <span className={`app-calcheckbox ${visibleCalendars.has('local') ? 'is-on' : ''}`}></span>
                  </span>
                  <span className="app-calname">{t.mySchedule}</span>
              </button>
          </div>

           <div className="app-sidebar-section">
                <div className="app-sidebar-rowhead">
                    <h3 className="app-sidebar-label">{t.extCalendars}</h3>
                    <button type="button" onClick={openAddExternalCalendar} className="app-linkbtn">
                        <FaPlus /> {t.linkCalendar}
                    </button>
                </div>
               {calendars.length === 0 && <p className="app-empty">No calendars</p>}
               {calendars.map(cal => (
                    <div key={cal.id} className="app-calrowwrap">
                        <button type="button" className="app-calrow" onClick={() => toggleCalendarVisibility(cal.id)}
                            aria-pressed={visibleCalendars.has(cal.id)}
                        >
                           <span className="app-calcheck" aria-hidden="true">
                               <span className={`app-calcheckbox ${visibleCalendars.has(cal.id) ? 'is-on' : ''}`} style={{ borderColor: cal.color, backgroundColor: visibleCalendars.has(cal.id) ? cal.color : 'transparent' }}></span>
                           </span>
                           <span className="app-calname" title={cal.name || 'Untitled'}>{cal.name || 'Untitled'}</span>
                        </button>
                        <button type="button" onClick={(e) => openEditExternalCalendar(e, cal)} className="app-editbtn" title={t.edit}>
                            <FaEdit />
                        </button>
                        <button type="button" onClick={(e) => deleteCalendar(e, cal.id)} className="app-delbtn" title={t.delete}>
                            <FaTrash />
                        </button>
                    </div>
                ))}
            </div>

           <div className="app-sidebar-section">
               <h3 className="app-sidebar-label">{t.connectProviders}</h3>
               <div className="app-provider-actions">
                   <button
                       type="button"
                       className="app-linkbtn w-full justify-center"
                        onClick={() => connectProvider('google')}
                   >
                       {t.connectGoogle}
                   </button>
                   <button
                       type="button"
                       className="app-linkbtn w-full justify-center"
                        onClick={() => connectProvider('naverworks')}
                   >
                       {t.connectNaverWorks}
                   </button>
               </div>
           </div>

          <div className="app-sidebar-footer">
              <div className="app-seg">
                  <button type="button" onClick={() => setViewMode('calendar')} className={`app-segbtn ${viewMode === 'calendar' ? 'is-on' : ''}`}>
                      <FaCalendarAlt /> {t.viewCalendar}
                  </button>
                  <button type="button" onClick={() => setViewMode('todo')} className={`app-segbtn ${viewMode === 'todo' ? 'is-on' : ''}`}>
                      <FaListUl /> {t.viewTodo}
                  </button>
              </div>
          </div>
      </div>
  );

  return (
    <div className="app-shell">
        <header className="app-topbar">
            <div className="app-topbar-left">
                <button type="button" className="app-iconbtn lg:hidden" onClick={() => setSidebarOpen(true)} aria-label={t.menu}>
                    <FaBars />
                </button>
                <div className="app-brand" title={t.appTitle}>{t.appTitle}</div>
            </div>

            <div className="app-topbar-center">
                {viewMode === 'calendar' && (
                    <>
                        <button type="button" onClick={handleToday} className="app-ghostbtn">{t.today}</button>
                        <div className="app-navgroup" role="group" aria-label="Calendar navigation">
                            <button type="button" onClick={handlePrev} className="app-iconbtn" aria-label="Previous">
                                <FaChevronLeft />
                            </button>
                            <button type="button" onClick={handleNext} className="app-iconbtn" aria-label="Next">
                                <FaChevronRight />
                            </button>
                        </div>
                        <div className="app-title" aria-live="polite">{calendarTitle}</div>
                        <div className="app-viewseg" role="group" aria-label="Calendar view">
                            <button type="button" onClick={() => handleChangeView('dayGridMonth')} className={`app-viewbtn ${calendarView === 'dayGridMonth' ? 'is-on' : ''}`}>{t.month}</button>
                            <button type="button" onClick={() => handleChangeView('timeGridWeek')} className={`app-viewbtn ${calendarView === 'timeGridWeek' ? 'is-on' : ''}`}>{t.week}</button>
                            <button type="button" onClick={() => handleChangeView('timeGridDay')} className={`app-viewbtn ${calendarView === 'timeGridDay' ? 'is-on' : ''}`}>{t.day}</button>
                        </div>
                    </>
                )}
                {viewMode === 'todo' && (
                    <div className="app-title">{t.viewTodo}</div>
                )}
            </div>

            <div className="app-topbar-right">
                <div className="hidden md:block">
                    <div className="app-seg">
                        <button type="button" onClick={() => setViewMode('calendar')} className={`app-segbtn ${viewMode === 'calendar' ? 'is-on' : ''}`}>
                            <FaCalendarAlt /> {t.viewCalendar}
                        </button>
                        <button type="button" onClick={() => setViewMode('todo')} className={`app-segbtn ${viewMode === 'todo' ? 'is-on' : ''}`}>
                            <FaListUl /> {t.viewTodo}
                        </button>
                    </div>
                </div>

                {viewMode === 'calendar' && (
                    <button type="button" onClick={openNewEventModal} className="app-primarybtn">
                        <FaCalendarPlus /> <span className="hidden sm:inline">{t.addEvent}</span>
                    </button>
                )}

                <button type="button" onClick={toggleLang} className="app-iconbtn" aria-label="Language">
                    <FaLanguage />
                </button>
                <button type="button" onClick={onLogout} className="app-iconbtn" aria-label={t.logout}>
                    <FaSignOutAlt />
                </button>
            </div>
        </header>

        <div className="app-body">
            <aside className="app-sidebar hidden lg:flex">
                <SidebarContent />
            </aside>

            <main className="app-main">
                {viewMode === 'calendar' && (
                    <div className="app-calendar">
                        <FullCalendar
                            ref={calendarRef}
                            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                            initialView="dayGridMonth"
                            locale={lang}
                            headerToolbar={false}
                            dayMaxEvents={3}
                            nowIndicator={true}
                            selectable={true}
                            editable={true}
                            events={filteredEvents}
                            datesSet={(arg) => {
                                setCalendarTitle(arg.view.title);
                                setCalendarView(arg.view.type);
                            }}
                            eventAllow={(_dropInfo, draggedEvent) => {
                                 return !draggedEvent.id.toString().startsWith('ext-');
                             }}
                             select={(info) => {
                                setCurrentEvent({ id: null, connectedCalendarId: '', title: '', start: info.startStr.length <= 10 ? info.startStr + "T09:00" : info.startStr, end: info.endStr, allDay: info.allDay, description: '', color: '#3788d8', completed: false });
                                setIsEditing(false);
                                setModalOpen(true);
                            }}
                             eventClick={(info) => {
                                  const event = info.event;
                                  const startValue = event.startStr.length <= 10 ? event.startStr + "T09:00" : event.startStr.slice(0, 16);
                                  const endValue = event.endStr
                                      ? (event.endStr.length <= 10 ? event.endStr + "T10:00" : event.endStr.slice(0, 16))
                                      : '';
                                  setCurrentEvent({
                                      id: event.id,
                                      connectedCalendarId: event.extendedProps.connected_calendar_id ? String(event.extendedProps.connected_calendar_id) : '',
                                      title: event.title,
                                      start: startValue,
                                      end: endValue,
                                      allDay: event.allDay,
                                      description: event.extendedProps.description || '',
                                      color: event.backgroundColor,
                                      completed: event.extendedProps.completed || false,
                                      isProviderLinked: !!event.extendedProps.is_provider_linked
                                  });
                                  setIsEditing(true);
                                  setModalOpen(true);
                              }}
                            eventContent={(info) => {
                                const isAllDay = info.event.allDay;
                                const eventColor = info.event.backgroundColor || info.event.borderColor || '#3b82f6';

                                return (
                                    <div
                                        className={`app-eventchip ${info.event.extendedProps.completed ? 'is-done' : ''}`}
                                        style={{ '--event-color': eventColor }}
                                    >
                                        {!isAllDay && info.timeText && <span className="app-eventtime">{info.timeText}</span>}
                                        <span className="app-eventtitle">{info.event.title}</span>
                                    </div>
                                );
                            }}
                            height="100%"
                        />
                    </div>
                )}

                {viewMode === 'todo' && (
                    <div className="app-todo">
                        <form onSubmit={handleQuickAdd} className="app-todoadd">
                            <input
                                type="text"
                                className="app-field flex-1"
                                placeholder={t.quickAddPlaceholder}
                                value={quickTaskTitle}
                                onChange={(e) => setQuickTaskTitle(e.target.value)}
                            />
                            <div className="app-dtwrap">
                                <span className="app-dticon" aria-hidden="true"><FaClock /></span>
                                <input
                                    type="datetime-local"
                                    className="app-dt"
                                    value={quickTaskDateTime}
                                    onChange={(e) => setQuickTaskDateTime(e.target.value)}
                                />
                            </div>
                            <button type="submit" className="app-primarybtn">
                                <FaPlus /> {t.save}
                            </button>
                        </form>

                        <div className="app-todotabs">
                            <button
                                type="button"
                                className={`app-tab ${todoFilter === 'active' ? 'is-on' : ''}`}
                                onClick={() => setTodoFilter('active')}
                            >
                                {t.activeTasks} <span className="app-count">{activeTasks.length}</span>
                            </button>
                            <button
                                type="button"
                                className={`app-tab ${todoFilter === 'completed' ? 'is-on' : ''}`}
                                onClick={() => setTodoFilter('completed')}
                            >
                                {t.completedTasks} <span className="app-count">{completedTasks.length}</span>
                            </button>
                        </div>

                        <div className="app-todolist">
                            {todoFilter === 'active' && (
                                <>
                                    {activeTasks.length === 0 ? (
                                        <p className="app-emptypanel">{t.noActiveTasks}</p>
                                    ) : (
                                        <ul className="app-tasklist">
                                            {activeTasks.map(task => (
                                                <li key={task.id} className="app-taskrow">
                                                    <button type="button" onClick={() => toggleTaskStatus(task)} className="app-checkbtn" aria-label="Toggle complete"></button>
                                                     <button type="button" className="app-taskbody" onClick={() => {
                                                         setCurrentEvent({
                                                             ...task,
                                                             connectedCalendarId: task.connected_calendar_id ? String(task.connected_calendar_id) : '',
                                                             start: task.start.slice(0, 16)
                                                         });
                                                         setIsEditing(true);
                                                         setModalOpen(true);
                                                     }}>
                                                        <div className="app-tasktitle">{task.title}</div>
                                                        <div className="app-taskmeta"><FaClock /> {formatDT(task.start)}</div>
                                                    </button>
                                                    <button type="button" onClick={() => deleteEvent(task.id)} className="app-delbtn" title={t.delete}>
                                                        <FaTrash />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </>
                            )}

                            {todoFilter === 'completed' && (
                                <>
                                    {completedTasks.length === 0 ? (
                                        <p className="app-emptypanel">{t.noCompletedTasks}</p>
                                    ) : (
                                        <ul className="app-tasklist">
                                            {completedTasks.map(task => (
                                                <li key={task.id} className="app-taskrow is-done">
                                                    <button type="button" onClick={() => toggleTaskStatus(task)} className="app-checkbtn is-on" aria-label="Toggle complete">
                                                        <FaCheck />
                                                    </button>
                                                     <button type="button" className="app-taskbody" onClick={() => {
                                                         setCurrentEvent({
                                                             ...task,
                                                             connectedCalendarId: task.connected_calendar_id ? String(task.connected_calendar_id) : '',
                                                             start: task.start.slice(0, 16)
                                                         });
                                                         setIsEditing(true);
                                                         setModalOpen(true);
                                                     }}>
                                                        <div className="app-tasktitle">{task.title}</div>
                                                        <div className="app-taskmeta"><FaClock /> {formatDT(task.start)}</div>
                                                    </button>
                                                    <button type="button" onClick={() => deleteEvent(task.id)} className="app-delbtn" title={t.delete}>
                                                        <FaTrash />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>

        <div className={`app-drawer-backdrop ${sidebarOpen ? 'is-open' : ''}`} onClick={() => setSidebarOpen(false)}></div>
        <aside className={`app-drawer ${sidebarOpen ? 'is-open' : ''}`} aria-hidden={!sidebarOpen}>
            <div className="app-drawer-top">
                <div className="app-drawer-title">{t.menu}</div>
                <button type="button" className="app-iconbtn" onClick={() => setSidebarOpen(false)} aria-label="Close">
                    X
                </button>
            </div>
            <SidebarContent compact={true} />
        </aside>

      {/* Common Modal */}
      {modalOpen && (
        <div className="app-modal-backdrop" role="dialog" aria-modal="true">
          <div className="app-modal">
            <h2 className="text-xl font-bold mb-4">{isEditing ? t.editEvent : t.newEvent}</h2>

            <label className="block text-sm font-medium mb-1">{t.calendar}</label>
            <select
              className="w-full app-field mb-3"
              value={currentEvent.connectedCalendarId || ''}
              disabled={isEditing}
              onChange={e => setCurrentEvent({ ...currentEvent, connectedCalendarId: e.target.value })}
            >
              <option value="">{t.localCalendar}</option>
              {connectedCalendars.filter(c => c.provider === 'google' && c.can_write && c.is_enabled).length > 0 && (
                <optgroup label="Google">
                  {connectedCalendars.filter(c => c.provider === 'google' && c.can_write && c.is_enabled).map(c => (
                    <option key={c.id} value={String(c.id)}>{c.name || c.provider_calendar_id}</option>
                  ))}
                </optgroup>
              )}
              {connectedCalendars.filter(c => c.provider === 'naverworks' && c.can_write && c.is_enabled).length > 0 && (
                <optgroup label="NAVER WORKS">
                  {connectedCalendars.filter(c => c.provider === 'naverworks' && c.can_write && c.is_enabled).map(c => (
                    <option key={c.id} value={String(c.id)}>{c.name || c.provider_calendar_id}</option>
                  ))}
                </optgroup>
              )}
            </select>
            
            <label className="block text-sm font-medium mb-1">{t.title}</label>
            <input className="w-full app-field mb-3" value={currentEvent.title} onChange={e => setCurrentEvent({...currentEvent, title: e.target.value})} />
            
            <label className="block text-sm font-medium mb-1">{t.selectDateTime}</label>
            <input 
                type="datetime-local" 
                className="w-full app-field mb-3" 
                value={currentEvent.start} 
                onChange={e => setCurrentEvent({...currentEvent, start: e.target.value})} 
            />

            <label className="block text-sm font-medium mb-1">{t.desc}</label>
            <textarea className="w-full app-field mb-3" rows="3" value={currentEvent.description} onChange={e => setCurrentEvent({...currentEvent, description: e.target.value})} />
            
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
                    <button onClick={() => setModalOpen(false)} className="app-ghostbtn">{t.cancel}</button>
                    <button onClick={() => saveEvent()} className="app-primarybtn">{t.save}</button>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* External Modal */}
      {extModalOpen && (
        <div className="app-modal-backdrop" role="dialog" aria-modal="true">
          <div className="app-modal">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">{extIsEditing ? <FaEdit /> : <FaLink />} {extIsEditing ? t.editCal : t.importCal}</h2>
            <input className="w-full app-field mb-3" placeholder="https://..." value={extCalendar.url} onChange={e => setExtCalendar({...extCalendar, url: e.target.value})} />
            <input className="w-full app-field mb-3" placeholder={t.calName} value={extCalendar.name} onChange={e => setExtCalendar({...extCalendar, name: e.target.value})} />
            <input type="color" className="w-full h-10 p-1 rounded app-field mb-4 cursor-pointer" value={extCalendar.color} onChange={e => setExtCalendar({...extCalendar, color: e.target.value})} />
            <div className="flex justify-end gap-2">
                <button onClick={closeExternalCalendarModal} className="app-ghostbtn">{t.cancel}</button>
                <button onClick={saveExternalCalendar} className="app-primarybtn">{extIsEditing ? t.save : t.connect}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
