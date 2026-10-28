import { ClipboardList, Siren, UserRoundCheck, Users } from 'lucide-react';

const ClinicHeadSummary = ({ summaryData }) => {
  const formatValue = (value) => (value === null || value === undefined ? '—' : value);
  const staffBreakdown = summaryData.staffBreakdown || [];
  const approvalBreakdown = summaryData.pendingApprovalsBreakdown || {};
  const cards = [
    {
      label: "Today's Total Patients",
      value: formatValue(summaryData.todaysPatients),
      detail: 'Clinic visits recorded today',
      footer: 'Total visits',
      icon: Users,
      style: 'border-blue-200 bg-gradient-to-br from-blue-50 to-white text-blue-700',
      iconStyle: 'bg-blue-600 text-white'
    },
    {
      label: 'Staff on Duty',
      value: formatValue(summaryData.staffOnDuty),
      detail: staffBreakdown.length
        ? staffBreakdown.map(({ role, onDuty, total }) => `${role}: ${onDuty}/${total}`).join(' · ')
        : 'From staff duty records',
      footer: 'On-duty staff / total staff',
      icon: UserRoundCheck,
      style: 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white text-emerald-700',
      iconStyle: 'bg-emerald-600 text-white'
    },
    {
      label: 'Pending Approvals',
      value: formatValue(summaryData.pendingApprovals),
      detail: `${approvalBreakdown.medicalCertificates ?? 0} certificates · ${approvalBreakdown.referrals ?? 0} referrals · ${approvalBreakdown.staffLeave ?? 0} leave`,
      footer: 'Requests requiring review',
      icon: ClipboardList,
      style: 'border-amber-200 bg-gradient-to-br from-amber-50 to-white text-amber-700',
      iconStyle: 'bg-amber-500 text-white'
    },
    {
      label: 'Critical / Emergency Cases',
      value: formatValue(summaryData.emergencyCases),
      detail: `${summaryData.emergencyVisitCount ?? 0} emergencies · ${summaryData.hospitalReferralCount ?? 0} referrals`,
      footer: 'Urgent cases and hospital referrals today',
      icon: Siren,
      style: 'border-rose-200 bg-gradient-to-br from-rose-50 to-white text-rose-700',
      iconStyle: 'bg-rose-600 text-white'
    }
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
      {cards.map(({ label, value, detail, footer, icon: Icon, style, iconStyle }) => (
        <article key={label} className={`flex min-h-32 flex-col justify-between rounded-xl border p-4 shadow-sm ${style}`}>
          <div className="flex items-start gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${iconStyle}`}>
              <Icon size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-700">{label}</p>
              <p className="mt-1 text-3xl font-extrabold leading-none text-slate-900">{value}</p>
              <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-slate-600">{detail}</p>
            </div>
          </div>
          <p className="mt-3 border-t border-current/10 pt-2 text-[10px] font-medium">{footer}</p>
        </article>
      ))}
    </div>
  );
};

export default ClinicHeadSummary;
