import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Users, BookOpen, Settings, AlertTriangle, ShieldCheck, 
  Plus, Edit, Trash2, Video, FileText, Search, LayoutDashboard, 
  ArrowLeft, CheckCircle
} from 'lucide-react';
import FadeIn from '../components/FadeIn';
import ConfirmModal from '../components/ConfirmModal';
import { supabase } from '../lib/supabase';
import { getDirectImageUrl } from '../utils/helpers';

export default function AdminDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [stats, setStats] = useState({ students: 0, courses: 0, pendingSubscriptions: 0 });
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, courseId: null });
  
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch stats
      const { count: studentsCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student');

      const { data: coursesData, count: coursesCount } = await supabase
        .from('courses')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      const { count: pendingSubscriptions } = await supabase
        .from('subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      setStats({
        students: studentsCount || 0,
        courses: coursesCount || 0,
        pendingSubscriptions: pendingSubscriptions || 0
      });

      if (coursesData) setCourses(coursesData);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id) => {
    setDeleteModal({ isOpen: true, courseId: id });
  };

  const confirmDeleteCourse = async () => {
    const id = deleteModal.courseId;
    if (!id) return;
    
    try {
      const { error } = await supabase.from('courses').delete().eq('id', id);
      if (error) throw error;
      setCourses(courses.filter(c => c.id !== id));
      setStats(prev => ({ ...prev, courses: prev.courses - 1 }));
    } catch (error) {
      console.error('Error deleting course:', error);
      alert('حدث خطأ أثناء الحذف.');
    } finally {
      setDeleteModal({ isOpen: false, courseId: null });
    }
  };

  const filteredCourses = courses.filter(course => 
    course.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (course.category && course.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 blur-[100px] rounded-full pointer-events-none mix-blend-screen"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/20 blur-[100px] rounded-full pointer-events-none mix-blend-screen"></div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          <FadeIn>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                  <ShieldCheck className="w-8 h-8 text-blue-300" />
                </div>
                <div>
                  <h1 className="text-4xl font-extrabold text-white font-arabic tracking-tight mb-2">
                    لوحة تحكم الإدارة
                  </h1>
                  <p className="text-blue-200/80 font-medium text-lg">
                    أهلاً بك. مركز التحكم الشامل بالمنصة.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center bg-white/10 backdrop-blur-md rounded-xl p-1 border border-white/10 shadow-inner">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all duration-300 ${activeTab === 'overview' ? 'bg-white text-blue-900 shadow-md transform scale-105' : 'text-blue-100 hover:text-white hover:bg-white/5'}`}
                >
                  <LayoutDashboard className="w-5 h-5" />
                  نظرة عامة
                </button>
                <button
                  onClick={() => setActiveTab('courses')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all duration-300 ${activeTab === 'courses' ? 'bg-white text-blue-900 shadow-md transform scale-105' : 'text-blue-100 hover:text-white hover:bg-white/5'}`}
                >
                  <BookOpen className="w-5 h-5" />
                  إدارة الكورسات
                </button>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-20">
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Students Card */}
              <FadeIn delay={100}>
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Users className="w-7 h-7" />
                    </div>
                    <span className="flex h-3 w-3 relative mt-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                    </span>
                  </div>
                  <div>
                    <h3 className="text-gray-500 dark:text-gray-400 font-bold mb-1">إجمالي الطلاب</h3>
                    <p className="text-4xl font-extrabold text-gray-900 dark:text-white">{stats.students}</p>
                  </div>
                </div>
              </FadeIn>
              
              {/* Courses Card */}
              <FadeIn delay={200}>
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-14 h-14 rounded-2xl bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <BookOpen className="w-7 h-7" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-gray-500 dark:text-gray-400 font-bold mb-1">الكورسات المنشورة</h3>
                    <p className="text-4xl font-extrabold text-gray-900 dark:text-white">{stats.courses}</p>
                  </div>
                </div>
              </FadeIn>

              {/* Subscriptions Card */}
              <FadeIn delay={300}>
                <Link to="/admin-dashboard/subscriptions" className="block bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-6 shadow-lg hover:shadow-orange-500/30 hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-[30px] pointer-events-none group-hover:bg-white/20 transition-colors"></div>
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md text-white flex items-center justify-center group-hover:scale-110 transition-transform border border-white/20">
                      <FileText className="w-7 h-7" />
                    </div>
                    {stats.pendingSubscriptions > 0 && (
                      <div className="bg-white text-red-600 px-3 py-1 rounded-full text-xs font-bold animate-pulse shadow-sm">
                        تتطلب المراجعة
                      </div>
                    )}
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-orange-100 font-bold mb-1">طلبات الاشتراك (قيد المراجعة)</h3>
                    <div className="flex items-end justify-between">
                      <p className="text-4xl font-extrabold text-white">{stats.pendingSubscriptions}</p>
                      <span className="text-white text-sm font-bold flex items-center gap-1 group-hover:gap-2 transition-all opacity-90 group-hover:opacity-100">
                        الذهاب للمراجعة <ArrowLeft className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </Link>
              </FadeIn>

            </div>

            {/* Quick Actions Panel */}
            <FadeIn delay={400}>
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-slate-700 mt-8">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 font-arabic border-b border-gray-100 dark:border-slate-700 pb-4">إجراءات سريعة</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Link to="/admin-dashboard/courses/new" className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group cursor-pointer">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Plus className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">إضافة كورس جديد</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">إنشاء محتوى تعليمي جديد</p>
                    </div>
                  </Link>

                  <Link to="/admin-dashboard/subscriptions" className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all group cursor-pointer">
                    <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <CheckCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">مراجعة الاشتراكات</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">تفعيل حسابات الطلاب</p>
                    </div>
                  </Link>
                </div>
              </div>
            </FadeIn>
          </div>
        )}

        {/* COURSES TAB */}
        {activeTab === 'courses' && (
          <FadeIn>
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-slate-700">
              
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6">
                <div>
                  <h2 className="text-2xl font-bold font-arabic text-gray-900 dark:text-white mb-2">
                    إدارة الكورسات المتاحة
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400">تعديل وحذف الكورسات ومحتوياتها بكل سهولة.</p>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                  <div className="relative w-full sm:w-64">
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      className="block w-full pr-10 py-3 bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 dark:text-white"
                      placeholder="ابحث عن كورس..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  
                  <Link 
                    to="/admin-dashboard/courses/new"
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/20 hover:shadow-blue-500/40"
                  >
                    <Plus className="w-5 h-5" />
                    إضافة كورس
                  </Link>
                </div>
              </div>

              {filteredCourses.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 dark:bg-slate-900/30 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700">
                  <BookOpen className="w-16 h-16 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">لم يتم العثور على كورسات</h3>
                  <p className="text-gray-500 dark:text-gray-400">جرب البحث بكلمات أخرى أو قم بإضافة كورس جديد.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-slate-700">
                  <table className="w-full text-right border-collapse">
                    <thead className="bg-gray-50 dark:bg-slate-900/50">
                      <tr className="text-gray-500 dark:text-gray-400 text-sm">
                        <th className="py-4 px-6 font-bold rounded-tr-2xl">معلومات الكورس</th>
                        <th className="py-4 px-6 font-bold">السعر</th>
                        <th className="py-4 px-6 font-bold">الحالة</th>
                        <th className="py-4 px-6 font-bold rounded-tl-2xl">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCourses.map((course) => (
                        <tr key={course.id} className="border-b border-gray-100 dark:border-slate-700/50 hover:bg-gray-50/80 dark:hover:bg-slate-800/80 transition-colors group">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-4">
                              {course.image_url ? (
                                <img src={getDirectImageUrl(course.image_url)} alt={course.title} className="w-20 h-14 rounded-xl object-cover shadow-sm border border-gray-100 dark:border-slate-700" />
                              ) : (
                                <div className="w-20 h-14 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center border border-gray-100 dark:border-slate-700">
                                  <BookOpen className="w-6 h-6 text-gray-400" />
                                </div>
                              )}
                              <div>
                                <p className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{course.title}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{course.category}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 font-bold text-gray-700 dark:text-gray-300">
                            {course.price > 0 ? <span className="text-green-600 dark:text-green-400">{course.price} ج.م</span> : 'مجاناً'}
                          </td>
                          <td className="py-4 px-6">
                            <span className={`px-4 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${course.is_published ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800/50' : 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300 border border-gray-200 dark:border-slate-600'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${course.is_published ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                              {course.is_published ? 'منشور نشط' : 'مسودة مغلقة'}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <Link 
                                to={`/admin-dashboard/courses/${course.id}`} 
                                title="إدارة الدروس والمحتوى" 
                                className="w-10 h-10 flex items-center justify-center bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 transition-all shadow-sm"
                              >
                                <Video className="w-5 h-5" />
                              </Link>
                              <Link 
                                to={`/admin-dashboard/courses/${course.id}/edit`} 
                                title="تعديل بيانات الكورس" 
                                className="w-10 h-10 flex items-center justify-center bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white dark:hover:bg-blue-500 transition-all shadow-sm"
                              >
                                <Edit className="w-5 h-5" />
                              </Link>
                              <button 
                                onClick={() => handleDeleteClick(course.id)} 
                                title="حذف الكورس" 
                                className="w-10 h-10 flex items-center justify-center bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-600 hover:text-white dark:hover:bg-red-500 transition-all shadow-sm"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </FadeIn>
        )}

      </div>

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, courseId: null })}
        onConfirm={confirmDeleteCourse}
        title="حذف الكورس نهائياً"
        message="هل أنت متأكد من رغبتك في حذف هذا الكورس؟ لن يمكنك التراجع عن هذا الإجراء وسيتم حذف جميع الدروس والمرفقات المرتبطة به بشكل نهائي."
        confirmText="نعم، احذف الكورس"
        cancelText="تراجع"
        isDanger={true}
      />
    </div>
  );
}
