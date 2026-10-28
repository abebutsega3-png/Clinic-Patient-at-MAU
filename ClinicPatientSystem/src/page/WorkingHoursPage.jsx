import { useEffect, useState } from 'react';
import Navbar from '../components/homedashboared/Navbar.jsx';
import WorkingHoursSection from '../components/homedashboared/WorkingHoursSection.jsx';
import Footer from '../components/homedashboared/Footer.jsx';

export default function WorkingHoursPage() {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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
        setError('');
      } catch (loadError) {
        if (loadError.name !== 'AbortError') {
          console.error('Failed to load public clinic information:', loadError);
          setError(loadError.message || 'Unable to load clinic information.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void loadOverview();
    return () => controller.abort();
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <WorkingHoursSection overview={overview} loading={loading} error={error} />
      </main>
      <Footer />
    </div>
  );
}
