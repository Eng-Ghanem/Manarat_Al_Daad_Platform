import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Video, Calendar, Clock, BookOpen, Link as LinkIcon,
  CheckCircle, Loader, PlayCircle, XCircle, Clock4, Filter
} from 'lucide-react';
import FadeIn from '../components/FadeIn';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';

export default function StudentLiveSessions() {
  const { t } = useTranslation();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Advanced filters state
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('online_sessions')
        .select('*')
        .order('start_time', { ascending: true });

      if (error) throw error;
      setSessions(data || []);
    } catch (err) {
      console.error('Error fetching live sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Extract unique months for the filter dropdown
  const uniqueMonths = [...new Set(sessions.map(s => {
    if (!s.start_time) return null;
    const date = new Date(s.start_time);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }).filter(Boolean))].sort().reverse();

  // Apply filters
  const filteredSessions = sessions.filter(s => {
    if (filterStatus !== 'all') {
      const sStatus = s.status || 'scheduled';
      if (sStatus !== filterStatus) return false;
    }
    if (filterMonth !== 'all') {
      if (!s.start_time) return false;
      const date = new Date(s.start_time);
      const sMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (sMonth !== filterMonth) return false;
    }
    return true;
  });

  // Calculate statistics based on filtered results
  const stats = {
    scheduled: filteredSessions.filter(s => !s.status || s.status === 'scheduled').length,
    completed: filteredSessions.filter(s => s.status === 'completed').length,
    canceled: filteredSessions.filter(s => s.status === 'canceled').length,
    postponed: filteredSessions.filter(s => s.status === 'postponed').length
  };

  // Group filtered sessions
  const upcomingSessions = filteredSessions.filter(s => !s.status || s.status === 'scheduled' || s.status === 'postponed');
  const pastSessions = filteredSessions.filter(s => s.status === 'completed' || s.status === 'canceled');

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <span className="text-xs px-2 py-1 rounded-md bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {t('student_status_done', 'مكتملة')}</span>;
      case 'canceled':
        return <span className="text-xs px-2 py-1 rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3" /> {t('student_status_canceled', 'ملغية')}</span>;
      case 'postponed':
        return <span className="text-xs px-2 py-1 rounded-md bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 flex items-center gap-1"><Clock4 className="w-3 h-3" /> {t('student_status_postponed', 'مؤجلة')}</span>;
      case 'scheduled':
      default:
        return <span className="text-xs px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center gap-1"><Calendar className="w-3 h-3" /> {t('student_status_scheduled', 'مجدولة')}</span>;
    }
  };

  const renderSessionCard = (session) => {
    const isPast = session.status === 'completed' || session.status === 'canceled';
    return (
      <div key={session.id} className={`flex flex-col md:flex-row items-center justify-between p-6 rounded-3xl border shadow-xl relative overflow-hidden group ${isPast ? 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700' : 'bg-gradient-to-r from-blue-900 to-indigo-900 border-blue-800'}`}>
        {!isPast && <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-[50px] pointer-events-none group-hover:bg-white/10 transition-colors"></div>}
        
        <div className="relative z-10 w-full md:w-2/3 mb-6 md:mb-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className={`text-2xl font-bold ${isPast ? 'text-gray-900 dark:text-white' : 'text-white'}`}>{session.title}</h3>
            {renderStatusBadge(session.status)}
          </div>
          {session.grade_level && (
            <p className={`font-medium mb-4 flex items-center gap-2 ${isPast ? 'text-gray-600 dark:text-gray-400' : 'text-blue-200'}`}>
              <BookOpen className="w-4 h-4" /> {t(`grade_${session.grade_level}`)}
            </p>
          )}
          <p className={`mb-6 ${isPast ? 'text-gray-500 dark:text-gray-400' : 'text-blue-100/80'}`}>{session.description}</p>
          
          <div className={`flex flex-wrap gap-4 text-sm font-bold ${isPast ? 'text-gray-700 dark:text-gray-300' : 'text-white'}`}>
            <div className={`flex items-center gap-1.5 px-4 py-2 rounded-xl backdrop-blur-md ${isPast ? 'bg-gray-100 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700' : 'bg-black/20'}`}>
              <Calendar className={`w-4 h-4 ${isPast ? 'text-blue-600' : 'text-blue-300'}`} />
              <span dir="ltr">{new Date(session.start_time).toLocaleDateString(t('locale'), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            <div className={`flex items-center gap-1.5 px-4 py-2 rounded-xl backdrop-blur-md ${isPast ? 'bg-gray-100 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700' : 'bg-black/20'}`}>
              <Clock className={`w-4 h-4 ${isPast ? 'text-orange-500' : 'text-orange-300'}`} />
              <span dir="ltr">{new Date(session.start_time).toLocaleTimeString(t('locale'), { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="mx-1">-</span>
              <span dir="ltr">{new Date(session.end_time).toLocaleTimeString(t('locale'), { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>
        
        {!isPast && (
          <div className="relative z-10 w-full md:w-auto">
            <a 
              href={session.zoom_link} 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full md:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-white text-blue-900 hover:bg-gray-100 rounded-2xl font-extrabold text-lg transition-transform hover:scale-105 shadow-lg shadow-white/10"
            >
              <PlayCircle className="w-6 h-6 text-blue-500 animate-pulse" />
              {t('student_join_now')}
            </a>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin shadow-lg"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-12 pt-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">

        <FadeIn>
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-blue-200 dark:border-blue-800">
              <Video className="w-10 h-10" />
            </div>
            <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white font-arabic mb-4">
              {t('student_live_sessions_title')}
            </h1>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              {t('student_live_sessions_desc')}
            </p>
          </div>
        </FadeIn>

        {/* Advanced Filters */}
        <FadeIn delay={100}>
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm mb-8">
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1"><Calendar className="w-4 h-4" /> تصفية حسب الشهر:</label>
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm font-bold focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-white"
                >
                  <option value="all" className="bg-white dark:bg-slate-800 font-bold">جميع الشهور</option>
                  {uniqueMonths.map(m => {
                    const [year, month] = m.split('-');
                    const date = new Date(year, month - 1);
                    const monthName = date.toLocaleDateString(t('locale') || 'ar-EG', { month: 'long', year: 'numeric' });
                    return <option key={m} value={m} className="bg-white dark:bg-slate-800 font-bold">{monthName}</option>;
                  })}
                </select>
              </div>

              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1"><Filter className="w-4 h-4" /> تصفية حسب الحالة:</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm font-bold focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-white"
                >
                  <option value="all" className="bg-white dark:bg-slate-800 font-bold">جميع الحالات</option>
                  <option value="scheduled" className="bg-white dark:bg-slate-800 font-bold">{t('student_status_scheduled', 'مجدولة')}</option>
                  <option value="completed" className="bg-white dark:bg-slate-800 font-bold">{t('student_status_done', 'مكتملة')}</option>
                  <option value="postponed" className="bg-white dark:bg-slate-800 font-bold">{t('student_status_postponed', 'مؤجلة')}</option>
                  <option value="canceled" className="bg-white dark:bg-slate-800 font-bold">{t('student_status_canceled', 'ملغية')}</option>
                </select>
              </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 border border-blue-100 dark:border-blue-900/50">
                <p className="text-blue-600 dark:text-blue-400 font-bold text-xs mb-1">{t('student_status_scheduled', 'مجدولة')}</p>
                <p className="text-3xl font-black text-gray-900 dark:text-white">{stats.scheduled}</p>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-4 border border-green-100 dark:border-green-900/50">
                <p className="text-green-600 dark:text-green-400 font-bold text-xs mb-1">{t('student_status_done', 'مكتملة')}</p>
                <p className="text-3xl font-black text-gray-900 dark:text-white">{stats.completed}</p>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-2xl p-4 border border-orange-100 dark:border-orange-900/50">
                <p className="text-orange-600 dark:text-orange-400 font-bold text-xs mb-1">{t('student_status_postponed', 'مؤجلة')}</p>
                <p className="text-3xl font-black text-gray-900 dark:text-white">{stats.postponed}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-4 border border-red-100 dark:border-red-900/50">
                <p className="text-red-600 dark:text-red-400 font-bold text-xs mb-1">{t('student_status_canceled', 'ملغية')}</p>
                <p className="text-3xl font-black text-gray-900 dark:text-white">{stats.canceled}</p>
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Upcoming Section */}
        <FadeIn delay={200}>
          <h2 className="text-2xl font-bold font-arabic text-gray-900 dark:text-white mb-6 border-b border-gray-200 dark:border-slate-800 pb-4">
            {t('student_upcoming_sessions')}
          </h2>

          {upcomingSessions.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm">
              <Calendar className="w-16 h-16 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('student_no_upcoming_sessions')}</h3>
              <p className="text-gray-500 dark:text-gray-400">{t('student_no_upcoming_sessions_desc')}</p>
            </div>
          ) : (
            <div className="grid gap-6 mb-12">
              {upcomingSessions.map((session) => (
                <div key={session.id} className="flex flex-col md:flex-row items-center justify-between p-6 rounded-3xl bg-gradient-to-r from-blue-900 to-indigo-900 border border-blue-800 shadow-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-[50px] pointer-events-none group-hover:bg-white/10 transition-colors"></div>

                  <div className="relative z-10 w-full md:w-2/3 mb-6 md:mb-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-bold text-white">{session.title}</h3>
                      {renderStatusBadge(session.status)}
                    </div>
                    {session.grade_level && (
                      <p className="text-blue-200 font-medium mb-4 flex items-center gap-2">
                        <BookOpen className="w-4 h-4" /> {t(`grade_${session.grade_level}`)}
                      </p>
                    )}
                    <p className="text-blue-100/80 mb-6">{session.description}</p>

                    <div className="flex flex-wrap gap-4 text-sm font-bold text-white">
                      <div className="flex items-center gap-1.5 bg-black/20 px-4 py-2 rounded-xl backdrop-blur-md">
                        <Calendar className="w-4 h-4 text-blue-300" />
                        <span dir="ltr">{new Date(session.start_time).toLocaleDateString(t('locale'), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-black/20 px-4 py-2 rounded-xl backdrop-blur-md">
                        <Clock className="w-4 h-4 text-orange-300" />
                        <span dir="ltr">{new Date(session.start_time).toLocaleTimeString(t('locale'), { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="mx-1">-</span>
                        <span dir="ltr">{new Date(session.end_time).toLocaleTimeString(t('locale'), { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="relative z-10 w-full md:w-auto">
                    <a
                      href={session.zoom_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full md:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-white text-blue-900 hover:bg-gray-100 rounded-2xl font-extrabold text-lg transition-transform hover:scale-105 shadow-lg shadow-white/10"
                    >
                      <PlayCircle className="w-6 h-6 text-blue-500 animate-pulse" />
                      {t('student_join_now')}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </FadeIn>

        {/* Past Sessions */}
        {pastSessions.length > 0 && (
          <FadeIn delay={300}>
            <div className="mt-12">
              <h2 className="text-xl font-bold font-arabic text-gray-900 dark:text-white mb-6 border-b border-gray-200 dark:border-slate-800 pb-4">
                {t('student_past_sessions')}
              </h2>
              <div className="grid gap-6 mb-12">
                {pastSessions.map(session => renderSessionCard(session))}
              </div>
            </div>
          </FadeIn>
        )}

      </div>
    </div>
  );
}
