import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Lock, ArrowRight, Loader, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function ResetPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { updatePassword, user } = useAuth();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // If the user isn't logged in, they shouldn't be on the reset password page.
  // The VerifyOTP page logs them in temporarily for the recovery flow.
  useEffect(() => {
    if (!user) {
      toast.error('صلاحية الرابط منتهية. يرجى طلب الرمز مرة أخرى.');
      navigate('/forgot-password');
    }
  }, [user, navigate]);

  const validatePassword = (pass) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(pass);
    const hasLowerCase = /[a-z]/.test(pass);
    const hasNumbers = /\d/.test(pass);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(pass);
    return pass.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error(t('passwords_do_not_match') || 'كلمتا المرور غير متطابقتين');
      return;
    }

    if (!validatePassword(password)) {
      toast.error(t('invalid_password_format'));
      return;
    }

    setLoading(true);
    try {
      const { error } = await updatePassword(password);
      if (error) throw error;

      toast.success(t('reset_password_success') || 'تم تحديث كلمة المرور بنجاح! جاري توجيهك...');
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (err) {
      console.error('Reset password error:', err);
      toast.error('حدث خطأ أثناء تحديث كلمة المرور. يرجى المحاولة لاحقاً.');
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
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-md w-full mx-auto"
    >
      <motion.div variants={itemVariants} className="text-center mb-10">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
          <ShieldCheck className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white font-arabic tracking-tight mb-3 drop-shadow-sm">
          {t('reset_password_title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-300 font-medium px-4">
          {t('reset_password_subtitle')}
        </p>
      </motion.div>

      <motion.div variants={itemVariants} className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-2xl p-8 rounded-[2rem] shadow-2xl shadow-blue-900/5 border border-white/50 dark:border-slate-700/50">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 px-1">
              {t('reset_password_new_label')}
            </label>
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
                placeholder={t('password_placeholder') || '••••••••'}
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
            
            {/* Password rules indicator */}
            <div className="mt-3 text-xs text-right">
              <p className={`flex items-center gap-1 ${password.length >= 8 ? 'text-green-500' : 'text-gray-400'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                8 أحرف على الأقل
              </p>
              <p className={`flex items-center gap-1 ${/[A-Z]/.test(password) && /[a-z]/.test(password) ? 'text-green-500' : 'text-gray-400'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                حروف كبيرة وصغيرة (A-z)
              </p>
              <p className={`flex items-center gap-1 ${/\d/.test(password) && /[!@#$%^&*(),.?":{}|<>]/.test(password) ? 'text-green-500' : 'text-gray-400'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                أرقام ورموز خاصة (@#$)
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 px-1">
              {t('confirm_password_label')}
            </label>
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
                placeholder={t('password_placeholder') || '••••••••'}
                dir="ltr"
              />
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-4 px-4 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white rounded-2xl font-bold text-lg transition-all shadow-xl shadow-blue-600/20 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
          >
            {loading ? <Loader className="w-6 h-6 animate-spin" /> : (
              <>
                {t('reset_password_btn')}
                <ArrowRight className="w-5 h-5 rtl:rotate-180" />
              </>
            )}
          </motion.button>
        </form>
      </motion.div>
    </motion.div>
  );
}
