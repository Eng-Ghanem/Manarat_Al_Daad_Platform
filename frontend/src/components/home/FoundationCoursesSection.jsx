import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { BookOpen, ArrowLeft, ArrowRight, Clock } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { getDirectImageUrl, formatCourseTitle } from '../../utils/helpers';
import FadeIn from '../FadeIn';

export default function FoundationCoursesSection() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isRTL = i18n.language === 'ar';
  
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('category', 'كورسات-تأسيسية')
        .eq('is_published', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCourses(data || []);
    } catch (err) {
      console.error('Error fetching foundation courses:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-scroll logic
  useEffect(() => {
    if (courses.length <= 1 || !scrollRef.current) return;
    
    const scrollInterval = setInterval(() => {
      if (scrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        const scrollAmount = 350; // approximate width of one card
        
        let nextScrollLeft;
        if (isRTL) {
          // In RTL, scrollLeft is negative or starts at 0 and goes negative depending on browser, 
          // but modern browsers usually use negative values for scrolling left in RTL.
          // Let's use standard scrollBy for cross-browser compatibility
          scrollRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
          
          // Reset to beginning if reached the end
          if (Math.abs(scrollLeft) + clientWidth >= scrollWidth - 10) {
             setTimeout(() => {
               if (scrollRef.current) scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
             }, 500);
          }
        } else {
          scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
          
          if (scrollLeft + clientWidth >= scrollWidth - 10) {
             setTimeout(() => {
               if (scrollRef.current) scrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
             }, 500);
          }
        }
      }
    }, 3000); // Scroll every 3 seconds

    return () => clearInterval(scrollInterval);
  }, [courses, isRTL]);

  if (loading || courses.length === 0) {
    return null; // Don't show the section if loading or no courses
  }

  return (
    <section className="py-20 bg-white dark:bg-slate-900 relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gold-400/5 dark:bg-gold-600/5 blur-[80px] rounded-full pointer-events-none"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        <FadeIn>
          <div className="flex flex-col md:flex-row justify-between items-center mb-12">
            <div>
              <div className="inline-flex items-center space-x-2 rtl:space-x-reverse px-4 py-1.5 rounded-full bg-gold-50 dark:bg-gold-900/30 text-gold-600 dark:text-gold-400 font-bold text-sm mb-4 border border-gold-100 dark:border-gold-800/50">
                <span>VIP Courses</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white font-arabic tracking-tight">
                {t('fc_latest_courses')}
              </h2>
            </div>
            
            <Link 
              to="/courses"
              className="group flex items-center gap-2 mt-4 md:mt-0 text-blue-600 dark:text-blue-400 font-bold hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
            >
              {t('fc_view_all_courses')}
              <ArrowLeft className={`w-5 h-5 transition-transform duration-300 ${isRTL ? 'group-hover:-translate-x-2' : 'group-hover:translate-x-2 rotate-180'}`} />
            </Link>
          </div>
        </FadeIn>

        <FadeIn delay={200}>
          <div 
            ref={scrollRef}
            className="flex gap-6 overflow-x-auto pb-8 snap-x snap-mandatory scrollbar-hide scroll-smooth"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {courses.map((course) => (
              <div 
                key={course.id}
                className="w-[85vw] sm:w-auto sm:min-w-[320px] max-w-[320px] snap-center shrink-0 group cursor-pointer relative bg-gray-50 dark:bg-slate-800/80 border border-gray-100 dark:border-slate-700 rounded-3xl p-5 transition-all duration-300 flex flex-col hover:shadow-xl hover:border-gold-200 dark:hover:border-gold-800/50"
                onClick={() => navigate(`/course/${course.id}`)}
              >
                {/* Image */}
                <div className="relative w-full h-40 rounded-2xl overflow-hidden mb-5 bg-slate-200 dark:bg-slate-700">
                  {course.image_url ? (
                    <img src={getDirectImageUrl(course.image_url)} alt={course.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-12 h-12 text-gray-400 dark:text-slate-500" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  
                  {course.price === 0 && (
                    <div className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} bg-green-500 text-white px-2 py-0.5 rounded-full text-xs font-bold`}>
                      {t('fc_free')}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-grow flex flex-col">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-gold-600 dark:group-hover:text-gold-400 transition-colors">
                    {formatCourseTitle(course.title)}
                  </h3>
                  
                  <div className="mt-auto pt-4 flex items-center justify-between">
                    <div className="flex flex-col">
                      {course.discounted_price ? (
                        <>
                          <span className="text-xs text-gray-400 line-through font-bold">{course.price} {isRTL ? 'ج.م' : 'EGP'}</span>
                          <span className="font-bold text-lg text-gold-600 dark:text-gold-400">{course.discounted_price} {isRTL ? 'ج.م' : 'EGP'}</span>
                        </>
                      ) : (
                        <span className="font-bold text-lg text-gold-600 dark:text-gold-400">
                          {course.price > 0 ? `${course.price} ${isRTL ? 'ج.م' : 'EGP'}` : t('fc_free_badge')}
                        </span>
                      )}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gold-50 dark:bg-slate-700 flex items-center justify-center group-hover:bg-gold-500 group-hover:text-white transition-colors text-gold-600 dark:text-gold-400">
                      {isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </FadeIn>

      </div>
    </section>
  );
}
