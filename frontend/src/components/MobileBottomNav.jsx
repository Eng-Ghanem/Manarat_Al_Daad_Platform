import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, BookOpen, MessageSquare, ClipboardList, User, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

export default function MobileBottomNav() {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const location = useLocation();
  const isRTL = i18n.language === 'ar';
  const isAdmin = profile?.role === 'admin';

  // Do not render bottom nav on full-screen chat or quiz taking pages
  const isChatPage = location.pathname === '/chat' || location.pathname.startsWith('/admin-dashboard/chat');
  const isTakingQuiz = location.pathname.startsWith('/quizzes/') && !location.pathname.endsWith('/result');

  if (isChatPage || isTakingQuiz) {
    return null;
  }

  const chatRoute = isAdmin ? '/admin-dashboard/chat' : '/chat';
  const quizzesRoute = isAdmin ? '/admin-dashboard/quizzes' : '/quizzes';
  const accountRoute = isAdmin 
    ? '/admin-dashboard' 
    : user 
    ? '/dashboard' 
    : '/login';

  const navItems = [
    {
      id: 'home',
      label: t('home') || (isRTL ? 'الرئيسية' : 'Home'),
      to: '/',
      icon: Home,
      exact: true
    },
    {
      id: 'courses',
      label: t('courses') || (isRTL ? 'الكورسات' : 'Courses'),
      to: '/courses',
      icon: BookOpen,
      matchPrefixes: ['/courses', '/classes', '/course/']
    },
    {
      id: 'quizzes',
      label: t('nav_quizzes') || (isRTL ? 'الامتحانات' : 'Quizzes'),
      to: quizzesRoute,
      icon: ClipboardList,
      matchPrefixes: ['/quizzes', '/admin-dashboard/quizzes']
    },
    {
      id: 'chat',
      label: t('nav_chat') || (isRTL ? 'المحادثة' : 'Chat'),
      to: chatRoute,
      icon: MessageSquare,
      matchPrefixes: ['/chat', '/admin-dashboard/chat']
    },
    {
      id: 'account',
      label: isAdmin ? (isRTL ? 'الإدارة' : 'Admin') : (user ? (isRTL ? 'حسابي' : 'Account') : (isRTL ? 'دخول' : 'Login')),
      to: accountRoute,
      icon: isAdmin ? ShieldCheck : User,
      matchPrefixes: ['/dashboard', '/admin-dashboard', '/settings', '/login', '/register']
    }
  ];

  const isItemActive = (item) => {
    if (item.exact) {
      return location.pathname === item.to;
    }
    if (location.pathname === item.to) {
      return true;
    }
    if (item.matchPrefixes) {
      return item.matchPrefixes.some(prefix => location.pathname.startsWith(prefix));
    }
    return false;
  };

  return (
    <nav 
      aria-label="Mobile Navigation Bar"
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/92 dark:bg-slate-900/92 backdrop-blur-2xl border-t border-gray-200/70 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom,0px)] transition-all duration-300"
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isItemActive(item);

          return (
            <NavLink
              key={item.id}
              to={item.to}
              className="relative flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-all duration-200 active:scale-95 select-none"
            >
              {/* Active top glow indicator */}
              {active && (
                <motion.div 
                  layoutId="bottomNavIndicator"
                  className="absolute top-0 w-8 h-1 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 shadow-sm"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}

              <div className={`relative p-1 rounded-xl transition-colors duration-200 ${
                active 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
              }`}>
                <Icon className={`w-5 h-5 transition-transform duration-200 ${active ? 'scale-110 stroke-[2.4]' : 'stroke-[1.8]'}`} />
              </div>

              <span className={`text-[10px] tracking-tight font-arabic leading-tight mt-0.5 transition-colors duration-200 ${
                active 
                  ? 'font-black text-blue-600 dark:text-blue-400' 
                  : 'font-medium text-gray-500 dark:text-slate-400'
              }`}>
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
