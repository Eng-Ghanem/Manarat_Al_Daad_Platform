import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy, Medal, Crown, Flame, Sparkles, User, Award, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import FadeIn from './FadeIn';
import { getCache, setCache } from '../utils/appCache';

export default function Leaderboard({ compact = false }) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { user, profile } = useAuth();
  const isSupervisor = profile?.role === 'admin' || profile?.role === 'teacher';

  const cachedStudents = getCache('leaderboard_top_students');
  const cachedUserRank = user ? getCache(`leaderboard_rank_${user.id}`) : null;

  const [topStudents, setTopStudents] = useState(cachedStudents || []);
  const [userRank, setUserRank] = useState(cachedUserRank !== null ? cachedUserRank : null);
  const [loading, setLoading] = useState(!cachedStudents);

  useEffect(() => {
    fetchLeaderboard();
  }, [user, profile]);

  const fetchLeaderboard = async () => {
    try {
      if (!cachedStudents && topStudents.length === 0) {
        setLoading(true);
      }
      // Strictly fetch students - Admins & Teachers are NEVER part of the student ranking
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, xp_points, grade_level, role')
        .eq('role', 'student')
        .order('xp_points', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Filter out any staff/admin profiles as extra safety
      const studentsList = (data || []).filter(
        p => p.role !== 'admin' && p.role !== 'teacher' && p.email !== '41147332a@gmail.com'
      );
      setTopStudents(studentsList);
      setCache('leaderboard_top_students', studentsList, 300);

      // Find current user's rank ONLY IF THE USER IS A STUDENT
      if (user && !isSupervisor) {
        const userIndex = studentsList.findIndex(s => s.id === user.id);
        if (userIndex !== -1) {
          const rank = userIndex + 1;
          setUserRank(rank);
          setCache(`leaderboard_rank_${user.id}`, rank, 300);
        } else {
          // If not in top 10, find how many students have more XP
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('xp_points')
            .eq('id', user.id)
            .single();

          if (userProfile) {
            const { count } = await supabase
              .from('profiles')
              .select('id', { count: 'exact', head: true })
              .eq('role', 'student')
              .gt('xp_points', userProfile.xp_points || 0);

            const rank = (count || 0) + 1;
            setUserRank(rank);
            setCache(`leaderboard_rank_${user.id}`, rank, 300);
          }
        }
      } else {
        // Supervisors/Admins never have a student rank
        setUserRank(null);
      }
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRankBadge = (rank) => {
    if (rank === 1) {
      return (
        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/30">
          <Crown className="w-5 h-5 fill-slate-950" />
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-slate-400 to-gray-200 text-slate-900 flex items-center justify-center font-black shadow-md">
          <Medal className="w-5 h-5" />
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-700 to-amber-500 text-white flex items-center justify-center font-black shadow-md">
          <Award className="w-5 h-5" />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 flex items-center justify-center font-bold text-sm">
        #{rank}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-gray-100 dark:border-slate-700/50 shadow-sm flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const top1 = topStudents[0];
  const top2 = topStudents[1];
  const top3 = topStudents[2];
  const restStudents = topStudents.slice(3);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-gray-100 dark:border-slate-700/50 shadow-sm relative overflow-hidden font-arabic">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 blur-[100px] rounded-full pointer-events-none"></div>

      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-8 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white flex items-center gap-2">
              <span>{isRTL ? 'لوحة شرف الأوائل' : 'Honor Leaderboard'}</span>
              <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isRTL ? 'الطلاب الأكثر تميزاً وتفوقاً بنقاط الخبرة (XP)' : 'Top performing students by experience points (XP)'}
            </p>
          </div>
        </div>

        {/* Student's Rank Badge */}
        {!isSupervisor && userRank && (
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-2xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-sm font-bold">
            <span>{isRTL ? 'ترتيبك الحالي بين الطلاب:' : 'Your Student Rank:'}</span>
            <span className="font-extrabold text-blue-600 dark:text-blue-400">#{userRank}</span>
          </div>
        )}

        {/* Supervisor/Admin Mode Badge */}
        {isSupervisor && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-300 text-xs sm:text-sm font-bold shadow-sm">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{isRTL ? 'وضع إشراف المعلم (ترتيب الطلاب المتفوقين فقط)' : 'Instructor Mode (Viewing Student Rankings Only)'}</span>
          </div>
        )}
      </div>

      {topStudents.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <Trophy className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>
            {isSupervisor
              ? (isRTL ? 'لا توجد نقاط مسجلة للطلاب بعد. سيظهر الطلاب الأوائل هنا تلقائياً عند حلهم للاختبارات والدروس.' : 'No student XP recorded yet. Top students will automatically appear here.')
              : (isRTL ? 'لا يوجد طلاب مسجلون بنقاط بعد. كن أول من يجمع النقاط!' : 'No students ranked yet. Be the first to earn XP!')}
          </p>
        </div>
      ) : (
        <>
          {/* Top 3 Podium (Shown on non-compact or large views) */}
          {!compact && topStudents.length >= 2 && (
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-8 pt-6 items-end relative z-10">
              {/* #2 Rank (Left in LTR, Right in RTL) */}
              {top2 && (
                <div className="flex flex-col items-center text-center order-1">
                  <div className="relative mb-2">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 flex items-center justify-center overflow-hidden shadow-md">
                      {top2.avatar_url ? (
                        <img src={top2.avatar_url} alt={top2.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-8 h-8 sm:w-10 sm:h-10 text-slate-500" />
                      )}
                    </div>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-slate-300 text-slate-900 text-xs font-black px-2 py-0.5 rounded-full shadow">
                      #2
                    </div>
                  </div>
                  <h4 className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm line-clamp-1 max-w-[100px] sm:max-w-[130px]">
                    {top2.full_name}
                  </h4>
                  <div className="flex items-center gap-1 text-xs font-black text-slate-600 dark:text-slate-300 mt-1">
                    <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>{top2.xp_points || 0} XP</span>
                  </div>
                  <div className="w-full h-20 sm:h-24 bg-gradient-to-t from-slate-200 to-slate-100 dark:from-slate-700/60 dark:to-slate-800 rounded-2xl mt-3 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-black text-slate-400 text-xl">
                    2
                  </div>
                </div>
              )}

              {/* #1 Champion Rank (Center) */}
              {top1 && (
                <div className="flex flex-col items-center text-center order-2">
                  <Crown className="w-8 h-8 text-amber-500 fill-amber-400 mb-1 animate-bounce" />
                  <div className="relative mb-2">
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-amber-400 bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center overflow-hidden shadow-xl shadow-amber-500/20">
                      {top1.avatar_url ? (
                        <img src={top1.avatar_url} alt={top1.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-10 h-10 sm:w-12 sm:h-12 text-amber-600" />
                      )}
                    </div>
                    <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 text-xs font-black px-2.5 py-0.5 rounded-full shadow-lg">
                      #1 👑
                    </div>
                  </div>
                  <h4 className="font-extrabold text-gray-900 dark:text-white text-sm sm:text-base line-clamp-1 max-w-[120px] sm:max-w-[150px]">
                    {top1.full_name}
                  </h4>
                  <div className="flex items-center gap-1 text-xs sm:text-sm font-black text-amber-600 dark:text-amber-400 mt-1">
                    <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span>{top1.xp_points || 0} XP</span>
                  </div>
                  <div className="w-full h-28 sm:h-32 bg-gradient-to-t from-amber-400/30 to-amber-200/30 dark:from-amber-900/40 dark:to-slate-800 rounded-2xl mt-3 border border-amber-300 dark:border-amber-700/50 flex items-center justify-center font-black text-amber-500 text-3xl shadow-inner">
                    1
                  </div>
                </div>
              )}

              {/* #3 Rank (Right in LTR, Left in RTL) */}
              {top3 && (
                <div className="flex flex-col items-center text-center order-3">
                  <div className="relative mb-2">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-amber-700/50 bg-amber-50 dark:bg-slate-700 flex items-center justify-center overflow-hidden shadow-md">
                      {top3.avatar_url ? (
                        <img src={top3.avatar_url} alt={top3.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-8 h-8 sm:w-10 sm:h-10 text-amber-700" />
                      )}
                    </div>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-amber-700 text-white text-xs font-black px-2 py-0.5 rounded-full shadow">
                      #3
                    </div>
                  </div>
                  <h4 className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm line-clamp-1 max-w-[100px] sm:max-w-[130px]">
                    {top3.full_name}
                  </h4>
                  <div className="flex items-center gap-1 text-xs font-black text-amber-700 dark:text-amber-400 mt-1">
                    <Flame className="w-3.5 h-3.5 text-amber-600 fill-amber-600" />
                    <span>{top3.xp_points || 0} XP</span>
                  </div>
                  <div className="w-full h-16 sm:h-20 bg-gradient-to-t from-amber-900/20 to-amber-800/10 dark:from-slate-700/60 dark:to-slate-800 rounded-2xl mt-3 border border-amber-800/20 dark:border-slate-700 flex items-center justify-center font-black text-amber-700/70 text-lg">
                    3
                  </div>
                </div>
              )}
            </div>
          )}

          {/* List for rest of students or full compact list */}
          <div className="space-y-2.5 relative z-10">
            {(compact ? topStudents : restStudents).map((student, idx) => {
              const rank = compact ? idx + 1 : idx + 4;
              const isCurrentUser = user && student.id === user.id;

              return (
                <div
                  key={student.id}
                  className={`flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border transition-all ${
                    isCurrentUser
                      ? 'bg-blue-50/80 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 shadow-sm'
                      : 'bg-gray-50/70 dark:bg-slate-700/40 border-gray-100 dark:border-slate-700/50 hover:border-gray-200 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    {getRankBadge(rank)}
                    <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-slate-600 overflow-hidden flex items-center justify-center text-gray-500 shrink-0">
                      {student.avatar_url ? (
                        <img src={student.avatar_url} alt={student.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base flex items-center gap-2">
                        <span>{student.full_name}</span>
                        {isCurrentUser && (
                          <span className="text-[10px] bg-blue-600 text-white font-bold px-2 py-0.5 rounded-full">
                            {isRTL ? 'أنت' : 'You'}
                          </span>
                        )}
                      </h4>
                      {student.grade_level && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {student.grade_level}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 font-black text-amber-600 dark:text-amber-400 text-sm sm:text-base">
                    <Flame className="w-4 h-4 fill-amber-500 text-amber-500" />
                    <span>{student.xp_points || 0}</span>
                    <span className="text-xs text-gray-400 font-normal">XP</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
