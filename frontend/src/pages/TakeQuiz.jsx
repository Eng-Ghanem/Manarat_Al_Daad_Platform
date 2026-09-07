import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Clock, AlertTriangle, CheckCircle, HelpCircle, 
  ChevronRight, ChevronLeft, Send, AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import FadeIn from '../components/FadeIn';
import ConfirmModal from '../components/ConfirmModal';
import toast from 'react-hot-toast';

export default function TakeQuiz() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState({}); // { question_id: selected_index }
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  
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
        toast.error('لقد قمت بأداء هذا الامتحان مسبقاً.');
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

      // Fetch Questions
      const { data: qData, error: qError } = await supabase
        .from('quiz_questions')
        .select('id, text, options, marks, question_type') // Selecting needed fields including question_type
        .eq('quiz_id', id)
        .order('created_at', { ascending: true });

      if (qError) throw qError;

      if (!qData || qData.length === 0) {
        toast.error('هذا الامتحان لا يحتوي على أسئلة.');
        navigate('/quizzes');
        return;
      }

      setQuestions(qData);

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
    toast.error('انتهى الوقت! جاري تسليم الإجابات تلقائياً...', { duration: 4000 });
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

      toast.success('تم تسليم الامتحان بنجاح!');
      navigate(`/quizzes/${id}/result`);

    } catch (error) {
      console.error('Error submitting quiz:', error);
      toast.error(error.message || 'حدث خطأ أثناء تسليم الامتحان');
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

  const currentQuestion = questions[currentQuestionIndex];
  const answeredCount = Object.keys(answers).length;
  const progressPercentage = (answeredCount / questions.length) * 100;
  const isTimeCritical = timeLeft !== null && timeLeft < 60; // less than 1 min

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 font-arabic pb-20 select-none">
      
      {/* Top Navbar */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-40 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-1">{quiz?.title}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">سؤال {currentQuestionIndex + 1} من {questions.length}</p>
          </div>
          
          {timeLeft !== null && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold ${
              isTimeCritical 
                ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 animate-pulse' 
                : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
            }`}>
              <Clock className="w-5 h-5" />
              <span className="text-lg font-mono tracking-widest">{formatTime(timeLeft)}</span>
            </div>
          )}
        </div>
        
        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-700">
          <div 
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        
        {/* Question Card */}
        <FadeIn key={currentQuestion.id}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-10 shadow-lg border border-gray-100 dark:border-slate-700">
            <div className="flex items-start gap-4 mb-8">
              <div className="w-12 h-12 shrink-0 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-black text-xl shadow-inner">
                {currentQuestionIndex + 1}
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white leading-relaxed mt-1">
                {currentQuestion.text}
              </h2>
            </div>

            <div className="space-y-4">
              {(!currentQuestion.question_type || currentQuestion.question_type === 'multiple_choice') ? (
                currentQuestion.options.map((opt, optIndex) => {
                  const isSelected = answers[currentQuestion.id] === optIndex;
                  return (
                    <button
                      key={optIndex}
                      onClick={() => handleSelectOption(currentQuestion.id, optIndex)}
                      className={`w-full text-right p-5 rounded-2xl border-2 transition-all flex items-center gap-4 group ${
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
              ) : (
                <textarea
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => handleSelectOption(currentQuestion.id, e.target.value)}
                  placeholder="اكتب إجابتك هنا..."
                  rows={6}
                  className="w-full p-5 rounded-2xl border-2 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 transition-all outline-none text-lg text-gray-900 dark:text-white resize-y"
                />
              )}
            </div>
          </div>
        </FadeIn>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8">
          <button
            onClick={handlePrev}
            disabled={currentQuestionIndex === 0}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 shadow-sm"
          >
            <ChevronRight className="w-5 h-5 rtl:hidden" />
            <ChevronLeft className="w-5 h-5 ltr:hidden" />
            السابق
          </button>

          {currentQuestionIndex === questions.length - 1 ? (
            <button
              onClick={() => setSubmitModalOpen(true)}
              className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl active:scale-95"
            >
              تسليم الامتحان
              <Send className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-md active:scale-95"
            >
              التالي
              <ChevronLeft className="w-5 h-5 rtl:hidden" />
              <ChevronRight className="w-5 h-5 ltr:hidden" />
            </button>
          )}
        </div>

        {/* Question Navigator (Bottom Dots) */}
        <div className="mt-12 flex flex-wrap justify-center gap-2">
          {questions.map((q, idx) => {
            const isAnswered = answers[q.id] !== undefined;
            const isCurrent = currentQuestionIndex === idx;
            return (
              <button
                key={q.id}
                onClick={() => setCurrentQuestionIndex(idx)}
                className={`w-10 h-10 rounded-xl font-bold transition-all flex items-center justify-center text-sm ${
                  isCurrent
                    ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900 bg-blue-600 text-white'
                    : isAnswered
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      <ConfirmModal
        isOpen={submitModalOpen}
        onClose={() => setSubmitModalOpen(false)}
        onConfirm={submitQuiz}
        title="تأكيد تسليم الامتحان"
        message={
          answeredCount < questions.length 
            ? `لقد أجبت على ${answeredCount} من أصل ${questions.length} أسئلة. هل أنت متأكد من تسليم الامتحان الآن؟`
            : "هل أنت متأكد من مراجعة جميع إجاباتك ورغبتك في تسليم الامتحان؟"
        }
        confirmText="نعم، سلم الامتحان"
        cancelText="رجوع للمراجعة"
        type="primary"
        loading={isSubmitting}
      />
    </div>
  );
}
