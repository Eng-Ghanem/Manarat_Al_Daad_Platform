import { useTranslation } from 'react-i18next';
import { Award, Layers, Users, BookOpen } from 'lucide-react';
import FadeIn from '../FadeIn';

export default function AboutTeacherSection() {
  const { t } = useTranslation();

  return (
    <section className="py-24 bg-gray-50 dark:bg-slate-900/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-slate-800 rounded-[3rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-slate-700 relative">
          
          <div className="absolute top-0 right-0 w-64 h-64 bg-arabic-pattern opacity-10 rtl:rotate-180"></div>
          
          <div className="p-8 md:p-16 lg:p-20 relative z-10">
            <FadeIn>
              <div className="flex items-center space-x-4 rtl:space-x-reverse mb-8">
                <div className="w-12 h-1 bg-gold-500 rounded-full"></div>
                <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900 dark:text-white">
                  {t('about_teacher_title')}
                </h2>
              </div>
            </FadeIn>
            
            <FadeIn delay={150}>
              <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-8">
                {t('hero_subtitle')}
              </h3>
            </FadeIn>
            
            <FadeIn delay={250}>
              <p className="text-lg md:text-2xl text-gray-700 dark:text-gray-300 leading-loose text-justify font-medium mb-16">
                {t('teacher_bio_full')}
              </p>
            </FadeIn>

            <FadeIn delay={350}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-10 border-t border-gray-100 dark:border-slate-700">
                <div className="flex items-center space-x-4 rtl:space-x-reverse group">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-slate-700 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Award className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="font-bold text-lg text-gray-800 dark:text-gray-200">{t('badge_exp')}</span>
                </div>
                <div className="flex items-center space-x-4 rtl:space-x-reverse group">
                  <div className="w-14 h-14 rounded-2xl bg-gold-50 dark:bg-slate-700 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <BookOpen className="w-7 h-7 text-gold-600 dark:text-gold-400" />
                  </div>
                  <span className="font-bold text-lg text-gray-800 dark:text-gray-200">{t('badge_degree')}</span>
                </div>
                <div className="flex items-center space-x-4 rtl:space-x-reverse group">
                  <div className="w-14 h-14 rounded-2xl bg-teal-50 dark:bg-slate-700 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Layers className="w-7 h-7 text-teal-600 dark:text-teal-400" />
                  </div>
                  <span className="font-bold text-lg text-gray-800 dark:text-gray-200">{t('badge_found')}</span>
                </div>
                <div className="flex items-center space-x-4 rtl:space-x-reverse group">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-slate-700 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Users className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <span className="font-bold text-lg text-gray-800 dark:text-gray-200">{t('badge_stages')}</span>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </div>
    </section>
  );
}
