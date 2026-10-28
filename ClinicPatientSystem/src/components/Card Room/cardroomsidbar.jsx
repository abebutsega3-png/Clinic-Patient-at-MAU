import {
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  ShoppingCart,
  UserRound,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

const menuItems = [
  { label: 'Dashboard', path: '/card-room', icon: LayoutDashboard, end: true },
  { label: 'Register New Patient', path: '/card-room/patients', icon: UserRound, end: true },
  { label: 'Queue Management', path: '/card-room/queue', icon: ClipboardList },
  { label: 'Patient Card / Records', path: '/card-room/records', icon: FileText },
    { label: 'Requests & Procurement', path: '/card-room/requests-and-procurement', icon: ShoppingCart },
  { label: 'Reports', path: '/card-room/reports', icon: ClipboardList },
];

const CardRoomSidebar = ({ isOpen = true, onNavigate, onLogout }) => (
  <aside className={`fixed left-0 top-0 z-30 flex h-screen w-64 flex-col overflow-hidden bg-slate-950 text-slate-300 shadow-xl transition-transform duration-200 ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
    <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-5 text-white">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600">
        <ClipboardList size={21} aria-hidden="true" />
      </div>
      <div>
        <h2 className="text-sm font-bold tracking-wide">CARD ROOM</h2>
        <span className="text-[11px] font-medium text-teal-300">MAU Clinic</span>
      </div>
    </div>
    <nav aria-label="Card Room navigation" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {menuItems.map(({ label, path, icon: Icon, end }) => (
        <NavLink
          key={path}
          to={path}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
            isActive ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Icon size={18} className="shrink-0" aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
    <button
      type="button"
      onClick={onLogout}
      className="flex items-center gap-3 border-t border-slate-800 px-6 py-4 text-sm font-medium text-slate-300 transition hover:bg-slate-900 hover:text-white"
    >
      <LogOut size={18} aria-hidden="true" />
      Logout
    </button>
  </aside>
);

export default CardRoomSidebar;