import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  ClipboardList, Plus, Search, Edit, Trash2, 
  Users, CheckCircle, XCircle, Clock, Eye 
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import FadeIn from '../../components/FadeIn';
import ConfirmModal from '../../components/ConfirmModal';
import toast from 'react-hot-toast';
import { formatGradeName, formatQuizTitle, formatCourseTitle } from '../../utils/helpers';

export default function AdminQuizzes() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, quizId: null });

  useEffect(() => {
    fetchQuizzes(true);

    const channel = supabase
      .channel('admin_quizzes_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, () => {
        fetchQuizzes(false);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_submissions' }, () => {
        fetchQuizzes(false);
      })
      .subscribe();

    const handleFocus = () => {
      fetchQuizzes(false);
    };
    window.addEventListener('focus', handleFocus);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') handleFocus();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const fetchQuizzes = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const { data, error } = await supabase
        .from('quizzes')
        .select(`
          *,
          course:courses(title),
          submissions:quiz_submissions(count),
          questions:quiz_questions(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuizzes(data || []);
    } catch (error) {
      console.error('Error fetching quizzes:', error);
      if (showLoading) toast.error('حدث خطأ أثناء جلب الامتحانات');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      // Defensively delete dependent submissions and questions first
      await supabase.from('quiz_submissions').delete().eq('quiz_id', deleteModal.quizId);
      await supabase.from('quiz_questions').delete().eq('quiz_id', deleteModal.quizId);

      const { error } = await supabase
        .from('quizzes')
        .delete()
        .eq('id', deleteModal.quizId);

      if (error) throw error;

      toast.success('تم حذف الامتحان بنجاح');
      setQuizzes(quizzes.filter(q => q.id !== deleteModal.quizId));
    } catch (error) {
      console.error('Error deleting quiz:', error);
      toast.error('حدث خطأ أثناء الحذف: ' + (error.message || ''));
    } finally {
      setDeleteModal({ isOpen: false, quizId: null });
    }
  };

  const togglePublish = async (quiz) => {
    try {
      const { error } = await supabase
        .from('quizzes')
        .update({ is_published: !quiz.is_published })
        .eq('id', quiz.id);

      if (error) throw error;

      toast.success(quiz.is_published ? 'تم إخفاء الامتحان' : 'تم نشر الامتحان');
      setQuizzes(quizzes.map(q => 
        q.id === quiz.id ? { ...q, is_published: !quiz.is_published } : q
      ));
    } catch (error) {
      console.error('Error updating publish status:', error);
      toast.error('حدث خطأ أثناء التحديث');
    }
  };

  const filteredQuizzes = quizzes.filter(quiz => 
    quiz.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (quiz.grade_level && quiz.grade_level.includes(searchQuery)) ||
    (quiz.course?.title && quiz.course.title.includes(searchQuery))
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-12">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 pt-24 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center text-pink-600 dark:text-pink-400 shadow-inner">
                <ClipboardList className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white font-arabic">{t('admin_quizzes_title')}</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">{t('admin_quizzes_subtitle')}</p>
              </div>
            </div>
            
            <Link 
              to="/admin-dashboard/quizzes/new"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              <Plus className="w-5 h-5" />
              {t('quiz_add_new')}
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Search */}
        <div className="relative mb-8 max-w-md">
          <input
            type="text"
            placeholder={t('common_search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full ${isRTL ? 'pl-10 pr-12' : 'pr-10 pl-12'} py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-white`}
          />
          <Search className={`absolute ${isRTL ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5`} />
        </div>

        {/* Quizzes Grid */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          </div>
        ) : filteredQuizzes.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center shadow-sm border border-gray-100 dark:border-slate-700">
            <ClipboardList className="w-20 h-20 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t('student_quizzes_no_available')}</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">{isRTL ? 'قم بإضافة أول امتحان ليبدأ الطلاب في الاختبار.' : 'Add your first quiz so students can start testing.'}</p>
            <Link to="/admin-dashboard/quizzes/new" className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors">
              <Plus className="w-5 h-5" />
              {t('quiz_create_btn')}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredQuizzes.map((quiz, index) => (
              <FadeIn key={quiz.id} delay={index * 50}>
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow group">
                  <div className="p-6">
                    {/* Status & Title Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white line-clamp-2">
                        {formatQuizTitle(quiz.title)}
                      </h3>
                      {quiz.is_published ? (
                        <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-bold flex items-center gap-1 shrink-0">
                          <CheckCircle className="w-3 h-3" /> {t('quiz_status_published')}
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded-full text-xs font-bold flex items-center gap-1 shrink-0">
                          <XCircle className="w-3 h-3" /> {t('quiz_status_draft')}
                        </span>
                      )}
                    </div>
                    
                    <div className="space-y-2 mt-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">{t('quiz_target_label')}</span>
                        <span className="font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                          {quiz.course?.title ? formatCourseTitle(quiz.course.title) : (quiz.grade_level ? formatGradeName(quiz.grade_level) : (isRTL ? 'الجميع' : 'All'))}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">{t('quiz_q_count_label')}</span>
                        <span className="font-bold text-gray-900 dark:text-white">{quiz.questions?.[0]?.count || 0} {t('quiz_questions_unit')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">{t('quiz_time_label')}</span>
                        <span className="font-bold text-gray-900 dark:text-white flex items-center gap-1">
                          {quiz.duration_minutes ? (
                            <><Clock className="w-3 h-3" /> {quiz.duration_minutes} {t('quiz_minutes_unit')}</>
                          ) : (isRTL ? 'مفتوح' : 'Unlimited')}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">{t('quiz_submissions_label')}</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <Users className="w-3 h-3" /> {quiz.submissions?.[0]?.count || 0} {t('chat_student_default')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-6 py-4 border-t border-gray-50 dark:border-slate-700/50 bg-gray-50 dark:bg-slate-800/50 flex items-center justify-between gap-2">
                    <button 
                      onClick={() => togglePublish(quiz)}
                      className={`flex-1 py-2 text-sm font-bold rounded-lg border transition-colors ${
                        quiz.is_published 
                          ? 'border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-slate-600 dark:text-gray-300 dark:hover:bg-slate-700' 
                          : 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40'
                      }`}
                    >
                      {quiz.is_published ? t('quiz_unpublish') : t('quiz_publish')}
                    </button>
                    
                    <Link 
                      to={`/admin-dashboard/quizzes/${quiz.id}/submissions`}
                      className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400 rounded-lg transition-colors"
                      title={t('admin_quizzes_btn_submissions')}
                    >
                      <Eye className="w-5 h-5" />
                    </Link>

                    <Link 
                      to={`/admin-dashboard/quizzes/${quiz.id}/edit`}
                      className="p-2 text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      title={t('common_edit')}
                    >
                      <Edit className="w-5 h-5" />
                    </Link>
                    
                    <button 
                      onClick={() => setDeleteModal({ isOpen: true, quizId: quiz.id })}
                      className="p-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      title={t('common_delete')}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, quizId: null })}
        onConfirm={handleDelete}
        title={t('admin_quizzes_delete_title')}
        message={t('quiz_delete_confirm')}
        confirmText={t('common_delete')}
        cancelText={t('common_cancel')}
        type="danger"
      />
    </div>
  );
}
