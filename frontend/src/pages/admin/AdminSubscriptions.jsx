import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  CheckCircle, Search, Eye, Filter, Loader, AlertTriangle, 
  ShieldCheck, FileText, X, ArrowRight, ZoomIn, ZoomOut, RotateCcw, Trash2,
  Clock, PlusCircle, RefreshCw, Video, BookOpen, MinusCircle, CheckCircle2,
  Sparkles, User, Award, ExternalLink, Calendar, MessageSquare
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
  const [filter, setFilter] = useState('pending'); // 'pending' | 'active' | 'expired' | 'rejected'
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'live' | 'courses'
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
      .channel('admin_subscriptions_all_realtime')
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
      // 1. Trigger background sync for expired course subscriptions on server
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

      if (coursesRes.error) throw coursesRes.error;
      const courseRows = coursesRes.data || [];
      const liveRows = liveRes.data || [];

      // 3. Fetch profiles manually to avoid foreign key relation errors
      const userIds = [
        ...new Set([
          ...courseRows.map(req => req.user_id),
          ...liveRows.map(req => req.user_id)
        ])
      ].filter(Boolean);

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, grade_level, phone')
        .in('id', userIds);

      const profilesMap = {};
      if (profilesData) {
        profilesData.forEach(p => {
          profilesMap[p.id] = p;
        });
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
        return {
          id: req.id,
          user_id: req.user_id,
          itemType: 'course',
          studentName: prof?.full_name || 'غير معروف',
          studentGrade: prof?.grade_level || '',
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

      // 5. Format live package subscriptions (8-session package)
      const formattedLive = liveRows.map(ls => {
        const prof = profilesMap[ls.user_id];
        const grade = ls.grade_level || prof?.grade_level || 'prep_1';
        const remaining = ls.remaining_sessions !== undefined && ls.remaining_sessions !== null ? ls.remaining_sessions : 8;
        const total = ls.total_sessions || 8;

        let computedStatus = ls.status || 'pending';
        if (computedStatus === 'active' && remaining <= 0) {
          computedStatus = 'expired';
        }

        return {
          id: ls.id,
          user_id: ls.user_id,
          itemType: 'live_package',
          studentName: prof?.full_name || 'طالب حصص مباشرة',
          studentGrade: grade,
          gradeName: formatGradeName(grade),
          courseTitle: 'باقة الـ 8 حصص أونلاين (زووم)',
          courseDuration: `${remaining} / ${total} حصص`,
          remainingSessions: remaining,
          totalSessions: total,
          paymentMethod: ls.payment_method,
          walletNumber: ls.wallet_number || '-',
          receiptUrl: ls.receipt_url,
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

      toast.success(t('admin_subs_msg_deleted') || 'تم حذف الطلب بنجاح');
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
        // Live Package status update
        if (newStatus === 'active') {
          // Activating 8-session live package: set 8 sessions, active, activated_at
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
        // Course subscription status update
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

  // ==================== Live Package Specific Handlers ====================

  // Open modal to deduct 1 session
  const handleOpenDeductModal = (req) => {
    setDeductModal({
      isOpen: true,
      item: req,
      sessionTitle: `حصة أونلاين - ${req.gradeName || 'المستوى الدراسي'}`,
      teacherNotes: 'تم حضور الحصة واكتمالها بنجاح',
      submitting: false
    });
  };

  // Confirm attendance deduction (-1 session + save to completed_live_sessions)
  const handleConfirmDeduct = async () => {
    const { item, sessionTitle, teacherNotes } = deductModal;
    if (!item) return;

    setDeductModal(prev => ({ ...prev, submitting: true }));

    const newRemaining = Math.max(0, item.remainingSessions - 1);
    const newStatus = newRemaining === 0 ? 'expired' : 'active';
    const sTitle = sessionTitle.trim() || `حصة أونلاين - ${item.gradeName || ''}`;
    const tNotes = teacherNotes.trim() || 'تم حضور الحصة واكتمالها بنجاح';

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

      // 1. Try server attendance API
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

      // 2. Direct Supabase Fallback if server call wasn't executed
      if (!successApi) {
        await supabase
          .from('live_subscriptions')
          .update({
            remaining_sessions: newRemaining,
            status: newStatus
          })
          .eq('id', item.id);

        await supabase.from('completed_live_sessions').insert([{
          student_id: item.user_id,
          student_name: item.studentName,
          grade_level: item.studentGrade,
          session_title: sTitle,
          session_type: 'package',
          completed_at: new Date().toISOString(),
          teacher_notes: tNotes
        }]);
      }

      toast.success(`✅ تم خصم حصة وتسجيل الحضور للطالب ${item.studentName}! (المتبقي: ${newRemaining} حصص)`);
      setDeductModal({ isOpen: false, item: null, sessionTitle: '', teacherNotes: '', submitting: false });
      fetchRequests();
    } catch (err) {
      console.error('Error deducting session:', err);
      toast.error('حدث خطأ أثناء تسجيل الحضور وخصم الحصة');
      setDeductModal(prev => ({ ...prev, submitting: false }));
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

  // ==================== Course Extension Handlers ====================

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

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = req.studentName?.toLowerCase().includes(q);
        const matchCourse = req.courseTitle?.toLowerCase().includes(q);
        const matchWallet = req.walletNumber?.toLowerCase().includes(q);
        const matchGrade = req.gradeName?.toLowerCase().includes(q);
        if (!matchName && !matchCourse && !matchWallet && !matchGrade) return false;
      }

      return true;
    });
  }, [requests, typeFilter, filter, searchQuery]);

  // Counts based on currently selected Type Filter
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

  // Global pending counts for badges
  const pendingLiveCount = requests.filter(r => r.itemType === 'live_package' && r.status === 'pending').length;
  const pendingCoursesCount = requests.filter(r => r.itemType === 'course' && r.status === 'pending').length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin shadow-lg"></div>
          <p className="text-gray-500 dark:text-gray-400 font-bold text-sm">جاري تحميل طلبات الاشتراكات والحصص...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-16">
      
      {/* High-End Header */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 pt-20 pb-28 px-4 sm:px-6 lg:px-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 blur-[100px] rounded-full pointer-events-none mix-blend-screen"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/20 blur-[100px] rounded-full pointer-events-none mix-blend-screen"></div>
        
        <div className="max-w-7xl mx-auto relative z-10 flex flex-col items-center">
          <div className="w-full flex justify-between items-center mb-6">
            <Link to="/admin-dashboard" className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md font-bold text-sm border border-white/10 shadow-sm">
              <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
              {t('admin_back_to_dashboard')}
            </Link>

            <Link to="/admin-dashboard/live-sessions" className="flex items-center gap-2 px-4 py-2 bg-purple-500/30 hover:bg-purple-500/40 text-purple-200 rounded-full transition-colors backdrop-blur-md font-bold text-sm border border-purple-400/30 shadow-sm">
              <Video className="w-4 h-4" />
              <span>إدارة جداول الحصص المباشرة</span>
            </Link>
          </div>

          <FadeIn>
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-[0_0_30px_rgba(59,130,246,0.3)] mb-5">
                <FileText className="w-10 h-10 text-blue-300" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-white font-arabic tracking-tight mb-3">
                {t('admin_subs_title') || 'إدارة وتفعيل الاشتراكات وباقات الحصص'}
              </h1>
              <p className="text-blue-200/90 font-medium text-base sm:text-lg max-w-3xl leading-relaxed">
                مركز المراجعة والاعتماد الفوري لطلبات باقات الـ 8 حصص أونلاين واشتراكات الكورسات المسجلة مع تتبع الحضور والخصم التلقائي
              </p>
            </div>
          </FadeIn>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-14 relative z-20">
        
        <FadeIn delay={100}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-gray-100 dark:border-slate-700/80 overflow-hidden">
            
            {/* 1. Subscription Type Switcher Bar (All / Live Packages / Courses) */}
            <div className="p-4 sm:p-6 bg-gradient-to-b from-gray-50/80 to-white dark:from-slate-800/80 dark:to-slate-800 border-b border-gray-100 dark:border-slate-700">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                {/* Type Filter Pills */}
                <div className="flex flex-wrap items-center gap-2 p-1.5 bg-gray-100 dark:bg-slate-900/80 rounded-2xl border border-gray-200/60 dark:border-slate-700/60">
                  <button
                    onClick={() => setTypeFilter('all')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer ${
                      typeFilter === 'all'
                        ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-md font-black'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>جميع الطلبات</span>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 font-bold">
                      {requests.length}
                    </span>
                  </button>

                  <button
                    onClick={() => setTypeFilter('live')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer ${
                      typeFilter === 'live'
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 font-black'
                        : 'text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                    }`}
                  >
                    <Video className="w-4 h-4" />
                    <span>باقات الحصص الأونلاين (8 حصص)</span>
                    {pendingLiveCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-rose-500 text-white font-black animate-pulse">
                        {pendingLiveCount} جديد
                      </span>
                    ) : (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${typeFilter === 'live' ? 'bg-purple-500 text-white' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'}`}>
                        {requests.filter(r => r.itemType === 'live_package').length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setTypeFilter('courses')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer ${
                      typeFilter === 'courses'
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-black'
                        : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>الكورسات المسجلة</span>
                    {pendingCoursesCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-rose-500 text-white font-black animate-pulse">
                        {pendingCoursesCount} جديد
                      </span>
                    ) : (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${typeFilter === 'courses' ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'}`}>
                        {requests.filter(r => r.itemType === 'course').length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Instant Search Bar */}
                <div className="relative min-w-[260px] sm:min-w-[320px]">
                  <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 rtl:right-3.5 ltr:left-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث بالاسم، المرحلة، أو رقم المحفظة..."
                    className="w-full py-2.5 rtl:pr-10 rtl:pl-4 ltr:pl-10 ltr:pr-4 rounded-xl text-sm bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-400 outline-none transition-all"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute top-1/2 -translate-y-1/2 rtl:left-3 ltr:right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

              </div>
            </div>

            {/* 2. Status Filter Tabs (Pending / Active / Expired / Rejected) */}
            <div className="flex justify-center border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/40 p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-center gap-2 bg-gray-200/60 dark:bg-slate-900 p-1.5 rounded-2xl w-full sm:w-auto">
                
                <button
                  onClick={() => setFilter('pending')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer ${
                    filter === 'pending'
                      ? 'bg-amber-500 text-white shadow-md font-black scale-105'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>{t('admin_subs_tab_pending') || 'قيد المراجعة'}</span>
                  {pendingCount > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-black ${filter === 'pending' ? 'bg-white text-amber-700' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                      {pendingCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setFilter('active')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer ${
                    filter === 'active'
                      ? 'bg-emerald-600 text-white shadow-md font-black scale-105'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t('admin_subs_tab_all_active') || 'المفعلة حالياً'}</span>
                  {activeCount > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${filter === 'active' ? 'bg-white text-emerald-800' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'}`}>
                      {activeCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setFilter('expired')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer ${
                    filter === 'expired'
                      ? 'bg-rose-600 text-white shadow-md font-black scale-105'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>{t('admin_subs_tab_all_expired') || 'المنتهية'}</span>
                  {expiredCount > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${filter === 'expired' ? 'bg-white text-rose-800' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'}`}>
                      {expiredCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setFilter('rejected')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer ${
                    filter === 'rejected'
                      ? 'bg-slate-700 text-white shadow-md font-black scale-105'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <X className="w-4 h-4" />
                  <span>{t('admin_subs_tab_all_rejected') || 'المرفوضة'}</span>
                  {rejectedCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-gray-300 dark:bg-slate-700 text-gray-800 dark:text-gray-200 font-bold">
                      {rejectedCount}
                    </span>
                  )}
                </button>

              </div>
            </div>

            {/* 3. Subscriptions & Packages Unified Table */}
            <div className="overflow-x-auto">
              <table className="w-full rtl:text-right ltr:text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100/80 dark:bg-slate-700/60 text-gray-700 dark:text-gray-200 text-xs sm:text-sm">
                    <th className="py-4 px-6 font-extrabold font-arabic rtl:rounded-tr-2xl ltr:rounded-tl-2xl">الطالب والمرحلة</th>
                    <th className="py-4 px-6 font-extrabold font-arabic">نوع الاشتراك والخدمة</th>
                    <th className="py-4 px-6 font-extrabold font-arabic">الرصيد / الصلاحية</th>
                    <th className="py-4 px-6 font-extrabold font-arabic">الحالة الحالية</th>
                    <th className="py-4 px-6 font-extrabold font-arabic">طريقة الدفع</th>
                    <th className="py-4 px-6 font-extrabold font-arabic">رقم المحفظة / المرسل</th>
                    <th className="py-4 px-6 font-extrabold font-arabic">تاريخ الطلب</th>
                    <th className="py-4 px-6 font-extrabold font-arabic text-center">الإيصال</th>
                    <th className="py-4 px-6 font-extrabold font-arabic rtl:rounded-tl-2xl ltr:rounded-tr-2xl text-center">إجراءات التحكم والخصم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
                  {filteredRequests.map((req) => {
                    const isLive = req.itemType === 'live_package';

                    return (
                      <tr 
                        key={`${req.itemType}-${req.id}`} 
                        className={`transition-colors ${
                          isLive 
                            ? 'bg-purple-50/20 dark:bg-purple-950/10 hover:bg-purple-50/40 dark:hover:bg-purple-900/20' 
                            : 'hover:bg-gray-50/80 dark:hover:bg-slate-800/80'
                        }`}
                      >
                        {/* 1. Student Name & Grade */}
                        <td className="py-4 px-6 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-sm ${
                              isLive 
                                ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white' 
                                : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
                            }`}>
                              {req.studentName.charAt(0)}
                            </div>
                            <div>
                              <div className="font-extrabold text-gray-900 dark:text-white text-sm sm:text-base">
                                {req.studentName}
                              </div>
                              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                {req.gradeName || formatGradeName(req.studentGrade)}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 2. Subscription Item Type & Title */}
                        <td className="py-4 px-6 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            {isLive ? (
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-black bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                  <Video className="w-3.5 h-3.5 text-purple-600" />
                                  باقة 8 حصص زووم
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-black bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                  <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                                  كورس مسجل
                                </span>
                              </div>
                            )}
                            <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                              {req.courseTitle}
                            </span>
                          </div>
                        </td>

                        {/* 3. Balance / Validity */}
                        <td className="py-4 px-6 whitespace-nowrap">
                          {isLive ? (
                            <div className="flex flex-col gap-1.5 min-w-[130px]">
                              <div className="flex items-center justify-between text-xs font-black">
                                <span className="text-purple-700 dark:text-purple-300">
                                  {req.remainingSessions} من {req.totalSessions || 8} حصص
                                </span>
                                <span className={req.remainingSessions > 3 ? 'text-emerald-600 font-bold' : req.remainingSessions > 0 ? 'text-amber-600 font-bold' : 'text-rose-600 font-bold'}>
                                  {req.remainingSessions === 0 ? 'نفذ الرصيد' : `متبقي ${req.remainingSessions}`}
                                </span>
                              </div>
                              {/* Visual Progress Dots or Bar */}
                              <div className="w-full bg-gray-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden flex">
                                <div 
                                  className={`h-full transition-all duration-300 ${
                                    req.remainingSessions > 4 
                                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500' 
                                      : req.remainingSessions > 1 
                                        ? 'bg-gradient-to-r from-amber-500 to-orange-500' 
                                        : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(0, (req.remainingSessions / (req.totalSessions || 8)) * 100))}%` }}
                                ></div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs font-bold px-3 py-1 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-600">
                              {req.courseDuration ? `${req.courseDuration} يوم` : 'مدى الحياة'}
                            </span>
                          )}
                        </td>

                        {/* 4. Current Status Badge */}
                        <td className="py-4 px-6 whitespace-nowrap">
                          {req.status === 'active' ? (
                            <span className="text-xs font-black px-3 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800 flex items-center gap-1.5 w-fit">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {isLive ? `مفعل (${req.remainingSessions} حصص)` : (req.statusObj?.statusText || 'مفعل')}
                            </span>
                          ) : req.status === 'expired' ? (
                            <span className="text-xs font-black px-3 py-1 rounded-full border bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800 flex items-center gap-1.5 w-fit">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              {isLive ? 'منتهية (0 حصص)' : 'منتهي الصلاحية'}
                            </span>
                          ) : req.status === 'pending' ? (
                            <span className="text-xs font-black px-3 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800 flex items-center gap-1.5 w-fit animate-pulse">
                              <Clock className="w-3.5 h-3.5" />
                              قيد المراجعة ⏱️
                            </span>
                          ) : (
                            <span className="text-xs font-bold px-3 py-1 rounded-full border bg-gray-100 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-gray-400 dark:border-slate-700 flex items-center gap-1.5 w-fit">
                              <X className="w-3.5 h-3.5" />
                              مرفوض ❌
                            </span>
                          )}
                        </td>

                        {/* 5. Payment Method */}
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 px-3 py-1 rounded-xl text-xs font-black shadow-xs inline-block">
                            {req.paymentMethod === 'vodafone' ? 'فودافون كاش' : req.paymentMethod === 'instapay' ? 'InstaPay' : 'محفظة إلكترونية'}
                          </span>
                        </td>

                        {/* 6. Wallet Number */}
                        <td className="py-4 px-6 text-gray-600 dark:text-gray-300 font-mono text-xs font-bold whitespace-nowrap" dir="ltr">
                          {req.walletNumber}
                        </td>

                        {/* 7. Date */}
                        <td className="py-4 px-6 whitespace-nowrap">
                          <div className="flex flex-col text-xs gap-0.5">
                            <span className="text-gray-800 dark:text-gray-200 font-bold">
                              {new Date(req.date).toLocaleDateString('ar-EG')}
                            </span>
                            <span className="text-gray-400 text-[10px]">
                              {new Date(req.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </td>

                        {/* 8. Receipt Preview */}
                        <td className="py-4 px-6 text-center whitespace-nowrap">
                          {req.receiptUrl ? (
                            <button
                              onClick={() => setSelectedReceipt(getDirectImageUrl(req.receiptUrl))}
                              className="mx-auto flex items-center justify-center w-9 h-9 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-xl transition-all shadow-xs hover:scale-105 cursor-pointer"
                              title="معاينة إيصال التحويل"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          ) : (
                            <span className="text-gray-400 text-xs block">بدون إيصال</span>
                          )}
                        </td>

                        {/* 9. Actions Column (Different for Live vs Course) */}
                        <td className="py-4 px-6 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2 flex-wrap">

                            {/* -------------------- LIVE PACKAGE CONTROLS -------------------- */}
                            {isLive && (
                              <>
                                {/* Pending Live Request: Prominent Accept (Start 8-session package) */}
                                {req.status === 'pending' && (
                                  <>
                                    <button
                                      onClick={() => handleStatusChange(req, 'active')}
                                      className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-black text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer hover:scale-105"
                                      title="قبول التحويل وبدء باقة الـ 8 حصص للطالب"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                      <span>تفعيل الباقة (8 حصص)</span>
                                    </button>

                                    <button
                                      onClick={() => handleStatusChange(req, 'rejected')}
                                      className="px-2.5 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-900/20 dark:hover:bg-rose-900/40 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                                      title="رفض الطلب"
                                    >
                                      رفض
                                    </button>
                                  </>
                                )}

                                {/* Active Live Package: Deduct 1 session, +1 compensation, Renew 8 */}
                                {req.status === 'active' && (
                                  <>
                                    <button
                                      onClick={() => handleOpenDeductModal(req)}
                                      disabled={req.remainingSessions <= 0}
                                      className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-black text-xs transition-all shadow-sm flex items-center gap-1 cursor-pointer hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="تسجيل حضور وخصم حصة واحدة من رصيد الطالب"
                                    >
                                      <MinusCircle className="w-3.5 h-3.5" />
                                      <span>خصم حصة (-1)</span>
                                    </button>

                                    <button
                                      onClick={() => handleAddCompensationSession(req)}
                                      className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                                      title="إضافة حصة تعويضية (+1)"
                                    >
                                      +1
                                    </button>

                                    <button
                                      onClick={() => handleRenewLivePackage(req)}
                                      className="p-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                                      title="تجديد الباقة إلى 8 حصص جديدة"
                                    >
                                      <RefreshCw className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}

                                {/* Expired Live Package: Quick Renew */}
                                {req.status === 'expired' && (
                                  <button
                                    onClick={() => handleRenewLivePackage(req)}
                                    className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-black text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer hover:scale-105"
                                    title="تجديد باقة الـ 8 حصص وتفعيلها"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    <span>تجديد (8 حصص)</span>
                                  </button>
                                )}
                              </>
                            )}

                            {/* -------------------- COURSE CONTROLS -------------------- */}
                            {!isLive && (
                              <>
                                {/* Extend button for expired or active */}
                                {(req.status === 'expired' || req.status === 'active') && (
                                  <button
                                    onClick={() => openExtendModal(req)}
                                    className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 rounded-xl font-bold text-xs transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                                    title="تمديد مدة الكورس"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    <span>تمديد</span>
                                  </button>
                                )}

                                <select
                                  value={req.status}
                                  onChange={(e) => handleStatusChange(req, e.target.value)}
                                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all outline-none cursor-pointer text-center appearance-none shadow-xs ${
                                    req.status === 'active' ? 'bg-emerald-600 text-white hover:bg-emerald-700' :
                                    req.status === 'expired' ? 'bg-orange-500 text-white hover:bg-orange-600' :
                                    req.status === 'rejected' ? 'bg-rose-600 text-white hover:bg-rose-700' :
                                    'bg-blue-600 text-white hover:bg-blue-700'
                                  }`}
                                >
                                  <option value="pending" className="bg-white dark:bg-slate-800 text-blue-600 font-bold">قيد المراجعة ⏱️</option>
                                  <option value="active" className="bg-white dark:bg-slate-800 text-emerald-600 font-bold">مفعل ✅</option>
                                  <option value="expired" className="bg-white dark:bg-slate-800 text-orange-600 font-bold">منتهي ⏱️</option>
                                  <option value="rejected" className="bg-white dark:bg-slate-800 text-rose-600 font-bold">مرفوض ❌</option>
                                </select>
                              </>
                            )}

                            {/* Delete Button (Unified) */}
                            <button
                              onClick={() => handleDeleteRequest(req)}
                              className="p-2 bg-rose-50 dark:bg-rose-900/20 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-xl transition-colors shadow-xs cursor-pointer"
                              title="حذف الطلب"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
                <div className="text-center py-20 bg-gray-50/50 dark:bg-slate-900/30">
                  <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-5 shadow-inner">
                    <CheckCircle className="w-10 h-10 text-gray-400 dark:text-gray-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 font-arabic">
                    {searchQuery ? 'لا توجد نتائج مطابقة لبحثك' : 'لا توجد طلبات في هذا القسم'}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    {searchQuery ? 'جرب البحث بكلمات أخرى أو مسح حقل البحث' : 'جميع الاشتراكات والطلبات مراجعة ومحدثة أولاً بأول'}
                  </p>
                </div>
              )}
            </div>

          </div>
        </FadeIn>
      </div>

      {/* =========================================================================
          MODALS
         ========================================================================= */}

      {/* 1. Deduct Live Session Modal */}
      {deductModal.isOpen && deductModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-gray-100 dark:border-slate-700 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <MinusCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-gray-900 dark:text-white font-arabic">
                    خصم حصة وتسجيل الحضور
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    تسجيل الحصة المنتهية وإنقاص رصيد باقة الطالب
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeductModal({ isOpen: false, item: null, sessionTitle: '', teacherNotes: '', submitting: false })}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Student & Session Balance Preview Card */}
            <div className="mb-6 p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-bold text-gray-600 dark:text-gray-400">الطالب:</span>
                <span className="text-sm font-black text-purple-900 dark:text-purple-200">
                  {deductModal.item.studentName} ({deductModal.item.gradeName})
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-purple-200/50 dark:border-purple-800/40">
                <span className="text-xs font-bold text-gray-600 dark:text-gray-400">رصيد الحصص بعد الخصم:</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-gray-400 line-through">
                    {deductModal.item.remainingSessions}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-purple-600 rtl:rotate-180" />
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                    {Math.max(0, deductModal.item.remainingSessions - 1)} حصص
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  عنوان الحصة أو الدرس المشروح:
                </label>
                <input
                  type="text"
                  value={deductModal.sessionTitle}
                  onChange={(e) => setDeductModal(prev => ({ ...prev, sessionTitle: e.target.value }))}
                  placeholder="مثال: شرح درس النحو + تدريبات تفاعلية"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:border-purple-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  ملاحظات المعلم وتقييم الطالب في الحصة:
                </label>
                <textarea
                  rows="2"
                  value={deductModal.teacherNotes}
                  onChange={(e) => setDeductModal(prev => ({ ...prev, teacherNotes: e.target.value }))}
                  placeholder="مثال: تم حضور الحصة كاملة وتفاعل ممتاز في الإجابات"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none focus:border-purple-500 transition-colors resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleConfirmDeduct}
                disabled={deductModal.submitting}
                className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-black text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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
                className="px-5 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-sm transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Receipt Preview Modal */}
      {selectedReceipt && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm" 
          onClick={() => { setSelectedReceipt(null); setZoomLevel(1); }}
        >
          <div className="relative max-w-4xl w-full h-[90vh] flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
            <div className="absolute top-4 right-4 flex items-center gap-3 z-50 bg-black/60 p-2 rounded-2xl backdrop-blur-md border border-white/10">
              <button 
                onClick={() => setZoomLevel(prev => Math.min(prev + 0.5, 4))}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center justify-center transition-colors cursor-pointer"
                title="تكبير"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setZoomLevel(prev => Math.max(prev - 0.5, 0.5))}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center justify-center transition-colors cursor-pointer"
                title="تصغير"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setZoomLevel(1)}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center justify-center transition-colors cursor-pointer"
                title="إعادة الضبط"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              <div className="w-px h-6 bg-white/20 mx-1"></div>
              <button 
                onClick={() => { setSelectedReceipt(null); setZoomLevel(1); }}
                className="w-10 h-10 bg-red-500/30 hover:bg-red-500/50 text-red-200 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
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

      {/* 3. Extend Course Subscription Modal */}
      {extendModalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 dark:border-slate-700 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4">
              <RefreshCw className="w-7 h-7" />
            </div>
            
            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white font-arabic text-center mb-2">
              {t('admin_subs_extend_title') || 'تمديد صلاحية الكورس'}
            </h3>
            
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
              تمديد صلاحية كورس الطالب <span className="font-bold text-gray-900 dark:text-white">({extendModalConfig.studentName})</span>
            </p>

            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                {t('admin_subs_extend_desc') || 'أدخل عدد الأيام الإضافية:'}
              </label>
              <div className="flex items-center gap-3">
                <input 
                  type="number" 
                  min="1" 
                  max="365"
                  value={customDays}
                  onChange={(e) => setCustomDays(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl font-bold text-center text-lg outline-none focus:border-blue-500 transition-colors"
                />
                <span className="text-gray-500 font-bold whitespace-nowrap">يوم</span>
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
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-600 hover:bg-gray-200'
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
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-md cursor-pointer"
              >
                {t('admin_subs_extend_btn') || 'تأكيد التمديد'}
              </button>
              <button
                onClick={() => setExtendModalConfig({ isOpen: false, requestId: null, studentName: '', currentDays: 30 })}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-xl font-bold transition-colors cursor-pointer"
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
        title={t('admin_subs_delete_title') || 'حذف سجل الطلب'}
        message={`هل أنت متأكد من حذف طلب الطالب (${deleteConfig.studentName}) نهائياً؟`}
        confirmText={t('admin_subs_btn_delete') || 'نعم، حذف'}
        cancelText={t('common_cancel') || 'إلغاء'}
        isDanger={true}
      />

    </div>
  );
}
