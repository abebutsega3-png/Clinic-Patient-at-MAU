import {
  BarChart3,
  ChevronRight,
  ClipboardList,
  LayoutDashboard,
  Package,
  Pill,
  ReceiptText,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

const navigationGroups = [
  {
    label: 'Prescriptions & Dispensing',
    icon: ClipboardList,
    items: [
      { label: 'Pending Orders (Queue)', path: '/dispensary/pending-orders' },
      { label: 'Dispense Medicine', path: '/dispensary/dispense' },
      { label: 'Dispensing History', path: '/dispensary/history' },
    ],
  },
  {
    label: 'Dispensary Inventory',
    icon: Package,
    items: [
      { label: 'Stock List', path: '/dispensary/stock' },
      { label: 'Batch & Expiry Tracker', path: '/dispensary/batches' },
      { label: 'Low Stock Alerts', path: '/dispensary/low-stock' },
    ],
  },
  {
    label: 'Store Requisition',
    icon: ReceiptText,
    items: [
      { label: 'New Request to Store', path: '/dispensary/requisitions/new' },
      { label: 'Request History', path: '/dispensary/requisitions' },
    ],
  },
  {
    label: 'Reports',
    icon: BarChart3,
    items: [
      { label: 'Daily Sales/Issue Log', path: '/dispensary/reports/daily' },
      { label: 'Expiry Report', path: '/dispensary/reports/expiry' },
    ],
  },
];

const DispensaryRoomSidebar = ({ isOpen = true, onNavigate }) => (
  <aside className={`fixed left-0 top-0 z-30 flex h-screen w-64 flex-col overflow-hidden bg-gradient-to-b from-blue-950 to-slate-950 text-slate-300 shadow-xl transition-transform duration-200 ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
    <div className="flex items-center gap-3 border-b border-blue-800/60 px-5 py-5 text-white">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
        <Pill size={21} aria-hidden="true" />
      </div>
      <div>
        <h2 className="text-sm font-bold tracking-wide">PHARMACY / DISPENSARY</h2>
        <span className="text-[11px] font-medium text-blue-200">Bahir Dar University</span>
      </div>
    </div>

    <nav aria-label="Pharmacy and Dispensary navigation" className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
      <NavLink
        to="/dispensary"
        end
        onClick={onNavigate}
        className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:bg-blue-900/70 hover:text-white'}`}
      >
        <LayoutDashboard size={18} className="shrink-0" aria-hidden="true" />
        <span>Dispensary Dashboard</span>
      </NavLink>

      {navigationGroups.map(({ label, icon: Icon, items }) => (
        <section key={label} aria-label={label}>
          <h3 className="mb-1 flex items-center gap-2 px-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <Icon size={15} aria-hidden="true" />
            {label}
          </h3>
          <div className="ml-5 space-y-0.5 border-l border-slate-800 pl-2">
            {items.map(({ label: itemLabel, path }) => (
              <NavLink
                key={path}
                to={path}
                onClick={onNavigate}
                className={({ isActive }) => `flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium transition ${isActive ? 'bg-blue-600/25 text-blue-100' : 'text-slate-400 hover:bg-blue-900/70 hover:text-white'}`}
              >
                <ChevronRight size={13} aria-hidden="true" className="shrink-0 text-slate-600" />
                <span>{itemLabel}</span>
              </NavLink>
            ))}
          </div>
        </section>
      ))}
    </nav>
  </aside>
);

export default DispensaryRoomSidebar;