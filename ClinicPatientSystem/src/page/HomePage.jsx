import Navbar from '../components/homedashboared/Navbar.jsx';
import Hero from '../components/homedashboared/Hero.jsx';
import HomeCareUnitsSection from '../components/homedashboared/HomeCareUnitsSection.jsx';
import PatientJourneySection from '../components/homedashboared/PatientJourneySection.jsx';
import Footer from '../components/homedashboared/Footer.jsx';

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <HomeCareUnitsSection />
      <PatientJourneySection />
      <Footer />
    </div>
  );
}
