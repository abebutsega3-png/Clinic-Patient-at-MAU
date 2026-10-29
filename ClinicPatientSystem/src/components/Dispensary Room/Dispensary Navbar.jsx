import { Menu, LogOut, Pill } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const DispensaryNavbar = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

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
          <p className="truncate text-sm font-semibold sm:text-base">Welcome, {user?.name || 'Dispensary User'}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-white/30 px-3 py-2 text-sm font-semibold transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        <LogOut size={17} aria-hidden="true" />
        <span className="hidden sm:inline">Sign out</span>
      </button>
    </header>
  );
};

export default DispensaryNavbar;
