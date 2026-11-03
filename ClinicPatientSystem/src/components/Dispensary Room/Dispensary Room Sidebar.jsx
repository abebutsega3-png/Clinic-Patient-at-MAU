import React from 'react';
import {
  BarChart3,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  Package,
  ReceiptText,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

const navigationGroups = [
  {
    id: 'prescriptions',
    label: 'Prescriptions & Dispensing',
    icon: ClipboardList,
    path: '/dispensary/pending-orders',
  },
  {
    id: 'inventory',
    label: 'Dispensary Inventory',
    icon: Package,
    path: '/dispensary/stock',
  },
  {
    id: 'requisition',
    label: 'Store Requisition',
    icon: ReceiptText,
    path: '/dispensary/requisitions',
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: BarChart3,
    path: '/dispensary/reports/daily',
  },
];

const DispensaryRoomSidebar = ({ isOpen = true, onNavigate }) => {
  return (
    <aside
      className={`fixed left-0 top-0 z-30 flex h-screen w-64 flex-col overflow-hidden bg-[#0B1E36] text-slate-300 shadow-xl transition-transform duration-200 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}
    >
      {/* 1. Header & MAU Branding */}
      <div className="flex items-center gap-3 border-b border-slate-700/60 px-5 py-4 text-white">
        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center p-1 border border-amber-400/50 flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-[#0B1E36] font-bold text-xs shadow">
            MAU
          </div>
        </div>
        <div>
          <h2 className="text-xs font-bold tracking-wide leading-tight">PHARMACY / DISPENSARY</h2>
          <p className="text-[11px] text-amber-400 font-medium leading-tight">Mekdela Amba University</p>
        </div>
      </div>

      {/* 2. Navigation Menu */}
      <nav aria-label="Pharmacy and Dispensary navigation" className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
        {/* Main Dashboard Link */}
        <NavLink
          to="/dispensary"
          end
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-semibold transition ${
              isActive
                ? 'bg-sky-600 text-white shadow-md'
                : 'text-slate-300 hover:bg-[#162A45] hover:text-white'
            }`
          }
        >
          <div className="flex items-center gap-3">
            <LayoutDashboard size={16} className="shrink-0" aria-hidden="true" />
            <span>Dispensary Dashboard</span>
          </div>
          <ChevronRight size={14} className="text-slate-400" />
        </NavLink>

        {/* Categories Links (No sub-items array) */}
        {navigationGroups.map(({ id, label, icon: Icon, path }) => (
          <NavLink
            key={id}
            to={path}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-semibold transition ${
                isActive
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-[#162A45] hover:text-white'
              }`
            }
          >
            <div className="flex items-center gap-3">
              <Icon size={16} className="shrink-0 text-sky-400" aria-hidden="true" />
              <span>{label}</span>
            </div>
            <ChevronRight size={14} className="text-slate-400" />
          </NavLink>
        ))}
      </nav>

      {/* 3. Footer Branding */}
      <div className="border-t border-slate-800 bg-[#071324] p-3 text-center">
        <p className="text-[11px] font-semibold text-slate-200">Mekdela Amba University</p>
        <p className="text-[10px] font-bold text-amber-400 italic">( MAU Clinic )</p>
      </div>
    </aside>
  );
};

export default DispensaryRoomSidebar;