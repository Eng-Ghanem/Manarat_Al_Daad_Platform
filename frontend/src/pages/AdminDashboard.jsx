import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Users, BookOpen, Settings, AlertTriangle, ShieldCheck, 
  Plus, Edit, Trash2, Video, FileText, Search, LayoutDashboard, 
  ArrowLeft, CheckCircle, ChevronLeft, Calendar
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
    
    setDeleteModal({ isOpen: false, courseId: null });
    
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
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] pb-12 font-arabic selection:bg-blue-500/30">
      
      {/* High-End Header */}
      <div className="bg-gradient-to-br from-blue-900 via-slate-900 to-indigo-950 pt-24 pb-32 px-4 sm:px-6 lg:px-8 relative overflow-hidden shadow-2xl">
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/20 blur-[120px] rounded-full pointer-events-none mix-blend-screen translate-x-1/3 -translate-y-1/3"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-500/20 blur-[150px] rounded-full pointer-events-none mix-blend-screen -translate-x-1/3 translate-y-1/3"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] mix-blend-overlay"></div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          <FadeIn>
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/20 shadow-[0_0_30px_rgba(59,130,246,0.3)] relative group">
                  <div className="absolute inset-0 bg-blue-500 rounded-3xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500"></div>
                  <ShieldCheck className="w-10 h-10 text-blue-300 relative z-10" />
                </div>
                <div>
                  <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-3 drop-shadow-md">
                    لوحة تحكم الإدارة
                  </h1>
                  <p className="text-blue-100/80 font-medium text-lg flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                    أهلاً بك. مركز التحكم الشامل بالمنصة.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center bg-white/5 backdrop-blur-xl rounded-2xl p-1.5 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold transition-all duration-300 ${activeTab === 'overview' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/50 scale-100' : 'text-blue-200/70 hover:text-white hover:bg-white/10'}`}
                >
                  <LayoutDashboard className="w-5 h-5" />
                  نظرة عامة
                </button>
                <button
                  onClick={() => setActiveTab('courses')}
                  className={`flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold transition-all duration-300 ${activeTab === 'courses' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-900/50 scale-100' : 'text-blue-200/70 hover:text-white hover:bg-white/10'}`}
                >
                  <BookOpen className="w-5 h-5" />
                  إدارة الكورسات
                </button>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-20">
        
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-10">
            {/* Stats Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Students Stat */}
              <FadeIn delay={100}>
                <Link to="/admin-dashboard/students" className="block bg-white dark:bg-[#1E293B] rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-gray-100 dark:border-slate-800 hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-900/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none group-hover:scale-150 transition-transform duration-700"></div>
                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-900/10 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-inner border border-white dark:border-blue-800/30">
                      <Users className="w-8 h-8" />
                    </div>
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-gray-500 dark:text-slate-400 font-bold mb-2">إجمالي الطلاب</h3>
                    <div className="flex items-end justify-between">
                      <p className="text-5xl font-black text-gray-900 dark:text-white tracking-tight">{stats.students}</p>
                      <span className="text-blue-600 dark:text-blue-400 text-sm font-bold flex items-center gap-1.5 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                        إدارة الطلاب <ChevronLeft className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </Link>
              </FadeIn>
              
              {/* Courses Stat */}
              <FadeIn delay={200}>
                <div onClick={() => setActiveTab('courses')} className="bg-white dark:bg-[#1E293B] rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-gray-100 dark:border-slate-800 hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 group cursor-pointer relative overflow-hidden text-right">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 dark:bg-emerald-900/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none group-hover:scale-150 transition-transform duration-700"></div>
                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/40 dark:to-emerald-900/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-inner border border-white dark:border-emerald-800/30">
                      <BookOpen className="w-8 h-8" />
                    </div>
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-gray-500 dark:text-slate-400 font-bold mb-2">الكورسات المنشورة</h3>
                    <div className="flex items-end justify-between">
                      <p className="text-5xl font-black text-gray-900 dark:text-white tracking-tight">{stats.courses}</p>
                      <span className="text-emerald-600 dark:text-emerald-400 text-sm font-bold flex items-center gap-1.5 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                        عرض الكورسات <ChevronLeft className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </div>
              </FadeIn>

              {/* Subscriptions Stat (Priority) */}
              <FadeIn delay={300}>
                <Link to="/admin-dashboard/subscriptions" className="block bg-gradient-to-br from-orange-500 via-orange-600 to-rose-600 rounded-3xl p-8 shadow-lg hover:shadow-orange-500/40 hover:-translate-y-1.5 transition-all duration-300 group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-white/20 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none group-hover:scale-150 group-hover:bg-white/30 transition-all duration-700"></div>
                  <div className="flex justify-between items-start mb-6 relative z-10">
                    <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md text-white flex items-center justify-center group-hover:scale-110 transition-transform duration-300 border border-white/30 shadow-inner">
                      <FileText className="w-8 h-8" />
                    </div>
                    {stats.pendingSubscriptions > 0 && (
                      <div className="bg-white/95 text-rose-600 px-4 py-1.5 rounded-full text-xs font-bold shadow-xl flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                        قيد الانتظار
                      </div>
                    )}
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-orange-100 font-bold mb-2">طلبات الاشتراك</h3>
                    <div className="flex items-end justify-between">
                      <p className="text-5xl font-black text-white tracking-tight">{stats.pendingSubscriptions}</p>
                      <span className="text-white text-sm font-bold flex items-center gap-1.5 opacity-90 group-hover:opacity-100 group-hover:-translate-x-1 transition-all duration-300">
                        مراجعة الطلبات <ChevronLeft className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </Link>
              </FadeIn>
            </div>

            {/* Quick Actions Grid */}
            <FadeIn delay={400}>
              <div className="bg-white dark:bg-[#1E293B] rounded-3xl p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-gray-100 dark:border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
                
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-500 dark:text-gray-400">
                    <LayoutDashboard className="w-5 h-5" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">إجراءات سريعة</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <Link to="/admin-dashboard/courses/new" className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-md text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                      <Plus className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors mb-1">إضافة كورس</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">محتوى تعليمي جديد</p>
                    </div>
                  </Link>

                  <Link to="/admin-dashboard/subscriptions" className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-md text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700 text-orange-600 dark:text-orange-400 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                      <CheckCircle className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors mb-1">الاشتراكات</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">تفعيل حسابات الطلاب</p>
                    </div>
                  </Link>

                  <Link to="/admin-dashboard/students" className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-md text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                      <Users className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors mb-1">إدارة الطلاب</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">سجل وحسابات الطلاب</p>
                    </div>
                  </Link>

                  <Link to="/admin-dashboard/live-sessions" className="flex flex-col items-center justify-center gap-4 p-8 rounded-2xl bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-800 hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-md text-center">
                    <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                      <Video className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors mb-1">حصص Zoom</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400">إدارة البث المباشر</p>
                    </div>
                  </Link>
                </div>
              </div>
            </FadeIn>
          </div>
        )}

        {/* COURSES TAB (Cards Layout) */}
        {activeTab === 'courses' && (
          <FadeIn>
            <div className="bg-transparent">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6 bg-white dark:bg-[#1E293B] p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <BookOpen className="w-7 h-7" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white">إدارة الكورسات</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 font-medium">تصفح وتعديل المحتوى التعليمي للمنصة.</p>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                  <div className="relative w-full sm:w-72">
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      className="block w-full pr-12 py-3.5 bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 dark:text-white font-medium shadow-inner"
                      placeholder="ابحث عن كورس..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  
                  <Link 
                    to="/admin-dashboard/courses/new"
                    className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5"
                  >
                    <Plus className="w-5 h-5" />
                    إضافة كورس
                  </Link>
                </div>
              </div>

              {filteredCourses.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-[#1E293B] rounded-3xl border border-gray-100 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
                  <div className="w-24 h-24 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                    <BookOpen className="w-10 h-10 text-gray-300 dark:text-slate-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">لا توجد كورسات</h3>
                  <p className="text-gray-500 dark:text-gray-400">جرب البحث بكلمة أخرى أو قم بإنشاء كورس جديد.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8">
                  {filteredCourses.map((course) => (
                    <div key={course.id} className="bg-white dark:bg-[#1E293B] rounded-3xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:shadow-2xl border border-gray-100 dark:border-slate-800 hover:border-blue-100 dark:hover:border-blue-900/50 transition-all duration-300 group flex flex-col hover:-translate-y-1.5">
                      
                      {/* Course Image Banner */}
                      <div className="relative h-48 w-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                        {course.image_url ? (
                          <img 
                            src={getDirectImageUrl(course.image_url)} 
                            alt={course.title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                            <BookOpen className="w-12 h-12 text-gray-300 dark:text-slate-700" />
                          </div>
                        )}
                        
                        {/* Status Badge overlay */}
                        <div className="absolute top-4 right-4">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 backdrop-blur-md shadow-lg ${course.is_published ? 'bg-white/90 text-green-700 dark:bg-slate-900/90 dark:text-green-400' : 'bg-white/90 text-gray-700 dark:bg-slate-900/90 dark:text-gray-300'}`}>
                            <span className={`w-2 h-2 rounded-full ${course.is_published ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                            {course.is_published ? 'منشور' : 'مسودة'}
                          </span>
                        </div>
                      </div>

                      {/* Course Info */}
                      <div className="p-6 flex flex-col flex-grow">
                        <div className="mb-3">
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-800/50 shadow-sm">
                            {course.category || 'غير مصنف'}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 line-clamp-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {course.title}
                        </h3>
                        
                        <div className="mt-auto pt-6 flex items-center justify-between">
                          <span className="font-black text-2xl text-gray-900 dark:text-white">
                            {course.price > 0 ? `${course.price} ج.م` : <span className="text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-lg text-lg">مجاناً</span>}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="px-6 pb-6 pt-0 flex gap-2">
                        <Link 
                          to={`/admin-dashboard/courses/${course.id}`} 
                          title="إدارة المحتوى" 
                          className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-xl hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 transition-all font-bold text-sm shadow-sm"
                        >
                          <Video className="w-4 h-4" />
                          المحتوى
                        </Link>
                        <Link 
                          to={`/admin-dashboard/courses/${course.id}/edit`} 
                          title="تعديل" 
                          className="w-12 flex items-center justify-center py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white dark:hover:bg-blue-500 transition-all shadow-sm"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button 
                          onClick={() => handleDeleteClick(course.id)} 
                          title="حذف" 
                          className="w-12 flex items-center justify-center py-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl hover:bg-red-600 hover:text-white dark:hover:bg-red-500 transition-all shadow-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                    </div>
                  ))}
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
