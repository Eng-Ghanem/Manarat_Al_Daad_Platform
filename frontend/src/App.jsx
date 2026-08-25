import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Loader } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

import AuthLayout from './components/layouts/AuthLayout';
import MainLayout from './components/layouts/MainLayout';
import AdminRoute from './components/AdminRoute';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { useTranslation } from 'react-i18next';

// Lazy loaded pages for performance optimization
const Welcome = lazy(() => import('./pages/Welcome'));
const Home = lazy(() => import('./pages/Home'));
const Grades = lazy(() => import('./pages/Grades'));
const FoundationCourses = lazy(() => import('./pages/FoundationCourses'));
const CategoryCourses = lazy(() => import('./pages/CategoryCourses'));
const CourseDetails = lazy(() => import('./pages/CourseDetails'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const VerifyOTP = lazy(() => import('./pages/VerifyOTP'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const CourseForm = lazy(() => import('./pages/admin/CourseForm'));
const CourseDetailsAdmin = lazy(() => import('./pages/admin/CourseDetailsAdmin'));
const LessonForm = lazy(() => import('./pages/admin/LessonForm'));
const AdminSubscriptions = lazy(() => import('./pages/admin/AdminSubscriptions'));
const AdminLiveSessions = lazy(() => import('./pages/admin/AdminLiveSessions'));
const Settings = lazy(() => import('./pages/Settings'));
const Certificates = lazy(() => import('./pages/Certificates'));
const StudentLiveSessions = lazy(() => import('./pages/StudentLiveSessions'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Checkout = lazy(() => import('./pages/Checkout'));

import ErrorBoundary from './components/ErrorBoundary';

function App() {
  const { i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Toaster position="top-center" reverseOrder={false} />
        <Router>
          <div className="min-h-[100dvh] bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white transition-colors duration-300 overflow-x-hidden w-full flex flex-col">
            <Suspense fallback={
              <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900">
                <Loader className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                <p className="text-gray-500 font-arabic font-bold animate-pulse">جاري التحميل...</p>
              </div>
            }>
              <Routes>
                {/* Main Platform Routes */}
                <Route element={<MainLayout />}>
                  {/* Auth Routes */}
                  <Route path="/welcome" element={<Welcome />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/verify-otp" element={<VerifyOTP />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />

                  {/* Public Platform Routes */}
                  <Route path="/" element={<Home />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/classes" element={<Grades />} />
                  <Route path="/courses" element={<FoundationCourses />} />

                  {/* Protected Platform Routes */}
                  <Route path="/courses/category/:categoryId" element={<ProtectedRoute><CategoryCourses /></ProtectedRoute>} />
                  <Route path="/course/:id" element={<ProtectedRoute><CourseDetails /></ProtectedRoute>} />
                  <Route path="/checkout/:courseId" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />

                  {/* Protected Student Routes */}
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                  <Route path="/certificates" element={<ProtectedRoute><Certificates /></ProtectedRoute>} />
                  <Route path="/live-sessions" element={<ProtectedRoute><StudentLiveSessions /></ProtectedRoute>} />

                  {/* Protected Admin Routes */}
                  <Route path="/admin-dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                  <Route path="/admin-dashboard/subscriptions" element={<AdminRoute><AdminSubscriptions /></AdminRoute>} />
                  <Route path="/admin-dashboard/live-sessions" element={<AdminRoute><AdminLiveSessions /></AdminRoute>} />
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
            </Suspense>
          </div>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
