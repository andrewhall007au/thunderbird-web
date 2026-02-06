'use client';

import { useState } from 'react';
import { CheckCircle2, AlertCircle, XCircle, RotateCcw } from 'lucide-react';

const SATELLITE_DATA = {
  countries: {
    US: { name: "USA", appleSatelliteCountry: true, starlinkStatus: "live" },
    AU: { name: "Australia", appleSatelliteCountry: false, starlinkStatus: "live" },
    CA: { name: "Canada", appleSatelliteCountry: true, starlinkStatus: "live" },
    NZ: { name: "New Zealand", appleSatelliteCountry: false, starlinkStatus: "live" },
    UA: { name: "Ukraine", appleSatelliteCountry: false, starlinkStatus: "live" },
    JP: { name: "Japan", appleSatelliteCountry: true, starlinkStatus: "2026" },
    CH: { name: "Switzerland", appleSatelliteCountry: false, starlinkStatus: "2026" },
    UK: { name: "United Kingdom", appleSatelliteCountry: false, starlinkStatus: "2026" },
    CL: { name: "Chile", appleSatelliteCountry: false, starlinkStatus: "2026" },
    PE: { name: "Peru", appleSatelliteCountry: false, starlinkStatus: "2026" },
    ES: { name: "Spain", appleSatelliteCountry: false, starlinkStatus: "2026" },
    MX: { name: "Mexico", appleSatelliteCountry: true, starlinkStatus: "none", special: "limited" },
    OTHER: { name: "Other / Not listed", appleSatelliteCountry: false, starlinkStatus: "none" }
  },
  carriers: {
    US: [
      { name: "T-Mobile", starlinkPartner: true, isLive: true, appleSatelliteSMS: true },
      { name: "AT&T", starlinkPartner: false, isLive: false, appleSatelliteSMS: true },
      { name: "Verizon", starlinkPartner: false, isLive: false, appleSatelliteSMS: true },
      { name: "Other US carrier", starlinkPartner: false, isLive: false, appleSatelliteSMS: false }
    ],
    CA: [
      { name: "Rogers", starlinkPartner: true, isLive: true, appleSatelliteSMS: true },
      { name: "Bell", starlinkPartner: false, isLive: false, appleSatelliteSMS: true },
      { name: "Telus", starlinkPartner: false, isLive: false, appleSatelliteSMS: true },
      { name: "Other Canadian carrier", starlinkPartner: false, isLive: false, appleSatelliteSMS: false }
    ],
    AU: [
      { name: "Telstra", starlinkPartner: true, isLive: true, appleSatelliteSMS: false },
      { name: "Optus", starlinkPartner: true, isLive: false, appleSatelliteSMS: false },
      { name: "Other Australian carrier", starlinkPartner: false, isLive: false, appleSatelliteSMS: false }
    ],
    NZ: [
      { name: "One NZ", starlinkPartner: true, isLive: true, appleSatelliteSMS: false },
      { name: "Spark", starlinkPartner: false, isLive: false, appleSatelliteSMS: false },
      { name: "2degrees", starlinkPartner: false, isLive: false, appleSatelliteSMS: false },
      { name: "Other NZ carrier", starlinkPartner: false, isLive: false, appleSatelliteSMS: false }
    ],
    JP: [
      { name: "KDDI (au)", starlinkPartner: true, isLive: false, appleSatelliteSMS: false, unconfirmed: true },
      { name: "NTT Docomo", starlinkPartner: false, isLive: false, appleSatelliteSMS: false },
      { name: "SoftBank", starlinkPartner: false, isLive: false, appleSatelliteSMS: false },
      { name: "Rakuten Mobile", starlinkPartner: false, isLive: false, appleSatelliteSMS: false },
      { name: "Other Japanese carrier", starlinkPartner: false, isLive: false, appleSatelliteSMS: false }
    ],
    CH: [
      { name: "Salt", starlinkPartner: true, isLive: false, appleSatelliteSMS: false },
      { name: "Other Swiss carrier", starlinkPartner: false, isLive: false, appleSatelliteSMS: false }
    ],
    UK: [
      { name: "Virgin Media O2", starlinkPartner: true, isLive: false, appleSatelliteSMS: false },
      { name: "Other UK carrier", starlinkPartner: false, isLive: false, appleSatelliteSMS: false }
    ],
    CL: [
      { name: "Entel", starlinkPartner: true, isLive: false, appleSatelliteSMS: false },
      { name: "Other Chilean carrier", starlinkPartner: false, isLive: false, appleSatelliteSMS: false }
    ],
    PE: [
      { name: "Entel", starlinkPartner: true, isLive: false, appleSatelliteSMS: false },
      { name: "Other Peruvian carrier", starlinkPartner: false, isLive: false, appleSatelliteSMS: false }
    ],
    ES: [
      { name: "MasOrange", starlinkPartner: true, isLive: false, appleSatelliteSMS: false },
      { name: "Other Spanish carrier", starlinkPartner: false, isLive: false, appleSatelliteSMS: false }
    ],
    UA: [
      { name: "Kyivstar", starlinkPartner: true, isLive: true, appleSatelliteSMS: false },
      { name: "Other Ukrainian carrier", starlinkPartner: false, isLive: false, appleSatelliteSMS: false }
    ],
    MX: [
      { name: "Telcel", starlinkPartner: false, isLive: false, appleSatelliteSMS: false },
      { name: "AT&T Mexico", starlinkPartner: false, isLive: false, appleSatelliteSMS: false },
      { name: "Movistar", starlinkPartner: false, isLive: false, appleSatelliteSMS: false },
      { name: "Other Mexican carrier", starlinkPartner: false, isLive: false, appleSatelliteSMS: false }
    ],
    OTHER: [
      { name: "My carrier", starlinkPartner: false, isLive: false, appleSatelliteSMS: false }
    ]
  }
};

type PhoneType = 'iphone' | 'android' | 'older' | null;

export default function SatelliteChecker() {
  const [country, setCountry] = useState<string | null>(null);
  const [phone, setPhone] = useState<PhoneType>(null);
  const [carrier, setCarrier] = useState<string | null>(null);

  const reset = () => {
    setCountry(null);
    setPhone(null);
    setCarrier(null);
  };

  const getResults = () => {
    if (!country || !phone || !carrier) return null;

    const countryData = SATELLITE_DATA.countries[country as keyof typeof SATELLITE_DATA.countries];
    const carriers = SATELLITE_DATA.carriers[country as keyof typeof SATELLITE_DATA.carriers];
    const carrierData = carriers?.find(c => c.name === carrier);

    // Apple Satellite SMS logic
    let appleSatelliteStatus: 'available' | 'unconfirmed' | 'noCarrierSupport' | 'notAvailable' | 'mexicoSpecial' | null = null;

    if (phone === 'iphone') {
      if (country === 'MX') {
        appleSatelliteStatus = 'mexicoSpecial';
      } else if (!countryData.appleSatelliteCountry) {
        appleSatelliteStatus = 'notAvailable';
      } else if (carrierData?.appleSatelliteSMS) {
        appleSatelliteStatus = 'available';
      } else if (carrierData?.unconfirmed) {
        appleSatelliteStatus = 'unconfirmed';
      } else {
        appleSatelliteStatus = 'noCarrierSupport';
      }
    }

    // Starlink D2C logic
    let starlinkStatus: 'available' | 'coming2026' | 'checkCarrier' | 'notAvailable' | null = null;

    if (phone !== 'older') {
      if (countryData.starlinkStatus === 'live' && carrierData?.starlinkPartner && carrierData?.isLive) {
        starlinkStatus = 'available';
      } else if ((countryData.starlinkStatus === 'live' && carrierData?.starlinkPartner && !carrierData?.isLive) ||
                 (countryData.starlinkStatus === '2026' && carrierData?.starlinkPartner)) {
        starlinkStatus = 'coming2026';
      } else if (carrier?.includes('Other') || carrier === 'My carrier') {
        starlinkStatus = 'checkCarrier';
      } else {
        starlinkStatus = 'notAvailable';
      }
    }

    const hasAvailable = appleSatelliteStatus === 'available' || starlinkStatus === 'available';
    const hasComing = appleSatelliteStatus === 'coming2026' || appleSatelliteStatus === 'unconfirmed' || starlinkStatus === 'coming2026';
    const isOlderPhone = phone === 'older';
    const isMexicoSpecial = country === 'MX';

    return {
      appleSatelliteStatus,
      starlinkStatus,
      hasAvailable,
      hasComing,
      isOlderPhone,
      isMexicoSpecial,
      countryName: countryData.name,
      carrierData
    };
  };

  const results = getResults();

  const availableNowCountries = ['US', 'AU', 'CA', 'NZ', 'UA'];
  const launching2026Countries = ['JP', 'CH', 'UK', 'CL', 'PE', 'ES'];
  const limitedCountries = ['MX'];

  return (
    <div className="bg-gradient-to-b from-stone-50 to-white rounded-2xl border border-stone-200 p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Step 1: Country */}
        <div className="mb-8">
          <label className="block text-lg font-medium text-stone-800 mb-3">
            Where are you hiking?
          </label>
          <select
            value={country || ''}
            onChange={(e) => {
              setCountry(e.target.value);
              setCarrier(null);
            }}
            className="w-full px-4 py-3 bg-white border-2 border-stone-300 rounded-lg text-stone-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 focus:outline-none transition-colors"
          >
            <option value="">Select your hiking destination...</option>
            <optgroup label="Available now">
              {availableNowCountries.map(code => (
                <option key={code} value={code}>
                  {SATELLITE_DATA.countries[code as keyof typeof SATELLITE_DATA.countries].name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Launching 2026">
              {launching2026Countries.map(code => (
                <option key={code} value={code}>
                  {SATELLITE_DATA.countries[code as keyof typeof SATELLITE_DATA.countries].name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Limited">
              {limitedCountries.map(code => (
                <option key={code} value={code}>
                  {SATELLITE_DATA.countries[code as keyof typeof SATELLITE_DATA.countries].name}
                </option>
              ))}
            </optgroup>
            <option value="OTHER">Other / Not listed</option>
          </select>
        </div>

        {/* Step 2: Phone */}
        {country && (
          <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
            <label className="block text-lg font-medium text-stone-800 mb-3">
              What phone do you have?
            </label>
            <div className="space-y-3">
              {[
                { value: 'iphone', label: 'iPhone 14 or newer' },
                { value: 'android', label: 'Android (Samsung Galaxy S21+, Pixel 9+, or recent Motorola/flagship)' },
                { value: 'older', label: 'Older phone / Not sure' }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setPhone(option.value as PhoneType);
                    setCarrier(null);
                  }}
                  className={`w-full px-4 py-3 text-left rounded-lg border-2 transition-all ${
                    phone === option.value
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                      : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Carrier */}
        {country && phone && phone !== 'older' && (
          <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
            <label className="block text-lg font-medium text-stone-800 mb-3">
              Who is your mobile carrier?
            </label>
            <select
              value={carrier || ''}
              onChange={(e) => setCarrier(e.target.value)}
              className="w-full px-4 py-3 bg-white border-2 border-stone-300 rounded-lg text-stone-800 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 focus:outline-none transition-colors"
            >
              <option value="">Select your carrier...</option>
              {SATELLITE_DATA.carriers[country as keyof typeof SATELLITE_DATA.carriers]?.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="mt-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className={`border-l-4 rounded-lg p-6 ${
              results.isOlderPhone ? 'border-amber-500 bg-amber-50' :
              results.hasAvailable ? 'border-emerald-600 bg-emerald-50' :
              results.hasComing ? 'border-amber-500 bg-amber-50' :
              'border-red-500 bg-red-50'
            }`}>
              {/* Overall summary */}
              <div className="mb-6">
                <p className="text-lg font-semibold text-stone-800 mb-2">
                  {results.isOlderPhone ?
                    'Phone compatibility unclear' :
                    results.isMexicoSpecial ?
                    'Apple satellite messaging exists in Mexico but no carriers have confirmed SMS gateway support. Thunderbird forecasts cannot be delivered via satellite in Mexico yet.' :
                    results.hasAvailable ?
                    'Great news! You should be able to receive Thunderbird weather forecasts via satellite on your trip.' :
                    results.hasComing ?
                    'Satellite coverage for your setup is expected in 2026. Sign up to be notified when it\'s available.' :
                    'Satellite weather isn\'t available for your setup yet. Consider a satellite messenger device like Garmin inReach as an alternative.'
                  }
                </p>
              </div>

              {/* Apple Satellite */}
              {results.appleSatelliteStatus && (
                <div className="mb-4 pb-4 border-b border-stone-200">
                  <div className="flex items-start gap-3">
                    {results.appleSatelliteStatus === 'available' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : results.appleSatelliteStatus === 'unconfirmed' ? (
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-medium text-stone-800">Apple Satellite SMS</p>
                      <p className="text-sm text-stone-600 mt-1">
                        {results.appleSatelliteStatus === 'available' ?
                          'Available — Your carrier supports SMS via satellite. Thunderbird can deliver forecasts through Apple\'s satellite network.' :
                          results.appleSatelliteStatus === 'unconfirmed' ?
                          'Unconfirmed — Carrier satellite support is unclear. Check with your carrier.' :
                          results.appleSatelliteStatus === 'noCarrierSupport' ?
                          'Not available — Your carrier hasn\'t enabled SMS via satellite yet.' :
                          results.appleSatelliteStatus === 'mexicoSpecial' ?
                          'Not available — No carriers in Mexico have confirmed SMS gateway support.' :
                          `Not available in ${results.countryName}`
                        }
                      </p>
                      {results.appleSatelliteStatus === 'available' && (
                        <p className="text-xs text-stone-500 mt-2 italic">
                          Requires iPhone 14 or newer with iOS 18+. You need to text Thunderbird first before we can deliver forecasts to you via satellite.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Starlink Direct-to-Cell */}
              {results.starlinkStatus && (
                <div className="mb-4">
                  <div className="flex items-start gap-3">
                    {results.starlinkStatus === 'available' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : results.starlinkStatus === 'coming2026' || results.starlinkStatus === 'checkCarrier' ? (
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-medium text-stone-800">Starlink Direct-to-Cell</p>
                      <p className="text-sm text-stone-600 mt-1">
                        {results.starlinkStatus === 'available' ?
                          'Available — Your carrier supports Starlink satellite messaging.' :
                          results.starlinkStatus === 'coming2026' ?
                          'Coming 2026 — Expected to launch on your carrier this year.' :
                          results.starlinkStatus === 'checkCarrier' ?
                          'Check with carrier — Contact your carrier to confirm satellite messaging availability.' :
                          'Not yet available — Your carrier doesn\'t currently offer satellite messaging.'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Older phone message */}
              {results.isOlderPhone && (
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-stone-700">
                      Your phone may not support satellite messaging. Check your device specifications or contact us for help.
                    </p>
                  </div>
                </div>
              )}

              {/* Reset button */}
              <div className="mt-6 pt-4 border-t border-stone-200">
                <button
                  onClick={reset}
                  className="flex items-center gap-2 text-sm text-stone-600 hover:text-stone-800 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Start over
                </button>
              </div>
            </div>

            <p className="text-xs text-stone-400 mt-4 text-center">
              Last updated: February 2026
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
