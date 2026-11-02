import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import ExaminationRoomNavbar from '../components/Examination Room/ExaminationRoomNavbar.jsx';
import ExaminationRoomSidebar from '../components/Examination Room/ExaminationRoomSidbar.jsx';
import ExaminationDashboard from '../components/Examination Room/ExaminationDashboard.jsx';
import { useAuth } from '../components/context/AuthContext.jsx';

const ExaminationRoom = () => {
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const [activeItem, setActiveItem] = useState('Patient Queue');
	const [queueSummary, setQueueSummary] = useState({ queueCount: 0, labRequestsCount: 0 });
	const { user, token } = useAuth();
	const location = useLocation();
	const userRoles = [user?.activeRole, user?.role, ...(user?.roles || []), user?.position, user?.department]
		.filter(Boolean)
		.map((role) => String(role).trim().toLowerCase().replace(/[_-]+/g, ' '));

	if (!user || !token) {
		return <Navigate to="/login" replace state={{ from: location }} />;
	}
	if (user.mustChangePassword) {
		return <Navigate to="/change-password" replace />;
	}
	if (!userRoles.some((role) => role.includes('examination') || role.includes('exam room') || role.includes('doctor'))) {
		return <Navigate to="/" replace />;
	}

	return (
		<div className="min-h-screen bg-slate-50">
			{sidebarOpen && (
				<button
					type="button"
					aria-label="Close navigation menu"
					className="fixed inset-0 z-20 bg-slate-950/40 lg:hidden"
					onClick={() => setSidebarOpen(false)}
				/>
			)}
			<ExaminationRoomSidebar
				activeItem={activeItem}
				queueCount={queueSummary.queueCount}
				labRequestsCount={queueSummary.labRequestsCount}
				setActiveItem={(item) => {
					setActiveItem(item);
					setSidebarOpen(false);
				}}
				isOpen={sidebarOpen}
			/>
			<div className="min-h-screen lg:pl-64">
				<ExaminationRoomNavbar activeItem={activeItem === 'Patient Queue' ? 'Patient Queue' : activeItem} onToggleSidebar={() => setSidebarOpen((open) => !open)} />
				<main className={activeItem === 'Patient Queue' ? 'p-2 sm:p-3 lg:p-4' : 'p-4 sm:p-6 lg:p-8'}>
					<ExaminationDashboard
						activeItem={activeItem}
						onNavigate={setActiveItem}
						onQueueSummaryChange={setQueueSummary}
					/>
				</main>
			</div>
		</div>
	);
};

export default ExaminationRoom;