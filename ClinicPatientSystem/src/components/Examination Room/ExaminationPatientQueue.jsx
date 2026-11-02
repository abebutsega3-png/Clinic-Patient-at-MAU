import React, { useState } from 'react';
import { 
  Users, UserCheck, Clock, CheckCircle2, AlertTriangle, Share2, FileText, 
  Search, Filter, RefreshCw, ChevronRight, Bell, Calendar, User, LogOut, LayoutDashboard, FlaskConical, Pill, BarChart3, ChevronDown, Menu 
} from 'lucide-react';

export default function PatientQueueDashboard() {
  const [activeTab, setActiveTab] = useState('Patient Queue');
  const [searchQuery, setSearchQuery] = useState('');

  const queueData = [
    { no: 1, queueNum: '001', mrn: 'MU-00123', name: 'Tsegaye Wondimu', ageSex: '24/M', studentId: 'MU-2025-0456', type: 'Emergency', status: 'Emergency', waitTime: '25 min', source: 'Card Room' },
    { no: 2, queueNum: '002', mrn: 'MU-00124', name: 'Abebe Kebede', ageSex: '22/M', studentId: 'MU-2025-0178', type: 'Waiting', status: 'Waiting', waitTime: '12 min', source: 'Card Room' },
    { no: 3, queueNum: '003', mrn: 'MU-00125', name: 'Selam Desta', ageSex: '20/F', studentId: 'MU-2025-0234', type: 'Waiting', status: 'Waiting', waitTime: '14 min', source: 'Card Room' },
    { no: 4, queueNum: '004', mrn: 'MU-00126', name: 'Daniel Assefa', ageSex: '23/M', studentId: 'MU-2025-0102', type: 'Waiting', status: 'Lab Return', waitTime: '15 min', source: 'Lab Return' },
    { no: 5, queueNum: '005', mrn: 'MU-00127', name: 'Mulugeta Hailu', ageSex: '21/M', studentId: 'MU-2025-0201', type: 'Waiting', status: 'Waiting', waitTime: '16 min', source: 'Card Room' },
  ];

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800 overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#0B1E36] text-slate-200 flex flex-col justify-between shadow-xl flex-shrink-0">
        <div>
          <div className="p-4 border-b border-slate-700/60 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center p-1 border border-amber-400/50">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-[#0B1E36] font-bold text-xs shadow">
                MAU
              </div>
            </div>
            <div>
              <h1 className="font-bold text-sm text-white tracking-wide leading-tight">MAU Clinic</h1>
              <p className="text-[11px] text-slate-300 font-medium leading-tight">Patient Flow System</p>
            </div>
          </div>

          <div className="p-3">
            <div className="bg-[#162D4A] rounded-lg p-2.5 border border-slate-700/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <UserCheck className="w-5 h-5 text-sky-400" />
                <div>
                  <p className="text-xs font-semibold text-white">Examination Room</p>
                  <p className="text-[10px] text-slate-400">(Doctor / Clinician)</p>
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </div>
          </div>

          <nav className="px-2 space-y-1 mt-1">
            {[
              { name: 'Dashboard', icon: LayoutDashboard },
              { name: 'Patient Queue', icon: Users, badge: 5 },
              { name: 'Current Consultation', icon: UserCheck },
              { name: 'Lab Requests', icon: FlaskConical, badge: 1 },
              { name: 'Prescriptions', icon: Pill },
              { name: 'Patient Records / History', icon: FileText },
              { name: 'Referrals', icon: Share2 },
              { name: 'Reports', icon: BarChart3 },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => setActiveTab(item.name)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    isActive ? 'bg-sky-600 text-white shadow-md font-semibold' : 'text-slate-300 hover:bg-[#162A45] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div>
          <div className="px-2 py-2 border-t border-slate-700/60 space-y-1">
            <button className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-[#162A45] rounded-lg">
              <User className="w-4 h-4" /> Profile
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-[#162A45] rounded-lg">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
          <div className="bg-[#071324] p-3 text-center border-t border-slate-800">
            <p className="text-[11px] font-semibold text-slate-200">Mekelle University</p>
            <p className="text-[10px] font-bold text-amber-400 italic">( MAU )</p>
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* NAVBAR */}
        <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-sm flex-shrink-0">
          <div className="flex items-center gap-4">
            <button className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100">
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-base font-bold text-slate-800">Examination Room - Patient Queue</h2>
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-600">
            <div className="flex items-center gap-2 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-700 font-semibold">Live Updates</span>
            </div>
            <div className="flex items-center gap-2 text-slate-500 font-medium">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Tue, Oct 19, 2026 10:45 AM</span>
            </div>
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-xs">
                DR
              </div>
              <span className="font-bold text-slate-700">Dr. Alemu</span>
            </div>
          </div>
        </header>

        {/* DASHBOARD CONTENT */}
        <main className="flex-1 p-6 overflow-auto space-y-6 bg-slate-100">
          
          {/* STATS CARDS */}
          <div className="grid grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div><p className="text-xl font-bold">12</p><p className="text-xs text-slate-500">Waiting</p></div>
              <Users className="w-6 h-6 text-sky-600" />
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div><p className="text-xl font-bold">8</p><p className="text-xs text-slate-500">In Consultation</p></div>
              <UserCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div><p className="text-xl font-bold">25</p><p className="text-xs text-slate-500">Completed Today</p></div>
              <CheckCircle2 className="w-6 h-6 text-purple-600" />
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between bg-rose-50/40">
              <div><p className="text-xl font-bold text-rose-600">2</p><p className="text-xs text-rose-500">Emergency</p></div>
              <AlertTriangle className="w-6 h-6 text-rose-600 animate-bounce" />
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div><p className="text-lg font-bold">7 min</p><p className="text-xs text-slate-500">Avg Waiting Time</p></div>
              <Clock className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div><p className="text-xl font-bold">3</p><p className="text-xs text-slate-500">Referrals Today</p></div>
              <Share2 className="w-6 h-6 text-sky-600" />
            </div>
          </div>

          {/* EMERGENCY ALERT BANNER */}
          <div className="bg-rose-600 text-white p-3 rounded-xl flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
              <span className="text-xs font-bold">Emergency Patient: Tsegaye Wondimu (Queue #1) - Please Attend Immediately!</span>
            </div>
            <span className="text-xs underline cursor-pointer font-semibold">View Details →</span>
          </div>

          {/* MAIN QUEUE SECTION & QUICK ACTIONS */}
          <div className="grid grid-cols-3 gap-6">
            
            {/* Queue Table (2 columns) */}
            <div className="col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-600"/> Patient Queue (FIFO + Priority)
                </h3>
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-emerald-700 font-bold">Live</span>
                  <RefreshCw className="w-3.5 h-3.5 text-slate-400 cursor-pointer ml-2"/>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5"/>
                  <input 
                    type="text" 
                    placeholder="Search by Name, MRN or Student ID..." 
                    className="w-full pl-9 pr-3 py-1.5 text-xs border rounded-lg bg-slate-50"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <select className="text-xs border rounded-lg px-2 py-1.5 bg-white text-slate-600">
                  <option>All Status</option>
                </select>
                <select className="text-xs border rounded-lg px-2 py-1.5 bg-white text-slate-600">
                  <option>All Priority</option>
                </select>
                <button className="px-3 py-1.5 bg-sky-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5"/> Filter
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                      <th className="pb-2">#</th>
                      <th className="pb-2">Queue #</th>
                      <th className="pb-2">MRN</th>
                      <th className="pb-2">Name</th>
                      <th className="pb-2">Age/Sex</th>
                      <th className="pb-2">Student ID</th>
                      <th className="pb-2">Type</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2">Wait Time</th>
                      <th className="pb-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {queueData.map((item) => (
                      <tr key={item.no} className="hover:bg-slate-50">
                        <td className="py-2.5 font-medium">{item.no}</td>
                        <td className="py-2.5 font-bold text-sky-700">{item.queueNum}</td>
                        <td className="py-2.5 text-slate-500">{item.mrn}</td>
                        <td className="py-2.5 font-semibold text-slate-800">{item.name}</td>
                        <td className="py-2.5">{item.ageSex}</td>
                        <td className="py-2.5 text-slate-500">{item.studentId}</td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.type === 'Emergency' ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-700'
                          }`}>
                            {item.type}
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-600">{item.status}</td>
                        <td className="py-2.5 text-slate-500">{item.waitTime}</td>
                        <td className="py-2.5">
                          <button className="px-2.5 py-1 bg-sky-600 text-white rounded text-[11px] font-bold hover:bg-sky-700">
                            Call
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center text-xs text-slate-500 pt-2 border-t">
                <span>Showing 1-5 of 12 patients</span>
                <div className="flex gap-1">
                  <span className="px-2 py-0.5 bg-sky-600 text-white rounded font-bold">1</span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded">2</span>
                  <span className="px-2 py-0.5 bg-slate-100 rounded">3</span>
                </div>
              </div>
            </div>

            {/* Current Patient & Quick Actions (1 column) */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                <h3 className="font-bold text-sm text-slate-800 flex items-center gap-2 border-b pb-2">
                  <UserCheck className="w-4 h-4 text-sky-600"/> Current Patient
                </h3>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
                    TW
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-800 text-sm">Tsegaye Wondimu</h4>
                      <span className="bg-rose-100 text-rose-700 text-[10px] px-1.5 py-0.5 rounded font-bold">Emergency</span>
                    </div>
                    <p className="text-[11px] text-slate-500">MRN: MU-00123</p>
                    <p className="text-[11px] text-slate-500">Age: 24 | Gender: Male</p>
                    <p className="text-[11px] text-slate-500">Student ID: MU-2025-0456</p>
                  </div>
                </div>
                <div className="bg-rose-50 p-2.5 rounded-lg border border-rose-100 flex items-center justify-between text-xs">
                  <span className="text-rose-700 font-semibold">Waiting Time: 25 min</span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                <h3 className="font-bold text-sm text-slate-800 border-b pb-2">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-white">
                  <button className="p-3 bg-sky-600 rounded-lg flex flex-col items-center gap-1 hover:bg-sky-750">
                    <UserCheck className="w-4 h-4"/> Start Consultation
                  </button>
                  <button className="p-3 bg-emerald-600 rounded-lg flex flex-col items-center gap-1 hover:bg-emerald-700">
                    <FlaskConical className="w-4 h-4"/> Lab Request
                  </button>
                  <button className="p-3 bg-purple-600 rounded-lg flex flex-col items-center gap-1 hover:bg-purple-700">
                    <Share2 className="w-4 h-4"/> Injection & Dressing
                  </button>
                  <button className="p-3 bg-amber-600 rounded-lg flex flex-col items-center gap-1 hover:bg-amber-700">
                    <Pill className="w-4 h-4"/> Dispensary (Prescription)
                  </button>
                  <button className="p-3 bg-rose-600 rounded-lg flex flex-col items-center gap-1 hover:bg-rose-700">
                    <AlertTriangle className="w-4 h-4"/> Emergency
                  </button>
                  <button className="p-3 bg-teal-600 rounded-lg flex flex-col items-center gap-1 hover:bg-teal-700">
                    <FileText className="w-4 h-4"/> Referral
                  </button>
                </div>
              </div>
            </div>

          </div>

        </main>
      </div>

    </div>
  );
}