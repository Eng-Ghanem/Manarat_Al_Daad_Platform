import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { 
  Play, 
  X, 
  BookOpen, 
  GraduationCap, 
  MessageSquare, 
  Video, 
  Trophy, 
  Sparkles, 
  CheckCircle2, 
  ArrowLeft, 
  ArrowRight,
  HelpCircle,
  Clock,
  ShieldCheck
} from 'lucide-react';
import FadeIn from '../FadeIn';

export default function PlatformTourVideo() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // Platform features showcased in the tour
  const tourFeatures = [
    {
      id: 'courses',
      icon: BookOpen,
      color: 'from-blue-600 to-cyan-500',
      tagColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
      title: t('tour_feature_1_title'),
      desc: t('tour_feature_1_desc'),
      btnText: t('tour_feature_1_btn'),
      link: '/classes',
      badge: isRTL ? 'تأسيس ومناهج' : 'Foundation & Curricula',
      highlights: isRTL ? [
        'فيديوهات عالية الدقة بدون انقطاع',
        'مذكرات وتلخيصات PDF لكل محاضرة',
        'حفظ تلقائي للتقدم ونقاط الـ XP'
      ] : [
        'HD uninterrupted video streaming',
        'PDF lecture notes and summaries',
        'Auto progress save with XP points'
      ]
    },
    {
      id: 'quizzes',
      icon: GraduationCap,
      color: 'from-emerald-600 to-teal-500',
      tagColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
      title: t('tour_feature_2_title'),
      desc: t('tour_feature_2_desc'),
      btnText: t('tour_feature_2_btn'),
      link: '/quizzes',
      badge: isRTL ? 'تصحيح فوري' : 'Instant Grading',
      highlights: isRTL ? [
        'نماذج تدريبية شاملة لكل درس',
        'تصحيح تلقائي فوري مع شرح الإجابات',
        'شهادة تقدير الكترونية للمتميزين'
      ] : [
        'Comprehensive quiz banks per lesson',
        'Instant grading with answer feedback',
        'Merit certificates for achievers'
      ]
    },
    {
      id: 'chat',
      icon: MessageSquare,
      color: 'from-purple-600 to-pink-500',
      tagColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800',
      title: t('tour_feature_3_title'),
      desc: t('tour_feature_3_desc'),
      btnText: t('tour_feature_3_btn'),
      link: '/chat',
      badge: isRTL ? 'ردود ومنشن @' : 'Replies & @ Mentions',
      highlights: isRTL ? [
        'ميزة الرد المقتبس WhatsApp-style على أي رسالة',
        'منشن سريع بالـ @ للأستاذ والزملاء',
        'تسجيلات صوتية وملفات مرفقة وتواصل خاص'
      ] : [
        'WhatsApp-style quoted replies on any message',
        'Quick @ mentions for teacher & peers',
        'Voice notes, attachments & direct DMs'
      ]
    },
    {
      id: 'live',
      icon: Video,
      color: 'from-amber-500 to-orange-500',
      tagColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
      title: t('tour_feature_4_title'),
      desc: t('tour_feature_4_desc'),
      btnText: t('tour_feature_4_btn'),
      link: '/live-sessions',
      badge: isRTL ? 'بث مباشر Zoom' : 'Zoom Live Sessions',
      highlights: isRTL ? [
        'لقاءات أسبوعية تفاعلية مع الأستاذ سيد غريب',
        'تنبيهات تلقائية قبل بدء كل حصة',
        'حل الأسئلة الصعبة ومراجعات ليلة الامتحان'
      ] : [
        'Weekly interactive live sessions with Mr. Sayed',
        'Automated reminders before every session',
        'Challenging questions & exam night reviews'
      ]
    },
    {
      id: 'leaderboard',
      icon: Trophy,
      color: 'from-yellow-500 to-amber-600',
      tagColor: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
      title: t('tour_feature_5_title'),
      desc: t('tour_feature_5_desc'),
      btnText: t('tour_feature_5_btn'),
      link: '/leaderboard',
      badge: isRTL ? 'لوحة الشرف والـ XP' : 'Honor Board & XP',
      highlights: isRTL ? [
        'نقاط خبرة (XP) مع كل درس وامتحان تنجزه',
        'تصنيف أسبوعي وشهري لأوائل الطلاب',
        'تكريم وجوائز خاصة للمتفوقين'
      ] : [
        'XP rewarded with every lesson & test',
        'Weekly & monthly national rankings',
        'Special honors and badges for top students'
      ]
    }
  ];

  const currentFeature = tourFeatures[activeTab];

  return (
    <section className="relative py-20 bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-900/80 dark:via-slate-900 dark:to-slate-950 overflow-hidden border-y border-gray-100 dark:border-slate-800">
      {/* Decorative ambient background glows */}
      <div className="absolute top-1/4 -right-40 w-96 h-96 bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 -left-40 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold text-xs sm:text-sm mb-4 border border-blue-200/80 dark:border-blue-700/50 shadow-sm">
              <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
              <span>{t('tour_badge')}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 dark:text-white font-arabic tracking-tight leading-tight mb-4">
              {t('tour_title')}
            </h2>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 font-arabic leading-relaxed">
              {t('tour_subtitle')}
            </p>
          </FadeIn>
        </div>

        {/* Main Showcase: Tour Video Card + Pillar Navigator */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Video Preview / Interactive Player Card (7 Cols) */}
          <div className="lg:col-span-7">
            <FadeIn delay={150}>
              <div className="relative group rounded-3xl p-1.5 bg-gradient-to-tr from-blue-600/40 via-indigo-600/20 to-emerald-500/40 shadow-2xl overflow-hidden">
                <div className="relative aspect-video w-full rounded-[22px] bg-slate-950 overflow-hidden shadow-inner flex items-center justify-center">
                  
                  {/* Subtle decorative grid pattern inside player */}
                  <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px] opacity-15"></div>
                  
                  {/* Ambient Glow */}
                  <div className="absolute -bottom-10 inset-x-0 h-40 bg-gradient-to-t from-blue-600/20 to-transparent pointer-events-none"></div>

                  {/* Feature Visual Preview based on activeTab */}
                  <div className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-between text-white z-10 transition-all">
                    
                    {/* Top bar inside video card */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs text-white/90">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                        <span className="font-arabic font-bold">منارة الضاد • {currentFeature.badge}</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs text-blue-300">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{t('tour_duration')}</span>
                      </div>
                    </div>

                    {/* Central Play Trigger */}
                    <div className="text-center my-auto">
                      <motion.button
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.94 }}
                        onClick={() => setIsPlaying(true)}
                        className="relative inline-flex items-center justify-center p-6 sm:p-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-[0_0_40px_rgba(37,99,235,0.6)] group-hover:shadow-[0_0_60px_rgba(37,99,235,0.9)] transition-all cursor-pointer"
                        title={t('tour_watch_video')}
                      >
                        <span className="absolute inset-0 rounded-full bg-blue-400 opacity-20 animate-ping"></span>
                        <Play className="w-8 h-8 sm:w-10 sm:h-10 fill-current translate-x-0.5 rtl:-translate-x-0.5" />
                      </motion.button>
                      <h3 className="text-lg sm:text-xl font-bold font-arabic text-white mt-4 drop-shadow-md">
                        {t('tour_watch_video')}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-300/80 font-arabic mt-1">
                        {isRTL ? 'دليلك المرئي الشامل لكل زاوية في المنصة' : 'Your comprehensive visual tour of the platform'}
                      </p>
                    </div>

                    {/* Bottom Feature Pill Bar */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs text-white/70">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>{isRTL ? 'إشراف الأستاذ سيد غريب' : 'Under Mr. Sayed Gharieb\'s supervision'}</span>
                      </div>
                      <span className="hidden sm:inline font-mono text-[11px] text-slate-400">1080p Full HD</span>
                    </div>

                  </div>
                </div>
              </div>
            </FadeIn>
          </div>

          {/* Chapters & Interactive Features Navigator (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col space-y-3">
            <FadeIn delay={200}>
              <div className="mb-2">
                <span className="text-xs uppercase tracking-wider font-bold text-blue-600 dark:text-blue-400 font-arabic">
                  {isRTL ? 'محطات الجولة التفاعلية' : 'Tour Chapters'}
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white font-arabic mt-1">
                  {isRTL ? 'اكتشف كيف تضمن تفوقك خطوة بخطوة:' : 'Discover your path to excellence step by step:'}
                </h3>
              </div>
            </FadeIn>

            {/* Pillar Selector Tabs */}
            <div className="space-y-2.5">
              {tourFeatures.map((feat, idx) => {
                const IconComponent = feat.icon;
                const isSelected = activeTab === idx;

                return (
                  <motion.div
                    key={feat.id}
                    whileHover={{ x: isRTL ? -4 : 4 }}
                    transition={{ duration: 0.15 }}
                  >
                    <button
                      onClick={() => setActiveTab(idx)}
                      className={`w-full text-start p-3.5 sm:p-4 rounded-2xl border transition-all flex items-start gap-3.5 cursor-pointer ${
                        isSelected
                          ? 'bg-white dark:bg-slate-800 border-blue-500/80 dark:border-blue-500 shadow-lg shadow-blue-500/10'
                          : 'bg-white/60 dark:bg-slate-800/50 border-gray-200/80 dark:border-slate-700/60 hover:bg-white dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className={`p-2.5 rounded-xl text-white bg-gradient-to-tr ${feat.color} shadow-sm shrink-0 mt-0.5`}>
                        <IconComponent className="w-4 h-4 sm:w-5 sm:h-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h4 className={`text-sm sm:text-base font-bold font-arabic truncate ${
                            isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'
                          }`}>
                            {feat.title}
                          </h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${feat.tagColor}`}>
                            {feat.badge}
                          </span>
                        </div>
                        
                        <p className="text-xs text-gray-600 dark:text-gray-400 font-arabic line-clamp-2 leading-relaxed">
                          {feat.desc}
                        </p>

                        {/* Expanded details when active */}
                        {isSelected && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700/70"
                          >
                            <ul className="space-y-1.5 mb-3">
                              {feat.highlights.map((h, i) => (
                                <li key={i} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 font-arabic">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                  <span>{h}</span>
                                </li>
                              ))}
                            </ul>
                            
                            <Link
                              to={feat.link}
                              className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 group"
                            >
                              <span>{feat.btnText}</span>
                              {isRTL ? (
                                <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
                              ) : (
                                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                              )}
                            </Link>
                          </motion.div>
                        )}
                      </div>
                    </button>
                  </motion.div>
                );
              })}
            </div>

          </div>

        </div>

      </div>

      {/* Fullscreen Video Modal Player */}
      <AnimatePresence>
        {isPlaying && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-10 bg-black/85 backdrop-blur-md"
            onClick={() => setIsPlaying(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-5xl bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-700"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-slate-950 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center">
                    <Play className="w-4 h-4 fill-current" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white font-arabic">{t('tour_title')}</h4>
                    <p className="text-xs text-slate-400 font-arabic">{isRTL ? 'إرشاد شامل خطوة بخطوة للطلاب الجدد' : 'Step-by-step onboarding for students'}</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsPlaying(false)}
                  className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title={t('tour_close')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Video Embed Container */}
              <div className="relative aspect-video w-full bg-black">
                <iframe
                  src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0&modestbranding=1"
                  title={t('tour_title')}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                ></iframe>
              </div>

              {/* Modal Footer with quick jump action */}
              <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs text-slate-400 font-arabic">
                  <span>{isRTL ? 'هل لديك أي استفسار آخر؟' : 'Have any questions?'}</span>
                  <Link to="/chat" onClick={() => setIsPlaying(false)} className="text-blue-400 font-bold hover:underline">
                    {isRTL ? 'تواصل معنا في الشات المباشر' : 'Contact us via live chat'}
                  </Link>
                </div>

                <button
                  onClick={() => setIsPlaying(false)}
                  className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors font-arabic"
                >
                  {t('tour_close')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
