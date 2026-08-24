import { useTranslation } from 'react-i18next';
import { Award, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import FadeIn from '../components/FadeIn';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';

export default function Certificates() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [certificates, setCertificates] = useState([]); // This would fetch from DB in future
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 text-gray-500 hover:text-blue-600 shadow-sm transition-colors border border-gray-100 dark:border-slate-700">
              <ArrowRight className="w-5 h-5 rtl:-scale-x-100" />
            </Link>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white font-arabic tracking-tight">
              شهاداتي
            </h1>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : certificates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {certificates.map((cert) => (
              <FadeIn key={cert.id}>
                <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-md border border-gray-100 dark:border-slate-700 hover:border-blue-300 transition-colors">
                  <div className="w-16 h-16 bg-gold-50 dark:bg-gold-900/30 rounded-full flex items-center justify-center mb-4 text-gold-500">
                    <Award className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{cert.courseName}</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">تاريخ الإصدار: {new Date(cert.date).toLocaleDateString('ar-EG')}</p>
                  <button className="w-full py-2 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 font-bold rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
                    عرض الشهادة
                  </button>
                </div>
              </FadeIn>
            ))}
          </div>
        ) : (
          <FadeIn>
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col items-center justify-center">
              <div className="w-24 h-24 bg-gray-50 dark:bg-slate-700 rounded-full flex items-center justify-center mb-6 text-gray-300 dark:text-gray-500">
                <Award className="w-12 h-12" />
              </div>
              <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white font-arabic mb-4">لا توجد شهادات حتى الآن</h3>
              <p className="text-lg text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-8 leading-relaxed">
                لم تحصل على أي شهادات بعد. استمر في التعلم وإكمال الكورسات لتحصل على شهادات إتمام معتمدة يمكنك مشاركتها!
              </p>
              <Link 
                to="/courses"
                className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
              >
                تصفح الكورسات المتاحة
              </Link>
            </div>
          </FadeIn>
        )}

      </div>
    </div>
  );
}
