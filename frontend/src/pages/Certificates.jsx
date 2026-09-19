import { useTranslation } from 'react-i18next';
import { Award, ArrowRight, ArrowLeft, Download, Printer, Share2, CheckCircle, Clock, Sparkles, BookOpen, X, ShieldCheck, Eye, Users, Search, ExternalLink } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import FadeIn from '../components/FadeIn';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { calculateSubscriptionStatus } from '../utils/helpers';
import toast from 'react-hot-toast';
import { getCache, setCache } from '../utils/appCache';

export default function Certificates() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'teacher';
  const navigate = useNavigate();
  
  const cacheKey = user ? `certificates_${user.id}_${isAdmin ? 'admin' : 'student'}` : null;
  const cachedCertData = cacheKey ? getCache(cacheKey) : null;

  const [completedCertificates, setCompletedCertificates] = useState(cachedCertData?.completed || []);
  const [inProgressCourses, setInProgressCourses] = useState(cachedCertData?.inProgress || []);
  const [loading, setLoading] = useState(!cachedCertData);
  const [selectedCert, setSelectedCert] = useState(null);
  const [certTheme, setCertTheme] = useState('classic'); // 'classic' (Parchment & Gold) | 'royal' (Royal Navy & Gold)
  const certPrintRef = useRef(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchCertificatesData = async () => {
      try {
        if (!cachedCertData && completedCertificates.length === 0 && inProgressCourses.length === 0) {
          setLoading(true);
        }

        if (isAdmin) {
          // --- ADMIN / SUPERVISOR MODE ---
          // Fetch ALL completed student certificates across the platform
          const { data: subsData, error: subsError } = await supabase
            .from('subscriptions')
            .select(`
              id,
              user_id,
              course_id,
              status,
              created_at,
              profiles (
                id,
                full_name,
                avatar_url,
                grade_level,
                role
              ),
              courses (
                id,
                title,
                category
              )
            `)
            .eq('status', 'approved');

          if (subsError) throw subsError;

          // Exclude any staff/admin profiles from student certificates
          const studentSubs = (subsData || []).filter(
            s => s.profiles && s.profiles.role === 'student'
          );

          if (studentSubs.length > 0) {
            const courseIds = [...new Set(studentSubs.map(s => s.course_id))];
            const studentIds = [...new Set(studentSubs.map(s => s.user_id))];

            // Fetch lessons count for these courses
            const { data: lessonsData } = await supabase
              .from('lessons')
              .select('id, course_id')
              .in('course_id', courseIds);

            // Fetch lesson progress for these students
            const { data: progData } = await supabase
              .from('lesson_progress')
              .select('user_id, lesson_id, is_completed')
              .in('user_id', studentIds)
              .eq('is_completed', true);

            const lessonsCountByCourse = {};
            (lessonsData || []).forEach(l => {
              lessonsCountByCourse[l.course_id] = (lessonsCountByCourse[l.course_id] || 0) + 1;
            });

            // Completed lessons set per user
            const userCompletedLessons = {};
            (progData || []).forEach(p => {
              if (!userCompletedLessons[p.user_id]) userCompletedLessons[p.user_id] = new Set();
              userCompletedLessons[p.user_id].add(p.lesson_id);
            });

            const studentCertificatesList = [];
            studentSubs.forEach(sub => {
              const totalLessons = lessonsCountByCourse[sub.course_id] || 0;
              const completedCount = userCompletedLessons[sub.user_id]
                ? [...userCompletedLessons[sub.user_id]].filter(lId => {
                    return (lessonsData || []).some(l => l.id === lId && l.course_id === sub.course_id);
                  }).length
                : 0;

              if (totalLessons > 0 && completedCount >= totalLessons) {
                const certId = `MAD-2026-${sub.course_id.slice(0, 4).toUpperCase()}-${sub.user_id.slice(0, 4).toUpperCase()}`;
                studentCertificatesList.push({
                  id: certId,
                  courseId: sub.course_id,
                  courseName: sub.courses?.title || 'كورس تعليمي',
                  category: sub.courses?.category,
                  studentId: sub.user_id,
                  studentName: sub.profiles?.full_name || 'طالب متميز',
                  studentAvatar: sub.profiles?.avatar_url,
                  gradeLevel: sub.profiles?.grade_level,
                  issueDate: new Date(sub.created_at || Date.now()).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }),
                  totalLessons: totalLessons
                });
              }
            });

            setCompletedCertificates(studentCertificatesList);
            if (cacheKey) setCache(cacheKey, { completed: studentCertificatesList, inProgress: [] }, 300);
          } else {
            setCompletedCertificates([]);
            if (cacheKey) setCache(cacheKey, { completed: [], inProgress: [] }, 300);
          }
          setInProgressCourses([]);
        } else {
          // --- STUDENT MODE ---
          // Fetch student's own approved subscriptions & course details
          const { data: subsData, error: subsError } = await supabase
            .from('subscriptions')
            .select(`
              id,
              course_id,
              status,
              created_at,
              expires_at,
              courses (
                id,
                title,
                category,
                access_duration_days
              )
            `)
            .eq('user_id', user.id)
            .eq('status', 'approved');

          if (subsError) throw subsError;

          if (subsData && subsData.length > 0) {
            const uniqueCoursesMap = new Map();
            subsData.forEach(s => {
              if (s.courses) {
                const calc = calculateSubscriptionStatus(s, s.courses.access_duration_days);
                const existing = uniqueCoursesMap.get(s.courses.id);
                if (!existing || calc.isActive) {
                  uniqueCoursesMap.set(s.courses.id, {
                    ...s.courses,
                    subStatus: calc
                  });
                }
              }
            });

            const courseIds = Array.from(uniqueCoursesMap.keys());

            const { data: lessonsData } = await supabase
              .from('lessons')
              .select('id, course_id, title, order_index')
              .in('course_id', courseIds);

            const { data: progData } = await supabase
              .from('lesson_progress')
              .select('lesson_id, updated_at')
              .eq('user_id', user.id)
              .eq('is_completed', true);

            const completedLessonsSet = new Set((progData || []).map(p => p.lesson_id));

            const lessonsByCourse = {};
            (lessonsData || []).forEach(l => {
              if (!lessonsByCourse[l.course_id]) lessonsByCourse[l.course_id] = [];
              lessonsByCourse[l.course_id].push(l);
            });

            const completed = [];
            const inProgress = [];

            uniqueCoursesMap.forEach((course, courseId) => {
              const courseLessons = lessonsByCourse[courseId] || [];
              const total = courseLessons.length;
              const completedCount = courseLessons.filter(l => completedLessonsSet.has(l.id)).length;
              const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0;

              if (total > 0 && completedCount === total) {
                const certId = `MAD-2026-${courseId.slice(0, 4).toUpperCase()}-${user.id.slice(0, 4).toUpperCase()}`;
                completed.push({
                  id: certId,
                  courseId: course.id,
                  courseName: course.title,
                  category: course.category,
                  issueDate: new Date().toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }),
                  studentName: profile?.full_name || user?.email,
                  totalLessons: total
                });
              } else if (total > 0) {
                inProgress.push({
                  courseId: course.id,
                  courseName: course.title,
                  completedLessons: completedCount,
                  totalLessons: total,
                  progress: progress
                });
              }
            });

            setCompletedCertificates(completed);
            setInProgressCourses(inProgress);
            if (cacheKey) setCache(cacheKey, { completed, inProgress }, 300);
          } else {
            setCompletedCertificates([]);
            setInProgressCourses([]);
            if (cacheKey) setCache(cacheKey, { completed: [], inProgress: [] }, 300);
          }
        }
      } catch (error) {
        console.error('Error fetching certificates:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCertificatesData();
  }, [user, profile, navigate, isRTL, isAdmin]);

  const handlePrintCertificate = () => {
    window.print();
  };

  const handleShareCertificate = (cert) => {
    const text = isRTL
      ? `🎉 شهادة إتمام دورة "${cert.courseName}" للطالب ${cert.studentName} من منصة منارة الضاد التعليمية! كود الاعتماد: ${cert.id}`
      : `🎉 Certificate of Completion for "${cert.courseName}" awarded to ${cert.studentName} from Manarat Al-Daad Platform! Code: ${cert.id}`;

    if (navigator.share) {
      navigator.share({
        title: isRTL ? 'شهادة إتمام معتمدة' : 'Certificate of Completion',
        text: text,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      toast.success(isRTL ? 'تم نسخ بيانات الشهادة للحافظة!' : 'Certificate info copied to clipboard!');
    }
  };

  // Demo Certificate for Admin to preview & test anytime
  const handleOpenDemoCert = () => {
    setSelectedCert({
      id: 'MAD-2026-DEMO-SAMPLE',
      courseId: 'demo-sample-course',
      courseName: isRTL ? 'دورة تأسيس النحو العربي والبلاغة الشاملة' : 'Arabic Grammar & Rhetoric Comprehensive Course',
      category: isRTL ? 'تأسيس اللغة العربية' : 'Arabic Foundation',
      issueDate: new Date().toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      studentName: isRTL ? 'أحمد محمد علي (نموذج طالب معتمد)' : 'Ahmed Mohamed Ali (Accredited Demo)',
      totalLessons: 18,
      isDemo: true
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-12 font-arabic print:p-0 print:m-0 print:bg-white print:min-h-0">
      {/* Background Page Content - Hidden on Print */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 print:hidden">
        
        {/* Header */}
        <div className="mb-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link 
              to={isAdmin ? "/admin-dashboard" : "/dashboard"} 
              className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white dark:bg-slate-800 text-gray-500 hover:text-blue-600 shadow-sm transition-colors border border-gray-100 dark:border-slate-700"
              title={isAdmin ? (isRTL ? 'العودة للوحة الإدارة' : 'Back to Admin') : (isRTL ? 'العودة للوحة التحكم' : 'Back to Dashboard')}
            >
              {isRTL ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
            </Link>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2.5">
                  <span>{isAdmin ? (isRTL ? 'سجل واعتماد شهادات الطلاب' : 'Student Certificates Registry') : t('certs_title')}</span>
                  <Award className="w-7 h-7 text-amber-500" />
                </h1>
                {isAdmin && (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50">
                    {isRTL ? 'حساب الإدارة والمعلم' : 'Instructor Oversight'}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isAdmin
                  ? (isRTL ? 'مركز إشراف ومراجعة الشهادات الرقمية المكتملة والمعتمدة لطلاب منصة منارة الضاد' : 'Administrative center to inspect, verify, and print accredited student certificates')
                  : (isRTL ? 'شهادات التخرج الرقمية المعتمدة لكورساتك المكتملة بنسبة 100%' : 'Verified digital certificates of completion for your 100% finished courses')}
              </p>
            </div>
          </div>

          {/* Admin Header Actions */}
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <button
                onClick={handleOpenDemoCert}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-bold text-sm shadow-md shadow-amber-500/20 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 fill-slate-950" />
                <span>{isRTL ? 'معاينة نموذج الشهادة المعتمد' : 'Preview Accredited Template'}</span>
              </button>
              <Link
                to="/admin-dashboard"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:border-blue-500 text-gray-700 dark:text-gray-300 font-bold text-sm shadow-sm transition-all"
              >
                <span>{isRTL ? 'لوحة الإدارة' : 'Admin Panel'}</span>
              </Link>
            </div>
          )}
        </div>

        {/* Admin Executive Stat Summary Bar */}
        {isAdmin && (
          <FadeIn>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-gray-100 dark:border-slate-700/60 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center font-bold">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400">{isRTL ? 'الشهادات المكتملة الممنوحة للطلاب' : 'Issued Student Certificates'}</p>
                  <p className="text-2xl font-black text-gray-900 dark:text-white mt-0.5">{completedCertificates.length}</p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-gray-100 dark:border-slate-700/60 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400">{isRTL ? 'صلاحية الاعتماد الرقمي' : 'Accreditation Status'}</p>
                  <p className="text-sm font-black text-gray-900 dark:text-white mt-0.5">{isRTL ? 'ختم رسمي وتوقيع المعلم المعتمد' : 'Official Platform Digital Seal'}</p>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-gray-100 dark:border-slate-700/60 shadow-sm flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center font-bold">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400">{isRTL ? 'نظام التحقق المشفر' : 'Verification System'}</p>
                  <p className="text-sm font-black text-gray-900 dark:text-white mt-0.5">{isRTL ? 'كود تسلسلي رقمي لكل شهادة' : 'Unique QR & Serial IDs'}</p>
                </div>
              </div>
            </div>
          </FadeIn>
        )}

        {loading ? (
          <div className="flex justify-center p-20">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : completedCertificates.length > 0 ? (
          <div className="space-y-12">
            {/* Certificates Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {completedCertificates.map((cert) => (
                <FadeIn key={cert.id}>
                  <div className="bg-white dark:bg-slate-800 rounded-3xl p-7 shadow-md border border-amber-200/60 dark:border-amber-900/40 hover:shadow-xl hover:border-amber-400 transition-all flex flex-col justify-between relative overflow-hidden group">
                    {/* Corner Ribbon */}
                    <div className="absolute top-0 right-0 w-28 h-28 overflow-hidden pointer-events-none">
                      <div className="absolute transform rotate-45 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-[10px] py-1 right-[-35px] top-[20px] w-[120px] text-center shadow-md">
                        {isRTL ? 'معتمدة 100%' : 'VERIFIED'}
                      </div>
                    </div>

                    <div>
                      <div className="w-16 h-16 bg-gradient-to-tr from-amber-500/20 to-yellow-300/20 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mb-5 text-amber-500 border border-amber-300 dark:border-amber-700/50 shadow-inner group-hover:scale-105 transition-transform">
                        <Award className="w-9 h-9" />
                      </div>
                      
                      <div className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">
                        {isRTL ? 'شهادة إتمام معتمدة' : 'Certificate of Completion'}
                      </div>
                      <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2 line-clamp-2">
                        {cert.courseName}
                      </h3>

                      {/* Recipient Student Info */}
                      <div className="flex items-center gap-2 mb-4 bg-blue-50/70 dark:bg-blue-900/20 px-3 py-2 rounded-xl border border-blue-100 dark:border-blue-900/40">
                        <Users className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span className="text-xs font-bold text-blue-950 dark:text-blue-200 line-clamp-1">
                          {isRTL ? 'الطالب الممنوح له:' : 'Awarded To:'} <span className="font-black text-blue-700 dark:text-blue-300">{cert.studentName}</span>
                        </span>
                      </div>
                      
                      <div className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400 mb-6 bg-gray-50 dark:bg-slate-700/40 p-3.5 rounded-xl border border-gray-100 dark:border-slate-700">
                        <p className="flex items-center justify-between">
                          <span>{t('certs_issue_date')}:</span>
                          <span className="font-bold text-gray-700 dark:text-gray-300">{cert.issueDate}</span>
                        </p>
                        <p className="flex items-center justify-between">
                          <span>{isRTL ? 'كود التحقق:' : 'Verify Code:'}</span>
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{cert.id}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        onClick={() => setSelectedCert(cert)}
                        className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 text-sm cursor-pointer"
                      >
                        <Award className="w-4 h-4" />
                        <span>{isAdmin ? (isRTL ? 'معاينة وطباعة الشهادة' : 'Inspect & Print') : t('certs_view_btn')}</span>
                      </button>
                      <button
                        onClick={() => handleShareCertificate(cert)}
                        title={isRTL ? 'مشاركة' : 'Share'}
                        className="p-3 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-xl transition-colors cursor-pointer"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>

            {/* Courses In Progress Section (STUDENTS ONLY) */}
            {!isAdmin && inProgressCourses.length > 0 && (
              <div className="pt-8 border-t border-gray-200 dark:border-slate-800">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-500" />
                  <span>{isRTL ? 'دورات قيد التقدم لنيل الشهادة' : 'Courses in Progress'}</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {inProgressCourses.map((c) => (
                    <div key={c.courseId} className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700/50 shadow-sm flex flex-col justify-between">
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-white mb-2 line-clamp-1">{c.courseName}</h4>
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                          <span>{isRTL ? `${c.completedLessons} من ${c.totalLessons} دروس منجزة` : `${c.completedLessons} of ${c.totalLessons} lessons done`}</span>
                          <span className="font-bold text-blue-600 dark:text-blue-400">{c.progress}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden mb-4">
                          <div className="h-full bg-blue-600 rounded-full" style={{ width: `${c.progress}%` }}></div>
                        </div>
                      </div>
                      <Link
                        to={`/course/${c.courseId}`}
                        className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <span>{isRTL ? 'متابعة التعلم وإكمال الدروس ←' : 'Continue learning ←'}</span>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Empty States */
          <FadeIn>
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-10 sm:p-14 text-center shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col items-center justify-center max-w-2xl mx-auto">
              <div className="w-24 h-24 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mb-6 text-amber-500 border border-amber-200 dark:border-amber-800 shadow-inner">
                <Award className="w-12 h-12" />
              </div>

              {isAdmin ? (
                /* Admin Supervisor Empty State */
                <>
                  <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-3">
                    {isRTL ? 'سجل الشهادات بانتظار إتمام الطلاب لكورساتهم' : 'Student Certificate Registry is Ready'}
                  </h3>
                  <p className="text-base text-gray-500 dark:text-gray-400 mb-8 leading-relaxed max-w-lg">
                    {isRTL
                      ? 'لا توجد شهادات ممنوحة للطلاب حتى الآن. فور إكمال أي طالب مسجل لجميع دروس وتطبيقات أي كورس بنسبة 100%، ستُدرج شهادته المعتمدة في هذا السجل فوراً للاعتماد والمراجعة والطباعة.'
                      : 'No student certificates have been issued yet. Once any student finishes 100% of their enrolled coursework, their accredited certificate will appear here automatically for review and printing.'}
                  </p>
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <button
                      onClick={handleOpenDemoCert}
                      className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black rounded-xl transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
                    >
                      <Sparkles className="w-5 h-5 fill-slate-950" />
                      <span>{isRTL ? 'معاينة وتجربة نموذج الشهادة الرسمي' : 'Preview Official Certificate Template'}</span>
                    </button>
                    <Link
                      to="/admin-dashboard"
                      className="inline-flex items-center gap-2 px-6 py-3.5 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 font-bold rounded-xl transition-colors"
                    >
                      <span>{isRTL ? 'العودة لمركز الإدارة' : 'Back to Operations'}</span>
                    </Link>
                  </div>
                </>
              ) : (
                /* Student Empty State */
                <>
                  <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-3">
                    {t('certs_empty_title')}
                  </h3>
                  <p className="text-base text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                    {isRTL 
                      ? 'للحصول على شهادة معتمدة موثقة باسمك، أكمل جميع دروس وتطبيقات الدورة التعليمية بنسبة 100% وستظهر شهادتك هنا فوراً!'
                      : t('certs_empty_desc')}
                  </p>

                  {inProgressCourses.length > 0 && (
                    <div className="w-full mb-8 text-start bg-gray-50 dark:bg-slate-700/40 p-5 rounded-2xl border border-gray-200 dark:border-slate-700">
                      <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-500" />
                        <span>{isRTL ? 'كورساتك الجارية (أنت على وشك التخرج!):' : 'Your in-progress courses:'}</span>
                      </h4>
                      <div className="space-y-3">
                        {inProgressCourses.map(c => (
                          <div key={c.courseId} className="space-y-1">
                            <div className="flex justify-between text-xs font-medium text-gray-600 dark:text-gray-300">
                              <span className="line-clamp-1">{c.courseName}</span>
                              <span className="font-bold text-blue-600 dark:text-blue-400">{c.progress}%</span>
                            </div>
                            <div className="w-full h-2 bg-gray-200 dark:bg-slate-600 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-600 rounded-full" style={{ width: `${c.progress}%` }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Link 
                    to="/courses"
                    className="inline-flex items-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-blue-500/20"
                  >
                    <BookOpen className="w-5 h-5" />
                    <span>{t('certs_browse_courses')}</span>
                  </Link>
                </>
              )}
            </div>
          </FadeIn>
        )}
      </div>

      {/* Luxury Certificate Modal */}
      {selectedCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto print:fixed print:inset-0 print:p-0 print:m-0 print:bg-white print:overflow-hidden print:z-[999999]">
          <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden border border-amber-300 dark:border-amber-800 my-8 print:m-0 print:p-0 print:max-w-none print:w-full print:h-full print:border-none print:rounded-none print:shadow-none print:bg-transparent">
            
            {/* Top Modal Controls */}
            <div className="p-3.5 sm:px-8 sm:py-4 bg-gray-100 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 no-print print:hidden">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300 truncate">
                      {selectedCert.isDemo 
                        ? (isRTL ? 'معاينة نموذج الشهادة المعتمد للمنصة' : 'Previewing Official Accredited Template')
                        : (isRTL ? 'شهادة رقمية موثقة ومعتمدة' : 'Verified Digital Certificate')}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedCert(null)}
                    className="sm:hidden w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300 flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2.5 flex-wrap">
                  {/* Theme Selector */}
                  <div className="flex items-center gap-1.5 p-1 bg-gray-200 dark:bg-slate-700 rounded-xl">
                    <button
                      onClick={() => setCertTheme('classic')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        certTheme === 'classic'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <span>📜</span>
                      <span>{isRTL ? 'عاجي' : 'Classic'}</span>
                    </button>
                    <button
                      onClick={() => setCertTheme('royal')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        certTheme === 'royal'
                          ? 'bg-slate-900 text-amber-300 shadow-sm border border-amber-500/40'
                          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <span>🌌</span>
                      <span>{isRTL ? 'ملوكي' : 'Royal'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrintCertificate}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow transition-colors cursor-pointer"
                    >
                      <Printer className="w-4 h-4 shrink-0" />
                      <span>{isRTL ? 'طباعة / حفظ PDF' : 'Print / Save PDF'}</span>
                    </button>
                    <button
                      onClick={() => setSelectedCert(null)}
                      className="hidden sm:flex w-9 h-9 rounded-full bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300 items-center justify-center hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer shrink-0"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Printable Luxury Certificate Frame */}
              <div className="p-2 sm:p-6 overflow-x-auto bg-slate-900/10 dark:bg-black/30 flex items-center justify-center" ref={certPrintRef}>
                <div 
                  id="printable-certificate" 
                  className={`w-full max-w-4xl mx-auto rounded-3xl border-[8px] sm:border-[10px] shadow-2xl text-center relative overflow-hidden transition-colors flex flex-col justify-between ${
                    certTheme === 'classic'
                      ? 'bg-[#FCFAF6] border-[#9A6B2F] text-slate-900'
                      : 'bg-[#0B1120] border-[#D97706] text-slate-100'
                  }`}
                  style={{ minHeight: '520px' }}
                >
                  
                  {/* Decorative Inner Border Frame */}
                  <div className={`w-full h-full rounded-2xl border-2 p-4 sm:p-6 relative flex flex-col justify-between flex-1 ${
                    certTheme === 'classic' ? 'border-[#D4AF37]/70' : 'border-[#F59E0B]/50'
                  }`}>

                    {/* Corner Ornaments */}
                    <div className={`absolute top-2 left-2 w-6 h-6 border-t-4 border-l-4 ${certTheme === 'classic' ? 'border-[#9A6B2F]' : 'border-[#F59E0B]'}`}></div>
                    <div className={`absolute top-2 right-2 w-6 h-6 border-t-4 border-r-4 ${certTheme === 'classic' ? 'border-[#9A6B2F]' : 'border-[#F59E0B]'}`}></div>
                    <div className={`absolute bottom-2 left-2 w-6 h-6 border-b-4 border-l-4 ${certTheme === 'classic' ? 'border-[#9A6B2F]' : 'border-[#F59E0B]'}`}></div>
                    <div className={`absolute bottom-2 right-2 w-6 h-6 border-b-4 border-r-4 ${certTheme === 'classic' ? 'border-[#9A6B2F]' : 'border-[#F59E0B]'}`}></div>

                    {/* Header */}
                    <div className={`flex items-center justify-between border-b pb-3 mb-4 flex-shrink-0 ${
                      certTheme === 'classic' ? 'border-[#9A6B2F]/30' : 'border-amber-500/30'
                    }`}>
                      <div className="text-start">
                        <p className={`text-[11px] font-bold ${certTheme === 'classic' ? 'text-[#334155]' : 'text-slate-300'}`}>جمهورية مصر العربية</p>
                        <p className={`text-[10px] font-medium ${certTheme === 'classic' ? 'text-[#64748B]' : 'text-slate-400'}`}>منصة منارة الضاد التعليمية</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center shadow-md text-slate-950 font-black text-xl">
                          ض
                        </div>
                        <div className="text-start">
                          <h2 className={`text-lg font-black tracking-tight leading-none ${
                            certTheme === 'classic' ? 'text-[#0F172A]' : 'text-white'
                          }`}>
                            مَنَارَةُ الضَّادِ
                          </h2>
                          <span className="text-[9px] text-amber-600 dark:text-amber-400 font-extrabold tracking-wider">
                            MANARAT AL-DAAD ACADEMY
                          </span>
                        </div>
                      </div>

                      <div className="text-end">
                        <p className={`text-[10px] font-bold mb-0.5 ${certTheme === 'classic' ? 'text-[#334155]' : 'text-slate-300'}`}>
                          {isRTL ? 'كود الاعتماد الرقمي:' : 'Accreditation ID:'}
                        </p>
                        <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                          certTheme === 'classic'
                            ? 'bg-blue-50 text-[#1D4ED8] border-blue-200'
                            : 'bg-slate-800 text-[#93C5FD] border-blue-500/40'
                        }`}>
                          {selectedCert.id}
                        </span>
                      </div>
                    </div>

                    {/* Certificate Core Body */}
                    <div className="my-auto flex flex-col justify-center py-2 flex-1">
                      {/* Badge & Title */}
                      <div className="mb-3">
                        <span className={`inline-block px-4 py-1 rounded-full text-[11px] font-black tracking-wider uppercase mb-2 border shadow-sm ${
                          certTheme === 'classic'
                            ? 'bg-[#FEF3C7] text-[#78350F] border-[#D97706]'
                            : 'bg-[#78350F]/50 text-[#FDE68A] border-[#F59E0B]'
                        }`}>
                          {isRTL ? 'شهادة إتمام واجتياز معتمدة' : 'Certificate of Academic Completion'}
                        </span>
                        <h1 className={`text-2xl sm:text-3xl font-black tracking-tight ${
                          certTheme === 'classic'
                            ? 'text-[#0F172A]'
                            : 'text-transparent bg-clip-text bg-gradient-to-r from-[#FDE68A] via-[#F59E0B] to-[#FDE68A]'
                        }`}>
                          {isRTL ? 'شَهَادَةُ تَخَرُّجٍ وَتَفَوُّق' : 'CERTIFICATE OF ACHIEVEMENT'}
                        </h1>
                        <div className="w-24 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent mx-auto mt-1"></div>
                      </div>

                      {/* Student Dedication */}
                      <div className={`max-w-2xl mx-auto space-y-2 text-sm sm:text-base leading-relaxed ${
                        certTheme === 'classic' ? 'text-[#334155]' : 'text-[#CBD5E1]'
                      }`}>
                        <p className="font-bold">
                          {isRTL ? 'تشهد إدارة منصة' : 'This is to certify that'} <span className={`font-black ${
                            certTheme === 'classic' ? 'text-[#B45309]' : 'text-[#FCD34D]'
                          }`}>منارة الضاد</span> {isRTL ? 'والأستاذ' : 'and Mr.'} <span className={`font-black ${
                            certTheme === 'classic' ? 'text-[#0F172A]' : 'text-white'
                          }`}>سيد غريب</span> {isRTL ? 'بأن الطالب/ـة المتميز/ة:' : 'certify that the student:'}
                        </p>
                        
                        <div className="py-1">
                          <span className={`inline-block text-2xl sm:text-3xl font-black px-8 py-1 border-b-2 tracking-wide ${
                            certTheme === 'classic'
                              ? 'text-[#1D4ED8] border-[#D97706]'
                              : 'text-[#60A5FA] border-[#F59E0B]'
                          }`}>
                            {selectedCert.studentName}
                          </span>
                        </div>

                        <p className="font-bold text-xs sm:text-sm">
                          {isRTL 
                            ? 'قد أتم/ت بنجاح واقتدار كافة المتطلبات التدريبية والتطبيقات والاختبارات المقررة لدراسة كورس:'
                            : 'has successfully completed all requirements and coursework for:'}
                        </p>

                        <div>
                          <h3 className={`text-base sm:text-lg font-black py-1.5 px-6 rounded-xl border inline-block shadow-sm ${
                            certTheme === 'classic'
                              ? 'text-[#78350F] bg-[#FEF3C7] border-[#D97706]'
                              : 'text-[#FDE68A] bg-[#1E293B] border-[#F59E0B]'
                          }`}>
                            {selectedCert.courseName}
                          </h3>
                        </div>

                        <p className={`text-[11px] font-medium pt-1 ${
                          certTheme === 'classic' ? 'text-[#64748B]' : 'text-[#94A3B8]'
                        }`}>
                          {isRTL 
                            ? `بمعدل إنجاز كامل (100%) لجميع الدروس المقررة (${selectedCert.totalLessons} دروس) واجتياز تقييمات المنصة بنجاح.`
                            : `With a 100% completion rate across all ${selectedCert.totalLessons} lessons and platform assessments.`}
                        </p>
                      </div>
                    </div>

                    {/* Footer Signatures and Seals */}
                    <div className={`pt-3 border-t flex items-end justify-between flex-shrink-0 ${
                      certTheme === 'classic' ? 'border-[#9A6B2F]/30' : 'border-amber-500/30'
                    }`}>
                      {/* Left Signature: General Supervisor (Mr. Mohamed Ghanem) */}
                      <div className="text-start">
                        <p className={`text-[10px] font-bold ${
                          certTheme === 'classic' ? 'text-[#64748B]' : 'text-[#94A3B8]'
                        }`}>
                          {isRTL ? 'إدارة المنصة والإشراف العام:' : 'General Supervision:'}
                        </p>
                        <p className={`text-sm sm:text-base font-black font-arabic mt-0.5 ${
                          certTheme === 'classic' ? 'text-[#0F172A]' : 'text-white'
                        }`}>
                          أ. محمد غانم
                        </p>
                        <p className={`text-[9px] font-medium mt-0.5 ${
                          certTheme === 'classic' ? 'text-[#64748B]' : 'text-[#94A3B8]'
                        }`}>
                          {isRTL ? `تاريخ المنح: ${selectedCert.issueDate}` : `Issued: ${selectedCert.issueDate}`}
                        </p>
                      </div>

                      {/* Golden Wax Stamp Simulation (Center) */}
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-500 p-0.5 shadow-xl flex items-center justify-center transform rotate-3 border border-amber-300">
                        <div className="w-full h-full rounded-full border border-dashed border-amber-900 flex flex-col items-center justify-center text-slate-950 font-black p-1 text-center shadow-inner">
                          <Award className="w-5 h-5 fill-slate-950" />
                          <span className="text-[7px] leading-tight font-extrabold uppercase mt-0.5">معتمد رسمياً</span>
                          <span className="text-[6px]">VERIFIED</span>
                        </div>
                      </div>

                      {/* Right Signature: Expert Teacher (Mr. Sayed Gharieb) */}
                      <div className="text-end">
                        <p className={`text-[10px] font-bold ${
                          certTheme === 'classic' ? 'text-[#64748B]' : 'text-[#94A3B8]'
                        }`}>
                          {isRTL ? 'المعلم الخبير ومعد المنهج:' : 'Course Instructor:'}
                        </p>
                        <p className={`text-sm sm:text-base font-black font-arabic mt-0.5 ${
                          certTheme === 'classic' ? 'text-[#0F172A]' : 'text-white'
                        }`}>
                          أ. سيد غريب
                        </p>
                        <p className={`text-[10px] font-bold ${
                          certTheme === 'classic' ? 'text-[#B45309]' : 'text-[#FCD34D]'
                        }`}>
                          {isRTL ? 'معلم خبير لغة عربية' : 'Expert Arabic Teacher'}
                        </p>
                      </div>
                    </div>

                  </div>

                </div>
              </div>

            </div>
          </div>
        )}

    </div>
  );
}
