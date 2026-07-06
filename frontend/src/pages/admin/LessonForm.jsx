import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { BookOpen, Video, Save, ArrowRight, Loader, FileText, Link as LinkIcon, UploadCloud, FileType2 } from 'lucide-react';
import FadeIn from '../../components/FadeIn';
import BackButton from '../../components/BackButton';

export default function LessonForm() {
  const navigate = useNavigate();
  const { courseId, lessonId } = useParams();
  const isEditing = Boolean(lessonId);
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditing);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    video_url: '',
    pdf_url: '',
    order_index: 1,
    is_free_preview: false
  });

  const [pdfFile, setPdfFile] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isEditing) {
      fetchLesson();
    } else {
      fetchNextOrderIndex();
    }
  }, [lessonId, courseId]);

  const fetchNextOrderIndex = async () => {
    try {
      const { data, error } = await supabase
        .from('lessons')
        .select('order_index')
        .eq('course_id', courseId)
        .order('order_index', { ascending: false })
        .limit(1);
        
      if (data && data.length > 0) {
        setFormData(prev => ({ ...prev, order_index: data[0].order_index + 1 }));
      }
    } catch (err) {
      console.error('Error fetching order index:', err);
    }
  };

  const fetchLesson = async () => {
    try {
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('id', lessonId)
        .single();

      if (error) throw error;
      if (data) {
        setFormData({
          title: data.title,
          description: data.description || '',
          video_url: data.video_url || '',
          pdf_url: data.pdf_url || '',
          order_index: data.order_index,
          is_free_preview: data.is_free_preview || false
        });
      }
    } catch (err) {
      console.error('Error fetching lesson:', err);
      setError('حدث خطأ أثناء جلب بيانات الدرس.');
    } finally {
      setFetching(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handlePdfChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type === 'application/pdf') {
        setPdfFile(file);
      } else {
        alert('يرجى اختيار ملف PDF فقط.');
      }
    }
  };

  const uploadPdf = async () => {
    if (!pdfFile) return formData.pdf_url;
    
    const fileExt = pdfFile.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError, data } = await supabase.storage
      .from('lesson-files')
      .upload(filePath, pdfFile);

    if (uploadError) {
      throw new Error('فشل رفع ملف الـ PDF. تأكد من أنك قمت بتنفيذ سكربت قاعدة البيانات (update_database.sql).');
    }

    const { data: { publicUrl } } = supabase.storage
      .from('lesson-files')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Upload PDF if a new one is selected
      let finalPdfUrl = formData.pdf_url;
      if (pdfFile) {
        finalPdfUrl = await uploadPdf();
      }

      const lessonData = {
        course_id: courseId,
        title: formData.title,
        description: formData.description,
        video_url: formData.video_url,
        pdf_url: finalPdfUrl,
        order_index: Number(formData.order_index),
        is_free_preview: formData.is_free_preview
      };

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('lessons')
          .update(lessonData)
          .eq('id', lessonId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('lessons')
          .insert([lessonData]);
        if (insertError) throw insertError;
      }
      
      navigate(`/admin-dashboard/courses/${courseId}`);
    } catch (err) {
      console.error('Error saving lesson:', err);
      setError(err.message || 'حدث خطأ أثناء حفظ بيانات الدرس.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return <div className="min-h-screen flex items-center justify-center dark:bg-slate-900"><Loader className="w-8 h-8 text-blue-600 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <BackButton to={`/admin-dashboard/courses/${courseId}`} text="العودة للكورس" />
        </div>

        <FadeIn>
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-8 pb-6 border-b border-gray-100 dark:border-slate-700">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Video className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-arabic text-gray-900 dark:text-white">
                  {isEditing ? 'تعديل بيانات الدرس' : 'إضافة درس جديد'}
                </h1>
                <p className="text-gray-500 dark:text-gray-400">أدخل عنوان الدرس ورابط الفيديو وملف الـ PDF.</p>
              </div>
            </div>

            {error && (
              <div className="mb-6 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm font-bold border border-red-200 dark:border-red-800">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">عنوان الدرس *</label>
                <input
                  type="text"
                  name="title"
                  required
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 transition-colors"
                  placeholder="مثال: الدرس الأول - مقدمة في النحو"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">وصف الدرس (اختياري)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-4 pt-3 pointer-events-none text-gray-400">
                    <FileText className="w-5 h-5" />
                  </div>
                  <textarea
                    name="description"
                    rows="3"
                    value={formData.description}
                    onChange={handleChange}
                    className="w-full pr-12 pl-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 transition-colors resize-none"
                    placeholder="اكتب وصفاً مختصراً عما سيتعلمه الطالب في هذا الدرس..."
                  ></textarea>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">رابط الفيديو (اختياري)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400">
                    <LinkIcon className="w-5 h-5" />
                  </div>
                  <input
                    type="url"
                    name="video_url"
                    value={formData.video_url}
                    onChange={handleChange}
                    className="w-full pr-12 pl-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 transition-colors text-left"
                    placeholder="https://www.youtube.com/watch?v=..."
                    dir="ltr"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">يدعم روابط اليوتيوب (YouTube)، وفيميو (Vimeo)، أو أي رابط فيديو مباشر.</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  ملف الشرح (PDF) - اختياري
                </label>
                <div 
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer relative ${pdfFile || formData.pdf_url ? 'border-red-400 bg-red-50/50 dark:bg-red-900/10 dark:border-red-800' : 'border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input 
                    type="file" 
                    accept="application/pdf" 
                    ref={fileInputRef}
                    onChange={handlePdfChange}
                    className="hidden" 
                  />
                  
                  {pdfFile ? (
                    <div className="flex flex-col items-center justify-center py-2">
                      <FileType2 className="w-12 h-12 text-red-500 mb-3" />
                      <p className="text-gray-900 dark:text-white font-bold mb-1" dir="ltr">{pdfFile.name}</p>
                      <p className="text-gray-500 text-sm">تم اختيار الملف بنجاح. اضغط لتغييره.</p>
                    </div>
                  ) : formData.pdf_url ? (
                    <div className="flex flex-col items-center justify-center py-2">
                      <FileType2 className="w-12 h-12 text-red-500 mb-3" />
                      <p className="text-gray-900 dark:text-white font-bold mb-1">يوجد ملف PDF مرفق مسبقاً</p>
                      <p className="text-gray-500 text-sm">اضغط هنا لاستبداله بملف جديد</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-4">
                      <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/30 text-red-500 flex items-center justify-center mb-4">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <p className="text-gray-900 dark:text-white font-bold mb-1">اضغط هنا لرفع ملف PDF</p>
                      <p className="text-gray-500 text-sm">سيتمكن الطلاب من تصفحه وقراءته داخل الكورس.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-gray-100 dark:border-slate-700">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">ترتيب الدرس</label>
                  <input
                    type="number"
                    name="order_index"
                    required
                    min="1"
                    value={formData.order_index}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <p className="text-xs text-gray-500 mt-2">الرقم الذي سيحدد ترتيب الدرس داخل الكورس.</p>
                </div>

                <div className="flex items-center mt-8">
                  <div 
                    className={`w-full p-4 rounded-2xl border-2 transition-all cursor-pointer flex justify-between items-center ${formData.is_free_preview ? 'border-green-500 bg-green-50/50 dark:bg-green-900/20 shadow-[0_0_20px_rgba(34,197,94,0.1)]' : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 hover:border-gray-300 dark:hover:border-slate-600'}`}
                    onClick={() => setFormData(prev => ({...prev, is_free_preview: !prev.is_free_preview}))}
                  >
                    <div>
                      <h4 className={`font-bold text-base transition-colors ${formData.is_free_preview ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        درس مجاني للجميع (Free Preview)
                      </h4>
                    </div>
                    <div className={`relative w-12 h-7 rounded-full transition-colors duration-300 flex items-center px-1 flex-shrink-0 ${formData.is_free_preview ? 'bg-green-500' : 'bg-gray-300 dark:bg-slate-600'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-300 ${formData.is_free_preview ? 'rtl:-translate-x-5 ltr:translate-x-5' : 'translate-x-0'}`}></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100 dark:border-slate-700 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-md active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader className="w-5 h-5 animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  {isEditing ? 'حفظ التعديلات' : 'إضافة الدرس'}
                </button>
              </div>

            </form>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
