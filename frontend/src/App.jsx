import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Welcome from './pages/Welcome';
import Home from './pages/Home';
import Grades from './pages/Grades';
import FoundationCourses from './pages/FoundationCourses';
import CategoryCourses from './pages/CategoryCourses';
import CourseDetails from './pages/CourseDetails';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyOTP from './pages/VerifyOTP';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import CourseForm from './pages/admin/CourseForm';
import CourseDetailsAdmin from './pages/admin/CourseDetailsAdmin';
import LessonForm from './pages/admin/LessonForm';
import AdminSubscriptions from './pages/admin/AdminSubscriptions';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Checkout from './pages/Checkout';

import AuthLayout from './components/layouts/AuthLayout';
import MainLayout from './components/layouts/MainLayout';
import AdminRoute from './components/AdminRoute';
import ProtectedRoute from './components/ProtectedRoute';

import { AuthProvider } from './context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';

function App() {
  const { i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white transition-colors duration-300 overflow-x-hidden flex flex-col">
          <Routes>
            {/* Auth Routes */}
            <Route element={<AuthLayout />}>
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/verify-otp" element={<VerifyOTP />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
            </Route>

            {/* Main Platform Routes (All Protected) */}
            <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
              {/* Public Platform Routes (Now Protected) */}
              <Route path="/" element={<Home />} />
              <Route path="/classes" element={<Grades />} />
              <Route path="/courses/category/:categoryId" element={<CategoryCourses />} />
              <Route path="/courses" element={<FoundationCourses />} />
              <Route path="/course/:id" element={<CourseDetails />} />
              <Route path="/checkout/:courseId" element={<Checkout />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />

              {/* Protected Student Routes */}
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/settings" element={<Settings />} />

              {/* Protected Admin Routes */}
              <Route path="/admin-dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
              <Route path="/admin-dashboard/subscriptions" element={<AdminRoute><AdminSubscriptions /></AdminRoute>} />
              {/* Redirect old /admin to /admin-dashboard */}
              <Route path="/admin" element={<Navigate to="/admin-dashboard" replace />} />
              
              <Route path="/admin-dashboard/courses/new" element={<AdminRoute><CourseForm /></AdminRoute>} />
              <Route path="/admin-dashboard/courses/:id/edit" element={<AdminRoute><CourseForm /></AdminRoute>} />
              <Route path="/admin-dashboard/courses/:id" element={<AdminRoute><CourseDetailsAdmin /></AdminRoute>} />
              <Route path="/admin-dashboard/courses/:courseId/lessons/new" element={<AdminRoute><LessonForm /></AdminRoute>} />
              <Route path="/admin-dashboard/courses/:courseId/lessons/:lessonId" element={<AdminRoute><LessonForm /></AdminRoute>} />

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
