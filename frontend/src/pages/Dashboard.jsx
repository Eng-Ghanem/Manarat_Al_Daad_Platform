import { useTranslation } from 'react-i18next';
import { BookOpen, Award, Settings, User, LogOut, PlayCircle, Clock, Loader, ClipboardList, AlertCircle, RefreshCw, CheckCircle2, Star, Sparkles, Trophy, Flame } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import FadeIn from '../components/FadeIn';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { calculateSubscriptionStatus } from '../utils/helpers';
import { useReview } from '../context/ReviewContext';
import Leaderboard from '../components/Leaderboard';
import toast from 'react-hot-toast';
import { getCache, setCache } from '../utils/appCache';

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { user, profile, logout } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'teacher';
  const { openReviewModal, hasUserReviewed } = useReview();
  const navigate = useNavigate();
  
  const handleLogout = () => {
    logout();
    navigate('/welcome');
  };
  
  const cacheKey = user ? `dashboard_data_${user.id}` : null;
  const cachedData = cacheKey ? getCache(cacheKey) : null;

  const [activeCourses, setActiveCourses] = useState(cachedData?.active || []);
  const [expiredCourses, setExpiredCourses] = useState(cachedData?.expired || []);
  const [completedCertificates, setCompletedCertificates] = useState(cachedData?.completedCertsCount || 0);
  const [loading, setLoading] = useState(!cachedData);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchDashboardData = async () => {
      try {
        if (!cachedData && activeCourses.length === 0 && expiredCourses.length === 0) {
          setLoading(true);
        }
        // Fetch subscriptions with course details
        const { data: subsData, error: subsError } = await supabase
          .from('subscriptions')
          .select(`
            id,
            course_id,
            status,
            created_at,
            courses (
              id,
              title,
              access_duration_days
            )
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (subsError) throw subsError;

        if (subsData) {
          const active = [];
          const expired = [];
          const seenCourseIds = new Set();
          const activeCourseIds = [];

          for (const sub of subsData) {
            if (!sub.courses || seenCourseIds.has(sub.course_id)) continue;
            seenCourseIds.add(sub.course_id);

            const statusObj = calculateSubscriptionStatus(sub, sub.courses.access_duration_days);

            if (statusObj.isActive) {
              active.push({
                id: sub.courses.id,
                title: sub.courses.title,
                progress: 0,
                lastLesson: t('dash_first_lesson') || (isRTL ? 'الدرس الأول' : 'First Lesson'),
                statusText: statusObj.statusText,
                isExpiringSoon: statusObj.isExpiringSoon,
                remainingDays: statusObj.remainingDays
              });
              activeCourseIds.push(sub.courses.id);
            } else if (statusObj.isExpired) {
              expired.push({
                id: sub.courses.id,
                title: sub.courses.title,
                expiryDate: statusObj.expiryDate,
                statusText: t('dash_expired_badge') || (isRTL ? 'منتهي الصلاحية' : 'Expired')
              });
            }
          }

          // Fetch lesson progress for active courses to compute real progress
          let completedCertsCount = 0;
          if (activeCourseIds.length > 0) {
            const { data: lessonsData } = await supabase
              .from('lessons')
              .select('id, course_id, title, order_index')
              .in('course_id', activeCourseIds)
              .order('order_index', { ascending: true });

            const { data: progData } = await supabase
              .from('lesson_progress')
              .select('lesson_id')
              .eq('user_id', user.id)
              .eq('is_completed', true);

            const completedLessonsSet = new Set((progData || []).map(p => p.lesson_id));

            const lessonsMap = {};
            (lessonsData || []).forEach(l => {
              if (!lessonsMap[l.course_id]) lessonsMap[l.course_id] = [];
              lessonsMap[l.course_id].push(l);
            });

            active.forEach(course => {
              const cLessons = lessonsMap[course.id] || [];
              const totalLessons = cLessons.length;
              const completedCount = cLessons.filter(l => completedLessonsSet.has(l.id)).length;
              course.progress = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;
              
              const nextLessonObj = cLessons.find(l => !completedLessonsSet.has(l.id));
              if (nextLessonObj) {
                course.lastLesson = nextLessonObj.title;
              } else if (totalLessons > 0 && completedCount === totalLessons) {
                course.lastLesson = isRTL ? 'مكتمل بالكامل 🎉' : 'Fully Completed 🎉';
              }

              if (totalLessons > 0 && completedCount === totalLessons) {
                completedCertsCount++;
              }
            });
          }

          setActiveCourses(active);
          setExpiredCourses(expired);
          setCompletedCertificates(completedCertsCount);

          if (cacheKey) {
            setCache(cacheKey, { active, expired, completedCertsCount }, 300);
          }
        }

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user, navigate, isRTL]);
  
  const studentName = profile?.full_name || user?.email || '';

  const scrollToLeaderboard = () => {
    const el = document.getElementById('leaderboard-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header / Welcome Section */}
        <FadeIn>
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-slate-700/50 mb-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[80px] rounded-full pointer-events-none"></div>
            
            <div className="flex items-center gap-6 relative z-10">
              <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center border-4 border-white dark:border-slate-700 shadow-md">
                <User className="w-10 h-10 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white font-arabic tracking-tight mb-1 sm:mb-2">
                  {t('dash_welcome')} {studentName} 👋
                </h1>
                <p className="text-xs sm:text-base text-gray-500 dark:text-gray-400">
                  {t('dash_subtitle')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 relative z-10 w-full sm:w-auto mt-3 sm:mt-0">
              <Link to="/settings" className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-xl text-gray-700 dark:text-white font-bold transition-colors text-xs sm:text-sm">
                <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>{t('dash_settings')}</span>
              </Link>
              <button 
                onClick={handleLogout}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl font-bold transition-colors text-xs sm:text-sm"
              >
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>{t('dash_logout')}</span>
              </button>
            </div>
          </div>
        </FadeIn>

        {/* Stats Grid - 2x2 on Mobile, 4 Columns on Desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-8">
          <FadeIn>
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 sm:p-6 shadow-sm border border-gray-100 dark:border-slate-700/50 flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-4 h-full">
              <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <BookOpen className="w-5 h-5 sm:w-7 sm:h-7" />
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-bold mb-0.5">{t('dash_current_courses')}</p>
                <p className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white">{loading ? '-' : activeCourses.length}</p>
              </div>
            </div>
          </FadeIn>
          
          <FadeIn>
            {/* Clickable Certificates Card */}
            <Link to="/certificates" className="block bg-white dark:bg-slate-800 rounded-2xl p-3.5 sm:p-6 shadow-sm border border-gray-100 dark:border-slate-700/50 hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition-all cursor-pointer group h-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 h-full">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-4">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform shrink-0">
                    <Award className="w-5 h-5 sm:w-7 sm:h-7" />
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-bold mb-0.5 line-clamp-1">
                      {isAdmin ? (isRTL ? 'الشهادات' : 'Certificates') : t('dash_completed_certs')}
                    </p>
                    <p className="text-lg sm:text-2xl font-extrabold text-gray-900 dark:text-white">
                      {isAdmin ? (isRTL ? 'اعتماد ومراجعة' : 'Audit') : (loading ? '-' : completedCertificates)}
                    </p>
                  </div>
                </div>
                <div className="hidden sm:block text-emerald-600 dark:text-emerald-400 text-xs font-bold bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                  {isAdmin ? (isRTL ? 'فتح السجل' : 'Open') : t('dash_view_certs')}
                </div>
              </div>
            </Link>
          </FadeIn>

          <FadeIn>
            <Link to="/quizzes" className="block bg-white dark:bg-slate-800 rounded-2xl p-3.5 sm:p-6 shadow-sm border border-gray-100 dark:border-slate-700/50 hover:shadow-md hover:border-pink-200 dark:hover:border-pink-800 transition-all cursor-pointer group h-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 h-full">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-4">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-pink-50 dark:bg-pink-900/30 flex items-center justify-center text-pink-600 dark:text-pink-400 group-hover:scale-110 transition-transform shrink-0">
                    <ClipboardList className="w-5 h-5 sm:w-7 sm:h-7" />
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-bold mb-0.5 line-clamp-1">{t('dash_available_quizzes')}</p>
                    <p className="text-lg sm:text-2xl font-extrabold text-gray-900 dark:text-white">{t('dash_my_quizzes')}</p>
                  </div>
                </div>
                <div className="hidden sm:block text-pink-600 dark:text-pink-400 text-xs font-bold bg-pink-50 dark:bg-pink-900/30 px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                  {t('quiz_enter')}
                </div>
              </div>
            </Link>
          </FadeIn>

          <FadeIn>
            <button 
              onClick={scrollToLeaderboard}
              className="w-full text-start bg-white dark:bg-slate-800 rounded-2xl p-3.5 sm:p-6 shadow-sm border border-gray-100 dark:border-slate-700/50 hover:shadow-md hover:border-amber-300 dark:hover:border-amber-700 transition-all cursor-pointer group h-full"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 h-full">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 sm:gap-4">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center group-hover:scale-110 transition-transform shadow-md shadow-amber-500/20 shrink-0">
                    {isAdmin ? <Trophy className="w-5 h-5 sm:w-7 sm:h-7 fill-slate-950" /> : <Flame className="w-5 h-5 sm:w-7 sm:h-7 fill-slate-950" />}
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-bold mb-0.5 line-clamp-1">
                      {isAdmin ? (isRTL ? 'المتصدرين' : 'Leaderboard') : (isRTL ? 'نقاط (XP)' : 'XP')}
                    </p>
                    <div className="flex items-baseline gap-1">
                      <p className="text-lg sm:text-2xl font-black text-amber-600 dark:text-amber-400">
                        {isAdmin ? (isRTL ? 'الأوائل' : 'Top') : (profile?.xp_points || 0)}
                      </p>
                      {!isAdmin && <span className="text-[10px] sm:text-xs font-bold text-gray-400">XP</span>}
                    </div>
                  </div>
                </div>
                <div className="hidden sm:flex text-amber-600 dark:text-amber-400 text-xs font-bold bg-amber-50 dark:bg-amber-900/30 px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity items-center gap-1">
                  <Trophy className="w-3.5 h-3.5" />
                  <span>{isAdmin ? (isRTL ? 'عرض' : 'View') : (isRTL ? 'الترتيب' : 'Rank')}</span>
                </div>
              </div>
            </button>
          </FadeIn>
        </div>

        {/* Student Feedback & Rating Banner: Shown ONLY to non-admin students */}
        {!isAdmin && (
          <FadeIn delay={150}>
            <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-amber-900/30 border border-amber-500/30 dark:border-amber-500/20 rounded-3xl p-6 sm:p-7 mb-8 flex flex-col sm:flex-row items-center justify-between gap-5 relative overflow-hidden shadow-sm">
              <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 blur-[60px] rounded-full pointer-events-none"></div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/30 shadow-inner">
                  <Sparkles className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span>{hasUserReviewed ? t('dash_review_banner_title_shared') : t('dash_review_banner_title_new')}</span>
                    <span className="text-amber-400">⭐⭐⭐⭐⭐</span>
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    {hasUserReviewed
                      ? t('dash_review_banner_desc_shared')
                      : t('dash_review_banner_desc_new')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => openReviewModal()}
                className="shrink-0 w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-sm shadow-md shadow-amber-500/20 hover:shadow-amber-500/30 transition-all flex items-center justify-center gap-2 relative z-10 cursor-pointer"
              >
                <Star className="w-4 h-4 fill-slate-950 text-slate-950" />
                <span>{hasUserReviewed ? t('dash_review_banner_btn_edit') : t('dash_review_banner_btn_share')}</span>
              </button>
            </div>
          </FadeIn>
        )}

        {/* Enrolled Courses */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white font-arabic mb-6">{t('dash_continue_learning')}</h2>

          {loading ? (
            <FadeIn>
              <div className="flex justify-center items-center py-20">
                <Loader className="w-10 h-10 text-blue-600 animate-spin" />
              </div>
            </FadeIn>
          ) : activeCourses.length === 0 ? (
            <FadeIn>
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-10 text-center border border-gray-100 dark:border-slate-700/50 shadow-sm">
                <BookOpen className="w-16 h-16 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('dash_no_courses_title')}</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">{t('dash_no_courses_desc')}</p>
                <Link to="/courses" className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors">
                  {t('dash_explore_courses')}
                </Link>
              </div>
            </FadeIn>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {activeCourses.map((course) => (
                <FadeIn key={course.id}>
                  <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 shadow-md border border-gray-100 dark:border-slate-700/50 relative group">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white font-arabic line-clamp-1 flex-1">
                        {course.title}
                      </h3>
                      {course.statusText && (
                        <span className={`text-xs font-bold px-3 py-1 rounded-full border whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                          course.isExpiringSoon 
                            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
                        }`}>
                          <Clock className="w-3.5 h-3.5" />
                          {course.statusText}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
                      <span className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-500" />
                        {t('dash_next_lesson')} {course.lastLesson}
                      </span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">{course.progress}%</span>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full h-3 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden mb-6">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${
                          course.progress === 100 
                            ? 'bg-gradient-to-r from-emerald-500 to-green-600' 
                            : 'bg-gradient-to-r from-blue-500 to-blue-600'
                        }`}
                        style={{ width: `${course.progress}%` }}
                      ></div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Link 
                        to={`/course/${course.id}`}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-xl font-bold transition-colors"
                      >
                        <PlayCircle className="w-5 h-5" />
                        {course.progress === 100 ? (isRTL ? 'مراجعة محتوى الكورس' : 'Review Course Content') : t('dash_resume_course')}
                      </Link>

                      {course.progress === 100 && (
                        <Link 
                          to="/certificates"
                          className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700/50 rounded-xl font-bold text-sm transition-colors flex items-center gap-1.5 shrink-0"
                        >
                          <Award className="w-4 h-4 text-amber-500" />
                          <span>{isRTL ? 'الشهادة' : 'Certificate'}</span>
                        </Link>
                      )}
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          )}
        </div>

        {/* Gamification & Leaderboard Section */}
        <div id="leaderboard-section" className="mb-12">
          <FadeIn delay={200}>
            <Leaderboard />
          </FadeIn>
        </div>

        {/* Expired Courses Section */}
        {expiredCourses.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 font-arabic mb-6 flex items-center gap-2">
              <AlertCircle className="w-6 h-6" />
              {t('dash_expired_courses')}
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {expiredCourses.map((course) => (
                <FadeIn key={course.id}>
                  <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm border border-red-100 dark:border-red-900/40 relative group">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white font-arabic line-clamp-1 flex-1">
                        {course.title}
                      </h3>
                      <span className="text-xs font-bold px-3 py-1 rounded-full border bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/60 whitespace-nowrap flex items-center gap-1.5 shrink-0">
                        <Clock className="w-3.5 h-3.5" />
                        {t('dash_expired_badge')}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                      {t('dash_expired_desc')}
                    </p>

                    <div className="flex items-center gap-3">
                      <Link 
                        to={`/checkout/${course.id}`}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg"
                      >
                        <RefreshCw className="w-4 h-4" />
                        {t('dash_renew_sub')}
                      </Link>
                      <Link 
                        to={`/course/${course.id}`}
                        className="px-4 py-3 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-sm transition-colors"
                      >
                        {t('dash_view_details')}
                      </Link>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}


