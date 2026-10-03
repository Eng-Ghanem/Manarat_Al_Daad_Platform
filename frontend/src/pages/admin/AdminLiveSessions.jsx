import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Video, Calendar, Clock, Plus, Trash2, Edit, X, ArrowRight,
  Link as LinkIcon, BookOpen, AlertCircle, Loader, Users, CheckCircle, 
  XCircle, Clock4, Filter, CreditCard, Sparkles, UserCheck, ShieldAlert,
  CalendarDays, RefreshCw, MinusCircle, PlusCircle, CheckCircle2, Eye, UserX,
  Search, Check
} from 'lucide-react';
import { Link } from 'react-router-dom';
import FadeIn from '../../components/FadeIn';
import { supabase } from '../../lib/supabase';
import ConfirmModal from '../../components/ConfirmModal';
import toast from 'react-hot-toast';
import { formatSessionTitle, formatSessionDesc, formatGradeName, formatTime12h, formatTimeRange12h, GRADE_OPTIONS, getScheduledSessionInfo } from '../../utils/helpers';

// Helper for <input type="datetime-local" /> in local timezone
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

export default function AdminLiveSessions() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  
  // Main Top-level View Switcher
  const [mainView, setMainView] = useState(() => {
    if (typeof window !== 'undefined') {
      const tab = new URLSearchParams(window.location.search).get('tab');
      if (tab === 'completed' || tab === 'history') return 'completed';
      if (tab === 'packages') return 'packages';
      if (tab === 'trials') return 'trials';
    }
    return 'sessions';
  }); // 'sessions' | 'packages' | 'completed' | 'trials'
  const [sessionsSubTab, setSessionsSubTab] = useState('live_list'); // 'live_list' | 'schedules'

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
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);

  // 8-Session Packages State
  const [packages, setPackages] = useState([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [packageSearch, setPackageSearch] = useState('');
  const [packageGradeFilter, setPackageGradeFilter] = useState('all');
  const [packageStatusFilter, setPackageStatusFilter] = useState('all'); // 'all' | 'active' | 'pending' | 'expired' | 'not_subscribed'
  const [bulkAttendanceGrade, setBulkAttendanceGrade] = useState('');
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState(null);
  const [packageSubTab, setPackageSubTab] = useState('packages'); // 'packages' | 'history'

  // Completed Live Sessions History State & Filters
  const [completedSessions, setCompletedSessions] = useState([]);
  const [completedLoading, setCompletedLoading] = useState(false);
  const [completedSearch, setCompletedSearch] = useState('');
  const [historyGradeFilter, setHistoryGradeFilter] = useState('all');
  const [historyStudentFilter, setHistoryStudentFilter] = useState('all');
  const [historyMonthFilter, setHistoryMonthFilter] = useState('all');
  const [deleteCompletedModal, setDeleteCompletedModal] = useState({ isOpen: false, id: null });
  const [historyViewMode, setHistoryViewMode] = useState('cards'); // 'cards' | 'table'

  // Dynamic list of students for History filtering
  // Dynamic list of students for History filtering (All registered platform students)
  const historyStudentsList = useMemo(() => {
    const map = new Map();
    // 1. Add all registered students from packages first (contains all profiles where role = 'student')
    packages.forEach(p => {
      if (p.user_id) {
        map.set(p.user_id, {
          id: p.user_id,
          name: p.full_name || 'طالب',
          grade: p.grade_level
        });
      }
    });
    // 2. Add any completed sessions students if they are not already mapped
    completedSessions.forEach(cs => {
      const existing = Array.from(map.values()).find(
        s => (cs.student_id && s.id === cs.student_id) || 
             (cs.student_name && s.name.trim().toLowerCase() === cs.student_name.trim().toLowerCase())
      );
      if (!existing) {
        const key = cs.student_id || cs.student_name;
        if (key) {
          map.set(key, {
            id: key,
            name: cs.student_name || 'طالب',
            grade: cs.grade_level
          });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
  }, [completedSessions, packages]);

  // Dynamic list of months (YYYY-MM) for History filtering
  const historyMonthsList = useMemo(() => {
    const set = new Set();
    const now = new Date();
    const curYear = now.getFullYear();

    // Include all 12 months for current year
    for (let m = 1; m <= 12; m++) {
      set.add(`${curYear}-${String(m).padStart(2, '0')}`);
    }

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
        year: y,
        label: `شهر ${mNum} (${name} ${y})`
      };
    });
  }, [completedSessions]);

  // Filtered completed sessions based on search, grade, student, and month
  const filteredCompletedSessions = useMemo(() => {
    return completedSessions.filter(cs => {
      // 1. Text Search
      if (completedSearch.trim()) {
        const q = completedSearch.toLowerCase();
        const match = (
          (cs.student_name || '') + ' ' +
          (cs.session_title || '') + ' ' +
          (cs.teacher_notes || '') + ' ' +
          (formatGradeName(cs.grade_level) || '')
        ).toLowerCase().includes(q);
        if (!match) return false;
      }

      // 2. Grade Filter
      if (historyGradeFilter !== 'all') {
        if (cs.grade_level !== historyGradeFilter) return false;
      }

      // 3. Student Filter (matches student_id, student_name, or matching student profile name)
      if (historyStudentFilter !== 'all') {
        const selStudent = historyStudentsList.find(s => s.id === historyStudentFilter);
        const selName = selStudent ? selStudent.name : null;
        const matches = (cs.student_id === historyStudentFilter) || 
                        (cs.student_name === historyStudentFilter) ||
                        (selName && cs.student_name && cs.student_name.trim().toLowerCase() === selName.trim().toLowerCase());
        if (!matches) return false;
      }

      // 4. Month Filter
      if (historyMonthFilter !== 'all') {
        const d = cs.completed_at || cs.created_at;
        if (!d) return false;
        try {
          const ym = new Date(d).toISOString().slice(0, 7);
          if (ym !== historyMonthFilter) return false;
        } catch (_) {
          return false;
        }
      }

      return true;
    });
  }, [completedSessions, completedSearch, historyGradeFilter, historyStudentFilter, historyMonthFilter, historyStudentsList]);

  // Selected student object for active summary
  const selectedHistoryStudent = useMemo(() => {
    if (historyStudentFilter === 'all') return null;
    return historyStudentsList.find(s => s.id === historyStudentFilter);
  }, [historyStudentFilter, historyStudentsList]);

  // Deduct & Bulk Attendance Modals
  const [deductModal, setDeductModal] = useState({
    isOpen: false,
    pkg: null,
    sessionTitle: '',
    teacherNotes: '',
    completedAt: '',
    submitting: false
  });
  const [bulkDeductModal, setBulkDeductModal] = useState({
    isOpen: false,
    gradeLevel: '',
    sessionTitle: '',
    teacherNotes: '',
    completedAt: '',
    submitting: false
  });
  const [editCompletedModal, setEditCompletedModal] = useState({
    isOpen: false,
    id: null,
    studentName: '',
    gradeLevel: '',
    sessionTitle: '',
    teacherNotes: '',
    completedAt: '',
    submitting: false
  });

  // Trial Sessions State
  const [trialSessions, setTrialSessions] = useState([]);
  const [trialRequests, setTrialRequests] = useState([]);
  const [trialLoading, setTrialLoading] = useState(false);
  const [trialSubmitting, setTrialSubmitting] = useState(false);
  const [isTrialModalOpen, setIsTrialModalOpen] = useState(false);
  const [isEditingTrial, setIsEditingTrial] = useState(false);
  const [currentTrialId, setCurrentTrialId] = useState(null);
  const [deleteTrialModal, setDeleteTrialModal] = useState({ isOpen: false, id: null, title: '' });
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
    fetchCompletedSessions();
    fetchTrialData();

    // Read URL query parameters (e.g. ?tab=completed or ?student=...)
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'completed' || tabParam === 'history') {
        setMainView('completed');
      } else if (tabParam === 'packages') {
        setMainView('packages');
      } else if (tabParam === 'trials') {
        setMainView('trials');
      }

      const studentParam = params.get('student');
      if (studentParam) {
        setHistoryStudentFilter(studentParam);
      }
      const gradeParam = params.get('grade');
      if (gradeParam) {
        setHistoryGradeFilter(gradeParam);
      }
    } catch (_) {}
  }, []);

  // Real-time synchronization for Admin across packages, completed sessions, and trial requests
  useEffect(() => {
    const channel = supabase
      .channel('admin_live_management_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_subscriptions' }, () => {
        fetchPackages();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'completed_live_sessions' }, () => {
        fetchCompletedSessions();
        fetchPackages();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trial_requests' }, () => {
        fetchTrialData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

      if (!error && data && data.length > 0) {
        const mapped = data.map(s => {
          let extra = {};
          if (s.notes && s.notes.startsWith('{') && s.notes.endsWith('}')) {
            try {
              const p = JSON.parse(s.notes);
              extra = {
                notes: p.custom_notes !== undefined ? p.custom_notes : s.notes,
                target_type: p.target_type || s.target_type || 'grade',
                target_student_id: p.target_student_id || s.target_student_id || null,
                target_student_name: p.target_student_name || s.target_student_name || null
              };
            } catch (_) {}
          }
          return { ...s, ...extra };
        });
        setWeeklySchedules(mapped);
        localStorage.setItem('manarat_weekly_schedules', JSON.stringify(mapped));
      } else {
        // Fallback to local storage if DB empty or errored
        const local = localStorage.getItem('manarat_weekly_schedules');
        if (local) {
          try {
            const parsed = JSON.parse(local);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setWeeklySchedules(parsed);
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      console.warn('weekly_schedules fetch warning:', err);
      const local = localStorage.getItem('manarat_weekly_schedules');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) setWeeklySchedules(parsed);
        } catch (_) {}
      }
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
        const hasSub = Boolean(sub);
        let status = 'not_subscribed';
        let remaining_sessions = 0;
        let total_sessions = 8;

        if (hasSub) {
          status = sub.status || 'not_subscribed';
          total_sessions = sub.total_sessions || 8;
          remaining_sessions = sub.remaining_sessions !== undefined ? sub.remaining_sessions : 0;
          if (status === 'active' && remaining_sessions <= 0) {
            status = 'expired';
          }
        }

        return {
          id: sub?.id || student.id,
          user_id: student.id,
          sub_id: sub?.id,
          full_name: student.full_name || 'طالب',
          email: student.email,
          phone_number: student.phone_number || '-',
          grade_level: student.grade_level || 'prep_1',
          total_sessions,
          remaining_sessions,
          status,
          payment_method: sub?.payment_method || null,
          wallet_number: sub?.wallet_number || null,
          receipt_url: sub?.receipt_url || null,
          notes: sub?.notes || null,
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

  // 4. Fetch Completed Live Sessions directly from Supabase
  const fetchCompletedSessions = async () => {
    setCompletedLoading(true);
    try {
      const { data, error } = await supabase
        .from('completed_live_sessions')
        .select('*')
        .order('completed_at', { ascending: false });

      if (error) {
        console.error('Error fetching completed sessions from Supabase:', error);
      } else if (data) {
        setCompletedSessions(data);
      }
    } catch (err) {
      console.warn('Completed sessions fetch warning:', err);
    } finally {
      setCompletedLoading(false);
    }
  };

  // 5. Fetch Trial Sessions & Requests
  const fetchTrialData = async () => {
    setTrialLoading(true);
    try {
      const { data: tSessions } = await supabase
        .from('trial_sessions')
        .select('*')
        .order('start_time', { ascending: true });

      if (tSessions) {
        const seen = new Set();
        const unique = [];
        for (const s of tSessions) {
          if (!seen.has(s.id)) {
            seen.add(s.id);
            unique.push(s);
          }
        }
        setTrialSessions(unique);
      }

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
      let customNotes = schedule.notes || '';
      let targetType = schedule.target_type || 'grade';
      let targetStudentId = schedule.target_student_id || '';
      let targetStudentName = schedule.target_student_name || '';

      if (schedule.notes && schedule.notes.startsWith('{') && schedule.notes.endsWith('}')) {
        try {
          const p = JSON.parse(schedule.notes);
          if (p.custom_notes !== undefined) customNotes = p.custom_notes;
          if (p.target_type) targetType = p.target_type;
          if (p.target_student_id) targetStudentId = p.target_student_id;
          if (p.target_student_name) targetStudentName = p.target_student_name;
        } catch (_) {}
      }

      setScheduleForm({
        title: schedule.title || 'الحصة الأسبوعية الثابتة',
        target_type: targetType,
        grade_level: schedule.grade_level || 'prep_1',
        target_student_id: targetStudentId,
        target_student_name: targetStudentName,
        days: schedule.days || ['السبت', 'الأربعاء'],
        start_time: schedule.start_time || '13:00',
        end_time: schedule.end_time || '14:00',
        zoom_link: schedule.zoom_link || '',
        notes: customNotes,
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

    setScheduleSubmitting(true);

    const metaNotes = JSON.stringify({
      custom_notes: scheduleForm.notes?.trim() || '',
      target_type: scheduleForm.target_type,
      target_student_id: scheduleForm.target_type === 'student' ? scheduleForm.target_student_id : null,
      target_student_name: scheduleForm.target_type === 'student' ? scheduleForm.target_student_name : null,
    });

    const safePayload = {
      title: scheduleForm.title.trim(),
      grade_level: scheduleForm.grade_level,
      days: scheduleForm.days,
      start_time: scheduleForm.start_time,
      end_time: scheduleForm.end_time,
      zoom_link: getCleanZoomUrl(scheduleForm.zoom_link),
      is_active: scheduleForm.is_active,
      notes: metaNotes
    };

    const fullPayload = {
      ...safePayload,
      target_type: scheduleForm.target_type,
      target_student_id: scheduleForm.target_type === 'student' ? scheduleForm.target_student_id : null,
      target_student_name: scheduleForm.target_type === 'student' ? scheduleForm.target_student_name : null,
    };

    const clientItem = {
      title: scheduleForm.title.trim(),
      grade_level: scheduleForm.grade_level,
      days: scheduleForm.days,
      start_time: scheduleForm.start_time,
      end_time: scheduleForm.end_time,
      zoom_link: getCleanZoomUrl(scheduleForm.zoom_link),
      is_active: scheduleForm.is_active,
      notes: scheduleForm.notes?.trim() || '',
      target_type: scheduleForm.target_type,
      target_student_id: scheduleForm.target_type === 'student' ? scheduleForm.target_student_id : null,
      target_student_name: scheduleForm.target_type === 'student' ? scheduleForm.target_student_name : null,
    };

    try {
      let finalId = currentScheduleId;
      const isUUID = currentScheduleId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentScheduleId);

      if (isEditingSchedule) {
        if (isUUID) {
          let { error } = await supabase.from('weekly_schedules').update(fullPayload).eq('id', currentScheduleId);
          if (error) {
            await supabase.from('weekly_schedules').update(safePayload).eq('id', currentScheduleId);
          }
        } else {
          // If non-UUID ID, insert into DB
          let { data, error } = await supabase.from('weekly_schedules').insert([fullPayload]).select().single();
          if (error) {
            const res = await supabase.from('weekly_schedules').insert([safePayload]).select().single();
            data = res.data;
          }
          if (data?.id) finalId = data.id;
        }

        const updated = weeklySchedules.map(s => s.id === currentScheduleId ? { ...s, ...clientItem, id: finalId } : s);
        setWeeklySchedules(updated);
        localStorage.setItem('manarat_weekly_schedules', JSON.stringify(updated));
      } else {
        let newId = Date.now().toString();
        let { data, error } = await supabase.from('weekly_schedules').insert([fullPayload]).select().single();
        if (error) {
          const res = await supabase.from('weekly_schedules').insert([safePayload]).select().single();
          data = res.data;
        }
        if (data?.id) newId = data.id;

        const updated = [...weeklySchedules, { ...clientItem, id: newId }];
        setWeeklySchedules(updated);
        localStorage.setItem('manarat_weekly_schedules', JSON.stringify(updated));
      }

      toast.success(isEditingSchedule ? 'تم تحديث الموعد الأسبوعي بنجاح' : 'تم حفظ الموعد الأسبوعي بنجاح');
      setIsScheduleModalOpen(false);
    } catch (err) {
      console.warn('Save schedule exception:', err);
      const fallbackId = currentScheduleId || Date.now().toString();
      const updated = isEditingSchedule
        ? weeklySchedules.map(s => s.id === currentScheduleId ? { ...s, ...clientItem } : s)
        : [...weeklySchedules, { ...clientItem, id: fallbackId }];
      setWeeklySchedules(updated);
      localStorage.setItem('manarat_weekly_schedules', JSON.stringify(updated));
      toast.success('تم حفظ الموعد الأسبوعي بنجاح');
      setIsScheduleModalOpen(false);
    } finally {
      setScheduleSubmitting(false);
    }
  };

  const handleDeleteSchedule = async () => {
    const id = deleteScheduleModal.id;
    setDeleteScheduleModal({ isOpen: false, id: null });
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      try {
        await supabase.from('weekly_schedules').delete().eq('id', id);
      } catch (_) {}
    }
    const updated = weeklySchedules.filter(s => s.id !== id);
    setWeeklySchedules(updated);
    localStorage.setItem('manarat_weekly_schedules', JSON.stringify(updated));
    toast.success('تم حذف الموعد الأسبوعي بنجاح');
  };

  // ==================== 8-Session Packages Handlers ====================
  const handleOpenDeductModal = (pkg) => {
    const schedInfo = getScheduledSessionInfo(pkg.grade_level, pkg.user_id, weeklySchedules);
    setDeductModal({
      isOpen: true,
      pkg,
      sessionTitle: schedInfo.title,
      teacherNotes: schedInfo.notes,
      completedAt: toLocalDatetimeStr(new Date()),
      submitting: false
    });
  };

  const handleConfirmDeduct = async () => {
    if (!deductModal.pkg) return;
    const pkg = deductModal.pkg;
    const newRemaining = Math.max(0, pkg.remaining_sessions - 1);
    const newStatus = newRemaining === 0 ? 'expired' : 'active';
    
    // Automatically determine scheduled title, notes, and day/start time
    const schedInfo = getScheduledSessionInfo(
      pkg.grade_level,
      pkg.user_id,
      weeklySchedules,
      deductModal.sessionTitle,
      deductModal.teacherNotes
    );
    const sTitle = schedInfo.title;
    const tNotes = schedInfo.notes;
    // Real-time moment of submission or user-chosen time
    const completedAt = deductModal.completedAt 
      ? new Date(deductModal.completedAt).toISOString() 
      : new Date().toISOString();

    setDeductModal(prev => ({ ...prev, submitting: true }));

    // Optimistic UI update
    setPackages(prev => prev.map(p => p.id === pkg.id ? { 
      ...p, 
      remaining_sessions: newRemaining,
      status: newStatus 
    } : p));

    try {
      // 1. Direct Supabase update or upsert for live_subscriptions
      if (pkg.sub_id) {
        await supabase
          .from('live_subscriptions')
          .update({ remaining_sessions: newRemaining, status: newStatus })
          .eq('id', pkg.sub_id);
      } else {
        const { data: existSub } = await supabase
          .from('live_subscriptions')
          .select('id')
          .eq('user_id', pkg.user_id)
          .maybeSingle();

        if (existSub) {
          await supabase
            .from('live_subscriptions')
            .update({
              grade_level: pkg.grade_level,
              total_sessions: 8,
              remaining_sessions: newRemaining,
              status: newStatus
            })
            .eq('id', existSub.id);
        } else {
          await supabase
            .from('live_subscriptions')
            .insert([{
              user_id: pkg.user_id,
              grade_level: pkg.grade_level,
              total_sessions: 8,
              remaining_sessions: newRemaining,
              status: newStatus
            }]);
        }
      }

      // 2. Direct Supabase insert for completed_live_sessions with scheduled day and time
      try {
        await supabase.from('completed_live_sessions').insert([{
          student_id: pkg.user_id,
          student_name: pkg.full_name,
          grade_level: pkg.grade_level,
          session_title: sTitle,
          session_type: 'package',
          completed_at: completedAt,
          teacher_notes: tNotes
        }]);
      } catch (tableErr) {
        console.warn('completed_live_sessions notice:', tableErr);
      }

      toast.success(`✅ تم تسجيل الحضور وخصم حصة بنجاح! (${sTitle}) - المتبقي: ${newRemaining}`);
      setDeductModal({ isOpen: false, pkg: null, sessionTitle: '', teacherNotes: '', completedAt: '', submitting: false });
      fetchPackages();
      fetchCompletedSessions();
    } catch (err) {
      console.warn('Deduct session error:', err);
      toast.error('حدث خطأ أثناء خصم الحصة');
      setDeductModal(prev => ({ ...prev, submitting: false }));
    }
  };

  const handleUpdatePackageSessions = async (pkg, delta) => {
    const newRemaining = Math.max(0, pkg.remaining_sessions + delta);
    const newStatus = newRemaining === 0 ? 'expired' : 'active';

    setPackages(prev => prev.map(p => p.id === pkg.id ? { 
      ...p, 
      remaining_sessions: newRemaining,
      status: newStatus 
    } : p));

    try {
      if (pkg.sub_id) {
        await supabase
          .from('live_subscriptions')
          .update({ remaining_sessions: newRemaining, status: newStatus })
          .eq('id', pkg.sub_id);
      } else {
        const { data: existSub } = await supabase
          .from('live_subscriptions')
          .select('id')
          .eq('user_id', pkg.user_id)
          .maybeSingle();

        if (existSub) {
          await supabase
            .from('live_subscriptions')
            .update({
              grade_level: pkg.grade_level,
              total_sessions: 8,
              remaining_sessions: newRemaining,
              status: newStatus
            })
            .eq('id', existSub.id);
        } else {
          await supabase
            .from('live_subscriptions')
            .insert([{
              user_id: pkg.user_id,
              grade_level: pkg.grade_level,
              total_sessions: 8,
              remaining_sessions: newRemaining,
              status: newStatus
            }]);
        }
      }

      if (delta < 0) {
        const schedInfo = getScheduledSessionInfo(
          pkg.grade_level,
          pkg.user_id,
          weeklySchedules
        );

        try {
          await supabase.from('completed_live_sessions').insert([{
            student_id: pkg.user_id,
            student_name: pkg.full_name,
            grade_level: pkg.grade_level,
            session_title: schedInfo.title,
            session_type: 'package',
            completed_at: new Date().toISOString(),
            teacher_notes: schedInfo.notes
          }]);
        } catch (tableErr) {
          console.warn('completed_live_sessions notice:', tableErr);
        }
      }

      toast.success(
        delta < 0 
          ? `✅ تم خصم حصة وتسجيل الحضور (المتبقي: ${newRemaining})` 
          : `تم تحديث الرصيد بنجاح (المتبقي: ${newRemaining})`
      );
      fetchPackages();
      fetchCompletedSessions();
    } catch (err) {
      console.warn('Update package sessions error:', err);
      toast.error('حدث خطأ أثناء تحديث الرصيد');
    }
  };

  const handleRenewPackage = async (pkg) => {
    setPackages(prev => prev.map(p => p.id === pkg.id ? { 
      ...p, 
      remaining_sessions: 8,
      total_sessions: 8,
      status: 'active' 
    } : p));

    try {
      if (pkg.sub_id) {
        await supabase
          .from('live_subscriptions')
          .update({
            remaining_sessions: 8,
            total_sessions: 8,
            status: 'active',
            activated_at: new Date().toISOString()
          })
          .eq('id', pkg.sub_id);
      } else {
        const { data: existSub } = await supabase
          .from('live_subscriptions')
          .select('id')
          .eq('user_id', pkg.user_id)
          .maybeSingle();

        if (existSub) {
          await supabase
            .from('live_subscriptions')
            .update({
              grade_level: pkg.grade_level,
              total_sessions: 8,
              remaining_sessions: 8,
              status: 'active',
              activated_at: new Date().toISOString()
            })
            .eq('id', existSub.id);
        } else {
          await supabase
            .from('live_subscriptions')
            .insert([{
              user_id: pkg.user_id,
              grade_level: pkg.grade_level,
              total_sessions: 8,
              remaining_sessions: 8,
              status: 'active',
              activated_at: new Date().toISOString()
            }]);
        }
      }

      toast.success(
        pkg.status === 'pending'
          ? `🎉 تم قبول التحويل وتفعيل باقة 8 حصص للطالب ${pkg.full_name} بنجاح!`
          : `🎉 تم تفعيل/تجديد باقة 8 حصص للطالب ${pkg.full_name} بنجاح!`
      );
      fetchPackages();
    } catch (err) {
      console.warn('Renew package error:', err);
      toast.error('حدث خطأ أثناء تجديد الباقة');
    }
  };

  const handleOpenBulkDeductModal = () => {
    if (!bulkAttendanceGrade) {
      toast.error('يرجى اختيار الصف الدراسي أولاً لتسجيل الحضور');
      return;
    }
    const eligible = packages.filter(p => p.grade_level === bulkAttendanceGrade && p.status === 'active' && p.remaining_sessions > 0);
    if (eligible.length === 0) {
      toast.error('لا يوجد طلاب لديهم باقة نشطة ورصيد متبقٍ في هذا الصف');
      return;
    }

    const schedInfo = getScheduledSessionInfo(bulkAttendanceGrade, null, weeklySchedules);
    setBulkDeductModal({
      isOpen: true,
      gradeLevel: bulkAttendanceGrade,
      sessionTitle: schedInfo.title,
      teacherNotes: schedInfo.notes,
      completedAt: toLocalDatetimeStr(new Date()),
      submitting: false
    });
  };

  const handleConfirmBulkDeduct = async () => {
    const grade = bulkDeductModal.gradeLevel;
    const schedInfo = getScheduledSessionInfo(
      grade,
      null,
      weeklySchedules,
      bulkDeductModal.sessionTitle,
      bulkDeductModal.teacherNotes
    );
    const sTitle = schedInfo.title;
    const tNotes = schedInfo.notes;
    // Real-time moment of submission or user-chosen time
    const completedAt = bulkDeductModal.completedAt 
      ? new Date(bulkDeductModal.completedAt).toISOString() 
      : new Date().toISOString();

    const eligible = packages.filter(p => p.grade_level === grade && p.status === 'active' && p.remaining_sessions > 0);
    if (eligible.length === 0) {
      toast.error('لا يوجد طلاب لديهم باقة نشطة ورصيد متبقٍ في هذا الصف');
      return;
    }

    setBulkDeductModal(prev => ({ ...prev, submitting: true }));

    setPackages(prev => prev.map(p => {
      if (p.grade_level === grade && p.status === 'active' && p.remaining_sessions > 0) {
        const nextRem = p.remaining_sessions - 1;
        return { ...p, remaining_sessions: nextRem, status: nextRem === 0 ? 'expired' : 'active' };
      }
      return p;
    }));

    try {
      for (const p of eligible) {
        const nextRem = p.remaining_sessions - 1;
        const nextStat = nextRem === 0 ? 'expired' : 'active';

        const { data: existSub } = await supabase
          .from('live_subscriptions')
          .select('id')
          .eq('user_id', p.user_id)
          .maybeSingle();

        if (existSub) {
          await supabase
            .from('live_subscriptions')
            .update({
              grade_level: p.grade_level,
              total_sessions: 8,
              remaining_sessions: nextRem,
              status: nextStat
            })
            .eq('id', existSub.id);
        } else {
          await supabase
            .from('live_subscriptions')
            .insert([{
              user_id: p.user_id,
              grade_level: p.grade_level,
              total_sessions: 8,
              remaining_sessions: nextRem,
              status: nextStat
            }]);
        }

        try {
          await supabase.from('completed_live_sessions').insert([{
            student_id: p.user_id,
            student_name: p.full_name,
            grade_level: p.grade_level,
            session_title: sTitle,
            session_type: 'package',
            completed_at: completedAt,
            teacher_notes: tNotes
          }]);
        } catch (tableErr) {
          console.warn('completed_live_sessions notice:', tableErr);
        }
      }

      toast.success(`✅ تم تسجيل حضور ${eligible.length} طالب وخصم حصة واحدة لكل منهم (${sTitle})`);
      setBulkDeductModal({ isOpen: false, gradeLevel: '', sessionTitle: '', teacherNotes: '', completedAt: '', submitting: false });
      fetchPackages();
      fetchCompletedSessions();
    } catch (err) {
      console.warn('Bulk attendance error:', err);
      toast.error('حدث خطأ أثناء تسجيل الحضور الجماعي');
      setBulkDeductModal(prev => ({ ...prev, submitting: false }));
    }
  };

  const handleDeleteCompletedSession = async () => {
    const id = deleteCompletedModal.id;
    setDeleteCompletedModal({ isOpen: false, id: null });
    try {
      const { error } = await supabase.from('completed_live_sessions').delete().eq('id', id);
      if (error) {
        console.error('Error deleting completed session:', error);
        throw error;
      }
      setCompletedSessions(prev => prev.filter(c => c.id !== id));
      toast.success('تم حذف سجل الحصة المكتملة بنجاح');
    } catch (err) {
      console.warn('Delete completed session error:', err);
      toast.error('فشل حذف سجل الحصة');
    }
  };

  // Handlers for Editing Existing Completed Sessions
  const handleOpenEditCompleted = (item) => {
    setEditCompletedModal({
      isOpen: true,
      id: item.id,
      studentName: item.student_name || 'الطالب',
      gradeLevel: item.grade_level || '',
      sessionTitle: item.session_title || '',
      teacherNotes: item.teacher_notes || '',
      completedAt: toLocalDatetimeStr(item.completed_at || item.created_at || new Date()),
      submitting: false
    });
  };

  const handleSaveEditCompleted = async (e) => {
    if (e) e.preventDefault();
    if (!editCompletedModal.id) return;
    setEditCompletedModal(prev => ({ ...prev, submitting: true }));

    try {
      const updatedDateIso = editCompletedModal.completedAt
        ? new Date(editCompletedModal.completedAt).toISOString()
        : new Date().toISOString();

      const { error } = await supabase
        .from('completed_live_sessions')
        .update({
          session_title: editCompletedModal.sessionTitle.trim(),
          teacher_notes: editCompletedModal.teacherNotes.trim(),
          completed_at: updatedDateIso
        })
        .eq('id', editCompletedModal.id);

      if (error) {
        console.error('Error updating completed session:', error);
        throw error;
      }

      setCompletedSessions(prev => prev.map(item => 
        item.id === editCompletedModal.id
          ? {
              ...item,
              session_title: editCompletedModal.sessionTitle.trim(),
              teacher_notes: editCompletedModal.teacherNotes.trim(),
              completed_at: updatedDateIso
            }
          : item
      ));

      toast.success('✅ تم تعديل بيانات وتوقيت الحصة بنجاح!');
      setEditCompletedModal({
        isOpen: false,
        id: null,
        studentName: '',
        gradeLevel: '',
        sessionTitle: '',
        teacherNotes: '',
        completedAt: '',
        submitting: false
      });
      fetchCompletedSessions();
    } catch (err) {
      console.warn('Update completed session error:', err);
      toast.error('حدث خطأ أثناء تعديل الحصة');
      setEditCompletedModal(prev => ({ ...prev, submitting: false }));
    }
  };

  // ==================== Trial Sessions Handlers ====================

  const handleOpenTrialModal = (session = null) => {
    if (session) {
      setTrialForm({
        title: session.title || 'حصة تجريبية مجانية (30 دقيقة)',
        description: session.description || '',
        target_type: session.target_type || 'grade',
        grade_level: session.grade_level || 'prep_1',
        target_student_ids: session.target_student_ids || [],
        target_student_names: session.target_student_names || [],
        start_time: toLocalDatetimeStr(session.start_time),
        duration_minutes: session.duration_minutes || 30,
        zoom_link: session.zoom_link || ''
      });
      setIsEditingTrial(true);
      setCurrentTrialId(session.id);
    } else {
      setTrialForm({
        title: 'حصة تجريبية مجانية (30 دقيقة)',
        description: 'حصة تعريفية لشرح المنهج وأسلوب التدريس وطريقة استخدام المنصة',
        target_type: 'grade',
        grade_level: 'prep_1',
        target_student_ids: [],
        target_student_names: [],
        start_time: '',
        duration_minutes: 30,
        zoom_link: ''
      });
      setIsEditingTrial(false);
      setCurrentTrialId(null);
    }
    setTrialStudentSearch('');
    setIsTrialModalOpen(true);
  };

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

    setTrialSubmitting(true);

    const payload = {
      title: trialForm.title.trim(),
      description: trialForm.description?.trim() || '',
      grade_level: trialForm.target_type === 'grade' ? trialForm.grade_level : 'custom',
      target_type: trialForm.target_type,
      target_student_ids: trialForm.target_type === 'specific_students' ? trialForm.target_student_ids : [],
      target_student_names: trialForm.target_type === 'specific_students' ? trialForm.target_student_names : [],
      start_time: new Date(trialForm.start_time).toISOString(),
      duration_minutes: Number(trialForm.duration_minutes) || 30,
      zoom_link: getCleanZoomUrl(trialForm.zoom_link),
      status: 'scheduled'
    };

    try {
      if (isEditingTrial && currentTrialId) {
        const { error } = await supabase
          .from('trial_sessions')
          .update(payload)
          .eq('id', currentTrialId);
        if (error) throw error;
        toast.success('تم تحديث بيانات الحصة التجريبية بنجاح');
      } else {
        const { data, error } = await supabase.from('trial_sessions').insert([payload]).select().single();
        if (error) throw error;
        const newObj = data || { id: Date.now().toString(), ...payload };

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
        }

        toast.success('تمت جدولة الحصة التجريبية بنجاح');
      }

      setIsTrialModalOpen(false);
      await fetchTrialData();
    } catch (err) {
      console.warn('Save trial session fallback:', err);
      toast.error('حدث خطأ أثناء حفظ الحصة التجريبية');
    } finally {
      setTrialSubmitting(false);
    }
  };

  const handleDeleteTrialSession = async () => {
    const id = deleteTrialModal.id;
    setDeleteTrialModal({ isOpen: false, id: null, title: '' });
    try {
      await supabase.from('trial_sessions').delete().eq('id', id);
      await supabase.from('trial_requests').delete().eq('trial_session_id', id);
    } catch (err) {
      console.warn('Delete trial session error:', err);
    }
    setTrialSessions(prev => prev.filter(t => t.id !== id));
    toast.success('تم حذف الحصة التجريبية بنجاح');
  };

  // 1. Approve student (سيكمل معنا): notify student to subscribe to 8-session package WITHOUT granting free sessions
  const handleApproveTrialStudent = async (req) => {
    try {
      await supabase.from('trial_requests').update({ status: 'enrolled' }).eq('id', req.id);

      // Find user_id if missing on the record
      let targetUserId = req.user_id;
      if (!targetUserId && req.student_phone) {
        const match = packages.find(p => p.phone_number === req.student_phone || p.phone === req.student_phone);
        if (match) targetUserId = match.user_id || match.id;
      }
      if (!targetUserId && req.student_name) {
        const match = packages.find(p => p.full_name === req.student_name);
        if (match) targetUserId = match.user_id || match.id;
      }

      // Send in-app notification to student
      if (targetUserId) {
        await supabase.from('notifications').insert([{
          user_id: targetUserId,
          title: 'تهانينا! تم تأكيد استمرارك في الحصص المباشرة 🎉',
          message: 'أكّد المعلم أ/ سيد غريب تأهلك للاستمرار معنا بعد الحصة التجريبية. يُرجى الآن التوجه للاشتراك وسداد باقة الـ 8 حصص لبدء جدول حصصك الأسبوعية.',
          type: 'trial_approved',
          link: '/live-sessions'
        }]);
      }

      setTrialRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'enrolled' } : r));
      toast.success('🎉 تم تأكيد استمرار الطالب وإرسال إشعار له في حسابه للاشتراك وسداد الباقة');
      fetchTrialData();
    } catch (err) {
      console.warn('Approve trial error:', err);
      toast.error('حدث خطأ أثناء تأكيد استمرار الطالب');
    }
  };

  // 2. Reject student (لن يكمل): update status and send polite notification
  const handleRejectTrialStudent = async (req) => {
    try {
      await supabase.from('trial_requests').update({ status: 'rejected' }).eq('id', req.id);

      // Find user_id if missing on the record
      let targetUserId = req.user_id;
      if (!targetUserId && req.student_phone) {
        const match = packages.find(p => p.phone_number === req.student_phone || p.phone === req.student_phone);
        if (match) targetUserId = match.user_id || match.id;
      }
      if (!targetUserId && req.student_name) {
        const match = packages.find(p => p.full_name === req.student_name);
        if (match) targetUserId = match.user_id || match.id;
      }

      // Send polite in-app notification to student
      if (targetUserId) {
        await supabase.from('notifications').insert([{
          user_id: targetUserId,
          title: 'بخصوص الحصة التجريبية',
          message: 'شكراً لحضورك الحصة التجريبية. تم تأكيد عدم الاستمرار في باقة الحصص المباشرة بناءً على التقييم. نسعد بوجودك معنا دائماً في الكورسات المسجلة ونتمنى لك دوام التوفيق والنجاح!',
          type: 'trial_rejected',
          link: '/live-sessions'
        }]);
      }

      setTrialRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'rejected' } : r));
      toast.success('تم تسجيل عدم استمرار الطالب وإرسال إشعار له بنجاح');
      fetchTrialData();
    } catch (err) {
      console.warn('Reject trial error:', err);
      toast.error('حدث خطأ أثناء التحديث');
    }
  };

  const handleConfirmRemoveTrialStudent = async () => {
    const id = removeStudentModal.requestId;
    setRemoveStudentModal({ isOpen: false, requestId: null, studentName: '' });

    try {
      await supabase.from('trial_requests').delete().eq('id', id);
      setTrialRequests(prev => prev.filter(r => r.id !== id));
      toast.success('تم حذف سجل الطالب من الحصة التجريبية بنجاح');
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
    const q = (packageSearch || '').toLowerCase().trim();
    const matchSearch = !q ||
      (p.full_name || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q) ||
      (p.phone_number || '').includes(q) ||
      (p.wallet_number || '').includes(q);
    if (!matchSearch) return false;
    if (packageGradeFilter !== 'all' && p.grade_level !== packageGradeFilter) return false;
    if (packageStatusFilter !== 'all' && p.status !== packageStatusFilter) return false;
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

          <Link to="/admin-dashboard/subscriptions" className="absolute top-0 left-0 hidden sm:flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/30 rounded-full transition-colors backdrop-blur-md font-bold text-xs">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            <span>إدارة الاشتراكات والمدفوعات</span>
            {packages.filter(p => p.status === 'pending').length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 animate-pulse">
                {packages.filter(p => p.status === 'pending').length} طلب جديد
              </span>
            )}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <button
              onClick={() => setMainView('sessions')}
              className={`flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl font-bold transition-all text-sm cursor-pointer ${
                mainView === 'sessions'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-black'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50'
              }`}
            >
              <CalendarDays className="w-5 h-5 shrink-0" />
              <span>الجدول الأسبوعي المقرر</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                mainView === 'sessions' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
              }`}>
                {weeklySchedules.length}
              </span>
            </button>

            <button
              onClick={() => setMainView('packages')}
              className={`flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl font-bold transition-all text-sm cursor-pointer ${
                mainView === 'packages'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20 font-black'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50'
              }`}
            >
              <Users className="w-5 h-5 shrink-0" />
              <span>رصيد باقات الـ 8 حصص</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                mainView === 'packages' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              }`}>
                {packages.length}
              </span>
            </button>

            <button
              onClick={() => setMainView('completed')}
              className={`flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl font-bold transition-all text-sm cursor-pointer ${
                mainView === 'completed'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20 font-black'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50'
              }`}
            >
              <BookOpen className="w-5 h-5 shrink-0" />
              <span>سجل الحصص المكتملة</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                mainView === 'completed' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
              }`}>
                {completedSessions.length}
              </span>
            </button>

            <button
              onClick={() => setMainView('trials')}
              className={`flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl font-bold transition-all text-sm cursor-pointer ${
                mainView === 'trials'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-500/20 font-black'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700/50'
              }`}
            >
              <Sparkles className="w-5 h-5 shrink-0" />
              <span>الحصص التجريبية (30 دقيقة)</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                mainView === 'trials' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
              }`}>
                {trialRequests.length}
              </span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* ========================================================================= */}
        {/* VIEW 1: SESSIONS & WEEKLY RECURRING SCHEDULE                             */}
        {/* ========================================================================= */}
        {mainView === 'sessions' && (
          <FadeIn>
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-slate-700 mb-8">
              
              {/* ----------------- RECURRING WEEKLY SCHEDULES ----------------- */}
                <div>
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
                      <button onClick={() => setActiveTab('all')} className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${activeTab === 'all' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm font-black' : 'text-gray-500'}`}>
                        جميع المراحل
                      </button>
                      <button onClick={() => setActiveTab('primary')} className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${activeTab === 'primary' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm font-black' : 'text-gray-500'}`}>
                        الابتدائية
                      </button>
                      <button onClick={() => setActiveTab('prep')} className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${activeTab === 'prep' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm font-black' : 'text-gray-500'}`}>
                        الإعدادية
                      </button>
                      <button onClick={() => setActiveTab('sec')} className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${activeTab === 'sec' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm font-black' : 'text-gray-500'}`}>
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
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-slate-700">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <CreditCard className="w-7 h-7 text-emerald-500" />
                    نظام باقات الحصص وسجل الحضور (8 حصص مقدماً)
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                    إدارة اشتراكات الطلاب، تسجيل حضور الحصص مع الملاحظات، ومتابعة سجل الحصص المكتملة المتزامن مع لوحة الطالب.
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
                    onClick={handleOpenBulkDeductModal}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm shrink-0 cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4" />
                    تسجيل حضور جماعي (-1)
                  </button>
                </div>
              </div>

              {/* Academic Attendance vs Financial Billing Notice Banner */}
              <div className="mb-6 p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 text-indigo-950 dark:text-indigo-200">
                  <CheckCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>
                    هذا القسم مخصص <strong>لمتابعة الحضور الأكاديمي وخصم الحصص</strong>. لمراجعة إيصالات التحويل، المحافظ، والاعتماد المالي:
                  </span>
                </div>
                <Link
                  to="/admin-dashboard/subscriptions"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-xs shrink-0"
                >
                  <span>إدارة الاشتراكات والمدفوعات</span>
                  <ArrowRight className="w-3.5 h-3.5 rtl:rotate-0 ltr:rotate-180" />
                </Link>
              </div>

              {/* Sub-tab Navigation */}
              <div className="flex items-center gap-2 mb-6 border-b border-gray-100 dark:border-slate-700 pb-3">
                <button
                  type="button"
                  className="px-5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>باقات واشتراكات الطلاب</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white/20">
                    {packages.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setMainView('completed')}
                  className="px-5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40"
                >
                  <BookOpen className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>فتح سجل الحصص المكتملة</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-200 text-purple-900 dark:bg-purple-900 dark:text-purple-200">
                    {completedSessions.length}
                  </span>
                </button>
              </div>

              {/* TAB 1: PACKAGES & SUBSCRIPTIONS */}
              {packageSubTab === 'packages' && (
                <div>
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
                      className="px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-sm font-bold text-gray-700 dark:text-gray-300 outline-none sm:w-56"
                    >
                      <option value="all">جميع الصفوف الدراسية</option>
                      <option value="prep_1">{formatGradeName('prep_1')}</option>
                      <option value="prep_2">{formatGradeName('prep_2')}</option>
                      <option value="prep_3">{formatGradeName('prep_3')}</option>
                      <option value="sec_1">{formatGradeName('sec_1')}</option>
                      <option value="sec_2">{formatGradeName('sec_2')}</option>
                      <option value="sec_3">{formatGradeName('sec_3')}</option>
                    </select>

                    <select
                      value={packageStatusFilter}
                      onChange={(e) => setPackageStatusFilter(e.target.value)}
                      className="px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-sm font-bold text-gray-700 dark:text-gray-300 outline-none sm:w-52"
                    >
                      <option value="all">جميع حالات الباقة</option>
                      <option value="active">باقات نشطة ✅</option>
                      <option value="pending">طلبات قيد المراجعة ⏳</option>
                      <option value="expired">باقات منتهية (0 حصص) ⚠️</option>
                      <option value="not_subscribed">طلاب غير مشتركين 🔒</option>
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
                            const isNotSubscribed = pkg.status === 'not_subscribed';
                            const isPending = pkg.status === 'pending';
                            const isExpired = pkg.status === 'expired' || (!isNotSubscribed && !isPending && pkg.remaining_sessions <= 0);
                            const remaining = pkg.remaining_sessions || 0;
                            const percent = isNotSubscribed ? 0 : Math.round((remaining / 8) * 100);

                            return (
                              <tr key={pkg.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-755 transition-colors">
                                <td className="py-4 px-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-black text-xs flex items-center justify-center shadow-sm shrink-0">
                                      {pkg.full_name?.charAt(0) || 'ط'}
                                    </div>
                                    <div>
                                      <div className="font-black text-gray-900 dark:text-white text-sm">{pkg.full_name}</div>
                                      <div className="text-[11px] text-gray-500 dark:text-gray-400 font-bold">{formatGradeName(pkg.grade_level)}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-4 px-4 font-bold text-gray-700 dark:text-gray-300">
                                  <span className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-slate-700/60 text-xs font-bold">
                                    {formatGradeName(pkg.grade_level)}
                                  </span>
                                </td>
                                <td className="py-4 px-4">
                                  <div className="w-48">
                                    <div className="flex justify-between text-xs font-black mb-1.5">
                                      {isNotSubscribed ? (
                                        <span className="text-gray-400 font-bold">غير مشترك (0 حصص)</span>
                                      ) : isPending ? (
                                        <span className="text-amber-600 dark:text-amber-400 font-bold">بانتظار الاعتماد المالي</span>
                                      ) : isExpired ? (
                                        <span className="text-red-500 font-bold">0 من 8 حصص متبقية</span>
                                      ) : (
                                        <span className={remaining <= 2 ? 'text-amber-500 font-bold' : 'text-emerald-600 dark:text-emerald-400 font-bold'}>
                                          {remaining} من 8 حصص متبقية
                                        </span>
                                      )}
                                      <span className="text-gray-400 font-mono text-[11px]">{percent}%</span>
                                    </div>
                                    <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
                                      <div 
                                        className={`h-full transition-all duration-500 ${
                                          isNotSubscribed ? 'bg-gray-300 dark:bg-slate-600' :
                                          isPending ? 'bg-amber-500 animate-pulse' :
                                          isExpired ? 'bg-red-500' :
                                          remaining <= 2 ? 'bg-amber-500' : 'bg-emerald-500'
                                        }`}
                                        style={{ width: `${isPending ? 100 : percent}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-4 px-4">
                                  {isNotSubscribed ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                      <UserX className="w-3.5 h-3.5" />
                                      غير مشترك
                                    </span>
                                  ) : isPending ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 animate-pulse">
                                      <Clock className="w-3.5 h-3.5" />
                                      قيد المراجعة المالية
                                    </span>
                                  ) : isExpired ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                      <AlertCircle className="w-3.5 h-3.5" />
                                      منتهية (0 حصص)
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      نشطة ({remaining})
                                    </span>
                                  )}
                                </td>
                                <td className="py-4 px-4">
                                  <div className="flex items-center justify-center gap-2">
                                    {isNotSubscribed ? (
                                      <button
                                        onClick={() => handleRenewPackage(pkg)}
                                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20 cursor-pointer hover:scale-105 active:scale-95"
                                        title="تفعيل باقة 8 حصص لهذا الطالب"
                                      >
                                        <CheckCircle2 className="w-4 h-4" />
                                        تفعيل الباقة (8 حصص)
                                      </button>
                                    ) : isPending ? (
                                      <Link
                                        to="/admin-dashboard/subscriptions"
                                        className="px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-300 hover:bg-amber-500/25 text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                                        title="انتقل لإدارة الاشتراكات لمراجعة الإيصال والاعتماد المالي"
                                      >
                                        <Clock className="w-3.5 h-3.5" />
                                        <span>اعتماد مالي ↗</span>
                                      </Link>
                                    ) : isExpired ? (
                                      <button
                                        onClick={() => handleRenewPackage(pkg)}
                                        className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black flex items-center gap-1.5 transition-all shadow-md shadow-amber-600/20 cursor-pointer hover:scale-105 active:scale-95"
                                        title="تجديد وتفعيل باقة 8 حصص جديدة"
                                      >
                                        <RefreshCw className="w-4 h-4" />
                                        تجديد وتفعيل (8 حصص)
                                      </button>
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => handleOpenDeductModal(pkg)}
                                          disabled={remaining <= 0}
                                          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black flex items-center gap-1.5 transition-all shadow-md shadow-purple-600/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 active:scale-95"
                                          title="خصم حصة وتسجيل الحضور والملاحظات للطالب"
                                        >
                                          <MinusCircle className="w-4 h-4" />
                                          <span>خصم حصة (تسجيل حضور)</span>
                                        </button>

                                        <button
                                          onClick={() => handleUpdatePackageSessions(pkg, 1)}
                                          className="px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs hover:scale-105 active:scale-95"
                                          title="إضافة حصة تعويضية (+1)"
                                        >
                                          <PlusCircle className="w-3.5 h-3.5" />
                                          +1
                                        </button>
                                      </>
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
              )}

            </div>
          </FadeIn>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: COMPLETED SESSIONS HISTORY (سجل الحصص المكتملة والحضور)          */}
        {/* ========================================================================= */}
        {mainView === 'completed' && (
          <FadeIn>
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-slate-700 mb-8">
              
              {/* Header */}
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-slate-700">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <BookOpen className="w-7 h-7 text-purple-600 dark:text-purple-400" />
                    سجل الحصص المكتملة وتقرير حضور الطلاب
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                    توثيق تفصيلي لجميع الحصص التي تم تقديمها وإنجازها وخصمها من باقات الطلاب، متزامنة لحظياً مع شاشات الطلاب.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setMainView('packages')}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>تسجيل حضور جديد / خصم حصة</span>
                  </button>
                  <button
                    onClick={() => {
                      fetchCompletedSessions();
                      fetchPackages();
                    }}
                    className="p-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
                    title="تحديث السجل الآن"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Summary Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30">
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400 block mb-1">إجمالي الحصص المكتملة</span>
                  <span className="text-2xl font-black text-gray-900 dark:text-white">{completedSessions.length} حصة</span>
                </div>
                <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 block mb-1">الطلاب المسجل لهم حضور</span>
                  <span className="text-2xl font-black text-gray-900 dark:text-white">
                    {new Set(completedSessions.filter(c => c.student_name).map(c => c.student_name)).size} طلاب
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block mb-1">حالة المزامنة المباشرة</span>
                  <span className="text-base font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 mt-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    متزامنة لحظياً مع الطلاب ✅
                  </span>
                </div>
              </div>

              {/* Multi-Filter Bar: Search + Grade + Student + Month */}
              <div className="bg-gray-50 dark:bg-slate-900/60 p-4 md:p-5 rounded-2xl border border-gray-100 dark:border-slate-700/80 mb-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* 1. Text Search */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="بحث بالاسم أو الدرس أو الملاحظات..."
                      value={completedSearch}
                      onChange={(e) => setCompletedSearch(e.target.value)}
                      className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/30"
                    />
                  </div>

                  {/* 2. Grade Filter */}
                  <div>
                    <select
                      value={historyGradeFilter}
                      onChange={(e) => setHistoryGradeFilter(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-900 dark:text-white outline-none cursor-pointer focus:ring-2 focus:ring-purple-500/30"
                    >
                      <option value="all">📚 جميع المراحل والصفوف</option>
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

                  {/* 3. Student Filter */}
                  <div>
                    <select
                      value={historyStudentFilter}
                      onChange={(e) => setHistoryStudentFilter(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-900 dark:text-white outline-none cursor-pointer focus:ring-2 focus:ring-purple-500/30"
                    >
                      <option value="all">👤 جميع الطلاب (تحديد طالب)</option>
                      {historyStudentsList
                        .filter(s => historyGradeFilter === 'all' || !s.grade || s.grade === historyGradeFilter)
                        .map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({formatGradeName(s.grade)})
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* 4. Month & Year Filter */}
                  <div>
                    <select
                      value={historyMonthFilter}
                      onChange={(e) => setHistoryMonthFilter(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-900 dark:text-white outline-none cursor-pointer focus:ring-2 focus:ring-purple-500/30"
                    >
                      <option value="all">📅 جميع الشهور والأعوام</option>
                      {historyMonthsList.map(m => (
                        <option key={m.value} value={m.value}>
                          🗓️ {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Active Filters Summary / Status Banner */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-3 border-t border-gray-200/60 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedHistoryStudent ? (
                      <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/50 px-3.5 py-2 rounded-2xl text-purple-900 dark:text-purple-200 font-bold shadow-sm">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse"></span>
                        <span>الطالب: <strong className="text-purple-950 dark:text-white">{selectedHistoryStudent.name}</strong></span>
                        <span>•</span>
                        <span className="text-purple-700 dark:text-purple-300">{formatGradeName(selectedHistoryStudent.grade)}</span>
                        <span>•</span>
                        <span className="text-purple-900 dark:text-purple-100 font-black bg-purple-200/70 dark:bg-purple-800/70 px-2.5 py-1 rounded-xl">
                          أخذ {filteredCompletedSessions.length} {filteredCompletedSessions.length === 1 ? 'حصة' : filteredCompletedSessions.length === 2 ? 'حصتين' : 'حصص'}
                          {historyMonthFilter !== 'all' ? ` في ${historyMonthsList.find(m => m.value === historyMonthFilter)?.label || historyMonthFilter}` : ' إجمالاً'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 font-bold">
                        <span>عرض النتائج: <strong className="text-gray-900 dark:text-white font-black">{filteredCompletedSessions.length} حصة مكتملة</strong></span>
                        {historyMonthFilter !== 'all' && (
                          <span className="px-2.5 py-1 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold">
                            {historyMonthsList.find(m => m.value === historyMonthFilter)?.label || historyMonthFilter}
                          </span>
                        )}
                        {historyGradeFilter !== 'all' && (
                          <span className="px-2.5 py-1 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-bold">
                            {formatGradeName(historyGradeFilter)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* View Switcher: Cards vs Table */}
                    <div className="flex items-center bg-gray-200/80 dark:bg-slate-800 p-1 rounded-xl border border-gray-300/60 dark:border-slate-700">
                      <button
                        type="button"
                        onClick={() => setHistoryViewMode('cards')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          historyViewMode === 'cards'
                            ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs font-black'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                        title="عرض كبطاقات تفصيلية مطابقة لشاشة الطالب"
                      >
                        🗂️ بطاقات تفصيلية
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryViewMode('table')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          historyViewMode === 'table'
                            ? 'bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs font-black'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                        title="عرض كجدول بيانات مضغوط"
                      >
                        📊 جدول مضغوط
                      </button>
                    </div>

                    {(historyGradeFilter !== 'all' || historyStudentFilter !== 'all' || historyMonthFilter !== 'all' || completedSearch.trim()) && (
                      <button
                        onClick={() => {
                          setHistoryGradeFilter('all');
                          setHistoryStudentFilter('all');
                          setHistoryMonthFilter('all');
                          setCompletedSearch('');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-gray-200 font-bold text-xs transition-colors cursor-pointer"
                      >
                        إعادة ضبط الفلاتر
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {completedLoading ? (
                <div className="flex justify-center py-20">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
                </div>
              ) : completedSessions.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700">
                  <BookOpen className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-gray-600 dark:text-gray-400 font-bold">لا توجد حصص مكتملة مسجلة حتى الآن.</p>
                  <p className="text-xs text-gray-400 mt-1">عند تسجيل حضور أي طالب وخصم حصة، ستظهر تلقائياً هنا وفي حساب الطالب مع التاريخ والملاحظات.</p>
                </div>
              ) : filteredCompletedSessions.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700">
                  <Calendar className="w-12 h-12 text-gray-400 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-gray-700 dark:text-gray-300 font-black text-base">لا توجد حصص مكتملة تطابق معايير الفلترة المحددة</p>
                  <p className="text-xs text-gray-400 mt-1">جرب تغيير الشهر أو اختيار طالب آخر أو إعادة ضبط الفلاتر.</p>
                  <button
                    onClick={() => {
                      setHistoryGradeFilter('all');
                      setHistoryStudentFilter('all');
                      setHistoryMonthFilter('all');
                      setCompletedSearch('');
                    }}
                    className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
                  >
                    إعادة ضبط الفلاتر وعرض الكل
                  </button>
                </div>
              ) : historyViewMode === 'cards' ? (
                /* ==================== CARD VIEW (IDENTICAL TO STUDENT VIEW) ==================== */
                <div className="space-y-3">
                  {filteredCompletedSessions.map(item => {
                    const dateObj = new Date(item.completed_at || item.created_at);
                    const formattedDate = !isNaN(dateObj.getTime())
                      ? dateObj.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })
                      : '-';
                    const formattedTime = !isNaN(dateObj.getTime())
                      ? dateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                      : '';

                    return (
                      <div 
                        key={item.id}
                        className="p-5 rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900/60 shadow-xs hover:border-purple-300 dark:hover:border-purple-700 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                      >
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-black text-base text-gray-900 dark:text-white">
                              {item.session_title || 'حصة أونلاين مباشرة'}
                            </h4>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300 inline-flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              مكتملة ومحسوبة
                            </span>
                            {item.student_name && (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 inline-flex items-center gap-1 border border-blue-200 dark:border-blue-800/40">
                                👤 {item.student_name}
                              </span>
                            )}
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
                            {item.grade_level && (
                              <>
                                <span>•</span>
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  {formatGradeName(item.grade_level)}
                                </span>
                              </>
                            )}
                          </div>

                          {item.teacher_notes && (
                            <div className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-slate-800/70 p-2.5 rounded-xl font-medium border border-gray-100 dark:border-slate-700/60 mt-1 inline-block max-w-full">
                              📝 <span className="font-bold">ملاحظات:</span> {item.teacher_notes}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <span className="px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-black border border-purple-200 dark:border-purple-800/50">
                            -1 حصة من الباقة
                          </span>
                          <button
                            onClick={() => handleOpenEditCompleted(item)}
                            className="p-2 rounded-xl text-blue-600 hover:text-white hover:bg-blue-600 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 transition-all cursor-pointer shadow-xs"
                            title="تعديل تفاصيل وتوقيت الحصة"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteCompletedModal({ isOpen: true, id: item.id })}
                            className="p-2 rounded-xl text-red-500 hover:text-white hover:bg-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 transition-all cursor-pointer shadow-xs"
                            title="حذف هذا السجل من قائمة الحصص المكتملة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* ==================== CONDENSED TABLE VIEW ==================== */
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-slate-700 text-xs font-black text-gray-500 dark:text-gray-400 uppercase">
                        <th className="py-4 px-4">تاريخ الحصة وتوقيتها</th>
                        <th className="py-4 px-4">الطالب</th>
                        <th className="py-4 px-4">الصف الدراسي</th>
                        <th className="py-4 px-4">عنوان الحصة / الدرس</th>
                        <th className="py-4 px-4">ملاحظات المعلم</th>
                        <th className="py-4 px-4 text-center">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                      {filteredCompletedSessions.map(item => {
                        const dateObj = new Date(item.completed_at || item.created_at);
                        const formattedDate = !isNaN(dateObj.getTime())
                          ? dateObj.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })
                          : '-';
                        const formattedTime = !isNaN(dateObj.getTime())
                          ? dateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                          : '';

                        return (
                          <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-slate-750 transition-colors">
                            <td className="py-4 px-4">
                              <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                                <span>{formattedDate}</span>
                              </div>
                              <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3" />
                                <span>{formattedTime}</span>
                              </div>
                            </td>
                            <td className="py-4 px-4 font-black text-gray-900 dark:text-white">
                              {item.student_name || 'طالب'}
                            </td>
                            <td className="py-4 px-4">
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                {formatGradeName(item.grade_level)}
                              </span>
                            </td>
                            <td className="py-4 px-4 font-bold text-purple-700 dark:text-purple-400">
                              {item.session_title || 'حصة أونلاين مباشرة'}
                            </td>
                            <td className="py-4 px-4 text-xs text-gray-600 dark:text-gray-300 max-w-xs">
                              {item.teacher_notes || <span className="text-gray-400 italic">لا توجد ملاحظات</span>}
                            </td>
                            <td className="py-4 px-4 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleOpenEditCompleted(item)}
                                  className="p-2 rounded-xl text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                                  title="تعديل تفاصيل وتوقيت الحصة"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setDeleteCompletedModal({ isOpen: true, id: item.id })}
                                  className="p-2 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                                  title="حذف هذا السجل من قائمة الحصص المكتملة"
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
                  onClick={() => handleOpenTrialModal(null)}
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
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-100/50 px-2 py-0.5 rounded-md">
                                  {tSession.duration_minutes ? `${tSession.duration_minutes} دقيقة` : '30 دقيقة'}
                                </span>
                                <button
                                  onClick={() => handleOpenTrialModal(tSession)}
                                  className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-600 hover:text-white transition-colors cursor-pointer border border-amber-200 dark:border-amber-800/40"
                                  title="تعديل بيانات الحصة التجريبية"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setDeleteTrialModal({ isOpen: true, id: tSession.id, title: tSession.title })}
                                  className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 hover:bg-red-600 hover:text-white transition-colors cursor-pointer border border-red-200 dark:border-red-800/40"
                                  title="حذف الحصة التجريبية"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
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
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  سيكمل معنا (بانتظار سداد الباقة)
                                </span>
                              ) : req.status === 'rejected' ? (
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 inline-flex items-center gap-1">
                                  <XCircle className="w-3.5 h-3.5" />
                                  لن يكمل
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 inline-flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" />
                                  قيد التقييم
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                <button
                                  onClick={() => handleApproveTrialStudent(req)}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm ${
                                    req.status === 'enrolled'
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-300'
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  }`}
                                  title="تأكيد استمرار الطالب وإرسال إشعار له بالاشتراك وسداد الباقة"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                  {req.status === 'enrolled' ? 'سيكمل (تم التأكيد)' : 'سيكمل معنا'}
                                </button>
                                <button
                                  onClick={() => handleRejectTrialStudent(req)}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm ${
                                    req.status === 'rejected'
                                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-300'
                                      : 'bg-amber-500 hover:bg-amber-600 text-white'
                                  }`}
                                  title="تسجيل عدم الاستمرار وإرسال إشعار للطالب"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                  {req.status === 'rejected' ? 'لن يكمل (تم التسجيل)' : 'لن يكمل'}
                                </button>
                                <button
                                  onClick={() => setRemoveStudentModal({ isOpen: true, requestId: req.id, studentName: req.student_name || 'هذا الطالب' })}
                                  className="p-1.5 rounded-xl bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-600 dark:bg-slate-800 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors cursor-pointer border border-gray-200 dark:border-slate-700"
                                  title="حذف الطالب نهائياً من القائمة"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
                  disabled={scheduleSubmitting}
                  className="px-6 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white text-xs shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {scheduleSubmitting ? <Loader className="w-4 h-4 animate-spin" /> : null}
                  <span>{isEditingSchedule ? 'تحديث وحفظ الموعد' : 'حفظ الموعد الأسبوعي'}</span>
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
                {isEditingTrial ? 'تعديل بيانات الحصة التجريبية' : 'جدولة حصة تجريبية مجانية (30 دقيقة)'}
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
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">مدة الحصة التجريبية (بالدقائق)</label>
                <div className="grid grid-cols-4 gap-2">
                  {[20, 30, 45, 60].map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setTrialForm({ ...trialForm, duration_minutes: mins })}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        Number(trialForm.duration_minutes) === mins
                          ? 'bg-amber-500 text-white border-amber-500 shadow-sm font-black'
                          : 'bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:bg-gray-100'
                      }`}
                    >
                      {mins} دقيقة
                    </button>
                  ))}
                </div>
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
                  disabled={trialSubmitting}
                  className="px-6 py-2.5 rounded-xl font-bold bg-amber-600 hover:bg-amber-700 text-white text-xs shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {trialSubmitting ? <Loader className="w-4 h-4 animate-spin" /> : null}
                  <span>{isEditingTrial ? 'تحديث وحفظ الحصة' : 'حفظ وجدولة الحصة'}</span>
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

      {/* Individual Deduct Attendance Modal */}
      {deductModal.isOpen && deductModal.pkg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-gray-100 dark:border-slate-700 my-8">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100 dark:border-slate-700">
              <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                <MinusCircle className="w-6 h-6 text-amber-500" />
                تسجيل حضور وخصم حصة (-1)
              </h3>
              <button 
                onClick={() => setDeductModal({ isOpen: false, pkg: null, sessionTitle: '', teacherNotes: '', submitting: false })}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-5 p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-gray-600 dark:text-gray-300">الطالب المستهدف:</span>
                <span className="font-black text-gray-900 dark:text-white text-sm">{deductModal.pkg.full_name}</span>
              </div>
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-gray-600 dark:text-gray-300">الصف الدراسي:</span>
                <span className="font-black text-amber-700 dark:text-amber-400">{formatGradeName(deductModal.pkg.grade_level)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-600 dark:text-gray-300">رصيد الحصص الحالي:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">{deductModal.pkg.remaining_sessions} من 8 حصص</span>
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleConfirmDeduct(); }} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                  <span>تاريخ وتوقيت الحصة (توقيت الخصم والإتمام)</span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">افتراضياً: الوقت الحالي لحظة الإتمام</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={deductModal.completedAt}
                  onChange={(e) => setDeductModal({ ...deductModal, completedAt: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">عنوان الحصة / الدرس المشروح</label>
                <input
                  type="text"
                  required
                  value={deductModal.sessionTitle}
                  onChange={(e) => setDeductModal({ ...deductModal, sessionTitle: e.target.value })}
                  placeholder="مثال: حصة نحو - الأفعال الخمسة"
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-sm font-bold text-gray-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">ملاحظات المعلم للطالب (تظهر في حسابه بالسجل)</label>
                <textarea
                  rows={3}
                  value={deductModal.teacherNotes}
                  onChange={(e) => setDeductModal({ ...deductModal, teacherNotes: e.target.value })}
                  placeholder="مثال: تم شرح الدرس وحل تدريبات الكتاب المدرسي، برجاء مذاكرة القاعدة وحل الواجب صـ 24"
                  className="w-full px-4 py-2 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setDeductModal({ isOpen: false, pkg: null, sessionTitle: '', teacherNotes: '', submitting: false })}
                  className="px-5 py-2.5 rounded-xl font-bold bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-slate-100 text-xs border border-gray-300 dark:border-slate-600 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={deductModal.submitting}
                  className="px-6 py-2.5 rounded-xl font-bold bg-amber-600 hover:bg-amber-700 text-white text-xs shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {deductModal.submitting ? <Loader className="w-4 h-4 animate-spin" /> : <MinusCircle className="w-4 h-4" />}
                  <span>تأكيد خصم الحصة وتسجيل الحضور</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Deduct Attendance Modal */}
      {bulkDeductModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-gray-100 dark:border-slate-700 my-8">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100 dark:border-slate-700">
              <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                <UserCheck className="w-6 h-6 text-emerald-500" />
                تسجيل حضور جماعي للصف ({formatGradeName(bulkDeductModal.gradeLevel)})
              </h3>
              <button 
                onClick={() => setBulkDeductModal({ isOpen: false, gradeLevel: '', sessionTitle: '', teacherNotes: '', submitting: false })}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-5 p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-xs">
              <p className="font-bold text-emerald-900 dark:text-emerald-200">
                سيتم خصم حصة واحدة (-1) لجميع الطلاب أصحاب الرصيد النشط في هذا الصف، وإضافة الحصة تلقائياً في سجل الحصص المكتملة لديهم.
              </p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleConfirmBulkDeduct(); }} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between">
                  <span>تاريخ وتوقيت الحصة الجماعية</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">افتراضياً: الوقت الحالي لحظة الإتمام</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={bulkDeductModal.completedAt}
                  onChange={(e) => setBulkDeductModal({ ...bulkDeductModal, completedAt: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">عنوان الحصة الجماعية / الدرس</label>
                <input
                  type="text"
                  required
                  value={bulkDeductModal.sessionTitle}
                  onChange={(e) => setBulkDeductModal({ ...bulkDeductModal, sessionTitle: e.target.value })}
                  placeholder="مثال: مراجعة الوحدة الأولى - نحو ونصوص"
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-sm font-bold text-gray-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">ملاحظات وتوجيهات الحصة للطلاب</label>
                <textarea
                  rows={3}
                  value={bulkDeductModal.teacherNotes}
                  onChange={(e) => setBulkDeductModal({ ...bulkDeductModal, teacherNotes: e.target.value })}
                  placeholder="مثال: تم شرح ومراجعة الدروس وحل النماذج الامتحانية"
                  className="w-full px-4 py-2 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setBulkDeductModal({ isOpen: false, gradeLevel: '', sessionTitle: '', teacherNotes: '', completedAt: '', submitting: false })}
                  className="px-5 py-2.5 rounded-xl font-bold bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-slate-100 text-xs border border-gray-300 dark:border-slate-600 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={bulkDeductModal.submitting}
                  className="px-6 py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white text-xs shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {bulkDeductModal.submitting ? <Loader className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                  <span>تأكيد تسجيل الحضور الجماعي</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Completed Session Modal */}
      {editCompletedModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-gray-100 dark:border-slate-700 my-8">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100 dark:border-slate-700">
              <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                <Edit className="w-6 h-6 text-blue-500" />
                تعديل سجل الحصة المكتملة
              </h3>
              <button 
                onClick={() => setEditCompletedModal({ isOpen: false, id: null, studentName: '', gradeLevel: '', sessionTitle: '', teacherNotes: '', completedAt: '', submitting: false })}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-5 p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 text-xs flex justify-between items-center">
              <div>
                <span className="font-bold text-gray-600 dark:text-gray-300">الطالب: </span>
                <span className="font-black text-gray-900 dark:text-white">{editCompletedModal.studentName}</span>
              </div>
              {editCompletedModal.gradeLevel && (
                <span className="font-bold text-blue-700 dark:text-blue-400">
                  {formatGradeName(editCompletedModal.gradeLevel)}
                </span>
              )}
            </div>

            <form onSubmit={handleSaveEditCompleted} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  تاريخ وتوقيت الحصة (توقيت الإتمام الفعلي)
                </label>
                <input
                  type="datetime-local"
                  required
                  value={editCompletedModal.completedAt}
                  onChange={(e) => setEditCompletedModal({ ...editCompletedModal, completedAt: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  عنوان الحصة / الدرس المشروح
                </label>
                <input
                  type="text"
                  required
                  value={editCompletedModal.sessionTitle}
                  onChange={(e) => setEditCompletedModal({ ...editCompletedModal, sessionTitle: e.target.value })}
                  placeholder="مثال: حصة نحو - إعراب الفعل المضارع"
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-sm font-bold text-gray-900 dark:text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                  ملاحظات المعلم للطالب
                </label>
                <textarea
                  rows={3}
                  value={editCompletedModal.teacherNotes}
                  onChange={(e) => setEditCompletedModal({ ...editCompletedModal, teacherNotes: e.target.value })}
                  placeholder="ملاحظات وتوجيهات الحصة..."
                  className="w-full px-4 py-2 rounded-xl bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-xs text-gray-900 dark:text-white outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setEditCompletedModal({ isOpen: false, id: null, studentName: '', gradeLevel: '', sessionTitle: '', teacherNotes: '', completedAt: '', submitting: false })}
                  className="px-5 py-2.5 rounded-xl font-bold bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-slate-100 text-xs border border-gray-300 dark:border-slate-600 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={editCompletedModal.submitting}
                  className="px-6 py-2.5 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white text-xs shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {editCompletedModal.submitting ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  <span>حفظ التعديلات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Trial Session Modal */}
      <ConfirmModal
        isOpen={deleteTrialModal.isOpen}
        onClose={() => setDeleteTrialModal({ isOpen: false, id: null, title: '' })}
        onConfirm={handleDeleteTrialSession}
        title="حذف الحصة التجريبية"
        message={`هل أنت متأكد من رغبتك في حذف الحصة التجريبية (${deleteTrialModal.title})؟`}
        confirmText="حذف"
        cancelText="إلغاء"
        isDanger={true}
      />

      {/* Delete Completed Session Modal */}
      <ConfirmModal
        isOpen={deleteCompletedModal.isOpen}
        onClose={() => setDeleteCompletedModal({ isOpen: false, id: null })}
        onConfirm={handleDeleteCompletedSession}
        title="حذف سجل الحصة المكتملة"
        message="هل أنت متأكد من رغبتك في حذف هذا السجل من قائمة الحصص المكتملة؟"
        confirmText="حذف"
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
