import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Video, Calendar, Clock, BookOpen, Link as LinkIcon,
  CheckCircle, Loader, PlayCircle, XCircle, Clock4, Filter
} from 'lucide-react';
import FadeIn from '../components/FadeIn';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { formatSessionTitle, formatSessionDesc, formatGradeName } from '../utils/helpers';

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

  // Sessions filtered by month (for calculating statistics)
  const monthFilteredSessions = sessions.filter(s => {
    if (filterMonth !== 'all') {
      if (!s.start_time) return false;
      const date = new Date(s.start_time);
      const sMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (sMonth !== filterMonth) return false;
    }
    return true;
  });

  // Calculate statistics based on month
  const stats = {
    scheduled: monthFilteredSessions.filter(s => !s.status || s.status === 'scheduled').length,
    completed: monthFilteredSessions.filter(s => s.status === 'completed').length,
    canceled: monthFilteredSessions.filter(s => s.status === 'canceled').length,
    postponed: monthFilteredSessions.filter(s => s.status === 'postponed').length
  };

  // Final filtered sessions based on status filter
  const filteredSessions = monthFilteredSessions.filter(s => {
    if (filterStatus !== 'all') {
      const sStatus = s.status || 'scheduled';
      if (sStatus !== filterStatus) return false;
    }
    return true;
  });

  // Group filtered sessions (used only when filterStatus === 'all')
  const upcomingSessions = filteredSessions.filter(s => !s.status || s.status === 'scheduled' || s.status === 'postponed');
  const pastSessions = filteredSessions.filter(s => s.status === 'completed' || s.status === 'canceled');

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> {t('student_status_done', 'مكتملة')}</span>;
      case 'canceled':
        return <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-bold flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> {t('student_status_canceled', 'ملغية')}</span>;
      case 'postponed':
        return <span className="text-xs px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-bold flex items-center gap-1"><Clock4 className="w-3.5 h-3.5" /> {t('student_status_postponed', 'مؤجلة')}</span>;
      case 'scheduled':
      default:
        return <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {t('student_status_scheduled', 'مجدولة')}</span>;
    }
  };

  const renderSessionCard = (session) => {
    const isUpcoming = !session.status || session.status === 'scheduled';
    const isPostponed = session.status === 'postponed';
    const isCompleted = session.status === 'completed';
    const isCanceled = session.status === 'canceled';

    return (
      <div 
        key={session.id} 
        className={`flex flex-col md:flex-row items-center justify-between p-6 rounded-3xl border shadow-xl relative overflow-hidden group transition-all duration-300 ${
          isUpcoming 
            ? 'bg-gradient-to-r from-blue-900 to-indigo-900 border-blue-800' 
            : isPostponed
            ? 'bg-white dark:bg-slate-800 border-orange-200 dark:border-orange-900/40'
            : isCanceled
            ? 'bg-white dark:bg-slate-800 border-red-200 dark:border-red-900/40'
            : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'
        }`}
      >
        {isUpcoming && (
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-[50px] pointer-events-none group-hover:bg-white/10 transition-colors"></div>
        )}
        
        <div className="relative z-10 w-full md:w-2/3 mb-6 md:mb-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h3 className={`text-2xl font-bold ${isUpcoming ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
              {formatSessionTitle(session.title)}
            </h3>
            {renderStatusBadge(session.status)}
          </div>

          {session.grade_level && (
            <p className={`font-medium mb-4 flex items-center gap-2 ${isUpcoming ? 'text-blue-200' : 'text-gray-600 dark:text-gray-400'}`}>
              <BookOpen className="w-4 h-4" /> {formatGradeName(session.grade_level)}
            </p>
          )}

          {session.description && (
            <p className={`mb-6 ${isUpcoming ? 'text-blue-100/80' : 'text-gray-500 dark:text-gray-400'}`}>
              {formatSessionDesc(session.description)}
            </p>
          )}
          
          <div className={`flex flex-wrap gap-4 text-sm font-bold ${isUpcoming ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>
            <div className={`flex items-center gap-1.5 px-4 py-2 rounded-xl backdrop-blur-md ${isUpcoming ? 'bg-black/20' : 'bg-gray-100 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700'}`}>
              <Calendar className={`w-4 h-4 ${isUpcoming ? 'text-blue-300' : 'text-blue-600'}`} />
              <span dir="ltr">{new Date(session.start_time).toLocaleDateString(t('locale'), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            <div className={`flex items-center gap-1.5 px-4 py-2 rounded-xl backdrop-blur-md ${isUpcoming ? 'bg-black/20' : 'bg-gray-100 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700'}`}>
              <Clock className={`w-4 h-4 ${isUpcoming ? 'text-orange-300' : 'text-orange-500'}`} />
              <span dir="ltr">{new Date(session.start_time).toLocaleTimeString(t('locale'), { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="mx-1">-</span>
              <span dir="ltr">{new Date(session.end_time).toLocaleTimeString(t('locale'), { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>
        
        {isUpcoming && session.zoom_link && (
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

        {isPostponed && (
          <div className="relative z-10 w-full md:w-auto">
            <span className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 font-bold text-sm">
              <Clock4 className="w-4 h-4 text-orange-500" />
              {t('live_sessions_status_postponed_msg')}
            </span>
          </div>
        )}

        {isCompleted && (
          <div className="relative z-10 w-full md:w-auto">
            <span className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 font-bold text-sm">
              <CheckCircle className="w-4 h-4 text-green-500" />
              {t('live_sessions_status_ended_msg')}
            </span>
          </div>
        )}

        {isCanceled && (
          <div className="relative z-10 w-full md:w-auto">
            <span className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 font-bold text-sm">
              <XCircle className="w-4 h-4 text-red-500" />
              {t('live_sessions_status_canceled_msg')}
            </span>
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

        <div className="mb-6 flex justify-start">
          <BackButton to="/dashboard" text="العودة للرئيسية" />
        </div>

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
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1"><Calendar className="w-4 h-4" /> {t('live_sessions_filter_month')}</label>
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm font-bold focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-white"
                >
                  <option value="all" className="bg-white dark:bg-slate-800 font-bold">{t('live_sessions_all_months')}</option>
                  {uniqueMonths.map(m => {
                    const [year, month] = m.split('-');
                    const date = new Date(year, month - 1);
                    const monthName = date.toLocaleDateString(t('locale') || 'ar-EG', { month: 'long', year: 'numeric' });
                    return <option key={m} value={m} className="bg-white dark:bg-slate-800 font-bold">{monthName}</option>;
                  })}
                </select>
              </div>

              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1"><Filter className="w-4 h-4" /> {t('live_sessions_filter_status')}</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm font-bold focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-white"
                >
                  <option value="all" className="bg-white dark:bg-slate-800 font-bold">{t('live_sessions_all_statuses')}</option>
                  <option value="scheduled" className="bg-white dark:bg-slate-800 font-bold">{t('student_status_scheduled', 'مجدولة')}</option>
                  <option value="completed" className="bg-white dark:bg-slate-800 font-bold">{t('student_status_done', 'مكتملة')}</option>
                  <option value="postponed" className="bg-white dark:bg-slate-800 font-bold">{t('student_status_postponed', 'مؤجلة')}</option>
                  <option value="canceled" className="bg-white dark:bg-slate-800 font-bold">{t('student_status_canceled', 'ملغية')}</option>
                </select>
              </div>
            </div>

            {/* Statistics - Clickable Quick Filters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                type="button"
                onClick={() => setFilterStatus(filterStatus === 'scheduled' ? 'all' : 'scheduled')}
                className={`rtl:text-right ltr:text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                  filterStatus === 'scheduled'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/25 ring-2 ring-blue-400'
                    : 'bg-blue-50 hover:bg-blue-100/80 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 border-blue-100 dark:border-blue-900/50'
                }`}
              >
                <p className={`font-bold text-xs mb-1 ${filterStatus === 'scheduled' ? 'text-blue-100' : 'text-blue-600 dark:text-blue-400'}`}>
                  {t('student_status_scheduled', 'مجدولة')}
                </p>
                <p className={`text-3xl font-black ${filterStatus === 'scheduled' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                  {stats.scheduled}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFilterStatus(filterStatus === 'completed' ? 'all' : 'completed')}
                className={`rtl:text-right ltr:text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                  filterStatus === 'completed'
                    ? 'bg-green-600 text-white border-green-600 shadow-lg shadow-green-500/25 ring-2 ring-green-400'
                    : 'bg-green-50 hover:bg-green-100/80 dark:bg-green-900/20 dark:hover:bg-green-900/40 border-green-100 dark:border-green-900/50'
                }`}
              >
                <p className={`font-bold text-xs mb-1 ${filterStatus === 'completed' ? 'text-green-100' : 'text-green-600 dark:text-green-400'}`}>
                  {t('student_status_done', 'مكتملة')}
                </p>
                <p className={`text-3xl font-black ${filterStatus === 'completed' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                  {stats.completed}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFilterStatus(filterStatus === 'postponed' ? 'all' : 'postponed')}
                className={`rtl:text-right ltr:text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                  filterStatus === 'postponed'
                    ? 'bg-orange-600 text-white border-orange-600 shadow-lg shadow-orange-500/25 ring-2 ring-orange-400'
                    : 'bg-orange-50 hover:bg-orange-100/80 dark:bg-orange-900/20 dark:hover:bg-orange-900/40 border-orange-100 dark:border-orange-900/50'
                }`}
              >
                <p className={`font-bold text-xs mb-1 ${filterStatus === 'postponed' ? 'text-orange-100' : 'text-orange-600 dark:text-orange-400'}`}>
                  {t('student_status_postponed', 'مؤجلة')}
                </p>
                <p className={`text-3xl font-black ${filterStatus === 'postponed' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                  {stats.postponed}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFilterStatus(filterStatus === 'canceled' ? 'all' : 'canceled')}
                className={`rtl:text-right ltr:text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                  filterStatus === 'canceled'
                    ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-500/25 ring-2 ring-red-400'
                    : 'bg-red-50 hover:bg-red-100/80 dark:bg-red-900/20 dark:hover:bg-red-900/40 border-red-100 dark:border-red-900/50'
                }`}
              >
                <p className={`font-bold text-xs mb-1 ${filterStatus === 'canceled' ? 'text-red-100' : 'text-red-600 dark:text-red-400'}`}>
                  {t('student_status_canceled', 'ملغية')}
                </p>
                <p className={`text-3xl font-black ${filterStatus === 'canceled' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                  {stats.canceled}
                </p>
              </button>
            </div>
          </div>
        </FadeIn>

        {/* Dynamic Sessions Display based on Filter */}
        {filterStatus !== 'all' ? (
          <FadeIn delay={200}>
            <div className="flex items-center justify-between mb-6 border-b border-gray-200 dark:border-slate-800 pb-4">
              <h2 className="text-2xl font-bold font-arabic text-gray-900 dark:text-white flex items-center gap-2">
                {filterStatus === 'scheduled' && t('ls_scheduled')}
                {filterStatus === 'completed' && t('ls_completed')}
                {filterStatus === 'postponed' && t('ls_postponed')}
                {filterStatus === 'canceled' && t('ls_canceled')}
                <span className="text-sm font-bold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                  {filteredSessions.length}
                </span>
              </h2>
              <button
                onClick={() => setFilterStatus('all')}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                {t('ls_view_all')}
              </button>
            </div>

            {filteredSessions.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm">
                <Calendar className="w-16 h-16 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {t('ls_no_filtered_sessions')}
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  {t('ls_no_filtered_sessions_desc')}
                </p>
              </div>
            ) : (
              <div className="grid gap-6 mb-12">
                {filteredSessions.map(session => renderSessionCard(session))}
              </div>
            )}
          </FadeIn>
        ) : (
          /* filterStatus === 'all' */
          <>
            {filteredSessions.length === 0 ? (
              <FadeIn delay={200}>
                <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm">
                  <Calendar className="w-16 h-16 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {t('student_no_upcoming_sessions')}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    {t('student_no_upcoming_sessions_desc')}
                  </p>
                </div>
              </FadeIn>
            ) : (
              <>
                {/* Upcoming Sessions */}
                {upcomingSessions.length > 0 && (
                  <FadeIn delay={200}>
                    <h2 className="text-2xl font-bold font-arabic text-gray-900 dark:text-white mb-6 border-b border-gray-200 dark:border-slate-800 pb-4">
                      {t('student_upcoming_sessions')} ({upcomingSessions.length})
                    </h2>
                    <div className="grid gap-6 mb-12">
                      {upcomingSessions.map(session => renderSessionCard(session))}
                    </div>
                  </FadeIn>
                )}

                {/* Past Sessions */}
                {pastSessions.length > 0 && (
                  <FadeIn delay={300}>
                    <div className={upcomingSessions.length > 0 ? "mt-12" : ""}>
                      <h2 className="text-xl font-bold font-arabic text-gray-900 dark:text-white mb-6 border-b border-gray-200 dark:border-slate-800 pb-4">
                        {t('student_past_sessions')} ({pastSessions.length})
                      </h2>
                      <div className="grid gap-6 mb-12">
                        {pastSessions.map(session => renderSessionCard(session))}
                      </div>
                    </div>
                  </FadeIn>
                )}
              </>
            )}
          </>
        )}

      </div>
    </div>
  );
}
