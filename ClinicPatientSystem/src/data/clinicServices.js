import {
  ClipboardCheck,
  ClipboardPlus,
  FlaskConical,
  HeartPulse,
  Pill,
  Stethoscope,
  Syringe,
} from 'lucide-react';

export const clinicServices = [
  {
    title: 'Patient Registration',
    description: 'Register your visit and create or retrieve your patient card.',
    icon: ClipboardPlus,
  },
  {
    title: 'General Medical Consultation',
    description: 'A doctor assesses your health concern and recommends tests or treatment.',
    icon: Stethoscope,
  },
  {
    title: 'Laboratory Testing',
    description: 'Blood, urine, and other tests to help inform your care.',
    icon: FlaskConical,
  },
  {
    title: 'Injection & Wound Care',
    description: 'Receive prescribed injections and wound cleaning and dressing care.',
    icon: Syringe,
  },
  {
    title: 'Medication Service',
    description: 'Receive prescribed medicines with instructions for their use.',
    icon: Pill,
  },
  {
    title: 'Emergency Care',
    description: 'Get prompt initial care for urgent medical concerns.',
    icon: HeartPulse,
    emergency: true,
  },
  {
    title: 'Referral & Medical Certificate',
    description: 'Request a referral to another hospital or a medical certificate.',
    icon: ClipboardCheck,
  },
];
