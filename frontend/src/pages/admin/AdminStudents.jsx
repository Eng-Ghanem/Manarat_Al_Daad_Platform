import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Users, Search, UserPlus, Trash2, Mail, Phone, AlertTriangle, ArrowRight, X, Eye, EyeOff
} from 'lucide-react';
import { Link } from 'react-router-dom';
import FadeIn from '../../components/FadeIn';
import ConfirmModal from '../../components/ConfirmModal';
import { supabase } from '../../lib/supabase';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AdminStudents() {
  const { t } = useTranslation();
  
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  // Add Student Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    password: '',
    grade_level: ''
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Edit Student Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    id: '',
    full_name: '',
    email: '',
    phone_number: '',
    password: '',
    grade_level: ''
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);

  const translateGrade = (grade) => {
    const grades = {
      'primary_1': 'الصف الأول الابتدائي',
      'primary_2': 'الصف الثاني الابتدائي',
      'primary_3': 'الصف الثالث الابتدائي',
      'primary_4': 'الصف الرابع الابتدائي',
      'primary_5': 'الصف الخامس الابتدائي',
      'primary_6': 'الصف السادس الابتدائي',
      'prep_1': 'الصف الأول الإعدادي',
      'prep_2': 'الصف الثاني الإعدادي',
      'prep_3': 'الصف الثالث الإعدادي',
      'sec_1': 'الصف الأول الثانوي',
      'sec_2': 'الصف الثاني الثانوي',
      'sec_3': 'الصف الثالث الثانوي'
    };
    return grades[grade] || grade;
  };

  // Delete Modal State
  const [deleteConfig, setDeleteConfig] = useState({ isOpen: false, studentId: null, studentName: '' });

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStudents(data || []);
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setAddError('');
    setAddLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${apiUrl}/api/admin/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(addForm)
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'فشل إضافة الطالب');
      }

      // Success
      setIsAddModalOpen(false);
      setAddForm({ full_name: '', email: '', phone_number: '', password: '', grade_level: '' });
      fetchStudents(); // Refresh list

    } catch (err) {
      console.error('Error adding student:', err);
      setAddError(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setAddLoading(false);
    }
  };

  const handleEditStudent = async (e) => {
    e.preventDefault();
    setEditError('');
    setEditLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${apiUrl}/api/admin/students/${editForm.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(editForm)
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'فشل تعديل الطالب');
      }

      // Success
      setIsEditModalOpen(false);
      fetchStudents(); // Refresh list

    } catch (err) {
      console.error('Error updating student:', err);
      setEditError(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setEditLoading(false);
    }
  };

  const confirmDelete = async () => {
    const id = deleteConfig.studentId;
    setDeleteConfig({ isOpen: false, studentId: null, studentName: '' });

    // Optimistic update - remove immediately from UI
    const previousStudents = [...students];
    setStudents(students.filter(s => s.id !== id));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${apiUrl}/api/admin/students/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (!res.ok) throw new Error('Failed to delete student');
    } catch (err) {
      console.error('Error deleting student:', err);
      alert('حدث خطأ أثناء الحذف.');
      // Revert if API fails
      setStudents(previousStudents);
    }
  };

  const filteredStudents = students.filter(student => 
    (student.full_name && student.full_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (student.email && student.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (student.phone_number && student.phone_number.includes(searchQuery))
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-12">
      {/* High-End Header */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 pt-20 pb-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 blur-[100px] rounded-full pointer-events-none mix-blend-screen"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/20 blur-[100px] rounded-full pointer-events-none mix-blend-screen"></div>
        
        <div className="max-w-7xl mx-auto relative z-10">
          <FadeIn>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <Link to="/admin-dashboard" className="w-12 h-12 rounded-xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors backdrop-blur-md border border-white/10">
                  <ArrowRight className="w-6 h-6" />
                </Link>
                <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                  <Users className="w-8 h-8 text-blue-300" />
                </div>
                <div>
                  <h1 className="text-4xl font-extrabold text-white font-arabic tracking-tight mb-2">
                    إدارة الطلاب
                  </h1>
                  <p className="text-blue-200/80 font-medium text-lg">
                    عرض وحذف وإضافة حسابات الطلاب يدوياً.
                  </p>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-20">
        <FadeIn delay={100}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-gray-100 dark:border-slate-700 overflow-hidden">
            
            {/* Toolbar */}
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="relative w-full md:w-96">
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pr-11 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 dark:text-white"
                  placeholder="ابحث بالاسم، الإيميل، أو رقم الهاتف..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <button
                onClick={() => setIsAddModalOpen(true)}
                className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/20 hover:shadow-blue-500/40"
              >
                <UserPlus className="w-5 h-5" />
                إضافة طالب جديد
              </button>
            </div>

            {/* Content */}
            {loading ? (
              <div className="py-20 flex justify-center">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="py-20 text-center">
                <div className="w-20 h-20 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">لا يوجد طلاب</h3>
                <p className="text-gray-500 dark:text-gray-400">لم يتم العثور على أي طلاب مطابقين لبحثك.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead className="bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700">
                    <tr className="text-gray-500 dark:text-gray-400 text-sm font-bold">
                      <th className="py-4 px-6">اسم الطالب</th>
                      <th className="py-4 px-6">الصف الدراسي</th>
                      <th className="py-4 px-6">البريد الإلكتروني</th>
                      <th className="py-4 px-6">رقم الهاتف</th>
                      <th className="py-4 px-6">تاريخ التسجيل</th>
                      <th className="py-4 px-6 text-center">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student) => (
                      <tr key={student.id} className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                              {student.full_name ? student.full_name.charAt(0) : 'ط'}
                            </div>
                            <span className="font-bold text-gray-900 dark:text-white">{student.full_name || 'طالب مجهول'}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-sm text-gray-600 dark:text-gray-300">
                          {translateGrade(student.grade_level) || 'غير محدد'}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                            <Mail className="w-4 h-4 text-blue-500" />
                            <span dir="ltr">{student.email}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                            <Phone className="w-4 h-4 text-green-500" />
                            <span dir="ltr">{student.phone_number || '-'}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-gray-500 dark:text-gray-400 text-sm">
                          {new Date(student.created_at).toLocaleDateString('ar-EG')}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setEditForm({
                                  id: student.id,
                                  full_name: student.full_name || '',
                                  email: student.email || '',
                                  phone_number: student.phone_number || '',
                                  password: '', // Blank by default when editing
                                  grade_level: student.grade_level || ''
                                });
                                setIsEditModalOpen(true);
                              }}
                              className="w-9 h-9 rounded-lg flex items-center justify-center text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 transition-colors"
                              title="تعديل الطالب"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                            </button>
                            <button
                              onClick={() => setDeleteConfig({ isOpen: true, studentId: student.id, studentName: student.full_name })}
                              className="w-9 h-9 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"
                              title="حذف الطالب"
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
      </div>

      {/* Add Student Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !addLoading && setIsAddModalOpen(false)}></div>
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl relative z-10 overflow-hidden transform transition-all">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                إضافة طالب جديد
              </h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                disabled={addLoading}
                className="text-gray-400 hover:text-gray-500 bg-gray-100 hover:bg-gray-200 p-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddStudent} className="p-6">
              {addError && (
                <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg flex items-start gap-2 text-sm">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <p>{addError}</p>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">الاسم الكامل</label>
                  <input
                    required
                    type="text"
                    value={addForm.full_name}
                    onChange={e => setAddForm({...addForm, full_name: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">البريد الإلكتروني</label>
                  <input
                    required
                    type="email"
                    value={addForm.email}
                    onChange={e => setAddForm({...addForm, email: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">رقم الهاتف</label>
                  <input
                    required
                    type="tel"
                    pattern="[0-9]{11}"
                    title="برجاء إدخال رقم هاتف صحيح مكون من 11 رقم"
                    value={addForm.phone_number}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                      setAddForm({...addForm, phone_number: val});
                    }}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                    dir="ltr"
                    placeholder="مثال: 01000000000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">كلمة المرور</label>
                  <div className="relative">
                    <input
                      required
                      minLength={6}
                      type={showPassword ? "text" : "password"}
                      value={addForm.password}
                      onChange={e => setAddForm({...addForm, password: e.target.value})}
                      className="w-full pl-4 pr-10 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">الصف الدراسي</label>
                  <select
                    required
                    value={addForm.grade_level}
                    onChange={e => setAddForm({...addForm, grade_level: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                  >
                    <option value="" disabled>اختر الصف الدراسي</option>
                    <option value="primary_1">الصف الأول الابتدائي</option>
                    <option value="primary_2">الصف الثاني الابتدائي</option>
                    <option value="primary_3">الصف الثالث الابتدائي</option>
                    <option value="primary_4">الصف الرابع الابتدائي</option>
                    <option value="primary_5">الصف الخامس الابتدائي</option>
                    <option value="primary_6">الصف السادس الابتدائي</option>
                    <option value="prep_1">الصف الأول الإعدادي</option>
                    <option value="prep_2">الصف الثاني الإعدادي</option>
                    <option value="prep_3">الصف الثالث الإعدادي</option>
                    <option value="sec_1">الصف الأول الثانوي</option>
                    <option value="sec_2">الصف الثاني الثانوي</option>
                    <option value="sec_3">الصف الثالث الثانوي</option>
                  </select>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  type="submit"
                  disabled={addLoading}
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-colors flex justify-center items-center gap-2 disabled:opacity-70"
                >
                  {addLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : 'إنشاء الحساب'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={addLoading}
                  className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-200 transition-colors disabled:opacity-70"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !editLoading && setIsEditModalOpen(false)}></div>
          <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-2xl shadow-2xl relative z-10 overflow-hidden transform transition-all">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                تعديل بيانات الطالب
              </h3>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                disabled={editLoading}
                className="text-gray-400 hover:text-gray-500 bg-gray-100 hover:bg-gray-200 p-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleEditStudent} className="p-6">
              {editError && (
                <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg flex items-start gap-2 text-sm">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <p>{editError}</p>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">الاسم الكامل</label>
                  <input
                    required
                    type="text"
                    value={editForm.full_name}
                    onChange={e => setEditForm({...editForm, full_name: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">البريد الإلكتروني</label>
                  <input
                    required
                    type="email"
                    value={editForm.email}
                    onChange={e => setEditForm({...editForm, email: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">رقم الهاتف</label>
                  <input
                    required
                    type="tel"
                    pattern="[0-9]{11}"
                    title="برجاء إدخال رقم هاتف صحيح مكون من 11 رقم"
                    value={editForm.phone_number}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                      setEditForm({...editForm, phone_number: val});
                    }}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                    dir="ltr"
                    placeholder="مثال: 01000000000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">كلمة المرور (اختياري)</label>
                  <div className="relative">
                    <input
                      minLength={6}
                      type={showEditPassword ? "text" : "password"}
                      value={editForm.password}
                      onChange={e => setEditForm({...editForm, password: e.target.value})}
                      className="w-full pl-4 pr-10 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                      dir="ltr"
                      placeholder="اتركه فارغاً إذا لم ترد تغييره"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEditPassword(!showEditPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showEditPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">الصف الدراسي</label>
                  <select
                    required
                    value={editForm.grade_level}
                    onChange={e => setEditForm({...editForm, grade_level: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                  >
                    <option value="" disabled>اختر الصف الدراسي</option>
                    <option value="primary_1">الصف الأول الابتدائي</option>
                    <option value="primary_2">الصف الثاني الابتدائي</option>
                    <option value="primary_3">الصف الثالث الابتدائي</option>
                    <option value="primary_4">الصف الرابع الابتدائي</option>
                    <option value="primary_5">الصف الخامس الابتدائي</option>
                    <option value="primary_6">الصف السادس الابتدائي</option>
                    <option value="prep_1">الصف الأول الإعدادي</option>
                    <option value="prep_2">الصف الثاني الإعدادي</option>
                    <option value="prep_3">الصف الثالث الإعدادي</option>
                    <option value="sec_1">الصف الأول الثانوي</option>
                    <option value="sec_2">الصف الثاني الثانوي</option>
                    <option value="sec_3">الصف الثالث الثانوي</option>
                  </select>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-colors flex justify-center items-center gap-2 disabled:opacity-70"
                >
                  {editLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : 'حفظ التعديلات'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={editLoading}
                  className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-200 transition-colors disabled:opacity-70"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfig.isOpen}
        onClose={() => setDeleteConfig({ isOpen: false, studentId: null, studentName: '' })}
        onConfirm={confirmDelete}
        title="حذف الطالب نهائياً"
        message={`هل أنت متأكد من رغبتك في حذف حساب الطالب "${deleteConfig.studentName}"؟ سيتم مسح كافة بياناته واشتراكاته من المنصة ولا يمكن التراجع عن هذا الإجراء.`}
        confirmText="نعم، احذف الطالب"
        cancelText="تراجع"
        isDanger={true}
      />
    </div>
  );
}
