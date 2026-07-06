import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Save, Loader, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import FadeIn from '../components/FadeIn';

export default function Settings() {
  const { t } = useTranslation();
  const { user, profile, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
    } else if (profile) {
      setFullName(profile.full_name || '');
    }
  }, [user, profile, navigate]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    const { error } = await updateProfile(user.id, { full_name: fullName });
    
    setLoading(false);
    if (error) {
      setError(t('settings_update_error'));
    } else {
      setMessage(t('settings_update_success'));
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="mb-6 flex items-center gap-4">
          <Link to="/dashboard" className="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 text-gray-500 hover:text-blue-600 shadow-sm transition-colors border border-gray-100 dark:border-slate-700">
            <ArrowRight className="w-5 h-5 rtl:-scale-x-100" />
          </Link>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white font-arabic tracking-tight">
            {t('settings_title')}
          </h1>
        </div>

        <FadeIn>
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-slate-700/50">
            
            <div className="flex items-center gap-4 mb-8 pb-8 border-b border-gray-100 dark:border-slate-700/50">
              <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center border-4 border-white dark:border-slate-700 shadow-sm">
                <User className="w-10 h-10 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-500 dark:text-gray-400">{t('email_label')}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">{user?.email}</p>
                <span className="inline-block mt-1 px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs font-bold rounded-md">
                  {t('account_active')}
                </span>
              </div>
            </div>

            <form onSubmit={handleUpdate} className="space-y-6">
              
              {message && (
                <div className="p-4 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl text-sm font-bold border border-green-100 dark:border-green-800/50">
                  {message}
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-sm font-bold border border-red-100 dark:border-red-800/50">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('fullname_label')}</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="block w-full px-4 py-3 bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 dark:text-white placeholder-gray-400"
                  placeholder={t('fullname_placeholder')}
                />
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={loading || !fullName}
                  className="flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors disabled:opacity-70 disabled:cursor-not-allowed shadow-md shadow-blue-500/20"
                >
                  {loading ? <Loader className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  <span>{t('settings_save_btn')}</span>
                </button>
              </div>

            </form>

          </div>
        </FadeIn>

      </div>
    </div>
  );
}
