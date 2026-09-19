import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  PlayCircle, FileText, CheckCircle2, Clock, BookOpen, Star, 
  ChevronDown, Award, Play, Loader, FileType2, Lock, ShieldCheck, 
  AlertCircle, AlertTriangle, Maximize2, Minimize2, Check, ChevronLeft, ChevronRight, 
  Sparkles, StickyNote, Download, Share2, X, ListOrdered
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import FadeIn from '../components/FadeIn';
import { getDirectImageUrl, calculateSubscriptionStatus, formatCourseTitle, formatCourseDescription } from '../utils/helpers';
import { getXpRules } from '../utils/gamification';
import BackButton from '../components/BackButton';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function CourseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [activeLesson, setActiveLesson] = useState(null);
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPdf, setShowPdf] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [subStatus, setSubStatus] = useState(null);

  // World-Class Interactive Features State
  const [completedLessonIds, setCompletedLessonIds] = useState(new Set());
  const [isCinemaMode, setIsCinemaMode] = useState(false);
  const [activeTab, setActiveTab] = useState('curriculum'); // 'curriculum' | 'notes' | 'overview'
  const [notes, setNotes] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [showCertCelebration, setShowCertCelebration] = useState(false);

  const { user, profile } = useAuth();
  const isAdminOrTeacher = profile?.role === 'admin' || profile?.role === 'teacher';

  useEffect(() => {
    fetchCourseAndLessons();
  }, [id, user, profile]);

  useEffect(() => {
    setShowPdf(false);
    setIsVideoLoading(true);
    // Load notes for active lesson
    if (activeLesson && user) {
      const saved = localStorage.getItem(`lesson_note_${user.id}_${activeLesson.id}`) || '';
      setNotes(saved);
    }
  }, [activeLesson, user]);

  const fetchCourseAndLessons = async () => {
    try {
      // Fetch course
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', id)
        .single();

      if (courseError) throw courseError;
      setCourse(courseData);

      // Fetch lessons
      const { data: lessonsData, error: lessonsError } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', id)
        .order('order_index', { ascending: true });

      if (lessonsError) throw lessonsError;
      setLessons(lessonsData || []);

      // Set active lesson to first free preview if exists, or just the first lesson
      if (lessonsData && lessonsData.length > 0) {
        const firstFree = lessonsData.find(l => l.is_free_preview);
        setActiveLesson(firstFree || lessonsData[0]);
      }

      // Check subscription
      let userIsActive = false;
      if (isAdminOrTeacher) {
        setIsSubscribed(true);
        userIsActive = true;
        setSubStatus({
          isSubscribed: true,
          isActive: true,
          isPending: false,
          isExpired: false,
          statusText: profile?.role === 'admin' ? (isRTL ? 'صلاحية الإدارة' : 'Admin Access') : (isRTL ? 'صلاحية المعلم' : 'Teacher Access')
        });
      } else if (user) {
        const { data: subData } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('course_id', id)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (subData && subData.length > 0) {
          let selectedSub = null;
          let calculated = null;

          for (const sub of subData) {
            const calc = calculateSubscriptionStatus(sub, courseData.access_duration_days);
            if (calc.isActive) {
              selectedSub = sub;
              calculated = calc;
              break;
            }
          }

          if (!selectedSub) {
            selectedSub = subData[0];
            calculated = calculateSubscriptionStatus(selectedSub, courseData.access_duration_days);
          }

          setSubscription(selectedSub);
          setSubStatus(calculated);
          setIsSubscribed(calculated.isActive);
          userIsActive = calculated.isActive;
        } else {
          setIsSubscribed(false);
          setSubscription(null);
          setSubStatus(null);
        }
      }

      // Load lesson completion progress
      if (user && lessonsData && lessonsData.length > 0) {
        try {
          const lessonIds = lessonsData.map(l => l.id);
          const { data: progressData } = await supabase
            .from('lesson_progress')
            .select('lesson_id, is_completed')
            .eq('user_id', user.id)
            .in('lesson_id', lessonIds)
            .eq('is_completed', true);

          if (progressData) {
            setCompletedLessonIds(new Set(progressData.map(p => p.lesson_id)));
          }
        } catch (e) {
          console.warn('Could not fetch lesson progress:', e);
        }
      }

    } catch (err) {
      console.error('Error fetching course:', err);
      setError(isRTL ? 'حدث خطأ أثناء جلب تفاصيل الكورس. قد يكون غير موجود أو تم حذفه.' : 'Error fetching course details. It may not exist.');
    } finally {
      setLoading(false);
    }
  };

  const getEmbedUrl = (url) => {
    if (!url) return null;
    let embedUrl = url;
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoIdMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
      if (videoIdMatch && videoIdMatch[1]) {
        embedUrl = `https://www.youtube.com/embed/${videoIdMatch[1]}`;
      }
    } else if (url.includes('drive.google.com')) {
      const driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (driveMatch && driveMatch[1]) {
        embedUrl = `https://drive.google.com/file/d/${driveMatch[1]}/preview?rm=minimal#toolbar=0`;
      }
    }
    return embedUrl;
  };

  // Toggle completion of a lesson
  const toggleLessonCompletion = async (lessonId) => {
    if (!user) {
      toast.error(isRTL ? 'يرجى تسجيل الدخول أولاً' : 'Please login first');
      return;
    }

    // Protection: Students cannot mark lessons completed without an active subscription
    if (!isSubscribed && !isAdminOrTeacher) {
      toast.error(
        subStatus?.isExpired
          ? (isRTL ? 'انتهت صلاحية اشتراكك في هذا الكورس. يرجى تجديد الاشتراك لتتمكن من إكمال الدروس.' : 'Subscription expired. Please renew to complete lessons.')
          : (isRTL ? 'يجب الاشتراك في الكورس أولاً لتتمكن من إكمال الدروس واحتساب التقدم.' : 'You must subscribe to the course to complete lessons.')
      );
      return;
    }

    const isCompleted = completedLessonIds.has(lessonId);
    const nextSet = new Set(completedLessonIds);
    if (isCompleted) {
      nextSet.delete(lessonId);
    } else {
      nextSet.add(lessonId);
    }
    setCompletedLessonIds(nextSet);

    try {
      await supabase
        .from('lesson_progress')
        .upsert({
          user_id: user.id,
          lesson_id: lessonId,
          is_completed: !isCompleted,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,lesson_id' });

      const isStaffUser = profile?.role === 'admin' || profile?.role === 'teacher';
      const xpRules = getXpRules();

      if (!isCompleted) {
        toast.success(
          isStaffUser
            ? (isRTL ? 'تم تحديد الدرس كمكتمل (وضع المعلم)' : 'Lesson marked complete (Teacher Mode)')
            : (isRTL ? `🎉 أحسنت! تم إكمال الدرس (+${xpRules.lesson_completed} نقطة تميز)` : `🎉 Lesson completed! (+${xpRules.lesson_completed} XP)`)
        );

        // Award XP & trigger student celebrations ONLY for actual active students
        if (!isStaffUser && isSubscribed) {
          try {
            const { data: prof } = await supabase.from('profiles').select('xp_points').eq('id', user.id).single();
            const currentXp = prof?.xp_points || 0;
            await supabase.from('profiles').update({ xp_points: currentXp + xpRules.lesson_completed }).eq('id', user.id);
          } catch (e) {
            console.warn('Could not update XP:', e);
          }

          // Check if all lessons completed
          if (nextSet.size === lessons.length && lessons.length > 0) {
            setShowCertCelebration(true);
            try {
              const { data: prof } = await supabase.from('profiles').select('xp_points').eq('id', user.id).single();
              const currentXp = prof?.xp_points || 0;
              await supabase.from('profiles').update({ xp_points: currentXp + xpRules.course_completed }).eq('id', user.id);
            } catch (e) {}
          }
        }
      } else {
        toast(isRTL ? 'تم إلغاء علامة إكمال الدرس' : 'Lesson completion unmarked');
      }
    } catch (err) {
      console.error('Error toggling progress:', err);
      setCompletedLessonIds(completedLessonIds);
      toast.error(isRTL ? 'فشل حفظ التقدم' : 'Failed to save progress');
    }
  };

  const handleSaveNotes = () => {
    if (!activeLesson || !user) return;
    if (!isSubscribed && !isAdminOrTeacher) {
      toast.error(isRTL ? 'دفتر الملاحظات متاح للمشتركين فقط' : 'Notes are available for subscribers only');
      return;
    }
    setIsSavingNote(true);
    localStorage.setItem(`lesson_note_${user.id}_${activeLesson.id}`, notes);
    
    const isStaffUser = profile?.role === 'admin' || profile?.role === 'teacher';
    const xpRules = getXpRules();
    const noteXpKey = `lesson_note_xp_${user.id}_${activeLesson.id}`;
    
    setTimeout(() => {
      setIsSavingNote(false);
      if (!isStaffUser && !localStorage.getItem(noteXpKey) && notes.trim().length >= 10) {
        localStorage.setItem(noteXpKey, 'true');
        supabase.from('profiles').select('xp_points').eq('id', user.id).single().then(({ data }) => {
          if (data) {
            supabase.from('profiles').update({ xp_points: (data.xp_points || 0) + xpRules.notes_saved }).eq('id', user.id);
          }
        });
        toast.success(isRTL ? `تم حفظ الملاحظات بنجاح (+${xpRules.notes_saved} نقطة تميز)` : `Notes saved! (+${xpRules.notes_saved} XP)`);
      } else {
        toast.success(t('cd_notes_saved'));
      }
    }, 250);
  };

  // Subscription & Permission Helper
  const hasFullAccess = isSubscribed || isAdminOrTeacher;

  const canAccessLesson = (lesson) => {
    if (!lesson) return false;
    if (isAdminOrTeacher) return true;
    // If course subscription is expired, all course lessons are locked
    if (subStatus?.isExpired) return false;
    return isSubscribed || !!lesson.is_free_preview;
  };

  // Lesson navigation
  const currentIndex = lessons.findIndex(l => l.id === activeLesson?.id);
  const prevLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null;

  const goToLesson = (lesson) => {
    if (!lesson) return;
    const hasAccess = canAccessLesson(lesson);
    if (!hasAccess) {
      toast.error(
        subStatus?.isExpired
          ? (isRTL ? 'انتهت صلاحية اشتراكك في هذا الكورس. يرجى تجديد الاشتراك لمتابعة المشاهدة.' : 'Subscription expired. Please renew.')
          : t('cd_locked_lesson')
      );
      return;
    }
    setActiveLesson(lesson);
  };

  const completedCount = completedLessonIds.size;
  const totalCount = lessons.length;
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isLessonActiveCompleted = activeLesson ? completedLessonIds.has(activeLesson.id) : false;

  const renderVideoPlayer = () => {
    if (!activeLesson) return null;

    const hasAccess = canAccessLesson(activeLesson);

    if (!hasAccess) {
      return (
        <div className="w-full min-h-[360px] md:aspect-video bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden relative flex flex-col items-center justify-center py-12 px-6 text-center group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[80px] rounded-full pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 blur-[80px] rounded-full pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col items-center w-full">
            <div className="w-20 h-20 md:w-24 md:h-24 mb-4 md:mb-6 rounded-full bg-slate-800/80 border-4 border-slate-700 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-500 shrink-0">
              <Lock className="w-8 h-8 md:w-10 md:h-10 text-gray-400 group-hover:text-blue-400 transition-colors" />
            </div>
            <h3 className="text-2xl md:text-3xl font-extrabold text-white mb-2 md:mb-3 font-arabic">
              {subStatus?.isExpired ? (isRTL ? 'انتهت صلاحية الاشتراك' : 'Subscription Expired') : subStatus?.isPending ? (isRTL ? 'الاشتراك قيد المراجعة' : 'Subscription Pending') : (isRTL ? 'محتوى مقفول' : 'Locked Content')}
            </h3>
            <p className="text-sm md:text-lg text-gray-400 max-w-md mb-6 md:mb-8 leading-relaxed">
              {subStatus?.isExpired 
                ? (isRTL ? 'انتهت مدة صلاحية اشتراكك في هذا الكورس. يرجى تجديد الاشتراك لمتابعة مشاهدة جميع الدروس والمرفقات.' : 'Your subscription duration has ended. Please renew to continue watching all lessons.')
                : subStatus?.isPending 
                ? (isRTL ? 'طلب اشتراكك قيد المراجعة حالياً من قبل الإدارة. سيتم فتح المحتوى فور اعتماد إيصال التحويل.' : 'Your subscription request is currently under review by admin.')
                : (isRTL ? 'هذا المحتوى متاح للمشتركين فقط. يرجى الاشتراك في الكورس لمشاهدة جميع الدروس وتنزيل المرفقات.' : 'This lesson is reserved for course subscribers. Subscribe to access all lessons.')}
            </p>
            <Link 
              to={`/checkout/${course?.id}`}
              className="w-full sm:w-auto px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white rounded-2xl font-bold text-base md:text-lg shadow-[0_0_30px_rgba(37,99,235,0.3)] hover:shadow-[0_0_40px_rgba(37,99,235,0.5)] transform hover:-translate-y-1 transition-all duration-300 flex items-center justify-center gap-2"
            >
              {subStatus?.isExpired ? (isRTL ? 'تجديد الاشتراك في الكورس' : 'Renew Subscription') : (isRTL ? 'اشترك في الكورس الآن' : 'Subscribe Now')}
              <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-white/20 flex items-center justify-center">
                <ChevronDown className="w-4 h-4 md:w-5 md:h-5 rotate-90 rtl:-rotate-90" />
              </div>
            </Link>
          </div>
        </div>
      );
    }

    if (!activeLesson.video_url) {
      return (
        <div className="w-full min-h-[260px] md:aspect-video bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden relative flex flex-col items-center justify-center p-6 text-center">
          <PlayCircle className="w-12 h-12 md:w-16 md:h-16 text-gray-500 mb-4" />
          <h3 className="text-lg md:text-xl font-bold text-white mb-2">{activeLesson.title}</h3>
          <p className="text-sm md:text-base text-gray-400">{isRTL ? 'لا يوجد فيديو متاح لهذا الدرس.' : 'No video available for this lesson.'}</p>
        </div>
      );
    }

    const embedUrl = getEmbedUrl(activeLesson.video_url);

    return (
      <div className="w-full aspect-video bg-slate-900 rounded-3xl shadow-2xl overflow-hidden relative border border-slate-700/80 flex items-center justify-center">
        {isVideoLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-0">
            <Loader className="w-10 h-10 text-blue-500 animate-spin mb-4" />
            <p className="text-sm text-slate-400 font-arabic">{isRTL ? 'جاري تحميل المشغل...' : 'Loading video player...'}</p>
          </div>
        )}
        <iframe
          src={embedUrl}
          title={activeLesson.title}
          className={`w-full h-full absolute top-0 left-0 z-10 transition-opacity duration-300 ${isVideoLoading ? 'opacity-0' : 'opacity-100'}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          onLoad={() => setIsVideoLoading(false)}
        ></iframe>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <Loader className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4 text-center">
        <div className="mb-6"><BackButton /></div>
        <BookOpen className="w-16 h-16 text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{error || (isRTL ? 'الكورس غير موجود' : 'Course not found')}</h2>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-slate-900 pb-24 ${isCinemaMode ? 'bg-slate-950 dark:bg-slate-950' : ''}`}>
      
      {/* 1. CINEMA / FOCUS MODE HEADER (Visible only in Cinema Mode) */}
      {isCinemaMode && (
        <div className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 py-3 px-4 sm:px-8 flex items-center justify-between text-white shadow-xl">
          <div className="flex items-center gap-3 truncate">
            <span className="text-xs px-2.5 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg font-bold shrink-0">
              {t('cd_focus_mode')}
            </span>
            <h2 className="text-base sm:text-lg font-bold truncate">
              {formatCourseTitle(course.title)} - {activeLesson?.title}
            </h2>
          </div>
          <button
            onClick={() => setIsCinemaMode(false)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-gray-200 rounded-xl font-bold text-sm transition-all border border-slate-700 shrink-0 cursor-pointer"
          >
            <Minimize2 className="w-4 h-4" />
            <span className="hidden sm:inline">{t('cd_exit_focus')}</span>
          </button>
        </div>
      )}

      {/* 2. COURSE HERO (Hidden in Cinema Mode) */}
      {!isCinemaMode && (
        <section className="relative bg-slate-900 text-white pt-24 pb-16 overflow-hidden border-b border-slate-800">
          <div className="absolute inset-0 bg-arabic-pattern opacity-[0.03]"></div>
          <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-blue-600/10 blur-[100px] rounded-full pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-[30rem] h-[30rem] bg-gold-500/10 blur-[100px] rounded-full pointer-events-none"></div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="mb-8">
              <BackButton />
            </div>
            <div className="flex flex-col lg:flex-row gap-12">
              <div className="w-full lg:w-2/3">
                <FadeIn>
                  <div className="flex items-center gap-3 mb-6">
                    <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm font-bold border border-blue-400/20">
                      {course.category ? course.category.replace(/-/g, ' ') : (isRTL ? 'كورس شامل' : 'Comprehensive Course')}
                    </span>
                  </div>
                  
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-6 leading-tight font-arabic tracking-tight">
                    {formatCourseTitle(course.title)}
                  </h1>
                  
                  <p className="text-lg text-slate-300 mb-8 leading-relaxed max-w-2xl whitespace-pre-wrap">
                    {formatCourseDescription(course.description, course.title)}
                  </p>

                  <div className="flex flex-wrap gap-6 text-sm text-slate-300">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-blue-400" />
                      <span>{lessons.length} {t('cd_lessons')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-gold-400" />
                      <span>{t('cd_cert_included')}</span>
                    </div>
                  </div>
                </FadeIn>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3. MAIN LEARNING AREA */}
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${isCinemaMode ? 'py-6 max-w-[1500px]' : 'py-10'} relative z-20`}>
        
        {/* Active Lesson Header */}
        {activeLesson && !isCinemaMode && (
          <FadeIn>
            <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 relative overflow-hidden">
              <div className="relative z-10 flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className="px-4 py-1.5 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-xs sm:text-sm font-bold border border-blue-100 dark:border-blue-800">
                    {isRTL ? "الدرس الحالي" : "Current Lesson"}
                  </span>
                  {activeLesson.is_free_preview && (
                    <span className="px-4 py-1.5 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-xs sm:text-sm font-bold border border-green-100 dark:border-green-800">
                      {isRTL ? "مجاني للمشاهدة" : "Free Preview"}
                    </span>
                  )}
                  {isLessonActiveCompleted && (
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full text-xs font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> {t('cd_mark_completed')}
                    </span>
                  )}
                </div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white font-arabic mb-2 leading-tight">
                  {activeLesson.title}
                </h2>
                {activeLesson.description ? (
                  <p className="text-gray-600 dark:text-gray-300 max-w-4xl text-base sm:text-lg leading-relaxed">
                    {activeLesson.description}
                  </p>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">{isRTL ? 'شاهد هذا الدرس واستفد من الشرح والمرفقات.' : 'Watch this lesson to learn and practice.'}</p>
                )}
              </div>
            </div>
          </FadeIn>
        )}

        <div className={`grid grid-cols-1 ${isCinemaMode ? 'lg:grid-cols-1' : 'lg:grid-cols-3'} gap-8 items-start`}>
          
          {/* Main Video & Interactive Controls Column */}
          <div className={`${isCinemaMode ? 'lg:col-span-1' : 'lg:col-span-2'} space-y-6`}>
            
            {/* Video Player Box */}
            <div className="relative">
              {renderVideoPlayer()}
            </div>

            {/* ACTION BAR: Navigation + Completion + Cinema Toggle + Notes Toggle */}
            {/* ACTION BAR: Navigation + Completion + Cinema Toggle + Notes Toggle */}
            {activeLesson && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-3.5 sm:p-5 shadow-sm border border-gray-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
                
                {/* Previous & Next Buttons */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={() => goToLesson(prevLesson)}
                    disabled={!prevLesson || !canAccessLesson(prevLesson)}
                    className={`flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                      prevLesson && canAccessLesson(prevLesson)
                        ? 'bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-gray-200 cursor-pointer'
                        : 'bg-gray-50 dark:bg-slate-800/50 text-gray-400 dark:text-gray-600 cursor-not-allowed border border-transparent opacity-60'
                    }`}
                  >
                    {isRTL ? <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                    <span>{t('cd_prev_lesson')}</span>
                  </button>

                  <button
                    onClick={() => goToLesson(nextLesson)}
                    disabled={!nextLesson || !canAccessLesson(nextLesson)}
                    className={`flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
                      nextLesson && canAccessLesson(nextLesson)
                        ? 'bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-gray-200 cursor-pointer'
                        : 'bg-gray-50 dark:bg-slate-800/50 text-gray-400 dark:text-gray-600 cursor-not-allowed border border-transparent opacity-60'
                    }`}
                  >
                    <span>{t('cd_next_lesson')}</span>
                    {isRTL ? <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                  </button>
                </div>

                {/* Utility Buttons: Cinema Mode & Notes & PDF */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={() => {
                      if (!canAccessLesson(activeLesson)) {
                        toast.error(subStatus?.isExpired ? (isRTL ? 'انتهت صلاحية الاشتراك' : 'Subscription expired') : t('cd_locked_lesson'));
                        return;
                      }
                      setIsCinemaMode(!isCinemaMode);
                    }}
                    disabled={!canAccessLesson(activeLesson)}
                    className={`p-2 sm:p-2.5 rounded-xl transition-colors ${
                      canAccessLesson(activeLesson)
                        ? 'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 cursor-pointer'
                        : 'bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                    }`}
                    title={isCinemaMode ? t('cd_exit_focus') : t('cd_focus_mode')}
                  >
                    {isCinemaMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => {
                      if (!hasFullAccess) {
                        toast.error(subStatus?.isExpired ? (isRTL ? 'انتهت صلاحية الاشتراك، الملاحظات للمشتركين فقط' : 'Subscription expired') : (isRTL ? 'دفتر الملاحظات متاح للمشتركين فقط' : 'Notes available for subscribers only'));
                        return;
                      }
                      setActiveTab(activeTab === 'notes' ? 'curriculum' : 'notes');
                    }}
                    className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-colors cursor-pointer ${
                      activeTab === 'notes'
                        ? 'bg-amber-500 text-white'
                        : hasFullAccess
                        ? 'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200'
                        : 'bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-gray-600 opacity-60'
                    }`}
                  >
                    <StickyNote className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('cd_lesson_notes')}</span>
                  </button>

                  {activeLesson?.pdf_url && canAccessLesson(activeLesson) && (
                    <button 
                      onClick={() => setShowPdf(!showPdf)}
                      className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-colors cursor-pointer ${
                        showPdf
                          ? 'bg-red-600 text-white'
                          : 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400'
                      }`}
                    >
                      <FileType2 className="w-4 h-4" />
                      <span className="hidden sm:inline">{showPdf ? (isRTL ? 'إخفاء الملف' : 'Hide PDF') : (isRTL ? 'ملف الشرح' : 'Lesson PDF')}</span>
                    </button>
                  )}

                  {activeLesson?.pdf_url && !canAccessLesson(activeLesson) && (
                    <button 
                      type="button"
                      disabled
                      className="flex items-center gap-1.5 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-slate-700 cursor-not-allowed opacity-60"
                      title={isRTL ? 'ملف الدرس متاح للمشتركين فقط' : 'File locked for subscribers only'}
                    >
                      <Lock className="w-3.5 h-3.5 text-gray-400" />
                      <span className="hidden sm:inline">{isRTL ? 'الملف مقفول' : 'PDF Locked'}</span>
                    </button>
                  )}
                </div>

                {/* Mark as Completed Button */}
                {hasFullAccess ? (
                  <button
                    onClick={() => toggleLessonCompletion(activeLesson.id)}
                    className={`flex items-center justify-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-sm w-full md:w-auto ${
                      isLessonActiveCompleted
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                        : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800/50'
                    }`}
                  >
                    <CheckCircle2 className={`w-4 h-4 ${isLessonActiveCompleted ? 'fill-white text-emerald-600' : ''}`} />
                    <span>{isLessonActiveCompleted ? t('cd_mark_completed') : t('cd_mark_as_completed')}</span>
                  </button>
                ) : (
                  <div
                    className="flex items-center justify-center gap-2 px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-gray-100 dark:bg-slate-800/80 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-slate-700 select-none cursor-not-allowed w-full md:w-auto"
                    title={subStatus?.isExpired ? (isRTL ? 'انتهت صلاحية الاشتراك' : 'Subscription expired') : (isRTL ? 'يتطلب اشتراكاً فعالاً' : 'Requires active subscription')}
                  >
                    <Lock className="w-4 h-4 text-amber-500" />
                    <span>{subStatus?.isExpired ? (isRTL ? 'إكمال الدرس مقفول (انتهت الصلاحية)' : 'Completion Locked (Expired)') : (isRTL ? 'إكمال الدرس (للمشتركين فقط)' : 'Subscribers Only')}</span>
                  </div>
                )}
              </div>
            )}

            {/* PDF Viewer */}
            {showPdf && activeLesson && canAccessLesson(activeLesson) && activeLesson.pdf_url && (
              <FadeIn>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <FileType2 className="w-6 h-6 text-red-500" />
                      <h4 className="font-bold text-gray-900 dark:text-white">{isRTL ? `ملف الشرح: ${activeLesson.title}` : `Lesson PDF: ${activeLesson.title}`}</h4>
                    </div>
                    <button 
                      onClick={() => setShowPdf(false)}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <iframe 
                    src={getEmbedUrl(activeLesson.pdf_url)} 
                    className="w-full h-[70vh] rounded-2xl shadow-inner border border-gray-200 dark:border-slate-700"
                    title={`PDF - ${activeLesson.title}`}
                    allowFullScreen
                  />
                </div>
              </FadeIn>
            )}

            {/* TABS SECTION: Curriculum Playlist | Personal Notes | Course Overview */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-4 sm:p-6 lg:p-8 shadow-sm border border-gray-100 dark:border-slate-700">
              
              {/* Tab Navigation */}
              <div className="flex items-center gap-2 border-b border-gray-100 dark:border-slate-700 pb-3 sm:pb-4 mb-6 overflow-x-auto no-scrollbar flex-nowrap">
                <button
                  onClick={() => setActiveTab('curriculum')}
                  className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    activeTab === 'curriculum'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                      : 'bg-gray-100 dark:bg-slate-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <ListOrdered className="w-4 h-4 shrink-0" />
                  <span>{t('cd_curriculum')} ({lessons.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('notes')}
                  className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    activeTab === 'notes'
                      ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                      : 'bg-gray-100 dark:bg-slate-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <StickyNote className="w-4 h-4 shrink-0" />
                  <span>{t('cd_lesson_notes')}</span>
                </button>

                <button
                  onClick={() => setActiveTab('overview')}
                  className={`flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer shrink-0 ${
                    activeTab === 'overview'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                      : 'bg-gray-100 dark:bg-slate-700/60 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <span>{isRTL ? 'نظرة عامة' : 'Overview'}</span>
                </button>
              </div>

              {/* TAB 1: CURRICULUM PLAYLIST */}
              {activeTab === 'curriculum' && (
                <div className="space-y-4">
                  
                  {/* Subscription Expiry / Warning Notice */}
                  {subStatus?.isExpired && (
                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold text-amber-900 dark:text-amber-300">
                      <div className="flex items-center gap-2.5">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                        <span>{isRTL ? 'انتهت مدة اشتراكك في الكورس. تم قفل التحكم في إكمال الدروس والفيديوهات والشهادة حتى تجديد الاشتراك.' : 'Your subscription has expired. Lesson completion, videos, and certificates are locked until renewal.'}</span>
                      </div>
                      <Link
                        to={`/checkout/${course?.id}`}
                        className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl font-bold shrink-0 transition-all text-center shadow-sm"
                      >
                        {isRTL ? 'تجديد الاشتراك الآن' : 'Renew Subscription'}
                      </Link>
                    </div>
                  )}

                  {!isSubscribed && !subStatus?.isExpired && !isAdminOrTeacher && (
                    <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold text-blue-900 dark:text-blue-300">
                      <div className="flex items-center gap-2.5">
                        <Lock className="w-5 h-5 text-blue-600 shrink-0" />
                        <span>{isRTL ? 'التحكم في إكمال الدروس والحصول على الشهادة يتطلب اشتراكاً فعالاً في الكورس.' : 'Marking completion and certificates require an active course subscription.'}</span>
                      </div>
                      <Link
                        to={`/checkout/${course?.id}`}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold shrink-0 transition-all text-center shadow-sm"
                      >
                        {isRTL ? 'اشترك في الكورس' : 'Subscribe Now'}
                      </Link>
                    </div>
                  )}

                  {/* Playlist Progress Header */}
                  <div className="bg-gray-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-gray-100 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div>
                      <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                        {t('cd_completed_count', { completed: completedCount, total: totalCount })}
                      </p>
                      <div className="w-48 sm:w-64 h-2 bg-gray-200 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${progressPercentage}%` }}
                        ></div>
                      </div>
                    </div>
                    <span className="text-lg font-black text-blue-600 dark:text-blue-400">
                      {progressPercentage}%
                    </span>
                  </div>

                  {/* Lessons List */}
                  <div className="space-y-2.5">
                    {lessons.map((lesson, idx) => {
                      const isActive = activeLesson?.id === lesson.id;
                      const isCompleted = completedLessonIds.has(lesson.id);
                      const hasAccess = canAccessLesson(lesson);

                      return (
                        <div
                          key={lesson.id}
                          onClick={() => goToLesson(lesson)}
                          className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer group ${
                            isActive
                              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 shadow-sm'
                              : !hasAccess
                              ? 'bg-gray-50/50 dark:bg-slate-800/40 border-gray-100 dark:border-slate-800 opacity-70 hover:opacity-100'
                              : 'bg-white dark:bg-slate-800/80 border-gray-100 dark:border-slate-700/60 hover:bg-gray-50 dark:hover:bg-slate-700/40'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Checkmark Button */}
                            {hasFullAccess ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleLessonCompletion(lesson.id);
                                }}
                                className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all shrink-0 cursor-pointer ${
                                  isCompleted
                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                    : 'border-gray-300 dark:border-slate-600 hover:border-emerald-500 text-transparent'
                                }`}
                                title={isCompleted ? t('cd_mark_completed') : t('cd_mark_as_completed')}
                              >
                                <Check className="w-4 h-4 stroke-[3]" />
                              </button>
                            ) : (
                              <span
                                className="w-7 h-7 rounded-full flex items-center justify-center border border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800 text-gray-400 dark:text-gray-500 shrink-0 cursor-not-allowed"
                                title={subStatus?.isExpired ? (isRTL ? 'انتهت صلاحية الاشتراك' : 'Subscription expired') : (isRTL ? 'يتطلب اشتراكاً فعالاً' : 'Requires active subscription')}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toast.error(subStatus?.isExpired ? (isRTL ? 'انتهت صلاحية اشتراكك في هذا الكورس' : 'Subscription expired') : (isRTL ? 'يجب الاشتراك في الكورس أولاً' : 'Must subscribe first'));
                                }}
                              >
                                <Lock className="w-3.5 h-3.5 text-gray-400" />
                              </span>
                            )}

                            {/* Order Badge */}
                            <span className="w-6 text-center text-xs font-bold text-gray-400 dark:text-gray-500 shrink-0">
                              {idx + 1}
                            </span>

                            {/* Lesson Title & Info */}
                            <div className="min-w-0 flex-1">
                              <h4 className={`text-base font-bold truncate ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                                {lesson.title}
                              </h4>
                              {lesson.pdf_url && (
                                <span className="text-xs text-red-500 font-medium flex items-center gap-1 mt-0.5">
                                  <FileType2 className="w-3 h-3" /> PDF
                                  {!hasAccess && <Lock className="w-2.5 h-2.5 text-gray-400 inline ml-1" />}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Right Badges: Free / Locked / Playing Indicator */}
                          <div className="flex items-center gap-2 shrink-0">
                            {lesson.is_free_preview && !subStatus?.isExpired && (
                              <span className="px-2.5 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-lg text-xs font-bold">
                                {isRTL ? "مجاني" : "Free"}
                              </span>
                            )}

                            {!hasAccess && (
                              <span className="p-1.5 bg-gray-100 dark:bg-slate-700 text-gray-400 rounded-lg" title={isRTL ? 'محتوى مقفول' : 'Locked'}>
                                <Lock className="w-4 h-4" />
                              </span>
                            )}

                            {isActive && hasAccess && (
                              <span className="w-3 h-3 rounded-full bg-blue-600 animate-pulse"></span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 2: PERSONAL LESSON NOTES */}
              {activeTab === 'notes' && (
                <div className="space-y-4">
                  {!hasFullAccess ? (
                    <div className="p-8 text-center rounded-2xl bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700">
                      <Lock className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                        {isRTL ? 'دفتر الملاحظات متاح للمشتركين فقط' : 'Lesson notes reserved for subscribers'}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-5">
                        {subStatus?.isExpired
                          ? (isRTL ? 'انتهت صلاحية اشتراكك في الكورس. يرجى تجديد الاشتراك لتتمكن من كتابة وحفظ ملاحظاتك.' : 'Your subscription has expired. Please renew to access your notes.')
                          : (isRTL ? 'اشترك في الكورس لتتمكن من تدوين ملاحظاتك الخاصة لكل درس وحفظها في حسابك.' : 'Subscribe to the course to write and save personal notes.')}
                      </p>
                      <Link
                        to={`/checkout/${course?.id}`}
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors"
                      >
                        {subStatus?.isExpired ? (isRTL ? 'تجديد الاشتراك' : 'Renew Subscription') : (isRTL ? 'اشترك في الكورس' : 'Subscribe Now')}
                      </Link>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            {t('cd_lesson_notes')} - {activeLesson?.title}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {isRTL ? 'ملاحظاتك الشخصية يتم حفظها بحسابك للرجوع إليها دائماً' : 'Your personal notes are saved to your account for review'}
                          </p>
                        </div>
                        <button
                          onClick={handleSaveNotes}
                          disabled={isSavingNote}
                          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-amber-500/20 flex items-center gap-2 cursor-pointer"
                        >
                          {isSavingNote ? <Loader className="w-4 h-4 animate-spin" /> : <StickyNote className="w-4 h-4" />}
                          <span>{t('cd_save_notes')}</span>
                        </button>
                      </div>

                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={t('cd_notes_ph')}
                        rows={8}
                        className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white text-base focus:ring-2 focus:ring-amber-500 outline-none leading-relaxed transition-all"
                      ></textarea>
                    </>
                  )}
                </div>
              )}

              {/* TAB 3: COURSE OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                      {isRTL ? 'عن هذا الكورس' : 'About this course'}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {formatCourseDescription(course.description, course.title)}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-gray-100 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-700/50 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{isRTL ? 'عدد الدروس' : 'Lessons Count'}</p>
                        <p className="font-bold text-gray-900 dark:text-white">{lessons.length} {t('cd_lessons')}</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-gray-50 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-700/50 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gold-100 dark:bg-gold-900/40 text-gold-600 dark:text-gold-400 flex items-center justify-center">
                        <Award className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{isRTL ? 'شهادة إتمام معتمدة' : 'Verified Certificate'}</p>
                        <p className="font-bold text-gray-900 dark:text-white">{isRTL ? 'متوفرة بعد إكمال 100%' : 'Available at 100%'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Right Sidebar: Progress & Subscription / Pricing Card (Hidden in Cinema Mode) */}
          {!isCinemaMode && (
            <div className="lg:col-span-1">
              <FadeIn delay={200} className="sticky top-28 space-y-6">
                
                {/* Enrollment Card */}
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-100 dark:border-slate-700 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gold-400/10 blur-[50px] rounded-full pointer-events-none"></div>
                  
                  <div className="mb-6 rounded-2xl overflow-hidden aspect-video relative bg-slate-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600">
                    {course.image_url ? (
                       <img src={getDirectImageUrl(course.image_url)} alt={course.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen className="w-12 h-12 text-gray-300 dark:text-slate-500" />
                      </div>
                    )}
                  </div>

                  {/* Real Course Progress Bar in Sidebar */}
                  {isSubscribed && (
                    <div className="mb-6 p-4 rounded-2xl bg-blue-50/70 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          {isRTL ? 'إنجازك في الكورس' : 'Your Progress'}
                        </span>
                        <span className="text-xs font-black text-blue-700 dark:text-blue-300">
                          {progressPercentage}%
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-blue-200/50 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full transition-all duration-700"
                          style={{ width: `${progressPercentage}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                        {t('cd_completed_count', { completed: completedCount, total: totalCount })}
                      </p>

                      {/* 100% Completed Certificate Button */}
                      {progressPercentage === 100 && (
                        <Link
                          to="/certificates"
                          className="mt-3 w-full py-2.5 bg-gradient-to-r from-amber-500 to-gold-500 hover:from-amber-600 hover:to-gold-600 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-md transition-all"
                        >
                          <Award className="w-4 h-4" />
                          <span>{t('cert_view_now')}</span>
                        </Link>
                      )}
                    </div>
                  )}

                  <div className="text-center mb-6">
                    {course.discounted_price ? (
                      <>
                        <div className="text-xl text-gray-400 dark:text-gray-500 line-through font-bold mb-1">
                          {course.price} {isRTL ? 'ج.م' : 'EGP'}
                        </div>
                        <div className="text-4xl font-extrabold text-blue-700 dark:text-blue-400 mb-2 font-arabic tracking-tight">
                          {course.discounted_price} {isRTL ? 'ج.م' : 'EGP'}
                        </div>
                      </>
                    ) : (
                      <div className="text-4xl font-extrabold text-blue-700 dark:text-blue-400 mb-2 font-arabic tracking-tight">
                        {course.price > 0 ? `${course.price} ${isRTL ? 'ج.م' : 'EGP'}` : (isRTL ? 'مجاناً' : 'Free')}
                      </div>
                    )}
                  </div>

                  {/* Admin / Teacher Preview Badge */}
                  {isAdminOrTeacher ? (
                    <div className="text-center mb-4 py-3 px-4 rounded-2xl border bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800/60 dark:text-blue-300">
                      <p className="font-bold flex items-center justify-center gap-2 text-sm">
                        <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        {isRTL ? `أنت تتصفح الكورس بصلاحية ${profile?.role === 'admin' ? 'المسؤول' : 'المعلم'}` : `Viewing with ${profile?.role === 'admin' ? 'Admin' : 'Teacher'} privileges`}
                      </p>
                    </div>
                  ) : isSubscribed ? (
                    <div className="mb-4">
                      <div className={`text-center py-4 px-4 rounded-2xl border ${
                        subStatus?.isExpiringSoon 
                          ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/30 dark:border-amber-800/60 dark:text-amber-300' 
                          : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800/60 dark:text-emerald-300'
                      }`}>
                        <p className="font-bold mb-1.5 flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          {isRTL ? 'أنت مشترك في الكورس' : 'You are subscribed'}
                        </p>
                        {subStatus?.statusText && (
                          <p className="text-sm font-bold flex items-center justify-center gap-1.5 opacity-90">
                            <Clock className="w-4 h-4" />
                            {subStatus.statusText}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Pending subscription state */}
                      {subStatus?.isPending && (
                        <div className="text-center mb-4 py-3 px-4 rounded-2xl border bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/30 dark:border-amber-800/60 dark:text-amber-300">
                          <p className="font-bold flex items-center justify-center gap-2 text-sm mb-1">
                            <Clock className="w-4 h-4" />
                            {isRTL ? 'طلب الاشتراك قيد المراجعة' : 'Subscription Pending'}
                          </p>
                          <p className="text-xs opacity-80">
                            {isRTL ? 'سيتم تفعيل الكورس فور اعتماد التحويل من قبل الإدارة.' : 'Course will activate once receipt is approved.'}
                          </p>
                        </div>
                      )}

                      {/* Expired subscription state */}
                      {subStatus?.isExpired && (
                        <div className="text-center mb-4 py-3 px-4 rounded-2xl border bg-red-50 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800/60 dark:text-red-300 shadow-sm">
                          <p className="font-bold flex items-center justify-center gap-2 mb-1">
                            <Clock className="w-5 h-5 text-red-600 dark:text-red-400" />
                            {isRTL ? 'انتهت صلاحية اشتراكك في الكورس' : 'Subscription Expired'}
                          </p>
                          <p className="text-xs text-red-600/80 dark:text-red-300/80">
                            {isRTL ? 'انتهت مدة الوصول المقررة لهذا الكورس. يمكنك تجديد الاشتراك لمتابعة الدروس.' : 'Access period has ended. Please renew to continue learning.'}
                          </p>
                        </div>
                      )}

                      <Link 
                        to={user ? `/checkout/${course.id}` : "/login"} 
                        className="w-full flex items-center justify-center py-4 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white rounded-2xl font-bold text-lg transition-all duration-300 shadow-[0_8px_20px_rgb(37,99,235,0.3)] hover:-translate-y-1 mb-4"
                      >
                        {subStatus?.isExpired ? (isRTL ? 'تجديد الاشتراك الآن' : 'Renew Subscription Now') : (isRTL ? 'اشتراك الآن' : 'Subscribe Now')}
                      </Link>
                    </>
                  )}

                  {course.access_duration_days && !isSubscribed && !isAdminOrTeacher && (
                    <div className="text-center mb-4 bg-orange-50 dark:bg-orange-900/20 py-2.5 px-3 rounded-xl border border-orange-100 dark:border-orange-800/50">
                      <p className="text-xs font-bold text-orange-600 dark:text-orange-400 flex items-center justify-center gap-2">
                        <Clock className="w-4 h-4" />
                        {isRTL ? `مدة صلاحية الكورس: ${course.access_duration_days} يوم من تاريخ التفعيل` : `Course Validity: ${course.access_duration_days} days from activation`}
                      </p>
                    </div>
                  )}
                </div>
              </FadeIn>
            </div>
          )}

        </div>
      </div>

      {/* 4. CERTIFICATE CELEBRATION MODAL (Fires upon 100% completion) */}
      <AnimatePresence>
        {showCertCelebration && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl border border-gold-400/50 relative overflow-hidden"
            >
              <div className="w-20 h-20 bg-gradient-to-tr from-gold-400 to-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-950 shadow-lg shadow-gold-500/30">
                <Award className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2 font-arabic">
                {t('cert_earned_title')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                {t('cert_earned_desc')}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  to="/certificates"
                  className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Award className="w-4 h-4" />
                  <span>{t('cert_view_now')}</span>
                </Link>
                <button
                  onClick={() => setShowCertCelebration(false)}
                  className="px-5 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-sm transition-colors"
                >
                  {isRTL ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Smart Preloader for Next Lesson */}
      {(() => {
        if (!activeLesson || !lessons || lessons.length === 0) return null;
        const cIdx = lessons.findIndex(l => l.id === activeLesson.id);
        if (cIdx === -1 || cIdx === lessons.length - 1) return null;
        const nextL = lessons[cIdx + 1];
        const hasAccessToNext = nextL.is_free_preview || isSubscribed || isAdminOrTeacher;
        
        if (hasAccessToNext) {
          const nextVideoEmbed = getEmbedUrl(nextL.video_url);
          const nextPdfEmbed = getEmbedUrl(nextL.pdf_url);
          return (
            <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }} aria-hidden="true">
              {nextVideoEmbed && <iframe src={nextVideoEmbed} title="preload-video" loading="eager" />}
              {nextPdfEmbed && <iframe src={nextPdfEmbed} title="preload-pdf" loading="eager" />}
            </div>
          );
        }
        return null;
      })()}
    </div>
  );
}

