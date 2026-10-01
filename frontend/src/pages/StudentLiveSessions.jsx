import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Video, Calendar, Clock, BookOpen, Link as LinkIcon,
  CheckCircle, Loader, PlayCircle, XCircle, Clock4, Filter,
  CreditCard, Sparkles, Lock, RefreshCw, AlertTriangle, ArrowRight,
  Bell, UploadCloud, X, CheckCircle2, ShieldCheck
} from 'lucide-react';
import FadeIn from '../components/FadeIn';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import BackButton from '../components/BackButton';
import toast from 'react-hot-toast';
import { formatSessionTitle, formatSessionDesc, formatGradeName } from '../utils/helpers';

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

  // Trial Sessions State
  const [trialSessions, setTrialSessions] = useState([]);
  const [hasRequestedTrial, setHasRequestedTrial] = useState(false);
  const [trialRequestLoading, setTrialRequestLoading] = useState(false);

  // Filters for individual sessions
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Smart 5-minute Alert State
  const [imminentSession, setImminentSession] = useState(null);

  useEffect(() => {
    fetchSessions();
    fetchWeeklySchedules();
    fetchMyPackage();
    fetchTrialSessions();
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

  const fetchSessions = async () => {
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
      setLoading(false);
    }
  };

  const fetchWeeklySchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('weekly_schedules')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setWeeklySchedules(data);
      } else {
        const local = localStorage.getItem('manarat_weekly_schedules');
        if (local) setWeeklySchedules(JSON.parse(local));
      }
    } catch (err) {
      const local = localStorage.getItem('manarat_weekly_schedules');
      if (local) setWeeklySchedules(JSON.parse(local));
    }
  };

  const fetchMyPackage = async () => {
    if (!user) return;
    setPackageLoading(true);
    try {
      const { data, error } = await supabase
        .from('live_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        setMyPackage(data[0]);
      } else {
        // Fallback default: 8 sessions
        setMyPackage({
          remaining_sessions: 8,
          total_sessions: 8,
          status: 'active'
        });
      }
    } catch (err) {
      console.warn('Live subscription fetch fallback:', err);
      setMyPackage({ remaining_sessions: 8, total_sessions: 8, status: 'active' });
    } finally {
      setPackageLoading(false);
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
          .select('id')
          .eq('user_id', user.id)
          .limit(1);
        if (reqData && reqData.length > 0) setHasRequestedTrial(true);
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
      let receiptUrl = '';
      if (renewForm.receipt_file) {
        const fileExt = renewForm.receipt_file.name.split('.').pop();
        const fileName = `${user.id}_${Date.now()}.${fileExt}`;
        const { error: upErr } = await supabase.storage
          .from('receipts')
          .upload(`live_renewals/${fileName}`, renewForm.receipt_file);

        if (!upErr) {
          const { data: pubData } = supabase.storage
            .from('receipts')
            .getPublicUrl(`live_renewals/${fileName}`);
          receiptUrl = pubData.publicUrl;
        }
      }

      await supabase.from('live_subscriptions').insert([{
        user_id: user.id,
        grade_level: profile?.grade_level || 'prep_1',
        total_sessions: 8,
        remaining_sessions: 8,
        status: 'pending',
        payment_method: renewForm.payment_method,
        wallet_number: renewForm.wallet_number.trim(),
        receipt_url: receiptUrl,
        notes: 'طلب تجديد باقة 8 حصص'
      }]);

      toast.success('✅ تم إرسال طلب تجديد باقة الـ 8 حصص بنجاح! سيتم تفعيل حسابك فور مراجعة التحويل.');
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

  // Filter weekly schedules for student's grade
  const myWeeklySchedules = weeklySchedules.filter(ws => {
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
                  className="px-6 py-3 rounded-2xl bg-amber-400 text-gray-900 font-black text-sm hover:bg-amber-300 transition-all shadow-lg shrink-0 flex items-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  تجديد الباقة للدخول
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                <span className={`px-2 py-0.5 rounded-full text-xs font-black ${hasLiveAccess ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                  {myPackage.remaining_sessions} / 8
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
                      {myPackage ? `${myPackage.remaining_sessions} من 8 حصص` : '8 من 8 حصص'}
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
                    {myWeeklySchedules.map(sch => (
                      <div key={sch.id} className="p-5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex flex-col justify-between">
                        <div>
                          <h4 className="text-lg font-bold text-white mb-2">{sch.title}</h4>
                          <div className="space-y-1.5 text-sm text-blue-100 mb-4">
                            <p className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-blue-300" />
                              <span className="font-bold">الأيام:</span>
                              <span className="font-black text-white">{Array.isArray(sch.days) ? sch.days.join(' و ') : sch.days}</span>
                            </p>
                            <p className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-orange-300" />
                              <span className="font-bold">الموعد:</span>
                              <span dir="ltr">من {sch.start_time} إلى {sch.end_time}</span>
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
                            className="w-full py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-md hover:scale-[1.02]"
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
                            انتهت الباقة - تجديد الاشتراك للدخول
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Section B: Individual Scheduled Sessions */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-slate-700">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Video className="w-6 h-6 text-blue-500" />
                الحصص الفردية والمراجعات المجدولة
              </h3>

              {filteredSessions.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-slate-900/40 rounded-2xl">
                  <Calendar className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-gray-500 font-bold">لا توجد حصص استثنائية مجدولة حالياً.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {filteredSessions.map(session => {
                    const compStatus = getSessionComputedStatus(session);
                    const isLive = compStatus === 'live';

                    return (
                      <div 
                        key={session.id}
                        className={`p-6 rounded-2xl border-2 transition-all flex flex-col justify-between ${
                          isLive 
                            ? 'border-red-500 bg-red-50/40 dark:bg-red-950/20 shadow-md' 
                            : 'border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800/80'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                              {session.grade_level ? formatGradeName(session.grade_level) : 'عام للجميع'}
                            </span>
                            {isLive && (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-red-600 text-white animate-pulse">
                                🔴 مباشر الآن
                              </span>
                            )}
                          </div>

                          <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                            {session.title}
                          </h4>

                          {session.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
                              {session.description}
                            </p>
                          )}

                          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 mb-4 bg-gray-50 dark:bg-slate-900/50 p-3 rounded-xl">
                            <p className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-blue-500" />
                              <span>{new Date(session.start_time).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            </p>
                            <p className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-blue-500" />
                              <span>{new Date(session.start_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })} - {new Date(session.end_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                            </p>
                          </div>
                        </div>

                        {hasLiveAccess ? (
                          <a
                            href={getCleanZoomUrl(session.zoom_link)}
                            target="_blank"
                            rel="noreferrer"
                            className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                              isLive 
                                ? 'bg-red-600 hover:bg-red-700 text-white shadow-md' 
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                          >
                            <PlayCircle className="w-4 h-4" />
                            {isLive ? 'انضم للبث المباشر الآن' : 'رابط زووم الحصة'}
                          </a>
                        ) : (
                          <button
                            onClick={() => setIsRenewModalOpen(true)}
                            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            انتهت الباقة - تجديد للاشتراك
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
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
                <div className={`p-6 rounded-3xl border-2 mb-8 ${hasLiveAccess ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20' : 'border-amber-400 bg-amber-50/40 dark:bg-amber-950/20'}`}>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-black text-gray-500 uppercase">حالة الباقة</span>
                    {hasLiveAccess ? (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500 text-white flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> باقة نشطة
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500 text-white flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> بحاجة للتجديد (0 حصص)
                      </span>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-6">
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="text-2xl font-black text-gray-900 dark:text-white">
                        {myPackage.remaining_sessions} <span className="text-sm font-normal text-gray-500">من 8 حصص متبقية</span>
                      </span>
                      <span className="text-xs font-black text-gray-400">
                        {Math.round((myPackage.remaining_sessions / 8) * 100)}%
                      </span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-700 ${hasLiveAccess ? 'bg-emerald-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.round((myPackage.remaining_sessions / 8) * 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {!hasLiveAccess && (
                    <div className="p-4 rounded-2xl bg-amber-100/70 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 text-sm font-bold mb-4 flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                      <p>
                        لقد استنفدت كامل الـ 8 حصص المدفوعة مقدماً. برجاء تجديد الاشتراك للمتابعة في الحصص القادمة.
                      </p>
                    </div>
                  )}

                  <button
                    onClick={() => setIsRenewModalOpen(true)}
                    className="w-full py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
                  >
                    <RefreshCw className="w-5 h-5" />
                    {hasLiveAccess ? 'شحن وتجديد باقة 8 حصص مقدماً' : 'تجديد الاشتراك الآن (+8 حصص)'}
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
                  الحصة التجريبية المجانية (30 دقيقة)
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  حصة مجانية بالكامل للتعرف على طريقة شرح المعلم والتفاعل معه قبل الاشتراك في باقة الـ 8 حصص!
                </p>
              </div>

              {trialSessions.length === 0 ? (
                <div className="p-8 bg-gray-50 dark:bg-slate-900/40 rounded-2xl text-center text-gray-500 font-bold text-sm">
                  سيتم الإعلان عن موعد الحصة التجريبية القادمة قريباً بواسطة المعلم.
                </div>
              ) : (
                <div className="space-y-4">
                  {trialSessions.map(tSession => (
                    <div key={tSession.id} className="p-6 rounded-2xl border-2 border-amber-200 dark:border-slate-700 bg-amber-50/40 dark:bg-slate-900/60">
                      <div className="flex justify-between items-start mb-3">
                        <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                          {formatGradeName(tSession.grade_level)}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                          مجانية 100%
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
                          <span>{new Date(tSession.start_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })} (مدة 30 دقيقة)</span>
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
                  ))}
                </div>
              )}

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
                تجديد باقة الحصص (8 حصص مقدماً)
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
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">صورة إيصال التحويل (اختياري)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files[0];
                    if (f) {
                      setRenewForm({
                        ...renewForm,
                        receipt_file: f,
                        receipt_preview: URL.createObjectURL(f)
                      });
                    }
                  }}
                  className="w-full text-xs text-gray-500 file:mr-2 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700"
                />
                {renewForm.receipt_preview && (
                  <img src={renewForm.receipt_preview} alt="معاينة الإيصال" className="mt-2 h-24 w-auto rounded-lg border object-cover" />
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsRenewModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold bg-gray-100 dark:bg-slate-700 text-gray-700 text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={renewLoading}
                  className="px-6 py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white text-xs shadow-md disabled:opacity-50"
                >
                  {renewLoading ? 'جاري الإرسال...' : 'تأكيد وإرسال طلب التجديد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
