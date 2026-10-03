import { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Bell, Check, CheckCheck, Volume2, VolumeX, Video, 
  FileText, ClipboardCheck, Trophy, Sparkles, CreditCard, 
  MessageSquare, Clock, ArrowUpRight, ExternalLink, Calendar
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { playChimeSound, isNotificationSoundEnabled, setNotificationSoundEnabled } from '../utils/notificationSound';
import { checkUpcomingLiveSessions } from '../utils/sessionReminderService';
import toast from 'react-hot-toast';

export default function NotificationBell() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [adminPendingCount, setAdminPendingCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all'); // 'all' | 'live' | 'quiz' | 'xp'
  const [soundEnabled, setSoundEnabled] = useState(isNotificationSoundEnabled());
  const [isRinging, setIsRinging] = useState(false);

  const dropdownRef = useRef(null);
  const initialFetchDone = useRef(false);

  // Trigger brief wiggle / ring animation
  const triggerBellRing = () => {
    setIsRinging(true);
    setTimeout(() => setIsRinging(false), 1200);
  };

  // Sound toggle handler with pleasant preview chime
  const handleToggleSound = (e) => {
    e.stopPropagation();
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    setNotificationSoundEnabled(nextState);
    if (nextState) {
      playChimeSound(true);
      triggerBellRing();
      toast.success(isRTL ? 'تم تفعيل صوت التنبيهات (طن) 🔔' : 'Notification chime enabled 🔔', { duration: 2500 });
    } else {
      toast.error(isRTL ? 'تم كتم صوت التنبيهات 🔕' : 'Notification chime muted 🔕', { duration: 2500 });
    }
  };

  // Fetch notifications from Supabase
  const fetchNotifications = async (triggerSoundOnNew = false) => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(25);

      if (error) throw error;
      const list = data || [];
      const unread = list.filter(n => !n.is_read).length;

      // If a brand new notification arrived and sound is requested
      if (triggerSoundOnNew && initialFetchDone.current) {
        playChimeSound();
        triggerBellRing();
      }

      setNotifications(list);
      setUnreadCount(unread);
    } catch (err) {
      console.warn('Error fetching notifications:', err);
    }
  };

  // Fetch admin pending subscriptions & renewals count
  const fetchAdminPending = async () => {
    if (profile?.role !== 'admin' && profile?.role !== 'teacher' && profile?.email !== '41147332a@gmail.com') {
      return;
    }
    try {
      const [{ count: courseCount }, { count: liveCount }] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase
          .from('live_subscriptions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')
      ]);

      const total = (courseCount || 0) + (liveCount || 0);
      setAdminPendingCount(total);
    } catch (err) {
      console.warn('Error fetching admin pending count:', err);
    }
  };

  // Initial load + Realtime subscriptions
  useEffect(() => {
    if (!profile?.id) return;

    fetchNotifications().then(() => {
      initialFetchDone.current = true;
    });

    if (profile.role === 'admin') {
      fetchAdminPending();
    }

    // 1. Listen for new notifications for this user
    const notifSub = supabase
      .channel(`user_notifications_${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        (payload) => {
          fetchNotifications(true);
          // Show quick toast on new incoming notification
          if (payload?.new) {
            const notif = payload.new;
            toast.custom((t) => (
              <div
                onClick={() => {
                  toast.dismiss(t.id);
                  handleNotificationClick(notif);
                }}
                className={`${
                  t.visible ? 'animate-enter' : 'animate-leave'
                } max-w-sm w-full bg-white dark:bg-slate-800 shadow-2xl rounded-2xl p-4 border border-blue-500/30 flex items-start gap-3 cursor-pointer pointer-events-auto font-arabic hover:bg-blue-50/50 dark:hover:bg-slate-700/50 transition-all`}
                style={{ direction: isRTL ? 'rtl' : 'ltr' }}
              >
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/30">
                  <Bell className="w-5 h-5 animate-bounce" />
                </div>
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white leading-tight">
                    {notif.title}
                  </h4>
                  <p className="text-[11px] text-gray-500 dark:text-gray-300 mt-1 line-clamp-2">
                    {notif.message}
                  </p>
                </div>
              </div>
            ), { duration: 6000, position: 'top-center' });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        () => fetchNotifications(false)
      )
      .subscribe();

    // 2. Admin pending subscriptions & live packages channel
    let adminSub = null;
    if (profile.role === 'admin') {
      adminSub = supabase
        .channel('admin_notification_counter_channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => {
          fetchAdminPending();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'live_subscriptions' }, () => {
          fetchAdminPending();
        })
        .subscribe();
    }

    return () => {
      supabase.removeChannel(notifSub);
      if (adminSub) supabase.removeChannel(adminSub);
    };
  }, [profile]);

  // 3. Periodic 5-minute pre-session reminders check (runs every 20s)
  useEffect(() => {
    if (!profile?.id) return;

    // Run check on mount
    checkUpcomingLiveSessions(profile, navigate, () => fetchNotifications(true));

    const reminderInterval = setInterval(() => {
      checkUpcomingLiveSessions(profile, navigate, () => fetchNotifications(true));
    }, 20000);

    const handleFocus = () => {
      checkUpcomingLiveSessions(profile, navigate, () => fetchNotifications(true));
      fetchNotifications(false);
      if (profile.role === 'admin') fetchAdminPending();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(reminderInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [profile, navigate]);

  // Handle clicking outside to close dropdown
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
      const targetLink = (profile.role === 'admin' && notification.link === '/chat') 
        ? '/admin-dashboard/chat' 
        : notification.link;
      navigate(targetLink);
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
    toast.success(isRTL ? 'تم تعيين جميع الإشعارات كمقروءة' : 'All notifications marked as read', { duration: 2000 });
  };

  // Filter notifications by selected category
  const filteredNotifications = useMemo(() => {
    if (activeCategory === 'all') return notifications;
    if (activeCategory === 'live') {
      return notifications.filter(n => 
        n.type === 'live_session' || 
        n.type === 'session_reminder' || 
        n.link?.includes('live')
      );
    }
    if (activeCategory === 'quiz') {
      return notifications.filter(n => 
        n.type === 'quiz_submission' || 
        n.type === 'quiz_graded' || 
        n.link?.includes('quiz')
      );
    }
    if (activeCategory === 'xp') {
      return notifications.filter(n => 
        n.type === 'xp' || 
        n.type === 'xp_reward' || 
        n.title?.includes('نقاط')
      );
    }
    return notifications;
  }, [notifications, activeCategory]);

  // Relative time formatter helper
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    try {
      const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
      if (diffSec < 60) return isRTL ? 'الآن' : 'just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return isRTL ? `منذ ${diffMin} د` : `${diffMin}m ago`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return isRTL ? `منذ ${diffHours} س` : `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return isRTL ? 'أمس' : 'yesterday';
      if (diffDays < 7) return isRTL ? `منذ ${diffDays} أيام` : `${diffDays}d ago`;
      return new Date(dateStr).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
    } catch (_) {
      return '';
    }
  };

  // Icon selector based on notification category
  const getNotificationIcon = (type, title = '') => {
    if (type === 'live_session' || type === 'session_reminder' || title.includes('حصة')) {
      return (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20">
          <Video className="w-4 h-4" />
        </div>
      );
    }
    if (type === 'quiz_submission' || type === 'quiz_graded' || title.includes('امتحان')) {
      return (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-purple-500/20">
          <ClipboardCheck className="w-4 h-4" />
        </div>
      );
    }
    if (type === 'xp' || type === 'xp_reward' || title.includes('نقاط')) {
      return (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/20">
          <Trophy className="w-4 h-4" />
        </div>
      );
    }
    if (type === 'package_renewal' || type === 'course_subscription' || title.includes('باقة') || title.includes('اشتراك')) {
      return (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/20">
          <CreditCard className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-sky-500/20">
        <MessageSquare className="w-4 h-4" />
      </div>
    );
  };

  if (!profile) return null;

  const totalBadgeCount = unreadCount + (profile.role === 'admin' ? adminPendingCount : 0);

  return (
    <div className="relative z-50 font-arabic" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`relative w-10 h-10 flex items-center justify-center rounded-2xl transition-all duration-200 cursor-pointer ${
          isOpen
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
            : 'bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 shadow-xs'
        }`}
        title="مركز الإشعارات والتنبيهات"
        aria-label="Notifications"
      >
        <Bell 
          size={19} 
          className={`transition-transform duration-300 ${isRinging ? 'animate-[spin_0.35s_ease-in-out_2]' : ''}`} 
        />

        {/* Vibrant Red Dot & Pulse Badge */}
        {totalBadgeCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 px-1 items-center justify-center">
            {/* Glowing animated ping effect */}
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
            
            {/* Solid vibrant red badge */}
            <span className="relative inline-flex rounded-full h-4.5 min-w-4.5 px-1 bg-gradient-to-r from-red-600 to-rose-500 text-[10px] font-black text-white items-center justify-center border-2 border-white dark:border-slate-800 shadow-md">
              {totalBadgeCount > 9 ? '+9' : totalBadgeCount}
            </span>
          </span>
        )}
      </button>

      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 sm:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Dropdown Panel */}
      <div 
        className={`fixed left-2.5 right-2.5 top-16 sm:absolute sm:inset-auto sm:top-full sm:rtl:left-0 sm:ltr:right-0 sm:mt-3 sm:w-[420px] z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-800/80 overflow-hidden transition-all duration-300 origin-top transform ${
          isOpen ? 'opacity-100 visible translate-y-0 scale-100' : 'opacity-0 invisible -translate-y-3 scale-95 pointer-events-none'
        }`}
        style={{ direction: isRTL ? 'rtl' : 'ltr' }}
      >
        {/* Panel Header */}
        <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-gray-50/90 via-blue-50/30 to-gray-50/90 dark:from-slate-900/80 dark:via-slate-800/50 dark:to-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-gray-900 dark:text-white leading-tight">
                {t('notif_title') || 'الإشعارات والتنبيهات'}
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {unreadCount > 0 ? `${unreadCount} إشعار غير مقروء` : 'جميع التنبيهات محدثة'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Audio Bell Mute / Unmute Button with preview chime */}
            <button
              onClick={handleToggleSound}
              className={`p-2 rounded-xl transition-all duration-200 cursor-pointer ${
                soundEnabled 
                  ? 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400' 
                  : 'bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-400'
              }`}
              title={soundEnabled ? 'تنبيه الجرس مفعل (اضغط للتجربة أو الكتم)' : 'تنبيه الجرس مكتوم (اضغط للتفعيل)'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Mark All as Read */}
            {unreadCount > 0 && (
              <button 
                onClick={markAllAsRead}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                title="تحديد الكل كمقروء"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>قراءة الكل</span>
              </button>
            )}
          </div>
        </div>

        {/* Admin Action Banner for Pending Live/Courses Subscriptions */}
        {profile.role === 'admin' && adminPendingCount > 0 && (
          <div className="p-3 bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-amber-500/10 border-b border-amber-500/20">
            <Link
              to="/admin-dashboard/subscriptions"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between p-2.5 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 dark:text-amber-200 transition-all text-xs font-bold border border-amber-500/30"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                <span>طلبات اشتراك وباقات بانتظار الاعتماد</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full bg-amber-600 text-white text-[11px] font-black">
                  {adminPendingCount}
                </span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="px-3 pt-2.5 pb-2 border-b border-gray-100 dark:border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'الكل' },
            { id: 'live', label: 'الحصص' },
            { id: 'quiz', label: 'الامتحانات' },
            { id: 'xp', label: 'النقاط' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveCategory(tab.id)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeCategory === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notifications Scrollable List */}
        <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-100 dark:divide-slate-800/60 custom-scrollbar">
          {filteredNotifications.length === 0 ? (
            <div className="py-12 px-6 text-center">
              <div className="w-14 h-14 rounded-3xl bg-blue-50 dark:bg-slate-800 text-blue-500 mx-auto flex items-center justify-center mb-3">
                <Bell className="w-7 h-7 opacity-60" />
              </div>
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                لا توجد إشعارات حالياً
              </p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                ستصلك هنا تنبيهات الحصص قبل موعدها بـ 5 دقائق، ونتائج الامتحانات ونقاط التميز.
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => (
              <button
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`w-full text-start p-3.5 hover:bg-blue-50/40 dark:hover:bg-slate-800/50 transition-all cursor-pointer group flex items-start gap-3 relative ${
                  !notif.is_read 
                    ? 'bg-blue-50/30 dark:bg-blue-950/20' 
                    : ''
                }`}
              >
                {/* Category Icon */}
                {getNotificationIcon(notif.type, notif.title)}

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className={`text-xs truncate ${!notif.is_read ? 'font-bold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                      {notif.title}
                    </h4>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 font-medium">
                      {formatTimeAgo(notif.created_at)}
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 leading-relaxed line-clamp-2">
                    {notif.message}
                  </p>

                  {notif.link && (
                    <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 group-hover:underline">
                      <span>عرض التفاصيل</span>
                      <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                  )}
                </div>

                {/* Blue unread glowing indicator */}
                {!notif.is_read && (
                  <div className="shrink-0 mt-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600 dark:bg-blue-400"></span>
                    </span>
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
