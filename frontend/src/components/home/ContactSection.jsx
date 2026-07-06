import { useTranslation } from 'react-i18next';
import FadeIn from '../FadeIn';
import { MessageCircle, Phone } from 'lucide-react';

const FacebookIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

export default function ContactSection() {
  const { t } = useTranslation();

  return (
    <section id="contact" className="py-24 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 relative overflow-hidden">
      <div className="absolute inset-0 bg-arabic-pattern opacity-[0.03] dark:opacity-[0.02]"></div>
      
      {/* Decorative Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[20rem] bg-blue-500/5 dark:bg-blue-400/5 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <FadeIn>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold text-blue-900 dark:text-blue-400 mb-6 font-arabic tracking-tight">
              {t('contact_teacher_title')}
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-gold-400 to-gold-600 mx-auto rounded-full mb-6 shadow-sm shadow-gold-500/30"></div>
            <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
              {t('contact_desc')}
            </p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          
          {/* WhatsApp Card */}
          <FadeIn delay={100}>
            <a 
              href="https://wa.me/201033511516" 
              target="_blank" 
              rel="noopener noreferrer"
              className="group flex flex-col items-center justify-center gap-4 p-8 bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl border border-gray-200 dark:border-slate-700/50 rounded-[2rem] transition-all duration-500 hover:border-[#25D366] hover:bg-green-50 dark:hover:bg-[#25D366]/10 hover:shadow-[0_0_30px_rgba(37,211,102,0.2)] hover:-translate-y-2 h-full"
            >
              <div className="w-20 h-20 rounded-3xl bg-gray-50 dark:bg-slate-700/50 flex items-center justify-center transition-all duration-500 group-hover:bg-[#25D366] group-hover:scale-110 group-hover:rotate-6 shadow-inner">
                <MessageCircle className="w-10 h-10 text-gray-400 dark:text-gray-300 group-hover:text-white transition-colors duration-500" />
              </div>
              <span className="font-bold text-xl text-gray-800 dark:text-gray-200 group-hover:text-[#25D366] transition-colors">
                {t('whatsapp')}
              </span>
            </a>
          </FadeIn>

          {/* Facebook Card */}
          <FadeIn delay={200}>
            <a 
              href="https://www.facebook.com/share/1CskWTtXqm/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="group flex flex-col items-center justify-center gap-4 p-8 bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl border border-gray-200 dark:border-slate-700/50 rounded-[2rem] transition-all duration-500 hover:border-[#1877F2] hover:bg-blue-50 dark:hover:bg-[#1877F2]/10 hover:shadow-[0_0_30px_rgba(24,119,242,0.2)] hover:-translate-y-2 h-full"
            >
              <div className="w-20 h-20 rounded-3xl bg-gray-50 dark:bg-slate-700/50 flex items-center justify-center transition-all duration-500 group-hover:bg-[#1877F2] group-hover:scale-110 group-hover:-rotate-6 shadow-inner">
                <FacebookIcon className="w-10 h-10 text-gray-400 dark:text-gray-300 group-hover:text-white transition-colors duration-500" />
              </div>
              <span className="font-bold text-xl text-gray-800 dark:text-gray-200 group-hover:text-[#1877F2] transition-colors">
                {t('facebook')}
              </span>
            </a>
          </FadeIn>

          {/* Phone Card */}
          <FadeIn delay={300}>
            <a 
              href="tel:+201033511516" 
              className="group flex flex-col items-center justify-center gap-4 p-8 bg-white/70 dark:bg-slate-800/60 backdrop-blur-xl border border-gray-200 dark:border-slate-700/50 rounded-[2rem] transition-all duration-500 hover:border-gold-500 hover:bg-gold-50 dark:hover:bg-gold-500/10 hover:shadow-[0_0_30px_rgba(234,179,8,0.2)] hover:-translate-y-2 h-full"
            >
              <div className="w-20 h-20 rounded-3xl bg-gray-50 dark:bg-slate-700/50 flex items-center justify-center transition-all duration-500 group-hover:bg-gold-500 group-hover:scale-110 group-hover:rotate-12 shadow-inner">
                <Phone className="w-10 h-10 text-gray-400 dark:text-gray-300 group-hover:text-white transition-colors duration-500" />
              </div>
              <span className="font-bold text-xl text-gray-800 dark:text-gray-200 group-hover:text-gold-600 dark:group-hover:text-gold-400 transition-colors">
                {t('phone_number')}
              </span>
              <span className="text-gray-500 dark:text-gray-400 mt-[-8px] group-hover:text-gold-500 transition-colors inline-block" dir="ltr" style={{ direction: 'ltr', unicodeBidi: 'plaintext' }}>
                <bdi>+20 10 33511516</bdi>
              </span>
            </a>
          </FadeIn>

        </div>
      </div>
    </section>
  );
}
