'use client'

import { useState } from 'react'
import { Check, ChevronRight, ChevronLeft, AlertTriangle, Satellite } from 'lucide-react'
import {
  countries,
  getCarriersForCountry,
  checkEligibility,
  EligibilityResult,
} from '../data/eligibilityData'

export default function EligibilityPage() {
  const [step, setStep] = useState(1)
  const [selectedCountry, setSelectedCountry] = useState('')
  const [selectedCarrier, setSelectedCarrier] = useState('')
  const [selectedDestination, setSelectedDestination] = useState('')
  const [email, setEmail] = useState('')
  const [result, setResult] = useState<EligibilityResult | null>(null)
  const [showPurchaseAnyway, setShowPurchaseAnyway] = useState(false)

  const countryCarriers = selectedCountry ? getCarriersForCountry(selectedCountry) : []
  const selectedCountryName = countries.find(c => c.id === selectedCountry)?.name || ''
  const selectedCarrierName = countryCarriers.find(c => c.id === selectedCarrier)?.name || ''

  const handleCheckEligibility = (e: React.FormEvent) => {
    e.preventDefault()
    const eligibility = checkEligibility(selectedCountry, selectedCarrier)
    setResult(eligibility)
  }

  const handleStartOver = () => {
    setStep(1)
    setSelectedCountry('')
    setSelectedCarrier('')
    setSelectedDestination('')
    setEmail('')
    setResult(null)
    setShowPurchaseAnyway(false)
  }

  // Result screen
  if (result) {
    if (result.eligible) {
      return (
        <div className="py-20">
          <div className="max-w-md mx-auto px-4">
            <div className="card p-8 text-center">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-8 h-8 text-green-500" />
              </div>
              <h1 className="text-2xl font-bold mb-2">You&apos;re eligible!</h1>
              <p className="text-gray-600 mb-6">
                Satellite SMS is available for {selectedCarrierName} in {selectedCountryName}.
              </p>

              <div className="bg-gray-50 rounded-lg p-4 text-left mb-6">
                <p className="text-sm font-medium text-gray-700 mb-3">Available services:</p>
                <div className="space-y-2">
                  {result.services.map((svc) => (
                    <div key={svc.service} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{svc.service}</p>
                        {svc.note && (
                          <p className="text-xs text-gray-500">{svc.note}</p>
                        )}
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          svc.status === 'live'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {svc.status === 'live' ? 'Live' : 'Testing'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-left mb-6">
                <p className="text-xs text-orange-700">
                  <strong>Note:</strong> Satellite SMS only works in your home country ({selectedCountryName}). Roaming is not available.
                </p>
              </div>

              <a
                href="/create"
                className="btn-orange w-full flex items-center justify-center gap-2"
              >
                Continue to Purchase <ChevronRight className="w-4 h-4" />
              </a>
              <button
                onClick={handleStartOver}
                className="btn-secondary w-full mt-3"
              >
                Check another combination
              </button>
            </div>
          </div>
        </div>
      )
    }

    // Not eligible
    const isCountryUnsupported = !result.countrySupported
    return (
      <div className="py-20">
        <div className="max-w-md mx-auto px-4">
          <div className="card p-8 text-center">
            <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-orange-500" />
            </div>

            {isCountryUnsupported ? (
              <>
                <h1 className="text-2xl font-bold mb-2">Not available yet</h1>
                <p className="text-gray-600 mb-6">
                  Satellite SMS isn&apos;t available in {selectedCountryName} yet. We&apos;ll notify you at <strong>{email}</strong> when it launches.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold mb-2">Carrier not supported</h1>
                <p className="text-gray-600 mb-4">
                  {selectedCarrierName} doesn&apos;t support satellite SMS yet in {selectedCountryName}.
                </p>
                {result.alternativeCarriers.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4 text-left mb-6">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Supported carriers in {selectedCountryName}:
                    </p>
                    <ul className="space-y-1">
                      {result.alternativeCarriers.map((carrier) => (
                        <li key={carrier.id} className="flex items-center gap-2 text-sm text-gray-600">
                          <Check className="w-3 h-3 text-green-500" />
                          {carrier.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {!showPurchaseAnyway ? (
              <div className="space-y-3">
                <button
                  onClick={() => setShowPurchaseAnyway(true)}
                  className="btn-orange w-full"
                >
                  Purchase now anyway?
                </button>
                <button
                  onClick={handleStartOver}
                  className="btn-secondary w-full"
                >
                  Check another combination
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 mb-3">
                  You can still purchase Thunderbird, but satellite SMS delivery is not guaranteed with your current setup.
                </p>
                <a
                  href="/create"
                  className="btn-orange w-full flex items-center justify-center gap-2"
                >
                  Yes, continue to purchase <ChevronRight className="w-4 h-4" />
                </a>
                <button
                  onClick={handleStartOver}
                  className="btn-secondary w-full"
                >
                  No, go back
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="py-20">
      <div className="max-w-md mx-auto px-4">
        <div className="text-center mb-8">
          <Satellite className="w-12 h-12 text-orange-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-4">Check Your Eligibility</h1>
          <p className="text-gray-600">
            Step {step} of 4
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3, 4].map(s => (
            <div
              key={s}
              className={`h-1 flex-1 rounded ${s <= step ? 'bg-orange-500' : 'bg-gray-200'}`}
            />
          ))}
        </div>

        <div className="card p-8">
          {/* Step 1: Country */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-4">Where is your phone plan based?</h2>
              <div className="space-y-3">
                {countries.map(country => (
                  <label
                    key={country.id}
                    className={`block p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedCountry === country.id
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="country"
                      value={country.id}
                      checked={selectedCountry === country.id}
                      onChange={(e) => {
                        setSelectedCountry(e.target.value)
                        setSelectedCarrier('')
                      }}
                      className="sr-only"
                    />
                    <div className="flex justify-between items-center">
                      <p className="font-medium">{country.name}</p>
                      {selectedCountry === country.id && (
                        <Check className="w-5 h-5 text-orange-500" />
                      )}
                    </div>
                  </label>
                ))}
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={!selectedCountry}
                className="btn-orange w-full flex items-center justify-center gap-2 disabled:opacity-50"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 2: Carrier */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-4">Who is your mobile carrier?</h2>
              <div className="space-y-3">
                {countryCarriers.map(carrier => (
                  <label
                    key={carrier.id}
                    className={`block p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedCarrier === carrier.id
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="carrier"
                      value={carrier.id}
                      checked={selectedCarrier === carrier.id}
                      onChange={(e) => setSelectedCarrier(e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex justify-between items-center">
                      <p className="font-medium">{carrier.name}</p>
                      {selectedCarrier === carrier.id && (
                        <Check className="w-5 h-5 text-orange-500" />
                      )}
                    </div>
                  </label>
                ))}
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
                  disabled={!selectedCarrier}
                  className="btn-orange flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Destination Country */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-4">Which country are you hiking in?</h2>
              <div className="space-y-3">
                {countries.map(country => (
                  <label
                    key={country.id}
                    className={`block p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedDestination === country.id
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name="destination"
                      value={country.id}
                      checked={selectedDestination === country.id}
                      onChange={(e) => setSelectedDestination(e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex justify-between items-center">
                      <p className="font-medium">{country.name}</p>
                      {selectedDestination === country.id && (
                        <Check className="w-5 h-5 text-orange-500" />
                      )}
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="btn-secondary flex items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={() => setStep(4)}
                  disabled={!selectedDestination}
                  className="btn-orange flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Email + Submit */}
          {step === 4 && (
            <form onSubmit={handleCheckEligibility} className="space-y-6">
              <h2 className="text-xl font-semibold mb-4">Your email address</h2>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hiker@example.com"
                  className="w-full bg-gray-100 border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                  required
                />
                <p className="text-gray-400 text-sm mt-2">
                  We&apos;ll notify you about service updates for your carrier.
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                <p className="font-medium text-gray-700 mb-1">Your selections:</p>
                <p>Country: {selectedCountryName}</p>
                <p>Carrier: {selectedCarrierName}</p>
                <p>Hiking in: {countries.find(c => c.id === selectedDestination)?.name}</p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="btn-secondary flex items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button
                  type="submit"
                  disabled={!email}
                  className="btn-orange flex-1 disabled:opacity-50"
                >
                  Check Eligibility
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
