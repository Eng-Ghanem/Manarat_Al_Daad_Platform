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
  const { login, updateProfile } = useAuth();
  const navigate = useNavigate();
  
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { data: authData, error } = await login(identifier, password);
      if (error) throw error;
      
      if (authData?.user) {
        let userRole = 'student';
        const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
        
        // Use user email if available, otherwise check if they are already admin in profiles
        const userEmail = authData.user.email;

        // If email matches admin email, ensure they go to admin dashboard
        if (adminEmail && userEmail && userEmail.toLowerCase() === adminEmail.toLowerCase()) {
           userRole = 'admin';
           // Update database to ensure profile reflects admin role so AdminRoute doesn't redirect them
           await updateProfile(authData.user.id, { role: 'admin' });
        } else {
          // Otherwise fetch role from profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', authData.user.id)
            .single();
            
          if (profile?.role) {
            userRole = profile.role;
          }
        }

        toast.success(`أهلاً بك مجدداً في منارة الضاد!`);
        if (userRole === 'admin') {
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
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="max-w-md w-full mx-auto"
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
        </form>

        <div className="mt-8 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
          {t('no_account')} {' '}
          <Link to="/register" className="font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors underline decoration-2 underline-offset-4">
            {t('create_account_link')}
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
