import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Trophy, Star, ArrowRight, BookOpen, 
  CheckCircle, XCircle, RefreshCw, AlertCircle,
  Eye, FileText, Check, X, HelpCircle, Sparkles
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { getXpRules, awardStudentXp } from '../utils/gamification';
import toast from 'react-hot-toast';
import FadeIn from '../components/FadeIn';
import BackButton from '../components/BackButton';

export default function QuizResult() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { id } = useParams();
  const { user, profile } = useAuth();
  
  const [submission, setSubmission] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReview, setShowReview] = useState(true);

  useEffect(() => {
    fetchResult();
  }, [id]);

  const fetchResult = async () => {
    try {
      setLoading(true);

      const { data: subData, error: subError } = await supabase
        .from('quiz_submissions')
        .select('*')
        .eq('quiz_id', id)
        .eq('student_id', user.id)
        .single();

      if (subError) throw subError;
      setSubmission(subData);

      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select('title')
        .eq('id', id)
        .single();

      if (quizError) throw quizError;
      setQuiz(quizData);

      // Fetch Questions for Answer Review (Tier 1: RPC get_student_quiz_review, Tier 2: Backend API, Tier 3: Direct table)
      let fetchedQuestions = [];

      // Tier 1: Try database RPC get_student_quiz_review
      try {
        const { data: rpcReview, error: rpcErr } = await supabase.rpc('get_student_quiz_review', {
          p_quiz_id: id
        });
        if (!rpcErr && rpcReview && rpcReview.length > 0) {
          fetchedQuestions = rpcReview;
        }
      } catch (err) {
        console.warn('RPC get_student_quiz_review failed:', err);
      }

      // Tier 2: Try backend endpoint review
      if (fetchedQuestions.length === 0) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          if (token) {
            const apiBase = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '' : 'http://localhost:5000');
            const res = await fetch(`${apiBase}/api/quizzes/${id}/review`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            if (res.ok) {
              const result = await res.json();
              if (result?.questions?.length > 0) {
                fetchedQuestions = result.questions;
              }
            }
          }
        } catch (err) {
          console.warn('Backend review fetch error:', err);
        }
      }

      // Tier 3: Direct table query (for admins or when RLS allows)
      if (fetchedQuestions.length === 0) {
        const { data: qData } = await supabase
          .from('quiz_questions')
          .select('*')
          .eq('quiz_id', id)
          .order('created_at', { ascending: true });

        if (qData && qData.length > 0) {
          fetchedQuestions = qData;
        }
      }

      setQuestions(fetchedQuestions);

      // Check if this quiz actually has any essay questions
      const hasEssayQuestions = fetchedQuestions.some(q => q.question_type === 'essay');
      
      // Calculate true auto-graded score across all questions
      let calculatedScore = 0;
      let calculatedTotal = 0;
      
      fetchedQuestions.forEach(q => {
        const qMarks = q.marks || 1;
        calculatedTotal += qMarks;
        
        if (q.question_type === 'essay') {
          if (subData.graded_marks && subData.graded_marks[q.id] !== undefined) {
            calculatedScore += Number(subData.graded_marks[q.id]) || 0;
          }
        } else {
          const rawAns = subData.answers ? subData.answers[q.id] : undefined;
          let parsedIdx = null;
          if (rawAns !== undefined && rawAns !== null && rawAns !== '') {
            if (typeof rawAns === 'number') {
              parsedIdx = rawAns;
            } else if (typeof rawAns === 'string') {
              const trimmed = rawAns.trim();
              if (trimmed === '0' || trimmed === 'صواب' || trimmed === 'صح' || trimmed.toLowerCase() === 'true') {
                parsedIdx = 0;
              } else if (trimmed === '1' || trimmed === 'خطأ' || trimmed === 'غلط' || trimmed.toLowerCase() === 'false') {
                parsedIdx = 1;
              } else if (!isNaN(parseInt(trimmed))) {
                parsedIdx = parseInt(trimmed);
              }
            } else if (rawAns === true) {
              parsedIdx = 0;
            } else if (rawAns === false) {
              parsedIdx = 1;
            }
          }
          if (parsedIdx !== null && parsedIdx === q.correct_option_index) {
            calculatedScore += qMarks;
          }
        }
      });

      // Auto-heal: If quiz has NO essay questions, status must be 'completed' and score must be full auto-graded
      let effectiveSub = subData;
      if (!hasEssayQuestions && (subData.status === 'pending' || subData.score !== calculatedScore || subData.total_marks !== calculatedTotal)) {
        effectiveSub = {
          ...subData,
          score: calculatedScore,
          total_marks: calculatedTotal || subData.total_marks || 1,
          status: 'completed'
        };
        setSubmission(effectiveSub);
        
        // Auto-heal in Supabase database
        supabase.from('quiz_submissions')
          .update({
            score: calculatedScore,
            total_marks: calculatedTotal || subData.total_marks || 1,
            status: 'completed'
          })
          .eq('id', subData.id)
          .then(({ error: healErr }) => {
            if (healErr) console.warn('Submission auto-heal DB warning:', healErr);
          });
      }

      // Automatically award student XP based on dynamic platform rules
      if (effectiveSub && user) {
        const isStaff = profile?.role === 'admin' || profile?.role === 'teacher';
        const subXpKey = `quiz_xp_awarded_${effectiveSub.id}`;
        const pct = Math.round((effectiveSub.score / (effectiveSub.total_marks || 1)) * 100);
        if (!isStaff && !localStorage.getItem(subXpKey)) {
          const rules = getXpRules();
          let bonus = 0;
          if (pct === 100) {
            bonus = rules.quiz_full_score || 50;
          } else if (pct >= 50) {
            bonus = rules.quiz_passed || 20;
          }
          if (bonus > 0) {
            localStorage.setItem(subXpKey, 'true');
            const reason = pct === 100 
              ? (isRTL ? `تقفيل امتحان "${quizData?.title || 'الامتحان'}" بالدرجة النهائية` : `full score on "${quizData?.title || 'Quiz'}"`)
              : (isRTL ? `اجتياز امتحان "${quizData?.title || 'الامتحان'}"` : `passing "${quizData?.title || 'Quiz'}"`);
            awardStudentXp(user.id, bonus, reason, `/quizzes/${id}/result`);
            toast.success(isRTL ? `🎉 أحسنت! تم إضافة +${bonus} نقطة تميز لرصيدك!` : `🎉 Great job! +${bonus} XP awarded!`);
          }
        }
      }

    } catch (error) {
      console.error('Error fetching result:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="text-center bg-white dark:bg-slate-800 p-10 rounded-3xl shadow-lg border border-gray-100 dark:border-slate-700 max-w-md w-full">
          <AlertCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('quiz_result_not_found')}</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">{isRTL ? 'يبدو أنك لم تقم بأداء هذا الامتحان بعد.' : 'It looks like you have not taken this quiz yet.'}</p>
          <Link to={`/quizzes/${id}`} className="block w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all">
            {t('quiz_start_btn')}
          </Link>
        </div>
      </div>
    );
  }

  const percentage = Math.round((submission.score / (submission.total_marks || 1)) * 100);
  const isSuccess = percentage >= 50;
  const isExcellent = percentage >= 85;

  const hasEssayQuestions = questions.some(q => q.question_type === 'essay');
  const isTrulyPending = submission.status === 'pending' && hasEssayQuestions;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-16 px-4 flex flex-col items-center justify-center font-arabic relative overflow-hidden">
      
      {/* Celebration Background Effects */}
      {!isTrulyPending && isSuccess && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-10 left-10 w-64 h-64 bg-yellow-400/20 blur-[100px] rounded-full animate-pulse"></div>
          <div className="absolute bottom-10 right-10 w-80 h-80 bg-green-400/20 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-400/10 blur-[150px] rounded-full"></div>
        </div>
      )}

      <div className="max-w-3xl w-full relative z-10">
        <div className="mb-4 flex justify-start">
          <BackButton to="/quizzes" text={isRTL ? 'العودة للامتحانات' : 'Back to Quizzes'} />
        </div>
        <FadeIn>
          <div className="bg-white dark:bg-slate-800 rounded-[3rem] shadow-2xl border border-gray-100 dark:border-slate-700/50 overflow-hidden text-center relative mb-8">
            
            {/* Top Pattern Area */}
            <div className={`h-40 w-full relative ${
              isTrulyPending
                ? 'bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600'
                : isExcellent 
                ? 'bg-gradient-to-br from-yellow-400 via-orange-400 to-yellow-600'
                : isSuccess
                ? 'bg-gradient-to-br from-green-400 via-emerald-500 to-teal-600'
                : 'bg-gradient-to-br from-red-400 via-rose-500 to-red-600'
            }`}>
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
              
              {/* Floating Icons */}
              {!isTrulyPending && isSuccess ? (
                <>
                  <Star className="absolute top-8 left-12 w-8 h-8 text-white/50 animate-bounce" style={{ animationDelay: '0s' }} />
                  <Star className="absolute top-16 right-16 w-6 h-6 text-white/50 animate-bounce" style={{ animationDelay: '0.5s' }} />
                  <Star className="absolute top-6 right-1/3 w-4 h-4 text-white/50 animate-bounce" style={{ animationDelay: '1s' }} />
                </>
              ) : (
                <>
                  <RefreshCw className="absolute top-12 left-12 w-8 h-8 text-white/30 animate-spin-slow" />
                </>
              )}
            </div>

            {/* Avatar / Icon Overlapping */}
            <div className="absolute top-40 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className={`w-32 h-32 rounded-full border-8 border-white dark:border-slate-800 flex items-center justify-center shadow-xl ${
                isTrulyPending 
                  ? 'bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-600'
                  : isSuccess 
                  ? 'bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-600' 
                  : 'bg-gradient-to-br from-red-100 to-red-200 text-red-600'
              }`}>
                {isTrulyPending ? (
                  <RefreshCw className="w-16 h-16 animate-spin-slow" />
                ) : isExcellent ? (
                  <Trophy className="w-16 h-16" />
                ) : isSuccess ? (
                  <CheckCircle className="w-16 h-16" />
                ) : (
                  <XCircle className="w-16 h-16" />
                )}
              </div>
            </div>

            {/* Content Area */}
            <div className="pt-20 pb-12 px-6 sm:px-10">
              <h2 className="text-gray-500 dark:text-gray-400 font-bold mb-2">{t('quiz_result_title')}</h2>
              <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-6 line-clamp-2">
                {quiz?.title}
              </h1>

              {/* Score Display */}
              {!isTrulyPending ? (
                <div className="inline-block relative group mb-8">
                  <div className="absolute inset-0 bg-blue-500 rounded-3xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                  <div className="relative bg-white dark:bg-slate-900 border-2 border-blue-100 dark:border-blue-900/50 rounded-3xl px-12 py-8 flex flex-col items-center">
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className={`text-7xl font-black ${isSuccess ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'}`}>
                        {submission.score}
                      </span>
                      <span className="text-3xl font-bold text-gray-400">/</span>
                      <span className="text-3xl font-bold text-gray-500 dark:text-gray-400">{submission.total_marks}</span>
                    </div>
                    <div className={`px-4 py-1 rounded-full text-sm font-bold ${
                      isSuccess ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    }`}>
                      {t('quiz_ratio_label')} {percentage}%
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-8 p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl inline-block max-w-sm">
                  <h3 className="text-xl font-bold text-yellow-700 dark:text-yellow-500 mb-2">{t('quiz_stat_pending')} ⏳</h3>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    {t('quiz_essay_pending_review')}
                  </p>
                </div>
              )}

              {/* Message */}
              {!isTrulyPending && (
                <div className="max-w-sm mx-auto mb-8">
                  <h3 className={`text-2xl font-bold mb-3 ${isSuccess ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                    {isExcellent 
                      ? (isRTL ? 'مذهل! عمل رائع يا بطل 🥇' : 'Amazing! Great job champion 🥇') 
                      : isSuccess 
                      ? (isRTL ? 'مبروك! لقد اجتزت الامتحان بنجاح 🎉' : 'Congratulations! You passed the quiz 🎉') 
                      : (isRTL ? 'حظ أوفر المرة القادمة! لا تستسلم 💪' : 'Better luck next time! Never give up 💪')}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    {isExcellent 
                      ? t('quiz_pass_congrats') 
                      : isSuccess 
                      ? (isRTL ? 'لقد بذلت جهداً جيداً، ولكن يمكنك دائماً تحقيق الأفضل.' : 'Good effort, but you can always do even better.') 
                      : t('quiz_try_again_msg')}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                {questions.length > 0 && (
                  <button
                    onClick={() => setShowReview(!showReview)}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-2xl font-bold transition-all border border-emerald-300 dark:border-emerald-700 shadow-sm cursor-pointer"
                  >
                    <Eye className="w-5 h-5" />
                    <span>{showReview ? (isRTL ? 'إخفاء مراجعة الإجابات' : 'Hide Answer Review') : (isRTL ? 'مراجعة إجاباتي بالتفصيل' : 'Review My Answers')}</span>
                  </button>
                )}

                <Link 
                  to="/quizzes"
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-white rounded-2xl font-bold transition-all"
                >
                  <BookOpen className="w-5 h-5" />
                  {t('quiz_browse_other')}
                </Link>

                <Link 
                  to="/dashboard"
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg hover:shadow-xl"
                >
                  {t('quiz_back_to_dash')}
                  <ArrowRight className={`w-5 h-5 ${isRTL ? '' : 'rotate-180'}`} />
                </Link>
              </div>

            </div>
          </div>
        </FadeIn>

        {/* Detailed Answer Review Section */}
        {showReview && (
          <FadeIn>
            <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-slate-700/50 p-6 sm:p-10 mb-8 text-start">
              <div className="flex items-center justify-between pb-6 border-b border-gray-100 dark:border-slate-700 mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-sm">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white">
                      {isRTL ? 'مراجعة وتصحيح الإجابات' : 'Answers & Solutions Review'}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {isRTL ? 'قارن إجاباتك بالإجابات الصحيحة واستفد من أخطائك' : 'Compare your answers with model solutions'}
                    </p>
                  </div>
                </div>

                <span className="px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold border border-blue-200 dark:border-blue-800">
                  {isRTL ? `${questions.length} أسئلة` : `${questions.length} questions`}
                </span>
              </div>

              {/* Questions List */}
              <div className="space-y-8">
                {questions.map((question, qIdx) => {
                  const studentAnswer = submission.answers?.[question.id];
                  const isEssay = question.question_type === 'essay';

                  let isCorrect = false;
                  let parsedStudent = null;
                  if (!isEssay) {
                    if (studentAnswer !== undefined && studentAnswer !== null && studentAnswer !== '') {
                      if (typeof studentAnswer === 'number') {
                        parsedStudent = studentAnswer;
                      } else if (typeof studentAnswer === 'string') {
                        const trimmed = studentAnswer.trim();
                        if (trimmed === '0' || trimmed === 'صواب' || trimmed === 'صح' || trimmed.toLowerCase() === 'true') {
                          parsedStudent = 0;
                        } else if (trimmed === '1' || trimmed === 'خطأ' || trimmed === 'غلط' || trimmed.toLowerCase() === 'false') {
                          parsedStudent = 1;
                        } else if (!isNaN(parseInt(trimmed))) {
                          parsedStudent = parseInt(trimmed);
                        }
                      } else if (studentAnswer === true) {
                        parsedStudent = 0;
                      } else if (studentAnswer === false) {
                        parsedStudent = 1;
                      }
                    }
                    isCorrect = parsedStudent !== null && parsedStudent === question.correct_option_index;
                  }

                  // Parse options if JSON string or array
                  let options = [];
                  if (Array.isArray(question.options)) {
                    options = question.options;
                  } else if (typeof question.options === 'string') {
                    try {
                      options = JSON.parse(question.options);
                    } catch (e) {
                      options = [];
                    }
                  }
                  if (question.question_type === 'true_false' && options.length === 0) {
                    options = ['صواب', 'خطأ'];
                  }

                  const showModelAnswers = !isTrulyPending;

                  return (
                    <div 
                      key={question.id}
                      className={`p-6 sm:p-7 rounded-3xl border transition-all ${
                        isEssay 
                          ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50'
                          : isTrulyPending
                          ? 'bg-blue-50/30 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/50'
                          : isCorrect 
                          ? 'bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                          : 'bg-red-50/30 dark:bg-red-950/20 border-red-200 dark:border-red-800/60'
                      }`}
                    >
                      {/* Question Header */}
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-full bg-white dark:bg-slate-700 shadow-sm border border-gray-200 dark:border-slate-600 flex items-center justify-center font-bold text-sm text-gray-700 dark:text-gray-300">
                            {qIdx + 1}
                          </span>
                          <h4 className="text-lg font-bold text-gray-900 dark:text-white leading-snug">
                            {question.text}
                          </h4>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0">
                          {isEssay ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                              <FileText className="w-3.5 h-3.5" />
                              <span>{isRTL ? 'سؤال مقالي' : 'Essay Question'}</span>
                            </span>
                          ) : isTrulyPending ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{isRTL ? 'بانتظار تصحيح المعلم' : 'Pending Review'}</span>
                            </span>
                          ) : isCorrect ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>{isRTL ? `إجابة صحيحة (+${question.marks})` : `Correct (+${question.marks})`}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-300 dark:border-red-700">
                              <XCircle className="w-3.5 h-3.5" />
                              <span>{isRTL ? `إجابة خاطئة (0 / ${question.marks})` : `Incorrect (0 / ${question.marks})`}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Options or Essay Content */}
                      {isEssay ? (
                        <div className="space-y-4 mt-4">
                          <div className="p-4 rounded-2xl bg-white dark:bg-slate-700/60 border border-amber-200 dark:border-slate-600">
                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5">
                              {isRTL ? 'إجابتك المسجلة:' : 'Your submitted answer:'}
                            </p>
                            <p className="text-gray-900 dark:text-white whitespace-pre-wrap text-sm leading-relaxed">
                              {studentAnswer || (isRTL ? 'لم تتم كتابة إجابة' : 'No answer submitted')}
                            </p>
                          </div>

                          {submission.graded_marks && submission.graded_marks[question.id] !== undefined ? (
                            <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-xs font-bold text-blue-800 dark:text-blue-300 flex items-center justify-between">
                              <span>{isRTL ? 'درجة تقييم المعلم:' : 'Teacher Grade:'}</span>
                              <span className="font-extrabold">{submission.graded_marks[question.id]} / {question.marks}</span>
                            </div>
                          ) : (
                            <p className="text-xs text-amber-600 dark:text-amber-400 italic">
                              {isRTL ? '⏳ هذا السؤال قيد مراجعة وتصحيح المعلم حالياً.' : '⏳ This question is currently being reviewed by instructor.'}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                          {options.map((option, optIdx) => {
                            const isSelected = parsedStudent !== null && parsedStudent === optIdx;
                            const isThisCorrect = question.correct_option_index === optIdx;

                            let cardStyle = 'bg-white dark:bg-slate-700/60 border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300';
                            let icon = null;

                            if (showModelAnswers) {
                              if (isThisCorrect) {
                                cardStyle = 'bg-emerald-100/70 dark:bg-emerald-900/40 border-emerald-500 text-emerald-900 dark:text-emerald-100 font-bold shadow-sm';
                                icon = <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
                              } else if (isSelected && !isThisCorrect) {
                                cardStyle = 'bg-red-100/70 dark:bg-red-900/40 border-red-500 text-red-900 dark:text-red-100 font-bold shadow-sm';
                                icon = <X className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />;
                              }
                            } else {
                              if (isSelected) {
                                cardStyle = 'bg-blue-100/70 dark:bg-blue-900/40 border-blue-500 text-blue-900 dark:text-blue-100 font-bold shadow-sm';
                              }
                            }

                            return (
                              <div
                                key={optIdx}
                                className={`flex items-center justify-between p-3.5 rounded-2xl border text-sm transition-all ${cardStyle}`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className="w-6 h-6 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-xs font-bold shrink-0">
                                    {String.fromCharCode(65 + optIdx)}
                                  </span>
                                  <span>{typeof option === 'object' ? option.text : option}</span>
                                </div>

                                <div className="flex items-center gap-1.5 text-xs font-bold shrink-0">
                                  {isSelected && (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10">
                                      {isRTL ? 'إجابتك' : 'Your choice'}
                                    </span>
                                  )}
                                  {showModelAnswers && isThisCorrect && (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                                      {isRTL ? 'الإجابة النموذجية' : 'Correct'}
                                    </span>
                                  )}
                                  {icon}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Explanation if available */}
                      {question.explanation && (
                        <div className="mt-4 p-3.5 rounded-2xl bg-blue-50/80 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
                          <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block mb-0.5">{isRTL ? 'توضيح وفائدة تعليمية:' : 'Explanation & Tip:'}</span>
                            <p>{question.explanation}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>
          </FadeIn>
        )}

      </div>
    </div>
  );
}

