import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  FileText,
  Pill,
  BarChart3,
  Settings
} from 'lucide-react';

const ClinicHeadSidebar = ({ isOpen = true, onNavigate }) => {
  const menuItems = [
    { label: 'Dashboard', path: '/clinic-head', icon: LayoutDashboard, end: true },
    { label: 'Approvals & Requests', path: '/clinic-head/approvals', icon: CheckSquare },
    { label: 'Staff Management', path: '/clinic-head/staff', icon: Users },
    { label: 'Patient Flow and Records', path: '/clinic-head/patients', icon: FileText },
    { label: 'Pharmacy & Inventory Control', path: '/clinic-head/inventory', icon: Pill },
    { label: 'Reports & Analytics', path: '/clinic-head/reports', icon: BarChart3 },
    { label: 'Settings', path: '/clinic-head/settings', icon: Settings },
  ];

  return (
    <aside className={`fixed left-0 top-16 z-30 flex h-[calc(100vh-4rem)] w-64 flex-col overflow-hidden bg-gradient-to-b from-blue-950 to-slate-950 text-slate-300 shadow-xl transition-transform duration-200 ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
      {/* Navigation Menu Links */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto px-4 py-5 scrollbar-thin scrollbar-thumb-slate-700">
        {menuItems.map(({ label, path, icon: Icon, end }) => (
          <NavLink
            key={path}
            to={path}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-150 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                  : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
              }`
            }
          >
            <Icon size={18} className="shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default ClinicHeadSidebar;