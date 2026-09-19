import { useTranslation } from 'react-i18next';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import FadeIn from '../FadeIn';

export default function HeroSection() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  return (
    <section className="relative overflow-hidden w-full min-h-[85vh] flex items-center justify-center py-16">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-arabic-pattern opacity-60"></div>
      
      {/* Gradient Blurs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
        <div className="absolute top-[-10%] right-[-5%] w-[40rem] h-[40rem] rounded-full bg-blue-100/40 dark:bg-blue-900/20 blur-3xl opacity-50"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[30rem] h-[30rem] rounded-full bg-gold-400/20 dark:bg-gold-600/10 blur-3xl opacity-50"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
          
          {/* Text Content */}
          <div className="w-full lg:w-1/2 flex flex-col space-y-8 order-2 lg:order-1 text-center lg:text-start">
            <FadeIn>
              <div className="inline-flex items-center space-x-2 rtl:space-x-reverse px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium text-sm mb-4 border border-blue-100 dark:border-blue-800/50 shadow-sm">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                </span>
                <span>{t('platform_badge')}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl lg:leading-[1.3] font-bold text-gray-900 dark:text-white leading-snug font-arabic">
                {t('home_hero_title')}
              </h1>
            </FadeIn>
            
            <FadeIn delay={200}>
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-6 w-full">
                <Link 
                  to="/classes" 
                  className="group relative flex items-center justify-center w-[90%] sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white rounded-2xl font-bold text-lg transition-all duration-300 shadow-[0_8px_30px_rgb(37,99,235,0.2)] hover:shadow-[0_8px_30px_rgb(37,99,235,0.4)] hover:-translate-y-1 overflow-hidden border border-blue-500/20"
                >
                  <div className="absolute inset-0 bg-white/20 group-hover:translate-x-full transition-transform duration-500 -skew-x-12 -translate-x-full"></div>
                  <span className="relative z-10 flex items-center gap-3">
                    {t('btn_primary_hero')}
                    <ArrowLeft className={`w-5 h-5 transition-transform duration-300 ${isRTL ? 'group-hover:-translate-x-2' : 'group-hover:translate-x-2 rotate-180'}`} />
                  </span>
                </Link>
                
                <button 
                  onClick={() => {
                    const contactSection = document.getElementById('contact');
                    if (contactSection) {
                      contactSection.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className="group flex items-center justify-center w-[90%] sm:w-auto px-8 py-4 bg-transparent border-2 border-blue-600 dark:border-blue-500 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-2xl font-bold text-lg transition-all duration-300 shadow-sm hover:shadow-lg hover:-translate-y-1 cursor-pointer"
                >
                  {t('btn_contact_us')}
                </button>
              </div>
            </FadeIn>
          </div>

          {/* Image Content */}
          <div className="w-full lg:w-1/2 flex justify-center items-center order-1 lg:order-2">
            <FadeIn delay={300} className="w-full flex justify-center">
              <div className="relative group max-w-[22rem] sm:max-w-md w-full">
                {/* Decorative background blobs */}
                <div className="absolute -inset-4 bg-gradient-to-tr from-blue-600/20 to-gold-400/20 rounded-[3rem] blur-2xl group-hover:blur-3xl transition-all duration-500 opacity-70 group-hover:opacity-100"></div>
                
                <div className="relative z-10 transition-transform duration-500 group-hover:scale-[1.02]">
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-blue-600 to-gold-400 opacity-20 dark:opacity-40 mix-blend-overlay"></div>
                  <img 
                    src="/teacher.jpeg" 
                    alt={t('hero_subtitle')}
                    className="w-full h-auto object-cover rounded-3xl shadow-2xl border-[6px] border-white dark:border-slate-800 bg-white dark:bg-slate-800 aspect-[3/4]"
                    onError={(e) => {
                      e.target.src = 'https://via.placeholder.com/600x800.png?text=Teacher+Image';
                    }}
                  />
                  {/* Floating Badge */}
                  <div className="absolute -bottom-4 right-1 rtl:right-auto rtl:left-1 sm:-bottom-6 sm:-right-6 sm:rtl:right-auto sm:rtl:-left-6 bg-white dark:bg-slate-800 p-3 sm:p-4 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-700 animate-bounce" style={{animationDuration: '3s'}}>
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gold-100 dark:bg-gold-900/30 flex items-center justify-center">
                        <span className="text-gold-600 dark:text-gold-400 font-bold text-lg sm:text-xl">+10</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-gray-900 dark:text-white font-bold text-sm leading-tight">{t('years_of')}</span>
                        <span className="text-gray-500 dark:text-gray-400 text-xs">{t('exp_and_excellence')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>

        </div>
      </div>
    </section>
  );
}
