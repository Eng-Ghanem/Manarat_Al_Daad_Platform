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

  const isStaff = profile?.role === 'admin' || profile?.role === 'teacher' || profile?.email === '41147332a@gmail.com';
  const chatRoute = isStaff ? '/admin-dashboard/chat' : '/chat';
  const quizzesRoute = isStaff ? '/admin-dashboard/quizzes' : '/quizzes';
  const liveRoute = isStaff ? '/admin-dashboard/live-sessions' : '/live-sessions';

  const navLinks = [
    { to: '/', label: t('home') },
    { to: '/classes', label: t('classes') },
    { to: '/courses', label: t('courses') },
    { to: liveRoute, label: t('nav_live_sessions') },
    { to: chatRoute, label: t('nav_chat') },
    { to: quizzesRoute, label: t('nav_quizzes') }
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
          <div className="hidden lg:flex items-center gap-3 xl:gap-6">
            {navLinks.map((link) => (
              <Link key={link.to} to={link.to} className="relative group text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 font-semibold transition-colors text-sm xl:text-base py-1 whitespace-nowrap">
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
                      <div className="px-4 py-2 text-sm font-bold text-gray-500 dark:text-gray-400 truncate text-right rtl:text-right ltr:text-left">
                        {profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user.email}
                      </div>
                      <div className="h-px bg-gray-100 dark:bg-slate-700 my-1"></div>
                      <Link 
                        to={isStaff ? "/admin-dashboard" : "/dashboard"}
                        onClick={(e) => {
                          const targetPath = isStaff ? "/admin-dashboard" : "/dashboard";
                          if (window.location.pathname === targetPath) {
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }
                        }}
                        className="block w-full text-right px-4 py-2 rounded-lg text-sm font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors ltr:text-left rtl:text-right"
                      >
                        {isStaff ? t('nav_dashboard') : t('nav_profile')}
                      </Link>
                      <Link 
                        to="/settings"
                        onClick={(e) => {
                          if (window.location.pathname === "/settings") {
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }
                        }}
                        className="block w-full text-right px-4 py-2 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors ltr:text-left rtl:text-right"
                      >
                        {t('nav_settings')}
                      </Link>
                      <button 
                        onClick={handleLogout}
                        className="w-full block text-right px-4 py-2 rounded-lg text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors ltr:text-left rtl:text-right"
                      >
                        {t('nav_logout')}
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
              className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-2 h-10 rounded-full bg-blue-50/80 hover:bg-blue-100/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-blue-700 dark:text-blue-300 transition-all shadow-sm font-bold border border-blue-200/60 dark:border-slate-700 hover:scale-105 active:scale-95 cursor-pointer"
              aria-label="Toggle Language"
              title={i18n.language === 'ar' ? 'Switch to English' : 'التحويل إلى العربية'}
            >
              <Globe size={18} className="text-blue-600 dark:text-blue-400" />
              <span className="text-xs sm:text-sm font-bold hidden sm:inline">{t('nav_switch_lang')}</span>
            </button>
            
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 transition-colors shadow-sm border border-blue-100 dark:border-blue-800/50 active:scale-95"
              aria-label="Toggle Mobile Menu"
            >
              {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown & Backdrop */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, y: -15, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.98 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="lg:hidden fixed top-[85px] left-3 right-3 sm:left-auto sm:right-4 sm:w-80 rounded-3xl border border-gray-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl overflow-hidden shadow-2xl z-50 max-h-[calc(100vh-100px)] overflow-y-auto"
            >
              <div className="p-4 space-y-1.5 flex flex-col">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="px-4 py-3 rounded-2xl text-base font-bold text-gray-800 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-all border border-transparent hover:border-blue-100 dark:hover:border-blue-800/50 flex items-center justify-between"
                  >
                    <span>{link.label}</span>
                    <span className="text-gray-400 text-xs font-normal">←</span>
                  </Link>
                ))}

                {/* Mobile Language Switcher Button */}
                <button
                  onClick={() => {
                    toggleLanguage();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full px-4 py-3 rounded-2xl text-base font-bold text-gray-800 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-all border border-transparent flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Globe size={18} className="text-blue-600 dark:text-blue-400" />
                    <span>{i18n.language === 'ar' ? 'English Language' : 'اللغة العربية'}</span>
                  </div>
                  <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-bold">
                    {i18n.language === 'ar' ? 'EN' : 'عربي'}
                  </span>
                </button>
                
                {/* Auth section in mobile menu */}
                <div className="pt-3 mt-2 border-t border-gray-100 dark:border-slate-800/60 flex flex-col gap-2">
                  {user ? (
                    <>
                      <div className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 text-center bg-gray-50 dark:bg-slate-800/50 rounded-xl">
                        {t('nav_welcome_prefix')}{profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user.email}
                      </div>
                      <Link 
                        to={isStaff ? "/admin-dashboard" : "/dashboard"}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="block w-full text-center px-4 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold transition-all shadow-md active:scale-95 text-sm"
                      >
                        {isStaff ? t('nav_dashboard') : t('nav_profile')}
                      </Link>
                      <Link 
                        to="/settings"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="block w-full text-center px-4 py-3 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-200 font-bold transition-all shadow-sm active:scale-95 text-sm"
                      >
                        {t('nav_settings')}
                      </Link>
                      <button 
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          handleLogout();
                        }}
                        className="block w-full text-center px-4 py-3 rounded-2xl bg-red-100/80 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold transition-all shadow-sm active:scale-95 text-sm cursor-pointer"
                      >
                        {t('nav_logout')}
                      </button>
                    </>
                  ) : (
                    <>
                      <Link 
                        to="/login"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="block w-full text-center px-4 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold transition-all shadow-md active:scale-95 text-sm"
                      >
                        {t('nav_login')}
                      </Link>
                      <Link 
                        to="/register"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="block w-full text-center px-4 py-3 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-200 font-bold transition-all shadow-sm active:scale-95 text-sm"
                      >
                        {t('nav_register')}
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}
