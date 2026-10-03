import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { BookOpen, Image as ImageIcon, Tag, DollarSign, Clock, Save, ArrowRight, Loader, UploadCloud } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import FadeIn from '../../components/FadeIn';
import BackButton from '../../components/BackButton';

export default function CourseForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditing);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    price: 0,
    discounted_price: 0,
    access_duration_days: '',
    image_url: '',
    is_published: false
  });

  const [courseType, setCourseType] = useState('foundation'); // 'foundation' or 'grades'
  const [stage, setStage] = useState('primary');
  const [grade, setGrade] = useState('1');
  const [term, setTerm] = useState('1');

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isEditing) {
      fetchCourse();
    }
  }, [id]);

  const fetchCourse = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        setFormData({
          title: data.title,
          description: data.description || '',
          category: data.category || '',
          price: data.price || 0,
          discounted_price: data.discounted_price || 0,
          access_duration_days: data.access_duration_days || '',
          image_url: data.image_url || '',
          is_published: data.is_published || false
        });
        if (data.image_url) {
          setImagePreview(data.image_url);
        }
        
        // Parse category
        if (data.category && data.category !== 'كورسات-تأسيسية') {
          // Check if it's the new format: stage-grade-term-X
          const parts = data.category.split('-');
          if (parts.length >= 4 && parts[2] === 'term') {
            setCourseType('grades');
            setStage(parts[0]);
            setGrade(parts[1]);
            setTerm(parts[3]);
          } else if (parts.length === 2 && ['sec', 'prep', 'primary'].includes(parts[0])) {
            setCourseType('grades');
            setStage(parts[0]);
            setGrade(parts[1]);
          } else {
            // Fallback for old categories
            setCourseType('grades');
          }
        } else {
          setCourseType('foundation');
        }
      }
    } catch (err) {
      console.error('Error fetching course:', err);
      setError(t('admin_error_fetch_course'));
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

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
        break;
      }
    }
  };

  const uploadImage = async () => {
    if (!imageFile) return formData.image_url;
    
    const fileExt = imageFile.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError, data } = await supabase.storage
      .from('course-images')
      .upload(filePath, imageFile);

    if (uploadError) {
      throw new Error(t('admin_upload_failed'));
    }

    const { data: { publicUrl } } = supabase.storage
      .from('course-images')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Upload image if a new one is selected
      let finalImageUrl = formData.image_url;
      if (imageFile) {
        finalImageUrl = await uploadImage();
      }

      // 2. Format Category
      let finalCategory = 'كورسات-تأسيسية';
      if (courseType === 'grades') {
        if (stage === 'sec' && grade === '3') {
          finalCategory = `${stage}-${grade}`;
        } else {
          finalCategory = `${stage}-${grade}-term-${term}`;
        }
      }

      const courseData = {
        title: formData.title,
        description: formData.description,
        category: finalCategory,
        price: Number(formData.price),
        discounted_price: formData.discounted_price ? Number(formData.discounted_price) : null,
        access_duration_days: formData.access_duration_days ? Number(formData.access_duration_days) : null,
        image_url: finalImageUrl,
        is_published: formData.is_published
      };

      let newCourseId = id;

      if (isEditing) {
        const { error: updateError } = await supabase
          .from('courses')
          .update(courseData)
          .eq('id', id);
        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from('courses')
          .insert([courseData])
          .select()
          .single();
        if (insertError) throw insertError;
        newCourseId = data.id;
      }
      
      // Navigate to the course details page
      navigate(`/admin-dashboard/courses/${newCourseId}`);
    } catch (err) {
      console.error('Error saving course:', err);
      setError(err.message || t('admin_save_error'));
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return <div className="min-h-screen flex items-center justify-center dark:bg-slate-900"><Loader className="w-8 h-8 text-blue-600 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <BackButton to={isEditing ? `/admin-dashboard/courses/${id}` : '/admin-dashboard'} text={t('admin_back')} />
        </div>

        <FadeIn>
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-8 pb-6 border-b border-gray-100 dark:border-slate-700">
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-arabic text-gray-900 dark:text-white">
                  {isEditing ? t('admin_edit_course') : t('admin_add_new_course')}
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                  {isEditing ? t('admin_edit_course_desc') : t('admin_add_course_desc')}
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-6 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm font-bold border border-red-200 dark:border-red-800">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('admin_course_title')}</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <input
                      type="text"
                      name="title"
                      required
                      value={formData.title}
                      onChange={handleChange}
                      className="block w-full pr-12 pl-4 py-3 bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors dark:text-white"
                      placeholder={t('admin_course_title_ph')}
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('admin_course_desc')}</label>
                  <textarea
                    name="description"
                    rows="3"
                    value={formData.description}
                    onChange={handleChange}
                    className="block w-full px-4 py-3 bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors dark:text-white resize-none"
                    placeholder={t('admin_course_desc_ph')}
                  ></textarea>
                </div>

                <div className="md:col-span-2 space-y-4">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    {t('admin_course_type')}
                  </label>
                  
                  <div className="flex gap-4">
                    <button type="button" onClick={() => setCourseType('foundation')} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all ${courseType === 'foundation' ? 'bg-blue-600 text-white shadow-md border-transparent' : 'bg-white text-gray-600 dark:bg-slate-800 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700'}`}>{t('admin_foundation_courses')}</button>
                    <button type="button" onClick={() => setCourseType('grades')} className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all ${courseType === 'grades' ? 'bg-blue-600 text-white shadow-md border-transparent' : 'bg-white text-gray-600 dark:bg-slate-800 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700'}`}>{t('admin_school_grades')}</button>
                  </div>

                  {courseType === 'grades' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 p-5 bg-gray-50 dark:bg-slate-900/50 rounded-xl border border-gray-200 dark:border-slate-700">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">{t('admin_school_stage')}</label>
                        <select value={stage} onChange={(e) => { setStage(e.target.value); setGrade('1'); }} className="block w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white">
                          <option value="primary">{t('admin_primary')}</option>
                          <option value="prep">{t('admin_prep')}</option>
                          <option value="sec">{t('admin_sec')}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">{t('admin_grade')}</label>
                        <select value={grade} onChange={(e) => setGrade(e.target.value)} className="block w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white">
                          {stage === 'primary' && (
                            <>
                              <option value="1">{t('admin_grade_1')}</option>
                              <option value="2">{t('admin_grade_2')}</option>
                              <option value="3">{t('admin_grade_3')}</option>
                              <option value="4">{t('admin_grade_4')}</option>
                              <option value="5">{t('admin_grade_5')}</option>
                              <option value="6">{t('admin_grade_6')}</option>
                            </>
                          )}
                          {(stage === 'prep' || stage === 'sec') && (
                            <>
                              <option value="1">{t('admin_grade_1')}</option>
                              <option value="2">{t('admin_grade_2')}</option>
                              <option value="3">{t('admin_grade_3')}</option>
                            </>
                          )}
                        </select>
                      </div>
                      {!(stage === 'sec' && grade === '3') && (
                        <div>
                          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-2">{t('admin_term')}</label>
                          <select value={term} onChange={(e) => setTerm(e.target.value)} className="block w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white">
                            <option value="1">{t('admin_term_1')}</option>
                            <option value="2">{t('admin_term_2')}</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    {t('admin_base_price')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <input
                      type="number"
                      name="price"
                      min="0"
                      required
                      value={formData.price}
                      onChange={handleChange}
                      className="block w-full pr-12 pl-4 py-3 bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors dark:text-white"
                      placeholder={t('admin_base_price_ph')}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    {t('admin_discount_price')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-green-500">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <input
                      type="number"
                      name="discounted_price"
                      min="0"
                      value={formData.discounted_price}
                      onChange={handleChange}
                      className="block w-full pr-12 pl-4 py-3 bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors dark:text-white"
                      placeholder={t('admin_discount_price_ph')}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    {t('admin_duration_days')}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400">
                      <Clock className="w-5 h-5" />
                    </div>
                    <input
                      type="number"
                      name="access_duration_days"
                      min="1"
                      value={formData.access_duration_days}
                      onChange={handleChange}
                      className="block w-full pr-12 pl-4 py-3 bg-gray-50 dark:bg-slate-900/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors dark:text-white"
                      placeholder={t('admin_duration_days_ph')}
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                    {t('admin_cover_image')}
                  </label>
                  <div 
                    className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl p-6 text-center hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer relative"
                    onPaste={handlePaste}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input 
                      type="file" 
                      accept="image/*" 
                      ref={fileInputRef}
                      onChange={handleImageChange}
                      className="hidden" 
                    />
                    
                    {imagePreview ? (
                      <div className="relative w-full h-48 rounded-lg overflow-hidden">
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <span className="text-white font-bold flex items-center gap-2"><UploadCloud /> {t('admin_change_image')}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6">
                        <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-500 flex items-center justify-center mb-4">
                          <ImageIcon className="w-8 h-8" />
                        </div>
                        <p className="text-gray-900 dark:text-white font-bold mb-1">{t('admin_click_to_select_image')}</p>
                        <p className="text-gray-500 text-sm">{t('admin_or_paste_image')}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div 
                  className={`md:col-span-2 p-5 rounded-2xl border-2 transition-all cursor-pointer flex justify-between items-center ${formData.is_published ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-[0_0_20px_rgba(59,130,246,0.1)]' : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 hover:border-gray-300 dark:hover:border-slate-600'}`}
                  onClick={() => setFormData(prev => ({...prev, is_published: !prev.is_published}))}
                >
                  <div>
                    <h4 className={`font-bold text-lg mb-1 transition-colors ${formData.is_published ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {t('admin_publish_course')}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin_publish_course_desc')}</p>
                  </div>
                  <div className={`relative w-14 h-8 rounded-full transition-colors duration-300 flex items-center px-1 flex-shrink-0 ${formData.is_published ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`}>
                    <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${formData.is_published ? 'rtl:-translate-x-6 ltr:translate-x-6' : 'translate-x-0'}`}></div>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-4 px-4 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 text-white rounded-xl font-bold text-lg transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader className="w-5 h-5 animate-spin" /> : <Save className="w-6 h-6" />}
                  {isEditing ? t('admin_save_changes') : t('admin_save_and_next')}
                </button>
              </div>

            </form>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
