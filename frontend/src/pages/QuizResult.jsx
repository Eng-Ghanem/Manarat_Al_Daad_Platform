import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Trophy, Star, ArrowRight, BookOpen, 
  CheckCircle, XCircle, RefreshCw
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import FadeIn from '../components/FadeIn';

export default function QuizResult() {
  const { id } = useParams();
  const { user } = useAuth();
  
  const [submission, setSubmission] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);

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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">لم يتم العثور على النتيجة</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">يبدو أنك لم تقم بأداء هذا الامتحان بعد.</p>
          <Link to={`/quizzes/${id}`} className="block w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all">
            بدء الامتحان
          </Link>
        </div>
      </div>
    );
  }

  const percentage = Math.round((submission.score / submission.total_marks) * 100);
  const isSuccess = percentage >= 50;
  const isExcellent = percentage >= 85;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-20 px-4 flex items-center justify-center font-arabic relative overflow-hidden">
      
      {/* Celebration Background Effects */}
      {submission.status !== 'pending' && isSuccess && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-10 left-10 w-64 h-64 bg-yellow-400/20 blur-[100px] rounded-full animate-pulse"></div>
          <div className="absolute bottom-10 right-10 w-80 h-80 bg-green-400/20 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-400/10 blur-[150px] rounded-full"></div>
        </div>
      )}

      <div className="max-w-2xl w-full relative z-10">
        <FadeIn>
          <div className="bg-white dark:bg-slate-800 rounded-[3rem] shadow-2xl border border-gray-100 dark:border-slate-700/50 overflow-hidden text-center relative">
            
            {/* Top Pattern Area */}
            <div className={`h-40 w-full relative ${
              isExcellent 
                ? 'bg-gradient-to-br from-yellow-400 via-orange-400 to-yellow-600'
                : isSuccess
                ? 'bg-gradient-to-br from-green-400 via-emerald-500 to-teal-600'
                : 'bg-gradient-to-br from-red-400 via-rose-500 to-red-600'
            }`}>
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
              
              {/* Floating Icons */}
              {isSuccess ? (
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
                submission.status === 'pending' 
                  ? 'bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-600'
                  : isSuccess 
                  ? 'bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-600' 
                  : 'bg-gradient-to-br from-red-100 to-red-200 text-red-600'
              }`}>
                {submission.status === 'pending' ? (
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
            <div className="pt-20 pb-12 px-8">
              <h2 className="text-gray-500 dark:text-gray-400 font-bold mb-2">نتيجة امتحان</h2>
              <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-6 line-clamp-2">
                {quiz?.title}
              </h1>

              {/* Score Display */}
              {submission.status !== 'pending' ? (
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
                      النسبة: {percentage}%
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mb-8 p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl inline-block max-w-sm">
                  <h3 className="text-xl font-bold text-yellow-700 dark:text-yellow-500 mb-2">قيد المراجعة والتصحيح ⏳</h3>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    هذا الامتحان يحتوي على أسئلة مقالية. سيتم ظهور نتيجتك النهائية بمجرد أن يقوم المعلم بمراجعة إجاباتك وتصحيحها يدوياً.
                  </p>
                </div>
              )}

              {/* Message */}
              {submission.status !== 'pending' && (
                <div className="max-w-sm mx-auto mb-10">
                  <h3 className={`text-2xl font-bold mb-3 ${isSuccess ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                    {isExcellent ? 'مذهل! عمل رائع يا بطل 🥇' : isSuccess ? 'مبروك! لقد اجتزت الامتحان بنجاح 🎉' : 'حظ أوفر المرة القادمة! لا تستسلم 💪'}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    {isExcellent 
                      ? 'لقد حصلت على درجة ممتازة. استمر في هذا التفوق.' 
                      : isSuccess 
                      ? 'لقد بذلت جهداً جيداً، ولكن يمكنك دائماً تحقيق الأفضل.' 
                      : 'النجاح يتطلب المحاولة. راجع دروسك وحاول مرة أخرى في الامتحانات القادمة.'}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link 
                  to="/quizzes"
                  className="flex items-center justify-center gap-2 px-8 py-4 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-white rounded-2xl font-bold transition-all"
                >
                  <BookOpen className="w-5 h-5" />
                  امتحانات أخرى
                </Link>
                <Link 
                  to="/dashboard"
                  className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
                >
                  العودة للوحة القيادة
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </div>

            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
