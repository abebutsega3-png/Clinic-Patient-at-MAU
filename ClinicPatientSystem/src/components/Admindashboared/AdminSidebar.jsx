import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FaHospital } from 'react-icons/fa';
import {
  BarChart3,
  Building2,
  ClipboardList,
  Database,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  Settings,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const navigationGroups = [
  {
    title: 'Main',
    items: [
      { label: 'Dashboard', path: '/admin', icon: LayoutDashboard, end: true },
    ],
  },
  {
    title: 'Access Control',
    items: [
      { label: 'User Management', path: '/admin/users', icon: UsersRound },
      { label: 'Roles & Permissions', path: '/admin/roles-permissions', icon: ShieldCheck },
    ],
  },
  {
    title: 'Clinic Setup',
    items: [
      { label: 'Departments / Units', path: '/admin/departments', icon: Building2 },
      { label: 'Queue & Routing Settings', path: '/admin/queue', icon: ListOrdered },
      {
        label: 'Master Data',
        detail: 'Medicines · Lab Tests · Services',
        path: '/admin/master-data',
        icon: Database,
      },
    ],
  },
  {
    title: 'Monitoring',
    items: [
      { label: 'Reports & Analytics', path: '/admin/reports', icon: BarChart3 },
      { label: 'Audit Logs', path: '/admin/audit-logs', icon: ClipboardList },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Notifications', path: '/admin/notifications', icon: ClipboardList },
      {
        label: 'System Settings',
        detail: 'Backup & maintenance',
        path: '/admin/settings',
        icon: Settings,
      },
      { label: 'My Profile', path: '/admin/profile', icon: UserRound },
      { label: 'Logout', action: 'logout', icon: LogOut },
    ],
  },
];

const AdminSidebar = ({ isOpen = false, onNavigate }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
    onNavigate?.();
  };

  return (
    <aside className={`fixed left-0 top-0 z-30 flex h-screen w-64 flex-col overflow-hidden bg-[#0b192c] text-slate-300 shadow-lg shadow-slate-950/30 transition-transform duration-200 ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
      <div className="flex items-center gap-3 border-b border-slate-800 px-3 pb-3 pt-4 text-sm font-bold tracking-wider text-white">
        <FaHospital aria-hidden="true" className="h-10 w-10 rounded-lg bg-teal-600 p-2 text-white" />
        <div>
          MAU Clinic
          <span className="mt-1 block text-[10px] font-normal text-slate-400">
            Management System
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-4 py-4 scrollbar-thin scrollbar-thumb-slate-700">
        {navigationGroups.map(({ title, items }) => (
          <section key={title} aria-label={title}>
            <h2 className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {title}
            </h2>
            <div className="space-y-1">
              {items.map(({ label, detail, path, icon: Icon, end, action }) => (
                action === 'logout' ? (
                  <button
                    key={label}
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold transition duration-150 hover:bg-slate-800 hover:text-white"
                  >
                    <Icon aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                    {label}
                  </button>
                ) : (
                  <NavLink
                    key={path}
                    to={path}
                    end={end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `${isActive ? 'bg-teal-600 text-white shadow-sm' : 'hover:bg-slate-800 hover:text-white'} flex items-start gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition duration-150`
                    }
                  >
                    <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
                    <span className="min-w-0">
                      <span className="block">{label}</span>
                      {detail && (
                        <span className="mt-1 block text-[10px] font-normal leading-4 text-slate-400">
                          {detail}
                        </span>
                      )}
                    </span>
                  </NavLink>
                )
              ))}
            </div>
          </section>
        ))}
      </nav>
    </aside>
  );
};

export default AdminSidebar;
