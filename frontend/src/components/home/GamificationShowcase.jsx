import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Trophy, 
  Sparkles, 
  Flame, 
  CheckCircle2, 
  Target, 
  GraduationCap, 
  FileText, 
  Zap, 
  Award,
  Crown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { fetchXpRulesAsync, DEFAULT_XP_RULES, getStudentBadge } from '../../utils/gamification';
import FadeIn from '../FadeIn';

export default function GamificationShowcase() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [rules, setRules] = useState(DEFAULT_XP_RULES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetchXpRulesAsync().then(loadedRules => {
      if (isMounted && loadedRules) {
        setRules(loadedRules);
        setLoading(false);
      }
    }).catch(() => {
      if (isMounted) setLoading(false);
    });
    return () => { isMounted = false; };
  }, []);

  const criteriaList = [
    {
      id: 'lesson_completed',
      points: rules.lesson_completed,
      title: isRTL ? 'إكمال الدرس' : 'Lesson Completed',
      desc: isRTL ? 'تُمنح فور إتمامك مشاهدة كافة أجزاء الدرس التعليمي' : 'Awarded instantly upon completing all video lesson parts',
      icon: CheckCircle2,
      badgeColor: 'from-blue-500 to-indigo-600',
      textColor: 'text-blue-500 dark:text-blue-400',
      bgLight: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800/60'
    },
    {
      id: 'quiz_passed',
      points: rules.quiz_passed,
      title: isRTL ? 'اجتياز الاختبار' : 'Passing Quiz',
      desc: isRTL ? 'تُمنح عند تحقيق نسبة نجاح 50% أو أعلى في أي اختبار' : 'Awarded when scoring 50% or higher on any quiz',
      icon: Target,
      badgeColor: 'from-emerald-500 to-teal-600',
      textColor: 'text-emerald-500 dark:text-emerald-400',
      bgLight: 'bg-emerald-50 dark:bg-emerald-900/20',
      borderColor: 'border-emerald-200 dark:border-emerald-800/60'
    },
    {
      id: 'quiz_full_score',
      points: rules.quiz_full_score,
      title: isRTL ? 'الدرجة النهائية 100%' : '100% Full Score',
      desc: isRTL ? 'مكافأة تميز وتقفيل الامتحان بالدرجة النهائية بدون أي خطأ' : 'Excellence bonus for achieving 100% with zero mistakes',
      icon: Flame,
      badgeColor: 'from-amber-500 to-orange-600',
      textColor: 'text-amber-500 dark:text-amber-400',
      bgLight: 'bg-amber-50 dark:bg-amber-900/20',
      borderColor: 'border-amber-200 dark:border-amber-800/60'
    },
    {
      id: 'course_completed',
      points: rules.course_completed,
      title: isRTL ? 'إتمام الكورس والشهادة' : 'Course & Certificate',
      desc: isRTL ? 'الجائزة الكبرى عند إتمام دورة تدريبية كاملة وإصدار الشهادة' : 'Grand milestone bonus upon completing a full course & certificate',
      icon: GraduationCap,
      badgeColor: 'from-purple-500 to-pink-600',
      textColor: 'text-purple-500 dark:text-purple-400',
      bgLight: 'bg-purple-50 dark:bg-purple-900/20',
      borderColor: 'border-purple-200 dark:border-purple-800/60'
    },
    {
      id: 'notes_saved',
      points: rules.notes_saved,
      title: isRTL ? 'تلخيص الملاحظات' : 'Lesson Notes',
      desc: isRTL ? 'مكافأة تدوين الملاحظات والفوائد العلمية أثناء المذاكرة' : 'Bonus for writing and summarizing key lesson takeaways',
      icon: FileText,
      badgeColor: 'from-cyan-500 to-blue-600',
      textColor: 'text-cyan-500 dark:text-cyan-400',
      bgLight: 'bg-cyan-50 dark:bg-cyan-900/20',
      borderColor: 'border-cyan-200 dark:border-cyan-800/60'
    }
  ];

  const tiers = [
    { name: isRTL ? 'طالب مثابر' : 'Rising Learner', icon: '🌱', range: '0 - 99 XP', color: 'from-slate-400 to-gray-500 text-white' },
    { name: isRTL ? 'طالب متفوق' : 'Star Student', icon: '☀️', range: '100 - 299 XP', color: 'from-blue-500 to-cyan-500 text-white' },
    { name: isRTL ? 'فارس اللغة' : 'Language Knight', icon: '⚡', range: '300 - 599 XP', color: 'from-purple-500 to-indigo-600 text-white' },
    { name: isRTL ? 'عبقري الضاد' : 'Master Scholar', icon: '👑', range: '+600 XP', color: 'from-amber-400 to-yellow-500 text-slate-950 font-black' }
  ];

  return (
    <section className="py-16 sm:py-24 bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-950 relative overflow-hidden font-arabic">
      {/* Background Decorative Blurs */}
      <div className="absolute top-1/4 -right-20 w-96 h-96 bg-amber-400/10 dark:bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 -left-20 w-96 h-96 bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <FadeIn>
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-xs sm:text-sm font-black mb-4 border border-amber-200 dark:border-amber-700/50 shadow-xs">
              <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
              <span>{isRTL ? 'نظام المكافآت والتحفيز التفاعلي' : 'Interactive Gamification System'}</span>
            </div>
            
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 dark:text-white tracking-tight mb-4">
              {isRTL ? 'معايير وتوزيع نقاط الـ ' : 'Criteria & Distribution of '}
              <span className="bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-400 bg-clip-text text-transparent">
                XP
              </span>
            </h2>
            
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
              {isRTL 
                ? 'كل خطوة تخطوها نحو التعلم والإتقان تقربك من التتويج! اجمع النقاط وافتح ألقاب الشرف وتصدر لائحة المتفوقين على مستوى المنصة.' 
                : 'Every step you take towards mastery brings you closer to glory! Earn XP, unlock prestigious badges, and top the leaderboard.'}
            </p>
          </div>
        </FadeIn>

        {/* Criteria Cards Grid (5 dynamic criteria matching Admin dashboard) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 mb-16">
          {criteriaList.map((item, idx) => {
            const Icon = item.icon;
            return (
              <FadeIn key={item.id} delay={idx * 80}>
                <div className={`h-full flex flex-col justify-between p-6 rounded-3xl bg-white dark:bg-slate-800/90 border ${item.borderColor} shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group`}>
                  
                  {/* Subtle top gradient line */}
                  <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${item.badgeColor}`} />

                  <div>
                    {/* Icon & Points Badge */}
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className={`w-12 h-12 rounded-2xl ${item.bgLight} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-inner`}>
                        <Icon className={`w-6 h-6 ${item.textColor}`} />
                      </div>
                      
                      <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full font-black text-sm text-white bg-gradient-to-r ${item.badgeColor} shadow-md`}>
                        <span>+{item.points}</span>
                        <span className="text-[11px]">XP</span>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {item.title}
                    </h3>

                    {/* Description */}
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
                      {item.desc}
                    </p>
                  </div>

                  {/* Micro Footer Indicator */}
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-700/60 flex items-center justify-between text-[11px] font-bold text-gray-400 dark:text-gray-500">
                    <span>{isRTL ? 'إضافة فورية' : 'Instant Reward'}</span>
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                  </div>
                </div>
              </FadeIn>
            );
          })}
        </div>

        {/* Tier Progression Showcase Banner */}
        <FadeIn delay={300}>
          <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 sm:p-10 border border-slate-700/80 shadow-2xl text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10">
              <div className="text-center lg:text-right max-w-md">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-amber-300 text-xs font-bold mb-3 backdrop-blur-md">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>{isRTL ? 'مراتب وألقاب الشرف' : 'Student Prestige Ranks'}</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black mb-2 tracking-tight">
                  {isRTL ? 'ارتقِ في سلم المجد العلمي' : 'Climb the Scholar Ranks'}
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed font-medium">
                  {isRTL 
                    ? 'كلما جمعت نقاط أكثر، تطورت شارتك وظهرت بجانب اسمك في المحادثات ولوحة الأوائل لتبرز بين زملائك.' 
                    : 'Earn more XP to level up your prestigious badge displayed across chats and platform leaderboards.'}
                </p>
              </div>

              {/* Tier steps */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 w-full lg:w-auto">
                {tiers.map((tier, idx) => (
                  <div 
                    key={idx} 
                    className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-sm transition-all text-center group"
                  >
                    <div className="text-3xl mb-2 group-hover:scale-125 transition-transform duration-300">
                      {tier.icon}
                    </div>
                    <span className="text-sm font-black text-white mb-1">
                      {tier.name}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-amber-300">
                      {tier.range}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>

      </div>
    </section>
  );
}
