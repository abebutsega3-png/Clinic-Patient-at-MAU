import { useEffect, useRef, useState } from 'react';
import { Bell, CalendarCheck, ChevronDown, Globe, LayoutDashboard, LockKeyhole, LogOut, Menu, Pill, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { dismissNotification, fetchMyNotifications, markNotificationRead } from '../../utile/clinicheadapprovalApi.jsx';

const DispensaryNavbar = ({ onToggleSidebar }) => {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const [language, setLanguage] = useState(() => localStorage.getItem('dispensary-language') || 'en');
  const profileRef = useRef(null);
  const notificationRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
        setNotificationsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('dispensary-language', language);
  }, [language]);

  useEffect(() => {
    const handleLanguageChange = (event) => setLanguage(event.detail);
    window.addEventListener('dispensary-language-change', handleLanguageChange);
    return () => window.removeEventListener('dispensary-language-change', handleLanguageChange);
  }, []);

  const loadNotifications = async () => {
    setNotificationsLoading(true);
    setNotificationError('');
    try {
      const result = await fetchMyNotifications(token);
      setNotifications(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      console.error('Failed to load dispensary notifications:', error);
      setNotificationError(error.response?.data?.message || 'Unable to load notifications.');
    } finally {
      setNotificationsLoading(false);
    }
  };

  const toggleNotifications = () => {
    if (!notificationsOpen) void loadNotifications();
    setNotificationsOpen((open) => !open);
    setProfileOpen(false);
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.readAt) {
      try {
        await markNotificationRead(notification._id, token);
        setNotifications((current) => current.map((item) => (
          item._id === notification._id ? { ...item, readAt: new Date().toISOString() } : item
        )));
      } catch (error) {
        console.error('Failed to mark dispensary notification as read:', error);
        setNotificationError(error.response?.data?.message || 'Unable to mark this notification as read.');
        return;
      }
    }
    setNotificationsOpen(false);
    if (notification.targetPath?.startsWith('/dispensary/')) navigate(notification.targetPath);
    else if (notification.targetPath?.startsWith('/')) navigate(notification.targetPath);
  };

  const handleDismissNotification = async (event, notification) => {
    event.stopPropagation();
    try {
      await dismissNotification(notification._id, token);
      setNotifications((current) => current.filter((item) => item._id !== notification._id));
      setNotificationError('');
    } catch (error) {
      console.error('Failed to dismiss dispensary notification:', error);
      setNotificationError(error.response?.data?.message || 'Unable to dismiss this notification.');
    }
  };

  const handleLogout = () => {
    setProfileOpen(false);
    logout();
    navigate('/login');
  };

  const displayName = user?.name || user?.username || 'Dispensary User';
  const displayRole = user?.activeRole || user?.role || 'Dispensary';

  return (
    <header className="sticky top-0 z-10 flex min-h-[72px] items-center justify-between gap-4 bg-gradient-to-r from-blue-950 via-blue-900 to-blue-800 px-4 text-white shadow-sm sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
          className="rounded-lg p-2 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white lg:hidden"
        >
          <Menu size={21} aria-hidden="true" />
        </button>
        <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/10 sm:flex"><Pill size={21} aria-hidden="true" /></span>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-medium uppercase tracking-wide text-blue-200">MAU Clinic Management System</p>
          <p className="truncate text-sm font-semibold sm:text-base">Welcome, {displayName}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => setLanguage((current) => current === 'en' ? 'am' : 'en')}
          aria-label={language === 'am' ? 'Change language to English' : 'ቋንቋ ይቀይሩ'}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/30 px-2.5 py-1.5 text-xs font-semibold transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          <Globe size={15} aria-hidden="true" />
          <span>{language === 'am' ? 'አማ' : 'EN'}</span>
        </button>

        <div className="relative" ref={notificationRef}>
          <button
            type="button"
            onClick={toggleNotifications}
            aria-expanded={notificationsOpen}
            aria-label={language === 'am' ? 'ማሳወቂያዎች' : 'Notifications'}
            className="relative rounded-full p-2 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <Bell size={20} aria-hidden="true" />
            {notifications.some((item) => !item.readAt) && (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-400 ring-2 ring-blue-900" />
            )}
          </button>
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-2xl">
              <div className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-800">
                {language === 'am' ? 'ማሳወቂያዎች' : 'Notifications'}
              </div>
              <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                {notificationError && <p role="alert" className="p-3 text-xs text-rose-600">{notificationError}</p>}
                {notificationsLoading ? (
                  <p className="p-5 text-center text-xs text-slate-500">Loading notifications…</p>
                ) : notifications.length ? notifications.map((item) => (
                  <article key={item._id} className={`p-3 text-xs ${!item.readAt ? 'bg-blue-50/50' : ''}`}>
                    <button type="button" onClick={() => void handleNotificationClick(item)} className="w-full text-left">
                      <p className="font-semibold text-slate-800">{item.title}</p>
                      <p className="mt-1 text-slate-500">{item.message}</p>
                    </button>
                    <button
                      type="button"
                      onClick={(event) => void handleDismissNotification(event, item)}
                      className="mt-2 text-[11px] font-semibold text-slate-500 hover:text-rose-600"
                    >
                      Dismiss
                    </button>
                  </article>
                )) : !notificationError && (
                  <p className="p-5 text-center text-xs text-slate-500">No notifications yet.</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative shrink-0" ref={profileRef}>
          <button
            type="button"
            onClick={() => setProfileOpen((open) => !open)}
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            aria-label="Profile menu"
            className="flex items-center gap-2 rounded-xl border border-white/30 p-1.5 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-white/15 text-blue-100">
              {user?.profileImage
                ? <img src={user.profileImage} alt="" className="h-full w-full object-cover" />
                : <Pill size={17} aria-hidden="true" />}
            </span>
            <span className="hidden max-w-[150px] text-left sm:block">
              <span className="block truncate text-xs font-bold">{displayName}</span>
              <span className="block truncate text-[10px] capitalize text-blue-100">{displayRole}</span>
            </span>
            <ChevronDown size={14} className={`hidden transition-transform sm:block ${profileOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>

          {profileOpen && (
            <div role="menu" className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 text-slate-700 shadow-2xl">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                <p className="truncate text-xs font-bold text-slate-800">{displayName}</p>
                {user?.email && <p className="truncate text-[11px] text-slate-500">{user.email}</p>}
                <span className="mt-2 inline-block rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold capitalize text-blue-800">
                  {displayRole}
                </span>
              </div>
              <div className="py-1">
              <Link
                to="/dispensary"
                role="menuitem"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <LayoutDashboard size={15} className="text-slate-400" aria-hidden="true" />
                <span>My Dashboard</span>
              </Link>
              <Link
                to="/dispensary/profile"
                role="menuitem"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <UserRound size={15} className="text-slate-400" aria-hidden="true" />
                <span>{language === 'am' ? 'መገለጫ ይመልከቱ' : 'View Profile'}</span>
              </Link>
              <Link
                to="/dispensary/change-password"
                role="menuitem"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <LockKeyhole size={15} className="text-slate-400" aria-hidden="true" />
                <span>{language === 'am' ? 'የይለፍ ቃል ይቀይሩ' : 'Change Password'}</span>
              </Link>
              <Link
                to="/dispensary/attendance"
                role="menuitem"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-3 px-4 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <CalendarCheck size={15} className="text-slate-400" aria-hidden="true" />
                <span>My Attendance</span>
              </Link>
              </div>
              <div className="border-t border-slate-100 py-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                >
                  <LogOut size={15} aria-hidden="true" />
                  <span>{language === 'am' ? 'ውጣ' : 'Sign Out'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default DispensaryNavbar;
