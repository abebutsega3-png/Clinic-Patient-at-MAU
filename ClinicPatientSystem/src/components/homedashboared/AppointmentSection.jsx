import React, { useState } from 'react';

export default function AppointmentSection() {
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Departments List
  const departments = [
    { id: 'opd', name: 'General Practice / OPD' },
    { id: 'lab', name: 'Laboratory' },
    { id: 'peds', name: 'Pediatrics' },
    { id: 'dental', name: 'Dental Care' },
    { id: 'derma', name: 'Dermatology' },
  ];

  // Doctors List
  const doctors = [
    { id: 'doc1', name: 'Dr. Sarah Connor (General Practitioner)', dept: 'opd' },
    { id: 'doc2', name: 'Dr. John Doe (Pediatrician)', dept: 'peds' },
    { id: 'doc3', name: 'Dr. Emily Watson (Dentist)', dept: 'dental' },
  ];

  // Available Time Slots
  const timeSlots = [
    '09:00 AM', '09:30 AM', '10:00 AM', 
    '10:30 AM', '02:00 PM', '02:30 PM', 
    '03:00 PM', '03:30 PM'
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitted(true);
  };

  return (
    <section id="appointment" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-blue-600 px-6 py-8 text-white text-center">
          <h2 className="text-3xl font-bold">Book an Appointment</h2>
          <p className="text-blue-100 mt-2 text-sm sm:text-base">
            Select a department, choose your preferred doctor & time slot to schedule your visit.
          </p>
        </div>

        {/* Form Container */}
        <div className="p-6 sm:p-10">
          {isSubmitted ? (
            /* Success State */
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                ✓
              </div>
              <h3 className="text-2xl font-bold text-slate-800">Appointment Booked Successfully!</h3>
              <p className="text-slate-600 mt-2">
                Your confirmation code is <span className="font-bold text-blue-600">APT-98234</span>.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                A confirmation notification has been sent to your phone/email.
              </p>

              <div className="mt-8 p-4 bg-slate-50 rounded-xl border border-slate-200 text-left max-w-md mx-auto space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Date:</span>
                  <span className="font-medium text-slate-800">{selectedDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Time Slot:</span>
                  <span className="font-medium text-slate-800">{selectedTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Department:</span>
                  <span className="font-medium text-slate-800">
                    {departments.find((d) => d.id === selectedDept)?.name || 'General'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsSubmitted(false)}
                className="mt-8 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition"
              >
                Book Another Appointment
              </button>
            </div>
          ) : (
            /* Booking Form */
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Step 1: Select Department & Doctor */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Department *
                  </label>
                  <select
                    required
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-800"
                  >
                    <option value="">Select Department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Doctor (Optional)
                  </label>
                  <select
                    value={selectedDoctor}
                    onChange={(e) => setSelectedDoctor(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-800"
                  >
                    <option value="">Any Available Doctor</option>
                    {doctors.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Step 2: Date & Time Picker */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Preferred Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Time Slot *
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {timeSlots.map((slot) => (
                      <button
                        type="button"
                        key={slot}
                        onClick={() => setSelectedTime(slot)}
                        className={`py-2 text-xs font-semibold rounded-lg border transition ${
                          selectedTime === slot
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Step 3: Patient Information */}
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <h4 className="font-semibold text-slate-800 text-base">Patient Details</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    required
                    placeholder="Full Name *"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                  />
                  <input
                    type="tel"
                    required
                    placeholder="Phone Number *"
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                  />
                </div>

                <textarea
                  rows="3"
                  placeholder="Reason for Visit / Symptoms (Optional)"
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                ></textarea>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!selectedTime}
                className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold text-base hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-md"
              >
                Confirm Appointment
              </button>
            </form>
          )}
        </div>

      </div>
    </section>
  );
}