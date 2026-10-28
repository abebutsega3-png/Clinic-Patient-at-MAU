import { useEffect, useState } from 'react';
import Navbar from '../components/homedashboared/Navbar.jsx';
import Hero from '../components/homedashboared/Hero.jsx';
import ClinicStatisticsSection from '../components/homedashboared/ClinicStatisticsSection.jsx';
import ServicesSection from '../components/homedashboared/ServicesSection.jsx';
import PatientJourneySection from '../components/homedashboared/PatientJourneySection.jsx';
import WorkingHoursSection from '../components/homedashboared/WorkingHoursSection.jsx';
import Footer from '../components/homedashboared/Footer.jsx';

export default function HomePage() {
  const [overview, setOverview] = useState(null);
  const [overviewError, setOverviewError] = useState('');
  const [loadingOverview, setLoadingOverview] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const loadOverview = async () => {
      try {
        const response = await fetch('/api/public/clinic/overview', { signal: controller.signal });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success || !result.data) {
          throw new Error(result?.message || 'Unable to load clinic information.');
        }
        setOverview(result.data);
        setOverviewError('');
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Failed to load public clinic information:', error);
          setOverviewError(error.message || 'Unable to load clinic information.');
        }
      } finally {
        if (!controller.signal.aborted) setLoadingOverview(false);
      }
    };

    void loadOverview();
    return () => controller.abort();
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <ClinicStatisticsSection overview={overview} loading={loadingOverview} error={overviewError} />
      <ServicesSection emergencyPhone={overview?.emergencyPhone} />
      <PatientJourneySection />
      <WorkingHoursSection overview={overview} loading={loadingOverview} error={overviewError} />
      <Footer />
    </div>
  );
}
