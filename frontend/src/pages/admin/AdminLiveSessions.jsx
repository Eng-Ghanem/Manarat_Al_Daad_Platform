import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Video, Calendar, Clock, Plus, Trash2, Edit, X, ArrowRight,
  Link as LinkIcon, BookOpen, AlertCircle, Loader, Users
} from 'lucide-react';
import { Link } from 'react-router-dom';
import FadeIn from '../../components/FadeIn';
import { supabase } from '../../lib/supabase';
import ConfirmModal from '../../components/ConfirmModal';

export default function AdminLiveSessions() {
  const { t } = useTranslation();
  
  const [sessions, setSessions] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    zoom_link: '',
    course_id: ''
  });
  const [formLoading, setFormLoading] = useState(false);

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch courses for the dropdown
      const { data: coursesData } = await supabase
        .from('courses')
        .select('id, title, is_published')
        .order('created_at', { ascending: false });
      
      if (coursesData) setCourses(coursesData);

      // Fetch sessions
      const { data: sessionsData, error } = await supabase
        .from('online_sessions')
        .select(`
          *,
          courses(title)
        `)
        .order('start_time', { ascending: true });

      if (error) throw error;
      setSessions(sessionsData || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (session = null) => {
    if (session) {
      // Convert UTC to local datetime string for input (YYYY-MM-DDThh:mm)
      const toLocalDatetimeStr = (utcStr) => {
        const d = new Date(utcStr);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().slice(0, 16);
      };

      setFormData({
        title: session.title,
        description: session.description || '',
        start_time: toLocalDatetimeStr(session.start_time),
        end_time: toLocalDatetimeStr(session.end_time),
        zoom_link: session.zoom_link,
        course_id: session.course_id || ''
      });
      setIsEditing(true);
      setCurrentSessionId(session.id);
    } else {
      setFormData({
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        zoom_link: '',
        course_id: ''
      });
      setIsEditing(false);
      setCurrentSessionId(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData({
      title: '',
      description: '',
      start_time: '',
      end_time: '',
      zoom_link: '',
      course_id: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        start_time: new Date(formData.start_time).toISOString(),
        end_time: new Date(formData.end_time).toISOString(),
        zoom_link: formData.zoom_link,
        course_id: formData.course_id === '' ? null : formData.course_id
      };

      if (isEditing) {
        const { error } = await supabase
          .from('online_sessions')
          .update(payload)
          .eq('id', currentSessionId);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('online_sessions')
          .insert([payload]);
        
        if (error) throw error;
      }

      await fetchData();
      handleCloseModal();
    } catch (err) {
      console.error('Error saving session:', err);
      alert('حدث خطأ أثناء الحفظ.');
    } finally {
      setFormLoading(false);
    }
  };

  const confirmDelete = async () => {
    try {
      const { error } = await supabase
        .from('online_sessions')
        .delete()
        .eq('id', deleteModal.id);
      
      if (error) throw error;
      setSessions(sessions.filter(s => s.id !== deleteModal.id));
    } catch (err) {
      console.error('Error deleting session:', err);
      alert('حدث خطأ أثناء الحذف.');
    } finally {
      setDeleteModal({ isOpen: false, id: null });
    }
  };

  // Group sessions by status (upcoming vs past)
  const now = new Date();
  const upcomingSessions = sessions.filter(s => new Date(s.end_time) > now);
  const pastSessions = sessions.filter(s => new Date(s.end_time) <= now);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin shadow-lg"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-12">
      
      {/* High-End Header */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 pt-20 pb-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 blur-[100px] rounded-full pointer-events-none mix-blend-screen"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/20 blur-[100px] rounded-full pointer-events-none mix-blend-screen"></div>
        
        <div className="max-w-7xl mx-auto relative z-10 flex flex-col items-center">
          <Link to="/admin-dashboard" className="absolute top-0 right-0 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md font-bold text-sm">
            <ArrowRight className="w-4 h-4" />
            العودة للوحة التحكم
          </Link>

          <FadeIn>
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.1)] mb-6">
                <Video className="w-10 h-10 text-blue-300" />
              </div>
              <h1 className="text-4xl font-extrabold text-white font-arabic tracking-tight mb-4">
                إدارة حصص الأونلاين
              </h1>
              <p className="text-blue-200/80 font-medium text-lg max-w-2xl">
                جدولة الحصص المباشرة عبر Zoom وتحديد الطلاب المسموح لهم بالدخول حسب الكورس.
              </p>
            </div>
          </FadeIn>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-20">
        <FadeIn delay={100}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
            
            <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4 border-b border-gray-100 dark:border-slate-700 pb-6">
              <h2 className="text-2xl font-bold font-arabic text-gray-900 dark:text-white flex items-center gap-3">
                <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                الحصص القادمة
              </h2>
              <button 
                onClick={() => handleOpenModal()}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/20 hover:shadow-blue-500/40"
              >
                <Plus className="w-5 h-5" />
                جدولة حصة جديدة
              </button>
            </div>

            {upcomingSessions.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 dark:bg-slate-900/30 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 mb-12">
                <Video className="w-16 h-16 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">لا يوجد حصص قادمة مجدولة</h3>
                <p className="text-gray-500 dark:text-gray-400">قم بإضافة حصصك المباشرة لتظهر للطلاب هنا.</p>
              </div>
            ) : (
              <div className="grid gap-6 mb-12">
                {upcomingSessions.map((session) => (
                  <div key={session.id} className="flex flex-col lg:flex-row items-center justify-between p-6 rounded-2xl bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 hover:border-blue-300 transition-colors">
                    <div className="w-full lg:w-2/3">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{session.title}</h3>
                        <span className="px-3 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          قادم
                        </span>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 mb-4">{session.description}</p>
                      
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 px-4 py-2 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                          <Calendar className="w-4 h-4 text-blue-600" />
                          <span dir="ltr">{new Date(session.start_time).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 px-4 py-2 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                          <Clock className="w-4 h-4 text-orange-500" />
                          <span dir="ltr">{new Date(session.start_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                          <span>إلى</span>
                          <span dir="ltr">{new Date(session.end_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 px-4 py-2 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                          {session.course_id ? (
                            <><BookOpen className="w-4 h-4 text-green-600" /> كورس: {session.courses?.title}</>
                          ) : (
                            <><Users className="w-4 h-4 text-purple-600" /> عام للجميع</>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-row lg:flex-col items-center gap-3 w-full lg:w-auto mt-6 lg:mt-0 pt-6 lg:pt-0 border-t lg:border-t-0 border-gray-200 dark:border-slate-700">
                      <a 
                        href={session.zoom_link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-xl font-bold transition-all w-full text-center"
                      >
                        <LinkIcon className="w-5 h-5" />
                        رابط Zoom
                      </a>
                      <div className="flex items-center gap-2 w-full lg:w-auto">
                        <button 
                          onClick={() => handleOpenModal(session)}
                          className="flex-1 lg:flex-none flex items-center justify-center p-3 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-blue-600 hover:text-white rounded-xl transition-all"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => setDeleteModal({ isOpen: true, id: session.id })}
                          className="flex-1 lg:flex-none flex items-center justify-center p-3 bg-red-100 dark:bg-red-900/30 text-red-600 hover:bg-red-600 hover:text-white rounded-xl transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Past Sessions */}
            {pastSessions.length > 0 && (
              <div className="mt-12">
                <h2 className="text-xl font-bold font-arabic text-gray-900 dark:text-white mb-6 border-b border-gray-100 dark:border-slate-700 pb-4">
                  الحصص السابقة
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-70">
                  {pastSessions.map((session) => (
                    <div key={session.id} className="flex flex-col p-5 rounded-2xl bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-gray-900 dark:text-white">{session.title}</h3>
                        <span className="text-xs px-2 py-1 rounded-md bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-400">منتهي</span>
                      </div>
                      <div className="text-sm text-gray-500 mb-4" dir="ltr">
                        {new Date(session.start_time).toLocaleDateString('ar-EG')} - {new Date(session.start_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="flex items-center gap-2 mt-auto pt-4 border-t border-gray-200 dark:border-slate-700">
                        <button onClick={() => handleOpenModal(session)} className="text-gray-500 hover:text-blue-600"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => setDeleteModal({ isOpen: true, id: session.id })} className="text-gray-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </FadeIn>
      </div>

      {/* Session Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={handleCloseModal}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-800 z-10">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {isEditing ? 'تعديل الحصة' : 'جدولة حصة جديدة'}
              </h2>
              <button onClick={handleCloseModal} className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-500 hover:bg-red-100 hover:text-red-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">عنوان الحصة *</label>
                <input 
                  type="text" 
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                  placeholder="مثال: مراجعة الباب الأول..."
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">وصف الحصة</label>
                <textarea 
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                  placeholder="تفاصيل الحصة وما سيتم شرحه..."
                ></textarea>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">وقت البدء *</label>
                  <input 
                    type="datetime-local" 
                    required
                    value={formData.start_time}
                    onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">وقت الانتهاء *</label>
                  <input 
                    type="datetime-local" 
                    required
                    value={formData.end_time}
                    onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">رابط Zoom (أو Google Meet) *</label>
                <input 
                  type="url" 
                  required
                  value={formData.zoom_link}
                  onChange={(e) => setFormData({...formData, zoom_link: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                  placeholder="https://zoom.us/j/..."
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">تخصيص لكورس (اختياري)</label>
                <select
                  value={formData.course_id}
                  onChange={(e) => setFormData({...formData, course_id: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                >
                  <option value="">عام لجميع الطلاب</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>{course.title}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  إذا اخترت كورس، سيتمكن طلاب هذا الكورس فقط (ذوي الاشتراك الفعال) من رؤية رابط الحصة.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-slate-700">
                <button 
                  type="button" 
                  onClick={handleCloseModal}
                  className="px-6 py-3 rounded-xl font-bold bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  type="submit" 
                  disabled={formLoading}
                  className="px-8 py-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {formLoading ? <Loader className="w-5 h-5 animate-spin" /> : 'حفظ الحصة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: null })}
        onConfirm={confirmDelete}
        title="حذف الحصة"
        message="هل أنت متأكد من إلغاء وحذف هذه الحصة المباشرة؟"
        confirmText="نعم، احذف"
        cancelText="تراجع"
        isDanger={true}
      />
    </div>
  );
}
