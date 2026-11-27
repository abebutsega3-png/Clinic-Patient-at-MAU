export default function ClinicHeadFeatureUnavailable({ title, message }) {
  return (
    <section className="mx-auto max-w-3xl space-y-3 rounded-xl border border-amber-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-bold text-slate-900">{title}</h1>
      <p className="text-sm leading-relaxed text-slate-600">{message}</p>
      <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        This page is not available for Clinic Head yet. No backend access or data has been changed.
      </p>
    </section>
  );
}
