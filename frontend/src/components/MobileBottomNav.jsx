import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, BookOpen, MessageSquare, ClipboardList, User, ShieldCheck, Video } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

export default function MobileBottomNav() {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const location = useLocation();
  const isRTL = i18n.language === 'ar';
  const isAdmin = profile?.role === 'admin';

  // Do not render bottom nav only on active quiz taking page to maximize focus
  const isTakingQuiz = location.pathname.startsWith('/quizzes/') && !location.pathname.endsWith('/result');

  if (isTakingQuiz) {
    return null;
  }

  const liveRoute = isAdmin ? '/admin-dashboard/live-sessions' : '/live-sessions';
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
      id: 'live',
      label: isRTL ? 'حصص الأونلاين' : 'Live',
      to: liveRoute,
      icon: Video,
      matchPrefixes: ['/live-sessions', '/admin-dashboard/live-sessions']
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
      label: t('nav_chat') || (isRTL ? 'المحادثات' : 'Chat'),
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
    if (item.id === 'account' && isAdmin) {
      return location.pathname === '/admin-dashboard' || 
             location.pathname === '/admin-dashboard/' || 
             location.pathname === '/settings' ||
             location.pathname === '/admin-dashboard/settings';
    }
    if (item.matchPrefixes) {
      return item.matchPrefixes.some(prefix => location.pathname.startsWith(prefix));
    }
    return false;
  };

  const handlePrefetch = (to) => {
    try {
      if (to.includes('quizzes')) {
        import('../pages/StudentQuizzes');
        import('../pages/admin/AdminQuizzes');
      } else if (to.includes('live-sessions')) {
        import('../pages/StudentLiveSessions');
        import('../pages/admin/AdminLiveSessions');
      } else if (to.includes('chat')) {
        import('../pages/StudentChat');
        import('../pages/admin/AdminChat');
      } else if (to.includes('dashboard')) {
        import('../pages/Dashboard');
        import('../pages/AdminDashboard');
      }
    } catch (e) {
      // Ignore
    }
  };

  const handleTabClick = (to) => {
    handlePrefetch(to);
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(8);
      } catch (e) {}
    }
  };

  return (
    <nav 
      aria-label="Mobile Navigation Bar"
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-t border-gray-200/80 dark:border-slate-800/80 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] pb-[max(env(safe-area-inset-bottom,0px),8px)] transition-all duration-300"
      style={{ touchAction: 'manipulation' }}
    >
      <div className="flex items-center justify-around h-[62px] max-w-lg mx-auto px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isItemActive(item);

          return (
            <NavLink
              key={item.id}
              to={item.to}
              onMouseEnter={() => handlePrefetch(item.to)}
              onTouchStart={() => handlePrefetch(item.to)}
              onClick={() => handleTabClick(item.to)}
              className="relative flex flex-col items-center justify-center flex-1 h-full py-1 text-center select-none transition-transform duration-150 active:scale-90"
            >
              {/* Active animated floating background pill */}
              {active && (
                <motion.div 
                  layoutId="bottomNavPill"
                  className="absolute inset-x-2 inset-y-1.5 bg-blue-50/80 dark:bg-blue-950/40 rounded-2xl border border-blue-200/60 dark:border-blue-800/40 -z-10 shadow-sm"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}

              {/* Active top glow indicator */}
              {active && (
                <motion.div 
                  layoutId="bottomNavIndicator"
                  className="absolute top-0 w-8 h-1 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 dark:from-blue-400 dark:via-indigo-400 dark:to-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}

              <div className={`relative p-1 rounded-xl transition-all duration-200 ${
                active 
                  ? 'text-blue-600 dark:text-blue-400 -translate-y-0.5' 
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
              }`}>
                <Icon className={`w-5 h-5 transition-transform duration-200 ${active ? 'scale-110 stroke-[2.4]' : 'stroke-[1.8]'}`} />
              </div>

              <span className={`text-[10px] tracking-tight font-arabic leading-tight mt-0.5 transition-all duration-200 ${
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
