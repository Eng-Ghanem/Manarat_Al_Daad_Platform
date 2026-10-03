import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Video, Calendar, Clock, BookOpen, Link as LinkIcon,
  CheckCircle, Loader, PlayCircle, XCircle, Clock4, Filter,
  CreditCard, Sparkles, Lock, RefreshCw, AlertTriangle, ArrowRight,
  Bell, UploadCloud, X, CheckCircle2, ShieldCheck, Eye, Info, FileText
} from 'lucide-react';
import FadeIn from '../components/FadeIn';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import BackButton from '../components/BackButton';
import toast from 'react-hot-toast';
import { formatSessionTitle, formatSessionDesc, formatGradeName, formatTime12h, formatTimeRange12h, compressImage, cleanTeacherNotes, cleanSessionTitle } from '../utils/helpers';

export default function StudentLiveSessions() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { user, profile } = useAuth();

  // Top Tab Switcher
  const [activeTab, setActiveTab] = useState('schedule'); // 'schedule' | 'my_package' | 'trial'

  // Sessions and Schedules
  const [sessions, setSessions] = useState([]);
  const [weeklySchedules, setWeeklySchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  // Student 8-Session Package State
  const [myPackage, setMyPackage] = useState(null);
  const [packageLoading, setPackageLoading] = useState(true);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [renewForm, setRenewForm] = useState({
    payment_method: 'vodafone_cash',
    wallet_number: '',
    receipt_file: null,
    receipt_preview: null
  });
  const [renewLoading, setRenewLoading] = useState(false);
  const [compressingReceipt, setCompressingReceipt] = useState(false);

  // Trial Sessions State
  const [trialSessions, setTrialSessions] = useState([]);
  const [hasRequestedTrial, setHasRequestedTrial] = useState(false);
  const [trialRequestLoading, setTrialRequestLoading] = useState(false);
  const [myTrialRequest, setMyTrialRequest] = useState(null);

  // Completed Sessions History State
  const [completedSessions, setCompletedSessions] = useState(() => {
    try {
      const savedUser = JSON.parse(localStorage.getItem('manarat_user') || '{}');
      const uid = savedUser?.id;
      if (uid) {
        const local = localStorage.getItem(`manarat_completed_${uid}`);
        return local ? JSON.parse(local) : [];
      }
    } catch (_) {}
    return [];
  });
  const [completedLoading, setCompletedLoading] = useState(false);
  const [completedMonthFilter, setCompletedMonthFilter] = useState('all');
  const [completedViewMode, setCompletedViewMode] = useState(() => {
    try {
      return localStorage.getItem('manarat_student_completed_view') || 'cards';
    } catch (_) {
      return 'cards';
    }
  }); // 'cards' | 'table'

  // Filters for individual sessions
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Available Months for Completed Sessions Filtering
  const studentAvailableMonths = useMemo(() => {
    const set = new Set();
    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    set.add(currentYM);

    completedSessions.forEach(cs => {
      const d = cs.completed_at || cs.created_at;
      if (d) {
        try {
          const ym = new Date(d).toISOString().slice(0, 7);
          if (ym && ym.length === 7) set.add(ym);
        } catch (_) {}
      }
    });

    const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

    return Array.from(set).sort().reverse().map(ym => {
      const [y, m] = ym.split('-');
      const mNum = parseInt(m, 10);
      const name = AR_MONTHS[mNum - 1] || m;
      return {
        value: ym,
        monthNum: mNum,
        label: `شهر ${mNum} (${name} ${y})`
      };
    });
  }, [completedSessions]);

  // Filtered Completed Sessions by selected month
  const filteredCompletedSessions = useMemo(() => {
    if (completedMonthFilter === 'all') return completedSessions;
    return completedSessions.filter(cs => {
      const d = cs.completed_at || cs.created_at;
      if (!d) return false;
      try {
        const ym = new Date(d).toISOString().slice(0, 7);
        return ym === completedMonthFilter;
      } catch (_) {
        return false;
      }
    });
  }, [completedSessions, completedMonthFilter]);

  // Smart 5-minute Alert State
  const [imminentSession, setImminentSession] = useState(null);

  useEffect(() => {
    fetchSessions(true);
    fetchWeeklySchedules();
    fetchMyPackage(true);
    fetchTrialSessions();
    fetchCompletedSessions(true);
  }, [user, profile?.grade_level]);

  // Real-time listener for package and completed sessions updates from teacher + focus sync
  useEffect(() => {
    if (!user) return;

    // 1. Supabase Realtime channel (Instant silent push updates across all teacher actions)
    const channel = supabase
      .channel(`student_live_sync_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_subscriptions' }, () => {
        fetchMyPackage(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completed_live_sessions' }, () => {
        fetchCompletedSessions(false);
        fetchMyPackage(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'weekly_schedules' }, () => {
        fetchWeeklySchedules();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'online_sessions' }, () => {
        fetchSessions(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trial_requests' }, () => {
        fetchTrialSessions();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trial_sessions' }, () => {
        fetchTrialSessions();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchMyPackage(false);
        fetchCompletedSessions(false);
      })
      .subscribe();

    // 2. Silent refresh on window focus / tab switch only
    const handleFocus = () => {
      fetchMyPackage(false);
      fetchCompletedSessions(false);
      fetchWeeklySchedules();
      fetchSessions(false);
      fetchTrialSessions();
    };
    window.addEventListener('focus', handleFocus);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') handleFocus();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user]);

  // Check imminent session every 30 seconds
  useEffect(() => {
    checkImminentSession();
    const interval = setInterval(checkImminentSession, 30000);
    return () => clearInterval(interval);
  }, [sessions, weeklySchedules, profile]);

  const getCleanZoomUrl = (url) => {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (/^\d{9,12}(\?.*)?$/.test(trimmed)) {
      return `https://zoom.us/j/${trimmed}`;
    }
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  const fetchSessions = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('online_sessions')
        .select('*')
        .order('start_time', { ascending: true });

      if (error) throw error;
      setSessions(data || []);
    } catch (err) {
      console.error('Error fetching live sessions:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const fetchWeeklySchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('weekly_schedules')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        const mapped = data.map(s => {
          let extra = {};
          if (s.notes && s.notes.startsWith('{') && s.notes.endsWith('}')) {
            try {
              const p = JSON.parse(s.notes);
              extra = {
                notes: p.custom_notes || '',
                target_type: p.target_type || s.target_type || 'grade',
                target_student_id: p.target_student_id || s.target_student_id,
                target_student_name: p.target_student_name || s.target_student_name
              };
            } catch (_) {}
          }
          return { ...s, ...extra };
        });
        setWeeklySchedules(mapped);
      } else {
        const local = localStorage.getItem('manarat_weekly_schedules');
        if (local) setWeeklySchedules(JSON.parse(local));
      }
    } catch (err) {
      const local = localStorage.getItem('manarat_weekly_schedules');
      if (local) setWeeklySchedules(JSON.parse(local));
    }
  };

  const fetchCompletedSessions = async (showLoading = false) => {
    if (!user) return;
    if (showLoading) setCompletedLoading(true);
    try {
      let query = supabase.from('completed_live_sessions').select('*');
      if (profile?.grade_level) {
        query = query.or(`student_id.eq.${user.id},and(student_id.is.null,grade_level.eq.${profile.grade_level})`);
      } else {
        query = query.eq('student_id', user.id);
      }

      const { data, error } = await query.order('completed_at', { ascending: false });

      if (!error && data) {
        setCompletedSessions(data);
        localStorage.setItem(`manarat_completed_${user.id}`, JSON.stringify(data));
      } else {
        const local = localStorage.getItem(`manarat_completed_${user.id}`);
        if (local) setCompletedSessions(JSON.parse(local));
      }
    } catch (err) {
      console.warn('Completed sessions fetch fallback:', err);
      const local = localStorage.getItem(`manarat_completed_${user.id}`);
      if (local) setCompletedSessions(JSON.parse(local));
    } finally {
      if (showLoading) setCompletedLoading(false);
    }
  };

  const fetchMyPackage = async (showLoading = false) => {
    if (!user) return;
    if (showLoading) setPackageLoading(true);
    try {
      const { data, error } = await supabase
        .from('live_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        const pkg = data[0];
        let status = pkg.status || 'not_subscribed';
        const remaining = pkg.remaining_sessions !== undefined ? pkg.remaining_sessions : 0;
        if (status === 'active' && remaining <= 0) {
          status = 'expired';
        }
        setMyPackage({
          ...pkg,
          status,
          remaining_sessions: remaining,
          total_sessions: pkg.total_sessions || 8
        });
      } else {
        // Non-subscribed students default to 0 sessions and not_subscribed status
        setMyPackage({
          remaining_sessions: 0,
          total_sessions: 8,
          status: 'not_subscribed'
        });
      }
    } catch (err) {
      console.warn('Live subscription fetch fallback:', err);
      setMyPackage({ remaining_sessions: 0, total_sessions: 8, status: 'not_subscribed' });
    } finally {
      if (showLoading) setPackageLoading(false);
    }
  };

  const fetchTrialSessions = async () => {
    try {
      const { data } = await supabase
        .from('trial_sessions')
        .select('*')
        .order('start_time', { ascending: true });
      if (data) setTrialSessions(data);

      if (user) {
        const { data: reqData } = await supabase
          .from('trial_requests')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);
        if (reqData && reqData.length > 0) {
          setHasRequestedTrial(true);
          setMyTrialRequest(reqData[0]);
        }
      }
    } catch (err) {
      console.warn('Trial fetch error:', err);
    }
  };

  // Smart Alert: detect if a session is starting in <= 15 minutes or currently active
  const checkImminentSession = () => {
    const now = new Date();
    const studentGrade = profile?.grade_level;

    // Check individual scheduled sessions
    for (const s of sessions) {
      if (studentGrade && s.grade_level && s.grade_level !== studentGrade) continue;
      const start = new Date(s.start_time);
      const end = new Date(s.end_time);

      const diffMin = (start.getTime() - now.getTime()) / (1000 * 60);

      // Starting within 15 minutes OR currently live
      if ((diffMin > 0 && diffMin <= 15) || (now >= start && now <= end)) {
        setImminentSession({
          title: s.title,
          zoom_link: s.zoom_link,
          isLive: now >= start && now <= end,
          minutesLeft: Math.max(0, Math.round(diffMin))
        });
        return;
      }
    }

    // Check weekly recurring schedules
    const todayDayName = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][now.getDay()];
    for (const ws of weeklySchedules) {
      if (studentGrade && ws.grade_level && ws.grade_level !== studentGrade) continue;
      if (Array.isArray(ws.days) && ws.days.includes(todayDayName)) {
        const [sh, sm] = (ws.start_time || '13:00').split(':').map(Number);
        const [eh, em] = (ws.end_time || '14:00').split(':').map(Number);

        const startTime = new Date(now);
        startTime.setHours(sh, sm, 0, 0);
        const endTime = new Date(now);
        endTime.setHours(eh, em, 0, 0);

        const diffMin = (startTime.getTime() - now.getTime()) / (1000 * 60);
        if ((diffMin > 0 && diffMin <= 15) || (now >= startTime && now <= endTime)) {
          setImminentSession({
            title: ws.title || 'الحصة الأسبوعية الثابتة',
            zoom_link: ws.zoom_link,
            isLive: now >= startTime && now <= endTime,
            minutesLeft: Math.max(0, Math.round(diffMin))
          });
          return;
        }
      }
    }

    setImminentSession(null);
  };

  const handleBookTrial = async (trialSession) => {
    if (!user) {
      toast.error('يرجى تسجيل الدخول أولاً');
      return;
    }
    setTrialRequestLoading(true);
    try {
      await supabase.from('trial_requests').insert([{
        trial_session_id: trialSession.id,
        user_id: user.id,
        student_name: profile?.full_name || 'طالب جديد',
        student_phone: profile?.phone_number || '',
        grade_level: profile?.grade_level || trialSession.grade_level,
        status: 'pending'
      }]);
      setHasRequestedTrial(true);
      toast.success('🎉 تم حجز موعد الحصة التجريبية بنجاح! يمكنك الدخول مباشرة عبر رابط الزووم في الموعد المحدد.');

      // Notify teachers about trial session booking
      try {
        const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin');
        if (admins && admins.length > 0) {
          const sName = profile?.full_name || 'طالب جديد';
          const gName = profile?.grade_level || trialSession.grade_level || 'عام';
          await supabase.from('notifications').insert(admins.map(a => ({
            user_id: a.id,
            title: '🎯 طلب حجز حصة تجريبية!',
            message: `قام الطالب (${sName}) بحجز مقعد في حصة تجريبية (${gName}). اضغط للاطلاع.`,
            type: 'live_session',
            link: '/admin-dashboard/live-sessions?tab=trials',
            is_read: false
          })));
        }
      } catch (_) {}
    } catch (err) {
      console.warn('Booking trial error:', err);
      setHasRequestedTrial(true);
      toast.success('تم حجز مقعدك في الحصة التجريبية بنجاح!');
    } finally {
      setTrialRequestLoading(false);
    }
  };

  const handleRenewSubmit = async (e) => {
    e.preventDefault();
    if (!renewForm.wallet_number.trim()) {
      toast.error('يرجى إدخال رقم المحفظة التي تم التحويل منها');
      return;
    }
    setRenewLoading(true);

    try {
      // 1. Safely check if user already has an existing live_subscription and preserve existing receipt
      const { data: existing } = await supabase
        .from('live_subscriptions')
        .select('id, receipt_url')
        .eq('user_id', user.id)
        .maybeSingle();

      let receiptUrl = existing?.receipt_url || myPackage?.receipt_url || null;

      // 2. Upload receipt if user picked a new file
      if (renewForm.receipt_file) {
        const fileToUpload = renewForm.receipt_file;
        const fileExt = fileToUpload.name?.split('.').pop() || 'jpg';
        const fileName = `${user.id}_${Date.now()}.${fileExt}`;

        const { data: upData, error: upErr } = await supabase.storage
          .from('receipts')
          .upload(`live_renewals/${fileName}`, fileToUpload, {
            contentType: fileToUpload.type || 'image/jpeg',
            upsert: true
          });

        if (upErr) {
          console.error('Storage upload error:', upErr);
          toast.error('تعذر رفع صورة الإيصال: ' + (upErr.message || 'يرجى المحاولة بصورة أصغر حجماً'));
          setRenewLoading(false);
          return;
        }

        const { data: pubData } = supabase.storage
          .from('receipts')
          .getPublicUrl(`live_renewals/${fileName}`);
        receiptUrl = pubData?.publicUrl || existing?.receipt_url || null;
      }

      const isFirstSub = !myPackage || myPackage.status === 'not_subscribed';
      const remainingCount = isFirstSub ? 0 : (existing?.remaining_sessions !== undefined ? existing.remaining_sessions : 0);
      const notesText = isFirstSub ? 'طلب اشتراك جديد في باقة 8 حصص' : 'طلب تجديد باقة 8 حصص';
      
      const payload = {
        user_id: user.id,
        grade_level: profile?.grade_level || 'prep_1',
        total_sessions: 8,
        remaining_sessions: remainingCount,
        status: 'pending',
        payment_method: renewForm.payment_method,
        wallet_number: renewForm.wallet_number.trim(),
        receipt_url: receiptUrl,
        notes: notesText,
        created_at: new Date().toISOString()
      };

      // 1. Try Backend API first (bypasses RLS issues reliably)
      let backendSuccess = false;
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const apiRes = await fetch(`${apiUrl}/api/live-subscriptions/renew`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              grade_level: profile?.grade_level || 'prep_1',
              payment_method: renewForm.payment_method,
              wallet_number: renewForm.wallet_number.trim(),
              receipt_url: receiptUrl,
              notes: notesText
            })
          });
          const apiJson = await apiRes.json();
          if (apiRes.ok && apiJson.success) {
            backendSuccess = true;
          }
        }
      } catch (apiErr) {
        console.warn('Backend renewal endpoint fallback:', apiErr);
      }

      // 2. Direct Supabase fallback if backend endpoint was not reached
      if (!backendSuccess) {
        let dbError = null;
        if (existing?.id) {
          const res = await supabase
            .from('live_subscriptions')
            .update(payload)
            .eq('id', existing.id);
          dbError = res.error;
        } else {
          const res = await supabase
            .from('live_subscriptions')
            .insert([payload]);
          dbError = res.error;
        }
        if (dbError) throw dbError;
      }

      toast.success(
        isFirstSub
          ? '🎉 تم إرسال طلب اشتراكك في باقة الـ 8 حصص بنجاح! سيتم فتح رابط الحصص فور تأكيد المعلم للتحويل.'
          : '✅ تم إرسال طلب تجديد باقة الـ 8 حصص بنجاح! سيتم تفعيل حسابك فور مراجعة التحويل.'
      );

      // Notify teachers about live package subscription or renewal
      try {
        const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin');
        if (admins && admins.length > 0) {
          const sName = profile?.full_name || 'طالب';
          await supabase.from('notifications').insert(admins.map(a => ({
            user_id: a.id,
            title: isFirstSub ? '💳 طلب اشتراك باقة جديد!' : '💳 طلب تجديد باقة 8 حصص!',
            message: `قام الطالب (${sName}) برفع إيصال تحويل لباقة الحصص المباشرة. اضغط للاعتماد والتفعيل.`,
            type: 'live_session',
            link: '/admin-dashboard/subscriptions',
            is_read: false
          })));
        }
      } catch (_) {}

      setIsRenewModalOpen(false);
      fetchMyPackage();
    } catch (err) {
      console.error('Renew submit error:', err);
      toast.error('حدث خطأ أثناء إرسال الطلب، يرجى المحاولة لاحقاً');
    } finally {
      setRenewLoading(false);
    }
  };

  const getSessionComputedStatus = (session) => {
    if (session.status === 'canceled') return 'canceled';
    if (session.status === 'postponed') return 'postponed';
    if (session.status === 'completed') return 'completed';

    const now = new Date();
    const startTime = new Date(session.start_time);
    const endTime = new Date(session.end_time);

    if (now > endTime) return 'completed';
    if (now >= startTime && now <= endTime) return 'live';
    return 'scheduled';
  };

  // Has active access to live sessions
  const hasLiveAccess = myPackage && myPackage.status === 'active' && myPackage.remaining_sessions > 0;

  // Filter sessions
  const filteredSessions = sessions.filter(s => {
    // Only show sessions for the student's grade or global sessions
    if (profile?.grade_level && s.grade_level && s.grade_level !== profile.grade_level) {
      return false;
    }
    if (filterStatus !== 'all') {
      const compStatus = getSessionComputedStatus(s);
      if (filterStatus === 'scheduled') {
        if (compStatus !== 'scheduled' && compStatus !== 'live') return false;
      } else if (compStatus !== filterStatus) {
        return false;
      }
    }
    if (filterMonth !== 'all') {
      if (!s.start_time) return false;
      const date = new Date(s.start_time);
      const sMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (sMonth !== filterMonth) return false;
    }
    return true;
  });

  // Filter weekly schedules for student's grade or private 1-on-1 schedule
  const myWeeklySchedules = weeklySchedules.filter(ws => {
    if (ws.target_type === 'student') {
      return ws.target_student_id === user?.id;
    }
    if (!profile?.grade_level) return true;
    return !ws.grade_level || ws.grade_level === profile.grade_level;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-16 pt-24 font-arabic selection:bg-blue-500/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="mb-6 flex justify-start">
          <BackButton to="/dashboard" text="العودة للرئيسية" />
        </div>

        {/* ===================== SMART 5-MINUTE ALERT BANNER ===================== */}
        {imminentSession && (
          <FadeIn>
            <div className="mb-8 p-5 rounded-3xl bg-gradient-to-r from-red-600 via-rose-600 to-indigo-700 text-white shadow-xl shadow-red-500/20 border-2 border-white/20 flex flex-col sm:flex-row items-center justify-between gap-4 animate-pulse">
              <div className="flex items-center gap-4 text-center sm:text-right">
                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 shadow-inner">
                  <Bell className="w-8 h-8 text-white animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center gap-2 justify-center sm:justify-start">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-white text-red-600 uppercase">
                      {imminentSession.isLive ? '🔴 مباشر الآن' : '🔔 تنبيه موعد الحصة'}
                    </span>
                    <span className="text-xs text-white/90 font-bold">
                      {imminentSession.isLive ? 'الحصة بدأت الآن، تفضل بالانضمام' : `تبدأ خلال ${imminentSession.minutesLeft} دقائق!`}
                    </span>
                  </div>
                  <h3 className="text-xl font-black mt-1">{imminentSession.title}</h3>
                </div>
              </div>

              {hasLiveAccess ? (
                <a
                  href={getCleanZoomUrl(imminentSession.zoom_link)}
                  target="_blank"
                  rel="noreferrer"
                  className="px-8 py-3.5 rounded-2xl bg-white text-red-600 font-extrabold text-base hover:bg-gray-100 transition-all shadow-lg hover:scale-105 active:scale-95 shrink-0 flex items-center gap-2"
                >
                  <PlayCircle className="w-5 h-5 text-red-600" />
                  دخول البث المباشر الآن
                </a>
              ) : (
                <button
                  onClick={() => setIsRenewModalOpen(true)}
                  className="px-6 py-3 rounded-2xl bg-amber-400 text-gray-900 font-black text-sm hover:bg-amber-300 transition-all shadow-lg shrink-0 flex items-center gap-2 cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  {myPackage?.status === 'not_subscribed'
                    ? 'اشترك في باقة الـ 8 حصص للدخول'
                    : myPackage?.status === 'pending'
                    ? 'طلبك قيد المراجعة - تفاصيل'
                    : 'انتهت باقتك - تجديد للدخول'}
                </button>
              )}
            </div>
          </FadeIn>
        )}

        {/* Hero Title */}
        <FadeIn>
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-blue-200 dark:border-blue-800">
              <Video className="w-10 h-10" />
            </div>
            <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white font-arabic mb-3">
              منصة الحصص الأونلاين المباشرة
            </h1>
            <p className="text-base text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              تابع جدول مواعيدك الأسبوعية الثابتة، رصيد باقة الـ 8 حصص الخاصة بك، والحصص التجريبية المجانية.
            </p>
          </div>
        </FadeIn>

        {/* ===================== Top Navigation Switcher ===================== */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-2.5 shadow-md border border-gray-100 dark:border-slate-700 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <button
              onClick={() => setActiveTab('schedule')}
              className={`py-3.5 px-4 rounded-2xl font-bold transition-all text-sm flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'schedule'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>الجدول والمواعيد الأسبوعية</span>
            </button>

            <button
              onClick={() => setActiveTab('my_package')}
              className={`py-3.5 px-4 rounded-2xl font-bold transition-all text-sm flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'my_package'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>باقتي (رصيد الـ 8 حصص)</span>
              {myPackage && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                  hasLiveAccess 
                    ? 'bg-emerald-500 text-white' 
                    : myPackage.status === 'pending'
                    ? 'bg-amber-500 text-white'
                    : myPackage.status === 'not_subscribed'
                    ? 'bg-slate-500 text-white'
                    : 'bg-red-500 text-white'
                }`}>
                  {hasLiveAccess 
                    ? `${myPackage.remaining_sessions} / 8`
                    : myPackage.status === 'pending'
                    ? 'قيد التفعيل'
                    : myPackage.status === 'not_subscribed'
                    ? 'غير مشترك'
                    : '0 / 8 منتهية'}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('completed')}
              className={`py-3.5 px-4 rounded-2xl font-bold transition-all text-sm flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'completed'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              <span>سجل الحصص المكتملة</span>
              {completedSessions.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-purple-500 text-white">
                  {completedSessions.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('trial')}
              className={`py-3.5 px-4 rounded-2xl font-bold transition-all text-sm flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'trial'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>الحصة التجريبية (30 دقيقة)</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: SCHEDULE & LIVE SESSIONS                                          */}
        {/* ========================================================================= */}
        {activeTab === 'schedule' && (
          <FadeIn>
            
            {/* Trial Approved - Payment Prompt Banner */}
            {myTrialRequest?.status === 'enrolled' && !hasLiveAccess && myPackage?.status !== 'pending' && (
              <div className="mb-6 p-5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-emerald-500/15 border-2 border-emerald-500/40 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-emerald-950 dark:text-emerald-200 text-base">
                      🎉 تهانينا! أكّد المعلم أ/ سيد غريب تأهلك للاستمرار معنا بعد الحصة التجريبية
                    </h4>
                    <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 mt-0.5">
                      يُرجى الآن سداد باقة الـ 8 حصص للبدء فوراً وتثبيت مواعيدك في الجدول الأسبوعي!
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsRenewModalOpen(true)}
                  className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs sm:text-sm shadow-md transition-all shrink-0 cursor-pointer"
                >
                  💳 سداد باقة الـ 8 حصص الآن
                </button>
              </div>
            )}

            {/* Subscription Status Banner in Schedule Tab */}
            <div className={`mb-6 p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
              hasLiveAccess
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-200'
                : myPackage?.status === 'pending'
                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50 text-amber-900 dark:text-amber-200'
                : myPackage?.status === 'not_subscribed'
                ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/50 text-rose-900 dark:text-rose-200'
                : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/50 text-red-900 dark:text-red-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  hasLiveAccess
                    ? 'bg-emerald-500 text-white'
                    : myPackage?.status === 'pending'
                    ? 'bg-amber-500 text-white'
                    : 'bg-rose-500 text-white'
                }`}>
                  {hasLiveAccess ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : myPackage?.status === 'pending' ? (
                    <Clock className="w-5 h-5 animate-pulse" />
                  ) : (
                    <Lock className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h4 className="font-black text-sm sm:text-base">
                    {hasLiveAccess ? (
                      `باقتك نشطة: متبقي لك (${myPackage.remaining_sessions} من 8 حصص)`
                    ) : myPackage?.status === 'pending' ? (
                      'طلب اشتراكك في باقة الـ 8 حصص قيد المراجعة من المعلم'
                    ) : myPackage?.status === 'not_subscribed' ? (
                      'أنت غير مشترك في باقة الـ 8 حصص (رصيدك: 0 حصص)'
                    ) : (
                      'انتهت باقتك: لقد استنفدت كامل الـ 8 حصص (0 متبقي)'
                    )}
                  </h4>
                  <p className="text-xs opacity-90 mt-0.5">
                    {hasLiveAccess ? (
                      'يمكنك الدخول مباشرة عبر أزرار الزووم بالأسفل لجميع مواعيدك الأسبوعية المجدولة.'
                    ) : myPackage?.status === 'pending' ? (
                      'تم إرسال إيصال التحويل، وسيتم تفعيل حسابك وفتح رابط زووم فور مراجعة المعلم.'
                    ) : myPackage?.status === 'not_subscribed' ? (
                      'لا يمكنك دخول حصص البث المباشر عبر زووم حتى يتم الاشتراك وسداد قيمة الباقة أولاً.'
                    ) : (
                      'تم قفل رابط زووم تلقائياً لحين تجديد الاشتراك وشحن 8 حصص جديدة للمتابعة.'
                    )}
                  </p>
                </div>
              </div>

              {!hasLiveAccess && (
                <button
                  onClick={() => setIsRenewModalOpen(true)}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs shrink-0 flex items-center gap-2 shadow-sm transition-all cursor-pointer ${
                    myPackage?.status === 'pending'
                      ? 'bg-amber-500 hover:bg-amber-600 text-white'
                      : 'bg-rose-600 hover:bg-rose-700 text-white'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  {myPackage?.status === 'pending'
                    ? 'تعديل بيانات التحويل'
                    : myPackage?.status === 'not_subscribed'
                    ? 'اشترك الآن في الباقة'
                    : 'تجديد الباقة الآن (+8)'}
                </button>
              )}
            </div>

            {/* Section A: Fixed Weekly Schedule Card */}
            <div className="bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl mb-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/20 blur-[80px] rounded-full pointer-events-none"></div>

              <div className="relative z-10">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-white/10">
                  <div>
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-500/30 text-blue-200 border border-blue-400/30 mb-2 inline-block">
                      {profile?.grade_level ? formatGradeName(profile.grade_level) : 'جدول صفك الدراسي'}
                    </span>
                    <h2 className="text-2xl md:text-3xl font-extrabold flex items-center gap-2">
                      <Clock className="w-7 h-7 text-indigo-300" />
                      مواعيد حصصك الأسبوعية الثابتة
                    </h2>
                  </div>
                  
                  {/* Balance Indicator in Header */}
                  <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-center sm:text-right">
                    <span className="text-xs text-blue-200 block">رصيد باقتك الحالي:</span>
                    <span className="text-lg font-black text-white">
                      {hasLiveAccess 
                        ? `${myPackage.remaining_sessions} من 8 حصص` 
                        : myPackage?.status === 'pending'
                        ? 'قيد التفعيل'
                        : myPackage?.status === 'not_subscribed'
                        ? 'غير مشترك (0 حصص)'
                        : '0 من 8 حصص (منتهية)'}
                    </span>
                  </div>
                </div>

                {myWeeklySchedules.length === 0 ? (
                  <div className="text-center py-8 bg-white/5 rounded-2xl border border-white/10">
                    <Calendar className="w-10 h-10 text-blue-300/60 mx-auto mb-2" />
                    <p className="text-blue-100 font-bold">جاري ضبط المواعيد الأسبوعية لصفك بواسطة المعلم.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {myWeeklySchedules.map(sch => {
                      const isPrivate = sch.target_type === 'student';
                      return (
                        <div 
                          key={sch.id} 
                          className={`p-5 rounded-2xl backdrop-blur-md border flex flex-col justify-between ${
                            isPrivate 
                              ? 'bg-purple-900/30 border-purple-400/50 shadow-lg ring-1 ring-purple-400/40' 
                              : 'bg-white/10 border-white/15'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <h4 className="text-lg font-bold text-white">{sch.title}</h4>
                              {isPrivate && (
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-purple-500 text-white flex items-center gap-1 shadow-sm shrink-0">
                                  <Sparkles className="w-3 h-3" />
                                  حصة خاصة بك
                                </span>
                              )}
                            </div>
                            <div className="space-y-1.5 text-sm text-blue-100 mb-4">
                              <p className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-blue-300" />
                                <span className="font-bold">الأيام:</span>
                                <span className="font-black text-white">{Array.isArray(sch.days) ? sch.days.join(' و ') : sch.days}</span>
                              </p>
                              <p className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-orange-300" />
                                <span className="font-bold">الموعد (نظام 12 ساعة):</span>
                                <span dir="ltr" className="font-bold text-white">
                                  {formatTimeRange12h(sch.start_time, sch.end_time, isRTL)}
                                </span>
                              </p>
                              {sch.notes && (
                                <p className="text-xs text-blue-200/80 bg-black/20 p-2 rounded-lg mt-2">
                                  {sch.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          {hasLiveAccess ? (
                            <a
                              href={getCleanZoomUrl(sch.zoom_link)}
                              target="_blank"
                              rel="noreferrer"
                              className={`w-full py-3 rounded-xl text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-md hover:scale-[1.02] ${
                                isPrivate ? 'bg-purple-600 hover:bg-purple-500' : 'bg-blue-500 hover:bg-blue-600'
                              }`}
                            >
                              <PlayCircle className="w-4 h-4" />
                              دخول زووم الحصة الثابتة
                            </a>
                          ) : (
                            <button
                              onClick={() => setIsRenewModalOpen(true)}
                              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                            >
                              <Lock className="w-4 h-4" />
                              {myPackage?.status === 'not_subscribed'
                                ? 'اشترك في باقة الـ 8 حصص للدخول'
                                : myPackage?.status === 'pending'
                                ? 'طلبك قيد التفعيل من المعلم'
                                : 'انتهت باقتك (0 حصص) - تجديد للدخول'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </FadeIn>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: MY 8-SESSION PACKAGE STATUS                                       */}
        {/* ========================================================================= */}
        {activeTab === 'my_package' && (
          <FadeIn>
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-10 shadow-sm border border-gray-100 dark:border-slate-700 mb-8 max-w-3xl mx-auto">
              
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4 border border-emerald-200 dark:border-emerald-800">
                  <CreditCard className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white">
                  باقة الحصص الأونلاين (8 حصص مقدماً)
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  تمنحك الباقة صلاحية حضور 8 حصص مباشرة تفاعلية عبر زووم مع الأستاذ.
                </p>
              </div>

              {/* Package Card */}
              {myPackage && (
                <div className={`p-6 rounded-3xl border-2 mb-8 ${
                  hasLiveAccess 
                    ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20' 
                    : myPackage.status === 'pending'
                    ? 'border-amber-400 bg-amber-50/40 dark:bg-amber-950/20'
                    : 'border-red-300 bg-red-50/30 dark:bg-red-950/20'
                }`}>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-black text-gray-500 uppercase">حالة الباقة</span>
                    {hasLiveAccess ? (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500 text-white flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> باقة نشطة
                      </span>
                    ) : myPackage.status === 'pending' ? (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500 text-white flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 animate-pulse" /> قيد المراجعة والتفعيل
                      </span>
                    ) : myPackage.status === 'not_subscribed' ? (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-slate-500 text-white flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5" /> غير مشترك بعد
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-red-500 text-white flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> باقة منتهية (0 حصص)
                      </span>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-6">
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="text-2xl font-black text-gray-900 dark:text-white">
                        {myPackage.remaining_sessions || 0} <span className="text-sm font-normal text-gray-500">من 8 حصص متبقية</span>
                      </span>
                      <span className="text-xs font-black text-gray-400">
                        {Math.round(((myPackage.remaining_sessions || 0) / 8) * 100)}%
                      </span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-700 ${
                          hasLiveAccess ? 'bg-emerald-500' : myPackage.status === 'pending' ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.round(((myPackage.remaining_sessions || 0) / 8) * 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {!hasLiveAccess && (
                    <div className={`p-4 rounded-2xl text-sm font-bold mb-4 flex items-center gap-3 ${
                      myPackage.status === 'pending'
                        ? 'bg-amber-100/70 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200'
                        : myPackage.status === 'not_subscribed'
                        ? 'bg-rose-100/70 dark:bg-rose-900/30 text-rose-900 dark:text-rose-200'
                        : 'bg-red-100/70 dark:bg-red-900/30 text-red-900 dark:text-red-200'
                    }`}>
                      <AlertTriangle className="w-5 h-5 shrink-0" />
                      <p>
                        {myPackage.status === 'pending'
                          ? 'تم إرسال طلب اشتراكك إلى المعلم، وجاري مراجعة إيصال التحويل لتفعيل رصيد الـ 8 حصص.'
                          : myPackage.status === 'not_subscribed'
                          ? 'أنت غير مشترك حالياً في باقة الحصص المباشرة. اضغط على الزر بالأسفل للاشتراك وتفعيل رصيدك.'
                          : 'لقد استنفدت كامل الـ 8 حصص المدفوعة مقدماً. برجاء تجديد الاشتراك للمتابعة في الحصص القادمة.'}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => setIsRenewModalOpen(true)}
                    className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
                  >
                    <RefreshCw className="w-5 h-5" />
                    {hasLiveAccess 
                      ? 'شحن وتجديد 8 حصص إضافية مقدماً' 
                      : myPackage.status === 'pending'
                      ? 'تعديل أو إعادة إرسال بيانات التحويل'
                      : myPackage.status === 'not_subscribed'
                      ? 'الاشتراك وتفعيل باقة الـ 8 حصص الآن'
                      : 'تجديد الاشتراك الآن (+8 حصص)'}
                  </button>
                </div>
              )}

              {/* Instructions */}
              <div className="bg-gray-50 dark:bg-slate-900 p-5 rounded-2xl border border-gray-100 dark:border-slate-800 text-xs text-gray-600 dark:text-gray-400 space-y-2">
                <h4 className="font-bold text-gray-900 dark:text-white text-sm mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  قواعد وشروط باقة الحصص:
                </h4>
                <p>• يتم خصم حصة واحدة عند حضورك الحصة المباشرة مع المعلم.</p>
                <p>• في حالة الاعتذار المسبق عن الحصة، لا يتم خصمها وتظل محفوظة في رصيدك.</p>
                <p>• عند وصول الرصيد إلى 0 حصص، يقفل رابط الزووم تلقائياً لحين تجديد الباقة.</p>
              </div>

            </div>
          </FadeIn>
        )}

        {/* ========================================================================= */}
        {/* TAB: COMPLETED SESSIONS HISTORY                                          */}
        {/* ========================================================================= */}
        {activeTab === 'completed' && (
          <FadeIn>
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-slate-700 mb-8 max-w-4xl mx-auto">
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-6 border-b border-gray-100 dark:border-slate-700">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <CheckCircle2 className="w-7 h-7 text-purple-600 dark:text-purple-400" />
                    سجل الحصص المكتملة والحضور
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                    توثيق كامل لكافة الحصص الأونلاين التي حضرتها مع المعلم بالتاريخ والوقت والتفاصيل.
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="px-3.5 py-1.5 rounded-full text-xs font-black bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                    إجمالي الحصص المكتملة: {completedSessions.length}
                  </span>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30">
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400 block mb-1">الحصص التي حضرتها</span>
                  <span className="text-2xl font-black text-gray-900 dark:text-white">{completedSessions.length} حصة</span>
                </div>
                <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 block mb-1">الرصيد المتبقي بالباقة</span>
                  <span className="text-2xl font-black text-gray-900 dark:text-white">
                    {hasLiveAccess ? `${myPackage.remaining_sessions} من 8 حصص` : '0 من 8 حصص'}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block mb-1">حالة الباقة الحالية</span>
                  <span className={`text-base font-black ${hasLiveAccess ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                    {hasLiveAccess 
                      ? 'نشطة وجاهزة للحصص ✅' 
                      : myPackage?.status === 'pending'
                      ? 'قيد المراجعة والتفعيل ⏳'
                      : myPackage?.status === 'not_subscribed'
                      ? 'غير مشترك بعد 🔒'
                      : 'منتهية (تحتاج تجديد) ⚠️'}
                  </span>
                </div>
              </div>

              {/* Month Filter Bar */}
              {completedSessions.length > 0 && (
                <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 p-4 rounded-2xl bg-gray-50 dark:bg-slate-900/60 border border-gray-100 dark:border-slate-700/80 mb-6">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 block">فلترة الحصص حسب الشهر:</span>
                      <span className="text-xs font-black text-gray-900 dark:text-white">
                        {completedMonthFilter === 'all'
                          ? `كافة الحصص (${filteredCompletedSessions.length} حصة)`
                          : `حصص شهر ${studentAvailableMonths.find(m => m.value === completedMonthFilter)?.label || completedMonthFilter} (${filteredCompletedSessions.length} حصة)`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* View Switcher: Cards vs Table */}
                    <div className="flex items-center bg-gray-200/80 dark:bg-slate-800 p-1 rounded-xl border border-gray-300/60 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => {
                          setCompletedViewMode('cards');
                          localStorage.setItem('manarat_student_completed_view', 'cards');
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          completedViewMode === 'cards'
                            ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs font-black'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                        title="عرض كبطاقات تفصيلية"
                      >
                        🗂️ بطاقات تفصيلية
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCompletedViewMode('table');
                          localStorage.setItem('manarat_student_completed_view', 'table');
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          completedViewMode === 'table'
                            ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs font-black'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                        title="عرض كجدول مضغوط"
                      >
                        📊 جدول مضغوط
                      </button>
                    </div>

                    <select
                      value={completedMonthFilter}
                      onChange={(e) => setCompletedMonthFilter(e.target.value)}
                      className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-black text-gray-900 dark:text-white outline-none cursor-pointer shadow-xs focus:ring-2 focus:ring-purple-500/30"
                    >
                      <option value="all">📅 جميع الشهور والأعوام</option>
                      {studentAvailableMonths.map(m => (
                        <option key={m.value} value={m.value}>
                          🗓️ {m.label}
                        </option>
                      ))}
                    </select>

                    {completedMonthFilter !== 'all' && (
                      <button
                        onClick={() => setCompletedMonthFilter('all')}
                        className="px-3 py-2.5 rounded-xl text-xs font-bold bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors cursor-pointer"
                      >
                        إلغاء الفلتر
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Sessions List */}
              {completedLoading && completedSessions.length === 0 ? (
                <div className="text-center py-12">
                  <Loader className="w-8 h-8 animate-spin mx-auto text-purple-600 mb-2" />
                  <p className="text-sm font-bold text-gray-500">جاري تحميل سجل الحصص المكتملة...</p>
                </div>
              ) : completedSessions.length === 0 ? (
                <div className="text-center py-16 px-4 bg-gray-50 dark:bg-slate-900/40 rounded-3xl border border-dashed border-gray-200 dark:border-slate-700">
                  <div className="w-16 h-16 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2">لا توجد حصص مكتملة مسجلة بعد</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                    بمجرد انتهاء حصتك المباشرة وخصمها من قبل المعلم، ستظهر تفاصيلها وتاريخها وساعتها هنا تلقائياً لتوثيق حضورك.
                  </p>
                </div>
              ) : filteredCompletedSessions.length === 0 ? (
                <div className="text-center py-12 px-4 bg-gray-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700">
                  <Calendar className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                    لا توجد حصص مكتملة مسجلة في هذا الشهر المحدد.
                  </p>
                  <button
                    onClick={() => setCompletedMonthFilter('all')}
                    className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 transition-colors cursor-pointer"
                  >
                    عرض جميع الحصص المكتملة
                  </button>
                </div>
              ) : completedViewMode === 'cards' ? (
                /* ==================== CARD VIEW ==================== */
                <div className="space-y-3">
                  {filteredCompletedSessions.map(cs => {
                    const dateObj = new Date(cs.completed_at);
                    const formattedDate = !isNaN(dateObj.getTime())
                      ? dateObj.toLocaleDateString('ar-EG', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                      : '-';
                    const formattedTime = !isNaN(dateObj.getTime())
                      ? dateObj.toLocaleTimeString('ar-EG', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : '';

                    return (
                      <div 
                        key={cs.id}
                        className="p-4 sm:p-5 rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900/60 shadow-xs hover:border-purple-200 dark:hover:border-purple-800 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-black text-base text-gray-900 dark:text-white">{cleanSessionTitle(cs.session_title)}</h4>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300">
                              مكتملة ومحسوبة ✅
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 font-bold flex-wrap">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-purple-500" />
                              {formattedDate}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-blue-500" />
                              {formattedTime}
                            </span>
                            {cs.grade_level && (
                              <>
                                <span>•</span>
                                <span>{formatGradeName(cs.grade_level)}</span>
                              </>
                            )}
                          </div>

                          {cs.teacher_notes && (
                            <p className="text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-slate-800/60 p-2.5 rounded-xl mt-2 font-medium flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                              <span>{cleanTeacherNotes(cs.teacher_notes)}</span>
                            </p>
                          )}
                        </div>

                        <div className="shrink-0 self-end sm:self-center">
                          <span className="px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-black border border-purple-200 dark:border-purple-800/50">
                            -1 حصة من الباقة
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* ==================== CONDENSED TABLE VIEW ==================== */
                <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900/40 shadow-xs">
                  <table className="w-full text-right text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-slate-700 text-xs font-black text-gray-500 dark:text-gray-400 uppercase bg-gray-50/50 dark:bg-slate-800/50">
                        <th className="py-3.5 px-4">تاريخ الحصة وتوقيتها</th>
                        <th className="py-3.5 px-4">الصف الدراسي</th>
                        <th className="py-3.5 px-4">عنوان الحصة / الدرس المشروح</th>
                        <th className="py-3.5 px-4">ملاحظات المعلم</th>
                        <th className="py-3.5 px-4 text-center">حالة الحصة والخصم</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                      {filteredCompletedSessions.map(cs => {
                        const dateObj = new Date(cs.completed_at);
                        const formattedDate = !isNaN(dateObj.getTime())
                          ? dateObj.toLocaleDateString('ar-EG', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })
                          : '-';
                        const formattedTime = !isNaN(dateObj.getTime())
                          ? dateObj.toLocaleTimeString('ar-EG', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : '';

                        return (
                          <tr key={cs.id} className="hover:bg-purple-50/30 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="py-4 px-4 whitespace-nowrap">
                              <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                                <span>{formattedDate}</span>
                              </div>
                              <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5 font-medium">
                                <Clock className="w-3 h-3 text-blue-500 shrink-0" />
                                <span>{formattedTime}</span>
                              </div>
                            </td>
                            <td className="py-4 px-4 whitespace-nowrap">
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                {formatGradeName(cs.grade_level)}
                              </span>
                            </td>
                            <td className="py-4 px-4 font-bold text-purple-700 dark:text-purple-300">
                              {cleanSessionTitle(cs.session_title) || 'حصة أونلاين مباشرة'}
                            </td>
                            <td className="py-4 px-4 text-xs text-gray-600 dark:text-gray-300 max-w-xs">
                              {cs.teacher_notes ? (
                                <div className="bg-gray-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-gray-100 dark:border-slate-700/60 font-medium flex items-center gap-1.5">
                                  <FileText className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                                  <span>{cleanTeacherNotes(cs.teacher_notes)}</span>
                                </div>
                              ) : (
                                <span className="text-gray-400 italic">لا توجد ملاحظات إضافية</span>
                              )}
                            </td>
                            <td className="py-4 px-4 text-center whitespace-nowrap">
                              <div className="flex flex-col items-center gap-1">
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300 inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  مكتملة ومحسوبة
                                </span>
                                <span className="px-2.5 py-0.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-[11px] font-black border border-purple-200 dark:border-purple-800/50">
                                  -1 حصة من الباقة
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          </FadeIn>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: FREE TRIAL SESSION (30 MINUTES)                                   */}
        {/* ========================================================================= */}
        {activeTab === 'trial' && (
          <FadeIn>
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-10 shadow-sm border border-gray-100 dark:border-slate-700 mb-8 max-w-3xl mx-auto">
              
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 border border-amber-200 dark:border-amber-800">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white">
                  الحصة التجريبية المجانية
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  حصة مجانية بالكامل للتعرف على طريقة شرح المعلم والتفاعل معه قبل الاشتراك في باقة الـ 8 حصص!
                </p>
              </div>

              {myTrialRequest?.status === 'enrolled' && (
                <div className="mb-6 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="text-xs font-bold">🎉 تمت الموافقة على استمرارك بعد الحصة التجريبية! يُرجى الاشتراك وسداد باقة الـ 8 حصص لتأكيد مكانك.</span>
                  </div>
                  <button
                    onClick={() => setIsRenewModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 cursor-pointer shadow-sm"
                  >
                    الاشتراك الآن في الباقة
                  </button>
                </div>
              )}
              {myTrialRequest?.status === 'rejected' && (
                <div className="mb-6 p-4 rounded-2xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-750 text-gray-700 dark:text-gray-300 flex items-center gap-2.5">
                  <Info className="w-5 h-5 text-gray-400 shrink-0" />
                  <span className="text-xs font-bold">شكراً لحضورك الحصة التجريبية. تم تسجيل قرار المعلم، ونتمنى لك دوام التوفيق والنجاح دائماً في رحلتك التعليمية.</span>
                </div>
              )}

              {(() => {
                const filteredTrialSessions = trialSessions.filter(tSession => {
                  if (tSession.target_type === 'specific_students') {
                    return tSession.target_student_ids?.includes(user?.id);
                  }
                  return !tSession.grade_level || tSession.grade_level === 'all' || tSession.grade_level === 'custom' || tSession.grade_level === profile?.grade_level;
                });

                if (filteredTrialSessions.length === 0) {
                  return (
                    <div className="p-8 bg-gray-50 dark:bg-slate-900/40 rounded-2xl text-center text-gray-500 font-bold text-sm">
                      لا توجد حصص تجريبية موجهة لصفك حالياً. سيتم إعلان المواعيد الجديدة قريباً!
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    {filteredTrialSessions.map(tSession => {
                      const isTargetedToMe = tSession.target_type === 'specific_students';

                      return (
                        <div key={tSession.id} className={`p-6 rounded-2xl border-2 transition-all ${
                          isTargetedToMe
                            ? 'border-purple-500/50 bg-purple-50/30 dark:bg-purple-950/20 shadow-lg'
                            : 'border-amber-200 dark:border-slate-700 bg-amber-50/40 dark:bg-slate-900/60'
                        }`}>
                          <div className="flex justify-between items-start mb-3 flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              {isTargetedToMe ? (
                                <span className="px-3 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
                                  🌟 دعوة خاصة موجهة لك
                                </span>
                              ) : (
                                <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                                  {formatGradeName(tSession.grade_level)}
                                </span>
                              )}
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                                مجانية 100%
                              </span>
                            </div>
                            <span className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-100/50 px-2 py-0.5 rounded-md">
                              {tSession.duration_minutes ? `${tSession.duration_minutes} دقيقة` : '30 دقيقة'}
                            </span>
                          </div>

                          <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                            {tSession.title}
                          </h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                            {tSession.description}
                          </p>

                          <div className="flex items-center gap-4 text-xs font-bold text-gray-600 dark:text-gray-300 mb-6 bg-white dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-4 h-4 text-amber-500" />
                              <span>{new Date(tSession.start_time).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-4 h-4 text-amber-500" />
                              <span>{new Date(tSession.start_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })} ({tSession.duration_minutes ? `مدة ${tSession.duration_minutes} دقيقة` : 'مدة 30 دقيقة'})</span>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-3">
                            <a
                              href={getCleanZoomUrl(tSession.zoom_link)}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 py-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-md"
                            >
                              <Video className="w-4 h-4" />
                              دخول زووم الحصة التجريبية مباشرة
                            </a>

                            {!hasRequestedTrial && (
                              <button
                                onClick={() => handleBookTrial(tSession)}
                                disabled={trialRequestLoading}
                                className="px-6 py-3.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-gray-200 rounded-xl font-bold text-sm transition-colors cursor-pointer"
                              >
                                تأكيد الحجز مع المعلم
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

            </div>
          </FadeIn>
        )}

      </div>

      {/* ===================== RENEWAL PAYMENT MODAL ===================== */}
      {isRenewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-gray-100 dark:border-slate-700 my-8">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100 dark:border-slate-700">
              <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                <CreditCard className="w-6 h-6 text-emerald-500" />
                {myPackage?.status === 'not_subscribed' 
                  ? 'الاشتراك في باقة الحصص (8 حصص مقدماً)' 
                  : myPackage?.status === 'pending'
                  ? 'تحديث بيانات تحويل باقة الـ 8 حصص'
                  : 'تجديد باقة الحصص (8 حصص مقدماً)'}
              </h3>
              <button onClick={() => setIsRenewModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRenewSubmit} className="space-y-4">
              <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200 font-bold space-y-1">
                <p>📌 أرقام التحويل المعتمدة للمنصة:</p>
                <p>• فودافون كاش: <span className="font-mono text-sm">01012345678</span></p>
                <p>• انستاباي (InstaPay): <span className="font-mono text-sm">manarat@instapay</span></p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">طريقة الدفع</label>
                <select
                  value={renewForm.payment_method}
                  onChange={(e) => setRenewForm({ ...renewForm, payment_method: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-sm font-bold text-gray-900 dark:text-white"
                >
                  <option value="vodafone_cash">فودافون كاش (Vodafone Cash)</option>
                  <option value="instapay">انستاباي (InstaPay)</option>
                  <option value="wallet">محفظة إلكترونية أخرى</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">رقم الهاتف / الحساب المحول منه *</label>
                <input
                  type="text"
                  required
                  value={renewForm.wallet_number}
                  onChange={(e) => setRenewForm({ ...renewForm, wallet_number: e.target.value })}
                  placeholder="01xxxxxxxxx"
                  dir="ltr"
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-sm font-bold text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  صورة إيصال التحويل (اختياري - لتأكيد وتفعيل الباقة فوراً)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const f = e.target.files[0];
                    if (f) {
                      setCompressingReceipt(true);
                      try {
                        const compressed = await compressImage(f);
                        setRenewForm(prev => ({
                          ...prev,
                          receipt_file: compressed,
                          receipt_preview: URL.createObjectURL(compressed)
                        }));
                      } catch (_) {
                        setRenewForm(prev => ({
                          ...prev,
                          receipt_file: f,
                          receipt_preview: URL.createObjectURL(f)
                        }));
                      } finally {
                        setCompressingReceipt(false);
                      }
                    }
                  }}
                  className="w-full text-xs text-gray-500 file:mr-2 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 cursor-pointer"
                />

                {compressingReceipt && (
                  <p className="text-[11px] text-blue-600 dark:text-blue-400 font-bold mt-1.5 flex items-center gap-1.5 animate-pulse">
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                    <span>جاري معالجة وضغط صورة الإيصال...</span>
                  </p>
                )}

                {renewForm.receipt_preview && !compressingReceipt && (
                  <div className="mt-2.5 relative inline-block">
                    <img src={renewForm.receipt_preview} alt="معاينة الإيصال" className="h-24 w-auto rounded-xl border border-gray-200 dark:border-slate-700 object-cover shadow-sm" />
                    <button
                      type="button"
                      onClick={() => setRenewForm(prev => ({ ...prev, receipt_file: null, receipt_preview: null }))}
                      className="absolute -top-2 -left-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 shadow-md transition-colors cursor-pointer"
                      title="إلغاء الصورة المحددة"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block mt-1">✓ جاهز للإرسال مع الطلب</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsRenewModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-slate-100 text-xs border border-gray-300 dark:border-slate-600 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={renewLoading || compressingReceipt}
                  className="px-6 py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white text-xs shadow-md disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {renewLoading ? (
                    <>
                      <Loader className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري الإرسال ورفع الإيصال...</span>
                    </>
                  ) : compressingReceipt ? (
                    <span>جاري معالجة الصورة...</span>
                  ) : myPackage?.status === 'not_subscribed' ? (
                    'تأكيد وإرسال طلب الاشتراك'
                  ) : (
                    'تأكيد وإرسال طلب التجديد'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
