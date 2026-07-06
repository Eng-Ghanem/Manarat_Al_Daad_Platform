import { useTranslation } from 'react-i18next';
import { PenTool, Type, MessageCircle } from 'lucide-react';
import FadeIn from '../FadeIn';

export default function FeaturesSection() {
  const { t } = useTranslation();
  
  const features = [
    {
      icon: <Type className="w-8 h-8 text-gold-500" />,
      title: t('feat_nahw_title'),
      desc: t('feat_nahw_desc'),
      delay: 100
    },
    {
      icon: <PenTool className="w-8 h-8 text-blue-500 dark:text-blue-400" />,
      title: t('feat_imla_title'),
      desc: t('feat_imla_desc'),
      delay: 200
    },
    {
      icon: <MessageCircle className="w-8 h-8 text-teal-500" />,
      title: t('feat_balagha_title'),
      desc: t('feat_balagha_desc'),
      delay: 300
    }
  ];

  return (
    <section className="py-24 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="text-center mb-16 relative">
            <h2 className="text-3xl md:text-5xl font-extrabold text-blue-900 dark:text-blue-400 mb-6 font-arabic tracking-tight">
              {t('features_title')}
            </h2>
            <div className="w-24 h-1 bg-gold-500 mx-auto rounded-full mb-6"></div>
            <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
              {t('features_subtitle')}
            </p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feat, idx) => (
            <FadeIn key={idx} delay={feat.delay}>
              <div className="bg-gray-50 dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 group h-full">
                <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-700 shadow-md flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  {feat.icon}
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  {feat.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-lg">
                  {feat.desc}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
