'use client'

import { useState } from 'react'
import { Zap, Check, ChevronRight, ChevronLeft } from 'lucide-react'

const routes = [
  { id: 'western-arthurs-ak', name: 'Western Arthurs (A-K)', duration: '5-7 days', location: 'SW Tasmania' },
  { id: 'western-arthurs-full', name: 'Western Arthurs (Full)', duration: '10-14 days', location: 'SW Tasmania' },
  { id: 'overland-track', name: 'Overland Track', duration: '5-7 days', location: 'Central Tasmania' },
]

export default function RegisterPage() {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    route: '',
    startDate: '',
    endDate: '',
    phone: '',
    email: '',
    acceptTerms: false,
  })
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // For beta: show success, later connect to backend
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="py-20">
        <div className="max-w-md mx-auto px-4 text-center">
          <div className="card p-8">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h1 className="text-2xl font-bold mb-4">You&apos;re registered!</h1>
            <p className="text-gray-600 mb-6">
              We&apos;ll be in touch shortly with your trip details. 
              Your first forecast will arrive at 6 PM the day before your start date.
            </p>
            <div className="bg-gray-100 rounded-lg p-4 text-left text-sm">
              <p className="text-gray-500 mb-2">Trip details:</p>
              <p className="text-gray-700">Route: {routes.find(r => r.id === formData.route)?.name}</p>
              <p className="text-gray-700">Start: {formData.startDate}</p>
              <p className="text-gray-700">Phone: {formData.phone}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="py-20">
      <div className="max-w-md mx-auto px-4">
        <div className="text-center mb-8">
          <Zap className="w-12 h-12 text-orange-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-4">Register Your Trip</h1>
          <p className="text-gray-600">
            Step {step} of 3
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map(s => (
            <div 
              key={s} 
              className={`h-1 flex-1 rounded ${s <= step ? 'bg-orange-500' : 'bg-gray-200'}`}
            />
          ))}
        </div>

        <div className="card p-8">
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-4">Which trail are you hiking?</h2>
              <div className="space-y-3">
                {routes.map(route => (
                  <label 
                    key={route.id}
                    className={`block p-4 rounded-lg border cursor-pointer transition-colors ${
                      formData.route === route.id 
                        ? 'border-orange-500 bg-orange-500/10' 
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="route"
                      value={route.id}
                      checked={formData.route === route.id}
                      onChange={(e) => setFormData({...formData, route: e.target.value})}
                      className="sr-only"
                    />
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{route.name}</p>
                        <p className="text-gray-500 text-sm">{route.location} • {route.duration}</p>
                      </div>
                      {formData.route === route.id && (
                        <Check className="w-5 h-5 text-orange-500" />
                      )}
                    </div>
                  </label>
                ))}
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={!formData.route}
                className="btn-orange w-full flex items-center justify-center gap-2 disabled:opacity-50"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-4">When does your hike start?</h2>
              <div>
                <label className="block text-sm font-medium mb-2">Start Date</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  className="w-full bg-gray-100 border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">End Date (optional)</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                  className="w-full bg-gray-100 border border-gray-300 rounded-lg px-4 py-3 text-gray-900 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                />
                <p className="text-gray-400 text-sm mt-2">
                  Leave blank to use suggested duration. You can extend during your trip with DELAY command.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="btn-secondary flex items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!formData.startDate}
                  className="btn-orange flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <h2 className="text-xl font-semibold mb-4">Your contact details</h2>
              <div>
                <label className="block text-sm font-medium mb-2">Mobile Number</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="+61 412 345 678"
                  className="w-full bg-gray-100 border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                  required
                />
                <p className="text-gray-400 text-sm mt-2">
                  This is where your forecasts will be sent.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email (optional)</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="hiker@example.com"
                  className="w-full bg-gray-100 border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                />
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.acceptTerms}
                  onChange={(e) => setFormData({...formData, acceptTerms: e.target.checked})}
                  className="mt-1"
                  required
                />
                <span className="text-gray-600 text-sm">
                  I accept the <a href="/terms" className="text-orange-500 underline">terms of service</a> and <a href="/safety" className="text-orange-500 underline">safety disclaimer</a>
                </span>
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn-secondary flex items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button
                  type="submit"
                  disabled={!formData.acceptTerms || !formData.phone}
                  className="btn-orange flex-1 disabled:opacity-50"
                >
                  Register
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>Beta pricing: $24.99 AUD per trip</p>
        </div>
      </div>
    </div>
  )
}
