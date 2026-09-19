// Manarat Al-Daad Platform - Gamification & Points Rules Engine

export const DEFAULT_XP_RULES = {
  lesson_completed: 15,          // نقاط إكمال الدرس الواحد
  quiz_passed: 20,               // نقاط اجتياز الاختبار (50% فأكثر)
  quiz_full_score: 50,           // مكافأة تقفيل الامتحان والدرجة النهائية (100%)
  course_completed: 100,         // مكافأة إتمام الكورس ونيل الشهادة المعتمدة
  notes_saved: 5                 // مكافأة كتابة وتلخيص ملاحظات الدرس
};

export const getXpRules = () => {
  try {
    const stored = localStorage.getItem('mad_gamification_rules');
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_XP_RULES, ...parsed };
    }
  } catch (e) {
    console.warn('Could not parse gamification rules:', e);
  }
  return DEFAULT_XP_RULES;
};

export const saveXpRules = (rules) => {
  try {
    localStorage.setItem('mad_gamification_rules', JSON.stringify(rules));
  } catch (e) {
    console.error('Could not save gamification rules:', e);
  }
};

export const getStudentBadge = (xp, isRTL = true) => {
  const points = Number(xp) || 0;
  if (points >= 600) {
    return {
      title: isRTL ? 'عبقري الضاد 👑' : 'Master Scholar 👑',
      color: 'from-amber-500 to-yellow-400 text-slate-950 border-amber-400',
      tier: 'diamond'
    };
  }
  if (points >= 300) {
    return {
      title: isRTL ? 'فارس اللغة ⚡' : 'Language Knight ⚡',
      color: 'from-purple-500 to-indigo-500 text-white border-purple-400',
      tier: 'gold'
    };
  }
  if (points >= 100) {
    return {
      title: isRTL ? 'طالب متفوق 🌟' : 'Star Student 🌟',
      color: 'from-blue-500 to-cyan-500 text-white border-blue-400',
      tier: 'silver'
    };
  }
  return {
    title: isRTL ? 'طالب مثابر 🌱' : 'Rising Learner 🌱',
    color: 'from-slate-500 to-gray-500 text-white border-gray-400',
    tier: 'bronze'
  };
};
