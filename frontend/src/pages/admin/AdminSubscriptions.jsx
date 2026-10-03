import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  CheckCircle, Search, Eye, Filter, Loader, AlertTriangle, 
  ShieldCheck, FileText, X, ArrowRight, ZoomIn, ZoomOut, RotateCcw, Trash2,
  Clock, PlusCircle, RefreshCw, Video, BookOpen, MinusCircle, CheckCircle2,
  Sparkles, User, Award, ExternalLink, Calendar, MessageSquare, Phone,
  CreditCard, ChevronRight, Layers, ChevronDown
} from 'lucide-react';
import { Link } from 'react-router-dom';
import FadeIn from '../../components/FadeIn';
import ConfirmModal from '../../components/ConfirmModal';
import { supabase } from '../../lib/supabase';
import { getDirectImageUrl, calculateSubscriptionStatus, formatGradeName } from '../../utils/helpers';
import toast from 'react-hot-toast';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AdminSubscriptions() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // 'pending' | 'active' | 'expired' | 'rejected' | 'all'
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'live' | 'courses'
  const [gradeFilter, setGradeFilter] = useState('all'); // 'all' | grade level key
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  // Extend Course Subscription Modal
  const [extendModalConfig, setExtendModalConfig] = useState({ isOpen: false, requestId: null, studentName: '', currentDays: 30 });
  const [customDays, setCustomDays] = useState(30);

  // Deduct Live Package Session Modal
  const [deductModal, setDeductModal] = useState({
    isOpen: false,
    item: null,
    sessionTitle: '',
    teacherNotes: '',
    submitting: false
  });

  // Delete Subscription Modal
  const [deleteConfig, setDeleteConfig] = useState({ isOpen: false, requestId: null, itemType: 'course', studentName: '' });

  useEffect(() => {
    fetchRequests();

    // Supabase Realtime synchronization across courses, live packages, and completed sessions
    const channel = supabase
      .channel('admin_subscriptions_master_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => {
        fetchRequests();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_subscriptions' }, () => {
        fetchRequests();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completed_live_sessions' }, () => {
        fetchRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRequests = async () => {
    try {
      // 1. Background sync for expired course subscriptions on server
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          fetch(`${apiUrl}/api/admin/subscriptions/sync-expired`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}` }
          }).catch(() => {});
        }
      } catch (e) {}

      // 2. Fetch both course subscriptions AND live subscriptions in parallel
      const [coursesRes, liveRes] = await Promise.all([
        supabase
          .from('subscriptions')
          .select(`
            *,
            courses (
              id,
              title,
              access_duration_days
            )
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('live_subscriptions')
          .select('*')
          .order('created_at', { ascending: false })
      ]);

      const courseRows = coursesRes.data || [];
      const liveRows = liveRes.data || [];

      // 3. Fetch user profiles safely using correct column phone_number
      let profilesMap = {};
      try {
        const { data: profilesData, error: profErr } = await supabase
          .from('profiles')
          .select('id, full_name, email, grade_level, phone_number');

        if (!profErr && profilesData) {
          profilesData.forEach(p => {
            profilesMap[p.id] = p;
          });
        }
      } catch (e) {
        console.warn('Profiles fetch warning:', e);
      }

      // 4. Format course subscriptions
      const formattedCourses = courseRows.map(req => {
        const duration = req.courses?.access_duration_days;
        const statusObj = calculateSubscriptionStatus(req, duration);
        
        let computedStatus = req.status;
        if (req.status === 'active' && statusObj.isExpired) {
          computedStatus = 'expired';
        }

        const prof = profilesMap[req.user_id];
        const studentName = prof?.full_name || prof?.email?.split('@')[0] || 'طالب المنصة';
        const studentGrade = prof?.grade_level || '';
        const gradeName = formatGradeName(studentGrade);

        return {
          id: req.id,
          user_id: req.user_id,
          itemType: 'course',
          studentName,
          studentGrade,
          gradeName,
          studentPhone: prof?.phone_number || '',
          courseTitle: req.courses?.title || 'كورس مسجل',
          courseDuration: duration,
          paymentMethod: req.payment_method,
          walletNumber: req.wallet_number || '-',
          receiptUrl: req.receipt_url,
          status: computedStatus,
          rawStatus: req.status,
          date: req.created_at,
          statusObj
        };
      });

      // 5. Format live package subscriptions (8-session live packages)
      const formattedLive = liveRows.map(ls => {
        const prof = profilesMap[ls.user_id];
        const grade = prof?.grade_level || ls.grade_level || 'prep_1';
        const remaining = ls.remaining_sessions !== undefined && ls.remaining_sessions !== null ? ls.remaining_sessions : 8;
        const total = ls.total_sessions || 8;

        let computedStatus = ls.status || 'pending';
        if (computedStatus === 'active' && remaining <= 0) {
          computedStatus = 'expired';
        }

        const studentName = prof?.full_name || prof?.email?.split('@')[0] || 'طالب المنصة';
        const gradeName = formatGradeName(grade);

        // Robust receipt URL extraction with publicUrl fallback
        let rUrl = ls.receipt_url || ls.payment_receipt || ls.payment_screenshot || ls.receipt_image || ls.proof_url || null;
        if (rUrl && typeof rUrl === 'string' && !rUrl.startsWith('http') && !rUrl.startsWith('data:')) {
          const { data: pubData } = supabase.storage.from('receipts').getPublicUrl(rUrl);
          rUrl = pubData?.publicUrl || rUrl;
        }

        return {
          id: ls.id,
          user_id: ls.user_id,
          itemType: 'live_package',
          studentName,
          studentGrade: grade,
          gradeName,
          studentPhone: prof?.phone_number || '',
          courseTitle: 'باقة الـ 8 حصص أونلاين (زووم)',
          courseDuration: `${remaining} / ${total} حصص`,
          remainingSessions: remaining,
          totalSessions: total,
          paymentMethod: ls.payment_method,
          walletNumber: ls.wallet_number || '-',
          receiptUrl: rUrl,
          status: computedStatus,
          rawStatus: ls.status,
          date: ls.created_at,
          activatedAt: ls.activated_at,
          notes: ls.notes
        };
      });

      // 6. Combine and sort by date descending
      const combined = [...formattedLive, ...formattedCourses].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      );

      setRequests(combined);

      // Smart initial filter: if no pending requests, switch to 'all' so admin isn't greeted with an empty table!
      const pCount = combined.filter(r => r.status === 'pending').length;
      setFilter(prev => {
        if (prev === 'pending' && pCount === 0) return 'all';
        return prev;
      });
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  // ==================== Actions Handlers ====================

  const handleDeleteRequest = (req) => {
    setDeleteConfig({
      isOpen: true,
      requestId: req.id,
      itemType: req.itemType,
      studentName: req.studentName
    });
  };

  const confirmDelete = async () => {
    const { requestId: id, itemType } = deleteConfig;
    setDeleteConfig({ isOpen: false, requestId: null, itemType: 'course', studentName: '' });

    const previousRequests = [...requests];
    setRequests(requests.filter(req => req.id !== id));

    try {
      if (itemType === 'live_package') {
        const { error: dbError } = await supabase
          .from('live_subscriptions')
          .delete()
          .eq('id', id);
        if (dbError) throw dbError;
      } else {
        const { error: dbError } = await supabase
          .from('subscriptions')
          .delete()
          .eq('id', id);

        if (dbError) {
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch(`${apiUrl}/api/admin/subscriptions/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${session?.access_token}` }
          });
          if (!res.ok) throw new Error('Failed to delete');
        }
      }

      toast.success(t('admin_subs_msg_deleted') || 'تم حذف السجل بنجاح');
    } catch (err) {
      console.error('Error deleting subscription:', err);
      toast.error(t('admin_subs_msg_error') || 'حدث خطأ أثناء الحذف');
      setRequests(previousRequests);
    }
  };

  // Status change handler (works for both Courses and Live Packages)
  const handleStatusChange = async (req, newStatus) => {
    const id = req.id;
    const isLive = req.itemType === 'live_package';

    // Optimistic UI Update
    const previousRequests = [...requests];
    setRequests(requests.map(r => 
      r.id === id ? { 
        ...r, 
        status: newStatus, 
        rawStatus: newStatus,
        ...(isLive && newStatus === 'active' ? { remainingSessions: 8, totalSessions: 8 } : {})
      } : r
    ));

    try {
      if (isLive) {
        if (newStatus === 'active') {
          const { error } = await supabase
            .from('live_subscriptions')
            .update({
              status: 'active',
              remaining_sessions: 8,
              total_sessions: 8,
              activated_at: new Date().toISOString()
            })
            .eq('id', id);

          if (error) throw error;
          toast.success(`🎉 تم قبول التفعيل وبدء باقة الـ 8 حصص للطالب ${req.studentName} بنجاح!`);
        } else if (newStatus === 'expired') {
          const { error } = await supabase
            .from('live_subscriptions')
            .update({
              status: 'expired',
              remaining_sessions: 0
            })
            .eq('id', id);
          if (error) throw error;
          toast.success('تم تعيين الباقة كمنتهية');
        } else {
          const { error } = await supabase
            .from('live_subscriptions')
            .update({ status: newStatus })
            .eq('id', id);
          if (error) throw error;
          toast.success(t('admin_subs_msg_updated') || 'تم تحديث حالة الطلب');
        }
      } else {
        let updatePayload = { status: newStatus };
        if (newStatus === 'active') {
          updatePayload.created_at = new Date().toISOString();
          if (req.courseDuration) {
            const expiresAt = new Date(Date.now() + req.courseDuration * 24 * 60 * 60 * 1000).toISOString();
            updatePayload.expires_at = expiresAt;
          }
        }

        let { error: dbError } = await supabase
          .from('subscriptions')
          .update(updatePayload)
          .eq('id', id);

        if (dbError && updatePayload.expires_at) {
          const { expires_at, ...cleanPayload } = updatePayload;
          const retry = await supabase
            .from('subscriptions')
            .update(cleanPayload)
            .eq('id', id);
          dbError = retry.error;
        }

        if (dbError) {
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch(`${apiUrl}/api/admin/subscriptions/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`
            },
            body: JSON.stringify({ status: newStatus })
          });
          if (!res.ok) throw new Error('Failed to update status');
        }

        toast.success(t('admin_subs_msg_updated') || 'تم تحديث حالة الاشتراك بنجاح');
      }

      fetchRequests();
    } catch (err) {
      console.error('Error updating status:', err);
      toast.error(t('admin_subs_msg_error') || 'حدث خطأ أثناء التحديث');
      setRequests(previousRequests);
    }
  };

  // Direct instant attendance deduction (-1 session) without blocking modal
  const handleDirectDeduct = async (item) => {
    if (!item) return;

    const newRemaining = Math.max(0, item.remainingSessions - 1);
    const newStatus = newRemaining === 0 ? 'expired' : 'active';
    const sTitle = `حصة أونلاين - ${item.gradeName || ''}`;
    const tNotes = 'تم حضور الحصة واكتمالها بنجاح';

    // Optimistic UI update
    setRequests(prev => prev.map(r => r.id === item.id ? {
      ...r,
      remainingSessions: newRemaining,
      status: newStatus,
      rawStatus: newStatus,
      courseDuration: `${newRemaining} / ${item.totalSessions || 8} حصص`
    } : r));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      let successApi = false;
      if (token) {
        try {
          const res = await fetch(`${apiUrl}/api/admin/live-subscriptions/attendance`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              user_id: item.user_id,
              grade_level: item.studentGrade,
              remaining_sessions: newRemaining,
              session_title: sTitle,
              teacher_notes: tNotes
            })
          });
          if (res.ok) successApi = true;
        } catch (_) {}
      }

      if (!successApi) {
        await supabase
          .from('live_subscriptions')
          .update({
            remaining_sessions: newRemaining,
            status: newStatus
          })
          .eq('id', item.id);

        try {
          await supabase.from('completed_live_sessions').insert([{
            student_id: item.user_id,
            student_name: item.studentName,
            grade_level: item.studentGrade,
            session_title: sTitle,
            session_type: 'package',
            completed_at: new Date().toISOString(),
            teacher_notes: tNotes
          }]);
        } catch (tableErr) {
          console.warn('completed_live_sessions insert notice:', tableErr);
        }
      }

      toast.success(`✅ تم خصم حصة وتسجيل الحضور للطالب ${item.studentName}! (المتبقي: ${newRemaining} حصص)`);
      fetchRequests();
    } catch (err) {
      console.error('Error deducting session:', err);
      toast.error('حدث خطأ أثناء خصم الحصة');
      fetchRequests();
    }
  };

  // Add compensation (+1 session)
  const handleAddCompensationSession = async (req) => {
    const newRemaining = req.remainingSessions + 1;
    const newStatus = 'active';

    setRequests(prev => prev.map(r => r.id === req.id ? {
      ...r,
      remainingSessions: newRemaining,
      status: newStatus,
      rawStatus: newStatus,
      courseDuration: `${newRemaining} / ${req.totalSessions || 8} حصص`
    } : r));

    try {
      await supabase
        .from('live_subscriptions')
        .update({
          remaining_sessions: newRemaining,
          status: newStatus
        })
        .eq('id', req.id);

      toast.success(`➕ تم إضافة حصة تعويضية للطالب ${req.studentName} بنجاح! (الرصيد: ${newRemaining} حصص)`);
      fetchRequests();
    } catch (err) {
      console.error('Compensation session error:', err);
      toast.error('حدث خطأ أثناء إضافة الحصة');
      fetchRequests();
    }
  };

  // Renew 8-session live package (+8 sessions)
  const handleRenewLivePackage = async (req) => {
    setRequests(prev => prev.map(r => r.id === req.id ? {
      ...r,
      remainingSessions: 8,
      totalSessions: 8,
      status: 'active',
      rawStatus: 'active',
      courseDuration: '8 / 8 حصص'
    } : r));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      let apiDone = false;
      if (token) {
        try {
          const res = await fetch(`${apiUrl}/api/admin/live-subscriptions/renew`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              user_id: req.user_id,
              grade_level: req.studentGrade
            })
          });
          if (res.ok) apiDone = true;
        } catch (_) {}
      }

      if (!apiDone) {
        await supabase
          .from('live_subscriptions')
          .update({
            remaining_sessions: 8,
            total_sessions: 8,
            status: 'active',
            activated_at: new Date().toISOString()
          })
          .eq('id', req.id);
      }

      toast.success(`🎉 تم تجديد باقة الـ 8 حصص للطالب ${req.studentName} بنجاح!`);
      fetchRequests();
    } catch (err) {
      console.error('Renew error:', err);
      toast.error('حدث خطأ أثناء تجديد الباقة');
      fetchRequests();
    }
  };

  // Course extension handlers
  const openExtendModal = (req) => {
    const defaultDays = req.courseDuration || 30;
    setCustomDays(defaultDays);
    setExtendModalConfig({
      isOpen: true,
      requestId: req.id,
      studentName: req.studentName,
      currentDays: defaultDays
    });
  };

  const confirmExtend = async () => {
    const id = extendModalConfig.requestId;
    const daysToAdd = Number(customDays) || 30;
    setExtendModalConfig({ isOpen: false, requestId: null, studentName: '', currentDays: 30 });

    try {
      const newExpiresAt = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();
      const updateData = {
        status: 'active',
        created_at: new Date().toISOString(),
        expires_at: newExpiresAt
      };

      let { error: dbError } = await supabase
        .from('subscriptions')
        .update(updateData)
        .eq('id', id);

      if (dbError) {
        const retry = await supabase
          .from('subscriptions')
          .update({ status: 'active', created_at: new Date().toISOString() })
          .eq('id', id);
        dbError = retry.error;
      }

      if (dbError) {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${apiUrl}/api/admin/subscriptions/${id}/extend`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({ days: daysToAdd })
        });
        if (!res.ok) throw new Error('Failed to extend');
      }

      toast.success(t('admin_subs_msg_extended') || 'تم تمديد الكورس بنجاح');
      fetchRequests();
    } catch (err) {
      console.error('Error extending subscription:', err);
      toast.error(t('admin_subs_msg_error') || 'حدث خطأ أثناء التمديد');
    }
  };

  // ==================== Filtering Logic ====================

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      // 1. Subscription Type filter
      if (typeFilter === 'live' && req.itemType !== 'live_package') return false;
      if (typeFilter === 'courses' && req.itemType !== 'course') return false;

      // 2. Status filter
      if (filter !== 'all' && req.status !== filter) return false;

      // 3. Grade Level filter
      if (gradeFilter !== 'all' && req.studentGrade !== gradeFilter) return false;

      // 4. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = req.studentName?.toLowerCase().includes(q);
        const matchCourse = req.courseTitle?.toLowerCase().includes(q);
        const matchWallet = req.walletNumber?.toLowerCase().includes(q);
        const matchGrade = req.gradeName?.toLowerCase().includes(q);
        const matchPhone = req.studentPhone?.toLowerCase().includes(q);
        if (!matchName && !matchCourse && !matchWallet && !matchGrade && !matchPhone) return false;
      }

      return true;
    });
  }, [requests, typeFilter, filter, gradeFilter, searchQuery]);

  // Overall Global Counts
  const totalPendingGlobal = requests.filter(r => r.status === 'pending').length;
  const totalLiveGlobal = requests.filter(r => r.itemType === 'live_package').length;
  const totalCoursesGlobal = requests.filter(r => r.itemType === 'course').length;
  const totalActiveGlobal = requests.filter(r => r.status === 'active').length;

  // Counts scoped to current service type filter
  const typeScopedRequests = useMemo(() => {
    return requests.filter(req => {
      if (typeFilter === 'live') return req.itemType === 'live_package';
      if (typeFilter === 'courses') return req.itemType === 'course';
      return true;
    });
  }, [requests, typeFilter]);

  const pendingCount = typeScopedRequests.filter(req => req.status === 'pending').length;
  const activeCount = typeScopedRequests.filter(req => req.status === 'active').length;
  const expiredCount = typeScopedRequests.filter(req => req.status === 'expired').length;
  const rejectedCount = typeScopedRequests.filter(req => req.status === 'rejected').length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin shadow-lg"></div>
          <p className="text-gray-500 dark:text-gray-400 font-bold text-sm">جاري تحميل منصة إدارة الاشتراكات والحصص...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 selection:bg-blue-600 selection:text-white font-arabic">
      
      {/* ===================== HERO HEADER ===================== */}
      <div className="relative pt-10 pb-24 px-4 sm:px-6 lg:px-8 overflow-hidden bg-gradient-to-b from-blue-950 via-slate-900 to-slate-950 border-b border-slate-800/80 shadow-2xl">
        <div className="absolute -top-24 right-1/4 w-96 h-96 bg-blue-600/20 blur-[130px] rounded-full pointer-events-none"></div>
        <div className="absolute top-1/2 left-10 w-80 h-80 bg-purple-600/20 blur-[120px] rounded-full pointer-events-none"></div>

        <div className="max-w-7xl mx-auto relative z-10">
          
          {/* Top Quick Navigation Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <Link 
              to="/admin-dashboard" 
              className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-white rounded-full transition-all text-xs font-bold border border-slate-700/80 shadow-sm backdrop-blur-md"
            >
              <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180 text-blue-400" />
              <span>لوحة التحكم الرئيسية</span>
            </Link>

            <div className="flex items-center gap-3">
              <Link 
                to="/admin-dashboard/live-sessions" 
                className="flex items-center gap-2 px-4 py-2 bg-purple-900/30 hover:bg-purple-800/40 text-purple-200 rounded-full transition-all text-xs font-bold border border-purple-500/30 shadow-sm backdrop-blur-md"
              >
                <Video className="w-4 h-4 text-purple-400" />
                <span>جدول مواعيد الحصص المباشرة</span>
              </Link>
              <button
                onClick={fetchRequests}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900/80 hover:bg-slate-800 text-slate-300 rounded-full transition-all text-xs font-bold border border-slate-700/80 shadow-sm cursor-pointer"
                title="تحديث البيانات"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>تحديث</span>
              </button>
            </div>
          </div>

          {/* Hero Titles */}
          <FadeIn>
            <div className="flex flex-col items-center text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-emerald-500/10 border border-blue-500/20 text-blue-300 text-xs font-extrabold mb-4 shadow-inner">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
                <span>مركز العمليات والاعتماد الأكاديمي</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight mb-3">
                إدارة الاشتراكات وباقات الـ 8 حصص
              </h1>
              <p className="text-slate-400 text-sm sm:text-base font-medium leading-relaxed">
                مراجعة واعتماد طلبات التحويل، بدء وتجديد باقات الحصص المباشرة، وتتبع رصيد حضور الطالب بالخصم اللحظي المباشر.
              </p>
            </div>
          </FadeIn>

        </div>
      </div>

      {/* ===================== MAIN CONTENT WRAPPER ===================== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-20">

        {/* 1. TOP INTERACTIVE KPI METRIC CARDS */}
        <FadeIn delay={50}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            
            {/* Metric 1: Pending */}
            <div 
              onClick={() => { setFilter(prev => prev === 'pending' ? 'all' : 'pending'); }}
              className={`p-5 rounded-3xl cursor-pointer transition-all duration-300 border relative overflow-hidden group shadow-lg ${
                filter === 'pending'
                  ? 'bg-amber-950/40 border-amber-500/80 shadow-amber-500/10 ring-2 ring-amber-500/30'
                  : 'bg-slate-900/90 hover:bg-slate-900 border-slate-800 hover:border-amber-500/40'
              }`}
              title="تصفية حسب الطلبات قيد المراجعة"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                  <Clock className="w-5 h-5" />
                </div>
                {totalPendingGlobal > 0 ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500 text-white animate-pulse">
                    {totalPendingGlobal} معلق جديد
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-400">
                    مكتمل
                  </span>
                )}
              </div>
              <div className="text-xs font-bold text-slate-400 mb-1">طلبات بانتظار الاعتماد</div>
              <div className="text-2xl sm:text-3xl font-black text-amber-400 tracking-tight">
                {totalPendingGlobal} <span className="text-xs text-slate-500 font-normal">طلب</span>
              </div>
            </div>

            {/* Metric 2: Live Packages */}
            <div 
              onClick={() => { setTypeFilter(prev => prev === 'live' ? 'all' : 'live'); }}
              className={`p-5 rounded-3xl cursor-pointer transition-all duration-300 border relative overflow-hidden group shadow-lg ${
                typeFilter === 'live'
                  ? 'bg-purple-950/40 border-purple-500/80 shadow-purple-500/10 ring-2 ring-purple-500/30'
                  : 'bg-slate-900/90 hover:bg-slate-900 border-slate-800 hover:border-purple-500/40'
              }`}
              title="تصفية حسب باقات الـ 8 حصص زووم"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-11 h-11 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                  <Video className="w-5 h-5" />
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border transition-colors ${
                  typeFilter === 'live' ? 'bg-purple-600 text-white border-purple-400 font-black' : 'bg-purple-900/40 text-purple-300 border-purple-500/20'
                }`}>
                  باقة زووم
                </span>
              </div>
              <div className="text-xs font-bold text-slate-400 mb-1">باقات الحصص (8 حصص)</div>
              <div className="text-2xl sm:text-3xl font-black text-purple-400 tracking-tight">
                {totalLiveGlobal} <span className="text-xs text-slate-500 font-normal">باقة</span>
              </div>
            </div>

            {/* Metric 3: Recorded Courses */}
            <div 
              onClick={() => { setTypeFilter(prev => prev === 'courses' ? 'all' : 'courses'); }}
              className={`p-5 rounded-3xl cursor-pointer transition-all duration-300 border relative overflow-hidden group shadow-lg ${
                typeFilter === 'courses'
                  ? 'bg-blue-950/40 border-blue-500/80 shadow-blue-500/10 ring-2 ring-blue-500/30'
                  : 'bg-slate-900/90 hover:bg-slate-900 border-slate-800 hover:border-blue-500/40'
              }`}
              title="تصفية حسب الكورسات المسجلة"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                  <BookOpen className="w-5 h-5" />
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border transition-colors ${
                  typeFilter === 'courses' ? 'bg-blue-600 text-white border-blue-400 font-black' : 'bg-blue-900/40 text-blue-300 border-blue-500/20'
                }`}>
                  فيديوهات
                </span>
              </div>
              <div className="text-xs font-bold text-slate-400 mb-1">اشتراكات الكورسات المسجلة</div>
              <div className="text-2xl sm:text-3xl font-black text-blue-400 tracking-tight">
                {totalCoursesGlobal} <span className="text-xs text-slate-500 font-normal">اشتراك</span>
              </div>
            </div>

            {/* Metric 4: Active */}
            <div 
              onClick={() => { setFilter(prev => prev === 'active' ? 'all' : 'active'); }}
              className={`p-5 rounded-3xl cursor-pointer transition-all duration-300 border relative overflow-hidden group shadow-lg ${
                filter === 'active'
                  ? 'bg-emerald-950/40 border-emerald-500/80 shadow-emerald-500/10 ring-2 ring-emerald-500/30'
                  : 'bg-slate-900/90 hover:bg-slate-900 border-slate-800 hover:border-emerald-500/40'
              }`}
              title="تصفية حسب الاشتراكات المفعلة السارية"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-900/40 text-emerald-300 border border-emerald-500/20">
                  ساري
                </span>
              </div>
              <div className="text-xs font-bold text-slate-400 mb-1">إجمالي الاشتراكات المفعلة</div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight">
                {totalActiveGlobal} <span className="text-xs text-slate-500 font-normal">طالب نشط</span>
              </div>
            </div>

          </div>
        </FadeIn>

        {/* 2. UNIFIED WORLD-CLASS TOOLBAR (SINGLE BAR - NO DUAL STACKED FILTERS) */}
        <FadeIn delay={100}>
          <div className="bg-slate-900/95 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden backdrop-blur-xl">

            {/* Simplified Elegant Controls Bar */}
            <div className="p-4 sm:p-5 bg-slate-900/90 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">

              {/* Status Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-950/90 rounded-2xl border border-slate-800">
                <button
                  onClick={() => setFilter('pending')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    filter === 'pending'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                      : 'text-amber-400 hover:bg-amber-500/10'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>قيد المراجعة</span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                    filter === 'pending' ? 'bg-slate-950 text-amber-400' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {pendingCount}
                  </span>
                </button>

                <button
                  onClick={() => setFilter('active')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    filter === 'active'
                      ? 'bg-emerald-600 text-white font-black shadow-md shadow-emerald-600/20'
                      : 'text-emerald-400 hover:bg-emerald-500/10'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>المفعلة السارية</span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                    filter === 'active' ? 'bg-slate-950 text-emerald-400' : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {activeCount}
                  </span>
                </button>

                <button
                  onClick={() => setFilter('expired')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    filter === 'expired'
                      ? 'bg-rose-500 text-white font-black shadow-md shadow-rose-500/20'
                      : 'text-rose-400 hover:bg-rose-500/10'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>المنتهية</span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-black ${
                    filter === 'expired' ? 'bg-slate-950 text-rose-300' : 'bg-rose-500/20 text-rose-300'
                  }`}>
                    {expiredCount}
                  </span>
                </button>

                <button
                  onClick={() => setFilter('rejected')}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    filter === 'rejected'
                      ? 'bg-slate-700 text-white font-black'
                      : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                  <span>المرفوضة</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-800 text-slate-400">
                    {rejectedCount}
                  </span>
                </button>

                <button
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                    filter === 'all'
                      ? 'bg-blue-600 text-white font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  عرض الكل ({typeScopedRequests.length})
                </button>
              </div>

              {/* Right Controls: Active Service Tag + Grade Filter + Search Input */}
              <div className="flex flex-wrap items-center gap-2.5">

                {/* Active Service Filter Badge if filtered by top cards */}
                {typeFilter !== 'all' && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/70 border border-purple-500/50 text-purple-300 text-xs font-bold shadow-xs">
                    {typeFilter === 'live' ? (
                      <>
                        <Video className="w-3.5 h-3.5 text-purple-400" />
                        <span>باقات الحصص (8)</span>
                      </>
                    ) : (
                      <>
                        <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                        <span>الكورسات</span>
                      </>
                    )}
                    <button
                      onClick={() => setTypeFilter('all')}
                      className="p-0.5 hover:bg-purple-900/60 rounded text-purple-400 hover:text-white cursor-pointer ml-1"
                      title="إلغاء تصفية الخدمة والعودة للكل"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Grade Level Dropdown Filter */}
                <select
                  value={gradeFilter}
                  onChange={(e) => setGradeFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 text-xs sm:text-sm font-bold outline-none cursor-pointer hover:border-slate-700 transition-colors shadow-inner"
                >
                  <option value="all">جميع المراحل والصفوف</option>
                  <option value="primary_1">الصف الأول الابتدائي</option>
                  <option value="primary_2">الصف الثاني الابتدائي</option>
                  <option value="primary_3">الصف الثالث الابتدائي</option>
                  <option value="primary_4">الصف الرابع الابتدائي</option>
                  <option value="primary_5">الصف الخامس الابتدائي</option>
                  <option value="primary_6">الصف السادس الابتدائي</option>
                  <option value="prep_1">الصف الأول الإعدادي</option>
                  <option value="prep_2">الصف الثاني الإعدادي</option>
                  <option value="prep_3">الصف الثالث الإعدادي</option>
                  <option value="sec_1">الصف الأول الثانوي</option>
                  <option value="sec_2">الصف الثاني الثانوي</option>
                  <option value="sec_3">الصف الثالث الثانوي</option>
                </select>

                {/* Search Input */}
                <div className="relative min-w-[220px] sm:w-64">
                  <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 rtl:right-3.5 ltr:left-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث بالاسم، المرحلة، المحفظة..."
                    className="w-full py-2 rtl:pr-9 rtl:pl-8 ltr:pl-9 ltr:pr-8 rounded-xl text-xs sm:text-sm bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:border-blue-500 outline-none transition-all shadow-inner"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute top-1/2 -translate-y-1/2 rtl:left-2.5 ltr:right-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Counter */}
                <div className="text-slate-400 text-xs font-bold whitespace-nowrap hidden xl:block px-1">
                  يعرض <span className="text-white font-black">{filteredRequests.length}</span> من أصل <span className="text-white font-black">{typeScopedRequests.length}</span>
                </div>

              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full rtl:text-right ltr:text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                    <th className="py-3.5 px-4 font-black font-arabic">الطالب والمرحلة</th>
                    <th className="py-3.5 px-4 font-black font-arabic">نوع الاشتراك والخدمة</th>
                    <th className="py-3.5 px-4 font-black font-arabic">الرصيد والحالة</th>
                    <th className="py-3.5 px-4 font-black font-arabic">الدفع والإيصال</th>
                    <th className="py-3.5 px-4 font-black font-arabic">تاريخ الطلب</th>
                    <th className="py-3.5 px-4 font-black font-arabic text-center">إجراءات التحكم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {filteredRequests.map((req) => {
                    const isLive = req.itemType === 'live_package';

                    return (
                      <tr 
                        key={`${req.itemType}-${req.id}`} 
                        className={`transition-colors duration-150 ${
                          isLive 
                            ? 'bg-purple-950/10 hover:bg-purple-950/20' 
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        {/* 1. Student Identity with REAL name & stage & phone */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-sm ${
                              isLive 
                                ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-purple-900/30' 
                                : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-900/30'
                            }`}>
                              {req.studentName?.charAt(0) || 'ط'}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-black text-white text-sm">
                                {req.studentName}
                              </span>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-purple-300 font-bold bg-purple-950/60 px-2.5 py-0.5 rounded-lg border border-purple-800/40 text-[11px]">
                                  {req.gradeName || 'الصف الأول الإعدادي'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Service Item (Clean Single Title - NO DUPLICATION) */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isLive ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-purple-500/15 text-purple-300 border border-purple-500/30">
                              <Video className="w-3.5 h-3.5 text-purple-400" />
                              باقة الـ 8 حصص (زووم)
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                                <BookOpen className="w-3 h-3 text-blue-400" />
                                كورس
                              </span>
                              <span className="text-xs font-bold text-slate-200">
                                {req.courseTitle}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* 3. Balance / Validity & Status Combined */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isLive ? (
                            <div className="flex flex-col gap-1.5 min-w-[130px]">
                              <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-slate-200 font-black">
                                  {req.remainingSessions} من {req.totalSessions || 8} حصص
                                </span>
                                {req.status === 'active' ? (
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1">
                                    <CheckCircle2 className="w-2.5 h-2.5" />
                                    نشطة
                                  </span>
                                ) : req.status === 'pending' ? (
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1 animate-pulse">
                                    <Clock className="w-2.5 h-2.5" />
                                    قيد المراجعة
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 inline-flex items-center gap-1">
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    منتهية
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                                  <div
                                    key={i}
                                    className={`h-1.5 flex-1 rounded-full transition-all ${
                                      i <= req.remainingSessions
                                        ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50'
                                        : 'bg-slate-800'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-300 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700">
                                {req.courseDuration ? `${req.courseDuration} يوم` : 'دائم'}
                              </span>
                              {req.status === 'active' ? (
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">ساري</span>
                              ) : req.status === 'pending' ? (
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/40 animate-pulse">قيد المراجعة</span>
                              ) : (
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">منتهي</span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 4. Payment & Receipt Combined */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="flex flex-col text-xs gap-0.5">
                              <span className="font-bold text-slate-200">
                                {req.paymentMethod === 'vodafone' || req.paymentMethod === 'vodafone_cash' ? 'فودافون كاش' : req.paymentMethod === 'instapay' ? 'InstaPay' : (req.paymentMethod || 'محفظة')}
                              </span>
                              {req.walletNumber && req.walletNumber !== '-' && (
                                <span className="text-slate-400 font-mono text-[11px]" dir="ltr">
                                  {req.walletNumber}
                                </span>
                              )}
                            </div>
                            {req.receiptUrl ? (
                              <button
                                onClick={() => setSelectedReceipt(getDirectImageUrl(req.receiptUrl))}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 hover:text-white border border-blue-500/40 rounded-xl transition-all shadow-xs cursor-pointer hover:scale-105 active:scale-95 text-xs font-black"
                                title="معاينة إيصال التحويل"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>عرض الإيصال</span>
                              </button>
                            ) : (
                              <span className="text-slate-500 text-[11px] px-2 py-0.5 rounded-md bg-slate-900/60 border border-slate-800">
                                بدون إيصال
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 5. Date */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex flex-col text-xs text-slate-400">
                            <span className="font-bold text-slate-300">
                              {new Date(req.date).toLocaleDateString('ar-EG')}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {new Date(req.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </td>

                        {/* 8. Actions (Instant 1-Click Controls) */}
                        <td className="py-3.5 px-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">

                            {/* Live Package Controls */}
                            {isLive && (
                              <>
                                {req.status === 'pending' && (
                                  <>
                                    <button
                                      onClick={() => handleStatusChange(req, 'active')}
                                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer active:scale-95 hover:scale-105"
                                      title="قبول وتفعيل باقة الـ 8 حصص"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                      <span>تفعيل الباقة</span>
                                    </button>
                                    <button
                                      onClick={() => handleStatusChange(req, 'rejected')}
                                      className="px-3 py-2 bg-rose-950/50 text-rose-400 hover:bg-rose-900/60 border border-rose-800/50 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                                      title="رفض الطلب"
                                    >
                                      رفض
                                    </button>
                                  </>
                                )}

                                {req.status === 'active' && (
                                  <>
                                    <button
                                      onClick={() => handleDirectDeduct(req)}
                                      disabled={req.remainingSessions <= 0}
                                      className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-black text-xs transition-all shadow-md shadow-purple-600/20 flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                                      title="خصم حصة واحدة فورياً (-1)"
                                    >
                                      <MinusCircle className="w-4 h-4" />
                                      <span>خصم (-1)</span>
                                    </button>

                                    <button
                                      onClick={() => handleAddCompensationSession(req)}
                                      className="px-3 py-2 bg-blue-900/50 text-blue-200 hover:bg-blue-800/60 border border-blue-700/50 rounded-xl font-black text-xs transition-all shadow-sm flex items-center gap-1 cursor-pointer hover:scale-105 active:scale-95"
                                      title="إضافة حصة تعويضية (+1)"
                                    >
                                      <PlusCircle className="w-4 h-4" />
                                      <span>+1</span>
                                    </button>

                                    <button
                                      onClick={() => handleRenewLivePackage(req)}
                                      className="px-3 py-2 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 rounded-xl font-bold text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95"
                                      title="تجديد الباقة إلى 8 حصص جديدة"
                                    >
                                      <RefreshCw className="w-3.5 h-3.5" />
                                      <span>تجديد (8)</span>
                                    </button>
                                  </>
                                )}

                                {req.status === 'expired' && (
                                  <button
                                    onClick={() => handleRenewLivePackage(req)}
                                    className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 rounded-xl font-black text-xs transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer hover:scale-105"
                                    title="تجديد باقة الـ 8 حصص وتفعيلها"
                                  >
                                    <RefreshCw className="w-4 h-4" />
                                    <span>تجديد الباقة (8)</span>
                                  </button>
                                )}
                              </>
                            )}

                            {/* Course Controls */}
                            {!isLive && (
                              <>
                                {(req.status === 'expired' || req.status === 'active') && (
                                  <button
                                    onClick={() => openExtendModal(req)}
                                    className="px-3 py-2 bg-blue-900/40 text-blue-200 hover:bg-blue-800/60 border border-blue-700/50 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer hover:scale-105"
                                    title="تمديد مدة الكورس"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    <span>تمديد</span>
                                  </button>
                                )}

                                <select
                                  value={req.status}
                                  onChange={(e) => handleStatusChange(req, e.target.value)}
                                  className={`px-3 py-2 rounded-xl font-black text-xs outline-none cursor-pointer text-center appearance-none shadow-sm transition-all ${
                                    req.status === 'active' ? 'bg-emerald-600 text-white' :
                                    req.status === 'expired' ? 'bg-orange-600 text-white' :
                                    req.status === 'rejected' ? 'bg-rose-600 text-white' :
                                    'bg-blue-600 text-white'
                                  }`}
                                >
                                  <option value="pending" className="bg-slate-900 text-blue-300">قيد المراجعة</option>
                                  <option value="active" className="bg-slate-900 text-emerald-300">مفعل</option>
                                  <option value="expired" className="bg-slate-900 text-orange-300">منتهي</option>
                                  <option value="rejected" className="bg-slate-900 text-rose-300">مرفوض</option>
                                </select>
                              </>
                            )}

                            {/* Delete Button */}
                            <button
                              onClick={() => handleDeleteRequest(req)}
                              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900/40 rounded-xl transition-all cursor-pointer shadow-sm hover:scale-105"
                              title="حذف الطلب"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Empty State */}
              {filteredRequests.length === 0 && (
                <div className="text-center py-20 px-4 bg-slate-950/40">
                  <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto mb-4 shadow-xl text-slate-400">
                    <CheckCircle className="w-10 h-10 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-black text-white mb-2">
                    {searchQuery ? 'لا توجد نتائج مطابقة لبحثك' : 'لا توجد طلبات في هذا القسم حالياً'}
                  </h3>
                  <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
                    {searchQuery 
                      ? 'يرجى التأكد من كتابة الاسم أو رقم المحفظة بشكل صحيح أو مسح حقل البحث'
                      : filter === 'pending'
                      ? 'رائع! تم اعتماد ومراجعة جميع طلبات الكورسات وباقات الحصص حتى اللحظة'
                      : 'يمكنك التبديل بين التبويبات أعلاه لاستعراض الطلبات الأخرى'}
                  </p>
                  {(searchQuery || filter !== 'all' || typeFilter !== 'all') && (
                    <button
                      onClick={() => { setSearchQuery(''); setFilter('all'); setTypeFilter('all'); }}
                      className="px-5 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700 shadow-md cursor-pointer"
                    >
                      إعادة ضبط الفلاتر وعرض الكل
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>
        </FadeIn>
      </div>

      {/* ===================== MODALS ===================== */}

      {/* 1. Deduct Live Session Modal */}
      {deductModal.isOpen && deductModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                  <MinusCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">
                    خصم حصة وتسجيل الحضور
                  </h3>
                  <p className="text-xs text-slate-400">
                    تسجيل الحصة المكتملة وإنقاص رصيد باقة الطالب
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeductModal({ isOpen: false, item: null, sessionTitle: '', teacherNotes: '', submitting: false })}
                className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Preview Card */}
            <div className="mb-6 p-4 rounded-2xl bg-purple-950/30 border border-purple-800/40">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-slate-400">الطالب:</span>
                <span className="text-sm font-black text-purple-300">
                  {deductModal.item.studentName} ({deductModal.item.gradeName})
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-purple-800/40">
                <span className="text-xs font-bold text-slate-400">الرصيد بعد الخصم:</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-500 line-through">
                    {deductModal.item.remainingSessions}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-purple-400 rtl:rotate-180" />
                  <span className="text-base font-black text-emerald-400">
                    {Math.max(0, deductModal.item.remainingSessions - 1)} حصص
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  عنوان الحصة أو الدرس المشروح:
                </label>
                <input
                  type="text"
                  value={deductModal.sessionTitle}
                  onChange={(e) => setDeductModal(prev => ({ ...prev, sessionTitle: e.target.value }))}
                  placeholder="مثال: شرح درس النحو + تدريبات تفاعلية"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  ملاحظات المعلم وتقييم الطالب في الحصة:
                </label>
                <textarea
                  rows="2"
                  value={deductModal.teacherNotes}
                  onChange={(e) => setDeductModal(prev => ({ ...prev, teacherNotes: e.target.value }))}
                  placeholder="مثال: تم حضور الحصة كاملة وتفاعل ممتاز في الإجابات"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-bold text-white outline-none focus:border-purple-500 transition-colors resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleConfirmDeduct}
                disabled={deductModal.submitting}
                className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-black text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {deductModal.submitting ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>جاري الخصم والتحديث...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تأكيد الخصم وتسجيل الحضور (-1)</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setDeductModal({ isOpen: false, item: null, sessionTitle: '', teacherNotes: '', submitting: false })}
                className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-sm transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Receipt Modal with Full HD Zoom */}
      {selectedReceipt && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md" 
          onClick={() => { setSelectedReceipt(null); setZoomLevel(1); }}
        >
          <div className="relative max-w-4xl w-full h-[90vh] flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
            <div className="absolute top-4 right-4 flex items-center gap-3 z-50 bg-slate-900/90 p-2 rounded-2xl backdrop-blur-md border border-slate-800">
              <button 
                onClick={() => setZoomLevel(prev => Math.min(prev + 0.5, 4))}
                className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-white rounded-xl flex items-center justify-center transition-colors cursor-pointer"
                title="تكبير"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setZoomLevel(prev => Math.max(prev - 0.5, 0.5))}
                className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-white rounded-xl flex items-center justify-center transition-colors cursor-pointer"
                title="تصغير"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setZoomLevel(1)}
                className="w-10 h-10 bg-slate-800 hover:bg-slate-700 text-white rounded-xl flex items-center justify-center transition-colors cursor-pointer"
                title="إعادة الضبط"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              <a 
                href={selectedReceipt} 
                target="_blank" 
                rel="noreferrer"
                className="w-10 h-10 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center transition-colors cursor-pointer"
                title="فتح في نافذة جديدة أو تنزيل"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
              <div className="w-px h-6 bg-slate-700 mx-1"></div>
              <button 
                onClick={() => { setSelectedReceipt(null); setZoomLevel(1); }}
                className="w-10 h-10 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="w-full h-full overflow-auto flex items-center justify-center rounded-2xl p-4">
              <img 
                src={selectedReceipt} 
                alt="صورة الإيصال" 
                className="max-w-full max-h-full object-contain transition-transform duration-300 origin-center rounded-xl shadow-2xl"
                style={{ transform: `scale(${zoomLevel})` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 3. Extend Course Modal */}
      {extendModalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
              <RefreshCw className="w-7 h-7" />
            </div>
            
            <h3 className="text-xl font-black text-white text-center mb-2">
              تمديد صلاحية الكورس
            </h3>
            
            <p className="text-sm text-slate-400 text-center mb-6">
              تمديد صلاحية كورس الطالب <span className="font-bold text-white">({extendModalConfig.studentName})</span>
            </p>

            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-300 mb-2">
                عدد الأيام الإضافية:
              </label>
              <div className="flex items-center gap-3">
                <input 
                  type="number" 
                  min="1" 
                  max="365"
                  value={customDays}
                  onChange={(e) => setCustomDays(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl font-bold text-center text-lg text-white outline-none focus:border-blue-500 transition-colors"
                />
                <span className="text-slate-400 font-bold whitespace-nowrap">يوم</span>
              </div>
              <div className="flex gap-2 mt-3">
                {[2, 7, 15, 30, 60].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setCustomDays(d)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      customDays === d 
                        ? 'bg-blue-600 text-white border-blue-600' 
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {d} يوم
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={confirmExtend}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black transition-colors shadow-md cursor-pointer"
              >
                تأكيد التمديد
              </button>
              <button
                onClick={() => setExtendModalConfig({ isOpen: false, requestId: null, studentName: '', currentDays: 30 })}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Delete Confirmation Modal */}
      <ConfirmModal 
        isOpen={deleteConfig.isOpen}
        onClose={() => setDeleteConfig({ isOpen: false, requestId: null, itemType: 'course', studentName: '' })}
        onConfirm={confirmDelete}
        title="حذف سجل الطلب"
        message={`هل أنت متأكد من حذف طلب الطالب (${deleteConfig.studentName}) نهائياً؟`}
        confirmText="نعم، حذف الطلب"
        cancelText="إلغاء"
        isDanger={true}
      />

    </div>
  );
}
