import Navbar from '../components/homedashboared/Navbar.jsx';
import AboutClinicSection from '../components/homedashboared/AboutClinicSection.jsx';
import Footer from '../components/homedashboared/Footer.jsx';

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <AboutClinicSection />
      </main>
      <Footer />
    </div>
  );
}
