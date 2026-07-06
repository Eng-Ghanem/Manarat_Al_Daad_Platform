import { Quote } from 'lucide-react';
import FadeIn from '../FadeIn';
import { useTranslation } from 'react-i18next';

export default function QuotesSection() {
  const { t } = useTranslation();
  
  const quotes = [
    {
      text: t('quote_1_text'),
      author: t('quote_1_author')
    },
    {
      text: t('quote_2_text'),
      author: t('quote_2_author')
    },
    {
      text: t('quote_3_text'),
      author: t('quote_3_author')
    }
  ];

  return (
    <section className="py-24 relative overflow-hidden bg-gradient-to-br from-blue-900 to-indigo-950 text-white">
      <div className="absolute inset-0 bg-arabic-pattern opacity-20"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <FadeIn>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold text-gold-400 mb-6">
              {t('quotes_title')}
            </h2>
            <div className="w-24 h-1 bg-white/20 mx-auto rounded-full"></div>
          </div>
        </FadeIn>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {quotes.map((q, idx) => (
            <FadeIn key={idx} delay={idx * 150} className="h-full">
              <div className="bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-3xl h-full flex flex-col justify-between hover:bg-white/20 transition-colors duration-300 shadow-xl">
                <div>
                  <Quote className="w-10 h-10 text-gold-400 mb-6 opacity-80" />
                  <p className="text-xl md:text-2xl font-medium leading-relaxed mb-8">
                    "{q.text}"
                  </p>
                </div>
                <div className="text-gold-300 font-bold text-lg flex items-center before:content-[''] before:w-8 before:h-px before:bg-gold-300 before:me-3">
                  {q.author}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
