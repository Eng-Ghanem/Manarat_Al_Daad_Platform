import { useState, useEffect, useRef } from 'react';
import { Bell, Check } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

export default function NotificationBell() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [adminCount, setAdminCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!profile) return;

    if (profile.role === 'admin') {
      // 1. Fetch initial count of pending subscriptions
      const fetchPendingCount = async () => {
        try {
          const { count, error } = await supabase
            .from('subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');
            
          if (error) throw error;
          setAdminCount(count || 0);
        } catch (err) {
          console.error('Error fetching notification count:', err);
        }
      };

      fetchPendingCount();

      const subscription = supabase
        .channel('public:subscriptions')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => {
          fetchPendingCount();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    } else {
      // Fetch student notifications
      const fetchNotifications = async () => {
        try {
          const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false })
            .limit(10);
            
          if (error) throw error;
          setNotifications(data || []);
          setUnreadCount(data?.filter(n => !n.is_read).length || 0);
        } catch (err) {
          console.error('Error fetching notifications:', err);
        }
      };

      fetchNotifications();

      const subscription = supabase
        .channel(`public:notifications:user_id=eq.${profile.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, () => {
          fetchNotifications();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [profile]);

  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notification.id);
        
      setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    
    setIsOpen(false);
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const markAllAsRead = async () => {
    if (unreadCount === 0) return;
    
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', profile.id)
      .eq('is_read', false);
      
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  if (!profile) return null;

  if (profile.role === 'admin') {
    return (
      <Link 
        to="/admin-dashboard/subscriptions"
        className="relative w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition-colors shadow-sm"
        title="طلبات الاشتراك"
      >
        <Bell size={20} />
        {adminCount > 0 && (
          <span className="absolute top-0 right-0 flex h-3.5 w-3.5 items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
          </span>
        )}
      </Link>
    );
  }

  // Student Bell
  return (
    <div className="relative z-50" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition-colors shadow-sm"
        title="الإشعارات"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[9px] font-bold text-white items-center justify-center border border-white dark:border-slate-800">
              {unreadCount > 9 ? '+9' : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Dropdown */}
      <div className={`absolute top-full rtl:left-0 ltr:right-0 mt-3 w-80 sm:w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden transition-all duration-300 origin-top ${isOpen ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-2'}`}>
        <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between bg-gray-50 dark:bg-slate-900/50">
          <h3 className="font-bold text-gray-900 dark:text-white">{t('notif_title')}</h3>
          {unreadCount > 0 && (
            <button 
              onClick={markAllAsRead}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <Check className="w-3 h-3" /> تعيين كمقروء
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
              لا توجد إشعارات حالياً
            </div>
          ) : (
            notifications.map((notif) => (
              <button
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`w-full text-start p-4 border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors ${!notif.is_read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
              >
                <div className="flex gap-3">
                  <div className="shrink-0 mt-1">
                    {!notif.is_read ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-400"></div>
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-slate-600"></div>
                    )}
                  </div>
                  <div>
                    <h4 className={`text-sm ${!notif.is_read ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                      {notif.title}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                      {notif.message}
                    </p>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 block">
                      {new Date(notif.created_at).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
