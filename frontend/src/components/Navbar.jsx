import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon, Globe, Menu, X } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { user, profile, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/welcome');
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
  };



  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { to: '/', label: t('home') },
    { to: '/classes', label: t('classes') },
    { to: '/courses', label: t('courses') },
    { to: '/live-sessions', label: 'حصص الأونلاين' }
  ];

  return (
    <nav className="sticky top-0 z-50 w-full backdrop-blur-md bg-white/70 dark:bg-slate-900/70 border-b border-gray-200 dark:border-slate-800 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="text-2xl sm:text-3xl font-extrabold text-blue-700 dark:text-blue-400 font-arabic tracking-tight">
              {t('logo_title')}
            </Link>
          </div>

          {/* Links - Desktop */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link key={link.to} to={link.to} className="relative group text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 font-semibold transition-colors text-lg py-1">
                {link.label}
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-blue-600 dark:bg-blue-400 transition-all duration-300 group-hover:w-full rounded-full"></span>
              </Link>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-4 relative">
            
            {/* Account Dropdown */}
            <div className="hidden md:block relative group">
              <button 
                className="flex items-center justify-center gap-2 px-4 py-2 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors shadow-md hover:shadow-blue-500/30 text-sm"
              >
                {t('nav_account')}
              </button>
              
              {/* Dropdown Menu */}
              <div className="absolute left-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform origin-top-left group-hover:translate-y-0 translate-y-2">
                <div className="p-2 space-y-1">
                  {user ? (
                    <>
                      <div className="px-4 py-2 text-sm font-bold text-gray-500 dark:text-gray-400 truncate">
                        {profile?.full_name || user.email}
                      </div>
                      <div className="h-px bg-gray-100 dark:bg-slate-700 my-1"></div>
                      <Link 
                        to={profile?.role === 'admin' ? "/admin-dashboard" : "/dashboard"}
                        onClick={(e) => {
                          const targetPath = profile?.role === 'admin' ? "/admin-dashboard" : "/dashboard";
                          if (window.location.pathname === targetPath) {
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }
                        }}
                        className="block px-4 py-2 rounded-lg text-sm font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors ltr:text-left rtl:text-right"
                      >
                        {profile?.role === 'admin' ? t('nav_dashboard') : 'الملف الشخصي'}
                      </Link>
                      <Link 
                        to="/settings"
                        onClick={(e) => {
                          if (window.location.pathname === "/settings") {
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }
                        }}
                        className="block px-4 py-2 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors ltr:text-left rtl:text-right"
                      >
                        إعدادات الحساب
                      </Link>
                      <button 
                        onClick={handleLogout}
                        className="w-full block px-4 py-2 rounded-lg text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors ltr:text-left rtl:text-right"
                      >
                        تسجيل الخروج
                      </button>
                    </>
                  ) : (
                    <>
                      <Link 
                        to="/login"
                        className="block px-4 py-2 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-600 transition-colors ltr:text-left rtl:text-right"
                      >
                        {t('nav_login')}
                      </Link>
                      <Link 
                        to="/register"
                        className="block px-4 py-2 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-600 transition-colors ltr:text-left rtl:text-right"
                      >
                        {t('nav_register')}
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>

            <NotificationBell />
            
            <button
              onClick={toggleTheme}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition-colors shadow-sm"
              aria-label="Toggle Theme"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 h-10 rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition-colors shadow-sm font-medium"
              aria-label="Toggle Language"
            >
              <Globe size={18} />
              <span className="text-sm font-bold uppercase">{i18n.language === 'ar' ? 'en' : 'ar'}</span>
            </button>
            
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors shadow-sm border border-blue-100 dark:border-blue-800/50"
              aria-label="Toggle Mobile Menu"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="md:hidden absolute top-[85px] left-4 w-72 rounded-3xl border border-gray-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl overflow-hidden shadow-2xl z-50"
          >
            <div className="px-4 pt-2 pb-6 space-y-2 flex flex-col shadow-inner">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="px-4 py-3 rounded-xl text-base font-bold text-gray-800 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-all border border-transparent hover:border-blue-100 dark:hover:border-blue-800/50"
                >
                  {link.label}
                </Link>
              ))}
              
              {/* Optional: Add Auth buttons here for mobile later */}
              <div className="pt-4 mt-2 border-t border-gray-100 dark:border-slate-800/50 flex flex-col gap-2">
                {user ? (
                  <>
                    <div className="px-4 py-2 text-sm font-bold text-gray-500 dark:text-gray-400 text-center">
                      مرحباً، {profile?.full_name || user.email}
                    </div>
                    <Link 
                      to={profile?.role === 'admin' ? "/admin-dashboard" : "/dashboard"}
                      onClick={(e) => {
                        setIsMobileMenuOpen(false);
                        const targetPath = profile?.role === 'admin' ? "/admin-dashboard" : "/dashboard";
                        if (window.location.pathname === targetPath) {
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }}
                      className="block w-full text-center px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-800 text-white font-bold transition-all shadow-md active:scale-95"
                    >
                      {profile?.role === 'admin' ? t('nav_dashboard') : 'الملف الشخصي'}
                    </Link>
                    <Link 
                      to="/settings"
                      onClick={(e) => {
                        setIsMobileMenuOpen(false);
                        if (window.location.pathname === "/settings") {
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }}
                      className="block w-full text-center px-4 py-3 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-200 font-bold transition-all shadow-sm active:scale-95"
                    >
                      إعدادات الحساب
                    </Link>
                    <button 
                      onClick={handleLogout}
                      className="block w-full text-center px-4 py-3 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold transition-all shadow-sm active:scale-95"
                    >
                      تسجيل الخروج
                    </button>
                  </>
                ) : (
                  <>
                    <Link 
                      to="/login"
                      className="block w-full text-center px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-800 text-white font-bold transition-all shadow-md active:scale-95"
                    >
                      {t('nav_login')}
                    </Link>
                    <Link 
                      to="/register"
                      className="block w-full text-center px-4 py-3 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-200 font-bold transition-all shadow-sm active:scale-95"
                    >
                      {t('nav_register')}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
