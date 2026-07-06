import { useTranslation } from 'react-i18next';
import FadeIn from '../components/FadeIn';

export default function Terms() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-gray-100 dark:border-slate-700 p-8 md:p-12">
        <FadeIn>
          <h1 className="text-3xl md:text-5xl font-extrabold text-blue-900 dark:text-blue-400 mb-8 font-arabic text-center">
            {t('footer_terms')}
          </h1>
          
          <div className="space-y-6 text-gray-700 dark:text-gray-300 leading-relaxed text-justify">
            <p>{t('terms_intro')}</p>
            
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-4">{t('terms_t1')}</h2>
            <p>{t('terms_d1')}</p>

            <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-4">{t('terms_t2')}</h2>
            <p>{t('terms_d2')}</p>

            <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-4">{t('terms_t3')}</h2>
            <p>{t('terms_d3')}</p>

            <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-8 mb-4">{t('terms_t4')}</h2>
            <p>{t('terms_d4')}</p>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
