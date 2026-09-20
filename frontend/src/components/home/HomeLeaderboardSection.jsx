import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Trophy, 
  Crown, 
  Medal, 
  Flame, 
  Search, 
  GraduationCap, 
  Sparkles, 
  ChevronDown, 
  User, 
  ShieldCheck,
  Award
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getStudentBadge } from '../../utils/gamification';
import { formatGradeName } from '../../utils/helpers';
import FadeIn from '../FadeIn';

export default function HomeLeaderboardSection() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(10);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, xp_points, grade_level, role, email')
        .eq('role', 'student')
        .order('xp_points', { ascending: false });

      if (error) throw error;

      // Filter out staff and sort by XP points
      const cleanStudents = (data || []).filter(
        p => p.role !== 'admin' && p.role !== 'teacher' && p.email !== '41147332a@gmail.com'
      );

      setStudents(cleanStudents);
    } catch (e) {
      console.error('Error fetching student leaderboard:', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const query = searchQuery.toLowerCase().trim();
    return students.filter(student => {
      const name = (student.full_name || '').toLowerCase();
      const grade = formatGradeName(student.grade_level).toLowerCase();
      return name.includes(query) || grade.includes(query);
    });
  }, [students, searchQuery]);

  const top3 = filteredStudents.slice(0, 3);
  const top1 = top3[0] || null;
  const top2 = top3[1] || null;
  const top3Student = top3[2] || null;

  const displayList = filteredStudents.slice(0, visibleCount);

  return (
    <section className="py-16 sm:py-24 bg-white dark:bg-slate-900 border-t border-b border-gray-100 dark:border-slate-800 relative overflow-hidden font-arabic">
      {/* Background Radial Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/5 dark:bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <FadeIn>
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs sm:text-sm font-black mb-4 border border-amber-200/80 dark:border-amber-700/50 shadow-xs">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span>{isRTL ? 'لوحة الشرف والتفوق' : 'Honor & Excellence Board'}</span>
            </div>
            
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 dark:text-white tracking-tight mb-4">
              {isRTL ? 'سجل ترتيب ونقاط كافة طلاب المنصة 👑' : 'Platform Students Leaderboard 👑'}
            </h2>
            
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 font-medium">
              {isRTL 
                ? 'تنافس شريف على مدار العام الدراسي. كل درس تنجزه وكل امتحان تجتازه يرفع رصيدك من الـ XP نحو القمة!' 
                : 'Honorable competition all school year round. Complete lessons and pass quizzes to climb to the top!'}
            </p>
          </div>
        </FadeIn>

        {/* Podium for Top 3 (if no active search filter) */}
        {!searchQuery.trim() && students.length >= 2 && (
          <FadeIn delay={150}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-12 items-end">
              
              {/* Rank 2 (Silver) */}
              {top2 && (
                <div className="order-2 md:order-1 p-6 rounded-3xl bg-gradient-to-b from-slate-50 to-white dark:from-slate-800/80 dark:to-slate-800/40 border border-slate-200 dark:border-slate-700 shadow-md flex flex-col items-center text-center relative overflow-hidden group hover:-translate-y-1 transition-all">
                  <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-black text-xs text-slate-700 dark:text-slate-200 shadow-xs">
                    🥈 2
                  </div>
                  
                  <div className="relative mb-3 mt-2">
                    {top2.avatar_url ? (
                      <img src={top2.avatar_url} alt={top2.full_name} className="w-16 h-16 rounded-full object-cover border-3 border-slate-300 dark:border-slate-600 shadow-md" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center border-3 border-slate-300 dark:border-slate-600 shadow-md">
                        <User className="w-8 h-8 text-slate-500" />
                      </div>
                    )}
                    <span className="absolute -bottom-1 -right-1 text-base">🥈</span>
                  </div>

                  <h4 className="font-black text-base text-gray-900 dark:text-white mb-1 truncate max-w-full">
                    {top2.full_name}
                  </h4>
                  
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">
                    {formatGradeName(top2.grade_level)}
                  </span>

                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700/80 text-slate-800 dark:text-slate-200 font-black text-sm">
                    <Flame className="w-4 h-4 text-orange-500" />
                    <span>{top2.xp_points || 0} XP</span>
                  </div>
                </div>
              )}

              {/* Rank 1 (Gold - Elevated in Center) */}
              {top1 && (
                <div className="order-1 md:order-2 p-8 rounded-3xl bg-gradient-to-b from-amber-50 via-white to-amber-50/50 dark:from-amber-950/40 dark:via-slate-800 dark:to-slate-800 border-2 border-amber-400 dark:border-amber-500/60 shadow-xl shadow-amber-500/10 flex flex-col items-center text-center relative overflow-hidden group hover:-translate-y-2 transition-all">
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-32 h-12 bg-gradient-to-r from-amber-400 to-yellow-400 rounded-full blur-xl opacity-60" />
                  
                  <div className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-xs shadow-md">
                    👑 1
                  </div>

                  <div className="relative mb-4 mt-2">
                    {top1.avatar_url ? (
                      <img src={top1.avatar_url} alt={top1.full_name} className="w-20 h-20 rounded-full object-cover border-4 border-amber-400 shadow-xl" />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center border-4 border-amber-400 shadow-xl">
                        <User className="w-10 h-10 text-amber-600" />
                      </div>
                    )}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl animate-bounce">
                      👑
                    </div>
                  </div>

                  <h3 className="font-black text-lg sm:text-xl text-gray-900 dark:text-white mb-1 truncate max-w-full">
                    {top1.full_name}
                  </h3>

                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-3">
                    {formatGradeName(top1.grade_level)}
                  </span>

                  <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-base shadow-md shadow-amber-500/20">
                    <Flame className="w-5 h-5 fill-slate-950" />
                    <span>{top1.xp_points || 0} XP</span>
                  </div>
                </div>
              )}

              {/* Rank 3 (Bronze) */}
              {top3Student && (
                <div className="order-3 md:order-3 p-6 rounded-3xl bg-gradient-to-b from-orange-50/50 to-white dark:from-slate-800/80 dark:to-slate-800/40 border border-orange-200/80 dark:border-orange-800/40 shadow-md flex flex-col items-center text-center relative overflow-hidden group hover:-translate-y-1 transition-all">
                  <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-amber-100 dark:bg-orange-950/60 flex items-center justify-center font-black text-xs text-amber-800 dark:text-amber-300 shadow-xs">
                    🥉 3
                  </div>

                  <div className="relative mb-3 mt-2">
                    {top3Student.avatar_url ? (
                      <img src={top3Student.avatar_url} alt={top3Student.full_name} className="w-16 h-16 rounded-full object-cover border-3 border-orange-300 dark:border-orange-600/70 shadow-md" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center border-3 border-orange-300 dark:border-orange-600/70 shadow-md">
                        <User className="w-8 h-8 text-orange-600" />
                      </div>
                    )}
                    <span className="absolute -bottom-1 -right-1 text-base">🥉</span>
                  </div>

                  <h4 className="font-black text-base text-gray-900 dark:text-white mb-1 truncate max-w-full">
                    {top3Student.full_name}
                  </h4>

                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">
                    {formatGradeName(top3Student.grade_level)}
                  </span>

                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 font-black text-sm">
                    <Flame className="w-4 h-4 text-orange-500" />
                    <span>{top3Student.xp_points || 0} XP</span>
                  </div>
                </div>
              )}

            </div>
          </FadeIn>
        )}

        {/* Search & Filter Bar */}
        <div className="mb-6">
          <div className="relative max-w-md mx-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRTL ? 'ابحث باسم الطالب أو مرحلته الدراسية...' : 'Search student or grade level...'}
              className={`w-full py-3 ${isRTL ? 'pr-11 pl-4' : 'pl-11 pr-4'} rounded-2xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-sm font-bold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all shadow-xs`}
            />
            <Search className={`w-5 h-5 text-gray-400 absolute top-1/2 -translate-y-1/2 ${isRTL ? 'right-4' : 'left-4'}`} />
          </div>
        </div>

        {/* Full Leaderboard List Table */}
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-amber-500 border-t-transparent" />
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-8 text-center bg-gray-50 dark:bg-slate-800/50 rounded-3xl border border-gray-100 dark:border-slate-700">
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
              {isRTL ? 'لا يوجد طلاب مطابقين لنتائج البحث' : 'No matching students found'}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800/80 rounded-3xl border border-gray-200/90 dark:border-slate-700/80 shadow-md overflow-hidden">
            <div className="divide-y divide-gray-100 dark:divide-slate-700/60">
              {displayList.map((student, idx) => {
                const rank = idx + 1;
                const badge = getStudentBadge(student.xp_points, isRTL);
                
                return (
                  <div 
                    key={student.id} 
                    className="p-4 sm:p-5 flex items-center justify-between gap-3 hover:bg-amber-50/30 dark:hover:bg-slate-700/40 transition-colors"
                  >
                    {/* Rank & Student Info */}
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                      {/* Rank Indicator */}
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200">
                        {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                      </div>

                      {/* Avatar */}
                      {student.avatar_url ? (
                        <img 
                          src={student.avatar_url} 
                          alt={student.full_name} 
                          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border-2 border-amber-400/50 shrink-0" 
                        />
                      ) : (
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center border-2 border-gray-200 dark:border-slate-600 shrink-0">
                          <User className="w-5 h-5 text-gray-500" />
                        </div>
                      )}

                      {/* Name & Grade & Badge */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-black text-sm sm:text-base text-gray-900 dark:text-white truncate">
                            {student.full_name}
                          </h4>
                          {/* Badge pill */}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-bold ${badge.badgeClass}`}>
                            <span>{badge.title}</span>
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          {formatGradeName(student.grade_level)}
                        </p>
                      </div>
                    </div>

                    {/* XP Points */}
                    <div className="shrink-0 text-left dir-ltr">
                      <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 font-black text-sm sm:text-base text-amber-700 dark:text-amber-300">
                        <Flame className="w-4 h-4 text-orange-500 fill-orange-500" />
                        <span>{student.xp_points || 0}</span>
                        <span className="text-xs text-amber-600 dark:text-amber-400">XP</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Show More Button */}
            {filteredStudents.length > visibleCount && (
              <div className="p-4 text-center border-t border-gray-100 dark:border-slate-700/60 bg-gray-50/50 dark:bg-slate-800/50">
                <button
                  onClick={() => setVisibleCount(prev => prev + 15)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 text-gray-800 dark:text-gray-200 text-sm font-black border border-gray-200 dark:border-slate-600 shadow-xs transition-all"
                >
                  <span>{isRTL ? 'عرض المزيد من الطلاب المتفوقين' : 'Show More Students'}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </section>
  );
}
