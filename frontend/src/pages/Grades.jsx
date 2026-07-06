import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Backpack, BookOpen, GraduationCap, X, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Grades() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [selectedGrade, setSelectedGrade] = useState(null);
  const isRTL = i18n.language === 'ar';

  const stages = [
    {
      id: 'primary',
      title: t('stage_primary'),
      desc: t('stage_primary_desc'),
      badge: t('badge_primary'),
      icon: <Backpack className="w-8 h-8 text-blue-600 dark:text-blue-400" />,
      grades: [
        { id: 'p1', name: t('grade_1_prim') },
        { id: 'p2', name: t('grade_2_prim') },
        { id: 'p3', name: t('grade_3_prim') },
        { id: 'p4', name: t('grade_4_prim') },
        { id: 'p5', name: t('grade_5_prim') },
        { id: 'p6', name: t('grade_6_prim') },
      ],
      colorClass: 'bg-blue-50/80 dark:bg-blue-900/10 border-blue-200/50 dark:border-blue-500/20',
      hoverGlow: 'hover:shadow-[0_0_25px_rgba(59,130,246,0.25)] dark:hover:shadow-[0_0_25px_rgba(59,130,246,0.15)]',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30'
    },
    {
      id: 'prep',
      title: t('stage_prep'),
      desc: t('stage_prep_desc'),
      badge: t('badge_prep'),
      icon: <BookOpen className="w-8 h-8 text-teal-600 dark:text-teal-400" />,
      grades: [
        { id: 'm1', name: t('grade_1_prep') },
        { id: 'm2', name: t('grade_2_prep') },
        { id: 'm3', name: t('grade_3_prep') },
      ],
      colorClass: 'bg-teal-50/80 dark:bg-teal-900/10 border-teal-200/50 dark:border-teal-500/20',
      hoverGlow: 'hover:shadow-[0_0_25px_rgba(20,184,166,0.25)] dark:hover:shadow-[0_0_25px_rgba(20,184,166,0.15)]',
      iconBg: 'bg-teal-100 dark:bg-teal-900/30'
    },
    {
      id: 'sec',
      title: t('stage_secondary'),
      desc: t('stage_sec_desc'),
      badge: t('badge_sec'),
      icon: <GraduationCap className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />,
      grades: [
        { id: 's1', name: t('grade_1_sec') },
        { id: 's2', name: t('grade_2_sec') },
        { id: 's3', name: t('grade_3_sec') },
      ],
      colorClass: 'bg-yellow-50/80 dark:bg-yellow-900/10 border-yellow-200/50 dark:border-yellow-500/20',
      hoverGlow: 'hover:shadow-[0_0_25px_rgba(234,179,8,0.25)] dark:hover:shadow-[0_0_25px_rgba(245,158,11,0.15)]',
      iconBg: 'bg-yellow-100 dark:bg-yellow-900/30'
    }
  ];

  const handleTermSelect = (termNum) => {
    if (!selectedGrade) return;
    const stageMap = { p: 'primary', m: 'prep', s: 'sec' };
    const stageLetter = selectedGrade.id.charAt(0);
    const stage = stageMap[stageLetter];
    const gradeNum = selectedGrade.id.substring(1);
    const categoryId = `${stage}-${gradeNum}-term-${termNum}`;
    navigate(`/courses/category/${categoryId}`);
  };

  const handleGradeClick = (grade) => {
    if (grade.id === 's3') {
      const stageMap = { p: 'primary', m: 'prep', s: 'sec' };
      const stageLetter = grade.id.charAt(0);
      const stage = stageMap[stageLetter];
      const gradeNum = grade.id.substring(1);
      const categoryId = `${stage}-${gradeNum}`;
      navigate(`/courses/category/${categoryId}`);
    } else {
      setSelectedGrade(grade);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 40 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 250, damping: 25 } }
  };

  return (
    <div className="min-h-screen py-24 bg-gray-50 dark:bg-slate-900 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 bg-arabic-pattern opacity-[0.03] dark:opacity-[0.02]"></div>
      <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-b from-blue-50/50 to-transparent dark:from-slate-800/50 dark:to-transparent pointer-events-none"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-24 max-w-4xl mx-auto"
        >
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-blue-900 dark:text-blue-400 mb-8 leading-tight font-arabic tracking-tight drop-shadow-sm">
            {t('grades_hero_title')}
          </h1>
          
          <div className="relative mb-10 inline-block">
            <Quote className="absolute -top-4 -right-6 w-8 h-8 text-gold-500/30 rotate-180" />
            <p className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-200 leading-relaxed italic px-8 py-4 bg-white/40 dark:bg-slate-800/40 backdrop-blur-md rounded-2xl border border-gray-100 dark:border-slate-700/50 shadow-inner">
              {t('grades_hero_quote')}
              <span className="block text-sm font-normal text-gray-500 dark:text-gray-400 mt-2">
                - {t('grades_hero_quote_author')} -
              </span>
            </p>
            <Quote className="absolute -bottom-4 -left-6 w-8 h-8 text-gold-500/30" />
          </div>

          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 leading-relaxed">
            {t('grades_hero_desc')}
          </p>
        </motion.div>

        {/* Stages */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-24"
        >
          {stages.map((stage, index) => (
            <motion.div 
              key={stage.id}
              variants={itemVariants}
              className="relative"
            >
              {/* Decorative separator between stages (except the first) */}
              {index > 0 && (
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-3/4 max-w-md h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-slate-700 to-transparent">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rotate-45 bg-gold-400"></div>
                </div>
              )}

              <div className="bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl border border-white/50 dark:border-slate-700/50 p-8 md:p-12 rounded-[2.5rem] shadow-2xl shadow-gray-200/50 dark:shadow-none relative overflow-hidden">
                
                {/* Stage Header & Content */}
                <div className="flex flex-col lg:flex-row gap-8 items-start mb-12 relative z-10">
                  <div className={`shrink-0 w-20 h-20 rounded-3xl ${stage.iconBg} shadow-inner flex items-center justify-center transform hover:rotate-6 transition-transform duration-300`}>
                    {stage.icon}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-4 mb-4">
                      <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
                        {stage.title}
                      </h2>
                      <span className="px-4 py-1.5 rounded-full text-sm font-bold bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-500/30">
                        {stage.badge}
                      </span>
                    </div>
                    <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed max-w-3xl">
                      {stage.desc}
                    </p>
                  </div>
                </div>

                {/* Grades Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                  {stage.grades.map((grade) => (
                    <motion.div
                      key={grade.id}
                      whileHover={{ scale: 1.03, y: -5 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleGradeClick(grade)}
                      className={`cursor-pointer border p-6 rounded-3xl transition-all duration-300 flex items-center justify-between group ${stage.colorClass} ${stage.hoverGlow}`}
                    >
                      <span className="font-bold text-xl text-gray-800 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                        {grade.name}
                      </span>
                      <div className="w-10 h-10 rounded-full bg-white/80 dark:bg-slate-900/80 flex items-center justify-center group-hover:bg-white dark:group-hover:bg-slate-900 transition-colors shadow-sm group-hover:shadow-md">
                        {isRTL ? <ChevronLeft className="w-5 h-5 text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400" /> : <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400" />}
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Decorative corner blur */}
                <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-gradient-to-tr from-blue-400/10 to-gold-400/10 blur-3xl rounded-full pointer-events-none"></div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {selectedGrade && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-lg"
            onClick={() => setSelectedGrade(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-[2rem] p-8 md:p-10 max-w-md w-full shadow-[0_0_50px_rgba(0,0,0,0.3)] border border-white/50 dark:border-slate-700/50 relative overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Decorative top glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-1.5 bg-gold-400 rounded-b-full shadow-[0_0_20px_rgba(250,204,21,0.8)]"></div>

              <button 
                onClick={() => setSelectedGrade(null)}
                className="absolute top-6 right-6 rtl:right-auto rtl:left-6 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-full p-2 z-10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-8 mt-4 relative z-10">
                <h3 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-3 tracking-tight">
                  {selectedGrade.name}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 font-medium">
                  {t('select_term')}
                </p>
              </div>

              <div className="space-y-4 relative z-10">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleTermSelect(1)}
                  className="w-full py-5 px-6 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white rounded-2xl font-bold text-xl transition-all shadow-lg shadow-blue-500/30 flex items-center justify-between group border border-blue-500/50"
                >
                  <span>{t('term_1')}</span>
                  {isRTL ? <ChevronLeft className="w-6 h-6 opacity-70 group-hover:opacity-100 group-hover:-translate-x-1 transition-all" /> : <ChevronRight className="w-6 h-6 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />}
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleTermSelect(2)}
                  className="w-full py-5 px-6 bg-gradient-to-r from-teal-600 to-teal-800 hover:from-teal-700 hover:to-teal-900 text-white rounded-2xl font-bold text-xl transition-all shadow-lg shadow-teal-500/30 flex items-center justify-between group border border-teal-500/50"
                >
                  <span>{t('term_2')}</span>
                  {isRTL ? <ChevronLeft className="w-6 h-6 opacity-70 group-hover:opacity-100 group-hover:-translate-x-1 transition-all" /> : <ChevronRight className="w-6 h-6 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />}
                </motion.button>
              </div>
              
              {/* Background modal decoration */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/5 dark:bg-blue-400/5 blur-3xl rounded-full pointer-events-none"></div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
