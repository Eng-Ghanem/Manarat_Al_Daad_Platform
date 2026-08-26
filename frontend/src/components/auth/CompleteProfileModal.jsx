import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Loader, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

export default function CompleteProfileModal() {
  const { user, profile, updateProfile, loading: authLoading } = useAuth();
  const { t } = useTranslation();

  const [phone, setPhone] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [gender, setGender] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Conditions to show the modal:
  // 1. User is authenticated
  // 2. Profile is loaded
  // 3. User is NOT an admin
  // 4. Either phone_number or grade_level or gender is missing
  const isProfileIncomplete = user && profile && profile.role !== 'admin' && (!profile.phone_number || !profile.grade_level || !profile.gender);

  if (authLoading || !isProfileIncomplete) {
    return null; // Don't render anything if profile is complete or loading
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate phone (e.g. 11 digits for Egypt)
      const cleanPhone = phone.trim();
      if (!cleanPhone || cleanPhone.length < 10) {
        throw new Error('يرجى إدخال رقم هاتف صحيح');
      }

      if (!gender) {
        throw new Error('يرجى تحديد النوع');
      }

      if (!gradeLevel) {
        throw new Error('يرجى اختيار الصف الدراسي');
      }

      const { error: updateError } = await updateProfile(user.id, {
        phone_number: cleanPhone,
        grade_level: gradeLevel,
        gender: gender,
      });

      if (updateError) throw updateError;
      toast.success('تم استكمال بياناتك بنجاح!');
    } catch (err) {
      console.error('Error completing profile:', err);
      setError(err.message || 'حدث خطأ أثناء حفظ البيانات');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-50 dark:bg-slate-900 p-4 rtl overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-lg p-8 border border-gray-100 dark:border-slate-700 animate-in fade-in zoom-in duration-300 my-8">
        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white font-arabic mb-4">خطوة أخيرة هامة!</h2>
          <p className="text-gray-600 dark:text-gray-300 text-lg leading-relaxed">
            مرحباً بك في منصة منارة الضاد. لتتمكن من تصفح الكورسات والمنصة، 
            <span className="font-bold text-red-500 mx-1">يجب</span> 
            إكمال البيانات التالية لتأمين حسابك وتخصيص تجربتك.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl text-sm font-bold text-center border border-red-200 dark:border-red-800/50">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Phone Number */}
          <div>
            <label className="block text-base font-bold text-gray-700 dark:text-gray-300 mb-2 px-1">
              رقم الهاتف <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => {
                let val = e.target.value;
                const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
                val = val.replace(/[٠-٩]/g, (d) => arabicNumbers.indexOf(d));
                val = val.replace(/\D/g, '');
                if (val.length <= 11) setPhone(val);
              }}
              className="block w-full px-5 py-4 bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-600 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 dark:text-white text-lg"
              placeholder="مثال: 01012345678"
              dir="ltr"
            />
          </div>

          {/* Gender */}
          <div>
            <label className="block text-base font-bold text-gray-700 dark:text-gray-300 mb-2 px-1">
              النوع <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className={`cursor-pointer flex items-center justify-center p-4 rounded-2xl border-2 transition-all ${gender === 'male' ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-bold shadow-md shadow-blue-500/10' : 'border-transparent bg-gray-100/80 dark:bg-slate-900/80 text-gray-500 hover:bg-gray-200/80 dark:hover:bg-slate-800'}`}>
                <input type="radio" name="gender" value="male" className="sr-only" checked={gender === 'male'} onChange={(e) => setGender(e.target.value)} />
                ذكر
              </label>
              <label className={`cursor-pointer flex items-center justify-center p-4 rounded-2xl border-2 transition-all ${gender === 'female' ? 'border-pink-600 bg-pink-50/80 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400 font-bold shadow-md shadow-pink-500/10' : 'border-transparent bg-gray-100/80 dark:bg-slate-900/80 text-gray-500 hover:bg-gray-200/80 dark:hover:bg-slate-800'}`}>
                <input type="radio" name="gender" value="female" className="sr-only" checked={gender === 'female'} onChange={(e) => setGender(e.target.value)} />
                أنثى
              </label>
            </div>
          </div>

          {/* Grade Level */}
          <div>
            <label className="block text-base font-bold text-gray-700 dark:text-gray-300 mb-2 px-1">
              الصف الدراسي <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={gradeLevel}
              onChange={(e) => setGradeLevel(e.target.value)}
              className="block w-full px-5 py-4 bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-600 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-900 dark:text-white text-lg"
            >
              <option value="">اختر الصف الدراسي...</option>
              <optgroup label="المرحلة الابتدائية">
                <option value="primary_1">الصف الأول الابتدائي</option>
                <option value="primary_2">الصف الثاني الابتدائي</option>
                <option value="primary_3">الصف الثالث الابتدائي</option>
                <option value="primary_4">الصف الرابع الابتدائي</option>
                <option value="primary_5">الصف الخامس الابتدائي</option>
                <option value="primary_6">الصف السادس الابتدائي</option>
              </optgroup>
              <optgroup label="المرحلة الإعدادية">
                <option value="prep_1">الصف الأول الإعدادي</option>
                <option value="prep_2">الصف الثاني الإعدادي</option>
                <option value="prep_3">الصف الثالث الإعدادي</option>
              </optgroup>
              <optgroup label="المرحلة الثانوية">
                <option value="sec_1">الصف الأول الثانوي</option>
                <option value="sec_2">الصف الثاني الثانوي</option>
                <option value="sec_3">الصف الثالث الثانوي</option>
              </optgroup>
            </select>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-4 px-4 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white rounded-2xl font-bold text-xl transition-all shadow-xl shadow-blue-600/20 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? <Loader className="w-8 h-8 animate-spin" /> : "حفظ الدخول للمنصة"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
