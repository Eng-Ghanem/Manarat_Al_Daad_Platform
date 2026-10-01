import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Users, Search, UserPlus, Trash2, Mail, Phone, AlertTriangle, ArrowRight, X, Eye, EyeOff
} from 'lucide-react';
import { Link } from 'react-router-dom';
import FadeIn from '../../components/FadeIn';
import ConfirmModal from '../../components/ConfirmModal';
import { supabase } from '../../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import toast from 'react-hot-toast';

const apiUrl = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? '' : 'http://localhost:5000');

export default function AdminStudents() {
  const { t, i18n } = useTranslation();
  
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
    if (!grade) return '';
    const key = `grade_${grade}`;
    const translated = t(key);
    return translated !== key ? translated : grade;
  };

  const gradeOptions = [
    { value: 'primary_1', label: t('grade_primary_1') },
    { value: 'primary_2', label: t('grade_primary_2') },
    { value: 'primary_3', label: t('grade_primary_3') },
    { value: 'primary_4', label: t('grade_primary_4') },
    { value: 'primary_5', label: t('grade_primary_5') },
    { value: 'primary_6', label: t('grade_primary_6') },
    { value: 'prep_1', label: t('grade_prep_1') },
    { value: 'prep_2', label: t('grade_prep_2') },
    { value: 'prep_3', label: t('grade_prep_3') },
    { value: 'sec_1', label: t('grade_sec_1') },
    { value: 'sec_2', label: t('grade_sec_2') },
    { value: 'sec_3', label: t('grade_sec_3') },
  ];

  // Delete Modal State
  const [deleteConfig, setDeleteConfig] = useState({ isOpen: false, studentId: null, studentName: '' });
  const [deleteLoading, setDeleteLoading] = useState(false);

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

    let created = false;

    // 1. Try Backend API first if available
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (apiUrl) {
        const res = await fetch(`${apiUrl}/api/admin/students`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || ''}`
          },
          body: JSON.stringify(addForm)
        });

        const text = await res.text();
        let data = {};
        try {
          data = JSON.parse(text);
        } catch (_) {}

        if (res.ok && (data.success || data.data)) {
          created = true;
        } else if (!res.ok && data.error) {
          throw new Error(data.error);
        }
      }
    } catch (err) {
      console.warn('Backend student creation failed, using client signup fallback:', err.message);
    }

    // 2. Direct client fallback using isolated Supabase Client (preserves admin session)
    if (!created) {
      try {
        const tempSupabase = createClient(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_ANON_KEY,
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false
            }
          }
        );

        const { data: authData, error: authError } = await tempSupabase.auth.signUp({
          email: addForm.email.trim(),
          password: addForm.password,
          options: {
            data: {
              full_name: addForm.full_name.trim(),
              phone_number: addForm.phone_number?.trim() || '',
              phone: addForm.phone_number?.trim() || '',
              role: 'student',
              grade_level: addForm.grade_level || null
            }
          }
        });

        if (authError) throw authError;

        if (authData?.user?.id) {
          // Immediately ensure profile record has phone_number, full_name, and grade_level
          try {
            await supabase.from('profiles').update({
              phone_number: addForm.phone_number?.trim() || null,
              full_name: addForm.full_name.trim(),
              grade_level: addForm.grade_level || null
            }).eq('id', authData.user.id);

            await supabase.from('profiles').upsert({
              id: authData.user.id,
              email: addForm.email.trim(),
              full_name: addForm.full_name.trim(),
              phone_number: addForm.phone_number?.trim() || null,
              grade_level: addForm.grade_level || null,
              role: 'student'
            });
          } catch (profErr) {
            console.warn('Profile sync warning:', profErr);
          }
        }
        created = true;
      } catch (clientErr) {
        console.error('Client student creation failed:', clientErr);
        setAddError(clientErr.message || 'فشل إضافة الطالب، يرجى التأكد من البيانات أو البريد الإلكتروني');
        setAddLoading(false);
        return;
      }
    }

    // Success
    setIsAddModalOpen(false);
    setAddForm({ full_name: '', email: '', phone_number: '', password: '', grade_level: '' });
    toast.success(i18n.language === 'ar' ? 'تمت إضافة الطالب بنجاح' : 'Student added successfully');
    fetchStudents();
    setAddLoading(false);
  };

  const handleEditStudent = async (e) => {
    e.preventDefault();
    setEditError('');
    setEditLoading(true);

    try {
      if (apiUrl) {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${apiUrl}/api/admin/students/${editForm.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || ''}`
          },
          body: JSON.stringify(editForm)
        });

        const text = await res.text();
        let data = {};
        try {
          data = JSON.parse(text);
        } catch (_) {}

        if (res.ok) {
          setIsEditModalOpen(false);
          toast.success(i18n.language === 'ar' ? 'تم تحديث بيانات الطالب بنجاح' : 'Student updated successfully');
          fetchStudents();
          setEditLoading(false);
          return;
        }
      }
      throw new Error('Fallback to direct Supabase profile update');
    } catch (err) {
      console.warn('Backend API update failed, attempting direct Supabase profile update:', err);
      try {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name: editForm.full_name,
            phone_number: editForm.phone_number,
            grade_level: editForm.grade_level || null
          })
          .eq('id', editForm.id);

        if (profileError) throw profileError;

        setIsEditModalOpen(false);
        toast.success(i18n.language === 'ar' ? 'تم تحديث بيانات الطالب بنجاح' : 'Student updated successfully');
        fetchStudents();
      } catch (fallbackErr) {
        console.error('Direct profile update also failed:', fallbackErr);
        setEditError(fallbackErr.message || 'حدث خطأ أثناء تعديل بيانات الطالب');
      }
    } finally {
      setEditLoading(false);
    }
  };

  const confirmDelete = async () => {
    const id = deleteConfig.studentId;
    if (!id) return;

    setDeleteLoading(true);

    let deleted = false;
    let errorMessage = '';

    // Method 1: Database RPC function (Deletes from auth.users, profiles, and all dependent tables atomically)
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('admin_delete_student', {
        p_student_id: id
      });

      if (!rpcError && (rpcData?.success || rpcData === true)) {
        deleted = true;
      } else if (rpcError) {
        console.warn('admin_delete_student RPC returned error:', rpcError.message);
        errorMessage = rpcError.message;
      }
    } catch (rpcErr) {
      console.warn('RPC call failed:', rpcErr);
    }

    // Method 2: Backend API endpoint (if backend is deployed / running)
    if (!deleted) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(`${apiUrl}/api/admin/students/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`
          }
        });

        if (res.ok) {
          deleted = true;
        } else {
          const data = await res.json().catch(() => ({}));
          errorMessage = data.error || data.message || errorMessage;
        }
      } catch (apiErr) {
        console.warn('Backend API endpoint unreachable:', apiErr);
      }
    }

    // Method 3: Direct cascading cleanup from Supabase client as fallback
    if (!deleted) {
      try {
        // Clean dependent rows first to prevent FK conflicts
        await supabase.from('student_reviews').delete().eq('user_id', id);
        await supabase.from('subscriptions').delete().eq('user_id', id);
        await supabase.from('quiz_submissions').delete().eq('student_id', id);
        await supabase.from('lesson_progress').delete().eq('user_id', id);
        await supabase.from('enrollments').delete().eq('user_id', id);
        try {
          await supabase.from('notifications').delete().eq('user_id', id);
        } catch (_) {}
        try {
          await supabase.from('gamification_logs').delete().eq('user_id', id);
        } catch (_) {}

        // Delete from profiles
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .delete()
          .eq('id', id)
          .select();

        if (!profileError && profileData && profileData.length > 0) {
          deleted = true;
        } else if (profileError) {
          errorMessage = profileError.message;
        }
      } catch (dbErr) {
        console.warn('Direct database deletion failed:', dbErr);
      }
    }

    setDeleteLoading(false);

    if (deleted) {
      setDeleteConfig({ isOpen: false, studentId: null, studentName: '' });
      setStudents(prev => prev.filter(s => s.id !== id));
      toast.success(
        i18n.language === 'ar'
          ? 'تم حذف حساب الطالب وبياناته بالكامل من المنصة وقاعدة البيانات بنجاح'
          : 'Student deleted successfully from the platform and database'
      );
      fetchStudents();
    } else {
      console.error('All student deletion methods failed:', errorMessage);
      toast.error(
        i18n.language === 'ar'
          ? `تعذر حذف الطالب: ${errorMessage || 'يرجى تشغيل ملف delete_student_setup.sql في Supabase SQL Editor'}`
          : `Failed to delete student: ${errorMessage}`
      );
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
                  <ArrowRight className="w-6 h-6 rtl:rotate-0 ltr:rotate-180" />
                </Link>
                <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                  <Users className="w-8 h-8 text-blue-300" />
                </div>
                <div>
                  <h1 className="text-4xl font-extrabold text-white font-arabic tracking-tight mb-2">
                    {t('admin_students_title')}
                  </h1>
                  <p className="text-blue-200/80 font-medium text-lg">
                    {t('admin_students_desc')}
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
                <div className="absolute inset-y-0 rtl:right-0 rtl:pr-4 ltr:left-0 ltr:pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-full rtl:pr-11 rtl:pl-4 ltr:pl-11 ltr:pr-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 dark:text-white"
                  placeholder={t('admin_students_search_ph')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <button
                onClick={() => setIsAddModalOpen(true)}
                className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/20 hover:shadow-blue-500/40"
              >
                <UserPlus className="w-5 h-5" />
                {t('admin_students_btn_add')}
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
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('admin_students_no_students')}</h3>
                
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full rtl:text-right ltr:text-left border-collapse">
                  <thead className="bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700">
                    <tr className="text-gray-500 dark:text-gray-400 text-sm font-bold">
                      <th className="py-4 px-6">{t('admin_students_th_student')}</th>
                      <th className="py-4 px-6">{t('admin_students_th_grade')}</th>
                      <th className="py-4 px-6">{t('admin_students_email_label')}</th>
                      <th className="py-4 px-6">{t('admin_students_th_phone')}</th>
                      <th className="py-4 px-6">{t('admin_students_th_reg_date')}</th>
                      <th className="py-4 px-6 text-center">{t('admin_students_th_actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((student) => (
                      <tr key={student.id} className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                              {student.full_name ? student.full_name.charAt(0) : 'S'}
                            </div>
                            <span className="font-bold text-gray-900 dark:text-white">{student.full_name || t('admin_students_unknown')}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-sm text-gray-600 dark:text-gray-300">
                          {translateGrade(student.grade_level) || '-'}
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
                          {new Date(student.created_at).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'ar-EG')}
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
                              title={t('common_edit')}
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                            </button>
                            <button
                              onClick={() => setDeleteConfig({ isOpen: true, studentId: student.id, studentName: student.full_name })}
                              className="w-9 h-9 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"
                              title={t('common_delete')}
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
                {t('admin_students_modal_add_title')}
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
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{t('admin_students_name_label')}</label>
                  <input
                    required
                    type="text"
                    value={addForm.full_name}
                    onChange={e => setAddForm({...addForm, full_name: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{t('admin_students_email_label')}</label>
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
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{t('admin_students_phone_label')}</label>
                  <input
                    required
                    type="tel"
                    pattern="[0-9]{11}"
                    title={t('admin_students_phone_error')}
                    value={addForm.phone_number}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                      setAddForm({...addForm, phone_number: val});
                    }}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                    dir="ltr"
                    placeholder={t('admin_students_phone_hint')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{t('admin_students_pass_label')}</label>
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
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{t('admin_students_grade_label')}</label>
                  <select
                    required
                    value={addForm.grade_level}
                    onChange={e => setAddForm({...addForm, grade_level: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                  >
                    <option value="" disabled>{t('admin_students_grade_select')}</option>
                    {gradeOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
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
                  ) : t('admin_students_btn_add')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={addLoading}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-slate-100 py-2.5 rounded-xl font-bold border border-gray-300 dark:border-slate-600 transition-colors cursor-pointer disabled:opacity-70"
                >
                  {t('common_cancel')}
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
                {t('admin_students_modal_edit_title')}
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
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{t('admin_students_name_label')}</label>
                  <input
                    required
                    type="text"
                    value={editForm.full_name}
                    onChange={e => setEditForm({...editForm, full_name: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{t('admin_students_email_label')}</label>
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
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{t('admin_students_phone_label')}</label>
                  <input
                    required
                    type="tel"
                    pattern="[0-9]{11}"
                    title={t('admin_students_phone_error')}
                    value={editForm.phone_number}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                      setEditForm({...editForm, phone_number: val});
                    }}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                    dir="ltr"
                    placeholder={t('admin_students_phone_hint')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{t('admin_students_password_optional')}</label>
                  <div className="relative">
                    <input
                      minLength={6}
                      type={showEditPassword ? "text" : "password"}
                      value={editForm.password}
                      onChange={e => setEditForm({...editForm, password: e.target.value})}
                      className="w-full pl-4 pr-10 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                      dir="ltr"
                      placeholder={t('admin_students_password_hint')}
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
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{t('admin_students_grade_label')}</label>
                  <select
                    required
                    value={editForm.grade_level}
                    onChange={e => setEditForm({...editForm, grade_level: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                  >
                    <option value="" disabled>{t('admin_students_grade_select')}</option>
                    {gradeOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
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
                  ) : t('review_update_btn')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={editLoading}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-slate-100 py-2.5 rounded-xl font-bold border border-gray-300 dark:border-slate-600 transition-colors cursor-pointer disabled:opacity-70"
                >
                  {t('common_cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfig.isOpen}
        onClose={() => !deleteLoading && setDeleteConfig({ isOpen: false, studentId: null, studentName: '' })}
        onConfirm={confirmDelete}
        title={t('admin_students_modal_delete_title')}
        message={t('admin_students_modal_delete_msg')}
        confirmText={deleteLoading ? (i18n.language === 'ar' ? 'جاري الحذف...' : 'Deleting...') : t('admin_students_modal_delete_title')}
        cancelText={t('common_cancel')}
        isDanger={true}
        isLoading={deleteLoading}
      />
    </div>
  );
}
