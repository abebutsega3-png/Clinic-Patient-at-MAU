import {
  LayoutDashboard,
  Users,
  UserCheck,
  FlaskConical,
  Pill,
  FileText,
  Share2,
  BarChart3,
  ClipboardList,
  History,
  Syringe,
  User,
  LogOut,
  ChevronDown,
  Settings,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Sidebar({ activeItem, setActiveItem, isOpen = false, queueCount = 0, labRequestsCount = 0 }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const navMenuItems = [
    { name: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { name: 'Patient Queue', label: 'Patient Queue', icon: Users, badge: queueCount },
    { name: 'Patient Examination', label: 'Patient Examination', icon: UserCheck },
    { name: 'Laboratory Requests', label: 'Laboratory Requests', icon: FlaskConical, badge: labRequestsCount },
    { name: 'Laboratory Results', label: 'Laboratory Results', icon: FlaskConical },
    { name: 'Prescriptions', label: 'Prescriptions', icon: Pill },
    { name: 'Patient Referrals', label: 'Patient Referrals', icon: Share2 },
    { name: 'Referral Registration Log Book', label: 'Referral Registration Log Book', icon: Share2 },
    { name: 'OPD Register', label: 'OPD Register', icon: ClipboardList },
    { name: 'Examination Reports', label: 'Examination Reports', icon: BarChart3 },
  ];

  return (
    <aside className={`fixed left-0 top-0 z-30 flex h-screen w-64 flex-shrink-0 flex-col justify-between bg-[#0B1E36] text-slate-200 shadow-xl transition-transform duration-200 ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
      <div className="min-h-0 flex-1 overflow-y-auto">
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
                  EXAMINATION ROOM
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
        <nav className="mt-1 space-y-1 px-2">
          {navMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.name;
            return (
              <button
                key={item.name}
                onClick={() => setActiveItem && setActiveItem(item.name)}
                className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-md font-semibold'
                    : 'text-slate-300 hover:bg-[#162A45] hover:text-white'
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? 'text-white' : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge ? (
                  <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 4. Footer Section */}
      <div className="shrink-0">
        <div className="px-2 py-2 border-t border-slate-700/60 space-y-1">
          <button className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-[#162A45] hover:text-white rounded-lg transition-colors">
            <User className="w-4 h-4 text-slate-400" />
            <span>My Profile</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveItem && setActiveItem('Settings')}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-[#162A45] hover:text-white rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4 text-slate-400" />
            <span>Settings</span>
          </button>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-[#162A45] hover:text-white rounded-lg transition-colors"
          >
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