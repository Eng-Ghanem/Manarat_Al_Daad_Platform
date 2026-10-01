import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  ArrowRight, Search, CheckCircle, 
  Clock, Award, AlertTriangle, Eye
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import FadeIn from '../../components/FadeIn';
import BackButton from '../../components/BackButton';
import toast from 'react-hot-toast';
import GradeSubmissionModal from '../../components/admin/GradeSubmissionModal';


export default function QuizSubmissions() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [submissions, setSubmissions] = useState([]);
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  useEffect(() => {
    fetchSubmissions();
  }, [id]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);

      // Fetch Quiz Details
      const { data: quizData, error: quizError } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', id)
        .single();
      
      if (quizError) throw quizError;
      setQuiz(quizData);

      // Fetch Submissions
      const { data: subData, error: subError } = await supabase
        .from('quiz_submissions')
        .select(`
          *,
          student:profiles!quiz_submissions_student_id_fkey(full_name, email)
        `)
        .eq('quiz_id', id)
        .order('score', { ascending: false });

      if (subError) throw subError;
      setSubmissions(subData || []);

    } catch (error) {
      console.error('Error fetching submissions:', error);
      toast.error('حدث خطأ أثناء تحميل نتائج الطلاب');
    } finally {
      setLoading(false);
    }
  };

  const filteredSubmissions = submissions.filter(sub => 
    sub.student?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sub.student?.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-12">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 pt-24 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <BackButton to="/admin-dashboard/quizzes" text={isRTL ? 'الرجوع للامتحانات' : 'Back to Quizzes'} />
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white font-arabic">
                  {t('quiz_submissions_title')}
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-0.5 font-bold text-base text-blue-600 dark:text-blue-400">
                  {quiz?.title}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        
        {/* Stats Row */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-500 dark:text-gray-400">{t('quiz_stat_submissions')}</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">{submissions.length} {t('chat_student_default')}</p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-500 dark:text-gray-400">{t('quiz_stat_avg')}</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">
                  {submissions.length > 0 
                    ? Math.round(submissions.reduce((acc, sub) => acc + (sub.score / sub.total_marks), 0) / submissions.length * 100) 
                    : 0}%
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-500 dark:text-gray-400">{isRTL ? 'تحتاج تحسين (أقل من 50%)' : 'Needs Improvement (< 50%)'}</p>
                <p className="text-2xl font-black text-gray-900 dark:text-white">
                  {submissions.filter(sub => (sub.score / sub.total_marks) < 0.5).length} {t('chat_student_default')}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-6 max-w-md">
          <input
            type="text"
            placeholder={isRTL ? 'ابحث عن طالب باسمه...' : 'Search student by name...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full ${isRTL ? 'pl-10 pr-12' : 'pr-10 pl-12'} py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white`}
          />
          <Search className={`absolute ${isRTL ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5`} />
        </div>

        {/* Table */}
        <FadeIn>
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
            {loading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent mx-auto"></div>
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="p-12 text-center text-gray-500 dark:text-gray-400">
                {isRTL ? 'لا يوجد طلاب يطابقون بحثك أو لم يقم أحد بأداء الامتحان بعد.' : 'No students match your search or no one has taken the quiz yet.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full rtl:text-right ltr:text-left">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-slate-700">
                      <th className="px-6 py-4 text-sm font-bold text-gray-700 dark:text-gray-300">{t('quiz_th_student')}</th>
                      <th className="px-6 py-4 text-sm font-bold text-gray-700 dark:text-gray-300">{t('quiz_th_time')}</th>
                      <th className="px-6 py-4 text-sm font-bold text-gray-700 dark:text-gray-300 text-center">{t('quiz_th_score')}</th>
                      <th className="px-6 py-4 text-sm font-bold text-gray-700 dark:text-gray-300 text-center">{t('quiz_th_status')}</th>
                      <th className="px-6 py-4 text-sm font-bold text-gray-700 dark:text-gray-300 text-center">{t('quiz_th_actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubmissions.map((sub, idx) => {
                      const percentage = Math.round((sub.score / sub.total_marks) * 100);
                      const isSuccess = percentage >= 50;

                      return (
                        <tr key={sub.id} className="border-b border-gray-100 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-gray-900 dark:text-white">{sub.student?.full_name || (isRTL ? 'طالب غير معروف' : 'Unknown Student')}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{sub.student?.email}</div>
                          </td>
                          <td className="px-6 py-4 text-gray-600 dark:text-gray-300 text-sm flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-400" />
                            {new Date(sub.submitted_at).toLocaleString(t('locale'), { dateStyle: 'medium', timeStyle: 'short' })}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="font-bold text-lg text-gray-900 dark:text-white">{sub.score}</span>
                            <span className="text-gray-500 dark:text-gray-400 text-sm mx-1">/</span>
                            <span className="text-gray-500 dark:text-gray-400 text-sm">{sub.total_marks}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {sub.status === 'pending' ? (
                              <span className="inline-flex items-center gap-1 justify-center px-3 py-1 rounded-full text-sm font-bold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                <Clock className="w-3 h-3" /> {t('quiz_stat_pending')}
                              </span>
                            ) : (
                              <span className={`inline-flex items-center gap-1 justify-center px-3 py-1 rounded-full text-sm font-bold ${
                                isSuccess 
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              }`}>
                                <CheckCircle className="w-3 h-3" /> {t('quiz_stat_graded')} ({percentage}%)
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => setSelectedSubmission(sub)}
                              className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400 rounded-lg transition-colors inline-flex items-center justify-center"
                              title={t('quiz_review_eval')}
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </FadeIn>
      </div>

      <GradeSubmissionModal 
        isOpen={!!selectedSubmission}
        onClose={() => setSelectedSubmission(null)}
        submission={selectedSubmission}
        onGradeSaved={() => {
          fetchSubmissions(); // Refresh the list
        }}
      />
    </div>
  );
}
