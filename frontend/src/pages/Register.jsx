import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight, Loader, Eye, EyeOff, Phone, CheckCircle, XCircle, GraduationCap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export default function Register() {
  const { t } = useTranslation();
  const { register, updateProfile, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('male');
  const [gradeLevel, setGradeLevel] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Password validation checks
  const passwordCriteria = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
  };
  const isPasswordValid = Object.values(passwordCriteria).every(Boolean);

  const handleRegister = async (e) => {
    e.preventDefault();
    
    // Validations
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return toast.error('صيغة البريد الإلكتروني غير صحيحة');
    }

    const phoneRegex = /^01[0125][0-9]{8}$/;
    if (!phoneRegex.test(phone)) {
      return toast.error('يجب إدخال رقم هاتف مصري صحيح (مثال: 01012345678)');
    }

    if (!isPasswordValid) {
      return toast.error('كلمة المرور لا تستوفي الشروط المطلوبة');
    }

    if (password !== confirmPassword) {
      return toast.error('كلمتا المرور غير متطابقتين');
    }

    setLoading(true);

    try {
      const { data: authData, error } = await register(email, password, fullName, phone, gender, gradeLevel);
      if (error) throw error;
      


      if (authData?.user) {
        let userRole = 'student';
        const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;

        if (adminEmail && email.toLowerCase() === adminEmail.toLowerCase()) {
          const { error: updateError } = await updateProfile(authData.user.id, { role: 'admin' });
          if (!updateError) {
             userRole = 'admin';
          }
        }

        toast.success('تم التسجيل بنجاح! يرجى التحقق من البريد الإلكتروني لإدخال رمز التفعيل.');
        navigate(`/verify-otp?email=${encodeURIComponent(email)}`);
      } else {
        navigate(`/verify-otp?email=${encodeURIComponent(email)}`);
      }
    } catch (err) {
      console.error('Registration error:', err);
      let errorMessage = 'حدث خطأ أثناء التسجيل. يرجى المحاولة مرة أخرى.';
      
      if (err) {
        if (typeof err === 'string') {
          errorMessage = err;
        } else if (err.message) {
          errorMessage = err.message;
        } else if (err.error_description) {
          errorMessage = err.error_description;
        } else {
          try {
            const str = JSON.stringify(err);
            if (str !== '{}') errorMessage = str;
          } catch(e) {}
        }
      }
      
      if (errorMessage === '{}' || errorMessage === '"{}"' || errorMessage === '[object Object]') {
        errorMessage = `خطأ غير معروف: ${err?.status || err?.code || Object.keys(err).join(',')}`;
      }
      
      if (errorMessage.includes('already registered') || errorMessage.includes('User already exists')) {
        errorMessage = 'هذا البريد الإلكتروني مسجل بالفعل.';
      } else if (errorMessage.toLowerCase().includes('rate limit')) {
        errorMessage = 'تجاوزت الحد المسموح. يرجى الانتظار قليلاً.';
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network Error')) {
        errorMessage = 'تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت.';
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut", staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  };

  return (
    <div className="relative w-full min-h-[85vh] flex items-center justify-center p-4 py-16 overflow-hidden">
      {/* Decorative Background Orbs */}
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-blue-600/20 blur-[120px] pointer-events-none mix-blend-multiply dark:mix-blend-screen animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full bg-gold-500/20 blur-[150px] pointer-events-none mix-blend-multiply dark:mix-blend-screen" />
      <div className="absolute top-[40%] left-[20%] w-[300px] h-[300px] rounded-full bg-purple-500/10 blur-[100px] pointer-events-none mix-blend-multiply dark:mix-blend-screen" />
      
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-arabic-pattern opacity-[0.03] pointer-events-none"></div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-md w-full mx-auto relative z-10"
      >
      <motion.div variants={itemVariants} className="text-center mb-10">
        <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white font-arabic tracking-tight mb-3 drop-shadow-sm">
          {t('register_title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-300 font-medium">
          {t('register_subtitle')}
        </p>
      </motion.div>

      <motion.div variants={itemVariants} className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-2xl p-8 rounded-[2rem] shadow-2xl shadow-blue-900/5 border border-white/50 dark:border-slate-700/50">
        <form onSubmit={handleRegister} className="space-y-5">
          
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 px-1">{t('fullname_label')}</label>
            <div className="relative group">
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
                <User className="w-5 h-5" />
              </div>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="block w-full pr-12 pl-4 py-3.5 bg-white/50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-600 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 dark:text-white placeholder-gray-400 font-medium"
                placeholder={t('fullname_placeholder')}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 px-1">{t('email_label')}</label>
            <div className="relative group">
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
                <Mail className="w-5 h-5" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pr-12 pl-4 py-3.5 bg-white/50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-600 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 dark:text-white placeholder-gray-400 font-medium"
                placeholder={t('login_email_placeholder')}
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 px-1">{t('phone_label')}</label>
            <div className="relative group">
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
                <Phone className="w-5 h-5" />
              </div>
              <input
                type="tel"
                required
                maxLength={11}
                value={phone}
                onChange={(e) => {
                  let val = e.target.value;
                  const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
                  val = val.replace(/[٠-٩]/g, (d) => arabicNumbers.indexOf(d));
                  val = val.replace(/\D/g, '');
                  if (val.length <= 11) setPhone(val);
                }}
                className="block w-full pr-12 pl-4 py-3.5 bg-white/50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-600 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 dark:text-white placeholder-gray-400 font-medium"
                placeholder={t('phone_placeholder')}
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 px-1">{t('gender_label')}</label>
            <div className="grid grid-cols-2 gap-4">
              <label className={`cursor-pointer flex items-center justify-center p-3 rounded-2xl border-2 transition-all ${gender === 'male' ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold shadow-md shadow-blue-500/10' : 'border-transparent bg-gray-100/80 dark:bg-slate-900/80 text-gray-500 hover:bg-gray-200/80 dark:hover:bg-slate-800'}`}>
                <input type="radio" name="gender" value="male" className="sr-only" checked={gender === 'male'} onChange={(e) => setGender(e.target.value)} />
                {t('gender_male')}
              </label>
              <label className={`cursor-pointer flex items-center justify-center p-3 rounded-2xl border-2 transition-all ${gender === 'female' ? 'border-pink-600 bg-pink-50/80 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400 font-bold shadow-md shadow-pink-500/10' : 'border-transparent bg-gray-100/80 dark:bg-slate-900/80 text-gray-500 hover:bg-gray-200/80 dark:hover:bg-slate-800'}`}>
                <input type="radio" name="gender" value="female" className="sr-only" checked={gender === 'female'} onChange={(e) => setGender(e.target.value)} />
                {t('gender_female')}
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 px-1">الصف الدراسي (اختياري)</label>
            <div className="relative group">
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
                <GraduationCap className="w-5 h-5" />
              </div>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                className="block w-full pr-12 pl-4 py-3.5 bg-white/50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-600 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 dark:text-white placeholder-gray-400 font-medium appearance-none"
              >
                <option value="">اختر الصف الدراسي (اختياري)</option>
                <optgroup label="المرحلة الابتدائية">
                  <option value="primary_1">الصف الأول الابتدائي</option>
                  <option value="primary_2">الصف الثاني الابتدائي</option>
                  <option value="primary_3">الصف الثالث الابتدائي</option>
                  <option value="primary_4">الصف الرابع الابتدائي</option>
                  <option value="primary_5">الصف الخامس الابتدائي</option>
                  <option value="primary_6">الصف السادس الابتدائي</option>
                </optgroup>
                <optgroup label="المرحلة الإعدادية">
                  <option value="prep_1">الصف الأول الإعدادي</option>
                  <option value="prep_2">الصف الثاني الإعدادي</option>
                  <option value="prep_3">الصف الثالث الإعدادي</option>
                </optgroup>
                <optgroup label="المرحلة الثانوية">
                  <option value="sec_1">الصف الأول الثانوي</option>
                  <option value="sec_2">الصف الثاني الثانوي</option>
                  <option value="sec_3">الصف الثالث الثانوي</option>
                </optgroup>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 px-1">{t('password_label')}</label>
            <div className="relative group">
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pr-12 pl-12 py-3.5 bg-white/50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-600 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 dark:text-white placeholder-gray-400 font-medium"
                placeholder={t('password_placeholder')}
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 left-0 pl-4 flex items-center text-gray-400 hover:text-blue-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            
            <AnimatePresence>
              {password && !isPasswordValid && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 text-xs space-y-1.5 px-2 font-medium"
                >
                  <p className={`flex items-center gap-1.5 ${passwordCriteria.length ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {passwordCriteria.length ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    8 أحرف على الأقل
                  </p>
                  <p className={`flex items-center gap-1.5 ${passwordCriteria.uppercase ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {passwordCriteria.uppercase ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    حرف إنجليزي كبير (A-Z)
                  </p>
                  <p className={`flex items-center gap-1.5 ${passwordCriteria.number ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {passwordCriteria.number ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    رقم واحد على الأقل
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 px-1">{t('confirm_password_label')}</label>
            <div className="relative group">
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full pr-12 pl-12 py-3.5 bg-white/50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-600 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 dark:text-white placeholder-gray-400 font-medium"
                placeholder={t('password_placeholder')}
                dir="ltr"
              />
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="mt-2 text-xs text-red-500 px-2 font-bold flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" /> {t('passwords_do_not_match')}
              </p>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 mt-4 py-4 px-4 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white rounded-2xl font-bold text-lg transition-all shadow-xl shadow-blue-600/20 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader className="w-6 h-6 animate-spin" /> : (
              <>
                {t('register_btn')}
                <ArrowRight className="w-5 h-5 rtl:rotate-180" />
              </>
            )}
          </motion.button>
          
          <div className="relative flex items-center justify-center my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-slate-600"></div>
            </div>
            <div className="relative px-4 bg-white/70 dark:bg-slate-800/70 text-sm font-medium text-gray-500 dark:text-gray-400 backdrop-blur-2xl">
              أو
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => loginWithGoogle()}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-200 rounded-2xl font-bold transition-all shadow-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fillRule="evenodd"
                clipRule="evenodd"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            إنشاء حساب باستخدام Google
          </motion.button>
        </form>

        <div className="mt-8 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
          {t('has_account')} {' '}
          <Link to="/login" className="font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors underline decoration-2 underline-offset-4">
            {t('login_link')}
          </Link>
        </div>
      </motion.div>
      </motion.div>
    </div>
  );
}
