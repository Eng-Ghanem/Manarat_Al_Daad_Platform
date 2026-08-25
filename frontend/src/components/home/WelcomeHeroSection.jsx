import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, GraduationCap, Award, LogIn, UserPlus, Sparkles, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function WelcomeHeroSection() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.8, staggerChildren: 0.15 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
  };

  const floatVariants = {
    animate: {
      y: [0, -15, 0],
      transition: { duration: 3, repeat: Infinity, ease: "easeInOut" }
    }
  };

  return (
    <section className="relative w-full flex items-center justify-center p-4 py-16 lg:py-24 overflow-hidden min-h-[85vh]">
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
        className="max-w-6xl w-full mx-auto relative z-10 grid lg:grid-cols-2 gap-12 items-center"
      >
        {/* Right side (Text & Features) */}
        <div className="text-right flex flex-col justify-center order-2 lg:order-1">
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold text-sm mb-8 w-max border border-blue-100 dark:border-blue-800/50 shadow-sm">
            <Sparkles className="w-4 h-4" />
            <span>منصة تعليمية متطورة</span>
          </motion.div>

          <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-extrabold text-gray-900 dark:text-white font-arabic tracking-tight mb-6 leading-[1.2] drop-shadow-sm">
            مرحباً بك في <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-400 dark:to-blue-600">مَنَارَةُ الضَّادِ</span>
          </motion.h1>

          <motion.p variants={itemVariants} className="text-xl text-gray-600 dark:text-gray-300 font-medium mb-10 leading-relaxed max-w-lg">
            رحلتك لإتقان اللغة العربية تبدأ هنا. منصة تعليمية متكاملة تقدم لك شرحاً مبسطاً، تأسيساً قوياً، ومتابعة مستمرة لضمان تفوقك.
          </motion.p>

          <motion.div variants={itemVariants} className="space-y-5">
            {[
              { icon: BookOpen, text: "شرح مبسط وتأسيس قوي في النحو والإملاء" },
              { icon: ShieldCheck, text: "متابعة دورية وامتحانات لتقييم المستوى" },
              { icon: Award, text: "شهادات معتمدة بعد اجتياز الدورات" }
            ].map((feat, idx) => (
              <div key={idx} className="flex items-center gap-4 text-gray-800 dark:text-gray-200 font-bold text-lg">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-md border border-gray-100 dark:border-slate-700/50">
                  <feat.icon className="w-6 h-6" />
                </div>
                {feat.text}
              </div>
            ))}
          </motion.div>
        </div>

        {/* Left side (Action Card) */}
        <motion.div variants={itemVariants} className="relative w-full max-w-md mx-auto lg:mx-0 order-1 lg:order-2">
          <motion.div 
            variants={floatVariants}
            animate="animate"
            className="absolute -top-6 -right-6 w-24 h-24 bg-gold-400/20 backdrop-blur-3xl rounded-full border border-gold-200/50 shadow-xl z-0 hidden md:block"
          />
          <motion.div 
            variants={floatVariants}
            animate="animate"
            style={{ animationDelay: '1.5s' }}
            className="absolute -bottom-8 -left-8 w-32 h-32 bg-blue-500/20 backdrop-blur-3xl rounded-full border border-blue-200/50 shadow-xl z-0 hidden md:block"
          />

          <div className="relative z-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-2xl p-8 md:p-10 rounded-[2.5rem] shadow-2xl border border-white dark:border-slate-700/50">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-700 dark:to-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-white dark:border-slate-600">
                <GraduationCap className="w-10 h-10 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">
                {user ? 'مرحباً بعودتك!' : 'ابدأ الآن!'}
              </h3>
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                {user ? 'واصل رحلتك التعليمية' : 'انضم إلى آلاف الطلاب في منصتنا'}
              </p>
            </div>

            <div className="space-y-4">
              {user ? (
                <Link to={profile?.role === 'admin' ? '/admin-dashboard' : '/dashboard'} className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white rounded-2xl font-bold text-lg transition-all shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-1 group">
                  <Award className="w-6 h-6" />
                  {profile?.role === 'admin' ? 'لوحة التحكم' : 'الملف الشخصي'}
                  <ArrowRight className="w-5 h-5 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all mr-auto" />
                </Link>
              ) : (
                <>
                  <Link to="/login" className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white rounded-2xl font-bold text-lg transition-all shadow-xl shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-1 group">
                    <LogIn className="w-6 h-6" />
                    تسجيل الدخول
                    <ArrowRight className="w-5 h-5 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all mr-auto" />
                  </Link>
                  
                  <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-gray-200 dark:border-slate-700"></div>
                    <span className="flex-shrink-0 mx-4 text-gray-400 dark:text-gray-500 text-sm font-bold">أو</span>
                    <div className="flex-grow border-t border-gray-200 dark:border-slate-700"></div>
                  </div>

                  <Link to="/register" className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 rounded-2xl font-bold text-lg transition-all hover:-translate-y-1 group">
                    <UserPlus className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    إنشاء حساب جديد
                  </Link>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
