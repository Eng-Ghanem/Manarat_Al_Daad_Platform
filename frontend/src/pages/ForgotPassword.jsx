import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Mail, ArrowRight, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error('يرجى إدخال البريد الإلكتروني');
      return;
    }

    setLoading(true);
    try {
      const { error } = await resetPassword(email);
      if (error) throw error;

      toast.success(t('forgot_password_success') || 'تم إرسال رمز الاستعادة بنجاح. يرجى مراجعة بريدك.');
      // Redirect to OTP verification page with type recovery
      navigate(`/verify-otp?email=${encodeURIComponent(email)}&type=recovery`);
    } catch (err) {
      console.error('Forgot password error:', err);
      let errorMessage = 'حدث خطأ أثناء إرسال الكود. يرجى المحاولة لاحقاً.';
      if (err.message && err.message.includes('rate limit')) {
        errorMessage = 'تم تجاوز الحد المسموح. يرجى الانتظار قليلاً.';
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
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-md w-full mx-auto"
    >
      <motion.div variants={itemVariants} className="text-center mb-10">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
          <Mail className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white font-arabic tracking-tight mb-3 drop-shadow-sm">
          {t('forgot_password_title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-300 font-medium px-4">
          {t('forgot_password_subtitle')}
        </p>
      </motion.div>

      <motion.div variants={itemVariants} className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-2xl p-8 rounded-[2rem] shadow-2xl shadow-blue-900/5 border border-white/50 dark:border-slate-700/50">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 px-1">
              {t('email_label') || 'البريد الإلكتروني'}
            </label>
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
                placeholder={t('login_email_placeholder') || 'student@example.com'}
                dir="ltr"
              />
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-4 px-4 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white rounded-2xl font-bold text-lg transition-all shadow-xl shadow-blue-600/20 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader className="w-6 h-6 animate-spin" /> : (
              <>
                {t('forgot_password_btn')}
                <ArrowRight className="w-5 h-5 rtl:rotate-180" />
              </>
            )}
          </motion.button>
        </form>

        <div className="mt-8 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
          <Link to="/login" className="font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors underline decoration-2 underline-offset-4">
            العودة لتسجيل الدخول
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
