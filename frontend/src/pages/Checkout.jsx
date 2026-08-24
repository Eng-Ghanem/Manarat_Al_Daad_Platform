import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Wallet, Smartphone, UploadCloud, Loader, CheckCircle, ChevronRight, BookOpen, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getDirectImageUrl } from '../utils/helpers';
import FadeIn from '../components/FadeIn';
import BackButton from '../components/BackButton';
import { useAuth } from '../context/AuthContext';

export default function Checkout() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('wallet');
  const [processing, setProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  // Form states
  const [walletNumber, setWalletNumber] = useState('');
  const [instapayNumber, setInstapayNumber] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);

  useEffect(() => {
    fetchCourse();
  }, [courseId]);

  const fetchCourse = async () => {
    try {
      const { data, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();

      if (courseError) throw courseError;
      setCourse(data);
    } catch (err) {
      console.error('Error fetching course:', err);
      setError('حدث خطأ في جلب بيانات الكورس.');
    } finally {
      setLoading(false);
    }
  };

  const handlePaymobCheckout = async () => {
    // TODO: Connect to backend Paymob Integration
    setProcessing(true);
    setTimeout(() => {
      // Simulate successful API call, then redirect
      setProcessing(false);
      alert('تم تجهيز بوابة الدفع (محاكاة). سيتم تحويلك لدفع مبلغ ' + (course.discounted_price || course.price) + ' جنيه.');
    }, 2000);
  };

  const handleEWalletCheckout = async () => {
    if (!walletNumber) {
      alert('يرجى إدخال رقم المحفظة المحول منها.');
      return;
    }
    if (walletNumber.length !== 11 || !/^\d+$/.test(walletNumber)) {
      alert('رقم المحفظة يجب أن يتكون من 11 رقماً.');
      return;
    }
    if (!receiptFile) {
      alert('إيصال التحويل مطلوب لتأكيد الدفع.');
      return;
    }
    
    setProcessing(true);
    try {
      let receiptUrl = null;
      if (receiptFile) {
        const fileExt = receiptFile.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('receipts')
          .upload(fileName, receiptFile);

        if (uploadError) throw uploadError;
        
        const { data: publicUrlData } = supabase.storage
          .from('receipts')
          .getPublicUrl(fileName);
        receiptUrl = publicUrlData.publicUrl;
      }

      const { error: insertError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: user.id,
          course_id: courseId,
          payment_method: 'wallet',
          wallet_number: walletNumber,
          receipt_url: receiptUrl,
          status: 'pending'
        });

      if (insertError) throw insertError;
      setIsSuccess(true);
    } catch (err) {
      console.error('Error submitting subscription:', err);
      alert('حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مرة أخرى.');
    } finally {
      setProcessing(false);
    }
  };

  const handleInstapayCheckout = async () => {
    if (!instapayNumber) {
      alert('يرجى إدخال رقم الموبايل أو عنوان إنستاباي (IPA).');
      return;
    }
    if (!receiptFile) {
      alert('إيصال التحويل مطلوب لتأكيد دفع إنستاباي.');
      return;
    }
    setProcessing(true);
    try {
      const fileExt = receiptFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, receiptFile);

      if (uploadError) throw uploadError;
      
      const { data: publicUrlData } = supabase.storage
        .from('receipts')
        .getPublicUrl(fileName);
      const receiptUrl = publicUrlData.publicUrl;

      const { error: insertError } = await supabase
        .from('subscriptions')
        .insert({
          user_id: user.id,
          course_id: courseId,
          payment_method: 'instapay',
          wallet_number: instapayNumber,
          receipt_url: receiptUrl,
          status: 'pending'
        });

      if (insertError) throw insertError;
      setIsSuccess(true);
    } catch (err) {
      console.error('Error submitting subscription:', err);
      alert('حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مرة أخرى.');
    } finally {
      setProcessing(false);
    }
  };

  const handlePayPalCheckout = async () => {
    // TODO: Connect to PayPal Integration
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      alert('سيتم تحويلك إلى PayPal للدفع بالدولار.');
    }, 2000);
  };

  const handleCheckout = () => {
    if (paymentMethod === 'card') handlePaymobCheckout();
    if (paymentMethod === 'wallet') handleEWalletCheckout();
    if (paymentMethod === 'instapay') handleInstapayCheckout();
    if (paymentMethod === 'paypal') handlePayPalCheckout();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <Loader className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col items-center justify-center p-4 text-center">
        <div className="mb-6"><BackButton /></div>
        <BookOpen className="w-16 h-16 text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{error || 'الكورس غير موجود'}</h2>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pt-28 pb-20 flex items-center justify-center">
        <FadeIn>
          <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-xl border border-gray-100 dark:border-slate-700 text-center">
            <div className="w-24 h-24 bg-green-100 dark:bg-green-900/30 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12" />
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-4 font-arabic">
              تم استلام طلبك بنجاح!
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
              لقد قمنا باستلام بيانات التحويل الخاصة بك. سيتم مراجعة الإيصال من قبل الإدارة وتفعيل اشتراكك في أقرب وقت ممكن.
            </p>
            <Link 
              to="/dashboard"
              className="w-full flex justify-center py-4 px-6 border border-transparent rounded-xl shadow-sm text-lg font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              الذهاب إلى لوحة الطالب
            </Link>
          </div>
        </FadeIn>
      </div>
    );
  }

  const finalPrice = course.discounted_price || course.price;

  const paymentOptions = [
    { id: 'wallet', icon: Smartphone, title: 'المحافظ الإلكترونية', desc: 'فودافون، اتصالات، أورانج، وي كاش', available: true },
    { id: 'instapay', icon: Wallet, title: 'تحويل إنستاباي', desc: 'تحويل بنكي لحظي ورفع الإيصال', available: true },
    { id: 'card', icon: CreditCard, title: 'البطاقة البنكية', desc: 'فيزا أو ماستركارد عبر بوابة آمنة', available: false },
    { id: 'paypal', icon: ShieldCheck, title: 'باي بال (PayPal)', desc: 'للطلاب خارج مصر بالدولار', available: false },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pt-28 pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <BackButton to={`/course/${courseId}`} text="العودة للكورس" />
        </div>

        <FadeIn>
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white font-arabic tracking-tight mb-4">
              إتمام الاشتراك
            </h1>
            <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              اختر وسيلة الدفع المناسبة لك لإتمام عملية الاشتراك والبدء في مشاهدة المحتوى فوراً.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Payment Methods (Left/Main Content, col-span-7) */}
            <div className="lg:col-span-7 space-y-6 order-2 lg:order-1">
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-slate-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-green-500" />
                  طرق الدفع المتاحة
                </h2>
                
                <div className="space-y-4">
                  {paymentOptions.map((option) => {
                    const isSelected = paymentMethod === option.id;
                    const Icon = option.icon;
                    return (
                      <div 
                        key={option.id}
                        onClick={() => setPaymentMethod(option.id)}
                        className={`rounded-2xl border-2 transition-all cursor-pointer overflow-hidden ${isSelected ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-900/10' : 'border-gray-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-slate-600'}`}
                      >
                        <div className="p-4 md:p-5 flex items-center gap-4">
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'border-blue-500' : 'border-gray-300 dark:border-slate-500'}`}>
                            {isSelected && <div className="w-3 h-3 bg-blue-500 rounded-full" />}
                          </div>
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-gray-400'}`}>
                            <Icon className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className={`font-bold ${isSelected ? 'text-blue-700 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>{option.title}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{option.desc}</p>
                          </div>
                        </div>

                        {/* Accordion Content via Framer Motion */}
                        <AnimatePresence>
                          {isSelected && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="px-5 pb-5 pt-2 border-t border-gray-100 dark:border-slate-700/50 mt-2">
                                
                                {option.available === false ? (
                                  <div className="text-sm text-gray-600 dark:text-gray-300 space-y-4">
                                    <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-xl border border-orange-200 dark:border-orange-800/50 text-center font-bold text-orange-700 dark:text-orange-400">
                                      هذه الخدمة ستتوفر قريباً.. يرجى استخدام طرق الدفع الأخرى المتاحة حالياً.
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    {option.id === 'wallet' && (
                                      <div className="space-y-4">
                                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50 text-blue-800 dark:text-blue-300 text-sm leading-relaxed font-arabic mb-4">
                                          <p className="mb-2 font-bold">خطوات الدفع (يدوياً):</p>
                                          <ul className="list-decimal list-inside space-y-1">
                                            <li>قم بتحويل <span className="font-extrabold text-blue-900 dark:text-blue-100">{finalPrice} ج.م</span> إلى الرقم: <span className="font-mono font-bold text-lg mx-1" dir="ltr">01033511516</span></li>
                                            <li>أدخل رقم هاتفك الذي حولت منه بالأسفل، ثم قم برفع صورة عملية التحويل.</li>
                                          </ul>
                                        </div>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">رقم المحفظة المحول منها *</label>
                                        <input 
                                          type="tel"
                                          value={walletNumber}
                                          onChange={(e) => setWalletNumber(e.target.value.replace(/\D/g, ''))}
                                          maxLength={11}
                                          className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 focus:outline-none focus:border-blue-500 text-gray-900 dark:text-white text-left"
                                          placeholder="01xxxxxxxxx"
                                          dir="ltr"
                                        />
                                        <div className="mt-4">
                                          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">صورة الإيصال *</label>
                                          <input type="file" className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-slate-700 dark:file:text-slate-300" accept="image/*" onChange={(e) => setReceiptFile(e.target.files[0])} />
                                        </div>
                                      </div>
                                    )}

                                    {option.id === 'instapay' && (
                                      <div className="space-y-4">
                                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800/50 text-indigo-800 dark:text-indigo-300 text-sm leading-relaxed font-arabic mb-4">
                                          <p className="mb-2 font-bold">تعليمات التحويل اليدوي:</p>
                                          <ul className="list-decimal list-inside space-y-1">
                                            <li>قم بتحويل مبلغ <span className="font-extrabold text-indigo-900 dark:text-indigo-100">{finalPrice} ج.م</span> إلى الرقم: <span className="font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded text-indigo-600 dark:text-indigo-400" dir="ltr">01212651865</span></li>
                                            <li>ارفع صورة الإيصال (Screenshot) لتأكيد الدفع.</li>
                                          </ul>
                                        </div>
                                        
                                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">رقم الموبايل / عنوان إنستاباي (IPA) *</label>
                                        <input 
                                          type="text"
                                          value={instapayNumber}
                                          onChange={(e) => setInstapayNumber(e.target.value)}
                                          className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 focus:outline-none focus:border-indigo-500 text-gray-900 dark:text-white text-left mb-4"
                                          placeholder="رقم الموبايل أو name@instapay"
                                          dir="ltr"
                                        />

                                        <div>
                                          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">إيصال التحويل *</label>
                                          <div className="w-full relative border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl p-4 text-center hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                                            <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*" onChange={(e) => setReceiptFile(e.target.files[0])} />
                                            <div className="flex flex-col items-center justify-center gap-2 text-gray-500">
                                              <UploadCloud className="w-6 h-6" />
                                              <span className="text-sm font-bold">{receiptFile ? receiptFile.name : 'اضغط هنا لرفع صورة الإيصال'}</span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}

                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-8">
                  <button 
                    onClick={handleCheckout}
                    disabled={processing || paymentOptions.find(o => o.id === paymentMethod)?.available === false}
                    className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white rounded-xl font-bold text-lg transition-all shadow-[0_8px_20px_rgb(37,99,235,0.3)] disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {processing ? (
                      <>
                        <Loader className="w-6 h-6 animate-spin" />
                        جاري تجهيز بوابة الدفع...
                      </>
                    ) : (
                      <>
                        تأكيد الدفع ({finalPrice} ج.م)
                      </>
                    )}
                  </button>
                  <p className="text-center text-xs text-gray-500 mt-4 flex items-center justify-center gap-1">
                    <ShieldCheck className="w-4 h-4" />
                    جميع المدفوعات آمنة ومشفرة تماماً.
                  </p>
                </div>
              </div>
            </div>

            {/* Order Summary (Right Column, col-span-5) */}
            <div className="lg:col-span-5 order-1 lg:order-2">
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-md border border-gray-100 dark:border-slate-700 sticky top-28">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 pb-4 border-b border-gray-100 dark:border-slate-700">
                  ملخص الطلب
                </h3>
                
                <div className="flex gap-4 mb-6">
                  <div className="w-24 h-20 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 flex-shrink-0">
                    {course.image_url ? (
                      <img src={getDirectImageUrl(course.image_url)} alt={course.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white text-lg leading-tight mb-2">{course.title}</h4>
                    <span className="inline-block px-2.5 py-1 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg text-xs font-bold">
                      {course.category ? course.category.replace(/-/g, ' ') : ''}
                    </span>
                  </div>
                </div>

                <div className="space-y-4 py-4 border-y border-gray-100 dark:border-slate-700 mb-6">
                  <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                    <span>السعر الأصلي</span>
                    <span className={course.discounted_price ? "line-through text-gray-400" : "font-bold text-gray-900 dark:text-white"}>
                      {course.price} ج.م
                    </span>
                  </div>
                  {course.discounted_price && (
                    <div className="flex justify-between items-center text-green-600 dark:text-green-400 font-bold">
                      <span>الخصم</span>
                      <span>- {course.price - course.discounted_price} ج.م</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center mb-6">
                  <span className="text-xl font-extrabold text-gray-900 dark:text-white">الإجمالي</span>
                  <span className="text-3xl font-extrabold text-blue-700 dark:text-blue-400">{finalPrice} ج.م</span>
                </div>
                
                <div className="bg-gray-50 dark:bg-slate-900/50 rounded-xl p-4 flex items-start gap-3 border border-gray-100 dark:border-slate-700">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-arabic">
                    الاشتراك يمنحك صلاحية للوصول الكامل لجميع دروس ومرفقات الكورس {course.access_duration_days ? `لمدة ${course.access_duration_days} يوماً.` : 'مدى الحياة.'}
                  </p>
                </div>

              </div>
            </div>

          </div>
        </FadeIn>
      </div>
    </div>
  );
}
