import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { BookOpen, Video, Plus, Edit, Trash2, ArrowRight, Loader, PlayCircle } from 'lucide-react';
import FadeIn from '../../components/FadeIn';
import { getDirectImageUrl } from '../../utils/helpers';
import BackButton from '../../components/BackButton';
import ConfirmModal from '../../components/ConfirmModal';
import toast from 'react-hot-toast';

export default function CourseDetailsAdmin() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourseDetails();
  }, [id]);

  const [deleteConfig, setDeleteConfig] = useState({ isOpen: false, lessonId: null });

  const fetchCourseDetails = async () => {
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
      setLessons(lessonsData);
      
    } catch (error) {
      console.error('Error fetching course details:', error);
      toast.error(t('admin_error_fetch_course') || 'حدث خطأ أثناء جلب بيانات الكورس');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLesson = async (lessonId) => {
    setDeleteConfig({ isOpen: true, lessonId });
  };

  const confirmDeleteLesson = async () => {
    const lessonId = deleteConfig.lessonId;
    setDeleteConfig({ isOpen: false, lessonId: null });
    
    try {
      const { error } = await supabase.from('lessons').delete().eq('id', lessonId);
      if (error) throw error;
      setLessons(lessons.filter(l => l.id !== lessonId));
      toast.success(i18n.language === 'en' ? 'Lesson deleted successfully.' : 'تم حذف الدرس بنجاح.');
    } catch (error) {
      console.error('Error deleting lesson:', error);
      toast.error(i18n.language === 'en' ? 'Error deleting lesson.' : 'حدث خطأ أثناء حذف الدرس.');
    }
  };

  const toggleCoursePublishStatus = async () => {
    try {
      const newStatus = !course.is_published;
      const { error } = await supabase
        .from('courses')
        .update({ is_published: newStatus })
        .eq('id', id);
        
      if (error) throw error;
      setCourse({ ...course, is_published: newStatus });
      toast.success(newStatus ? (i18n.language === 'en' ? 'Course published!' : 'تم نشر الكورس بنجاح!') : (i18n.language === 'en' ? 'Course unpublished.' : 'تم تحويل الكورس إلى مسودة.'));
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error(i18n.language === 'en' ? 'Error updating course status.' : 'حدث خطأ أثناء تغيير حالة الكورس.');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center dark:bg-slate-900"><Loader className="w-8 h-8 text-blue-600 animate-spin" /></div>;
  }

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center dark:bg-slate-900 text-center px-4">
        <BookOpen className="w-16 h-16 text-gray-300 dark:text-slate-700 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {i18n.language === 'en' ? 'Course not found' : 'الكورس غير موجود'}
        </h2>
        <div className="mb-6">
          <BackButton to="/admin-dashboard" text={t('admin_back_to_dashboard')} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <BackButton to="/admin-dashboard" text={t('admin_course_back_courses')} />
        </div>

        <FadeIn>
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-slate-700 mb-8 flex flex-col md:flex-row gap-8 items-start md:items-center">
            {course.image_url ? (
              <img src={getDirectImageUrl(course.image_url)} alt={course.title} className="w-full md:w-64 h-40 object-cover rounded-2xl shadow-sm" />
            ) : (
              <div className="w-full md:w-64 h-40 rounded-2xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 border-2 border-dashed border-gray-300 dark:border-slate-600">
                <BookOpen className="w-12 h-12 text-gray-300 dark:text-slate-500" />
              </div>
            )}
            
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-bold rounded-full">
                  {course.category}
                </span>
                <span className={`px-3 py-1 text-sm font-bold rounded-full ${course.is_published ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                  {course.is_published ? t('admin_course_published_badge') : t('admin_course_draft_badge')}
                </span>
              </div>
              <h1 className="text-3xl font-bold font-arabic text-gray-900 dark:text-white mb-2">{course.title}</h1>
              <p className="text-gray-500 dark:text-gray-400 line-clamp-2 mb-6 max-w-2xl">{course.description}</p>
              
              <div className="flex flex-wrap items-center gap-4">
                <button 
                  onClick={toggleCoursePublishStatus}
                  className={`px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm ${course.is_published ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                >
                  {course.is_published ? t('admin_course_unpublish_btn') : t('admin_course_publish_btn')}
                </button>
                <button onClick={() => navigate(`/admin-dashboard/courses/${course.id}/edit`)} className="px-5 py-2.5 rounded-xl font-bold bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-gray-200 transition-all flex items-center gap-2">
                  <Edit className="w-4 h-4" /> {t('admin_course_edit_data')}
                </button>
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Lessons Section */}
        <FadeIn delay={100}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-slate-700">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4 pb-6 border-b border-gray-100 dark:border-slate-700">
              <div>
                <h2 className="text-2xl font-bold font-arabic text-gray-900 dark:text-white flex items-center gap-2 mb-1">
                  <Video className="w-6 h-6 text-indigo-500" />
                  {t('admin_course_lessons_title')}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">{t('admin_course_lessons_desc')}</p>
              </div>
              <Link 
                to={`/admin-dashboard/courses/${course.id}/lessons/new`}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors shadow-sm w-full sm:w-auto justify-center"
              >
                <Plus className="w-5 h-5" />
                {t('admin_course_add_lesson')}
              </Link>
            </div>

            {lessons.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700">
                <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Video className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('admin_course_no_lessons')}</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">{t('admin_course_no_lessons_desc')}</p>
                <Link 
                  to={`/admin-dashboard/courses/${course.id}/lessons/new`}
                  className="inline-flex items-center gap-2 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-400 font-bold px-6 py-3 rounded-xl transition-colors"
                >
                  <Plus className="w-5 h-5" /> {t('admin_course_add_lesson')}
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {lessons.map((lesson, index) => (
                  <div key={lesson.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 dark:bg-slate-900/50 dark:hover:bg-slate-800 transition-colors border border-gray-100 dark:border-slate-700 gap-4">
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0">
                        {index + 1}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-white text-lg flex items-center gap-2">
                          {lesson.title}
                          {lesson.is_free_preview && (
                            <span className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 px-2 py-1 rounded-md font-bold uppercase tracking-wider">{t('admin_lesson_free_badge')}</span>
                          )}
                        </h4>
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {lesson.video_url && <span className="flex items-center gap-1"><PlayCircle className="w-4 h-4" /> {i18n.language === 'en' ? 'Video available' : 'يوجد فيديو'}</span>}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t sm:border-t-0 border-gray-200 dark:border-slate-700 pt-4 sm:pt-0">
                      <button onClick={() => navigate(`/admin-dashboard/courses/${course.id}/lessons/${lesson.id}`)} className="p-2.5 text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 rounded-xl transition-colors">
                        <Edit className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleDeleteLesson(lesson.id)} className="p-2.5 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-xl transition-colors">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </FadeIn>

      </div>
      
      <ConfirmModal 
        isOpen={deleteConfig.isOpen}
        onClose={() => setDeleteConfig({ isOpen: false, lessonId: null })}
        onConfirm={confirmDeleteLesson}
        title={t('admin_lesson_delete_title')}
        message={t('admin_lesson_delete_msg')}
        confirmText={t('common_delete')}
        cancelText={t('common_cancel')}
        isDanger={true}
      />
    </div>
  );
}
