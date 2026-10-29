import { useState } from 'react';
import Navbar from './components/homedashboared/Navbar.jsx';
import AdminNavbar from './components/Admindashboared/Navbar.jsx';
import AdminSidebar from './components/Admindashboared/AdminSidebar.jsx';
import ServicesSection from './components/homedashboared/ServicesSection.jsx';
import AppointmentSection from './components/homedashboared/AppointmentSection.jsx';
import Footer from './components/homedashboared/Footer.jsx';
import HomePage from './page/HomePage.jsx';
import AboutPage from './page/AboutPage.jsx';
import WorkingHoursPage from './page/WorkingHoursPage.jsx';
import ContactUs from './components/homedashboared/Contact us.jsx';
import LoginPage from './page/LoginPage.jsx';
import AdminDashboard from './page/AdminDashboard.jsx';
import UserManagement from './components/Admindashboared/UserManagement.jsx';
import RolesPermissions from './components/Admindashboared/RolesPermissions.jsx';
import Departments from './components/Admindashboared/Departments.jsx';
import MasterData from './components/Admindashboared/MasterData.jsx';
import AdminReports from './components/Admindashboared/AdminReports.jsx';
import AdminAuditLogs from './components/Admindashboared/AdminAuditLogs.jsx';
import AdminSystemSettings from './components/Admindashboared/AdminSystemSettings.jsx';
import AdminNotifications from './components/Admindashboared/AdminNotifications.jsx';
import ForcePasswordChange from './page/ForcePasswordChange.jsx';
import { useAuth } from './components/context/AuthContext.jsx';
import ClinicHeadDashboard from './page/ClinicHeadDashboard.jsx';
import ClinicHeadSidebar from './components/ClinicStudentHead/ClinicHeadSidbar.jsx';
import ClinicHeadNavbar from './components/ClinicStudentHead/ClinicHeadNavbar.jsx';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import ApprovalsAndRequests from './components/ClinicStudentHead/clinicheadApprovalsAndRequests.jsx';
import DutyRoster from './components/ClinicStudentHead/staffmanagmentDutyRoster.jsx';
import PharmacyAndInventory from './components/ClinicStudentHead/PharmacyAndInventory.jsx';
import ReportsAndAnalytics from './components/ClinicStudentHead/ReportsAndAnalytics.jsx';
import ClinicHeadSettings from './components/ClinicStudentHead/ClinicHeadSettings.jsx';
import DepartmentPurchaseRequests from './components/ClinicStudentHead/DepartmentPurchaseRequests.jsx';
import { ClinicHeadChangePassword, ClinicHeadProfile } from './components/ClinicStudentHead/ClinicHeadAccount.jsx';
import { CardRoomDashboard, CardRoomLayout, CardRoomUnavailable } from './components/Card Room/CardRoomModule.jsx';
import RegisterNewPatient, { CardRoomVisitRegistration } from './components/Card Room/RegisterNewPatient.jsx';
import CardRoomPatients from './components/Card Room/CardRoomPatients.jsx';
import CardRoomQueue from './components/Card Room/CardRoomQueue.jsx';
import CardRoomRecords from './components/Card Room/CardRoomRecords.jsx';
import CardRoomReports from './components/Card Room/CardRoomReports.jsx';
import CardRoomVisits from './components/Card Room/CardRoomVisits.jsx';
import RequestsAndProcurement from './components/Card Room/RequestsAndProcurement.jsx';
import DispensaryRoomSidebar from './components/Dispensary Room/Dispensary Room Sidebar.jsx';
import DispensaryNavbar from './components/Dispensary Room/Dispensary Navbar.jsx';
import DispensaryDashboard from './components/Dispensary Room/Dispensary Dashboard.jsx';

function DispensaryLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, token } = useAuth();
  const location = useLocation();
  const activeRole = String(user?.activeRole || user?.role || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ');
  const allowedRoles = ['pharmacist', 'drug store manager', 'dispensary room'];

  if (!user || !token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (user.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }
  if (!allowedRoles.includes(activeRole)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {sidebarOpen && <button type="button" aria-label="Close navigation menu" className="fixed inset-0 z-20 bg-slate-950/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <DispensaryRoomSidebar isOpen={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
      <div className="min-h-screen lg:pl-64">
        <DispensaryNavbar onToggleSidebar={() => setSidebarOpen((open) => !open)} />
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function DispensarySection() {
  const { pathname } = useLocation();
  const currentPath = pathname.replace(/\/+$/, '');
  const title = currentPath.split('/').pop().split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

  return (
    <section className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <p className="text-sm font-semibold text-orange-700">MAU Clinic · Pharmacy / Dispensary</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">This dispensary workflow is not connected yet. Use the dashboard for current stock alerts and dispensing activity.</p>
    </section>
  );
}

function ClinicHeadLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <ClinicHeadNavbar onToggleSidebar={() => setSidebarOpen((current) => !current)} />
      {sidebarOpen && <button type="button" aria-label="Close navigation menu" className="fixed inset-x-0 bottom-0 top-16 z-20 bg-slate-950/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <ClinicHeadSidebar isOpen={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
      <div className="min-h-screen pt-16 lg:pl-64">
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();

  if (user?.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-20 bg-slate-950/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <AdminSidebar isOpen={sidebarOpen} onNavigate={() => setSidebarOpen(false)} />
      <div className="min-h-screen lg:pl-64">
        <AdminNavbar onToggleSidebar={() => setSidebarOpen((current) => !current)} />
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/services" element={<><Navbar /><ServicesSection /><Footer /></>} />
        <Route path="/working-hours" element={<WorkingHoursPage />} />
        <Route path="/contact" element={<><Navbar /><ContactUs /><Footer /></>} />
        <Route path="/departments" element={<Navigate to="/services" replace />} />
        <Route path="/appointments" element={<><Navbar /><AppointmentSection /><Footer /></>} />
        <Route path="/login" element={<div className="flex min-h-screen flex-col"><Navbar /><LoginPage /><Footer /></div>} />
        <Route path="/purchase-requests" element={<DepartmentPurchaseRequests />} />
        <Route path="/change-password" element={<div className="flex min-h-screen flex-col"><Navbar /><ForcePasswordChange /><Footer /></div>} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="departments" element={<Departments />} />
          <Route path="master-data" element={<MasterData />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="audit-logs" element={<AdminAuditLogs />} />
          <Route path="settings" element={<AdminSystemSettings />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="announcements" element={<Navigate to="/admin/notifications" replace />} />
          <Route path="roles" element={<RolesPermissions />} />
          <Route path="roles-permissions" element={<RolesPermissions />} />
          <Route path="roles-permissions/add" element={<RolesPermissions />} />
          <Route path="profile" element={<ClinicHeadProfile />} />
        </Route>
        <Route path="/clinic-head" element={<ClinicHeadLayout />}>
          <Route index element={<ClinicHeadDashboard />} />
          <Route path="approvals" element={<ApprovalsAndRequests />} />
          <Route path="staff" element={<DutyRoster />} />
          <Route path="inventory" element={<PharmacyAndInventory />} />
          <Route path="reports" element={<ReportsAndAnalytics />} />
          <Route path="settings" element={<ClinicHeadSettings />} />
          <Route path="profile" element={<ClinicHeadProfile />} />
          <Route path="change-password" element={<ClinicHeadChangePassword />} />
        </Route>
        <Route path="/card-room" element={<CardRoomLayout />}>
          <Route index element={<CardRoomDashboard />} />
          <Route path="patients" element={<CardRoomPatients />} />
          <Route path="register" element={<RegisterNewPatient />} />
          <Route path="queue" element={<CardRoomQueue />} />
          <Route path="records" element={<CardRoomRecords />} />
          <Route path="reports" element={<CardRoomReports />} />
          <Route path="visits" element={<CardRoomVisits />} />
          <Route path="visits/new" element={<CardRoomVisitRegistration />} />
          <Route path="requests-and-procurement" element={<RequestsAndProcurement />} />
          <Route path="*" element={<CardRoomUnavailable />} />
        </Route>
        <Route path="/dispensary" element={<DispensaryLayout />}>
          <Route index element={<DispensaryDashboard />} />
          <Route path="*" element={<DispensarySection />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;