// src/components/PrivateRoute.jsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function PrivateRoute({ allowedRoles }) {
  const { user, loading } = useAuth();

  // 1. መረጃው ከ Backend/LocalStorage እየተረጋገጠ ከሆነ
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-600 font-semibold">ማረጋገጫው እየተሰራ ነው...</p>
      </div>
    );
  }

  // 2. ተጠቃሚው ጭራሽ ካልገባ ወደ Login ገጽ ይላካል
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 3. ተጠቃሚው የገባ ቢሆንም ለገጹ የተፈቀደው Role (ስልጣን) ከሌለው
  // (allowedRoles ከተሰጠ እና የተጠቃሚው role በዚያ ውስጥ ከሌለ)
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // 4. ሁሉንም ካሟላ የተጠየቀውን ገጽ ያሳያል
  return <Outlet />;
}