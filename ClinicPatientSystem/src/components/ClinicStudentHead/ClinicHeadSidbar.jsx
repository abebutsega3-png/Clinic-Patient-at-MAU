import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  FileText,
  Pill,
  BarChart3,
  Settings,
  Stethoscope
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
    <aside className={`fixed left-0 top-0 z-30 flex h-screen w-64 flex-col overflow-hidden bg-slate-900 text-slate-300 shadow-xl transition-transform duration-200 ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
      {/* Clinic Header Brand */}
      <div className="flex items-center gap-3 border-b border-slate-800 px-5 py-4 text-white">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white shadow-md">
          <Stethoscope size={22} />
        </div>
        <div>
          <h2 className="text-sm font-bold tracking-wide">CLINIC HEAD</h2>
          <span className="text-[10px] text-teal-400 block font-medium">Medical Management</span>
        </div>
      </div>

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
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-900/30'
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