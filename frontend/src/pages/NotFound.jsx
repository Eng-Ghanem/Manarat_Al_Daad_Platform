import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import FadeIn from '../components/FadeIn';
import { useTranslation } from 'react-i18next';

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col items-center justify-center relative overflow-hidden px-4">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none"></div>
      
      <FadeIn className="text-center relative z-10">
        <h1 className="text-9xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-gold-500 font-arabic mb-4">
          404
        </h1>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white font-arabic mb-4">
          {t('nf_title')}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
          {t('nf_desc')}
        </p>
        
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold text-lg transition-colors shadow-lg shadow-blue-500/30"
        >
          <Home className="w-5 h-5" />
          {t('nf_back')}
        </Link>
      </FadeIn>
    </div>
  );
}
