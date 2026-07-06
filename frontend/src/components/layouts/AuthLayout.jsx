import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../contexts/ThemeContext';
import { Sun, Moon, Globe, ArrowRight } from 'lucide-react';

export default function AuthLayout() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center relative overflow-hidden transition-colors duration-300">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gold-500/10 blur-[100px] rounded-full pointer-events-none"></div>
      <div className="absolute inset-0 bg-arabic-pattern opacity-[0.03]"></div>

      {/* Global Toaster for Auth */}
      <Toaster position="top-center" reverseOrder={false} />

      {/* Auth Navbar Actions */}
      <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 flex justify-between items-center z-20">
        <Link to="/" className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition-colors shadow-sm backdrop-blur-md text-sm font-bold">
          <ArrowRight size={18} className="rtl:rotate-180" />
          {t('home') || 'الرئيسية'}
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition-colors shadow-sm backdrop-blur-md"
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-4 py-2 h-10 rounded-full bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition-colors shadow-sm backdrop-blur-md font-medium"
            aria-label="Toggle Language"
          >
            <Globe size={18} />
            <span className="text-sm font-bold uppercase">{i18n.language === 'ar' ? 'en' : 'ar'}</span>
          </button>
        </div>
      </div>

      <div className="w-full relative z-10 px-4 pt-16 pb-8">
        <Outlet />
      </div>
    </div>
  );
}
