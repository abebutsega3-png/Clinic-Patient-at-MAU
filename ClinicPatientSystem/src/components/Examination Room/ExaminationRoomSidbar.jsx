import {
  LayoutDashboard,
  Users,
  UserCheck,
  FlaskConical,
  Pill,
  FileText,
  Share2,
  BarChart3,
  User,
  LogOut,
  ChevronDown,
  Megaphone
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Sidebar({ activeItem, setActiveItem, isOpen = false, queueCount = 0, labRequestsCount = 0 }) {
  const navMenuItems = [
    { name: 'Dashboard', icon: LayoutDashboard },
    { name: 'Patient Queue', icon: Users, badge: queueCount },
    { name: 'Current Consultation', icon: UserCheck },
    { name: 'Lab Requests', icon: FlaskConical, badge: labRequestsCount },
    { name: 'Prescriptions', label: 'Prescriptions & Dispensing', icon: Pill },
    { name: 'Patient Records / History', icon: FileText },
    { name: 'Referrals', icon: Share2 },
    { name: 'Reports', icon: BarChart3 },
    { name: 'Announcements', icon: Megaphone },
  ];

  return (
    <aside className={`fixed left-0 top-0 z-30 flex h-screen w-64 flex-shrink-0 flex-col justify-between bg-[#0B1E36] text-slate-200 shadow-xl transition-transform duration-200 ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
      <div>
        {/* 1. Logo & System Title */}
        <div className="p-4 border-b border-slate-700/60 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center p-1 border border-amber-400/50">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-[#0B1E36] font-bold text-xs shadow">
              MAU
            </div>
          </div>
          <div>
            <h1 className="font-bold text-sm text-white tracking-wide leading-tight">
              MAU Clinic
            </h1>
            <p className="text-[11px] text-slate-300 font-medium leading-tight">
              Patient Flow System
            </p>
          </div>
        </div>

        {/* 2. Role Selector Card */}
        <div className="p-3">
          <div className="bg-[#162D4A] hover:bg-[#1E3B60] transition-colors rounded-lg p-2.5 border border-slate-700/50 flex items-center justify-between cursor-pointer group">
            <div className="flex items-center gap-2.5">
              <UserCheck className="w-5 h-5 text-sky-400" />
              <div className="text-left">
                <p className="text-xs font-semibold text-white leading-tight">
                  Examination Room
                </p>
                <p className="text-[10px] text-slate-400 leading-tight">
                  (Doctor / Clinician)
                </p>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-white transition-transform" />
          </div>
        </div>

        {/* 3. Navigation Links */}
        <nav className="px-2 space-y-1 mt-1">
          {navMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.name;
            return (
              <button
                key={item.name}
                onClick={() => setActiveItem && setActiveItem(item.name)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-md font-semibold'
                    : 'text-slate-300 hover:bg-[#162A45] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-white' : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">{item.label || item.name}</span>
                </div>
                {item.badge ? (
                  <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
          <Link
            to="/department-reports"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-[#162A45] hover:text-white"
          >
            <FileText className="w-4 h-4 text-slate-400" aria-hidden="true" />
            <span className="truncate">Department Report</span>
          </Link>
        </nav>
      </div>

      {/* 4. Footer Section */}
      <div>
        <div className="px-2 py-2 border-t border-slate-700/60 space-y-1">
          <button className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-[#162A45] hover:text-white rounded-lg transition-colors">
            <User className="w-4 h-4 text-slate-400" />
            <span>Profile</span>
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-[#162A45] hover:text-white rounded-lg transition-colors">
            <LogOut className="w-4 h-4 text-slate-400" />
            <span>Logout</span>
          </button>
        </div>

        {/* Institution Footer */}
        <div className="relative border-t border-slate-800 bg-[#071324] p-3 text-center overflow-hidden">
          <div className="relative z-10">
            <p className="text-[11px] font-semibold text-slate-200 tracking-wider">
              Mekelle University
            </p>
            <p className="text-[10px] font-bold text-amber-400 italic">
              ( MAU )
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}