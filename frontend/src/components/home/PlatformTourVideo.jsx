import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { 
  BookOpen, 
  GraduationCap, 
  MessageSquare, 
  Video, 
  Trophy, 
  Sparkles, 
  CheckCircle2, 
  ArrowLeft, 
  ArrowRight
} from 'lucide-react';
import FadeIn from '../FadeIn';

export default function PlatformTourVideo() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  // Platform features showcased in the tour (covering all platform services)
  const tourFeatures = [
    {
      id: 'classes',
      icon: BookOpen,
      color: 'from-blue-600 to-indigo-600',
      tagColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
      title: isRTL ? 'مناهج الصفوف الدراسية' : 'Curricula & Grades',
      desc: isRTL ? 'شروحات وافية ومذكرات للمرحلة الابتدائية، الإعدادية، والثانوية.' : 'Detailed lessons and PDF notes for primary, prep, and secondary.',
      btnText: isRTL ? 'تصفح الصفوف والمناهج' : 'Browse Classes',
      link: '/classes',
      badge: isRTL ? 'صفوف ومناهج' : 'School Grades',
      highlights: isRTL ? [
        'دروس منظمة لكل مرحلة دراسية',
        'مذكرات وتلخيصات PDF لكل محاضرة',
        'متابعة مستمرة لمستوى استيعاب الطالب'
      ] : [
        'Structured lessons per school grade',
        'PDF notes and lesson summaries',
        'Progress tracking for comprehension'
      ]
    },
    {
      id: 'foundation',
      icon: Sparkles,
      color: 'from-cyan-600 to-blue-500',
      tagColor: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800',
      title: isRTL ? 'كورسات التأسيس الشامل' : 'Foundation Courses',
      desc: isRTL ? 'تأسيس قوي في قواعد النحو، الإملاء، والبلاغة لجميع المراحل.' : 'Solid foundation in Arabic grammar, dictation, and rhetoric.',
      btnText: isRTL ? 'استكشف كورسات التأسيس' : 'Explore Foundation',
      link: '/courses',
      badge: isRTL ? 'تأسيس شامل' : 'Foundation',
      highlights: isRTL ? [
        'سلسلة تأسيس متدرجة من الصفر حتى الإتقان',
        'تطبيقات عملية وأمثلة إعرابية شاملة',
        'اختبارات تحديد مستوى وتطوير مستمر'
      ] : [
        'Step-by-step foundation from basics to mastery',
        'Hands-on parsing exercises and examples',
        'Level placement and mastery tests'
      ]
    },
    {
      id: 'quizzes',
      icon: GraduationCap,
      color: 'from-emerald-600 to-teal-500',
      tagColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
      title: isRTL ? 'الامتحانات وبنك الأسئلة' : 'Quizzes & Question Bank',
      desc: isRTL ? 'تدريب عملي مستمر وتصحيح ذكي فوري مع شرح مفصل للإجابات.' : 'Practice tests, smart automated scoring and instant feedback.',
      btnText: isRTL ? 'بدء تدريبات الامتحانات' : 'Start Quizzes',
      link: '/quizzes',
      badge: isRTL ? 'تصحيح فوري' : 'Instant Grading',
      highlights: isRTL ? [
        'نماذج تدريبية شاملة لكل درس',
        'تصحيح تلقائي فوري مع تعليقات وتوضيحات',
        'إصدار شهادات تقدير إلكترونية فورية'
      ] : [
        'Comprehensive quiz banks per lesson',
        'Instant grading with answer feedback',
        'Instant digital certificates of achievement'
      ]
    },
    {
      id: 'chat',
      icon: MessageSquare,
      color: 'from-purple-600 to-pink-500',
      tagColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800',
      title: isRTL ? 'المحادثات والتفاعل الذكي' : 'Interactive Smart Chat',
      desc: isRTL ? 'اسأل واستفسر في أي وقت مع ميزة الرد المقتبس والمنشن وتواصل مع الأستاذ.' : 'Ask questions anytime with WhatsApp-style replies, @ mentions, and teacher guidance.',
      btnText: isRTL ? 'الدخول لغرفة المحادثة' : 'Join Discussion',
      link: '/chat',
      badge: isRTL ? 'ردود ومنشن' : 'Replies & Mentions',
      highlights: isRTL ? [
        'سحب جهة اليمين للرد الفوري على أي رسالة',
        'إشارة سريعة بالـ @ للأستاذ والزملاء',
        'تسجيلات صوتية وملفات وتواصل خاص مباشر'
      ] : [
        'Swipe-to-reply on any message',
        'Quick @ mentions with instant alerts',
        'Voice notes, file sharing, and direct DMs'
      ]
    },
    {
      id: 'live',
      icon: Video,
      color: 'from-amber-500 to-orange-500',
      tagColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
      title: isRTL ? 'حصص البث المباشر (Zoom)' : 'Zoom Live Sessions',
      desc: isRTL ? 'تفاعل مباشر أسبوعي مع الأستاذ سيد غريب لحل أصعب الأسئلة.' : 'Weekly live sessions with Mr. Sayed Gharieb for live Q&A.',
      btnText: isRTL ? 'عرض جدول الحصص' : 'View Live Schedule',
      link: '/live-sessions',
      badge: isRTL ? 'بث مباشر Zoom' : 'Zoom Live Sessions',
      highlights: isRTL ? [
        'لقاءات أسبوعية تفاعلية بالصوت والصورة',
        'تنبيهات ورابط مباشر للانضمام بضغطة زر',
        'مراجعات ليلة الامتحان وحل الأسئلة الوزارية'
      ] : [
        'Interactive audio-video live workshops',
        'One-click join links with automated alerts',
        'Exam night reviews and high-yield problems'
      ]
    },
    {
      id: 'leaderboard',
      icon: Trophy,
      color: 'from-yellow-500 to-amber-600',
      tagColor: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
      title: isRTL ? 'لوحة الشرف وشهادات التميز' : 'Honor Board & Certificates',
      desc: isRTL ? 'اجمع نقاط الـ XP وتصدر قائمة الأوائل واستلم شهادات تقدير معتمدة.' : 'Earn XP points, rank on the national board, and receive certificates.',
      btnText: isRTL ? 'عرض لوحة الشرف والشهادات' : 'View Honors & Certificates',
      link: '/certificates',
      badge: isRTL ? 'لوحة الشرف والـ XP' : 'Honor Board & XP',
      highlights: isRTL ? [
        'نقاط خبرة (XP) مع كل درس وامتحان تنجزه',
        'تصنيف أسبوعي وشهري لأوائل الطلاب',
        'شهادات تقدير رسمية وتكريم وجوائز خاصة'
      ] : [
        'XP rewarded with every completed lesson',
        'Weekly & monthly top student rankings',
        'Official certificates of excellence and awards'
      ]
    }
  ];

  return (
    <section className="relative py-16 bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-900/80 dark:via-slate-900 dark:to-slate-950 overflow-hidden border-y border-gray-100 dark:border-slate-800">
      {/* Decorative ambient background glows */}
      <div className="absolute top-1/4 -right-40 w-96 h-96 bg-blue-500/10 dark:bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 -left-40 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold text-xs sm:text-sm mb-4 border border-blue-200/80 dark:border-blue-700/50 shadow-sm">
              <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
              <span>{isRTL ? 'محطات الجولة التفاعلية' : 'Interactive Tour'}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 dark:text-white font-arabic tracking-tight leading-tight mb-4">
              {isRTL ? 'الجولة التعريفية في منصة منارة الضاد' : 'Tour of Manarat Al-Daad Platform'}
            </h2>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 font-arabic leading-relaxed">
              {isRTL ? 'اكتشف كيف تضمن تفوقك خطوة بخطوة في رحلتك التعليمية مع كافة خدمات ومميزات المنصة:' : 'Discover your path to academic excellence step-by-step with all platform services:'}
            </p>
          </FadeIn>
        </div>

        {/* 6 Tour Stations Responsive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tourFeatures.map((feat, idx) => {
            const IconComponent = feat.icon;

            return (
              <FadeIn key={feat.id} delay={idx * 60}>
                <div className="h-full flex flex-col bg-white dark:bg-slate-800/90 rounded-3xl p-6 sm:p-7 border border-gray-200/80 dark:border-slate-700/80 shadow-lg shadow-slate-900/5 hover:shadow-2xl hover:border-blue-500/50 transition-all duration-300 group relative overflow-hidden">
                  {/* Subtle top accent gradient */}
                  <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${feat.color}`}></div>

                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className={`p-3 rounded-2xl text-white bg-gradient-to-tr ${feat.color} shadow-md group-hover:scale-110 transition-transform`}>
                      <IconComponent className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${feat.tagColor}`}>
                      {feat.badge}
                    </span>
                  </div>

                  <h3 className="text-lg sm:text-xl font-bold font-arabic text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {feat.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-arabic leading-relaxed mb-4">
                    {feat.desc}
                  </p>

                  <ul className="space-y-2 mb-6 flex-1">
                    {feat.highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300 font-arabic">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="leading-snug">{h}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    to={feat.link}
                    className="inline-flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-700/60 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-xs sm:text-sm font-bold text-blue-600 dark:text-blue-400 border border-gray-200/80 dark:border-slate-600 transition-colors group-hover:border-blue-300"
                  >
                    <span>{feat.btnText}</span>
                    {isRTL ? (
                      <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                    ) : (
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    )}
                  </Link>
                </div>
              </FadeIn>
            );
          })}
        </div>

      </div>
    </section>
  );
}
