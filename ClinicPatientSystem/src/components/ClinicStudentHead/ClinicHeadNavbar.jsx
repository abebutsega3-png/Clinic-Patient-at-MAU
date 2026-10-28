import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { 
  Bell, 
  Globe, 
  ChevronDown, 
  User, 
  Lock, 
  Settings, 
  LogOut, 
  Calendar,
  Menu,
  Stethoscope,
  CheckCircle2
} from 'lucide-react';
import { fetchMyNotifications, markNotificationRead } from '../../utile/clinicheadapprovalApi.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const ClinicHeadNavbar = ({ onToggleSidebar }) => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  
  // States
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [language, setLanguage] = useState(() => localStorage.getItem('clinic-head-language') || 'en');
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const profileRef = useRef(null);
  const notificationRef = useRef(null);
  const languageRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    localStorage.setItem('clinic-head-language', language);
  }, [language]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentDate(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
      if (languageRef.current && !languageRef.current.contains(event.target)) {
        setLanguageOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
        setNotificationsOpen(false);
        setLanguageOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    const loadNotifications = (showLoader = false) => {
      if (showLoader) setNotificationsLoading(true);
      setNotificationError('');
      return fetchMyNotifications(token)
        .then((result) => {
          if (active) setNotifications(Array.isArray(result.data) ? result.data : []);
        })
        .catch((error) => {
          console.error('Failed to load notifications:', error);
          if (active) setNotificationError(error.response?.data?.message || 'Unable to load notifications.');
        })
        .finally(() => {
          if (active && showLoader) setNotificationsLoading(false);
        });
    };
    void loadNotifications(true);
    const socket = io({ auth: { token } });
    socket.on('clinic:department-report-submitted', () => void loadNotifications());
    const refreshTimer = window.setInterval(() => void loadNotifications(), 30000);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      socket.disconnect();
    };
  }, [token]);

  const unreadNotificationCount = notifications.filter((item) => !item.readAt).length;

  const handleNotificationClick = async (notification) => {
    if (!notification.readAt) {
      try {
        await markNotificationRead(notification._id, token);
        setNotifications((current) => current.map((item) => (
          item._id === notification._id ? { ...item, readAt: new Date().toISOString() } : item
        )));
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
        setNotificationError(error.response?.data?.message || 'Unable to mark this notification as read.');
      }
    }
    if (notification.departmentReport) {
      setNotificationsOpen(false);
      navigate('/clinic-head/reports');
    }
  };
  const isAmharic = language === 'am';

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-teal-700 px-4 text-white shadow-sm sm:px-6">
      
      {/* Left Section: Sidebar Toggle & Welcome Message */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Mobile / Responsive Sidebar Toggle Button */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-lg p-2 text-white hover:bg-white/10 lg:hidden"
          aria-label="Toggle Sidebar"
        >
          <Menu size={20} />
        </button>

        {/* Dynamic Welcome Greeting */}
        <div className="flex flex-col">
          <h2 className="text-sm sm:text-base font-bold tracking-wide text-white flex items-center gap-2">
            <span>{isAmharic ? 'እንኳን ደህና መጡ፣' : 'Welcome back,'}</span>
            <span className="text-teal-200">{user?.name || user?.username || ''}</span>
          </h2>
          <p className="hidden md:block text-[11px] text-teal-100 font-normal">
            {isAmharic ? 'የክሊኒክ አስተዳደር እና ቁጥጥር' : 'Clinic Operational Overview'}
          </p>
        </div>
      </div>

      {/* Right Section: Actions & Profile */}
      <div className="flex items-center gap-2 sm:gap-4">

        {/* Date Display */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs font-medium text-teal-100 bg-teal-800/50 px-3 py-1.5 rounded-full border border-teal-600/50">
          <Calendar size={14} className="text-teal-300" />
          <span>{new Intl.DateTimeFormat(isAmharic ? 'am-ET' : 'en-US', { dateStyle: 'medium', timeZone: 'Africa/Addis_Ababa' }).format(currentDate)}</span>
        </div>

        {/* Language Switcher */}
        <div className="relative" ref={languageRef}>
          <button
            type="button"
            onClick={() => setLanguageOpen((open) => !open)}
            className="flex items-center gap-1.5 rounded-full border border-white/30 px-2.5 py-1 text-xs font-semibold hover:bg-white/10 transition"
            aria-expanded={languageOpen}
            aria-label={isAmharic ? 'ቋንቋ ይቀይሩ' : 'Change language'}
          >
            <Globe size={15} />
            <span>{language === 'am' ? 'አማርኛ' : 'EN'}</span>
            <ChevronDown size={13} />
          </button>

          {languageOpen && (
            <div className="absolute right-0 mt-2 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-slate-700 shadow-xl">
              <button
                type="button"
                onClick={() => { setLanguage('en'); setLanguageOpen(false); }}
                className={`flex w-full items-center justify-between px-4 py-2 text-xs transition ${language === 'en' ? 'bg-teal-50 text-teal-700 font-bold' : 'hover:bg-slate-50'}`}
              >
                <span>English</span>
                {language === 'en' && <CheckCircle2 size={14} className="text-teal-600" />}
              </button>
              <button
                type="button"
                onClick={() => { setLanguage('am'); setLanguageOpen(false); }}
                className={`flex w-full items-center justify-between px-4 py-2 text-xs transition ${language === 'am' ? 'bg-teal-50 text-teal-700 font-bold' : 'hover:bg-slate-50'}`}
              >
                <span>አማርኛ</span>
                {language === 'am' && <CheckCircle2 size={14} className="text-teal-600" />}
              </button>
            </div>
          )}
        </div>

        {/* Notification Bell */}
        <div className="relative" ref={notificationRef}>
          <button
            type="button"
            onClick={() => setNotificationsOpen((open) => !open)}
            className="relative rounded-full border border-white/20 p-2 text-white hover:bg-white/10 transition"
            aria-label={isAmharic ? 'ማሳወቂያዎች' : 'Notifications'}
            aria-expanded={notificationsOpen}
          >
            <Bell size={18} />
            {unreadNotificationCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-teal-700">
                {unreadNotificationCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50">
                <h3 className="text-xs font-bold text-slate-800">{isAmharic ? 'የክሊኒክ ማሳወቂያዎች' : 'Clinic Notifications'}</h3>
                <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800">{unreadNotificationCount} {isAmharic ? 'ያልተነበቡ' : 'unread'}</span>
              </div>
              <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
                {notificationError && <p role="alert" className="p-3 text-xs text-rose-600">{notificationError}</p>}
                {notificationsLoading ? <p className="p-5 text-center text-xs text-slate-500">{isAmharic ? 'በመጫን ላይ…' : 'Loading notifications…'}</p> : notifications.length ? notifications.map((item) => (
                  <button
                    type="button"
                    key={item._id}
                    onClick={() => handleNotificationClick(item)}
                    className={`block w-full p-3 text-left text-xs transition hover:bg-slate-50/80 ${!item.readAt ? 'bg-teal-50/30' : ''}`}
                  >
                    <div className="flex items-center justify-between font-semibold text-slate-800">
                      <span>{item.title}</span>
                      <span className="text-[10px] text-slate-400 font-normal">{new Date(item.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{item.message}</p>
                  </button>
                )) : (
                  <p className="p-5 text-center text-xs text-slate-500">{isAmharic ? 'ማሳወቂያ የለም።' : 'No notifications yet.'}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Clinic Head Profile Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((open) => !open)}
            className="flex items-center gap-2 rounded-xl border border-white/30 p-1.5 transition hover:bg-white/10"
            aria-expanded={profileOpen}
            aria-label={isAmharic ? 'የመገለጫ ምናሌ' : 'Profile menu'}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-950 font-bold text-teal-300 text-xs shadow-inner overflow-hidden">
              {user?.profileImage ? (
                <img src={user.profileImage} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <Stethoscope size={16} />
              )}
            </div>
            <div className="hidden text-left sm:block">
              <p className="max-w-[130px] truncate text-xs font-bold leading-tight">
                {user?.name || user?.username || ''}
              </p>
              <p className="text-[10px] text-teal-200 capitalize leading-tight">
                {user?.role ? user.role.replace('_', ' ') : ''}
              </p>
            </div>
            <ChevronDown size={14} className={`hidden transition-transform sm:block ${profileOpen ? 'rotate-180' : ''}`} />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 text-slate-700 shadow-2xl">
              <div className="border-b border-slate-100 px-4 py-3 bg-slate-50">
                <p className="font-bold text-slate-800 text-xs">{user?.name || user?.username}</p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                {user?.role && (
                  <span className="mt-2 inline-block rounded-full bg-teal-100 px-2.5 py-0.5 text-[10px] font-bold text-teal-800 capitalize">
                    {user.role.replace('_', ' ')}
                  </span>
                )}
              </div>

              <div className="py-1">
                <Link
                  to="/clinic-head/profile"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  <User size={15} className="text-slate-400" />
                  <span>{isAmharic ? 'መገለጫ ይመልከቱ' : 'View Profile'}</span>
                </Link>
                <Link
                  to="/clinic-head/change-password"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  <Lock size={15} className="text-slate-400" />
                  <span>{isAmharic ? 'የይለፍ ቃል ይቀይሩ' : 'Change Password'}</span>
                </Link>
                <Link
                  to="/clinic-head/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  <Settings size={15} className="text-slate-400" />
                  <span>{isAmharic ? 'የዳሽቦርድ ቅንብሮች' : 'Dashboard Settings'}</span>
                </Link>
              </div>

              <div className="border-t border-slate-100 py-1">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false);
                    logout();
                    navigate('/login', { replace: true });
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                >
                  <LogOut size={15} />
                  <span>{isAmharic ? 'ውጣ' : 'Sign Out'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};

export default ClinicHeadNavbar;