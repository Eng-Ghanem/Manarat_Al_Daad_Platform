import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function BackButton({ to, text, className = '' }) {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const handleClick = () => {
    if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  };

  const ArrowIcon = isRTL ? ArrowRight : ArrowLeft;

  return (
    <button
      onClick={handleClick}
      className={`group flex items-center gap-3 px-5 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 text-gray-700 dark:text-gray-200 font-bold ${className}`}
    >
      <div className={`relative w-8 h-8 rounded-full bg-gray-50 dark:bg-slate-700/50 flex items-center justify-center overflow-hidden transition-colors group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-blue-400`}>
        {/* Icon that slides in from the opposite side */}
        <ArrowIcon className={`w-4 h-4 absolute transition-all duration-300 transform ${isRTL ? '-translate-x-full opacity-0 group-hover:translate-x-0 group-hover:opacity-100' : 'translate-x-full opacity-0 group-hover:translate-x-0 group-hover:opacity-100'}`} />
        {/* Current icon that slides out */}
        <ArrowIcon className={`w-4 h-4 transition-all duration-300 transform ${isRTL ? 'group-hover:translate-x-full opacity-100 group-hover:opacity-0' : 'group-hover:-translate-x-full opacity-100 group-hover:opacity-0'}`} />
      </div>
      <span>{text || (isRTL ? 'العودة' : 'Back')}</span>
    </button>
  );
}
