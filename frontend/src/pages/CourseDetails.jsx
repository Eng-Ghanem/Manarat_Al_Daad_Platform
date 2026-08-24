import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PlayCircle, FileText, CheckCircle2, Clock, BookOpen, Star, ChevronDown, Award, Play, Loader, FileType2, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import FadeIn from '../components/FadeIn';
import { getDirectImageUrl } from '../utils/helpers';
import BackButton from '../components/BackButton';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

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
  
  const { user } = useAuth();

  useEffect(() => {
    fetchCourseAndLessons();
  }, [id, user]);

  useEffect(() => {
    setShowPdf(false);
    setIsVideoLoading(true);
  }, [activeLesson]);

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
      if (user) {
        const { data: subData, error: subError } = await supabase
          .from('subscriptions')
          .select('status, created_at')
          .eq('course_id', id)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1);
          
        if (subData && subData.length > 0) {
          const sub = subData[0];
          let isValid = true;
          
          if (courseData.access_duration_days) {
            const createdDate = new Date(sub.created_at);
            const expiryDate = new Date(createdDate.getTime() + courseData.access_duration_days * 24 * 60 * 60 * 1000);
            const today = new Date();
            if (today > expiryDate) {
              isValid = false;
            }
          }
          
          setIsSubscribed(isValid);
          setSubscription(sub);
        } else if (subError) {
          console.error('Subscription check error:', subError);
        }
      }

    } catch (err) {
      console.error('Error fetching course:', err);
      setError('حدث خطأ أثناء جلب تفاصيل الكورس. قد يكون غير موجود أو تم حذفه.');
    } finally {
      setLoading(false);
    }
  };

  const renderVideoPlayer = () => {
    if (!activeLesson) return null;

    const hasAccess = activeLesson.is_free_preview || isSubscribed;

    if (!hasAccess) {
      return (
        <div className="w-full aspect-video bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden relative flex flex-col items-center justify-center p-8 text-center group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 blur-[80px] rounded-full pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 blur-[80px] rounded-full pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-24 h-24 mb-6 rounded-full bg-slate-800/80 border-4 border-slate-700 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-500">
              <Lock className="w-10 h-10 text-gray-400 group-hover:text-blue-400 transition-colors" />
            </div>
            <h3 className="text-3xl font-extrabold text-white mb-3 font-arabic">محتوى مقفول</h3>
            <p className="text-lg text-gray-400 max-w-md mb-8">
              هذا المحتوى متاح للمشتركين فقط. يرجى الاشتراك في الكورس لمشاهدة جميع الدروس وتنزيل المرفقات.
            </p>
            <Link 
              to={`/checkout/${course?.id}`}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white rounded-2xl font-bold text-lg shadow-[0_0_30px_rgba(37,99,235,0.3)] hover:shadow-[0_0_40px_rgba(37,99,235,0.5)] transform hover:-translate-y-1 transition-all duration-300 flex items-center gap-2"
            >
              اشترك في الكورس الآن
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <ChevronDown className="w-5 h-5 rotate-90 rtl:-rotate-90" />
              </div>
            </Link>
          </div>
        </div>
      );
    }

    if (!activeLesson.video_url) {
      return (
        <div className="w-full aspect-video bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden relative flex flex-col items-center justify-center p-6 text-center">
          <PlayCircle className="w-16 h-16 text-gray-500 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">{activeLesson.title}</h3>
          <p className="text-gray-400">لا يوجد فيديو متاح لهذا الدرس.</p>
        </div>
      );
    }

    // Try to embed youtube directly if it's a youtube link
    const isYoutube = activeLesson.video_url.includes('youtube.com') || activeLesson.video_url.includes('youtu.be');
    let embedUrl = activeLesson.video_url;
    
    if (isYoutube) {
      const videoIdMatch = activeLesson.video_url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&?]+)/);
      if (videoIdMatch && videoIdMatch[1]) {
        embedUrl = `https://www.youtube.com/embed/${videoIdMatch[1]}`;
      }
    } else if (activeLesson.video_url.includes('drive.google.com')) {
      const driveMatch = activeLesson.video_url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (driveMatch && driveMatch[1]) {
        embedUrl = `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
      }
    }

    return (
      <div className="w-full aspect-video bg-slate-900 rounded-2xl shadow-2xl overflow-hidden relative border border-slate-700 flex items-center justify-center">
        {isVideoLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-0">
            <Loader className="w-10 h-10 text-blue-500 animate-spin mb-4" />
            <p className="text-sm text-slate-400 font-arabic">جاري تحميل المشغل...</p>
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
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{error || 'الكورس غير موجود'}</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-20">
      
      {/* Course Hero Section */}
      <section className="relative bg-slate-900 text-white pt-24 pb-16 overflow-hidden border-b border-slate-800">
        <div className="absolute inset-0 bg-arabic-pattern opacity-[0.03]"></div>
        <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-blue-600/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[30rem] h-[30rem] bg-gold-500/10 blur-[100px] rounded-full pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="mb-8">
            <BackButton />
          </div>
          <div className="flex flex-col lg:flex-row gap-12">
            
            {/* Course Info */}
            <div className="w-full lg:w-2/3">
              <FadeIn>
                <div className="flex items-center gap-3 mb-6">
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-sm font-bold border border-blue-400/20">
                    {course.category.replace(/-/g, ' ')}
                  </span>
                </div>
                
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-6 leading-tight font-arabic tracking-tight">
                  {course.title}
                </h1>
                
                <p className="text-lg text-slate-300 mb-8 leading-relaxed max-w-2xl whitespace-pre-wrap">
                  {course.description}
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

      {/* Main Content & Sidebar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-20">
        
        {/* Active Lesson Header (Full Width) */}
        {activeLesson && (
          <FadeIn>
            <div className="mb-12 flex flex-col md:flex-row md:items-center justify-between bg-white dark:bg-slate-800 p-6 md:p-8 rounded-3xl shadow-md border border-gray-100 dark:border-slate-700 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 blur-[50px] rounded-full pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-40 h-40 bg-gold-500/10 blur-[50px] rounded-full pointer-events-none"></div>
              
              <div className="relative z-10 flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-4 py-1.5 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-sm font-bold border border-blue-100 dark:border-blue-800">الدرس الحالي</span>
                  {activeLesson.is_free_preview && (
                    <span className="px-4 py-1.5 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full text-sm font-bold border border-green-100 dark:border-green-800">مجاني للمشاهدة (Free Preview)</span>
                  )}
                </div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white font-arabic mb-3 leading-tight">
                  {activeLesson.title}
                </h2>
                {activeLesson.description ? (
                  <p className="text-gray-600 dark:text-gray-300 max-w-4xl text-lg leading-relaxed">
                    {activeLesson.description}
                  </p>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">شاهد هذا الدرس للتعرف على محتوى الكورس وجودة الشرح.</p>
                )}
              </div>
              
              <div className="relative z-10 mt-6 md:mt-0 shrink-0 hidden md:flex items-center justify-center pl-4">
                 <div className="w-20 h-20 rounded-full bg-blue-50 dark:bg-slate-800 border-4 border-white dark:border-slate-700 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xl">
                    <PlayCircle className="w-10 h-10" />
                 </div>
              </div>
            </div>
          </FadeIn>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
          
          {/* Left/Main Column */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Video Player */}
            <FadeIn delay={100}>
              {renderVideoPlayer()}
              {activeLesson && (activeLesson.is_free_preview || isSubscribed) && activeLesson.pdf_url && (
                <div className="mt-8 flex items-center justify-between bg-white dark:bg-slate-800 p-5 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                      <FileType2 className="w-6 h-6 text-red-500" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white mb-1">ملف الشرح (PDF)</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">ملف مرفق مع هذا الدرس</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowPdf(!showPdf)}
                    className="px-6 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 rounded-xl font-bold transition-colors text-sm"
                  >
                    {showPdf ? 'إخفاء الملف' : 'عرض الملف'}
                  </button>
                </div>
              )}
              {showPdf && activeLesson && (activeLesson.is_free_preview || isSubscribed) && activeLesson.pdf_url && (
                <div className="mt-8 relative">
                  {(() => {
                    let embedPdfUrl = activeLesson.pdf_url;
                    if (embedPdfUrl.includes('drive.google.com')) {
                      const driveMatch = embedPdfUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                      if (driveMatch && driveMatch[1]) {
                        embedPdfUrl = `https://drive.google.com/file/d/${driveMatch[1]}/preview?rm=minimal#toolbar=0`;
                      }
                    }
                    return (
                      <iframe 
                        src={embedPdfUrl} 
                        className="w-full h-[70vh] rounded-xl shadow-lg border border-gray-700"
                        title={`ملف الشرح - ${activeLesson.title}`}
                        allowFullScreen
                      />
                    );
                  })()}
                </div>
              )}
            </FadeIn>
          </div>

          {/* Right/Sidebar Column (Enrollment Card) */}
          <div className="lg:col-span-1">
            <FadeIn delay={400} className="sticky top-28">
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

                <div className="text-center mb-6">
                  {course.discounted_price ? (
                    <>
                      <div className="text-xl text-gray-400 dark:text-gray-500 line-through font-bold mb-1">
                        {course.price} ج.م
                      </div>
                      <div className="text-4xl font-extrabold text-blue-700 dark:text-blue-400 mb-2 font-arabic tracking-tight">
                        {course.discounted_price} ج.م
                      </div>
                    </>
                  ) : (
                    <div className="text-4xl font-extrabold text-blue-700 dark:text-blue-400 mb-2 font-arabic tracking-tight">
                      {course.price > 0 ? `${course.price} ج.م` : 'مجاناً'}
                    </div>
                  )}
                </div>

                {!isSubscribed ? (
                  <>
                    {subscription && (
                      <div className="text-center mb-4 py-3 px-4 rounded-xl border bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800/50 dark:text-red-400">
                        <p className="font-bold flex items-center justify-center gap-2">
                          <Clock className="w-5 h-5" />
                          انتهت صلاحية اشتراكك في هذا الكورس
                        </p>
                      </div>
                    )}
                    <Link 
                      to={user ? `/checkout/${course.id}` : "/login"} 
                      className="w-full flex items-center justify-center py-4 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white rounded-2xl font-bold text-lg transition-all duration-300 shadow-[0_8px_20px_rgb(37,99,235,0.3)] hover:-translate-y-1 mb-4"
                    >
                      {subscription ? 'تجديد الاشتراك الآن' : 'اشتراك الآن'}
                    </Link>
                  </>
                ) : (
                  <div className="mb-4">
                    {course.access_duration_days && subscription?.created_at ? (
                      (() => {
                        const createdDate = new Date(subscription.created_at);
                        const expiryDate = new Date(createdDate.getTime() + course.access_duration_days * 24 * 60 * 60 * 1000);
                        const today = new Date();
                        const diffTime = expiryDate - today;
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        const daysText = diffDays > 0 ? `متبقي ${diffDays} يوم` : 'انتهى الاشتراك';
                        const isExpiringSoon = diffDays > 0 && diffDays <= 3;

                        return (
                          <div className={`text-center py-3 px-4 rounded-xl border ${isExpiringSoon ? 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/20 dark:border-orange-800/50 dark:text-orange-400' : 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800/50 dark:text-green-400'}`}>
                            <p className="font-bold mb-1">أنت مشترك في الكورس</p>
                            <p className="text-sm font-bold flex items-center justify-center gap-1">
                              <Clock className="w-4 h-4" />
                              {daysText}
                            </p>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="text-center py-3 px-4 rounded-xl border bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800/50 dark:text-green-400">
                        <p className="font-bold flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-5 h-5" />
                          أنت مشترك في الكورس
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {course.access_duration_days && !isSubscribed && (
                  <div className="text-center mb-4 bg-orange-50 dark:bg-orange-900/20 py-2 rounded-xl border border-orange-100 dark:border-orange-800/50">
                    <p className="text-sm font-bold text-orange-600 dark:text-orange-400 flex items-center justify-center gap-2">
                      <Clock className="w-4 h-4" />
                      صلاحية الكورس: {course.access_duration_days} يوم
                    </p>
                  </div>
                )}

                
              </div>
            </FadeIn>
          </div>
        </div>
      </div>
    </div>
  );
}
