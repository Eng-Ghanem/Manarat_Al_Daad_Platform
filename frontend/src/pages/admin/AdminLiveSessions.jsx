import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Video, Calendar, Clock, Plus, Trash2, Edit, X, ArrowRight,
  Link as LinkIcon, BookOpen, AlertCircle, Loader, Users, CheckCircle, XCircle, Clock4, Filter
} from 'lucide-react';
import { Link } from 'react-router-dom';
import FadeIn from '../../components/FadeIn';
import { supabase } from '../../lib/supabase';
import ConfirmModal from '../../components/ConfirmModal';
import toast from 'react-hot-toast';
import { formatSessionTitle, formatSessionDesc, formatGradeName } from '../../utils/helpers';

export default function AdminLiveSessions() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // all, primary, prep, sec
  const [filterGrade, setFilterGrade] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  
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
    grade_level: '',
    status: 'scheduled'
  });
  const [formLoading, setFormLoading] = useState(false);

  // Status options for the dropdown
  const statusOptions = [
    { value: 'scheduled', label: t('admin_status_scheduled') },
    { value: 'completed', label: t('admin_mark_completed') },
    { value: 'postponed', label: t('admin_mark_postponed') },
    { value: 'canceled', label: t('admin_mark_canceled') }
  ];
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null });

  useEffect(() => {
    fetchData();
  }, []);

  // Reset grade filter when tab changes
  useEffect(() => {
    setFilterGrade('all');
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: sessionsData, error } = await supabase
        .from('online_sessions')
        .select('*')
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
        grade_level: session.grade_level || '',
        status: session.status || 'scheduled'
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
        grade_level: '',
        status: 'scheduled'
      });
      setIsEditing(false);
      setCurrentSessionId(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const getCleanZoomUrl = (url) => {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error(isRTL ? 'يرجى إدخال عنوان الحصة' : 'Please enter session title');
      return;
    }
    if (!formData.start_time || !formData.end_time) {
      toast.error(isRTL ? 'يرجى تحديد موعد بداية ونهاية الحصة' : 'Please specify session start and end times');
      return;
    }
    if (new Date(formData.end_time) <= new Date(formData.start_time)) {
      toast.error(isRTL ? 'وقت نهاية الحصة يجب أن يكون بعد وقت البدء' : 'Session end time must be after start time');
      return;
    }
    if (!formData.zoom_link.trim()) {
      toast.error(isRTL ? 'يرجى إدخال رابط الزووم أو البث' : 'Please enter meeting link');
      return;
    }

    setFormLoading(true);

    try {
      const payload = {
        title: formData.title.trim(),
        description: formData.description?.trim() || '',
        start_time: new Date(formData.start_time).toISOString(),
        end_time: new Date(formData.end_time).toISOString(),
        zoom_link: getCleanZoomUrl(formData.zoom_link),
        grade_level: formData.grade_level === '' ? null : formData.grade_level,
        status: formData.status
      };

      if (isEditing) {
        const { error } = await supabase
          .from('online_sessions')
          .update(payload)
          .eq('id', currentSessionId);
        
        if (error) throw error;
        toast.success(isRTL ? 'تم تحديث بيانات الحصة بنجاح' : 'Session updated successfully');
      } else {
        const { error } = await supabase
          .from('online_sessions')
          .insert([payload]);
        
        if (error) throw error;
        toast.success(isRTL ? 'تم إنشاء الحصة بنجاح' : 'Session created successfully');
      }

      await fetchData();
      handleCloseModal();
    } catch (err) {
      console.error('Error saving session:', err);
      toast.error(isRTL ? 'حدث خطأ أثناء حفظ الجلسة' : 'Error saving session');
    } finally {
      setFormLoading(false);
    }
  };

  const confirmDelete = async () => {
    const sessionId = deleteModal.id;
    setDeleteModal({ isOpen: false, id: null });
    
    // Optimistic UI update for instant feedback
    const previousSessions = [...sessions];
    setSessions(sessions.filter(s => s.id !== sessionId));
    
    try {
      const { error } = await supabase
        .from('online_sessions')
        .delete()
        .eq('id', sessionId);
      
      if (error) throw error;
      toast.success(isRTL ? 'تم حذف الحصة بنجاح' : 'Session deleted successfully');
    } catch (err) {
      console.error('Error deleting session:', err);
      // Revert on error
      setSessions(previousSessions);
      toast.error(isRTL ? 'حدث خطأ أثناء الحذف.' : 'An error occurred while deleting.');
    }
  };

  const updateSessionStatus = async (id, newStatus) => {
    // Optimistic update for instant UI response
    const previousSessions = [...sessions];
    setSessions(sessions.map(s => s.id === id ? { ...s, status: newStatus } : s));

    try {
      const { error } = await supabase
        .from('online_sessions')
        .update({ status: newStatus })
        .eq('id', id);
      
      if (error) throw error;
      toast.success(isRTL ? 'تم تحديث حالة الحصة' : 'Status updated successfully');
    } catch (err) {
      console.error('Error updating status:', err);
      // Revert if error
      setSessions(previousSessions);
      toast.error(isRTL ? 'فشل تحديث حالة الحصة' : 'Failed to update status');
    }
  };

  // Extract unique months for the filter dropdown (Format: YYYY-MM)
  const uniqueMonths = [...new Set(sessions.map(s => {
    if (!s.start_time) return null;
    const date = new Date(s.start_time);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }).filter(Boolean))].sort().reverse();

  // Filter sessions based on active tab, grade, status, and month
  const filteredSessions = sessions.filter(s => {
    // 1. Stage (Tab) Filter
    if (activeTab !== 'all') {
      if (!s.grade_level || !s.grade_level.startsWith(activeTab)) return false;
    }
    
    // 2. Specific Grade Filter
    if (filterGrade !== 'all') {
      if (s.grade_level !== filterGrade) return false;
    }

    // 3. Status Filter
    if (filterStatus !== 'all') {
      const sStatus = s.status || 'scheduled';
      if (sStatus !== filterStatus) return false;
    }

    // 4. Month Filter
    if (filterMonth !== 'all') {
      if (!s.start_time) return false;
      const date = new Date(s.start_time);
      const sMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (sMonth !== filterMonth) return false;
    }

    return true;
  });

  // Base sessions for statistics (filtered by stage, grade, and month, but NOT status)
  const baseSessionsForStats = sessions.filter(s => {
    if (activeTab !== 'all') {
      if (!s.grade_level || !s.grade_level.startsWith(activeTab)) return false;
    }
    if (filterGrade !== 'all') {
      if (s.grade_level !== filterGrade) return false;
    }
    if (filterMonth !== 'all') {
      if (!s.start_time) return false;
      const date = new Date(s.start_time);
      const sMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (sMonth !== filterMonth) return false;
    }
    return true;
  });

  // Calculate statistics for the active tab/month
  const stats = {
    scheduled: baseSessionsForStats.filter(s => !s.status || s.status === 'scheduled').length,
    completed: baseSessionsForStats.filter(s => s.status === 'completed').length,
    canceled: baseSessionsForStats.filter(s => s.status === 'canceled').length,
    postponed: baseSessionsForStats.filter(s => s.status === 'postponed').length
  };

  // Function to check if status can be changed
  const canChangeStatus = (endTime) => {
    if (!endTime) return true;
    const end = new Date(endTime);
    end.setMinutes(end.getMinutes() + 30);
    return new Date() <= end;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin shadow-lg"></div>
      </div>
    );
  }

  const renderStatusBadge = (status) => {
    switch(status) {
      case 'completed':
        return <span className="px-3 py-1 text-xs font-bold rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> {t('admin_status_completed')}</span>;
      case 'canceled':
        return <span className="px-3 py-1 text-xs font-bold rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3"/> {t('admin_status_canceled')}</span>;
      case 'postponed':
        return <span className="px-3 py-1 text-xs font-bold rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 flex items-center gap-1"><Clock4 className="w-3 h-3"/> {t('admin_status_postponed')}</span>;
      default:
        return <span className="px-3 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 flex items-center gap-1"><Calendar className="w-3 h-3"/> {t('admin_status_scheduled')}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-12">
      
      {/* High-End Header */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 pt-20 pb-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 blur-[100px] rounded-full pointer-events-none mix-blend-screen"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/20 blur-[100px] rounded-full pointer-events-none mix-blend-screen"></div>
        
        <div className="max-w-7xl mx-auto relative z-10 flex flex-col items-center">
          <Link to="/admin-dashboard" className="absolute top-0 right-0 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md font-bold text-sm">
            <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
            {t('admin_back_to_dashboard')}
          </Link>

          <FadeIn>
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-[0_0_20px_rgba(255,255,255,0.1)] mb-6">
                <Video className="w-10 h-10 text-blue-300" />
              </div>
              <h1 className="text-4xl font-extrabold text-white font-arabic tracking-tight mb-4">
                {t('admin_live_sessions_title')}
              </h1>
              <p className="text-blue-200/80 font-medium text-lg max-w-2xl">
                {t('admin_live_sessions_desc')}
              </p>
            </div>
          </FadeIn>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-20">
        <FadeIn delay={100}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 mb-8">
            
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
              {/* Tabs */}
              <div className="flex overflow-x-auto w-full sm:w-auto bg-gray-100 dark:bg-slate-900/50 p-1 rounded-2xl border border-gray-200 dark:border-slate-700 hide-scrollbar">
                <button 
                  onClick={() => setActiveTab('all')}
                  className={`flex-shrink-0 px-6 py-2.5 rounded-xl font-bold transition-all text-sm ${activeTab === 'all' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-md' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                >
                  {t('admin_all_stages')}
                </button>
                <button 
                  onClick={() => setActiveTab('primary')}
                  className={`flex-shrink-0 px-6 py-2.5 rounded-xl font-bold transition-all text-sm ${activeTab === 'primary' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-md' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                >
                  {t('admin_primary_stage')}
                </button>
                <button 
                  onClick={() => setActiveTab('prep')}
                  className={`flex-shrink-0 px-6 py-2.5 rounded-xl font-bold transition-all text-sm ${activeTab === 'prep' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-md' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                >
                  {t('admin_prep_stage')}
                </button>
                <button 
                  onClick={() => setActiveTab('sec')}
                  className={`flex-shrink-0 px-6 py-2.5 rounded-xl font-bold transition-all text-sm ${activeTab === 'sec' ? 'bg-white dark:bg-slate-800 text-blue-600 shadow-md' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}
                >
                  {t('admin_sec_stage')}
                </button>
              </div>

              <button 
                onClick={() => handleOpenModal()}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/20 hover:shadow-blue-500/40"
              >
                <Plus className="w-5 h-5" />
                {t('admin_schedule_session')}
              </button>
            </div>

            {/* Advanced Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6 bg-gray-50 dark:bg-slate-900/30 p-4 rounded-xl border border-gray-100 dark:border-slate-800">
              {activeTab !== 'all' && (
                <div className="flex-1">
                  <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1"><Filter className="w-3 h-3" /> {t('admin_filter_by_grade', 'تصفية حسب الصف:')}</label>
                  <select
                    value={filterGrade}
                    onChange={(e) => setFilterGrade(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm font-bold focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-300"
                  >
                    <option value="all">{t('admin_all_grades_stage', 'جميع صفوف المرحلة')}</option>
                    {activeTab === 'primary' && (
                      <>
                        <option value="primary_1">{t('grade_primary_1')}</option>
                        <option value="primary_2">{t('grade_primary_2')}</option>
                        <option value="primary_3">{t('grade_primary_3')}</option>
                        <option value="primary_4">{t('grade_primary_4')}</option>
                        <option value="primary_5">{t('grade_primary_5')}</option>
                        <option value="primary_6">{t('grade_primary_6')}</option>
                      </>
                    )}
                    {activeTab === 'prep' && (
                      <>
                        <option value="prep_1">{t('grade_prep_1')}</option>
                        <option value="prep_2">{t('grade_prep_2')}</option>
                        <option value="prep_3">{t('grade_prep_3')}</option>
                      </>
                    )}
                    {activeTab === 'sec' && (
                      <>
                        <option value="sec_1">{t('grade_sec_1')}</option>
                        <option value="sec_2">{t('grade_sec_2')}</option>
                        <option value="sec_3">{t('grade_sec_3')}</option>
                      </>
                    )}
                  </select>
                </div>
              )}
              
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1"><Filter className="w-3 h-3" /> {t('live_sessions_filter_status')}</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm font-bold focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-300"
                >
                  <option value="all">{t('live_sessions_all_statuses')}</option>
                  <option value="scheduled">{t('admin_status_scheduled')}</option>
                  <option value="completed">{t('admin_status_completed')}</option>
                  <option value="postponed">{t('admin_status_postponed')}</option>
                  <option value="canceled">{t('admin_status_canceled')}</option>
                </select>
              </div>

              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> {t('live_sessions_filter_month')}</label>
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm font-bold focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-300"
                >
                  <option value="all">{t('live_sessions_all_months')}</option>
                  {uniqueMonths.map(m => {
                    const [year, month] = m.split('-');
                    const date = new Date(year, month - 1);
                    const monthName = date.toLocaleDateString(t('locale') || 'ar-EG', { month: 'long', year: 'numeric' });
                    return <option key={m} value={m}>{monthName}</option>;
                  })}
                </select>
              </div>
            </div>

            {/* Statistics - Clickable Quick Filters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <button
                type="button"
                onClick={() => setFilterStatus(filterStatus === 'scheduled' ? 'all' : 'scheduled')}
                className={`rtl:text-right ltr:text-left p-4 rounded-xl border transition-all cursor-pointer ${
                  filterStatus === 'scheduled'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-400'
                    : 'bg-blue-50 hover:bg-blue-100/80 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 border-blue-100 dark:border-blue-900/50'
                }`}
              >
                <p className={`font-bold text-sm mb-1 ${filterStatus === 'scheduled' ? 'text-blue-100' : 'text-blue-600 dark:text-blue-400'}`}>{t('admin_status_scheduled')}</p>
                <p className={`text-2xl font-black ${filterStatus === 'scheduled' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{stats.scheduled}</p>
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus(filterStatus === 'completed' ? 'all' : 'completed')}
                className={`rtl:text-right ltr:text-left p-4 rounded-xl border transition-all cursor-pointer ${
                  filterStatus === 'completed'
                    ? 'bg-green-600 text-white border-green-600 shadow-md ring-2 ring-green-400'
                    : 'bg-green-50 hover:bg-green-100/80 dark:bg-green-900/20 dark:hover:bg-green-900/30 border-green-100 dark:border-green-900/50'
                }`}
              >
                <p className={`font-bold text-sm mb-1 ${filterStatus === 'completed' ? 'text-green-100' : 'text-green-600 dark:text-green-400'}`}>{t('admin_status_completed')}</p>
                <p className={`text-2xl font-black ${filterStatus === 'completed' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{stats.completed}</p>
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus(filterStatus === 'postponed' ? 'all' : 'postponed')}
                className={`rtl:text-right ltr:text-left p-4 rounded-xl border transition-all cursor-pointer ${
                  filterStatus === 'postponed'
                    ? 'bg-orange-600 text-white border-orange-600 shadow-md ring-2 ring-orange-400'
                    : 'bg-orange-50 hover:bg-orange-100/80 dark:bg-orange-900/20 dark:hover:bg-orange-900/30 border-orange-100 dark:border-orange-900/50'
                }`}
              >
                <p className={`font-bold text-sm mb-1 ${filterStatus === 'postponed' ? 'text-orange-100' : 'text-orange-600 dark:text-orange-400'}`}>{t('admin_status_postponed')}</p>
                <p className={`text-2xl font-black ${filterStatus === 'postponed' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{stats.postponed}</p>
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus(filterStatus === 'canceled' ? 'all' : 'canceled')}
                className={`rtl:text-right ltr:text-left p-4 rounded-xl border transition-all cursor-pointer ${
                  filterStatus === 'canceled'
                    ? 'bg-red-600 text-white border-red-600 shadow-md ring-2 ring-red-400'
                    : 'bg-red-50 hover:bg-red-100/80 dark:bg-red-900/20 dark:hover:bg-red-900/30 border-red-100 dark:border-red-900/50'
                }`}
              >
                <p className={`font-bold text-sm mb-1 ${filterStatus === 'canceled' ? 'text-red-100' : 'text-red-600 dark:text-red-400'}`}>{t('admin_status_canceled')}</p>
                <p className={`text-2xl font-black ${filterStatus === 'canceled' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{stats.canceled}</p>
              </button>
            </div>

            {/* List Header */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-slate-700">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                {filterStatus === 'scheduled' && t('ls_scheduled')}
                {filterStatus === 'completed' && t('ls_completed')}
                {filterStatus === 'postponed' && t('ls_postponed')}
                {filterStatus === 'canceled' && t('ls_canceled')}
                {filterStatus === 'all' && (isRTL ? 'جميع الحصص' : 'All Sessions')}
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                  {filteredSessions.length}
                </span>
              </h3>
              {filterStatus !== 'all' && (
                <button
                  type="button"
                  onClick={() => setFilterStatus('all')}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  {t('ls_view_all_statuses')}
                </button>
              )}
            </div>

            {filteredSessions.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 dark:bg-slate-900/30 rounded-2xl border-2 border-dashed border-gray-200 dark:border-slate-700 mb-6">
                <Video className="w-16 h-16 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {filterStatus !== 'all' ? t('ls_no_filtered_sessions') : t('admin_no_sessions_found')}
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  {filterStatus !== 'all' ? t('ls_no_filtered_sessions_desc') : t('admin_no_sessions_desc')}
                </p>
              </div>
            ) : (
              <div className="grid gap-6">
                {filteredSessions.map((session) => (
                  <div key={session.id} className="flex flex-col lg:flex-row items-center justify-between p-6 rounded-2xl bg-gray-50 dark:bg-slate-900/50 border border-gray-100 dark:border-slate-700 hover:border-blue-300 transition-colors">
                    <div className="w-full lg:w-2/3">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{formatSessionTitle(session.title)}</h3>
                        {renderStatusBadge(session.status)}
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 mb-4">{formatSessionDesc(session.description)}</p>
                      
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 px-4 py-2 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                          <Calendar className="w-4 h-4 text-blue-600" />
                          <span dir="ltr">{new Date(session.start_time).toLocaleDateString(t('locale'), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 px-4 py-2 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                          <Clock className="w-4 h-4 text-orange-500" />
                          <span dir="ltr">{new Date(session.start_time).toLocaleTimeString(t('locale'), { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="mx-1">-</span>
                          <span dir="ltr">{new Date(session.end_time).toLocaleTimeString(t('locale'), { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-800 px-4 py-2 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                          {session.grade_level ? (
                            <><BookOpen className="w-4 h-4 text-green-600" /> {formatGradeName(session.grade_level)}</>
                          ) : (
                            <><Users className="w-4 h-4 text-purple-600" /> {t('admin_general_for_all')}</>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-stretch lg:items-end gap-3 w-full lg:w-auto mt-6 lg:mt-0 pt-6 lg:pt-0 border-t lg:border-t-0 border-gray-200 dark:border-slate-700">
                      
                      <div className="flex flex-wrap lg:justify-end gap-2 w-full">
                         <a 
                          href={session.zoom_link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-xl font-bold transition-all text-sm"
                        >
                          <LinkIcon className="w-4 h-4" />
                          {t('admin_zoom_link')}
                        </a>
                        
                        <button 
                          onClick={() => handleOpenModal(session)}
                          className="flex-1 lg:flex-none flex items-center justify-center p-2 px-4 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-200 hover:bg-blue-600 hover:text-white rounded-xl transition-all text-sm font-bold gap-1"
                        >
                          <Edit className="w-4 h-4" /> {t('admin_edit_session')}
                        </button>
                        <button 
                          onClick={() => setDeleteModal({ isOpen: true, id: session.id })}
                          className="flex items-center justify-center p-2 px-3 bg-red-100 dark:bg-red-900/30 text-red-600 hover:bg-red-600 hover:text-white rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Status controls */}
                      {canChangeStatus(session.end_time) && (
                        <div className="flex flex-col sm:flex-row items-center sm:justify-end gap-2 w-full mt-4 bg-white dark:bg-slate-900 p-3 sm:p-0 rounded-xl sm:bg-transparent border border-gray-100 sm:border-none dark:border-slate-700 shadow-sm sm:shadow-none">
                          <span className="text-sm text-gray-500 dark:text-gray-400 font-bold self-start sm:self-auto">{t('ls_change_status')}</span>
                          <select
                            value={session.status || 'scheduled'}
                            onChange={(e) => updateSessionStatus(session.id, e.target.value)}
                            className="w-full sm:w-auto text-sm font-bold px-3 py-2 sm:py-1.5 rounded-lg bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                          >
                            {statusOptions.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      )}

                    </div>
                  </div>
                ))}
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
                {isEditing ? t('admin_edit_session') : t('admin_schedule_session')}
              </h2>
              <button onClick={handleCloseModal} className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-500 hover:bg-red-100 hover:text-red-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('admin_session_title')}</label>
                <input 
                  type="text" 
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                  placeholder={t('admin_session_title_ph')}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('admin_session_desc')}</label>
                <textarea 
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                  placeholder={t('admin_session_desc_ph')}
                ></textarea>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('admin_start_time')}</label>
                  <input 
                    type="datetime-local" 
                    required
                    value={formData.start_time}
                    onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white ltr:text-left rtl:text-right"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('admin_end_time')}</label>
                  <input 
                    type="datetime-local" 
                    required
                    value={formData.end_time}
                    onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white ltr:text-left rtl:text-right"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('admin_zoom_link_label')}</label>
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
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('admin_assign_grade')}</label>
                <select
                  value={formData.grade_level}
                  onChange={(e) => setFormData({...formData, grade_level: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                >
                  <option value="">{t('admin_general_for_all')}</option>
                  <optgroup label={t('admin_primary_stage')}>
                    <option value="primary_1">{t('grade_primary_1')}</option>
                    <option value="primary_2">{t('grade_primary_2')}</option>
                    <option value="primary_3">{t('grade_primary_3')}</option>
                    <option value="primary_4">{t('grade_primary_4')}</option>
                    <option value="primary_5">{t('grade_primary_5')}</option>
                    <option value="primary_6">{t('grade_primary_6')}</option>
                  </optgroup>
                  <optgroup label={t('admin_prep_stage')}>
                    <option value="prep_1">{t('grade_prep_1')}</option>
                    <option value="prep_2">{t('grade_prep_2')}</option>
                    <option value="prep_3">{t('grade_prep_3')}</option>
                  </optgroup>
                  <optgroup label={t('admin_sec_stage')}>
                    <option value="sec_1">{t('grade_sec_1')}</option>
                    <option value="sec_2">{t('grade_sec_2')}</option>
                    <option value="sec_3">{t('grade_sec_3')}</option>
                  </optgroup>
                </select>
                <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {t('admin_assign_grade_desc')}
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-slate-700">
                <button 
                  type="button" 
                  onClick={handleCloseModal}
                  className="px-6 py-3 rounded-xl font-bold bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                >
                  {t('admin_cancel')}
                </button>
                <button 
                  type="submit" 
                  disabled={formLoading}
                  className="px-8 py-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {formLoading ? <Loader className="w-5 h-5 animate-spin" /> : t('admin_save_session')}
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
        title={t('admin_delete')}
        message={t('ls_delete_confirm')}
        confirmText={t('admin_delete')}
        cancelText={t('admin_cancel')}
        isDanger={true}
      />
    </div>
  );
}
