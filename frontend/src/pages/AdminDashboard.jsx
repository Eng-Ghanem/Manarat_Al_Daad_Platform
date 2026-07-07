import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, BookOpen, Settings, AlertTriangle, ShieldCheck, Plus, Edit, Trash2, Video, FileText } from 'lucide-react';
import FadeIn from '../components/FadeIn';
import { supabase } from '../lib/supabase';
import { getDirectImageUrl } from '../utils/helpers';

export default function AdminDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [stats, setStats] = useState({ students: 0, courses: 0 });
  const [loading, setLoading] = useState(true);

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

  const handleDeleteCourse = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الكورس؟ لن يمكنك التراجع عن هذا الإجراء وسيتم حذف جميع دروسه أيضاً.')) return;
    
    try {
      const { error } = await supabase.from('courses').delete().eq('id', id);
      if (error) throw error;
      setCourses(courses.filter(c => c.id !== id));
      setStats(prev => ({ ...prev, courses: prev.courses - 1 }));
    } catch (error) {
      console.error('Error deleting course:', error);
      alert('حدث خطأ أثناء الحذف.');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center dark:bg-slate-900"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <FadeIn>
          <div className="bg-gradient-to-r from-blue-900 to-slate-900 rounded-3xl p-8 mb-8 text-white flex items-center justify-between shadow-xl">
            <div>
              <h1 className="text-3xl font-extrabold font-arabic mb-2 flex items-center gap-3">
                <ShieldCheck className="w-8 h-8 text-blue-400" />
                لوحة تحكم الإدارة
              </h1>
              <p className="text-blue-200">أهلاً بك يا أستاذ سيد. من هنا يمكنك إدارة المنصة بالكامل.</p>
            </div>
            <div className="hidden md:block opacity-20">
              <ShieldCheck className="w-32 h-32" />
            </div>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <FadeIn delay={100}>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-gray-700 dark:text-gray-300">الطلاب</h3>
              </div>
              <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{stats.students}</p>
            </div>
          </FadeIn>
          
          <FadeIn delay={200}>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center">
                  <BookOpen className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-gray-700 dark:text-gray-300">الكورسات</h3>
              </div>
              <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{stats.courses}</p>
            </div>
          </FadeIn>

          <FadeIn delay={300}>
            <Link to="/admin-dashboard/subscriptions" className="block bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 hover:border-blue-500 transition-colors group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[40px] pointer-events-none group-hover:bg-blue-500/20 transition-colors"></div>
              <div className="flex items-center gap-4 mb-4 relative z-10">
                <div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-gray-700 dark:text-gray-300">طلبات الاشتراك</h3>
              </div>
              <div className="flex items-end justify-between relative z-10">
                <p className="text-3xl font-extrabold text-gray-900 dark:text-white">{stats.pendingSubscriptions || 0}</p>
                <span className="text-sm text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
                  مراجعة الطلبات
                </span>
              </div>
            </Link>
          </FadeIn>
        </div>

        <FadeIn delay={300}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-slate-700">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
              <h2 className="text-2xl font-bold font-arabic text-gray-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                إدارة الكورسات
              </h2>
              <Link 
                to="/admin-dashboard/courses/new"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors"
              >
                <Plus className="w-5 h-5" />
                إضافة كورس جديد
              </Link>
            </div>

            {courses.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700">
                <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">لا يوجد كورسات حالياً</h3>
                <p className="text-gray-500 dark:text-gray-400">ابدأ بإضافة أول كورس لك الآن!</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400">
                      <th className="pb-4 font-bold">الكورس</th>
                      <th className="pb-4 font-bold">السعر</th>
                      <th className="pb-4 font-bold">الحالة</th>
                      <th className="pb-4 font-bold">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courses.map((course) => (
                      <tr key={course.id} className="border-b border-gray-100 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-4">
                          <div className="flex items-center gap-4">
                            {course.image_url ? (
                              <img src={getDirectImageUrl(course.image_url)} alt={course.title} className="w-16 h-12 rounded-lg object-cover" />
                            ) : (
                              <div className="w-16 h-12 rounded-lg bg-gray-200 dark:bg-slate-700 flex items-center justify-center">
                                <BookOpen className="w-6 h-6 text-gray-400" />
                              </div>
                            )}
                            <div>
                              <p className="font-bold text-gray-900 dark:text-white">{course.title}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{course.category}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 font-bold text-gray-700 dark:text-gray-300">
                          {course.price > 0 ? `${course.price} ج.م` : 'مجاناً'}
                        </td>
                        <td className="py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${course.is_published ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                            {course.is_published ? 'منشور' : 'مسودة'}
                          </span>
                        </td>
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            <Link to={`/admin-dashboard/courses/${course.id}`} title="إدارة الدروس والمحتوى" className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors">
                              <Video className="w-5 h-5" />
                            </Link>
                            <Link to={`/admin-dashboard/courses/${course.id}/edit`} title="تعديل بيانات الكورس" className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                              <Edit className="w-5 h-5" />
                            </Link>
                            <button onClick={() => handleDeleteCourse(course.id)} title="حذف الكورس" className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
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

      </div>
    </div>
  );
}
