import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { KeyRound, ArrowRight, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export default function VerifyOTP() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { verifyOtp, updateProfile } = useAuth();
  
  const email = searchParams.get('email');
  const type = searchParams.get('type') || 'signup'; // signup or recovery

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!email) {
      navigate('/login');
    }
  }, [email, navigate]);

  const handleChange = (e) => {
    const val = e.target.value.replace(/\D/g, ''); // Allow only numbers
    setOtp(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (otp.length < 6) {
      toast.error('يرجى إدخال الكود كاملاً (6 أو 8 أرقام).');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await verifyOtp(email, otp, type);
      
      if (error) throw error;

      if (type === 'recovery') {
        toast.success(t('verify_otp_sent') || 'تم تأكيد الكود بنجاح.');
        navigate('/reset-password');
      } else {
        // Signup flow
        let userRole = 'student';
        const adminEmail = import.meta.env.VITE_ADMIN_EMAIL;
        
        if (adminEmail && email.toLowerCase() === adminEmail.toLowerCase() && data?.user) {
           userRole = 'admin';
           await updateProfile(data.user.id, { role: 'admin' });
        } else if (data?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .single();
          if (profile?.role) userRole = profile.role;
        }

        toast.success('تمت عملية التحقق بنجاح! أهلاً بك في منارة الضاد.');
        if (userRole === 'admin') {
          navigate('/admin-dashboard');
        } else {
          navigate('/');
        }
      }
    } catch (err) {
      console.error('Verify OTP error:', err);
      let errorMessage = 'الكود الذي أدخلته غير صحيح أو منتهي الصلاحية.';
      if (err.message && err.message.includes('rate limit')) {
        errorMessage = 'تجاوزت الحد المسموح. يرجى الانتظار قليلاً.';
      }
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      // Supabase signInWithOtp or resend function
      // If it's signup, we can call resend
      const { error } = await supabase.auth.resend({
        type: type,
        email: email,
      });
      if (error) throw error;
      toast.success(t('verify_otp_sent'));
    } catch (err) {
      console.error('Resend OTP error:', err);
      toast.error('حدث خطأ أثناء إرسال الكود مجدداً.');
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
          <KeyRound className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white font-arabic tracking-tight mb-3 drop-shadow-sm">
          {t('verify_otp_title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-300 font-medium">
          {t('verify_otp_subtitle')}
          <br />
          <span className="font-bold text-blue-600 dark:text-blue-400 mt-1 block" dir="ltr">{email}</span>
        </p>
      </motion.div>

      <motion.div variants={itemVariants} className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-2xl p-8 rounded-[2rem] shadow-2xl shadow-blue-900/5 border border-white/50 dark:border-slate-700/50">
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="flex justify-center" dir="ltr">
            <input
              type="text"
              inputMode="numeric"
              maxLength={8}
              value={otp}
              onChange={handleChange}
              placeholder="123456"
              className="w-full max-w-[300px] h-16 text-center text-3xl font-bold tracking-[0.5em] bg-white/50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-600 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 dark:text-white"
            />
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
                {t('verify_otp_btn')}
                <ArrowRight className="w-5 h-5 rtl:rotate-180" />
              </>
            )}
          </motion.button>
        </form>

        <div className="mt-8 text-center text-sm font-medium text-gray-500 dark:text-gray-400">
          لم يصلك الكود؟ {' '}
          <button 
            onClick={handleResend}
            className="font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors underline decoration-2 underline-offset-4"
          >
            {t('verify_otp_resend')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
