import HeroSection from '../components/home/HeroSection';
import FoundationCoursesSection from '../components/home/FoundationCoursesSection';
import FeaturesSection from '../components/home/FeaturesSection';
import QuotesSection from '../components/home/QuotesSection';
import AboutTeacherSection from '../components/home/AboutTeacherSection';
import ContactSection from '../components/home/ContactSection';

export default function Home() {
  return (
    <div className="w-full">
      <HeroSection />
      <FoundationCoursesSection />
      <FeaturesSection />
      <QuotesSection />
      <AboutTeacherSection />
      <ContactSection />
    </div>
  );
}
