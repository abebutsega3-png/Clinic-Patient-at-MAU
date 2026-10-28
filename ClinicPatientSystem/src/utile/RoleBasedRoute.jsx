// src/components/RoleBasedRoute.jsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function RoleBasedRoute({ allowedRoles }) {
  const { user, loading } = useAuth();

  // 1. መረጃው እየተረጋገጠ ከሆነ መጠበቂያ ማሳየት
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-600 font-semibold">ማረጋገጫው እየተሰራ ነው...</p>
      </div>
    );
  }

  // 2. ተጠቃሚው ጭራሽ ካልገባ ወደ Login ገጽ መላክ
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 3. ተጠቃሚው የገባ ቢሆንም ለገጹ የተፈቀደው Role ከሌለው ወደ Unauthorized መላክ
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // 4. ሁለቱንም ካሟላ ገጹን ያሳያል
  return <Outlet />;
}