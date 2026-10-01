import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  ClipboardList, CheckCircle, Clock, PlayCircle, 
  Search, AlertCircle, Calendar, Sparkles
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import FadeIn from '../components/FadeIn';
import BackButton from '../components/BackButton';
import { formatQuizTitle, formatCourseTitle, formatGradeName } from '../utils/helpers';

export default function StudentQuizzes() {
  const { user, profile } = useAuth();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Tabs: 'available' (لم يتم التسليم), 'completed' (تم التسليم)
  const [activeTab, setActiveTab] = useState('available');

  const studentId = user?.id || profile?.id;

  useEffect(() => {
    if (studentId) {
      fetchQuizzes();
    } else {
      setLoading(false);
    }
  }, [studentId, profile?.grade_level]);

  const fetchQuizzes = async () => {
    try {
      setLoading(true);
      let currentUserId = studentId;
      if (!currentUserId) {
        const { data: sessionData } = await supabase.auth.getSession();
        currentUserId = sessionData?.session?.user?.id;
      }
      if (!currentUserId) {
        setLoading(false);
        return;
      }

      // 1. Fetch student courses from subscriptions (active) and enrollments
      let enrolledCourseIds = [];
      try {
        const { data: subData } = await supabase
          .from('subscriptions')
          .select('course_id')
          .eq('user_id', currentUserId)
          .eq('status', 'active');
        if (subData) {
          enrolledCourseIds = [...enrolledCourseIds, ...subData.map(s => s.course_id)];
        }
      } catch (e) {
        console.warn('Subscriptions fetch:', e);
      }

      try {
        const { data: enrollmentData } = await supabase
          .from('enrollments')
          .select('course_id')
          .eq('user_id', currentUserId)
          .eq('status', 'active');
        if (enrollmentData) {
          enrolledCourseIds = [...enrolledCourseIds, ...enrollmentData.map(e => e.course_id)];
        }
      } catch (e) {
        // Ignored
      }
      enrolledCourseIds = Array.from(new Set(enrolledCourseIds.filter(Boolean)));

      // 2. Fetch question count map: Tier 1 via backend API, Tier 2 via student_quiz_questions view
      const questionsCountMap = {};
      try {
        const apiBase = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '' : 'http://localhost:5000');
        const res = await fetch(`${apiBase}/api/quizzes/counts`);
        if (res.ok) {
          const resData = await res.json();
          if (resData?.counts) {
            Object.assign(questionsCountMap, resData.counts);
          }
        }
      } catch (e) {
        // Fallback to Supabase view if backend offline
      }

      if (Object.keys(questionsCountMap).length === 0) {
        try {
          const { data: qListData } = await supabase
            .from('student_quiz_questions')
            .select('quiz_id');
          if (qListData && qListData.length > 0) {
            qListData.forEach(item => {
              if (item.quiz_id) {
                questionsCountMap[item.quiz_id] = (questionsCountMap[item.quiz_id] || 0) + 1;
              }
            });
          }
        } catch (e) {
          console.warn('Questions count view fetch error:', e);
        }
      }

      if (Object.keys(questionsCountMap).length === 0) {
        try {
          const { data: qTableData } = await supabase
            .from('quiz_questions')
            .select('quiz_id');
          if (qTableData && qTableData.length > 0) {
            qTableData.forEach(item => {
              if (item.quiz_id) {
                questionsCountMap[item.quiz_id] = (questionsCountMap[item.quiz_id] || 0) + 1;
              }
            });
          }
        } catch (e) {
          console.warn('Questions count table fetch error:', e);
        }
      }

      // 3. Fetch all student submissions directly (100% reliable, no broken join relations)
      const { data: submissionsData, error: sError } = await supabase
        .from('quiz_submissions')
        .select('*')
        .eq('student_id', currentUserId)
        .order('submitted_at', { ascending: false });

      if (sError) console.warn('Error fetching submissions:', sError);

      const submissionsMap = {};
      (submissionsData || []).forEach(sub => {
        submissionsMap[sub.quiz_id] = sub;
      });

      // 4. Fetch all quizzes with course info
      const { data: quizzesData, error: qError } = await supabase
        .from('quizzes')
        .select(`
          *,
          course:courses(title)
        `)
        .order('created_at', { ascending: false });

      if (qError) throw qError;

      // Filter quizzes based on grade_level and course_id
      const getArabicGrade = (gradeKey) => {
        const map = {
          primary_1: 'الصف الأول الابتدائي',
          primary_2: 'الصف الثاني الابتدائي',
          primary_3: 'الصف الثالث الابتدائي',
          primary_4: 'الصف الرابع الابتدائي',
          primary_5: 'الصف الخامس الابتدائي',
          primary_6: 'الصف السادس الابتدائي',
          prep_1: 'الصف الأول الإعدادي',
          prep_2: 'الصف الثاني الإعدادي',
          prep_3: 'الصف الثالث الإعدادي',
          sec_1: 'الصف الأول الثانوي',
          sec_2: 'الصف الثاني الثانوي',
          sec_3: 'الصف الثالث الثانوي'
        };
        return map[gradeKey] || gradeKey;
      };

      const userGrade = profile?.grade_level;

      // Process and classify quizzes:
      // If student submitted it => COMPLETED (always included regardless of published status)
      // If not submitted => AVAILABLE (only if published, matching grade and course)
      const combinedQuizzes = [];
      const seenIds = new Set();

      (quizzesData || []).forEach(quiz => {
        const sub = submissionsMap[quiz.id];
        const qCount = questionsCountMap[quiz.id] || (sub ? sub.total_marks : 0) || 1;

        if (sub) {
          // Completed quiz
          seenIds.add(quiz.id);
          combinedQuizzes.push({
            ...quiz,
            submission: sub,
            questionCount: qCount
          });
        } else if (quiz.is_published) {
          // Check grade level & course eligibility for available quiz
          const matchesGrade = !quiz.grade_level || 
                               !userGrade ||
                               quiz.grade_level === userGrade ||
                               quiz.grade_level === getArabicGrade(userGrade);
          const matchesCourse = !quiz.course_id || enrolledCourseIds.includes(quiz.course_id);

          if (matchesGrade && matchesCourse) {
            seenIds.add(quiz.id);
            combinedQuizzes.push({
              ...quiz,
              submission: null,
              questionCount: qCount
            });
          }
        }
      });

      setQuizzes(combinedQuizzes);

    } catch (error) {
      console.error('Error fetching student quizzes:', error);
    } finally {
      setLoading(false);
    }
  };

  const availableQuizzes = quizzes.filter(q => !q.submission && (
    q.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (q.course?.title && q.course.title.toLowerCase().includes(searchQuery.toLowerCase()))
  ));

  const completedQuizzes = quizzes.filter(q => q.submission && (
    q.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (q.course?.title && q.course.title.toLowerCase().includes(searchQuery.toLowerCase()))
  ));

  const displayQuizzes = activeTab === 'available' ? availableQuizzes : completedQuizzes;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-20 pt-24 font-arabic">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="mb-4 flex justify-start">
          <BackButton to="/dashboard" text={isRTL ? 'العودة للرئيسية' : 'Back to Dashboard'} />
        </div>

        {/* Header */}
        <FadeIn>
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 sm:p-8 shadow-sm border border-gray-100 dark:border-slate-700/50 mb-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-pink-500/10 blur-[80px] rounded-full pointer-events-none"></div>
            
            <div className="flex items-center gap-4 sm:gap-6 relative z-10 w-full sm:w-auto">
              <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl sm:rounded-full bg-pink-100 dark:bg-pink-900/50 flex items-center justify-center border-2 sm:border-4 border-white dark:border-slate-700 shadow-md shrink-0">
                <ClipboardList className="w-7 h-7 sm:w-10 sm:h-10 text-pink-600 dark:text-pink-400" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1 sm:mb-2">
                  {t('student_quizzes_title')}
                </h1>
                <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
                  {t('student_quizzes_subtitle')}
                </p>
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Tabs & Search */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-8">
          <div className="flex items-center p-1.5 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('available')}
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
                activeTab === 'available' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700/50'
              }`}
            >
              {t('student_quizzes_tab_available')}
              {availableQuizzes.length > 0 && activeTab !== 'available' && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs">
                  {availableQuizzes.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                activeTab === 'completed' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <span>{t('student_quizzes_tab_completed')}</span>
              {completedQuizzes.length > 0 && (
                <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-black ${
                  activeTab === 'completed' 
                    ? 'bg-white/20 text-white' 
                    : 'bg-emerald-500 text-white'
                }`}>
                  {completedQuizzes.length}
                </span>
              )}
            </button>
          </div>

          <div className="relative w-full md:w-72">
            <input
              type="text"
              placeholder={t('quiz_search_ph')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full ${isRTL ? 'pl-10 pr-12' : 'pr-10 pl-12'} py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white`}
            />
            <Search className={`absolute ${isRTL ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5`} />
          </div>
        </div>

        {/* Quizzes Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-slate-700/50 flex flex-col h-72 animate-pulse">
                <div className="w-28 h-6 bg-gray-200 dark:bg-slate-700 rounded-full mb-4"></div>
                <div className="w-3/4 h-7 bg-gray-200 dark:bg-slate-700 rounded-xl mb-3"></div>
                <div className="w-full h-4 bg-gray-100 dark:bg-slate-700/60 rounded-lg mb-2"></div>
                <div className="w-2/3 h-4 bg-gray-100 dark:bg-slate-700/60 rounded-lg mb-auto"></div>
                <div className="space-y-2 mb-6">
                  <div className="w-36 h-4 bg-gray-100 dark:bg-slate-700/60 rounded-lg"></div>
                  <div className="w-28 h-4 bg-gray-100 dark:bg-slate-700/60 rounded-lg"></div>
                </div>
                <div className="w-full h-12 bg-gray-200 dark:bg-slate-700 rounded-xl"></div>
              </div>
            ))}
          </div>
        ) : displayQuizzes.length === 0 ? (
          <FadeIn>
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center border border-gray-100 dark:border-slate-700/50 shadow-sm">
              {activeTab === 'available' ? (
                <>
                  <CheckCircle className="w-20 h-20 text-green-400 dark:text-green-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('quiz_all_completed_title')}</h3>
                </>
              ) : (
                <>
                  <AlertCircle className="w-20 h-20 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('quiz_no_achievements_title')}</h3>
                </>
              )}
            </div>
          </FadeIn>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayQuizzes.map((quiz, index) => (
              <FadeIn key={quiz.id} delay={index * 50}>
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-slate-700/50 hover:shadow-md transition-shadow group flex flex-col h-full relative overflow-hidden">
                  
                  {activeTab === 'completed' && quiz.submission && (
                    <div className={`absolute ${isRTL ? '-left-10 rotate-[-45deg]' : '-right-10 rotate-[45deg]'} top-6 bg-green-500 text-white font-bold text-xs py-1 px-10 shadow-md`}>
                      {t('quiz_submitted_badge')}
                    </div>
                  )}

                  <div className="mb-4">
                    <span className="inline-block px-3 py-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded-full text-xs font-bold mb-3">
                      {quiz.course?.title ? formatCourseTitle(quiz.course.title) : (quiz.grade_level ? formatGradeName(quiz.grade_level) : t('quiz_general_target'))}
                    </span>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white line-clamp-2">
                      {formatQuizTitle(quiz.title)}
                    </h3>
                    {quiz.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">
                        {quiz.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-auto space-y-3 mb-6">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <ClipboardList className="w-4 h-4 text-pink-500" />
                      <span>{quiz.questionCount} {t('quiz_questions_unit')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span>{quiz.duration_minutes ? `${quiz.duration_minutes} ${t('quiz_minutes_unit')}` : t('quiz_no_timer')}</span>
                    </div>

                    {activeTab === 'available' && (
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 rounded-xl border border-amber-200/60 dark:border-amber-800/50">
                        <Sparkles className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
                        <span>{isRTL ? 'مكافأة الامتحان: حتى +50 XP' : 'Earn up to +50 XP'}</span>
                      </div>
                    )}
                    
                    {activeTab === 'completed' && quiz.submission && (
                      <div className="space-y-2 mt-4 pt-3 border-t border-gray-100 dark:border-slate-700/60">
                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-900/80 rounded-xl border border-gray-100 dark:border-slate-700/50">
                          <span className="text-sm font-bold text-gray-600 dark:text-gray-400">{t('quiz_score_label')}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-black ${
                              (quiz.submission.score / (quiz.submission.total_marks || 1)) >= 0.5
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                            }`}>
                              {Math.round(((quiz.submission.score || 0) / (quiz.submission.total_marks || 1)) * 100)}%
                            </span>
                            <div className="font-black text-lg">
                              <span className={(quiz.submission.score / (quiz.submission.total_marks || 1)) >= 0.5 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                                {quiz.submission.score}
                              </span>
                              <span className="text-gray-400 mx-1">/</span>
                              <span className="text-gray-600 dark:text-gray-300">{quiz.submission.total_marks}</span>
                            </div>
                          </div>
                        </div>
                        {quiz.submission.submitted_at && (
                          <div className="text-[11px] text-gray-400 dark:text-gray-500 text-left dir-ltr px-1">
                            {new Date(quiz.submission.submitted_at).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {activeTab === 'available' ? (
                    <Link 
                      to={`/quizzes/${quiz.id}`}
                      className="flex items-center justify-center gap-2 w-full py-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-600 text-blue-600 hover:text-white dark:text-blue-400 rounded-xl font-bold transition-colors group-hover:shadow-md"
                    >
                      <PlayCircle className="w-5 h-5" />
                      {t('quiz_start_btn')}
                    </Link>
                  ) : (
                    <Link 
                      to={`/quizzes/${quiz.id}/result`}
                      className="flex items-center justify-center gap-2 w-full py-3 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-xl font-bold transition-colors group-hover:shadow-md"
                    >
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      {t('quiz_view_result_btn')}
                    </Link>
                  )}
                </div>
              </FadeIn>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
