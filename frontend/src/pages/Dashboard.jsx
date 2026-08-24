import { useTranslation } from 'react-i18next';
import { BookOpen, Award, Settings, User, LogOut, PlayCircle, Clock, Loader } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import FadeIn from '../components/FadeIn';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  
  const [activeCourses, setActiveCourses] = useState([]);
  const [completedCertificates, setCompletedCertificates] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // Fetch active subscriptions with course details
        const { data: subsData, error: subsError } = await supabase
          .from('subscriptions')
          .select(`
            course_id,
            courses (
              id,
              title
            )
          `)
          .eq('user_id', user.id)
          .eq('status', 'active');

        if (subsError) throw subsError;

        if (subsData) {
          const formattedCourses = subsData
            .filter(sub => sub.courses) // Ensure course exists
            .map(sub => ({
              id: sub.courses.id,
              title: sub.courses.title,
              progress: 0, // TODO: Implement real progress tracking
              lastLesson: 'الدرس الأول' // Default for now
            }));
          setActiveCourses(formattedCourses);
        }

        // TODO: Fetch completed certificates when the certificates system is built
        setCompletedCertificates(0);

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user, navigate]);
  


  const studentName = profile?.full_name || user?.email || '';

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
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white font-arabic tracking-tight mb-2">
                  {t('dash_welcome')} {studentName} 👋
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                  {t('dash_subtitle')}
                </p>
              </div>
            </div>

            <div className="flex gap-4 relative z-10 w-full md:w-auto">
              <Link to="/settings" className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-xl text-gray-700 dark:text-white font-bold transition-colors">
                <Settings className="w-5 h-5" />
                <span className="hidden sm:inline">{t('dash_settings')}</span>
              </Link>
              <button 
                onClick={logout}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl font-bold transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline">{t('dash_logout')}</span>
              </button>
            </div>
          </div>
        </FadeIn>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          <FadeIn>
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700/50 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <BookOpen className="w-7 h-7" />
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-sm font-bold mb-1">{t('dash_current_courses')}</p>
                <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{loading ? '-' : activeCourses.length}</p>
              </div>
            </div>
          </FadeIn>
          
          <FadeIn>
            {/* Clickable Certificates Card */}
            <Link to="/certificates" className="block bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700/50 flex items-center justify-between hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800 transition-all cursor-pointer group">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform">
                  <Award className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm font-bold mb-1">{t('dash_completed_certs')}</p>
                  <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{loading ? '-' : completedCertificates}</p>
                </div>
              </div>
              <div className="text-blue-600 dark:text-blue-400 text-sm font-bold bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                عرض الشهادات
              </div>
            </Link>
          </FadeIn>
        </div>

        {/* Enrolled Courses */}
        <div className="mb-8">
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
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">لا توجد كورسات حالية</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">أنت غير مشترك في أي كورسات حالياً. استكشف الكورسات المتاحة وابدأ التعلم الآن!</p>
                <Link to="/courses" className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors">
                  تصفح الكورسات
                </Link>
              </div>
            </FadeIn>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {activeCourses.map((course, idx) => (
                <FadeIn key={course.id}>
                  <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 shadow-md border border-gray-100 dark:border-slate-700/50 relative group">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white font-arabic mb-4 line-clamp-1">
                      {course.title}
                    </h3>
                    
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
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-1000"
                        style={{ width: `${course.progress}%` }}
                      ></div>
                    </div>

                    <Link 
                      to={`/course/${course.id}`}
                      className="flex items-center justify-center gap-2 w-full py-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded-xl font-bold transition-colors"
                    >
                      <PlayCircle className="w-5 h-5" />
                      {t('dash_resume_course')}
                    </Link>
                  </div>
                </FadeIn>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
