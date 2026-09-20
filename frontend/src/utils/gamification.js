// Manarat Al-Daad Platform - Gamification & Points Rules Engine
import { supabase } from '../lib/supabase';

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

const getApiBaseUrl = () => {
  return import.meta.env.VITE_API_URL || 'http://localhost:5000';
};

export const fetchXpRulesAsync = async () => {
  // 1. Try Supabase platform_settings first
  try {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'gamification_rules')
      .maybeSingle();

    if (!error && data?.value) {
      saveXpRules(data.value);
      return { ...DEFAULT_XP_RULES, ...data.value };
    }
  } catch (e) {
    // Supabase table may not exist yet or offline
  }

  // 2. Try backend API
  try {
    const apiUrl = getApiBaseUrl();
    const res = await fetch(`${apiUrl}/api/gamification/rules`);
    if (res.ok) {
      const data = await res.json();
      if (data?.rules) {
        saveXpRules(data.rules);
        return { ...DEFAULT_XP_RULES, ...data.rules };
      }
    }
  } catch (e) {
    // Backend API may not be reachable
  }

  // 3. Fallback to local storage or default
  return getXpRules();
};

export const saveXpRulesAsync = async (rules) => {
  // Save locally first for instant snappy response
  saveXpRules(rules);

  // Try saving to Supabase platform_settings
  try {
    await supabase
      .from('platform_settings')
      .upsert({
        key: 'gamification_rules',
        value: rules,
        updated_at: new Date().toISOString()
      });
  } catch (e) {
    console.warn('Could not save rules to Supabase platform_settings:', e);
  }

  // Try saving to backend API
  try {
    const apiUrl = getApiBaseUrl();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (token) {
      await fetch(`${apiUrl}/api/admin/gamification/rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(rules)
      });
    }
  } catch (e) {
    console.warn('Could not save rules to backend API:', e);
  }

  return rules;
};

export const getStudentBadge = (xp, isRTL = true) => {
  const points = Number(xp) || 0;
  if (points >= 600) {
    return {
      title: isRTL ? 'عبقري الضاد 👑' : 'Master Scholar 👑',
      color: 'from-amber-500 to-yellow-400 text-slate-950 border-amber-400',
      badgeClass: 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20',
      tier: 'diamond',
      icon: '👑'
    };
  }
  if (points >= 300) {
    return {
      title: isRTL ? 'فارس اللغة ⚡' : 'Language Knight ⚡',
      color: 'from-purple-500 to-indigo-500 text-white border-purple-400',
      badgeClass: 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white border-purple-400 shadow-md shadow-purple-500/20',
      tier: 'gold',
      icon: '⚡'
    };
  }
  if (points >= 100) {
    return {
      title: isRTL ? 'طالب متفوق ☀️' : 'Star Student ☀️',
      color: 'from-blue-500 to-cyan-500 text-white border-blue-400',
      badgeClass: 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-blue-400 shadow-md shadow-blue-500/20',
      tier: 'silver',
      icon: '☀️'
    };
  }
  return {
    title: isRTL ? 'طالب مثابر 🌱' : 'Rising Learner 🌱',
    color: 'from-slate-500 to-gray-500 text-white border-gray-400',
    badgeClass: 'bg-gradient-to-r from-slate-600 to-gray-600 text-white border-gray-500 shadow-sm',
    tier: 'bronze',
    icon: '🌱'
  };
};
