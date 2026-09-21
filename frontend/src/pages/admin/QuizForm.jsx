import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Save, ArrowRight, Plus, Trash2, HelpCircle, 
  Settings, GripVertical, CheckCircle 
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import FadeIn from '../../components/FadeIn';
import toast from 'react-hot-toast';

export default function QuizForm() {
  const { id } = useParams();
  const isEditing = !!id;
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditing);
  const [courses, setCourses] = useState([]);
  const [profile, setProfile] = useState(null);

  // Quiz Data
  const [quizData, setQuizData] = useState({
    title: '',
    description: '',
    grade_level: '',
    course_id: '',
    duration_minutes: '',
    is_published: false
  });

  // Questions Data
  const [questions, setQuestions] = useState([
    { id: Date.now().toString(), text: '', type: 'multiple_choice', options: ['', '', '', ''], correct_option_index: 0, marks: 1 }
  ]);

  useEffect(() => {
    fetchInitialData();
  }, [id]);

  const fetchInitialData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setProfile(profileData);
      }

      // Fetch Courses for Dropdown
      const { data: coursesData } = await supabase.from('courses').select('id, title, category');
      setCourses(coursesData || []);

      if (isEditing) {
        // Fetch Quiz
        const { data: quiz, error: quizError } = await supabase
          .from('quizzes')
          .select('*')
          .eq('id', id)
          .single();

        if (quizError) throw quizError;

        setQuizData({
          title: quiz.title,
          description: quiz.description || '',
          grade_level: quiz.grade_level || '',
          course_id: quiz.course_id || '',
          duration_minutes: quiz.duration_minutes || '',
          is_published: quiz.is_published
        });

        // Fetch Questions
        const { data: qData, error: qError } = await supabase
          .from('quiz_questions')
          .select('*')
          .eq('quiz_id', id)
          .order('created_at', { ascending: true });

        if (qError) throw qError;

        if (qData && qData.length > 0) {
          setQuestions(qData.map(q => ({
            id: q.id,
            text: q.text,
            type: q.question_type || 'multiple_choice',
            options: q.options || ['', '', '', ''],
            correct_option_index: q.correct_option_index || 0,
            marks: q.marks
          })));
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('حدث خطأ أثناء تحميل البيانات');
    } finally {
      setFetching(false);
    }
  };

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      { id: Date.now().toString(), text: '', type: 'multiple_choice', options: ['', '', '', ''], correct_option_index: 0, marks: 1 }
    ]);
  };

  const handleRemoveQuestion = (index) => {
    if (questions.length === 1) {
      toast.error('يجب أن يحتوي الامتحان على سؤال واحد على الأقل');
      return;
    }
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleQuestionChange = (index, field, value) => {
    const newQs = [...questions];
    newQs[index][field] = value;
    setQuestions(newQs);
  };

  const handleOptionChange = (qIndex, optIndex, value) => {
    const newQs = [...questions];
    newQs[qIndex].options[optIndex] = value;
    setQuestions(newQs);
  };

  const validateForm = () => {
    if (!quizData.title) {
      toast.error('يرجى إدخال عنوان الامتحان');
      return false;
    }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text) {
        toast.error(`نص السؤال رقم ${i + 1} فارغ`);
        return false;
      }
      if (q.type === 'multiple_choice') {
        for (let j = 0; j < q.options.length; j++) {
          if (!q.options[j]) {
            toast.error(`أحد الخيارات في السؤال رقم ${i + 1} فارغ`);
            return false;
          }
        }
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setLoading(true);
      let quizId = id;

      const quizPayload = {
        title: quizData.title,
        description: quizData.description,
        grade_level: quizData.grade_level || null,
        course_id: quizData.course_id || null,
        duration_minutes: quizData.duration_minutes ? parseInt(quizData.duration_minutes) : null,
        is_published: quizData.is_published
      };

      if (isEditing) {
        const { error } = await supabase.from('quizzes').update(quizPayload).eq('id', id);
        if (error) throw error;
      } else {
        quizPayload.created_by = profile?.id;
        const { data, error } = await supabase.from('quizzes').insert([quizPayload]).select().single();
        if (error) throw error;
        quizId = data.id;
      }

      // Upsert Questions: simplest way is delete old ones, insert new ones
      if (isEditing) {
        await supabase.from('quiz_questions').delete().eq('quiz_id', quizId);
      }

      const questionsPayload = questions.map(q => ({
        quiz_id: quizId,
        question_type: q.type,
        text: q.text,
        options: q.type === 'multiple_choice' ? q.options : [],
        correct_option_index: q.type === 'multiple_choice' ? q.correct_option_index : null,
        marks: parseInt(q.marks) || 1
      }));

      const { error: qError } = await supabase.from('quiz_questions').insert(questionsPayload);
      if (qError) throw qError;

      toast.success(isEditing ? 'تم تحديث الامتحان بنجاح' : 'تم إنشاء الامتحان بنجاح');
      navigate('/admin-dashboard/quizzes');
    } catch (error) {
      console.error('Error saving quiz:', error);
      toast.error('حدث خطأ أثناء الحفظ');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-20 font-arabic">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/admin-dashboard/quizzes')}
              className="p-2 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
            >
              <ArrowRight className="w-5 h-5 rtl:rotate-0 ltr:rotate-180" />
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {isEditing ? (isRTL ? 'تعديل امتحان' : 'Edit Quiz') : (isRTL ? 'إنشاء امتحان جديد' : 'Create New Quiz')}
            </h1>
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all shadow-md"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Save className="w-5 h-5" />}
            {isRTL ? 'حفظ الامتحان' : 'Save Quiz'}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8">
        
        {/* Settings Card */}
        <FadeIn>
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 dark:border-slate-700">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-slate-700">
              <Settings className="w-6 h-6 text-blue-500" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{isRTL ? 'إعدادات الامتحان' : 'Quiz Settings'}</h2>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{isRTL ? 'عنوان الامتحان *' : 'Quiz Title *'}</label>
                <input
                  type="text"
                  value={quizData.title}
                  onChange={e => setQuizData({...quizData, title: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                  placeholder={isRTL ? 'مثال: امتحان الشهر الأول - لغة عربية' : 'e.g. First Month Exam - Arabic'}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{isRTL ? 'الوصف (اختياري)' : 'Description (optional)'}</label>
                <textarea
                  value={quizData.description}
                  onChange={e => setQuizData({...quizData, description: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                  rows="3"
                  placeholder={isRTL ? 'اكتب تعليمات أو وصف للامتحان...' : 'Write instructions or description for the quiz...'}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{isRTL ? 'استهداف الصف الدراسي (اختياري)' : 'Target Grade (optional)'}</label>
                  <select
                    value={quizData.grade_level}
                    onChange={e => setQuizData({...quizData, grade_level: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl outline-none text-gray-900 dark:text-white"
                  >
                    <option value="">{isRTL ? '-- للجميع --' : '-- For Everyone --'}</option>
                    <option value="الصف الأول الابتدائي">{t('grade_primary_1')}</option>
                    <option value="الصف الثاني الابتدائي">{t('grade_primary_2')}</option>
                    <option value="الصف الثالث الابتدائي">{t('grade_primary_3')}</option>
                    <option value="الصف الرابع الابتدائي">{t('grade_primary_4')}</option>
                    <option value="الصف الخامس الابتدائي">{t('grade_primary_5')}</option>
                    <option value="الصف السادس الابتدائي">{t('grade_primary_6')}</option>
                    <option value="الصف الأول الإعدادي">{t('grade_prep_1')}</option>
                    <option value="الصف الثاني الإعدادي">{t('grade_prep_2')}</option>
                    <option value="الصف الثالث الإعدادي">{t('grade_prep_3')}</option>
                    <option value="الصف الأول الثانوي">{t('grade_sec_1')}</option>
                    <option value="الصف الثاني الثانوي">{t('grade_sec_2')}</option>
                    <option value="الصف الثالث الثانوي">{t('grade_sec_3')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{isRTL ? 'ارتباط بكورس (اختياري)' : 'Link to Course (optional)'}</label>
                  <select
                    value={quizData.course_id}
                    onChange={e => setQuizData({...quizData, course_id: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl outline-none text-gray-900 dark:text-white"
                  >
                    <option value="">{isRTL ? '-- بدون كورس (امتحان عام) --' : '-- No Course (General Quiz) --'}</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.title} {c.category ? `(${c.category})` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">{isRTL ? 'المدة الزمنية (بالدقائق)' : 'Duration (minutes)'}</label>
                  <input
                    type="number"
                    min="1"
                    value={quizData.duration_minutes}
                    onChange={e => setQuizData({...quizData, duration_minutes: e.target.value})}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl outline-none text-gray-900 dark:text-white"
                    placeholder={isRTL ? 'اتركه فارغاً لامتحان مفتوح الوقت' : 'Leave blank for unlimited time'}
                  />
                </div>
                
                <div className="flex items-end">
                  <div 
                    onClick={() => setQuizData({...quizData, is_published: !quizData.is_published})}
                    className="flex items-center cursor-pointer p-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl w-full gap-3 select-none"
                  >
                    <div className={`w-12 h-6 rounded-full transition-colors relative flex items-center shrink-0 ${quizData.is_published ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                      <div className={`absolute w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${quizData.is_published ? (isRTL ? 'left-1' : 'right-1') : (isRTL ? 'right-1' : 'left-1')}`}></div>
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                      {t('quiz_form_publish_now')}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </FadeIn>

        {/* Questions Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <HelpCircle className="w-6 h-6 text-pink-500" />
              {isRTL ? 'الأسئلة' : 'Questions'} ({questions.length})
            </h2>
          </div>

          {questions.map((q, qIndex) => (
            <FadeIn key={q.id} delay={qIndex * 50}>
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 relative overflow-hidden group">
                <div className={`absolute top-0 ${isRTL ? 'right-0' : 'left-0'} w-2 h-full bg-blue-500`}></div>
                
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold">
                    <GripVertical className="w-5 h-5 text-gray-400 cursor-move" />
                    {isRTL ? `السؤال ${qIndex + 1}` : `Question ${qIndex + 1}`}
                  </div>
                  <button 
                    onClick={() => handleRemoveQuestion(qIndex)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 p-2 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={q.text}
                        onChange={e => handleQuestionChange(qIndex, 'text', e.target.value)}
                        placeholder={isRTL ? 'اكتب السؤال هنا...' : 'Type question here...'}
                        className="w-full px-4 py-3 text-lg font-bold bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="w-full md:w-48 shrink-0">
                      <select
                        value={q.type || 'multiple_choice'}
                        onChange={e => handleQuestionChange(qIndex, 'type', e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 dark:text-white font-bold h-full"
                      >
                        <option value="multiple_choice">{isRTL ? 'اختياري' : 'Multiple Choice'}</option>
                        <option value="essay">{isRTL ? 'مقالي' : 'Essay'}</option>
                      </select>
                    </div>
                  </div>

                  {(!q.type || q.type === 'multiple_choice') ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      {q.options.map((opt, optIndex) => (
                        <div 
                          key={optIndex} 
                          className={`flex items-center gap-3 p-2 rounded-xl border-2 transition-all ${
                            q.correct_option_index === optIndex 
                              ? 'border-green-500 bg-green-50/50 dark:bg-green-900/10' 
                              : 'border-transparent bg-gray-50 dark:bg-slate-900'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleQuestionChange(qIndex, 'correct_option_index', optIndex)}
                            className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors shrink-0 ${
                              q.correct_option_index === optIndex 
                                ? 'border-green-500 bg-green-500 text-white' 
                                : 'border-gray-300 dark:border-slate-600'
                            }`}
                          >
                            {q.correct_option_index === optIndex && <CheckCircle className="w-4 h-4" />}
                          </button>
                          <input
                            type="text"
                            value={opt}
                            onChange={e => handleOptionChange(qIndex, optIndex, e.target.value)}
                            placeholder={isRTL ? `الخيار ${optIndex + 1}` : `Option ${optIndex + 1}`}
                            className="flex-1 bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 p-5 bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700 text-center">
                      <p className="text-gray-500 dark:text-gray-400 font-bold">
                        {isRTL ? 'سيظهر للطلاب مربع نص لكتابة إجابتهم المقالية.' : 'Students will see a text box to write their essay answer.'}
                      </p>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700 flex items-center gap-4 w-48">
                    <label className="text-sm font-bold text-gray-600 dark:text-gray-400 shrink-0">{isRTL ? 'درجة السؤال:' : 'Question Mark:'}</label>
                    <input
                      type="number"
                      min="1"
                      value={q.marks}
                      onChange={e => handleQuestionChange(qIndex, 'marks', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl outline-none text-gray-900 dark:text-white text-center"
                    />
                  </div>

                </div>
              </div>
            </FadeIn>
          ))}

          <button
            onClick={handleAddQuestion}
            className="w-full py-4 border-2 border-dashed border-gray-300 dark:border-slate-600 text-gray-500 dark:text-gray-400 font-bold rounded-3xl hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-6 h-6" />
            {isRTL ? 'إضافة سؤال جديد' : 'Add New Question'}
          </button>
        </div>
      </div>
    </div>
  );
}
