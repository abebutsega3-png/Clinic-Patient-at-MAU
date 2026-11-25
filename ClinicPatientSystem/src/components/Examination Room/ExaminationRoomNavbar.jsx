import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  Globe,
  LayoutDashboard,
  LogOut,
  LockKeyhole,
  Menu,
  Settings,
  Stethoscope,
  Trash2,
  UserRound,
} from 'lucide-react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import {
  dismissNotification,
  fetchMyNotifications,
  markNotificationRead,
} from '../../utile/clinicheadapprovalApi.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const Navbar = ({ onToggleSidebar, onNavigate }) => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [language, setLanguage] = useState(() => localStorage.getItem('examination-room-language') || 'en');
  const [languageOpen, setLanguageOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const languageRef = useRef(null);
  const notificationRef = useRef(null);
  const profileRef = useRef(null);
  const isAmharic = language === 'am';
  const displayName = user?.name || user?.username || 'Examination Room User';
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  const selectLanguage = (value) => {
    setLanguage(value);
    window.dispatchEvent(new CustomEvent('examination-room-language-change', { detail: value }));
  };

  useEffect(() => {
    localStorage.setItem('examination-room-language', language);
  }, [language]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!languageRef.current?.contains(event.target)) setLanguageOpen(false);
      if (!notificationRef.current?.contains(event.target)) setNotificationsOpen(false);
      if (!profileRef.current?.contains(event.target)) setProfileOpen(false);
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setLanguageOpen(false);
        setNotificationsOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
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
          console.error('Failed to load Examination Room notifications:', error);
          if (active) {
            setNotificationError(error.response?.data?.message || 'Unable to load notifications.');
          }
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

  const handleNotificationClick = async (notification) => {
    if (!notification.readAt) {
      try {
        await markNotificationRead(notification._id, token);
        setNotifications((current) => current.map((item) => (
          item._id === notification._id ? { ...item, readAt: new Date().toISOString() } : item
        )));
      } catch (error) {
        console.error('Failed to mark Examination Room notification as read:', error);
        setNotificationError(error.response?.data?.message || 'Unable to mark this notification as read.');
      }
    }
    setNotificationsOpen(false);
    if (notification.targetPath) navigate(notification.targetPath);
  };

  const handleDismissNotification = async (event, notification) => {
    event.stopPropagation();
    try {
      await dismissNotification(notification._id, token);
      setNotifications((current) => current.filter((item) => item._id !== notification._id));
      setNotificationError('');
    } catch (error) {
      console.error('Failed to dismiss Examination Room notification:', error);
      setNotificationError(error.response?.data?.message || 'Unable to dismiss this notification.');
    }
  };

  const handleLogout = () => {
    setProfileOpen(false);
    logout();
    navigate('/login', { replace: true });
  };

  const navigateToSection = (section) => {
    setProfileOpen(false);
    onNavigate?.(section);
  };

  const openPasswordChange = () => {
    setProfileOpen(false);
    navigate('/change-password');
  };

  return (
    <header className="sticky top-0 z-30 flex min-h-[72px] items-center justify-between gap-3 bg-teal-700 px-3 text-white shadow-sm sm:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
          className="rounded-lg p-2 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white lg:hidden"
        >
          <Menu size={21} aria-hidden="true" />
        </button>
        <p className="truncate text-sm font-semibold sm:text-base">
          {isAmharic ? `እንኳን ደህና መጡ፣ ${displayName}` : `Welcome, ${displayName}`}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
        <div className="relative" ref={languageRef}>
          <button
            type="button"
            onClick={() => setLanguageOpen((open) => !open)}
            aria-expanded={languageOpen}
            aria-label={isAmharic ? 'ቋንቋ ይቀይሩ' : 'Change language'}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/30 px-2.5 py-2 text-xs font-semibold transition hover:bg-white/10 sm:px-4"
          >
            <Globe size={17} aria-hidden="true" />
            <span className="hidden sm:inline">{isAmharic ? 'አማርኛ' : 'English'}</span>
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          {languageOpen && (
            <div className="absolute right-0 mt-2 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-slate-700 shadow-xl">
              {[
                ['en', 'English'],
                ['am', 'አማርኛ'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => { selectLanguage(value); setLanguageOpen(false); }}
                  className={`flex w-full items-center justify-between px-4 py-2 text-xs transition ${language === value ? 'bg-teal-50 font-bold text-teal-700' : 'hover:bg-slate-50'}`}
                >
                  {label}
                  {language === value && <CheckCircle2 size={14} aria-hidden="true" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative" ref={notificationRef}>
          <button
            type="button"
            onClick={() => setNotificationsOpen((open) => !open)}
            aria-expanded={notificationsOpen}
            aria-label={isAmharic ? 'ማሳወቂያዎች' : 'Notifications'}
            className="relative rounded-full border border-white/25 p-2.5 transition hover:bg-white/10"
          >
            <Bell size={19} aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-teal-700">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
                <h2 className="text-xs font-bold">{isAmharic ? 'ማሳወቂያዎች' : 'Notifications'}</h2>
                <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800">
                  {unreadCount} {isAmharic ? 'ያልተነበቡ' : 'unread'}
                </span>
              </div>
              <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                {notificationError && <p role="alert" className="p-3 text-xs text-rose-600">{notificationError}</p>}
                {notificationsLoading ? (
                  <p className="p-5 text-center text-xs text-slate-500">{isAmharic ? 'በመጫን ላይ…' : 'Loading notifications…'}</p>
                ) : notifications.length ? notifications.map((notification) => (
                  <article key={notification._id} className={`p-3 text-xs ${notification.readAt ? '' : 'bg-teal-50/40'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-slate-800">{notification.title || 'Notification'}</p>
                      <time className="shrink-0 text-[10px] text-slate-400">
                        {notification.createdAt ? new Date(notification.createdAt).toLocaleString() : ''}
                      </time>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-600">{notification.message || '—'}</p>
                    <div className="mt-2 flex items-center justify-end gap-2">
                      {notification.targetPath && (
                        <button
                          type="button"
                          onClick={() => void handleNotificationClick(notification)}
                          className="rounded-md bg-teal-50 px-2.5 py-1.5 text-[11px] font-semibold text-teal-700 hover:bg-teal-100"
                        >
                          {isAmharic ? 'ተመልከት' : 'View'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(event) => void handleDismissNotification(event, notification)}
                        aria-label={isAmharic ? 'ማሳወቂያን ያስወግዱ' : 'Dismiss notification'}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    </div>
                  </article>
                )) : !notificationError ? (
                  <p className="p-5 text-center text-xs text-slate-500">{isAmharic ? 'ማሳወቂያ የለም።' : 'No notifications yet.'}</p>
                ) : null}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((open) => !open)}
            aria-expanded={profileOpen}
            aria-label={isAmharic ? 'የመገለጫ ምናሌ' : 'Profile menu'}
            className="flex items-center gap-2 rounded-xl border border-white/35 px-2 py-1.5 transition hover:bg-white/10 sm:gap-3 sm:px-3"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border border-white/40 bg-white text-teal-700">
              {user?.profileImage
                ? <img src={user.profileImage} alt="" className="h-full w-full object-cover" />
                : <Stethoscope size={17} aria-hidden="true" />}
            </span>
            <span className="hidden max-w-36 text-left sm:block">
              <span className="block truncate text-xs font-bold">{displayName}</span>
              <span className="block truncate text-[10px] text-teal-100">{user?.activeRole || user?.role || 'Examination Room'}</span>
            </span>
            <ChevronDown size={15} className={`hidden transition-transform sm:block ${profileOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 text-slate-700 shadow-2xl">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                <p className="truncate text-xs font-bold text-slate-800">{displayName}</p>
                <p className="truncate text-[11px] text-slate-500">{user?.email || user?.username || ''}</p>
                <span className="mt-2 inline-block rounded-full bg-teal-100 px-2.5 py-0.5 text-[10px] font-bold capitalize text-teal-800">
                  {user?.activeRole || user?.role || 'Examination Room'}
                </span>
              </div>
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => navigateToSection('Dashboard')}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <LayoutDashboard size={15} className="text-slate-400" aria-hidden="true" />
                  {isAmharic ? 'ዳሽቦርድ' : 'My Dashboard'}
                </button>
                <button
                  type="button"
                  onClick={() => navigateToSection('My Profile')}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <UserRound size={15} className="text-slate-400" aria-hidden="true" />
                  {isAmharic ? 'መገለጫ ይመልከቱ' : 'View Profile'}
                </button>
                <button
                  type="button"
                  onClick={openPasswordChange}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <LockKeyhole size={15} className="text-slate-400" aria-hidden="true" />
                  {isAmharic ? 'የይለፍ ቃል ይቀይሩ' : 'Change Password'}
                </button>
                <button
                  type="button"
                  onClick={() => navigateToSection('Settings')}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <Settings size={15} className="text-slate-400" aria-hidden="true" />
                  {isAmharic ? 'የዳሽቦርድ ቅንብሮች' : 'Dashboard Settings'}
                </button>
              </div>
              <div className="border-t border-slate-100 py-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                >
                  <LogOut size={15} aria-hidden="true" />
                  {isAmharic ? 'ውጣ' : 'Sign out'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
