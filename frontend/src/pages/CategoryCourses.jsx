import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { BookOpen, PenTool, Sparkles, Library, ArrowLeft, ArrowRight, PlayCircle, Loader, Clock } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getDirectImageUrl } from '../utils/helpers';
import BackButton from '../components/BackButton';

export default function CategoryCourses() {
  const { categoryId } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isRTL = i18n.language === 'ar';

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourses();
  }, [categoryId]);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('category', categoryId)
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCourses(data || []);
    } catch (err) {
      console.error('Error fetching courses:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryDetails = (id) => {
    if (!id || id === 'كورسات-تأسيسية') {
      return {
        title: 'كورسات التأسيس الشاملة',
        desc: 'ابنِ أساساً لغوياً متيناً في النحو والإملاء والبلاغة مع الأستاذ السيد غريب.',
        badge: 'كورسات تأسيسية'
      };
    }

    const parts = id.split('-');

    const stageMap = {
      'primary': 'الابتدائي',
      'prep': 'الإعدادي',
      'sec': 'الثانوي'
    };

    const gradeMap = {
      '1': 'الأول',
      '2': 'الثاني',
      '3': 'الثالث',
      '4': 'الرابع',
      '5': 'الخامس',
      '6': 'السادس'
    };

    let title = 'كورسات المنصة';
    let desc = 'مجموعة من أفضل الكورسات لضمان تفوقك.';
    let badge = 'الصفوف الدراسية';

    if (parts.length >= 2) {
      const stage = stageMap[parts[0]] || '';
      const grade = gradeMap[parts[1]] || '';

      title = `الصف ${grade} ${stage}`;
      desc = `مجموعة من الكورسات المخصصة لطلاب الصف ${grade} ${stage} لضمان التفوق والنجاح`;

      if (parts.length >= 4 && parts[2] === 'term') {
        const term = parts[3] === '1' ? 'الأول' : 'الثاني';
        title += ` - الترم ${term}`;
        desc += ` في الفصل الدراسي ${term}.`;
      } else {
        desc += `.`;
      }
    }

    return { title, desc, badge };
  };

  const categoryDetails = getCategoryDetails(categoryId);


  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 50 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 200, damping: 20 } }
  };

  return (
    <div className="min-h-screen py-20 bg-gray-50 dark:bg-slate-900 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 bg-arabic-pattern opacity-[0.03] dark:opacity-[0.02]"></div>
      <div className="absolute top-[-10%] right-[-5%] w-[40rem] h-[40rem] rounded-full bg-blue-400/10 dark:bg-blue-600/10 blur-3xl opacity-50 pointer-events-none"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-[40rem] h-[40rem] rounded-full bg-gold-400/10 dark:bg-gold-600/10 blur-3xl opacity-50 pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        <div className="mb-8">
          <BackButton />
        </div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-full shadow-sm border border-gray-100 dark:border-slate-700/50 mb-6">
            <span className="font-bold text-sm text-gray-700 dark:text-gray-300">{categoryDetails.badge}</span>
            <Sparkles className="w-4 h-4 text-gold-500" />
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-blue-900 dark:text-blue-400 mb-6 leading-tight font-arabic drop-shadow-sm">
            {categoryDetails.title}
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
            {categoryDetails.desc}
          </p>
        </motion.div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader className="w-12 h-12 text-blue-600 animate-spin" />
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-20 h-20 text-gray-300 dark:text-slate-700 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">لا توجد كورسات متاحة حالياً</h2>
            <p className="text-gray-500 dark:text-gray-400">تابعنا قريباً، سيتم إضافة أقوى الكورسات هنا.</p>
          </div>
        ) : (
          /* Courses Grid */
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-12"
          >
            {courses.map((course) => (
              <motion.div
                key={course.id}
                variants={itemVariants}
                whileHover={{ y: -10 }}
                onClick={() => navigate(`/course/${course.id}`)}
                className={`group cursor-pointer relative bg-white dark:bg-slate-800/80 backdrop-blur-xl border border-gray-100 dark:border-slate-700 rounded-[2.5rem] p-6 transition-all duration-500 flex flex-col h-full hover:shadow-2xl hover:border-blue-200 dark:hover:border-blue-800 overflow-hidden`}
              >
                {/* Image / Thumbnail */}
                <div className="relative w-full h-48 rounded-3xl overflow-hidden mb-6 bg-slate-100 dark:bg-slate-700/50">
                  {course.image_url ? (
                    <img src={getDirectImageUrl(course.image_url)} alt={course.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-16 h-16 text-gray-300 dark:text-slate-500" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                  {course.price === 0 && (
                    <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                      مجاني
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-grow flex flex-col">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3 leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                    {course.title}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed font-medium mb-6 line-clamp-3">
                    {course.description || "لا يوجد وصف حالياً."}
                  </p>

                  <div className="mt-auto flex items-center justify-between mb-4">
                    <div className="flex flex-col">
                      {course.discounted_price ? (
                        <>
                          <span className="text-sm text-gray-400 dark:text-gray-500 line-through font-bold mb-0.5">{course.price} ج.م</span>
                          <span className="font-bold text-xl text-blue-600 dark:text-blue-400">{course.discounted_price} ج.م</span>
                        </>
                      ) : (
                        <span className="font-bold text-xl text-blue-600 dark:text-blue-400">{course.price > 0 ? `${course.price} ج.م` : 'مجاناً'}</span>
                      )}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-slate-700 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors text-blue-600 dark:text-blue-400">
                      {isRTL ? <ArrowLeft className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
                    </div>
                  </div>

                  {course.access_duration_days && (
                    <div className="pt-3 border-t border-gray-100 dark:border-slate-700">
                      <p className="text-xs font-bold text-orange-600 dark:text-orange-400 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        صلاحية الكورس: {course.access_duration_days} يوم
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
