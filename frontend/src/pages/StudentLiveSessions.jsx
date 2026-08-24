import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Video, Calendar, Clock, BookOpen, Link as LinkIcon, 
  CheckCircle, Loader, PlayCircle
} from 'lucide-react';
import FadeIn from '../components/FadeIn';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';

export default function StudentLiveSessions() {
  const { t } = useTranslation();
  
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      // Due to RLS, this will only return sessions the student has access to
      const { data, error } = await supabase
        .from('online_sessions')
        .select(`
          *,
          courses(title)
        `)
        .order('start_time', { ascending: true });

      if (error) throw error;
      setSessions(data || []);
    } catch (err) {
      console.error('Error fetching live sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const now = new Date();
  
  // A session is considered "Live Now" if current time is between (start - 15 mins) and end time.
  const isLive = (start, end) => {
    const startTime = new Date(start);
    const endTime = new Date(end);
    startTime.setMinutes(startTime.getMinutes() - 15); // Allow joining 15 mins early
    return now >= startTime && now <= endTime;
  };

  const liveSessions = sessions.filter(s => isLive(s.start_time, s.end_time));
  const upcomingSessions = sessions.filter(s => new Date(s.start_time) > now && !isLive(s.start_time, s.end_time));
  const pastSessions = sessions.filter(s => new Date(s.end_time) < now);

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
              حصص الأونلاين المباشرة
            </h1>
            <p className="text-lg text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              هنا تجد جميع حصص الزووم (Zoom) المجدولة لك. انضم للحصص المباشرة في وقتها وتفاعل مع الأستاذ.
            </p>
          </div>
        </FadeIn>

        {/* Live Now Section */}
        {liveSessions.length > 0 && (
          <FadeIn delay={100}>
            <h2 className="text-2xl font-bold font-arabic text-gray-900 dark:text-white mb-6 flex items-center gap-3">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              يحدث الآن
            </h2>
            <div className="grid gap-6 mb-12">
              {liveSessions.map((session) => (
                <div key={session.id} className="flex flex-col md:flex-row items-center justify-between p-6 rounded-3xl bg-gradient-to-r from-blue-900 to-indigo-900 border border-blue-800 shadow-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-[50px] pointer-events-none group-hover:bg-white/10 transition-colors"></div>
                  
                  <div className="relative z-10 w-full md:w-2/3 mb-6 md:mb-0">
                    <h3 className="text-2xl font-bold text-white mb-2">{session.title}</h3>
                    {session.course_id && (
                      <p className="text-blue-200 font-medium mb-4 flex items-center gap-2">
                        <BookOpen className="w-4 h-4" /> كورس: {session.courses?.title}
                      </p>
                    )}
                    <p className="text-blue-100/80 mb-6">{session.description}</p>
                    
                    <div className="flex flex-wrap gap-4 text-sm font-bold text-white">
                      <div className="flex items-center gap-1.5 bg-black/20 px-4 py-2 rounded-xl backdrop-blur-md">
                        <Clock className="w-4 h-4 text-blue-300" />
                        <span dir="ltr">{new Date(session.start_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>-</span>
                        <span dir="ltr">{new Date(session.end_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
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
                      <PlayCircle className="w-6 h-6 text-red-500 animate-pulse" />
                      انضم للحصة الآن
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </FadeIn>
        )}

        {/* Upcoming Section */}
        <FadeIn delay={200}>
          <h2 className="text-2xl font-bold font-arabic text-gray-900 dark:text-white mb-6 border-b border-gray-200 dark:border-slate-800 pb-4">
            الحصص المجدولة القادمة
          </h2>
          
          {upcomingSessions.length === 0 && liveSessions.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-sm">
              <Calendar className="w-16 h-16 text-gray-300 dark:text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">لا يوجد حصص أونلاين قادمة</h3>
              <p className="text-gray-500 dark:text-gray-400">تابعنا دائماً، سيتم إشعارك عند إضافة حصص جديدة من قبل الأستاذ.</p>
            </div>
          ) : upcomingSessions.length > 0 ? (
            <div className="grid gap-6 mb-12">
              {upcomingSessions.map((session) => (
                <div key={session.id} className="flex flex-col md:flex-row items-center justify-between p-6 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-sm hover:border-blue-300 dark:hover:border-blue-800 transition-colors">
                  <div className="w-full md:w-3/4">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{session.title}</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">{session.description}</p>
                    
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-slate-900/50 px-4 py-2 rounded-xl">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        <span dir="ltr">{new Date(session.start_time).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-slate-900/50 px-4 py-2 rounded-xl">
                        <Clock className="w-4 h-4 text-orange-500" />
                        <span dir="ltr">{new Date(session.start_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {session.course_id && (
                        <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-slate-900/50 px-4 py-2 rounded-xl">
                          <BookOpen className="w-4 h-4 text-green-600" /> كورس: {session.courses?.title}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="w-full md:w-auto mt-6 md:mt-0 text-center bg-gray-50 dark:bg-slate-900 px-6 py-4 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
                    <Clock className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                    <span className="block text-sm font-bold text-gray-500 dark:text-gray-400">رابط الدخول سيظهر</span>
                    <span className="block text-xs text-gray-400">قبل الحصة بـ 15 دقيقة</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </FadeIn>

        {/* Past Sessions */}
        {pastSessions.length > 0 && (
          <FadeIn delay={300}>
            <div className="mt-12">
              <h2 className="text-xl font-bold font-arabic text-gray-900 dark:text-white mb-6 border-b border-gray-200 dark:border-slate-800 pb-4">
                الحصص السابقة
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 opacity-70">
                {pastSessions.map((session) => (
                  <div key={session.id} className="flex flex-col p-5 rounded-2xl bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-gray-900 dark:text-white">{session.title}</h3>
                      <span className="text-xs px-2 py-1 rounded-md bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> تمت
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mt-auto pt-4 border-t border-gray-100 dark:border-slate-700" dir="ltr">
                      {new Date(session.start_time).toLocaleDateString('ar-EG')} - {new Date(session.start_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        )}

      </div>
    </div>
  );
}
