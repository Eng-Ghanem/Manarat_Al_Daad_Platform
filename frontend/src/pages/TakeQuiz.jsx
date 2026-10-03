import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Clock, AlertTriangle, CheckCircle, HelpCircle, 
  ChevronRight, ChevronLeft, Send, AlertCircle, ArrowRight, Sparkles,
  LayoutList, Layers, CheckCircle2, X
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import FadeIn from '../components/FadeIn';
import ConfirmModal from '../components/ConfirmModal';
import toast from 'react-hot-toast';

export default function TakeQuiz() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({}); // { question_id: selected_index }
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [viewMode, setViewMode] = useState('all'); // 'all' (all questions on one page) or 'single' (wizard)
  
  // Timer state
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);

  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchQuizData();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [id]);

  useEffect(() => {
    if (timeLeft === null || timeLeft === 0) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [timeLeft]);

  useEffect(() => {
    if (timeLeft === 0 && !isSubmitting) {
      handleAutoSubmit();
    }
  }, [timeLeft]);

  const fetchQuizData = async () => {
    try {
      setLoading(true);

      // Check if already submitted
      const { data: submission } = await supabase
        .from('quiz_submissions')
        .select('id')
        .eq('quiz_id', id)
        .eq('student_id', user.id)
        .single();

      if (submission) {
        toast.error(isRTL ? 'لقد قمت بأداء هذا الامتحان مسبقاً.' : 'You have already taken this quiz.');
        navigate(`/quizzes/${id}/result`);
        return;
      }

      // Fetch Quiz
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', id)
        .single();

      if (quizError || !quizData.is_published) {
        toast.error('هذا الامتحان غير متاح.');
        navigate('/quizzes');
        return;
      }

      setQuiz(quizData);

      if (quizData.duration_minutes) {
        setTimeLeft(quizData.duration_minutes * 60);
      }

      // Fetch Questions securely using 4-tier fallback
      let questionsList = [];

      // Tier 1: Try database RPC get_student_quiz_questions
      try {
        const { data: rpcQuestions, error: rpcErr } = await supabase.rpc('get_student_quiz_questions', {
          p_quiz_id: id
        });
        if (!rpcErr && rpcQuestions && rpcQuestions.length > 0) {
          questionsList = rpcQuestions;
        }
      } catch (err) {
        console.warn('RPC get_student_quiz_questions failed:', err);
      }

      // Tier 2: Try student_quiz_questions view
      if (questionsList.length === 0) {
        try {
          const { data: viewData, error: viewErr } = await supabase
            .from('student_quiz_questions')
            .select('id, text, options, marks, question_type')
            .eq('quiz_id', id)
            .order('created_at', { ascending: true });
          if (!viewErr && viewData && viewData.length > 0) {
            questionsList = viewData;
          }
        } catch (err) {
          console.warn('student_quiz_questions view fetch failed:', err);
        }
      }

      // Tier 3: Direct quiz_questions table fallback
      if (questionsList.length === 0) {
        try {
          const { data: tableData, error: tableErr } = await supabase
            .from('quiz_questions')
            .select('id, text, options, marks, question_type')
            .eq('quiz_id', id)
            .order('created_at', { ascending: true });
          if (!tableErr && tableData && tableData.length > 0) {
            questionsList = tableData;
          }
        } catch (err) {
          console.warn('quiz_questions direct fetch failed:', err);
        }
      }

      // Tier 4: Backend API fallback (bypasses RLS safely via Service Role)
      if (questionsList.length === 0) {
        try {
          const apiBase = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '' : 'http://localhost:5000');
          const res = await fetch(`${apiBase}/api/quizzes/${id}/questions`);
          if (res.ok) {
            const resData = await res.json();
            if (resData?.questions && resData.questions.length > 0) {
              questionsList = resData.questions;
            }
          }
        } catch (apiErr) {
          console.warn('Backend API quiz questions fetch failed:', apiErr);
        }
      }

      if (!questionsList || questionsList.length === 0) {
        toast.error('هذا الامتحان لا يحتوي على أسئلة أو غير متاح حالياً.');
        navigate('/quizzes');
        return;
      }

      // Helper to parse options
      const parseOptions = (opts) => {
        if (Array.isArray(opts)) return opts;
        if (typeof opts === 'string') {
          try {
            const parsed = JSON.parse(opts);
            if (Array.isArray(parsed)) return parsed;
          } catch (_) {}
        }
        return [];
      };

      const sanitized = questionsList.map(q => ({
        ...q,
        options: parseOptions(q.options),
        question_type: q.question_type || 'multiple_choice'
      }));

      setQuestions(sanitized);

    } catch (error) {
      console.error('Error fetching quiz:', error);
      toast.error('حدث خطأ أثناء تحميل الامتحان');
      navigate('/quizzes');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (questionId, value) => {
    setAnswers({
      ...answers,
      [questionId]: value
    });
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleAutoSubmit = async () => {
    toast.error(isRTL ? 'انتهى الوقت! جاري تسليم الإجابات تلقائياً...' : 'Time is up! Submitting answers automatically...', { duration: 4000 });
    await submitQuiz();
  };

  const submitQuiz = async () => {
    try {
      setIsSubmitting(true);
      
      const { data, error } = await supabase.rpc('submit_quiz', {
        p_quiz_id: id,
        p_answers: answers
      });

      if (error) {
        // If error is raised by our PL/pgSQL function
        throw error;
      }

      toast.success(isRTL ? 'تم تسليم الامتحان بنجاح!' : 'Quiz submitted successfully!');

      // Notify teachers immediately with chime sound & red dot
      try {
        const { data: admins } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'admin');

        if (admins && admins.length > 0) {
          const studentName = profile?.full_name || 'طالب';
          const quizTitle = quiz?.title || 'امتحان';
          const notifs = admins.map(a => ({
            user_id: a.id,
            title: '📝 تسليم امتحان جديد!',
            message: `قام الطالب (${studentName}) بحل وتسليم: "${quizTitle}". اضغط لرصد الدرجات.`,
            type: 'quiz_submission',
            link: `/admin-dashboard/quizzes/${id}/submissions`,
            is_read: false
          }));
          await supabase.from('notifications').insert(notifs);
        }
      } catch (notifErr) {
        console.warn('Teacher submission notification notice:', notifErr);
      }

      navigate(`/quizzes/${id}/result`);

    } catch (error) {
      console.error('Error submitting quiz:', error);
      toast.error(error.message || (isRTL ? 'حدث خطأ أثناء تسليم الامتحان' : 'An error occurred while submitting quiz'));
    } finally {
      setIsSubmitting(false);
      setSubmitModalOpen(false);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  const answeredCount = Object.keys(answers).length;
  const progressPercentage = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;
  const isTimeCritical = timeLeft !== null && timeLeft < 60; // less than 1 min
  const currentQuestion = questions[currentQuestionIndex] || questions[0];

  const scrollToQuestion = (idx) => {
    const el = document.getElementById(`question-card-${idx}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 font-arabic pb-32 select-none">
      
      {/* Top Navbar */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-40 shadow-sm backdrop-blur-md bg-white/95 dark:bg-slate-800/95">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => {
                if (Object.keys(answers).length > 0) {
                  if (window.confirm(isRTL ? 'هل أنت متأكد من رغبتك في الخروج من الامتحان؟ لن يتم حفظ إجاباتك الحالية.' : 'Are you sure you want to exit? Your current answers will not be saved.')) {
                    navigate('/quizzes');
                  }
                } else {
                  navigate('/quizzes');
                }
              }}
              className="p-2 rounded-xl text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors flex items-center gap-1 font-bold text-xs shrink-0"
              title={isRTL ? 'خروج للامتحانات' : 'Exit to quizzes'}
            >
              <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
              <span>{isRTL ? 'خروج' : 'Exit'}</span>
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">{quiz?.title}</h1>
              <p className="text-xs text-blue-600 dark:text-blue-400 font-bold">
                {isRTL ? `${questions.length} أسئلة بالامتحان` : `${questions.length} questions in exam`}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 dark:bg-slate-700/80 p-1 rounded-xl border border-gray-200 dark:border-slate-600">
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
                title={isRTL ? 'عرض جميع الأسئلة في صفحة واحدة' : 'Show all questions'}
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isRTL ? 'كل الأسئلة' : 'All'}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('single')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'single'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
                title={isRTL ? 'عرض سؤال بسؤال' : 'One by one'}
              >
                <Layers className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isRTL ? 'سؤال بسؤال' : 'Step'}</span>
              </button>
            </div>

            {timeLeft !== null && (
              <div className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl font-bold text-xs sm:text-sm ${
                isTimeCritical 
                  ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 animate-pulse' 
                  : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
              }`}>
                <Clock className="w-4 h-4" />
                <span className="font-mono tracking-wider">{formatTime(timeLeft)}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-700">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        
        {/* Quick Question Jump Strip */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-slate-700 mb-6">
          <div className="flex items-center justify-between mb-3 text-xs font-bold text-gray-500 dark:text-gray-400">
            <span>{isRTL ? 'خريطة الأسئلة السريعة:' : 'Quick Questions Map:'}</span>
            <span className="text-blue-600 dark:text-blue-400">
              {isRTL ? `أجبت على ${answeredCount} من أصل ${questions.length}` : `Answered ${answeredCount} of ${questions.length}`}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {questions.map((q, idx) => {
              const isAnswered = answers[q.id] !== undefined && answers[q.id] !== '';
              const isCurrent = viewMode === 'single' && currentQuestionIndex === idx;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    if (viewMode === 'all') {
                      scrollToQuestion(idx);
                    } else {
                      setCurrentQuestionIndex(idx);
                    }
                  }}
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl font-bold transition-all flex items-center justify-center text-xs sm:text-sm cursor-pointer ${
                    isCurrent
                      ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900 bg-blue-600 text-white shadow-md'
                      : isAnswered
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 font-extrabold'
                      : 'bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:border-blue-400'
                  }`}
                  title={isRTL ? `الانتقال إلى السؤال رقم ${idx + 1}` : `Jump to question ${idx + 1}`}
                >
                  {isAnswered ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* ===================== MODE 1: ALL QUESTIONS IN ONE PAGE ===================== */}
        {viewMode === 'all' && (
          <div className="space-y-6">
            {questions.map((q, idx) => {
              const isAnswered = answers[q.id] !== undefined && answers[q.id] !== '';
              return (
                <div 
                  key={q.id}
                  id={`question-card-${idx}`}
                  className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-slate-700 transition-all hover:shadow-md"
                >
                  {/* Question Header */}
                  <div className="flex items-center justify-between gap-3 mb-5 pb-4 border-b border-gray-100 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-black text-base shadow-inner">
                        {idx + 1}
                      </div>
                      <span className="font-extrabold text-gray-900 dark:text-white text-base">
                        {isRTL ? `السؤال رقم ${idx + 1}` : `Question ${idx + 1}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-slate-700 font-bold text-gray-600 dark:text-gray-300">
                        {q.marks || 1} {isRTL ? 'درجة' : 'marks'}
                      </span>
                      {isAnswered ? (
                        <span className="text-xs px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-200/50 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          {isRTL ? 'تم الحل' : 'Answered'}
                        </span>
                      ) : (
                        <span className="text-xs px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-bold border border-amber-200/50">
                          {isRTL ? 'في انتظار الإجابة' : 'Pending'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Question Text */}
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white leading-relaxed mb-6">
                    {q.text}
                  </h2>

                  {/* Question Options or Essay Input */}
                  <div className="space-y-3">
                    {q.question_type === 'true_false' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                          type="button"
                          onClick={() => handleSelectOption(q.id, 0)}
                          className={`p-4 rounded-2xl border-2 font-bold text-lg transition-all flex items-center justify-between cursor-pointer ${
                            answers[q.id] === 0
                              ? 'border-green-500 bg-green-50/80 dark:bg-green-950/40 text-green-800 dark:text-green-300 shadow-md ring-2 ring-green-400/30'
                              : 'border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/40 text-gray-700 dark:text-gray-300 hover:border-green-400'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${answers[q.id] === 0 ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-slate-800 text-gray-400'}`}>
                              <CheckCircle className="w-5 h-5" />
                            </div>
                            <span>{isRTL ? 'صواب (صح)' : 'True'}</span>
                          </div>
                          {answers[q.id] === 0 && <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSelectOption(q.id, 1)}
                          className={`p-4 rounded-2xl border-2 font-bold text-lg transition-all flex items-center justify-between cursor-pointer ${
                            answers[q.id] === 1
                              ? 'border-red-500 bg-red-50/80 dark:bg-red-950/40 text-red-800 dark:text-red-300 shadow-md ring-2 ring-red-400/30'
                              : 'border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/40 text-gray-700 dark:text-gray-300 hover:border-red-400'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${answers[q.id] === 1 ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-slate-800 text-gray-400'}`}>
                              <X className="w-5 h-5" />
                            </div>
                            <span>{isRTL ? 'خطأ' : 'False'}</span>
                          </div>
                          {answers[q.id] === 1 && <CheckCircle2 className="w-5 h-5 text-red-600 dark:text-red-400" />}
                        </button>
                      </div>
                    ) : q.question_type === 'essay' ? (
                      <textarea
                        value={answers[q.id] || ''}
                        onChange={(e) => handleSelectOption(q.id, e.target.value)}
                        placeholder={t('quiz_essay_ph')}
                        rows={4}
                        className="w-full p-4 rounded-2xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 transition-all outline-none text-base text-gray-900 dark:text-white resize-y"
                      />
                    ) : (
                      (q.options || []).map((opt, optIndex) => {
                        const isSelected = answers[q.id] === optIndex;
                        return (
                          <button
                            key={optIndex}
                            type="button"
                            onClick={() => handleSelectOption(q.id, optIndex)}
                            className={`w-full rtl:text-right ltr:text-left p-4 rounded-2xl border-2 transition-all flex items-center gap-4 cursor-pointer group ${
                              isSelected 
                                ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-900/30 shadow-sm' 
                                : 'border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/40 hover:border-blue-300 dark:hover:border-blue-600'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                              isSelected 
                                ? 'border-blue-500 bg-blue-500 text-white' 
                                : 'border-gray-300 dark:border-slate-600 group-hover:border-blue-400'
                            }`}>
                              {isSelected && <div className="w-2 h-2 bg-white rounded-full"></div>}
                            </div>
                            <span className={`text-base md:text-lg ${isSelected ? 'font-bold text-blue-900 dark:text-blue-100' : 'text-gray-700 dark:text-gray-300'}`}>
                              {opt}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ===================== MODE 2: STEP-BY-STEP (CAROUSEL) ===================== */}
        {viewMode === 'single' && currentQuestion && (
          <div>
            <FadeIn key={currentQuestion.id}>
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-10 shadow-lg border border-gray-100 dark:border-slate-700">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100 dark:border-slate-700">
                  <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400">
                    {isRTL ? `السؤال ${currentQuestionIndex + 1} من أصل ${questions.length}` : `Question ${currentQuestionIndex + 1} of ${questions.length}`}
                  </span>
                  <span className="text-xs px-3 py-1 rounded-lg bg-gray-100 dark:bg-slate-700 font-bold text-gray-600 dark:text-gray-300">
                    {currentQuestion.marks || 1} {isRTL ? 'درجة' : 'marks'}
                  </span>
                </div>

                <div className="flex items-start gap-4 mb-8">
                  <div className="w-12 h-12 shrink-0 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-black text-xl shadow-inner">
                    {currentQuestionIndex + 1}
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white leading-relaxed mt-1">
                    {currentQuestion.text}
                  </h2>
                </div>

                <div className="space-y-4">
                  {currentQuestion.question_type === 'true_false' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => handleSelectOption(currentQuestion.id, 0)}
                        className={`p-5 rounded-2xl border-2 font-bold text-xl transition-all flex items-center justify-between cursor-pointer ${
                          answers[currentQuestion.id] === 0
                            ? 'border-green-500 bg-green-50/80 dark:bg-green-950/40 text-green-800 dark:text-green-300 shadow-md ring-2 ring-green-400/30'
                            : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:border-green-400'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${answers[currentQuestion.id] === 0 ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-400'}`}>
                            <CheckCircle className="w-6 h-6" />
                          </div>
                          <span>{isRTL ? 'صواب (صح)' : 'True'}</span>
                        </div>
                        {answers[currentQuestion.id] === 0 && <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectOption(currentQuestion.id, 1)}
                        className={`p-5 rounded-2xl border-2 font-bold text-xl transition-all flex items-center justify-between cursor-pointer ${
                          answers[currentQuestion.id] === 1
                            ? 'border-red-500 bg-red-50/80 dark:bg-red-950/40 text-red-800 dark:text-red-300 shadow-md ring-2 ring-red-400/30'
                            : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:border-red-400'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${answers[currentQuestion.id] === 1 ? 'bg-red-500 text-white' : 'bg-gray-200 dark:bg-slate-700 text-gray-400'}`}>
                            <X className="w-6 h-6" />
                          </div>
                          <span>{isRTL ? 'خطأ' : 'False'}</span>
                        </div>
                        {answers[currentQuestion.id] === 1 && <CheckCircle2 className="w-6 h-6 text-red-600 dark:text-red-400" />}
                      </button>
                    </div>
                  ) : currentQuestion.question_type === 'essay' ? (
                    <textarea
                      value={answers[currentQuestion.id] || ''}
                      onChange={(e) => handleSelectOption(currentQuestion.id, e.target.value)}
                      placeholder={t('quiz_essay_ph')}
                      rows={6}
                      className="w-full p-5 rounded-2xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 transition-all outline-none text-lg text-gray-900 dark:text-white resize-y"
                    />
                  ) : (
                    (currentQuestion.options || []).map((opt, optIndex) => {
                      const isSelected = answers[currentQuestion.id] === optIndex;
                      return (
                        <button
                          key={optIndex}
                          type="button"
                          onClick={() => handleSelectOption(currentQuestion.id, optIndex)}
                          className={`w-full rtl:text-right ltr:text-left p-5 rounded-2xl border-2 transition-all flex items-center gap-4 cursor-pointer group ${
                            isSelected 
                              ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-md' 
                              : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isSelected 
                              ? 'border-blue-500 bg-blue-500 text-white' 
                              : 'border-gray-300 dark:border-slate-600 group-hover:border-blue-400'
                          }`}>
                            {isSelected && <div className="w-2.5 h-2.5 bg-white rounded-full"></div>}
                          </div>
                          <span className={`text-lg ${isSelected ? 'font-bold text-blue-900 dark:text-blue-100' : 'text-gray-700 dark:text-gray-300'}`}>
                            {opt}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </FadeIn>

            {/* Navigation Buttons for Single Mode */}
            <div className="flex items-center justify-between mt-8">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentQuestionIndex === 0}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 shadow-sm cursor-pointer"
              >
                {isRTL ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                {t('quiz_prev')}
              </button>

              {currentQuestionIndex === questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setSubmitModalOpen(true)}
                  className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl active:scale-95 cursor-pointer"
                >
                  {t('quiz_submit')}
                  <Send className={`w-5 h-5 ${isRTL ? '' : 'rotate-180'}`} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  {t('quiz_next')}
                  {isRTL ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </button>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-t border-gray-200 dark:border-slate-700 p-3 sm:p-4 z-30 shadow-xl">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-extrabold flex items-center justify-center text-sm">
              {answeredCount}/{questions.length}
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white">
                {isRTL ? `أجبت على ${answeredCount} من ${questions.length} أسئلة` : `Answered ${answeredCount} of ${questions.length}`}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {answeredCount === questions.length 
                  ? (isRTL ? '✓ تم إكمال جميع الإجابات جاهز للتسليم' : '✓ All questions answered, ready to submit') 
                  : (isRTL ? `متبقي ${questions.length - answeredCount} أسئلة` : `${questions.length - answeredCount} remaining`)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSubmitModalOpen(true)}
            className="flex items-center gap-2 px-6 sm:px-8 py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-xl font-bold text-sm sm:text-base shadow-lg hover:shadow-xl active:scale-95 transition-all cursor-pointer"
          >
            <span>{t('quiz_submit')}</span>
            <Send className={`w-4 h-4 ${isRTL ? '' : 'rotate-180'}`} />
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={submitModalOpen}
        onClose={() => setSubmitModalOpen(false)}
        onConfirm={submitQuiz}
        title={t('quiz_confirm_submit_title')}
        message={
          answeredCount < questions.length 
            ? (isRTL ? `تنبيه: لقد أجبت على ${answeredCount} من أصل ${questions.length} أسئلة. هل أنت متأكد من تسليم الامتحان وترك باقي الأسئلة فارغة؟` : `Warning: You answered ${answeredCount} of ${questions.length} questions. Are you sure you want to submit now?`)
            : (isRTL ? "أحسنت! لقد أجبت على جميع الأسئلة. هل أنت متأكد من رغبتك في تسليم الامتحان الآن؟" : "Well done! You answered all questions. Submit quiz now?")
        }
        confirmText={t('quiz_submit')}
        cancelText={isRTL ? 'متابعة الحل' : 'Continue Quiz'}
        type="primary"
        loading={isSubmitting}
      />
    </div>
  );
}
