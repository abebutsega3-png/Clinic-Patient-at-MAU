import { Menu, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const Navbar = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-10 flex min-h-[72px] items-center justify-between gap-4 bg-teal-700 px-4 text-white shadow-sm sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
          className="rounded-lg p-2 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white lg:hidden"
        >
          <Menu size={21} aria-hidden="true" />
        </button>
        <p className="truncate text-sm font-medium sm:text-base">
          Welcome, {user?.name || 'Admin'}
        </p>
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

export default Navbar;
