import HeroSection from '../components/home/HeroSection';
import PlatformTourVideo from '../components/home/PlatformTourVideo';
import FoundationCoursesSection from '../components/home/FoundationCoursesSection';
import GamificationShowcase from '../components/home/GamificationShowcase';
import HomeLeaderboardSection from '../components/home/HomeLeaderboardSection';
import TestimonialsSection from '../components/home/TestimonialsSection';
import AboutTeacherSection from '../components/home/AboutTeacherSection';
import ContactSection from '../components/home/ContactSection';

export default function Home() {
  return (
    <div className="w-full">
      <HeroSection />
      <PlatformTourVideo />
      <FoundationCoursesSection />
      <GamificationShowcase />
      <HomeLeaderboardSection />
      <TestimonialsSection />
      <AboutTeacherSection />
      <ContactSection />
    </div>
  );
}
