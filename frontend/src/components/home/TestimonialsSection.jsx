import { useTranslation } from 'react-i18next';
import { Star, Quote } from 'lucide-react';
import FadeIn from '../FadeIn';

export default function TestimonialsSection() {
  const { t } = useTranslation();

  const testimonials = [
    {
      id: 1,
      name: 'أحمد محمود',
      grade: 'الصف الثالث الثانوي',
      text: 'منصة رائعة جداً! الشرح مبسط وسهل الفهم، والأستاذ سيد غريب يوصل المعلومة بطريقة احترافية. بفضل الله ثم هذه المنصة تحسن مستواي في النحو بشكل كبير.',
      rating: 5,
      image: 'https://ui-avatars.com/api/?name=أحمد+محمود&background=2563eb&color=fff',
    },
    {
      id: 2,
      name: 'مريم طارق',
      grade: 'الصف الأول الثانوي',
      text: 'أفضل منصة لتعلم اللغة العربية. الكورسات التأسيسية ممتازة وتغطي كل الأساسيات التي نحتاجها. أنصح بها كل طالب يبحث عن التميز.',
      rating: 5,
      image: 'https://ui-avatars.com/api/?name=مريم+طارق&background=eab308&color=fff',
    },
    {
      id: 3,
      name: 'عمر خالد',
      grade: 'الصف الثاني الثانوي',
      text: 'طريقة الشرح والامتحانات الدورية تساعد جداً على تثبيت المعلومة. المنصة سريعة وسهلة الاستخدام حتى على الموبايل.',
      rating: 5,
      image: 'https://ui-avatars.com/api/?name=عمر+خالد&background=0f172a&color=fff',
    },
    {
      id: 4,
      name: 'فاطمة علي',
      grade: 'ولي أمر',
      text: 'منذ أن اشتركت لابنتي في المنصة ومستواها في تقدم مستمر. شكراً جزيلاً لجهودكم المبذولة في تقديم هذا المحتوى الراقي.',
      rating: 5,
      image: 'https://ui-avatars.com/api/?name=فاطمة+علي&background=3b82f6&color=fff',
    },
  ];

  return (
    <section className="py-20 bg-gray-50 dark:bg-slate-900 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute inset-0 bg-arabic-pattern opacity-[0.02] pointer-events-none"></div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/5 dark:bg-blue-600/10 blur-[100px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gold-500/5 dark:bg-gold-500/10 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <FadeIn>
          <div className="text-center mb-16">
            <div className="inline-flex items-center space-x-2 rtl:space-x-reverse px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold text-sm mb-4 border border-blue-100 dark:border-blue-800/50 shadow-sm">
              <span>آراء الطلاب وأولياء الأمور</span>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-900 dark:text-white font-arabic tracking-tight mb-4">
              ماذا يقولون عن <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-gold-500">منارة الضاد</span>؟
            </h2>
            <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto text-lg">
              نفخر بثقة طلابنا ونسعى دائماً لتقديم أفضل تجربة تعليمية في اللغة العربية.
            </p>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-8 lg:gap-10">
          {testimonials.map((testimonial, index) => (
            <FadeIn key={testimonial.id} delay={index * 150}>
              <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-slate-700/60 relative group hover:shadow-xl hover:border-blue-200 dark:hover:border-blue-800/50 transition-all duration-300">
                <Quote className="absolute top-6 right-8 w-12 h-12 text-blue-100 dark:text-slate-700/50 -z-10 transform rotate-180 group-hover:scale-110 group-hover:text-blue-200 dark:group-hover:text-slate-600 transition-all duration-500" />
                
                <div className="flex items-center gap-4 mb-6">
                  <img 
                    src={testimonial.image} 
                    alt={testimonial.name} 
                    className="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-slate-700 shadow-md"
                  />
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white font-arabic">{testimonial.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{testimonial.grade}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-gold-400 text-gold-400" />
                  ))}
                </div>
                
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed text-lg italic">
                  "{testimonial.text}"
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
