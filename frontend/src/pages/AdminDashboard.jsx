import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Users, BookOpen, Settings, AlertTriangle, ShieldCheck, 
  Plus, Edit, Trash2, Video, FileText, Search, LayoutDashboard, 
  ArrowLeft, CheckCircle, ChevronLeft, Calendar, ClipboardList,
  MessageSquare, Sparkles, Filter, CheckCircle2, Clock, CreditCard,
  GraduationCap, ExternalLink, Activity, Trophy, Crown, Medal, Award,
  Flame, Save, PlusCircle, MinusCircle, UserCheck, Sliders, X
} from 'lucide-react';
import FadeIn from '../components/FadeIn';
import ConfirmModal from '../components/ConfirmModal';
import { supabase } from '../lib/supabase';
import { getDirectImageUrl } from '../utils/helpers';
import { getXpRules, saveXpRules, fetchXpRulesAsync, saveXpRulesAsync, getStudentBadge } from '../utils/gamification';
import toast from 'react-hot-toast';
import { getCache, setCache } from '../utils/appCache';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AdminDashboard() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();

  const cachedAdmin = getCache('admin_dashboard_data');
  const cachedLeaderboard = getCache('admin_students_leaderboard');

  const [courses, setCourses] = useState(cachedAdmin?.courses || []);
  const [stats, setStats] = useState(cachedAdmin?.stats || { 
    students: 0, 
    courses: 0, 
    publishedCourses: 0, 
    pendingSubscriptions: 0, 
    quizzes: 0 
  });
  const [loading, setLoading] = useState(!cachedAdmin);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, courseId: null });
  
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'courses' | 'gamification'
  const [searchQuery, setSearchQuery] = useState('');
  const [courseTypeFilter, setCourseTypeFilter] = useState('all'); // 'all' | 'foundation' | 'grades'

  // Gamification & XP Rules State
  const [xpRules, setXpRules] = useState(getXpRules());
  const [isSavingRules, setIsSavingRules] = useState(false);
  const [studentsLeaderboard, setStudentsLeaderboard] = useState(cachedLeaderboard || []);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [adjustXpModal, setAdjustXpModal] = useState({ 
    isOpen: false, 
    student: null, 
    amount: 25, 
    type: 'add', 
    reason: '' 
  });
  const [isAdjustingXp, setIsAdjustingXp] = useState(false);

  useEffect(() => {
    fetchDashboardData();
    fetchStudentsLeaderboard();
    fetchXpRulesAsync().then(rules => {
      if (rules) setXpRules(rules);
    });
  }, []);

  const fetchDashboardData = async () => {
    try {
      if (!cachedAdmin && courses.length === 0) {
        setLoading(true);
      }
      // Fetch stats
      const { count: studentsCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student');

      const { data: coursesData, count: coursesCount } = await supabase
        .from('courses')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      const { count: pendingSubscriptions } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      const { count: quizzesCount } = await supabase
        .from('quizzes')
        .select('*', { count: 'exact', head: true });

      const publishedCount = (coursesData || []).filter(c => c.is_published).length;

      const newStats = {
        students: studentsCount || 0,
        courses: coursesCount || 0,
        publishedCourses: publishedCount,
        pendingSubscriptions: pendingSubscriptions || 0,
        quizzes: quizzesCount || 0
      };

      setStats(newStats);

      if (coursesData) {
        setCourses(coursesData);
      }

      setCache('admin_dashboard_data', { courses: coursesData || [], stats: newStats }, 300);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentsLeaderboard = async () => {
    try {
      if (!cachedLeaderboard && studentsLeaderboard.length === 0) {
        setLeaderboardLoading(true);
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, xp_points, grade_level, role, created_at')
        .eq('role', 'student')
        .order('xp_points', { ascending: false });

      if (error) throw error;
      
      // Safeguard: Ensure no admin or teacher is included in student ranking
      const cleanStudents = (data || []).filter(
        s => s.role !== 'admin' && s.role !== 'teacher' && s.email !== '41147332a@gmail.com'
      );
      setStudentsLeaderboard(cleanStudents);
      setCache('admin_students_leaderboard', cleanStudents, 300);
    } catch (e) {
      console.error('Error fetching students leaderboard:', e);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const handleSaveXpRules = async (e) => {
    e.preventDefault();
    setIsSavingRules(true);
    try {
      await saveXpRulesAsync(xpRules);
      toast.success(isRTL ? '✅ تم حفظ وتطبيق معايير نقاط الـ XP بنجاح على المنصة!' : 'Gamification rules updated successfully!');
    } catch (err) {
      console.error('Error saving XP rules:', err);
      toast.error(isRTL ? 'حدث خطأ أثناء حفظ المعايير' : 'Failed to save rules');
    } finally {
      setIsSavingRules(false);
    }
  };

  const handleOpenAdjustModal = (student) => {
    setAdjustXpModal({
      isOpen: true,
      student,
      amount: 25,
      type: 'add',
      reason: ''
    });
  };

  const handleConfirmAdjustXp = async () => {
    if (!adjustXpModal.student) return;
    const student = adjustXpModal.student;
    const delta = adjustXpModal.type === 'add' ? Math.abs(Number(adjustXpModal.amount) || 0) : -Math.abs(Number(adjustXpModal.amount) || 0);
    const newXp = Math.max(0, (Number(student.xp_points) || 0) + delta);

    try {
      setIsAdjustingXp(true);

      let updateSuccess = false;
      let actualFinalXp = newXp;

      // 1. Try updating via Backend Admin API (bypasses RLS safely via Service Role)
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${apiUrl}/api/admin/students/${student.id}/adjust-xp`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
          },
          body: JSON.stringify({
            amount: Math.abs(Number(adjustXpModal.amount) || 0),
            type: adjustXpModal.type,
            delta,
            newXp,
            reason: adjustXpModal.reason
          })
        });

        if (res.ok) {
          const resData = await res.json();
          if (resData.success) {
            updateSuccess = true;
            if (resData.xp_points !== undefined) {
              actualFinalXp = resData.xp_points;
            }
          }
        }
      } catch (apiErr) {
        console.warn('Backend adjust-xp endpoint not reachable, trying direct Supabase update:', apiErr);
      }

      // 2. Fallback to direct Supabase client if backend was not reached or failed
      if (!updateSuccess) {
        const { data, error } = await supabase
          .from('profiles')
          .update({ xp_points: newXp })
          .eq('id', student.id)
          .select();

        if (error) throw error;
        // Verify that row was actually updated in the database
        if (!data || data.length === 0) {
          throw new Error(
            isRTL
              ? 'تعذر تحديث النقاط في قاعدة البيانات. يرجى التأكد من تشغيل السيرفر الخلفي (node server.js) أو تطبيق ملف fix_admin_xp_rls.sql في Supabase.'
              : 'Failed to update XP in database due to security policies. Please ensure the backend server is running or apply fix_admin_xp_rls.sql in Supabase.'
          );
        }
        updateSuccess = true;
        actualFinalXp = data[0].xp_points;
      }

      // 3. Optimistic UI update: Update leaderboard in local state immediately
      setStudentsLeaderboard(prev => 
        prev.map(s => s.id === student.id ? { ...s, xp_points: actualFinalXp } : s)
            .sort((a, b) => (b.xp_points || 0) - (a.xp_points || 0))
      );

      toast.success(
        isRTL 
          ? `🎉 تم تحديث نقاط الطالب ${student.full_name} (${delta >= 0 ? '+' : ''}${delta} XP)`
          : `Updated XP for ${student.full_name} (${delta >= 0 ? '+' : ''}${delta} XP)`
      );

      setAdjustXpModal({ isOpen: false, student: null, amount: 25, type: 'add', reason: '' });
      fetchStudentsLeaderboard();
    } catch (e) {
      console.error('Error adjusting XP:', e);
      toast.error(e.message || (isRTL ? 'فشل تعديل النقاط' : 'Failed to update XP'));
    } finally {
      setIsAdjustingXp(false);
    }
  };

  const handleDeleteClick = (id) => {
    setDeleteModal({ isOpen: true, courseId: id });
  };

  const confirmDeleteCourse = async () => {
    const id = deleteModal.courseId;
    if (!id) return;
    
    setDeleteModal({ isOpen: false, courseId: null });
    
    try {
      const { error } = await supabase.from('courses').delete().eq('id', id);
      if (error) throw error;
      setCourses(courses.filter(c => c.id !== id));
      setStats(prev => ({ ...prev, courses: prev.courses - 1 }));
    } catch (error) {
      console.error('Error deleting course:', error);
      alert(t('admin_error_delete_course'));
    }
  };

  const filteredCourses = courses.filter(course => {
    const matchesSearch = 
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (course.category && course.category.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (courseTypeFilter === 'foundation') {
      return (
        (course.category && (course.category.includes('تأسيس') || course.category.toLowerCase().includes('foundation'))) ||
        course.title.includes('تأسيس')
      );
    }
    if (courseTypeFilter === 'grades') {
      const isFoundation = (
        (course.category && (course.category.includes('تأسيس') || course.category.toLowerCase().includes('foundation'))) ||
        course.title.includes('تأسيس')
      );
      return !isFoundation;
    }
    return true;
  });

  const filteredStudents = studentsLeaderboard.filter(student => {
    const matchesSearch = 
      (student.full_name && student.full_name.toLowerCase().includes(studentSearch.toLowerCase())) ||
      (student.email && student.email.toLowerCase().includes(studentSearch.toLowerCase()));

    if (!matchesSearch) return false;
    if (gradeFilter !== 'all' && student.grade_level !== gradeFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin shadow-lg"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] pb-16 font-arabic selection:bg-blue-500/30">
      
      {/* High-End Header */}
      <div className="bg-gradient-to-br from-blue-900 via-slate-900 to-indigo-950 pt-24 pb-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden shadow-2xl">
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/20 blur-[120px] rounded-full pointer-events-none mix-blend-screen translate-x-1/3 -translate-y-1/3"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-500/20 blur-[150px] rounded-full pointer-events-none mix-blend-screen -translate-x-1/3 translate-y-1/3"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] mix-blend-overlay"></div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          <FadeIn>
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 sm:gap-8">
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/20 shadow-[0_0_30px_rgba(59,130,246,0.3)] relative group shrink-0">
                  <div className="absolute inset-0 bg-blue-500 rounded-2xl sm:rounded-3xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
                  <ShieldCheck className="w-7 h-7 sm:w-10 sm:h-10 text-blue-300 relative z-10" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-1 sm:mb-3 drop-shadow-md">
                    {t('admin_dashboard_title')}
                  </h1>
                  <p className="text-blue-100/80 font-medium text-sm sm:text-lg flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0"></span>
                    <span className="truncate">{t('admin_dashboard_subtitle')}</span>
                  </p>
                </div>
              </div>
              
              <div className="w-full lg:w-auto flex items-center overflow-x-auto no-scrollbar gap-2 bg-white/10 backdrop-blur-xl rounded-2xl p-1.5 border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.2)] shrink-0">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl font-bold transition-all duration-300 cursor-pointer shrink-0 whitespace-nowrap text-sm sm:text-base ${activeTab === 'overview' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/50 scale-100' : 'text-blue-200/70 hover:text-white hover:bg-white/10'}`}
                >
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  <span>{t('admin_tab_overview')}</span>
                </button>
                <button
                  onClick={() => setActiveTab('courses')}
                  className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl font-bold transition-all duration-300 cursor-pointer shrink-0 whitespace-nowrap text-sm sm:text-base ${activeTab === 'courses' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/50 scale-100' : 'text-blue-200/70 hover:text-white hover:bg-white/10'}`}
                >
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <span>{t('admin_tab_courses')}</span>
                </button>
                <button
                  onClick={() => setActiveTab('gamification')}
                  className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl font-bold transition-all duration-300 cursor-pointer shrink-0 whitespace-nowrap text-sm sm:text-base ${activeTab === 'gamification' ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-lg shadow-amber-900/40 scale-100 font-black' : 'text-amber-300/80 hover:text-amber-200 hover:bg-white/10'}`}
                >
                  <Trophy className="w-4 h-4 shrink-0" />
                  <span>{isRTL ? 'نقاط الطلاب ولوحة الشرف' : 'Student XP & Leaderboard'}</span>
                </button>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-20">
        
        {/* =========================================================================
            OVERVIEW TAB
           ========================================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-10">
            {/* Stats Section - 4 Pillars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Students Stat */}
              <FadeIn delay={100}>
                <Link to="/admin-dashboard/students" className="block bg-white dark:bg-[#1E293B] rounded-3xl p-5 sm:p-7 shadow-sm border border-gray-100 dark:border-slate-800 hover:-translate-y-1.5 hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-300 group relative overflow-hidden h-full">
                  <div className="flex justify-between items-start mb-5">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-600/20 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 border border-blue-500/20 shadow-inner">
                      <Users className="w-6 h-6 sm:w-7 sm:h-7" />
                    </div>
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800/40">
                      {isRTL ? 'الطلاب المسجلين' : 'Students'}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-gray-500 dark:text-slate-400 text-sm font-bold mb-1">{t('admin_total_students')}</h3>
                    <div className="flex items-baseline justify-between">
                      <p className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight">{stats.students}</p>
                      <span className="text-blue-600 dark:text-blue-400 text-xs font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isRTL ? 'سجل الطلاب' : 'View Records'} <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-0 ltr:rotate-180" />
                      </span>
                    </div>
                  </div>
                </Link>
              </FadeIn>

              {/* Courses Stat */}
              <FadeIn delay={150}>
                <button 
                  onClick={() => setActiveTab('courses')}
                  className="w-full text-start block bg-white dark:bg-[#1E293B] rounded-3xl p-5 sm:p-7 shadow-sm border border-gray-100 dark:border-slate-800 hover:-translate-y-1.5 hover:shadow-xl hover:border-emerald-300 dark:hover:border-emerald-700 transition-all duration-300 group relative overflow-hidden h-full cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-5">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 border border-emerald-500/20 shadow-inner">
                      <BookOpen className="w-6 h-6 sm:w-7 sm:h-7" />
                    </div>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/40">
                      {stats.publishedCourses} {isRTL ? 'منشور' : 'Live'}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-gray-500 dark:text-slate-400 text-sm font-bold mb-1">{t('admin_published_courses')}</h3>
                    <div className="flex items-baseline justify-between">
                      <p className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight">{stats.courses}</p>
                      <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isRTL ? 'تصفح الكورسات' : 'Browse'} <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-0 ltr:rotate-180" />
                      </span>
                    </div>
                  </div>
                </button>
              </FadeIn>

              {/* Subscriptions Stat */}
              <FadeIn delay={200}>
                <Link to="/admin-dashboard/subscriptions" className="block bg-white dark:bg-[#1E293B] rounded-3xl p-5 sm:p-7 shadow-sm border border-gray-100 dark:border-slate-800 hover:-translate-y-1.5 hover:shadow-xl hover:border-amber-300 dark:hover:border-amber-700 transition-all duration-300 group relative overflow-hidden h-full">
                  <div className="flex justify-between items-start mb-5">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-600/20 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 border border-amber-500/20 shadow-inner">
                      <CreditCard className="w-6 h-6 sm:w-7 sm:h-7" />
                    </div>
                    {stats.pendingSubscriptions > 0 ? (
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-800/40 animate-pulse">
                        {stats.pendingSubscriptions} {isRTL ? 'معلق' : 'Pending'}
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-gray-400 bg-gray-50 dark:bg-slate-800 px-3 py-1 rounded-full">
                        {isRTL ? 'مكتمل' : 'All clear'}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-gray-500 dark:text-slate-400 text-sm font-bold mb-1">{t('admin_pending_subs')}</h3>
                    <div className="flex items-baseline justify-between">
                      <p className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight">{stats.pendingSubscriptions}</p>
                      <span className="text-amber-600 dark:text-amber-400 text-xs font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {t('admin_review_requests')} <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-0 ltr:rotate-180" />
                      </span>
                    </div>
                  </div>
                </Link>
              </FadeIn>

              {/* Quizzes Stat */}
              <FadeIn delay={250}>
                <Link to="/admin-dashboard/quizzes" className="block bg-white dark:bg-[#1E293B] rounded-3xl p-5 sm:p-7 shadow-sm border border-gray-100 dark:border-slate-800 hover:-translate-y-1.5 hover:shadow-xl hover:border-pink-300 dark:hover:border-pink-700 transition-all duration-300 group relative overflow-hidden h-full">
                  <div className="flex justify-between items-start mb-5">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-pink-500/10 to-rose-600/20 text-pink-600 dark:text-pink-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 border border-pink-500/20 shadow-inner">
                      <ClipboardList className="w-6 h-6 sm:w-7 sm:h-7" />
                    </div>
                    <span className="text-xs font-bold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/30 px-3 py-1 rounded-full border border-pink-200 dark:border-pink-800/40">
                      {isRTL ? 'الامتحانات' : 'Quizzes'}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-gray-500 dark:text-slate-400 text-sm font-bold mb-1">{t('admin_total_quizzes')}</h3>
                    <div className="flex items-baseline justify-between">
                      <p className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight">{stats.quizzes}</p>
                      <span className="text-pink-600 dark:text-pink-400 text-xs font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isRTL ? 'إدارة الاختبارات' : 'Manage Quizzes'} <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-0 ltr:rotate-180" />
                      </span>
                    </div>
                  </div>
                </Link>
              </FadeIn>
            </div>

            {/* Management & Operations Suite (Balanced 4x2 Grid) */}
            <FadeIn delay={300}>
              <div className="bg-white dark:bg-[#1E293B] rounded-3xl p-5 sm:p-8 md:p-10 shadow-sm border border-gray-100 dark:border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-full h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-amber-500"></div>
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                      <LayoutDashboard className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-gray-900 dark:text-white">
                        {t('admin_quick_actions')}
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 font-medium">
                        {isRTL ? 'مركز التحكم الشامل وإدارة أقسام وعمليات المنصة الأكاديمية' : 'Unified management hub for all academic and platform operations'}
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-bold text-gray-400 bg-gray-100 dark:bg-slate-800 px-3.5 py-1.5 rounded-full self-start sm:self-center">
                    8 {isRTL ? 'بوابات تشغيلية' : 'Operations Modules'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  
                  {/* 1. Add Course */}
                  <Link 
                    to="/admin-dashboard/courses/new" 
                    className="flex flex-col justify-between p-6 rounded-2xl bg-gray-50/80 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-md"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-all duration-300">
                        <Plus className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isRTL ? 'إنشاء ←' : 'Create ←'}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-1">
                        {t('admin_add_course')}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        {t('admin_new_course_content')}
                      </p>
                    </div>
                  </Link>

                  {/* 2. Subscriptions */}
                  <Link 
                    to="/admin-dashboard/subscriptions" 
                    className="flex flex-col justify-between p-6 rounded-2xl bg-gray-50/80 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-600 hover:bg-amber-50/40 dark:hover:bg-amber-900/10 transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-md relative"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-all duration-300">
                        <CheckCircle className="w-6 h-6" />
                      </div>
                      {stats.pendingSubscriptions > 0 && (
                        <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/40 px-2 py-0.5 rounded-full border border-rose-300">
                          {stats.pendingSubscriptions} {isRTL ? 'جديد' : 'New'}
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-gray-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors mb-1">
                        {t('admin_subscriptions')}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        {t('admin_activate_accounts')}
                      </p>
                    </div>
                  </Link>

                  {/* 3. Students */}
                  <Link 
                    to="/admin-dashboard/students" 
                    className="flex flex-col justify-between p-6 rounded-2xl bg-gray-50/80 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-emerald-50/40 dark:hover:bg-emerald-900/10 transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-md"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-all duration-300">
                        <Users className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isRTL ? 'إدارة ←' : 'Manage ←'}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors mb-1">
                        {t('admin_manage_students')}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        {t('admin_students_records')}
                      </p>
                    </div>
                  </Link>

                  {/* 4. Live Sessions */}
                  <Link 
                    to="/admin-dashboard/live-sessions" 
                    className="flex flex-col justify-between p-6 rounded-2xl bg-gray-50/80 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 hover:border-purple-400 dark:hover:border-purple-600 hover:bg-purple-50/40 dark:hover:bg-purple-900/10 transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-md"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition-all duration-300">
                        <Video className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold text-purple-600 dark:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isRTL ? 'جدولة ←' : 'Schedule ←'}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors mb-1">
                        {t('admin_zoom_sessions')}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        {t('admin_manage_live')}
                      </p>
                    </div>
                  </Link>

                  {/* 5. Quizzes */}
                  <Link 
                    to="/admin-dashboard/quizzes" 
                    className="flex flex-col justify-between p-6 rounded-2xl bg-gray-50/80 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 hover:border-pink-400 dark:hover:border-pink-600 hover:bg-pink-50/40 dark:hover:bg-pink-900/10 transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-md"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700 text-pink-600 dark:text-pink-400 flex items-center justify-center group-hover:scale-110 transition-all duration-300">
                        <ClipboardList className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold text-pink-600 dark:text-pink-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isRTL ? 'تصحيح ←' : 'Grade ←'}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-gray-900 dark:text-white group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors mb-1">
                        {t('admin_manage_quizzes')}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        {t('admin_quizzes_desc')}
                      </p>
                    </div>
                  </Link>

                  {/* 6. Chat & Support */}
                  <Link 
                    to="/admin-dashboard/chat" 
                    className="flex flex-col justify-between p-6 rounded-2xl bg-gray-50/80 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/10 transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-md"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-all duration-300">
                        <MessageSquare className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isRTL ? 'محادثات ←' : 'Chat ←'}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-1">
                        {t('admin_chat_support')}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        {t('admin_chat_desc')}
                      </p>
                    </div>
                  </Link>

                  {/* 7. Gamification & Points Hub */}
                  <button 
                    onClick={() => setActiveTab('gamification')}
                    className="text-start flex flex-col justify-between p-6 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/40 hover:border-amber-400 dark:hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-md"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-amber-200 dark:border-amber-700/50 text-amber-500 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-all duration-300">
                        <Trophy className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isRTL ? 'تحكم النقاط ←' : 'Rules & XP ←'}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-gray-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors mb-1">
                        {isRTL ? 'نقاط الطلاب وقواعد الـ XP' : 'Student XP & Rules'}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        {isRTL ? 'معايير توزيع النقاط، لوحة شرف الأوائل، ومنح مكافآت' : 'Configure XP rules, inspect full ranking, and grant points'}
                      </p>
                    </div>
                  </button>

                  {/* 8. Certificates Registry */}
                  <Link 
                    to="/certificates" 
                    className="flex flex-col justify-between p-6 rounded-2xl bg-gray-50/80 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-emerald-50/40 dark:hover:bg-emerald-900/10 transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-md"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-all duration-300">
                        <Award className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isRTL ? 'السجل والاعتماد ←' : 'Registry ←'}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors mb-1">
                        {isRTL ? 'سجل واعتماد الشهادات' : 'Certificates Registry'}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                        {isRTL ? 'مراجعة واعتماد وطباعة شهادات التخرج الرسمية' : 'Audit, approve, and print accredited student certificates'}
                      </p>
                    </div>
                  </Link>

                </div>
              </div>
            </FadeIn>
          </div>
        )}

        {/* =========================================================================
            COURSES TAB
           ========================================================================= */}
        {activeTab === 'courses' && (
          <FadeIn>
            <div className="space-y-8">
              {/* Header & Course Filter Bar */}
              <div className="bg-white dark:bg-[#1E293B] rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col lg:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4 w-full lg:w-auto">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <BookOpen className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white">{t('admin_tab_courses')}</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 font-medium">{t('admin_browse_courses_desc')}</p>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                  <div className="relative w-full sm:w-72">
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      className="block w-full pr-12 py-3 bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 dark:text-white font-medium shadow-inner text-sm"
                      placeholder={t('admin_search_course_placeholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  {/* Category Filter Pills */}
                  <div className="flex items-center p-1 bg-gray-100 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 w-full sm:w-auto overflow-x-auto">
                    <button
                      onClick={() => setCourseTypeFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        courseTypeFilter === 'all'
                          ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {isRTL ? 'الكل' : 'All'}
                    </button>
                    <button
                      onClick={() => setCourseTypeFilter('foundation')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        courseTypeFilter === 'foundation'
                          ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {isRTL ? 'كورسات التأسيس' : 'Foundation'}
                    </button>
                    <button
                      onClick={() => setCourseTypeFilter('grades')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        courseTypeFilter === 'grades'
                          ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {isRTL ? 'الصفوف الدراسية' : 'School Grades'}
                    </button>
                  </div>
                  
                  <Link 
                    to="/admin-dashboard/courses/new" 
                    className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/20 hover:shadow-blue-500/40 text-sm shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t('admin_add_course')}</span>
                  </Link>
                </div>
              </div>

              {filteredCourses.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-[#1E293B] rounded-3xl border border-gray-100 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
                  <div className="w-24 h-24 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                    <BookOpen className="w-10 h-10 text-gray-300 dark:slate-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('admin_no_courses')}</h3>
                  <p className="text-gray-500 dark:text-gray-400">{t('admin_no_courses_desc')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8">
                  {filteredCourses.map((course) => (
                    <div key={course.id} className="bg-white dark:bg-[#1E293B] rounded-3xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:shadow-2xl border border-gray-100 dark:border-slate-800 hover:border-blue-100 dark:hover:border-blue-900/50 transition-all duration-300 group flex flex-col hover:-translate-y-1.5">
                      
                      {/* Course Image Banner */}
                      <div className="relative h-48 w-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                        {course.image_url ? (
                          <img 
                            src={getDirectImageUrl(course.image_url)} 
                            alt={course.title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                            <BookOpen className="w-12 h-12 text-gray-300 dark:text-slate-700" />
                          </div>
                        )}
                        
                        {/* Status Badge overlay */}
                        <div className="absolute top-4 right-4">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 backdrop-blur-md shadow-lg ${course.is_published ? 'bg-white/90 text-green-700 dark:bg-slate-900/90 dark:text-green-400' : 'bg-white/90 text-gray-700 dark:bg-slate-900/90 dark:text-gray-300'}`}>
                            <span className={`w-2 h-2 rounded-full ${course.is_published ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                            {course.is_published ? t('admin_status_published') : t('admin_status_draft')}
                          </span>
                        </div>
                      </div>

                      {/* Course Info */}
                      <div className="p-6 flex flex-col flex-grow">
                        <div className="mb-3">
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800/50 shadow-sm">
                            {course.category || t('admin_uncategorized')}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 line-clamp-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {course.title}
                        </h3>
                        
                        <div className="mt-auto pt-6 flex items-center justify-between">
                          <span className="font-black text-2xl text-gray-900 dark:text-white">
                            {course.price > 0 ? `${course.price} ${t('admin_currency')}` : <span className="text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-lg text-lg">{t('admin_free')}</span>}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="px-6 pb-6 pt-0 flex gap-2">
                        <Link 
                          to={`/admin-dashboard/courses/${course.id}`} 
                          title={t('admin_manage_content')} 
                          className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-xl hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 transition-all font-bold text-sm shadow-sm"
                        >
                          <Video className="w-4 h-4" />
                          {t('admin_manage_content')}
                        </Link>
                        <Link 
                          to={`/admin-dashboard/courses/${course.id}/edit`} 
                          title={t('admin_edit')} 
                          className="w-12 flex items-center justify-center py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white dark:hover:bg-blue-500 transition-all shadow-sm"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button 
                          onClick={() => handleDeleteClick(course.id)} 
                          title={t('admin_delete')} 
                          className="w-12 flex items-center justify-center py-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl hover:bg-red-600 hover:text-white dark:hover:bg-red-500 transition-all shadow-sm cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          </FadeIn>
        )}

        {/* =========================================================================
            GAMIFICATION & STUDENT XP RULES HUB (TAB 3)
           ========================================================================= */}
        {activeTab === 'gamification' && (
          <FadeIn>
            <div className="space-y-10">
              
              {/* Gamification Engine Rules Controller */}
              <div className="bg-white dark:bg-[#1E293B] rounded-3xl p-7 sm:p-9 shadow-sm border border-amber-200/80 dark:border-amber-800/40 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500"></div>
                
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20 font-black">
                      <Sliders className="w-7 h-7" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                        <span>{isRTL ? 'لوحة التحكم في معايير وتوزيع نقاط الـ XP' : 'XP Points Distribution Rules Engine'}</span>
                        <Sparkles className="w-5 h-5 text-amber-500" />
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">
                        {isRTL 
                          ? 'حدد عدد النقاط (XP) التي يكتسبها الطلاب تلقائياً عند إنجاز الأنشطة والامتحانات والشهادات على المنصة' 
                          : 'Configure automated XP awarded to students upon completing lessons, quizzes, and certificates'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="submit"
                    form="xp-rules-form"
                    disabled={isSavingRules}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black text-sm shadow-md shadow-amber-500/20 hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSavingRules ? (isRTL ? 'جاري الحفظ...' : 'Saving...') : (isRTL ? 'حفظ وتطبيق القواعد' : 'Save & Apply Rules')}</span>
                  </button>
                </div>

                <form id="xp-rules-form" onSubmit={handleSaveXpRules}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    
                    {/* 1. Lesson Completion XP */}
                    <div className="p-5 rounded-2xl bg-gray-50/80 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-bold text-gray-800 dark:text-gray-200">
                          {isRTL ? '🎯 نقاط إكمال الدرس الواحد:' : 'Lesson Completion XP:'}
                        </label>
                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md">
                          {xpRules.lesson_completed} XP
                        </span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max="500"
                        value={xpRules.lesson_completed}
                        onChange={(e) => setXpRules({ ...xpRules, lesson_completed: Number(e.target.value) || 0 })}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-black text-lg focus:ring-2 focus:ring-amber-500 outline-none"
                      />
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
                        {isRTL ? 'تُمنح تلقائياً للطالب عند تحديد أي درس كمكتمل.' : 'Awarded when a student completes any lesson.'}
                      </p>
                    </div>

                    {/* 2. Quiz Passing XP */}
                    <div className="p-5 rounded-2xl bg-gray-50/80 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-bold text-gray-800 dark:text-gray-200">
                          {isRTL ? '📝 نقاط اجتياز الاختبار (50%+):' : 'Quiz Passing XP (50%+):'}
                        </label>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md">
                          {xpRules.quiz_passed} XP
                        </span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max="500"
                        value={xpRules.quiz_passed}
                        onChange={(e) => setXpRules({ ...xpRules, quiz_passed: Number(e.target.value) || 0 })}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-black text-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
                        {isRTL ? 'تُمنح عند الحصول على نسبة نجاح 50% فأكثر في الامتحان.' : 'Awarded when student scores 50% or higher.'}
                      </p>
                    </div>

                    {/* 3. Quiz Full Score Bonus */}
                    <div className="p-5 rounded-2xl bg-gray-50/80 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-bold text-gray-800 dark:text-gray-200">
                          {isRTL ? '🏆 مكافأة تقفيل الامتحان (100%):' : 'Full Quiz Score Bonus (100%):'}
                        </label>
                        <span className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-md">
                          {xpRules.quiz_full_score} XP
                        </span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max="1000"
                        value={xpRules.quiz_full_score}
                        onChange={(e) => setXpRules({ ...xpRules, quiz_full_score: Number(e.target.value) || 0 })}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-black text-lg focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
                        {isRTL ? 'مكافأة تميز تُمنح للطالب الذي يحصل على الدرجة النهائية كاملة.' : 'Awarded for scoring a perfect 100% on a quiz.'}
                      </p>
                    </div>

                    {/* 4. Course Completion Certificate Bonus */}
                    <div className="p-5 rounded-2xl bg-gray-50/80 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-bold text-gray-800 dark:text-gray-200">
                          {isRTL ? '📜 مكافأة إتمام الكورس والشهادة:' : 'Course Certificate Completion:'}
                        </label>
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-md">
                          {xpRules.course_completed} XP
                        </span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max="2000"
                        value={xpRules.course_completed}
                        onChange={(e) => setXpRules({ ...xpRules, course_completed: Number(e.target.value) || 0 })}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-black text-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
                        {isRTL ? 'مكافأة كبرى تُمنح عند إنهاء جميع دروس الكورس بنسبة 100%.' : 'Awarded when student finishes 100% of course lessons.'}
                      </p>
                    </div>

                    {/* 5. Notes & Summary XP */}
                    <div className="p-5 rounded-2xl bg-gray-50/80 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-800">
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-bold text-gray-800 dark:text-gray-200">
                          {isRTL ? '✍️ نقاط تدوين ملخص الدرس:' : 'Lesson Notes & Summary:'}
                        </label>
                        <span className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md">
                          {xpRules.notes_saved} XP
                        </span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max="200"
                        value={xpRules.notes_saved}
                        onChange={(e) => setXpRules({ ...xpRules, notes_saved: Number(e.target.value) || 0 })}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-black text-lg focus:ring-2 focus:ring-rose-500 outline-none"
                      />
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
                        {isRTL ? 'تحفيز كتابة الملاحظات المفيدة في دفتر ملخص الدرس.' : 'Encourages summarizing lessons in study notes.'}
                      </p>
                    </div>

                  </div>
                </form>
              </div>

              {/* All Students XP Leaderboard Table */}
              <div className="bg-white dark:bg-[#1E293B] rounded-3xl p-7 sm:p-9 shadow-sm border border-gray-100 dark:border-slate-800">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-8">
                  <div>
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3">
                      <Crown className="w-7 h-7 text-amber-500 fill-amber-400" />
                      <span>{isRTL ? 'سجل ترتيب ونقاط كافة طلاب المنصة' : 'Platform-Wide Student Leaderboard'}</span>
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {isRTL ? 'استعراض الترتيب الشامل لجميع الطلاب، والتحكم المباشر في منح وتعديل نقاط أي طالب' : 'Live ranking of all registered students with instant XP adjust controls'}
                    </p>
                  </div>

                  {/* Search and Filters */}
                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                    <div className="relative w-full sm:w-64">
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        className="block w-full pr-10 pl-3 py-2 bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                        placeholder={isRTL ? 'بحث باسم الطالب أو الإيميل...' : 'Search student...'}
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                      />
                    </div>

                    <button
                      onClick={fetchStudentsLeaderboard}
                      className="px-4 py-2 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      <Activity className="w-3.5 h-3.5 text-blue-500" />
                      <span>{isRTL ? 'تحديث الترتيب' : 'Refresh'}</span>
                    </button>
                  </div>
                </div>

                {/* Table */}
                {leaderboardLoading ? (
                  <div className="py-20 flex justify-center">
                    <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p>{isRTL ? 'لا يوجد طلاب مطابقون للبحث.' : 'No students found matching your search.'}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-start border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-slate-800 text-xs font-bold text-gray-500 dark:text-gray-400">
                          <th className="py-4 px-4 text-start">{isRTL ? 'الترتيب' : 'Rank'}</th>
                          <th className="py-4 px-4 text-start">{isRTL ? 'الطالب' : 'Student'}</th>
                          <th className="py-4 px-4 text-start">{isRTL ? 'الصف الدراسي' : 'Grade'}</th>
                          <th className="py-4 px-4 text-start">{isRTL ? 'المستوى والشارة' : 'Tier Badge'}</th>
                          <th className="py-4 px-4 text-start">{isRTL ? 'رصيد النقاط (XP)' : 'Total XP'}</th>
                          <th className="py-4 px-4 text-center">{isRTL ? 'إجراءات التحكم' : 'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                        {filteredStudents.map((student, index) => {
                          const rank = index + 1;
                          const badge = getStudentBadge(student.xp_points, isRTL);

                          return (
                            <tr key={student.id} className="hover:bg-gray-50/70 dark:hover:bg-slate-800/40 transition-colors">
                              {/* Rank */}
                              <td className="py-4 px-4 font-black">
                                {rank === 1 ? (
                                  <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 flex items-center justify-center font-black shadow-md text-xs">
                                    🥇 1
                                  </span>
                                ) : rank === 2 ? (
                                  <span className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-900 dark:text-slate-100 flex items-center justify-center font-black text-xs">
                                    🥈 2
                                  </span>
                                ) : rank === 3 ? (
                                  <span className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 flex items-center justify-center font-black text-xs">
                                    🥉 3
                                  </span>
                                ) : (
                                  <span className="text-gray-400 font-bold text-sm px-2">
                                    #{rank}
                                  </span>
                                )}
                              </td>

                              {/* Student Info */}
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black overflow-hidden shrink-0 border border-blue-200 dark:border-blue-900/40">
                                    {student.avatar_url ? (
                                      <img src={student.avatar_url} alt={student.full_name} className="w-full h-full object-cover" />
                                    ) : (
                                      <span>{(student.full_name || 'ط')[0]}</span>
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-extrabold text-sm text-gray-900 dark:text-white">
                                      {student.full_name || (isRTL ? 'طالب مجهول' : 'Student')}
                                    </p>
                                    <p className="text-xs text-gray-400 font-medium">
                                      {student.email}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              {/* Grade Level */}
                              <td className="py-4 px-4 text-xs font-bold text-gray-600 dark:text-gray-300">
                                {student.grade_level || (isRTL ? 'غير محدد' : 'Not set')}
                              </td>

                              {/* Tier Badge */}
                              <td className="py-4 px-4">
                                <span className={`inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-lg border bg-gradient-to-r ${badge.color}`}>
                                  {badge.title}
                                </span>
                              </td>

                              {/* Total Points */}
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-1.5 font-black text-base text-amber-600 dark:text-amber-400">
                                  <Flame className="w-4 h-4 fill-amber-500 text-amber-500" />
                                  <span>{student.xp_points || 0}</span>
                                  <span className="text-[10px] text-gray-400 font-bold">XP</span>
                                </div>
                              </td>

                              {/* Action: Adjust XP */}
                              <td className="py-4 px-4 text-center">
                                <button
                                  onClick={() => handleOpenAdjustModal(student)}
                                  className="px-3.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-600 hover:text-white text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                                >
                                  <PlusCircle className="w-3.5 h-3.5" />
                                  <span>{isRTL ? 'منح / تعديل نقاط' : 'Adjust XP'}</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          </FadeIn>
        )}

      </div>

      {/* Adjust Student XP Modal */}
      {adjustXpModal.isOpen && adjustXpModal.student && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100 dark:border-slate-700 relative">
            <button
              onClick={() => setAdjustXpModal({ isOpen: false, student: null, amount: 25, type: 'add', reason: '' })}
              className="absolute top-5 left-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {isRTL ? 'منح / تعديل نقاط الطالب' : 'Adjust Student Points'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {adjustXpModal.student.full_name} ({isRTL ? 'الرصيد الحالي:' : 'Current:'} <span className="font-bold text-amber-500">{adjustXpModal.student.xp_points || 0} XP</span>)
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-slate-700/60 rounded-xl">
                <button
                  type="button"
                  onClick={() => setAdjustXpModal({ ...adjustXpModal, type: 'add' })}
                  className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    adjustXpModal.type === 'add'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300'
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>{isRTL ? 'إضافة نقاط مكافأة (+)' : 'Add Bonus (+)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustXpModal({ ...adjustXpModal, type: 'subtract' })}
                  className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    adjustXpModal.type === 'subtract'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-300'
                  }`}
                >
                  <MinusCircle className="w-3.5 h-3.5" />
                  <span>{isRTL ? 'خصم نقاط (-)' : 'Deduct (-)'}</span>
                </button>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  {isRTL ? 'عدد النقاط (XP):' : 'Points Amount (XP):'}
                </label>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  value={adjustXpModal.amount}
                  onChange={(e) => setAdjustXpModal({ ...adjustXpModal, amount: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white font-black text-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Reason Input */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  {isRTL ? 'سبب المنح / الملاحظة (اختياري):' : 'Reason / Note (optional):'}
                </label>
                <input
                  type="text"
                  value={adjustXpModal.reason}
                  onChange={(e) => setAdjustXpModal({ ...adjustXpModal, reason: e.target.value })}
                  placeholder={isRTL ? 'مثلاً: مكافأة تفوق وإجابة نموذجية في الحصة' : 'e.g. Outstanding class participation'}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-white text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] font-bold text-gray-400">{isRTL ? 'قيم سريعة:' : 'Presets:'}</span>
                {[10, 25, 50, 100].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAdjustXpModal({ ...adjustXpModal, amount: val })}
                    className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-slate-700 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-blue-100 hover:text-blue-700 cursor-pointer"
                  >
                    +{val}
                  </button>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleConfirmAdjustXp}
                  disabled={isAdjustingXp}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {isAdjustingXp ? (isRTL ? 'جاري التحديث...' : 'Updating...') : (isRTL ? 'تطبيق وحفظ' : 'Confirm & Save')}
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustXpModal({ isOpen: false, student: null, amount: 25, type: 'add', reason: '' })}
                  className="px-5 py-3 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 font-bold text-sm hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, courseId: null })}
        onConfirm={confirmDeleteCourse}
        title={t('admin_delete_course_title')}
        message={t('admin_delete_course_msg')}
        confirmText={t('admin_confirm_delete')}
        cancelText={t('admin_cancel')}
        isDanger={true}
      />
    </div>
  );
}
