import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Video, Calendar, Clock, Plus, Trash2, Edit, X, ArrowRight,
  Link as LinkIcon, BookOpen, AlertCircle, Loader, Users, CheckCircle, 
  XCircle, Clock4, Filter, CreditCard, Sparkles, UserCheck, ShieldAlert,
  CalendarDays, RefreshCw, MinusCircle, PlusCircle, CheckCircle2, Eye, UserX
} from 'lucide-react';
import { Link } from 'react-router-dom';
import FadeIn from '../../components/FadeIn';
import { supabase } from '../../lib/supabase';
import ConfirmModal from '../../components/ConfirmModal';
import toast from 'react-hot-toast';
import { formatSessionTitle, formatSessionDesc, formatGradeName, formatTime12h, formatTimeRange12h } from '../../utils/helpers';

export default function AdminLiveSessions() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  
  // Main Top-level View Switcher
  const [mainView, setMainView] = useState('sessions'); // 'sessions' | 'packages' | 'trials'

  // Sessions state
  const [sessions, setSessions] = useState([]);
  const [weeklySchedules, setWeeklySchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // all, primary, prep, sec
  const [filterGrade, setFilterGrade] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  
  // Single Session Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    zoom_link: '',
    grade_level: '',
    status: 'scheduled'
  });
  const [formLoading, setFormLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null });

  // Weekly Schedule Modal state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [currentScheduleId, setCurrentScheduleId] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    title: 'الحصة الأسبوعية الثابتة',
    target_type: 'grade', // 'grade' | 'student'
    grade_level: 'prep_1',
    target_student_id: '',
    target_student_name: '',
    days: ['السبت', 'الأربعاء'],
    start_time: '13:00',
    end_time: '14:00',
    zoom_link: '',
    notes: '',
    is_active: true
  });
  const [scheduleStudentSearch, setScheduleStudentSearch] = useState('');
  const [deleteScheduleModal, setDeleteScheduleModal] = useState({ isOpen: false, id: null });

  // 8-Session Packages State
  const [packages, setPackages] = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [packageSearch, setPackageSearch] = useState('');
  const [packageGradeFilter, setPackageGradeFilter] = useState('all');
  const [bulkAttendanceGrade, setBulkAttendanceGrade] = useState('');
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState(null);

  // Trial Sessions State
  const [trialSessions, setTrialSessions] = useState([]);
  const [trialRequests, setTrialRequests] = useState([]);
  const [trialLoading, setTrialLoading] = useState(false);
  const [isTrialModalOpen, setIsTrialModalOpen] = useState(false);
  const [trialForm, setTrialForm] = useState({
    title: 'حصة تجريبية مجانية (30 دقيقة)',
    description: 'حصة تعريفية لشرح المنهج وأسلوب التدريس وطريقة استخدام المنصة',
    target_type: 'grade', // 'grade' | 'specific_students'
    grade_level: 'prep_1',
    target_student_ids: [],
    target_student_names: [],
    start_time: '',
    duration_minutes: 30,
    zoom_link: ''
  });
  const [trialStudentSearch, setTrialStudentSearch] = useState('');
  const [removeStudentModal, setRemoveStudentModal] = useState({ isOpen: false, requestId: null, studentName: '' });

  const weekDayOptions = [
    { value: 'السبت', label: 'السبت (Saturday)' },
    { value: 'الأحد', label: 'الأحد (Sunday)' },
    { value: 'الإثنين', label: 'الإثنين (Monday)' },
    { value: 'الثلاثاء', label: 'الثلاثاء (Tuesday)' },
    { value: 'الأربعاء', label: 'الأربعاء (Wednesday)' },
    { value: 'الخميس', label: 'الخميس (Thursday)' },
    { value: 'الجمعة', label: 'الجمعة (Friday)' },
  ];

  useEffect(() => {
    fetchData();
    fetchWeeklySchedules();
    fetchPackages();
    fetchTrialData();
  }, []);

  // Reset grade filter when tab changes
  useEffect(() => {
    setFilterGrade('all');
  }, [activeTab]);

  // Helper to safely format Zoom URLs
  const getCleanZoomUrl = (url) => {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (/^\d{9,12}(\?.*)?$/.test(trimmed)) {
      return `https://zoom.us/j/${trimmed}`;
    }
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  // 1. Fetch Online Sessions
  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: sessionsData, error } = await supabase
        .from('online_sessions')
        .select('*')
        .order('start_time', { ascending: true });

      if (error) throw error;
      setSessions(sessionsData || []);
    } catch (err) {
      console.error('Error fetching online sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch Weekly Schedules
  const fetchWeeklySchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('weekly_schedules')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data) {
        setWeeklySchedules(data);
        localStorage.setItem('manarat_weekly_schedules', JSON.stringify(data));
      } else {
        // Fallback to local storage if DB table not yet created
        const local = localStorage.getItem('manarat_weekly_schedules');
        if (local) setWeeklySchedules(JSON.parse(local));
      }
    } catch (err) {
      console.warn('weekly_schedules fetch warning:', err);
      const local = localStorage.getItem('manarat_weekly_schedules');
      if (local) setWeeklySchedules(JSON.parse(local));
    }
  };

  // 3. Fetch 8-Session Student Packages
  const fetchPackages = async () => {
    setPackagesLoading(true);
    try {
      // Fetch students profiles
      const { data: students, error: sErr } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone_number, grade_level, role')
        .eq('role', 'student')
        .order('created_at', { ascending: false });

      if (sErr) throw sErr;

      // Try fetching live subscriptions
      let liveSubs = [];
      try {
        const { data: subsData } = await supabase
          .from('live_subscriptions')
          .select('*');
        if (subsData) liveSubs = subsData;
      } catch (_) {}

      // Combine student profiles with their live packages
      const combined = (students || []).map(student => {
        const sub = liveSubs.find(s => s.user_id === student.id);
        return {
          id: sub?.id || student.id,
          user_id: student.id,
          sub_id: sub?.id,
          full_name: student.full_name || 'طالب',
          email: student.email,
          phone_number: student.phone_number || '-',
          grade_level: student.grade_level || 'prep_1',
          total_sessions: sub?.total_sessions || 8,
          remaining_sessions: sub?.remaining_sessions !== undefined ? sub.remaining_sessions : 8,
          status: sub?.status || 'active',
          receipt_url: sub?.receipt_url || null,
          created_at: sub?.created_at || student.created_at
        };
      });

      setPackages(combined);
    } catch (err) {
      console.error('Error fetching student packages:', err);
    } finally {
      setPackagesLoading(false);
    }
  };

  // 4. Fetch Trial Sessions & Requests
  const fetchTrialData = async () => {
    setTrialLoading(true);
    try {
      const { data: tSessions } = await supabase
        .from('trial_sessions')
        .select('*')
        .order('start_time', { ascending: true });

      if (tSessions) setTrialSessions(tSessions);

      const { data: tRequests } = await supabase
        .from('trial_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (tRequests) setTrialRequests(tRequests);
    } catch (err) {
      console.warn('Trial data fetch warning:', err);
    } finally {
      setTrialLoading(false);
    }
  };

  // ==================== Weekly Schedule Handlers ====================
  const handleOpenScheduleModal = (schedule = null) => {
    if (schedule) {
      setScheduleForm({
        title: schedule.title || 'الحصة الأسبوعية الثابتة',
        target_type: schedule.target_type || 'grade',
        grade_level: schedule.grade_level || 'prep_1',
        target_student_id: schedule.target_student_id || '',
        target_student_name: schedule.target_student_name || '',
        days: schedule.days || ['السبت', 'الأربعاء'],
        start_time: schedule.start_time || '13:00',
        end_time: schedule.end_time || '14:00',
        zoom_link: schedule.zoom_link || '',
        notes: schedule.notes || '',
        is_active: schedule.is_active !== undefined ? schedule.is_active : true
      });
      setIsEditingSchedule(true);
      setCurrentScheduleId(schedule.id);
    } else {
      setScheduleForm({
        title: 'الحصة الأسبوعية الثابتة',
        target_type: 'grade',
        grade_level: 'prep_1',
        target_student_id: '',
        target_student_name: '',
        days: ['السبت', 'الأربعاء'],
        start_time: '13:00',
        end_time: '14:00',
        zoom_link: '',
        notes: '',
        is_active: true
      });
      setIsEditingSchedule(false);
      setCurrentScheduleId(null);
    }
    setScheduleStudentSearch('');
    setIsScheduleModalOpen(true);
  };

  const handleToggleDay = (day) => {
    setScheduleForm(prev => {
      const exists = prev.days.includes(day);
      const newDays = exists ? prev.days.filter(d => d !== day) : [...prev.days, day];
      return { ...prev, days: newDays };
    });
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    if (scheduleForm.target_type === 'student' && !scheduleForm.target_student_id) {
      toast.error('يرجى تحديد الطالب للحصة الخاصة الفردية');
      return;
    }
    if (scheduleForm.days.length === 0) {
      toast.error('يرجى تحديد يوم واحد على الأقل في الأسبوع');
      return;
    }
    if (!scheduleForm.zoom_link.trim()) {
      toast.error('يرجى إدخال رابط الزووم الثابت');
      return;
    }

    const payload = {
      title: scheduleForm.title.trim(),
      target_type: scheduleForm.target_type,
      grade_level: scheduleForm.grade_level,
      target_student_id: scheduleForm.target_type === 'student' ? scheduleForm.target_student_id : null,
      target_student_name: scheduleForm.target_type === 'student' ? scheduleForm.target_student_name : null,
      days: scheduleForm.days,
      start_time: scheduleForm.start_time,
      end_time: scheduleForm.end_time,
      zoom_link: getCleanZoomUrl(scheduleForm.zoom_link),
      notes: scheduleForm.notes?.trim() || '',
      is_active: scheduleForm.is_active
    };

    try {
      if (isEditingSchedule) {
        await supabase.from('weekly_schedules').update(payload).eq('id', currentScheduleId);
        setWeeklySchedules(prev => prev.map(s => s.id === currentScheduleId ? { ...s, ...payload } : s));
      } else {
        const { data } = await supabase.from('weekly_schedules').insert([payload]).select().single();
        const newObj = data || { id: Date.now().toString(), ...payload };
        setWeeklySchedules(prev => [...prev, newObj]);
      }

      toast.success('تم حفظ الموعد الأسبوعي بنجاح');
      setIsScheduleModalOpen(false);
      fetchWeeklySchedules();
    } catch (err) {
      console.warn('Saving schedule direct to DB failed, updating locally:', err);
      // Local fallback
      const updated = isEditingSchedule 
        ? weeklySchedules.map(s => s.id === currentScheduleId ? { ...s, ...payload } : s)
        : [...weeklySchedules, { id: Date.now().toString(), ...payload }];
      setWeeklySchedules(updated);
      localStorage.setItem('manarat_weekly_schedules', JSON.stringify(updated));
      toast.success('تم حفظ الموعد الأسبوعي بنجاح');
      setIsScheduleModalOpen(false);
    }
  };

  const handleDeleteSchedule = async () => {
    const id = deleteScheduleModal.id;
    setDeleteScheduleModal({ isOpen: false, id: null });
    try {
      await supabase.from('weekly_schedules').delete().eq('id', id);
    } catch (_) {}
    const updated = weeklySchedules.filter(s => s.id !== id);
    setWeeklySchedules(updated);
    localStorage.setItem('manarat_weekly_schedules', JSON.stringify(updated));
    toast.success('تم حذف الموعد الأسبوعي');
  };

  // ==================== 8-Session Packages Handlers ====================
  const handleUpdatePackageSessions = async (pkg, delta) => {
    const newRemaining = Math.max(0, pkg.remaining_sessions + delta);
    const newStatus = newRemaining === 0 ? 'expired' : 'active';

    // Optimistic UI update
    setPackages(prev => prev.map(p => p.id === pkg.id ? { 
      ...p, 
      remaining_sessions: newRemaining,
      status: newStatus 
    } : p));

    try {
      // 1. Try backend API first (uses admin privileges and bypasses RLS)
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const apiBase = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '' : 'http://localhost:5000');

      if (token) {
        const res = await fetch(`${apiBase}/api/admin/live-subscriptions/attendance`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            user_id: pkg.user_id,
            grade_level: pkg.grade_level,
            remaining_sessions: newRemaining
          })
        });
        if (res.ok) {
          toast.success(
            delta < 0 
              ? `تم تسجيل الحضور وخصم حصة (المتبقي: ${newRemaining})` 
              : `تم تحديث الرصيد (المتبقي: ${newRemaining})`
          );
          fetchPackages();
          return;
        }
      }

      // 2. Direct Supabase update with onConflict: 'user_id'
      if (pkg.sub_id) {
        await supabase
          .from('live_subscriptions')
          .update({ remaining_sessions: newRemaining, status: newStatus })
          .eq('id', pkg.sub_id);
      } else {
        await supabase
          .from('live_subscriptions')
          .upsert({
            user_id: pkg.user_id,
            grade_level: pkg.grade_level,
            total_sessions: 8,
            remaining_sessions: newRemaining,
            status: newStatus
          }, { onConflict: 'user_id' });
      }
      toast.success(
        delta < 0 
          ? `تم تسجيل الحضور وخصم حصة (المتبقي: ${newRemaining})` 
          : `تم تحديث الرصيد (المتبقي: ${newRemaining})`
      );
      fetchPackages();
    } catch (err) {
      console.warn('Update package sessions error:', err);
    }
  };

  const handleRenewPackage = async (pkg) => {
    // Reset to full 8 sessions
    setPackages(prev => prev.map(p => p.id === pkg.id ? { 
      ...p, 
      remaining_sessions: 8,
      total_sessions: 8,
      status: 'active' 
    } : p));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const apiBase = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '' : 'http://localhost:5000');

      if (token) {
        const res = await fetch(`${apiBase}/api/admin/live-subscriptions/renew`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            user_id: pkg.user_id,
            grade_level: pkg.grade_level
          })
        });
        if (res.ok) {
          toast.success(`🎉 تم تجديد باقة 8 حصص للطالب ${pkg.full_name} بنجاح!`);
          fetchPackages();
          return;
        }
      }

      await supabase
        .from('live_subscriptions')
        .upsert({
          user_id: pkg.user_id,
          grade_level: pkg.grade_level,
          total_sessions: 8,
          remaining_sessions: 8,
          status: 'active',
          activated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
      toast.success(`🎉 تم تجديد باقة 8 حصص للطالب ${pkg.full_name} بنجاح!`);
      fetchPackages();
    } catch (err) {
      console.warn('Renew package error:', err);
    }
  };

  const handleBulkAttendance = async () => {
    if (!bulkAttendanceGrade) {
      toast.error('يرجى اختيار الصف الدراسي لتسجيل الحضور');
      return;
    }

    const eligible = packages.filter(p => p.grade_level === bulkAttendanceGrade && p.remaining_sessions > 0);
    if (eligible.length === 0) {
      toast.error('لا يوجد طلاب لديهم رصيد حصص نشط في هذا الصف');
      return;
    }

    setPackages(prev => prev.map(p => {
      if (p.grade_level === bulkAttendanceGrade && p.remaining_sessions > 0) {
        const nextRem = p.remaining_sessions - 1;
        return { ...p, remaining_sessions: nextRem, status: nextRem === 0 ? 'expired' : 'active' };
      }
      return p;
    }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const apiBase = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '' : 'http://localhost:5000');

      if (token) {
        const res = await fetch(`${apiBase}/api/admin/live-subscriptions/bulk-attendance`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ grade_level: bulkAttendanceGrade })
        });
        if (res.ok) {
          toast.success(`✅ تم تسجيل حضور ${eligible.length} طالب وخصم حصة واحدة لكل منهم`);
          fetchPackages();
          return;
        }
      }

      for (const p of eligible) {
        const nextRem = p.remaining_sessions - 1;
        await supabase
          .from('live_subscriptions')
          .upsert({
            user_id: p.user_id,
            grade_level: p.grade_level,
            total_sessions: 8,
            remaining_sessions: nextRem,
            status: nextRem === 0 ? 'expired' : 'active'
          }, { onConflict: 'user_id' });
      }
      toast.success(`✅ تم تسجيل حضور ${eligible.length} طالب وخصم حصة واحدة لكل منهم`);
      fetchPackages();
    } catch (err) {
      console.warn('Bulk attendance error:', err);
    }
  };

  // ==================== Trial Sessions Handlers ====================
  const handleSaveTrialSession = async (e) => {
    e.preventDefault();
    if (!trialForm.start_time) {
      toast.error('يرجى تحديد موعد الحصة التجريبية');
      return;
    }
    if (!trialForm.zoom_link.trim()) {
      toast.error('يرجى إدخال رابط الزووم');
      return;
    }
    if (trialForm.target_type === 'specific_students' && trialForm.target_student_ids.length === 0) {
      toast.error('يرجى تحديد طالب واحد على الأقل للحصة التجريبية');
      return;
    }

    const payload = {
      title: trialForm.title.trim(),
      description: trialForm.description?.trim() || '',
      grade_level: trialForm.target_type === 'grade' ? trialForm.grade_level : 'custom',
      target_type: trialForm.target_type,
      target_student_ids: trialForm.target_type === 'specific_students' ? trialForm.target_student_ids : [],
      target_student_names: trialForm.target_type === 'specific_students' ? trialForm.target_student_names : [],
      start_time: new Date(trialForm.start_time).toISOString(),
      duration_minutes: 30,
      zoom_link: getCleanZoomUrl(trialForm.zoom_link),
      status: 'scheduled'
    };

    try {
      const { data, error } = await supabase.from('trial_sessions').insert([payload]).select().single();
      const newObj = data || { id: Date.now().toString(), ...payload };
      setTrialSessions(prev => [...prev, newObj]);

      // Automatically register selected students into trial_requests for tracking
      if (trialForm.target_type === 'specific_students' && trialForm.target_student_ids.length > 0) {
        const invites = trialForm.target_student_ids.map(sId => {
          const sObj = packages.find(p => p.user_id === sId) || packages.find(p => p.id === sId);
          return {
            trial_session_id: newObj.id,
            user_id: sId,
            student_name: sObj?.full_name || 'طالب',
            student_phone: sObj?.phone_number || '',
            grade_level: sObj?.grade_level || '',
            status: 'pending'
          };
        });
        await supabase.from('trial_requests').insert(invites).catch(err => console.warn('Invites error:', err));
        await fetchTrialData();
      }

      toast.success('تمت جدولة الحصة التجريبية بنجاح (30 دقيقة)');
      setIsTrialModalOpen(false);
      fetchTrialData();
    } catch (err) {
      console.warn('Save trial session fallback:', err);
      const fallbackObj = { id: Date.now().toString(), ...payload };
      setTrialSessions(prev => [...prev, fallbackObj]);
      toast.success('تمت جدولة الحصة التجريبية بنجاح');
      setIsTrialModalOpen(false);
    }
  };

  const handleApproveTrialStudent = async (req) => {
    try {
      await supabase.from('trial_requests').update({ status: 'enrolled' }).eq('id', req.id);
      // Automatically initialize an active 8-session subscription for them
      await supabase.from('live_subscriptions').upsert({
        user_id: req.user_id,
        grade_level: req.grade_level,
        total_sessions: 8,
        remaining_sessions: 8,
        status: 'active',
        notes: 'تمت الترقية بعد اجتياز الحصة التجريبية'
      });
      setTrialRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'enrolled' } : r));
      toast.success('🎉 تم قبول الطالب وترقيته للاشتراك في باقة الـ 8 حصص بنجاح!');
      fetchPackages();
    } catch (err) {
      console.warn('Approve trial error:', err);
    }
  };

  const handleConfirmRemoveTrialStudent = async () => {
    const id = removeStudentModal.requestId;
    setRemoveStudentModal({ isOpen: false, requestId: null, studentName: '' });

    try {
      await supabase.from('trial_requests').delete().eq('id', id);
      setTrialRequests(prev => prev.filter(r => r.id !== id));
      toast.success('تم استبعاد الطالب من الحصة التجريبية بنجاح');
    } catch (err) {
      console.warn('Remove trial request error:', err);
    }
  };

  // ==================== Single Session Handlers ====================
  const handleOpenModal = (session = null) => {
    if (session) {
      const toLocalDatetimeStr = (utcStr) => {
        if (!utcStr) return '';
        try {
          const d = new Date(utcStr);
          if (isNaN(d.getTime())) return '';
          d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
          return d.toISOString().slice(0, 16);
        } catch (_) {
          return '';
        }
      };

      setFormData({
        title: session.title,
        description: session.description || '',
        start_time: toLocalDatetimeStr(session.start_time),
        end_time: toLocalDatetimeStr(session.end_time),
        zoom_link: session.zoom_link || '',
        grade_level: session.grade_level || '',
        status: session.status || 'scheduled'
      });
      setIsEditing(true);
      setCurrentSessionId(session.id);
    } else {
      setFormData({
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        zoom_link: '',
        grade_level: '',
        status: 'scheduled'
      });
      setIsEditing(false);
      setCurrentSessionId(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => setIsModalOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error('يرجى إدخال عنوان الحصة');
      return;
    }
    if (!formData.zoom_link.trim()) {
      toast.error('يرجى إدخال رابط الزووم');
      return;
    }

    const startDate = new Date(formData.start_time);
    const endDate = new Date(formData.end_time);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      toast.error('يرجى تحديد وقت بداية ونهاية الحصة بدقة');
      return;
    }
    if (endDate <= startDate) {
      toast.error('وقت نهاية الحصة يجب أن يكون بعد وقت البداية');
      return;
    }

    setFormLoading(true);

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description?.trim() || '',
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        zoom_link: getCleanZoomUrl(formData.zoom_link),
        grade_level: formData.grade_level === '' ? null : formData.grade_level,
        status: formData.status
      };

      if (isEditing) {
        const { error } = await supabase.from('online_sessions').update(payload).eq('id', currentSessionId);
        if (error) throw error;
        toast.success('تم تحديث بيانات الحصة بنجاح');
      } else {
        const { error } = await supabase.from('online_sessions').insert([payload]);
        if (error) throw error;
        toast.success('تم إنشاء الحصة بنجاح');
      }

      await fetchData();
      handleCloseModal();
    } catch (err) {
      console.error('Error saving session:', err);
      toast.error('حدث خطأ أثناء حفظ الجلسة');
    } finally {
      setFormLoading(false);
    }
  };

  const confirmDelete = async () => {
    const sessionId = deleteModal.id;
    setDeleteModal({ isOpen: false, id: null });
    const previous = [...sessions];
    setSessions(sessions.filter(s => s.id !== sessionId));

    try {
      const { error } = await supabase.from('online_sessions').delete().eq('id', sessionId);
      if (error) throw error;
      toast.success('تم حذف الحصة بنجاح');
    } catch (err) {
      console.error('Error deleting session:', err);
      setSessions(previous);
      toast.error('حدث خطأ أثناء الحذف.');
    }
  };

  const updateSessionStatus = async (id, newStatus) => {
    const previous = [...sessions];
    setSessions(sessions.map(s => s.id === id ? { ...s, status: newStatus } : s));

    try {
      const { error } = await supabase.from('online_sessions').update({ status: newStatus }).eq('id', id);
      if (error) throw error;
      toast.success('تم تحديث حالة الحصة');
    } catch (err) {
      setSessions(previous);
      toast.error('فشل تحديث حالة الحصة');
    }
  };

  // Filtered Sessions
  const filteredSessions = sessions.filter(s => {
    if (activeTab !== 'all') {
      if (!s.grade_level || !s.grade_level.startsWith(activeTab)) return false;
    }
    if (filterGrade !== 'all') {
      if (s.grade_level !== filterGrade) return false;
    }
    if (filterStatus !== 'all') {
      const sStatus = s.status || 'scheduled';
      if (sStatus !== filterStatus) return false;
    }
    if (filterMonth !== 'all') {
      if (!s.start_time) return false;
      const date = new Date(s.start_time);
      const sMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (sMonth !== filterMonth) return false;
    }
    return true;
  });

  // Filtered Packages
  const filteredPackages = packages.filter(p => {
    const matchSearch = p.full_name.toLowerCase().includes(packageSearch.toLowerCase()) ||
      p.email.toLowerCase().includes(packageSearch.toLowerCase()) ||
      p.phone_number.includes(packageSearch);
    if (!matchSearch) return false;
    if (packageGradeFilter !== 'all' && p.grade_level !== packageGradeFilter) return false;
    return true;
  });

  const renderStatusBadge = (status) => {
    switch(status) {
      case 'completed':
        return <span className="px-3 py-1 text-xs font-bold rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> مكتملة</span>;
      case 'canceled':
        return <span className="px-3 py-1 text-xs font-bold rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3"/> ملغاة</span>;
      case 'postponed':
        return <span className="px-3 py-1 text-xs font-bold rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 flex items-center gap-1"><Clock4 className="w-3 h-3"/> مؤجلة</span>;
      default:
        return <span className="px-3 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 flex items-center gap-1"><Calendar className="w-3 h-3"/> مجدولة</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-16 font-arabic selection:bg-blue-500/30">
      
      {/* High-End Header */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 pt-20 pb-28 px-4 sm:px-6 lg:px-8 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 blur-[100px] rounded-full pointer-events-none mix-blend-screen"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/20 blur-[100px] rounded-full pointer-events-none mix-blend-screen"></div>
        
        <div className="max-w-7xl mx-auto relative z-10 flex flex-col items-center">
          <Link to="/admin-dashboard" className="absolute top-0 right-0 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md font-bold text-sm">
            <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
            {t('admin_back_to_dashboard')}
          </Link>

          <FadeIn>
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.1)] mb-6">
                <Video className="w-10 h-10 text-blue-300" />
              </div>
              <h1 className="text-4xl font-extrabold text-white tracking-tight mb-3">
                إدارة الحصص الأونلاين والبث المباشر
              </h1>
              <p className="text-blue-200/80 font-medium text-lg max-w-2xl">
                تحكم في الجدول الأسبوعي المتكرر لكل صف، باقات الـ 8 حصص للطلاب، والحصص التجريبية المجانية.
              </p>
            </div>
          </FadeIn>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-14 relative z-20">
        
        {/* ===================== Top Nav Switcher ===================== */}
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-3 shadow-lg border border-gray-100 dark:border-slate-700 mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              onClick={() => setMainView('sessions')}
              className={`flex items-center justify-center gap-3 py-4 px-6 rounded-2xl font-bold transition-all text-base cursor-pointer ${
                mainView === 'sessions'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50'
              }`}
            >
              <CalendarDays className="w-5 h-5" />
              <span>الحصص والجدول الأسبوعي</span>
            </button>

            <button
              onClick={() => setMainView('packages')}
              className={`flex items-center justify-center gap-3 py-4 px-6 rounded-2xl font-bold transition-all text-base cursor-pointer ${
                mainView === 'packages'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50'
              }`}
            >
              <CreditCard className="w-5 h-5" />
              <span>باقات الطلاب (8 حصص)</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-white/20">
                {packages.length}
              </span>
            </button>

            <button
              onClick={() => setMainView('trials')}
              className={`flex items-center justify-center gap-3 py-4 px-6 rounded-2xl font-bold transition-all text-base cursor-pointer ${
                mainView === 'trials'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50'
              }`}
            >
              <Sparkles className="w-5 h-5" />
              <span>الحصص التجريبية (30 دقيقة)</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-white/20">
                {trialRequests.length}
              </span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VIEW 1: SESSIONS & WEEKLY RECURRING SCHEDULE                             */}
        {/* ========================================================================= */}
        {/* ========================================================================= */}
        {/* VIEW 1: SESSIONS & WEEKLY RECURRING SCHEDULE                             */}
        {/* ========================================================================= */}
        {mainView === 'sessions' && (
          <FadeIn>
            {/* Weekly Recurring Schedules Main Dashboard */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-slate-700 mb-8">
              
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-slate-700">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <CalendarDays className="w-7 h-7 text-indigo-500" />
                    الجدول والمواعيد الأسبوعية الثابتة (عامة وخاصة)
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                    حدد المواعيد المتكررة لكل صف دراسي أو كحصص خاصة فردية لطالب محدد، مع رابط زووم ثابت يظهر تلقائياً للطلاب.
                  </p>
                </div>
                <button
                  onClick={() => handleOpenScheduleModal()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-md shadow-indigo-500/20 cursor-pointer shrink-0"
                >
                  <Plus className="w-5 h-5" />
                  ضبط موعد أسبوعي جديد
                </button>
              </div>

              {/* Stage & Type Filters */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div className="flex overflow-x-auto bg-gray-100 dark:bg-slate-900/50 p-1 rounded-2xl border border-gray-200 dark:border-slate-700 hide-scrollbar">
                  <button onClick={() => setActiveTab('all')} className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${activeTab === 'all' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-gray-500'}`}>
                    جميع المراحل
                  </button>
                  <button onClick={() => setActiveTab('primary')} className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${activeTab === 'primary' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-gray-500'}`}>
                    الابتدائية
                  </button>
                  <button onClick={() => setActiveTab('prep')} className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${activeTab === 'prep' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-gray-500'}`}>
                    الإعدادية
                  </button>
                  <button onClick={() => setActiveTab('sec')} className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${activeTab === 'sec' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-gray-500'}`}>
                    الثانوية
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400">إجمالي المواعيد:</span>
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                    {weeklySchedules.length} مواعيد
                  </span>
                </div>
              </div>

              {weeklySchedules.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700">
                  <CalendarDays className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-gray-400 font-bold">لم يتم ضبط مواعيد أسبوعية متكررة بعد.</p>
                  <p className="text-xs text-gray-400 mt-1">اضغط على زر "ضبط موعد أسبوعي جديد" لتحديد أيام وساعات الشرح لصفوفك أو حصة خاصة لطالب.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {weeklySchedules
                    .filter(sch => {
                      if (activeTab === 'all') return true;
                      const gl = sch.grade_level || '';
                      if (activeTab === 'primary') return gl.startsWith('primary');
                      if (activeTab === 'prep') return gl.startsWith('prep');
                      if (activeTab === 'sec') return gl.startsWith('sec');
                      return true;
                    })
                    .map(sch => {
                      const isPrivate = sch.target_type === 'student';
                      return (
                        <div 
                          key={sch.id}
                          className={`p-6 rounded-3xl border-2 text-white shadow-xl transition-all flex flex-col justify-between ${
                            isPrivate
                              ? 'border-purple-500/50 bg-gradient-to-br from-slate-900 via-purple-950/60 to-slate-900 shadow-purple-950/30 hover:border-purple-400'
                              : 'border-indigo-500/30 bg-slate-900/95 shadow-indigo-950/20 hover:border-indigo-500/60'
                          }`}
                        >
                          <div>
                            <div className="flex justify-between items-start mb-4">
                              {isPrivate ? (
                                <span className="px-3 py-1 rounded-full text-xs font-black bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                                  <span>حصة خاصة: {sch.target_student_name || 'طالب محدد'}</span>
                                </span>
                              ) : (
                                <span className="px-3.5 py-1.5 rounded-full text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                  {formatGradeName(sch.grade_level)}
                                </span>
                              )}

                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleOpenScheduleModal(sch)}
                                  className="p-2 rounded-xl bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                                  title="تعديل الموعد"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setDeleteScheduleModal({ isOpen: true, id: sch.id })}
                                  className="p-2 rounded-xl bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
                                  title="حذف الموعد"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            <h3 className="text-xl font-black text-white mb-4">
                              {sch.title}
                            </h3>

                            <div className="space-y-2.5 mb-5 text-sm">
                              <div className="flex items-center gap-2 bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                                <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
                                <span className="font-bold text-slate-400 text-xs">الأيام:</span>
                                <span className="text-indigo-300 font-black text-xs">
                                  {Array.isArray(sch.days) ? sch.days.join(' و ') : sch.days}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60">
                                <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
                                <span className="font-bold text-slate-400 text-xs">التوقيت (نظام 12 ساعة):</span>
                                <span className="text-white font-black text-xs">
                                  {formatTimeRange12h(sch.start_time, sch.end_time, isRTL)}
                                </span>
                              </div>
                              {sch.notes && (
                                <p className="text-xs text-slate-300 bg-indigo-950/40 border border-indigo-800/40 p-2.5 rounded-xl">
                                  {sch.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          <a
                            href={getCleanZoomUrl(sch.zoom_link)}
                            target="_blank"
                            rel="noreferrer"
                            className={`w-full py-3 rounded-2xl text-white font-black text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
                              isPrivate 
                                ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/30'
                                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
                            }`}
                          >
                            <Video className="w-4 h-4" />
                            رابط زووم الثابت
                          </a>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </FadeIn>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: 8-SESSION STUDENT PACKAGES & ATTENDANCE                           */}
        {/* ========================================================================= */}
        {mainView === 'packages' && (
          <FadeIn>
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-slate-700 mb-8">
              
              {/* Header & Bulk Attendance */}
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8 pb-6 border-b border-gray-100 dark:border-slate-700">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <CreditCard className="w-7 h-7 text-emerald-500" />
                    نظام باقات الحصص الأونلاين (8 حصص مقدماً)
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                    يدفع كل طالب ثمن 8 حصص مقدماً، وعند حضور الحصص يقل رصيده تلقائياً. عند انتهاء الـ 8 حصص يطالب بالنظام بالتجديد للمتابعة.
                  </p>
                </div>

                {/* Bulk Attendance Action */}
                <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-2xl border border-emerald-200 dark:border-emerald-800/40 w-full sm:w-auto">
                  <select
                    value={bulkAttendanceGrade}
                    onChange={(e) => setBulkAttendanceGrade(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-xs font-bold text-gray-800 dark:text-gray-200 outline-none"
                  >
                    <option value="">اختر الصف لتسجيل الحضور</option>
                    <option value="prep_1">{formatGradeName('prep_1')}</option>
                    <option value="prep_2">{formatGradeName('prep_2')}</option>
                    <option value="prep_3">{formatGradeName('prep_3')}</option>
                    <option value="sec_1">{formatGradeName('sec_1')}</option>
                    <option value="sec_2">{formatGradeName('sec_2')}</option>
                    <option value="sec_3">{formatGradeName('sec_3')}</option>
                  </select>
                  <button
                    onClick={handleBulkAttendance}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm shrink-0 cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4" />
                    تسجيل حضور جماعي (-1)
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <input
                  type="text"
                  placeholder="بحث باسم الطالب، الإيميل، أو الهاتف..."
                  value={packageSearch}
                  onChange={(e) => setPackageSearch(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-sm font-bold text-gray-900 dark:text-white outline-none"
                />
                <select
                  value={packageGradeFilter}
                  onChange={(e) => setPackageGradeFilter(e.target.value)}
                  className="px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-sm font-bold text-gray-700 dark:text-gray-300 outline-none sm:w-60"
                >
                  <option value="all">جميع الصفوف الدراسية</option>
                  <option value="prep_1">{formatGradeName('prep_1')}</option>
                  <option value="prep_2">{formatGradeName('prep_2')}</option>
                  <option value="prep_3">{formatGradeName('prep_3')}</option>
                  <option value="sec_1">{formatGradeName('sec_1')}</option>
                  <option value="sec_2">{formatGradeName('sec_2')}</option>
                  <option value="sec_3">{formatGradeName('sec_3')}</option>
                </select>
              </div>

              {/* Packages Table */}
              {packagesLoading ? (
                <div className="flex justify-center py-20">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
                </div>
              ) : filteredPackages.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-slate-900/30 rounded-2xl">
                  <Users className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-gray-400 font-bold">لا توجد اشتراكات مطابقة للبحث.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-slate-700 text-xs font-black text-gray-500 dark:text-gray-400 uppercase">
                        <th className="py-4 px-4">الطالب</th>
                        <th className="py-4 px-4">الصف</th>
                        <th className="py-4 px-4">رصيد الحصص (من 8)</th>
                        <th className="py-4 px-4">الحالة</th>
                        <th className="py-4 px-4 text-center">إجراءات الباقة والحضور</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700 text-sm">
                      {filteredPackages.map(pkg => {
                        const remaining = pkg.remaining_sessions;
                        const isExpired = remaining <= 0;
                        const percent = Math.round((remaining / 8) * 100);

                        return (
                          <tr key={pkg.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-750 transition-colors">
                            <td className="py-4 px-4">
                              <div className="font-bold text-gray-900 dark:text-white">{pkg.full_name}</div>
                              <div className="text-xs text-gray-400" dir="ltr">{pkg.phone_number}</div>
                            </td>
                            <td className="py-4 px-4 font-bold text-gray-600 dark:text-gray-300">
                              {formatGradeName(pkg.grade_level)}
                            </td>
                            <td className="py-4 px-4">
                              <div className="w-48">
                                <div className="flex justify-between text-xs font-black mb-1">
                                  <span className={isExpired ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}>
                                    {remaining} من 8 حصص متبقية
                                  </span>
                                  <span className="text-gray-400">{percent}%</span>
                                </div>
                                <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
                                  <div 
                                    className={`h-full transition-all duration-500 ${isExpired ? 'bg-red-500' : remaining <= 2 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${percent}%` }}
                                  ></div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              {isExpired ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  منتهية (بحاجة للتجديد)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  نشطة
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleUpdatePackageSessions(pkg, -1)}
                                  disabled={remaining <= 0}
                                  className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-xs font-bold flex items-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                  title="تسجيل حضور وخصم حصة واحدة"
                                >
                                  <MinusCircle className="w-3.5 h-3.5" />
                                  خصم حصة
                                </button>

                                <button
                                  onClick={() => handleUpdatePackageSessions(pkg, 1)}
                                  className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                  title="إضافة حصة تعويضية (+1)"
                                >
                                  <PlusCircle className="w-3.5 h-3.5" />
                                  +1
                                </button>

                                <button
                                  onClick={() => handleRenewPackage(pkg)}
                                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1 transition-colors shadow-sm cursor-pointer"
                                  title="تجديد باقة 8 حصص جديدة"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  تجديد (8 حصص)
                                </button>

                                {pkg.receipt_url && (
                                  <button
                                    onClick={() => setReceiptPreviewUrl(pkg.receipt_url)}
                                    className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100 transition-colors"
                                    title="عرض إيصال التحويل"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                )}
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
        {/* VIEW 3: TRIAL SESSIONS (30 MINUTES)                                      */}
        {/* ========================================================================= */}
        {mainView === 'trials' && (
          <FadeIn>
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-slate-700 mb-8">
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-6 border-b border-gray-100 dark:border-slate-700">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="w-7 h-7 text-amber-500" />
                    قسم الحصص التجريبية المجانية (30 دقيقة)
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                    حصص تجريبية للمدرس للتعرف على الطلاب وشرح طريقة العمل. الطالب الذي يرغب بالاستمرار يتم ترقيته لباقة الـ 8 حصص، والطالب الذي لن يكمل يمكن إزالته بنقرة واحدة.
                  </p>
                </div>
                <button
                  onClick={() => setIsTrialModalOpen(true)}
                  className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-md shadow-amber-500/20 cursor-pointer shrink-0"
                >
                  <Plus className="w-5 h-5" />
                  جدولة حصة تجريبية (30 دقيقة)
                </button>
              </div>

              {/* Scheduled Trials */}
              <div className="mb-10">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  الحصص التجريبية المتاحة حالياً:
                </h3>
                {trialSessions.length === 0 ? (
                  <div className="p-6 bg-gray-50 dark:bg-slate-900/40 rounded-2xl text-center text-gray-500 font-bold text-sm">
                    لا توجد حصص تجريبية مجدولة حالياً.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {trialSessions.map(tSession => {
                      const isSpecific = tSession.target_type === 'specific_students';
                      const targetedNames = tSession.target_student_names || [];

                      return (
                        <div key={tSession.id} className="p-5 rounded-2xl border border-amber-200 dark:border-slate-700 bg-amber-50/30 dark:bg-slate-900/40 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-center mb-2 flex-wrap gap-1">
                              {isSpecific ? (
                                <span className="px-3 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
                                  🎯 طلاب محددين ({targetedNames.length || tSession.target_student_ids?.length || 1})
                                </span>
                              ) : (
                                <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                                  {formatGradeName(tSession.grade_level)}
                                </span>
                              )}
                              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-100/50 px-2 py-0.5 rounded-md">
                                30 دقيقة
                              </span>
                            </div>

                            <h4 className="font-bold text-base text-gray-900 dark:text-white mb-1">{tSession.title}</h4>
                            <p className="text-xs text-gray-500 mb-2">{new Date(tSession.start_time).toLocaleString('ar-EG')}</p>

                            {isSpecific && targetedNames.length > 0 && (
                              <div className="mb-3 p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 text-xs">
                                <span className="font-bold text-purple-700 dark:text-purple-300 block mb-1">الطلاب المخصص لهم:</span>
                                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                                  {targetedNames.map((name, idx) => (
                                    <span key={idx} className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-[11px] font-bold text-gray-700 dark:text-gray-300 border border-purple-100 dark:border-purple-900">
                                      {name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <a
                            href={getCleanZoomUrl(tSession.zoom_link)}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                          >
                            <Video className="w-3.5 h-3.5" />
                            دخول زووم الحصة التجريبية
                          </a>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Student Trial Requests & Decision */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  قائمة الطلاب المشاركين في الحصص التجريبية:
                </h3>
                {trialRequests.length === 0 ? (
                  <div className="text-center py-10 bg-gray-50 dark:bg-slate-900/30 rounded-2xl text-gray-500 font-bold text-sm">
                    لا توجد طلبات مشاركة من الطلاب حتى الآن.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-slate-700 text-xs font-black text-gray-500 uppercase">
                          <th className="py-3 px-4">اسم الطالب</th>
                          <th className="py-3 px-4">الصف</th>
                          <th className="py-3 px-4">الهاتف</th>
                          <th className="py-3 px-4">الحالة</th>
                          <th className="py-3 px-4 text-center">قرار المدرس</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                        {trialRequests.map(req => (
                          <tr key={req.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-750 transition-colors">
                            <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                              {req.student_name || 'طالب تجريبي'}
                            </td>
                            <td className="py-3 px-4 font-bold text-gray-600 dark:text-gray-300">
                              {formatGradeName(req.grade_level)}
                            </td>
                            <td className="py-3 px-4 text-gray-500" dir="ltr">{req.student_phone || '-'}</td>
                            <td className="py-3 px-4">
                              {req.status === 'enrolled' ? (
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                                  سيكمل معنا (مشترك)
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                                  قيد التقييم
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleApproveTrialStudent(req)}
                                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 transition-colors shadow-sm cursor-pointer"
                                  title="قبول الطالب وترقيته للاشتراك في باقة 8 حصص"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                  سيكمل معنا
                                </button>
                                <button
                                  onClick={() => setRemoveStudentModal({ isOpen: true, requestId: req.id, studentName: req.student_name || 'هذا الطالب' })}
                                  className="px-3 py-1.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                  title="استبعاد الطالب وحذفه من الحصة"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                  لن يكمل (إزالة)
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          </FadeIn>
        )}

      </div>

      {/* ===================== MODAL 1: Weekly Schedule ===================== */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-gray-100 dark:border-slate-700 my-8">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100 dark:border-slate-700">
              <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                <CalendarDays className="w-6 h-6 text-indigo-500" />
                {isEditingSchedule ? 'تعديل الموعد الأسبوعي الثابت' : 'ضبط موعد أسبوعي متكرر لصف'}
              </h3>
              <button onClick={() => setIsScheduleModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">عنوان الحصة / المجموعة</label>
                <input
                  type="text"
                  required
                  value={scheduleForm.title}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })}
                  placeholder="مثال: حصة النحو الأسبوعية"
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-sm font-bold text-gray-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">نوع الموعد الأسبوعي</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setScheduleForm({ ...scheduleForm, target_type: 'grade', target_student_id: '', target_student_name: '' })}
                    className={`p-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      scheduleForm.target_type !== 'student'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 shadow-sm ring-1 ring-indigo-500'
                        : 'border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>صف دراسي كامل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleForm({ ...scheduleForm, target_type: 'student' })}
                    className={`p-3 rounded-2xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      scheduleForm.target_type === 'student'
                        ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 shadow-sm ring-1 ring-purple-500'
                        : 'border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    <span>حصة خاصة لطالب (1-on-1)</span>
                  </button>
                </div>
              </div>

              {scheduleForm.target_type !== 'student' ? (
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">الصف الدراسي المستهدف</label>
                  <select
                    value={scheduleForm.grade_level}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, grade_level: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-sm font-bold text-gray-900 dark:text-white outline-none"
                  >
                    <option value="prep_1">{formatGradeName('prep_1')}</option>
                    <option value="prep_2">{formatGradeName('prep_2')}</option>
                    <option value="prep_3">{formatGradeName('prep_3')}</option>
                    <option value="sec_1">{formatGradeName('sec_1')}</option>
                    <option value="sec_2">{formatGradeName('sec_2')}</option>
                    <option value="sec_3">{formatGradeName('sec_3')}</option>
                    <option value="primary_4">{formatGradeName('primary_4')}</option>
                    <option value="primary_5">{formatGradeName('primary_5')}</option>
                    <option value="primary_6">{formatGradeName('primary_6')}</option>
                  </select>
                </div>
              ) : (
                <div className="space-y-2 bg-purple-50/50 dark:bg-purple-950/20 p-3.5 rounded-2xl border border-purple-200 dark:border-purple-800/40">
                  <label className="block text-xs font-bold text-purple-900 dark:text-purple-200">
                    اختر الطالب المستهدف للحصة الخاصة:
                  </label>
                  <input
                    type="text"
                    value={scheduleStudentSearch}
                    onChange={(e) => setScheduleStudentSearch(e.target.value)}
                    placeholder="ابحث باسم الطالب أو رقم الهاتف..."
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-700 text-xs font-bold text-gray-900 dark:text-white outline-none"
                  />
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {packages
                      .filter(st => {
                        if (!scheduleStudentSearch.trim()) return true;
                        const q = scheduleStudentSearch.toLowerCase();
                        return (st.full_name || '').toLowerCase().includes(q) || (st.phone_number || '').includes(q);
                      })
                      .map(st => {
                        const isChosen = scheduleForm.target_student_id === st.user_id;
                        return (
                          <button
                            key={st.user_id}
                            type="button"
                            onClick={() => setScheduleForm({
                              ...scheduleForm,
                              target_student_id: st.user_id,
                              target_student_name: st.full_name,
                              grade_level: st.grade_level || scheduleForm.grade_level
                            })}
                            className={`w-full text-right p-2.5 rounded-xl border text-xs flex items-center justify-between transition-all cursor-pointer ${
                              isChosen
                                ? 'bg-purple-600 text-white border-purple-600 font-extrabold shadow-sm'
                                : 'bg-white dark:bg-slate-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:border-purple-300'
                            }`}
                          >
                            <div>
                              <p className="font-bold">{st.full_name}</p>
                              <p className={`text-[11px] ${isChosen ? 'text-purple-100' : 'text-gray-400'}`}>
                                {formatGradeName(st.grade_level)} • {st.phone_number}
                              </p>
                            </div>
                            {isChosen && <CheckCircle2 className="w-4 h-4 text-white" />}
                          </button>
                        );
                      })}
                  </div>
                  {scheduleForm.target_student_name && (
                    <div className="text-xs font-bold text-purple-700 dark:text-purple-300 pt-1">
                      ✅ الطالب المختار: <span className="underline">{scheduleForm.target_student_name}</span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">أيام الحصة في الأسبوع (اختر يومين أو أكثر)</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {weekDayOptions.map(day => {
                    const isSelected = scheduleForm.days.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => handleToggleDay(day.value)}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                          isSelected 
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 shadow-sm'
                            : 'border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        <span>{day.value}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">وقت البداية</label>
                  <input
                    type="time"
                    required
                    value={scheduleForm.start_time}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, start_time: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-sm font-bold text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">وقت النهاية</label>
                  <input
                    type="time"
                    required
                    value={scheduleForm.end_time}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, end_time: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-sm font-bold text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">رابط زووم الثابت (Permanent Zoom URL)</label>
                <input
                  type="text"
                  required
                  value={scheduleForm.zoom_link}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, zoom_link: e.target.value })}
                  placeholder="https://zoom.us/j/... أو معرّف الاجتماع"
                  dir="ltr"
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-sm font-bold text-gray-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">ملاحظات إضافية للطلاب (اختياري)</label>
                <textarea
                  rows={2}
                  value={scheduleForm.notes}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, notes: e.target.value })}
                  placeholder="مثال: يرجى تجهيز كشكول النحو قبل بداية الحصة بـ 5 دقائق"
                  className="w-full px-4 py-2 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-slate-100 text-xs border border-gray-300 dark:border-slate-600 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white text-xs shadow-md cursor-pointer"
                >
                  حفظ الموعد الأسبوعي
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL 2: Trial Session ===================== */}
      {isTrialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-gray-100 dark:border-slate-700 my-8">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100 dark:border-slate-700">
              <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-amber-500" />
                جدولة حصة تجريبية مجانية (30 دقيقة)
              </h3>
              <button onClick={() => setIsTrialModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTrialSession} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">عنوان الحصة التجريبية</label>
                <input
                  type="text"
                  required
                  value={trialForm.title}
                  onChange={(e) => setTrialForm({ ...trialForm, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-sm font-bold text-gray-900 dark:text-white outline-none"
                />
              </div>

              {/* Target Type Toggle */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">الفئة المستهدفة للحصة التجريبية</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTrialForm({ ...trialForm, target_type: 'grade' })}
                    className={`p-2.5 rounded-xl border text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      trialForm.target_type === 'grade'
                        ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-sm'
                        : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-500'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    صف دراسي كامل
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrialForm({ ...trialForm, target_type: 'specific_students' })}
                    className={`p-2.5 rounded-xl border text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      trialForm.target_type === 'specific_students'
                        ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400 shadow-sm'
                        : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-500'
                    }`}
                  >
                    <UserCheck className="w-4 h-4" />
                    طالب أو طلاب محددين
                  </button>
                </div>
              </div>

              {/* Target: Grade */}
              {trialForm.target_type === 'grade' ? (
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">الصف الدراسي المستهدف</label>
                  <select
                    value={trialForm.grade_level}
                    onChange={(e) => setTrialForm({ ...trialForm, grade_level: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-sm font-bold text-gray-900 dark:text-white outline-none"
                  >
                    <option value="prep_1">{formatGradeName('prep_1')}</option>
                    <option value="prep_2">{formatGradeName('prep_2')}</option>
                    <option value="prep_3">{formatGradeName('prep_3')}</option>
                    <option value="sec_1">{formatGradeName('sec_1')}</option>
                    <option value="sec_2">{formatGradeName('sec_2')}</option>
                    <option value="sec_3">{formatGradeName('sec_3')}</option>
                    <option value="primary_4">{formatGradeName('primary_4')}</option>
                    <option value="primary_5">{formatGradeName('primary_5')}</option>
                    <option value="primary_6">{formatGradeName('primary_6')}</option>
                  </select>
                </div>
              ) : (
                /* Target: Specific Students */
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                      اختر الطلاب من المنصة ({trialForm.target_student_ids.length} محددين)
                    </label>
                    {trialForm.target_student_ids.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setTrialForm({ ...trialForm, target_student_ids: [], target_student_names: [] })}
                        className="text-[11px] text-red-500 hover:underline font-bold cursor-pointer"
                      >
                        إلغاء التحديد
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    placeholder="ابحث باسم الطالب، الإيميل، أو الهاتف..."
                    value={trialStudentSearch}
                    onChange={(e) => setTrialStudentSearch(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-900 dark:text-white outline-none"
                  />

                  <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-200 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-800 bg-gray-50/50 dark:bg-slate-900/50 p-1">
                    {packages
                      .filter(st => {
                        if (!trialStudentSearch.trim()) return true;
                        const q = trialStudentSearch.toLowerCase();
                        return (
                          st.full_name?.toLowerCase().includes(q) ||
                          st.email?.toLowerCase().includes(q) ||
                          st.phone_number?.includes(q)
                        );
                      })
                      .map(student => {
                        const sId = student.user_id || student.id;
                        const sName = student.full_name || 'طالب';
                        const isSelected = trialForm.target_student_ids.includes(sId);

                        return (
                          <div
                            key={sId}
                            onClick={() => {
                              setTrialForm(prev => {
                                const exists = prev.target_student_ids.includes(sId);
                                const newIds = exists ? prev.target_student_ids.filter(id => id !== sId) : [...prev.target_student_ids, sId];
                                const newNames = exists ? prev.target_student_names.filter(n => n !== sName) : [...prev.target_student_names, sName];
                                return { ...prev, target_student_ids: newIds, target_student_names: newNames };
                              });
                            }}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                              isSelected ? 'bg-purple-100/70 dark:bg-purple-950/50' : 'hover:bg-gray-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                readOnly
                                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                              />
                              <div>
                                <span className="font-bold text-xs text-gray-900 dark:text-white block">{student.full_name}</span>
                                <span className="text-[10px] text-gray-400 block" dir="ltr">{student.phone_number || student.email}</span>
                              </div>
                            </div>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                              {formatGradeName(student.grade_level)}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">تاريخ ووقت الحصة</label>
                <input
                  type="datetime-local"
                  required
                  value={trialForm.start_time}
                  onChange={(e) => setTrialForm({ ...trialForm, start_time: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-sm font-bold text-gray-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">رابط زووم للحصة التجريبية</label>
                <input
                  type="text"
                  required
                  value={trialForm.zoom_link}
                  onChange={(e) => setTrialForm({ ...trialForm, zoom_link: e.target.value })}
                  placeholder="https://zoom.us/j/... أو معرّف الاجتماع"
                  dir="ltr"
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-sm font-bold text-gray-900 dark:text-white outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setIsTrialModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl font-bold bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-slate-100 text-xs border border-gray-300 dark:border-slate-600 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl font-bold bg-amber-600 hover:bg-amber-700 text-white text-xs shadow-md cursor-pointer"
                >
                  حفظ وجدولة الحصة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== MODAL 3: Single Session Modal ===================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-xl w-full p-6 md:p-8 shadow-2xl border border-gray-100 dark:border-slate-700 my-8">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100 dark:border-slate-700">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Video className="w-6 h-6 text-blue-500" />
                {isEditing ? 'تعديل الحصة' : 'جدولة حصة جديدة'}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 p-2">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">عنوان الحصة *</label>
                <input 
                  type="text" 
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white outline-none"
                  placeholder="مثال: مراجعة كان وأخواتها"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">الوصف (اختياري)</label>
                <textarea 
                  rows="2"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white outline-none resize-none"
                  placeholder="وصف مختصر لما سيتم تناوله في الحصة..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">وقت البداية *</label>
                  <input 
                    type="datetime-local" 
                    required
                    value={formData.start_time}
                    onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">وقت النهاية *</label>
                  <input 
                    type="datetime-local" 
                    required
                    value={formData.end_time}
                    onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">رابط زووم أو البث *</label>
                <input 
                  type="text" 
                  required
                  value={formData.zoom_link}
                  onChange={(e) => setFormData({...formData, zoom_link: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white"
                  placeholder="https://zoom.us/j/... أو معرّف الاجتماع"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">تحديد الصف الدراسي</label>
                <select
                  value={formData.grade_level}
                  onChange={(e) => setFormData({...formData, grade_level: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white font-bold"
                >
                  <option value="">عام لجميع الصفوف</option>
                  <optgroup label="المرحلة الإعدادية">
                    <option value="prep_1">{formatGradeName('prep_1')}</option>
                    <option value="prep_2">{formatGradeName('prep_2')}</option>
                    <option value="prep_3">{formatGradeName('prep_3')}</option>
                  </optgroup>
                  <optgroup label="المرحلة الثانوية">
                    <option value="sec_1">{formatGradeName('sec_1')}</option>
                    <option value="sec_2">{formatGradeName('sec_2')}</option>
                    <option value="sec_3">{formatGradeName('sec_3')}</option>
                  </optgroup>
                  <optgroup label="المرحلة الابتدائية">
                    <option value="primary_4">{formatGradeName('primary_4')}</option>
                    <option value="primary_5">{formatGradeName('primary_5')}</option>
                    <option value="primary_6">{formatGradeName('primary_6')}</option>
                  </optgroup>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-slate-700">
                <button 
                  type="button" 
                  onClick={handleCloseModal}
                  className="px-6 py-3 rounded-xl font-bold bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-slate-100 text-sm border border-gray-300 dark:border-slate-600 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button 
                  type="submit" 
                  disabled={formLoading}
                  className="px-8 py-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {formLoading ? <Loader className="w-5 h-5 animate-spin" /> : 'حفظ الحصة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Single Session Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: null })}
        onConfirm={confirmDelete}
        title="حذف الحصة"
        message="هل أنت متأكد من رغبتك في حذف هذه الحصة؟"
        confirmText="حذف"
        cancelText="إلغاء"
        isDanger={true}
      />

      {/* Delete Schedule Modal */}
      <ConfirmModal
        isOpen={deleteScheduleModal.isOpen}
        onClose={() => setDeleteScheduleModal({ isOpen: false, id: null })}
        onConfirm={handleDeleteSchedule}
        title="حذف الموعد الأسبوعي"
        message="هل أنت متأكد من رغبتك في إلغاء وحذف هذا الموعد الأسبوعي المتكرر؟"
        confirmText="حذف"
        cancelText="إلغاء"
        isDanger={true}
      />

      {/* Remove Trial Student Modal */}
      <ConfirmModal
        isOpen={removeStudentModal.isOpen}
        onClose={() => setRemoveStudentModal({ isOpen: false, requestId: null, studentName: '' })}
        onConfirm={handleConfirmRemoveTrialStudent}
        title="استبعاد الطالب من الحصة التجريبية"
        message={`هل أنت متأكد من استبعاد الطالب (${removeStudentModal.studentName}) وإزالته من الحصة التجريبية؟`}
        confirmText="استبعاد"
        cancelText="إلغاء"
        isDanger={true}
      />

      {/* Receipt Preview Modal */}
      {receiptPreviewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setReceiptPreviewUrl(null)}>
          <div className="relative max-w-xl max-h-[85vh] bg-white dark:bg-slate-900 rounded-2xl overflow-hidden p-2">
            <button
              onClick={() => setReceiptPreviewUrl(null)}
              className="absolute top-4 right-4 p-2 bg-black/60 text-white rounded-full hover:bg-black/80"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={receiptPreviewUrl} alt="إيصال الدفع" className="w-full h-auto max-h-[80vh] object-contain rounded-xl" />
          </div>
        </div>
      )}

    </div>
  );
}
