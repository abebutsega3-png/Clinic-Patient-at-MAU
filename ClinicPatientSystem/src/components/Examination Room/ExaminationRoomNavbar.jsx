import { useEffect, useState } from 'react';
import { CalendarDays, LogOut, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const Navbar = ({ activeItem, onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const userName = user?.name || 'Examination Room User';
  const initials = userName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  return (
    <header className="sticky top-0 z-10 flex min-h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 text-[#102b56] shadow-sm sm:px-5">
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
          className="rounded-lg p-2 text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700 lg:hidden"
        >
          <Menu size={21} aria-hidden="true" />
        </button>
        <h1 className="truncate text-sm font-extrabold tracking-tight sm:text-lg">
          Examination Room – {activeItem || 'Dashboard'}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-2 text-[10px] sm:gap-4 sm:text-xs">
        <span className="hidden items-center gap-1.5 font-semibold text-emerald-700 sm:inline-flex">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Live Updates
        </span>
        <span className="hidden items-center gap-1.5 text-slate-600 md:inline-flex">
          <CalendarDays size={15} className="text-slate-500" aria-hidden="true" />
          {new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(now)}
        </span>
        <div className="flex items-center gap-2 border-l border-slate-200 pl-2 sm:pl-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-blue-600 text-xs font-bold text-white" aria-hidden="true">{initials}</span>
          <span className="hidden max-w-32 truncate font-bold sm:inline">{userName}</span>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Sign out"
            title="Sign out"
            className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700"
          >
            <LogOut size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
