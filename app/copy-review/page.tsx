'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

const variations = [
  {
    id: 'A',
    label: 'Variation A — "Precision"',
    headline: 'Introducing Thunderbird.',
    subheadline: 'Precision weather forecasts delivered by satellite SMS.',
    points: [
      'Works with your existing phone — no extra hardware needed',
      'Hour-by-hour detail: temp, rain, wind, cloud base, freezing level',
      '25+ popular trails built in, or upload your own GPX',
      'One-time purchase with pay-as-you-go credits. No subscriptions.',
    ],
    compatibility: 'Compatible with iPhone 14+, Apple Watch Ultra, Samsung Galaxy S25+, and Garmin inReach.',
  },
  {
    id: 'B',
    label: 'Variation B — "Backcountry"',
    headline: 'Introducing Thunderbird.',
    subheadline: 'Backcountry weather forecasts via satellite SMS — no cell service required.',
    points: [
      'Use your existing phone or watch. No extra devices to buy.',
      'Elevation-specific forecasts with hour-by-hour precision',
      'Choose from 25+ iconic trails or upload a custom GPX route',
      'No subscriptions. Buy once, top up when you need more.',
    ],
    compatibility: 'Works with iPhone 14+, Apple Watch Ultra, Galaxy S25+, and Garmin inReach devices.',
  },
  {
    id: 'C',
    label: 'Variation C — "Direct"',
    headline: 'Introducing Thunderbird.',
    subheadline: 'Detailed weather forecasts sent directly to your phone via satellite.',
    points: [
      'Use the phone you already carry — no extra gear required',
      'Full forecasts: temperature, rain, wind, cloud base, and freezing level',
      'Pick from our trail library or create a route with your own GPX file',
      'Pay as you go. No subscription. No monthly fees.',
    ],
    compatibility: 'Supports iPhone 14+, Apple Watch Ultra, Samsung Galaxy S25+, and Garmin inReach.',
  },
];

function PhoneMockup({ variation }: { variation: typeof variations[0] }) {
  return (
    <div className="bg-zinc-800 rounded-[2.5rem] p-3 shadow-2xl w-[320px] mx-auto">
      {/* Notch */}
      <div className="flex justify-center mb-1">
        <div className="w-24 h-5 bg-zinc-900 rounded-full" />
      </div>
      {/* Screen */}
      <div className="bg-white rounded-[2rem] overflow-hidden">
        <div className="px-5 pt-12 pb-8">
          {/* Hero content */}
          <div className="text-center">
            <h1 className="text-[22px] font-medium tracking-tight leading-tight mb-1">
              <span className="text-zinc-900">{variation.headline}</span>
            </h1>
            <p className="text-[15px] text-zinc-500 leading-snug mb-5">
              {variation.subheadline}
            </p>

            <ul className="text-left space-y-3 mb-5">
              {variation.points.map((point, i) => (
                <li key={i} className="flex gap-2.5 text-[13px] text-zinc-600 leading-snug">
                  <span className="text-orange-500 font-bold mt-0.5 shrink-0">—</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>

            <p className="text-[11px] text-zinc-400 leading-relaxed mb-6">
              {variation.compatibility}
            </p>

            <button className="w-full bg-orange-500 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 text-[15px]">
              Buy Now
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CopyReviewPage() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-zinc-900 py-10 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-white mb-2">Hero Copy Review</h1>
          <p className="text-zinc-400 text-sm">
            Compare 3 variations of the mobile hero section. Click to select your preferred option.
          </p>
        </div>

        {/* Side by side on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {variations.map((v) => (
            <div key={v.id} className="flex flex-col items-center">
              <h2 className="text-sm font-semibold text-zinc-300 mb-4">{v.label}</h2>
              <div
                onClick={() => setSelected(v.id)}
                className={`cursor-pointer transition-all rounded-[2.75rem] p-1 ${
                  selected === v.id
                    ? 'ring-4 ring-orange-500 scale-[1.02]'
                    : 'hover:ring-2 hover:ring-zinc-600'
                }`}
              >
                <PhoneMockup variation={v} />
              </div>
              {selected === v.id && (
                <div className="mt-3 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  SELECTED
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Copy text for reference */}
        <div className="mt-16 max-w-4xl mx-auto space-y-8">
          <h2 className="text-lg font-semibold text-white text-center mb-6">Full Copy Text</h2>
          {variations.map((v) => (
            <div key={v.id} className="bg-zinc-800 rounded-xl p-6">
              <h3 className="text-sm font-bold text-orange-400 mb-3">{v.label}</h3>
              <div className="text-zinc-300 text-sm space-y-2">
                <p className="font-medium text-white">{v.headline} {v.subheadline}</p>
                {v.points.map((p, i) => (
                  <p key={i} className="text-zinc-400">— {p}</p>
                ))}
                <p className="text-zinc-500 text-xs mt-2">{v.compatibility}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
