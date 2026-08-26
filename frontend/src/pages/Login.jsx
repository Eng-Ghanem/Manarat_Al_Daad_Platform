import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, Loader, Eye, EyeOff, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export default function Login() {
  const { t } = useTranslation();
  const { login, updateProfile, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const cleanIdentifier = identifier.trim();
      const { data: authData, error } = await login(cleanIdentifier, password);
      if (error) throw error;
      
      if (authData?.user) {
        const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
        const userEmail = authData.user.email;
        let isAdmin = false;

        if (adminEmail && userEmail && userEmail.toLowerCase() === adminEmail.toLowerCase()) {
           isAdmin = true;
           // We don't await updateProfile here to avoid blocking the UI, AuthContext or backend will handle it
           updateProfile(authData.user.id, { role: 'admin' }).catch(console.error);
        }

        toast.success(`أهلاً بك مجدداً في منارة الضاد!`);
        if (isAdmin) {
          navigate('/admin-dashboard');
        } else {
          navigate('/');
        }
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error('Login error:', err);
      let errorMessage = t('login_error') || 'حدث خطأ أثناء تسجيل الدخول.';
      
      if (err) {
        if (typeof err === 'string') {
          errorMessage = err;
        } else if (err.message) {
          errorMessage = typeof err.message === 'string' ? err.message : JSON.stringify(err.message);
        } else if (err.error_description) {
          errorMessage = typeof err.error_description === 'string' ? err.error_description : JSON.stringify(err.error_description);
        } else {
          try {
            const str = JSON.stringify(err);
            if (str !== '{}') errorMessage = str;
          } catch(e) {}
        }
      }
      
      if (errorMessage === '{}' || errorMessage === '"{}"' || errorMessage === '[object Object]') {
        errorMessage = 'حدث خطأ أثناء الاتصال بالخادم. يرجى المحاولة مرة أخرى.';
      }
      
      if (errorMessage.includes('Invalid login credentials')) {
        errorMessage = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
      } else if (errorMessage.toLowerCase().includes('email not confirmed')) {
        toast.error('حسابك غير مفعل بعد. يرجى إدخال رمز التفعيل المرسل إلى بريدك الإلكتروني.');
        navigate(`/verify-otp?email=${encodeURIComponent(identifier.trim())}`);
        setLoading(false);
        return;
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
          {t('login_title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-300 font-medium">
          {t('login_subtitle')}
        </p>
      </motion.div>

      <motion.div variants={itemVariants} className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-2xl p-8 rounded-[2rem] shadow-2xl shadow-blue-900/5 border border-white/50 dark:border-slate-700/50">
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 px-1">
              {t('login_identifier_label')}
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors">
                <User className="w-5 h-5" />
              </div>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="block w-full pr-12 pl-4 py-3.5 bg-white/50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-600 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 dark:text-white placeholder-gray-400 font-medium"
                placeholder={t('login_identifier_placeholder')}
                dir="ltr"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                {t('password_label')}
              </label>
              <Link to="/forgot-password" className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors">
                {t('forgot_password')}
              </Link>
            </div>
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
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 mt-2 py-4 px-4 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white rounded-2xl font-bold text-lg transition-all shadow-xl shadow-blue-600/20 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader className="w-6 h-6 animate-spin" /> : (
              <>
                {t('login_btn')}
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
            تسجيل الدخول باستخدام Google
          </motion.button>
        </form>

        <div className="mt-8 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
          {t('no_account')} {' '}
          <Link to="/register" className="font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors underline decoration-2 underline-offset-4">
            {t('create_account_link')}
          </Link>
        </div>
      </motion.div>
      </motion.div>
    </div>
  );
}
