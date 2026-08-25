import HeroSection from '../components/home/HeroSection';
import FoundationCoursesSection from '../components/home/FoundationCoursesSection';
import TestimonialsSection from '../components/home/TestimonialsSection';
import AboutTeacherSection from '../components/home/AboutTeacherSection';
import ContactSection from '../components/home/ContactSection';

export default function Home() {
  return (
    <div className="w-full">
      <HeroSection />
      <FoundationCoursesSection />
      <TestimonialsSection />
      <AboutTeacherSection />
      <ContactSection />
    </div>
  );
}
