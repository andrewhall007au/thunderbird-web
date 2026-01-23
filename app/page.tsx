'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link'
import dynamic from 'next/dynamic';
import { initPathTracking, trackPageView } from '@/app/lib/analytics';
import {
  Zap, Satellite, CloudRain, Shield, Bell, Clock,
  MapPin, Thermometer, Wind, Droplets, Mountain, Smartphone,
  Cloud, Snowflake, AlertTriangle, Navigation, Save, MessageSquare,
  Tent, BatteryCharging, ChevronRight, ExternalLink, Mail
} from 'lucide-react'
import { BetaButton } from './components/beta/BetaButton'

const MapEditor = dynamic(() => import('./components/map/MapEditor'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] bg-zinc-100 rounded-2xl flex items-center justify-center">
      <div className="flex items-center gap-2 text-zinc-400">
        <div className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-500 rounded-full animate-spin" />
        <span className="text-sm">Loading map...</span>
      </div>
    </div>
  )
});

// Demo sequence showing the full user experience
const demoSequence = [
  {
    command: 'CAST12 LAKEO',
    label: '12 Hour Forecast',
    phone: `CAST12 LAKEO 863m
-41.8921, 146.0820
Light 06:00-20:51
12 hour detailed forecast

06h 5-7o Rn15% 0-1mm W12-20 Cld40% CB12 FL28

07h 6-8o Rn15% 0-1mm W13-21 Cld42% CB12 FL27

08h 7-10o Rn18% 0-2mm W14-22 Cld45% CB12 FL26

09h 9-12o Rn20% 0-2mm W15-24 Cld48% CB11 FL25

10h 10-14o Rn22% 0-3mm W16-26 Cld52% CB11 FL24

11h 11-15o Rn24% 0-3mm W17-28 Cld56% CB10 FL23

12h 12-16o Rn25% 1-4mm W18-30 Cld60% CB10 FL22

Rn=Rain W=Wind Cld=Cloud
CB=CloudBase FL=Freeze(x100m)`,
    watch: `CAST12 LAKEO 863m
-41.8921, 146.0820
12hr detailed forecast

06h 5-7o Rn15% 0-1mm
W12-20 CB12 FL28

07h 6-8o Rn15% 0-1mm
W13-21 CB12 FL27

08h 7-10o Rn18% 0-2mm
W14-22 CB12 FL26

09h 9-12o Rn20% 0-2mm
W15-24 CB11 FL25`,
  },
  {
    command: 'CAST7 LAKEO',
    label: '7 Day Forecast',
    phone: `CAST7 LAKEO 863m
-41.8921, 146.0820
7-Day Forecast

Mon 4-12o Rn15% W10-25 Cld35%

Tue 6-14o Rn25% 0-2mm W12-28 Cld55%

Wed 3-9o Rn65% 4-12mm W20-45 Cld85%

Thu 2-8o Rn45% 2-6mm W18-38 Cld70%

Fri 5-13o Rn20% W8-22 Cld40%

Sat 7-16o Rn10% W6-18 Cld25%

Sun 8-17o Rn5% W5-15 Cld20%

Rn=Rain W=Wind Cld=Cloud`,
    watch: `CAST7 LAKEO 863m
-41.8921, 146.0820

Mon 4-12o Rn15% W10-25

Tue 6-14o Rn25% W12-28

Wed 3-9o Rn65% W20-45

Thu 2-8o Rn45% W18-38

Fri 5-13o Rn20% W8-22

Sat 7-16o Rn10% W6-18

Sun 8-17o Rn5% W5-15`,
  },
  {
    command: 'CAST12 -41.89, 146.08',
    label: 'GPS Forecast',
    phone: `CAST12 -41.89, 146.08
Elevation: 863m
12 hour detailed forecast

06h 5-7o Rn15% 0-1mm W12-20 Cld40% CB12 FL28

07h 6-8o Rn15% 0-1mm W13-21 Cld42% CB12 FL27

08h 7-10o Rn18% 0-2mm W14-22 Cld45% CB12 FL26

09h 9-12o Rn20% 0-2mm W15-24 Cld48% CB11 FL25

10h 10-14o Rn22% 0-3mm W16-26 Cld52% CB11 FL24

11h 11-15o Rn24% 0-3mm W17-28 Cld56% CB10 FL23

12h 12-16o Rn25% 1-4mm W18-30 Cld60% CB10 FL22

Rn=Rain W=Wind Cld=Cloud
CB=CloudBase FL=Freeze(x100m)`,
    watch: `CAST12 -41.89, 146.08
Elevation: 863m

06h 5-7o Rn15% 0-1mm
W12-20 CB12 FL28

07h 6-8o Rn15% 0-1mm
W13-21 CB12 FL27

08h 7-10o Rn18% 0-2mm
W14-22 CB12 FL26

09h 9-12o Rn20% 0-2mm
W15-24 CB11 FL25`,
  },
];

function DevicePreviews() {
  const [sequenceIndex, setSequenceIndex] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'sending' | 'response'>('typing');
  const [typedChars, setTypedChars] = useState(0);

  const current = demoSequence[sequenceIndex];
  const command = current.command;

  // Use refs to avoid stale closure issues
  const phaseRef = useRef(phase);
  const typedCharsRef = useRef(typedChars);
  const sequenceIndexRef = useRef(sequenceIndex);

  phaseRef.current = phase;
  typedCharsRef.current = typedChars;
  sequenceIndexRef.current = sequenceIndex;

  useEffect(() => {
    const commandLength = demoSequence[sequenceIndexRef.current].command.length;

    const tick = () => {
      const currentPhase = phaseRef.current;
      const currentTyped = typedCharsRef.current;
      const currentCommand = demoSequence[sequenceIndexRef.current].command;

      if (currentPhase === 'typing') {
        if (currentTyped < currentCommand.length) {
          setTypedChars(prev => prev + 1);
        } else {
          setPhase('sending');
        }
      } else if (currentPhase === 'sending') {
        setPhase('response');
      } else if (currentPhase === 'response') {
        // Move to next in sequence
        const nextIndex = (sequenceIndexRef.current + 1) % demoSequence.length;
        setSequenceIndex(nextIndex);
        setPhase('typing');
        setTypedChars(0);
      }
    };

    // Different intervals for different phases
    const getInterval = () => {
      if (phaseRef.current === 'typing') return 80; // typing speed
      if (phaseRef.current === 'sending') return 800; // pause before response
      return 4000; // show response for 4 seconds
    };

    const interval = setInterval(tick, getInterval());
    return () => clearInterval(interval);
  }, [phase]); // Re-create interval when phase changes to get new timing

  const displayedCommand = command.slice(0, typedChars);

  return (
    <div className="mb-8 md:mb-12">
      <div className="flex flex-col md:flex-row justify-center items-center gap-6 md:gap-8">
        {/* iPhone */}
        <div className="flex flex-col items-center">
          <div className="text-center mb-3">
            <span className="text-xs font-medium text-zinc-500 bg-zinc-100 px-3 py-1 rounded-full transition-all">
              {phase === 'response' ? current.label : 'Live Demo'}
            </span>
          </div>
          <div className="w-[260px] h-[520px] bg-zinc-900 rounded-[40px] p-3 shadow-2xl shadow-zinc-900/20 relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-zinc-900 rounded-b-2xl" />
            <div className="w-full h-full bg-zinc-50 rounded-[32px] overflow-hidden flex flex-col">
              <div className="bg-zinc-100 pt-10 pb-2 px-4 text-center border-b border-zinc-200">
                <span className="text-zinc-900 text-sm font-medium">Thunderbird</span>
              </div>
              <div className="flex-1 p-3 overflow-hidden flex flex-col justify-start gap-2">
                {/* User's sent message */}
                {(phase === 'typing' || phase === 'sending') && (
                  <div className="flex justify-end">
                    <div className="bg-orange-500 text-white p-3 rounded-2xl rounded-br-sm max-w-[85%] text-xs font-mono min-w-[20px] min-h-[20px]">
                      {displayedCommand || '\u00A0'}
                      {phase === 'typing' && <span className="animate-pulse">|</span>}
                    </div>
                  </div>
                )}
                {phase === 'sending' && (
                  <div className="flex justify-end">
                    <span className="text-[10px] text-zinc-400 mr-2">Sending via satellite...</span>
                  </div>
                )}
                {/* Response */}
                {phase === 'response' && (
                  <>
                    <div className="flex justify-end mb-1">
                      <div className="bg-orange-500 text-white p-2 rounded-2xl rounded-br-sm text-xs font-mono">
                        {command}
                      </div>
                    </div>
                    <div className="bg-zinc-200 text-zinc-800 rounded-2xl rounded-bl-sm max-w-[95%] overflow-hidden max-h-[280px]">
                      <div className="p-3 text-xs leading-relaxed font-mono whitespace-pre-wrap animate-scroll-up">
                        {current.phone}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <span className="text-zinc-400 text-xs mt-4">iPhone 14+</span>
        </div>

        {/* Apple Watch */}
        <div className="flex flex-col items-center">
          <div className="text-center mb-3">
            <span className="text-xs font-medium text-zinc-500 bg-zinc-100 px-3 py-1 rounded-full transition-all">
              {phase === 'response' ? current.label : 'Live Demo'}
            </span>
          </div>
          <div className="w-[260px] h-[320px] bg-zinc-800 rounded-[44px] p-2 shadow-xl shadow-zinc-900/20 border-2 border-zinc-700 relative">
            <div className="absolute right-[-6px] top-20 w-2 h-10 bg-zinc-600 rounded-r-sm" />
            <div className="w-full h-full bg-black rounded-[38px] overflow-hidden flex flex-col p-3 justify-end">
              {/* User's sent message */}
              {(phase === 'typing' || phase === 'sending') && (
                <div className="mb-2">
                  <div className="bg-orange-500 text-white p-2 rounded-xl text-[10px] font-mono inline-block min-w-[16px] min-h-[16px]">
                    {displayedCommand || '\u00A0'}
                    {phase === 'typing' && <span className="animate-pulse">|</span>}
                  </div>
                  {phase === 'sending' && (
                    <div className="text-[9px] text-zinc-500 mt-1">Sending...</div>
                  )}
                </div>
              )}
              {/* Response */}
              {phase === 'response' && (
                <div className="overflow-hidden max-h-[240px]">
                  <div className="text-zinc-100 text-[11px] leading-relaxed font-mono whitespace-pre-wrap animate-scroll-up-watch">
                    {current.watch}
                  </div>
                </div>
              )}
            </div>
          </div>
          <span className="text-zinc-400 text-xs mt-4">Apple Watch Ultra 3</span>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative pt-20 pb-6 lg:pt-32 lg:pb-40 overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-50 via-white to-white" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.08),transparent)]" />

      <div className="relative max-w-5xl mx-auto px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-medium tracking-tight text-center max-w-4xl mx-auto mb-4 md:mb-6 leading-tight">
            <span className="text-zinc-900">Introducing Thunderbird.</span>
            <br />
            <span className="text-zinc-500">Hyper-detailed weather forecasts delivered by satellite SMS.</span>
          </h1>

          <ul className="text-lg text-zinc-600 max-w-2xl mx-auto mb-5 leading-relaxed space-y-3 text-left px-4">
            <li className="flex gap-3"><span className="text-orange-500 font-bold shrink-0">—</span>Works with your existing phone — no extra hardware needed</li>
            <li className="flex gap-3"><span className="text-orange-500 font-bold shrink-0">—</span>Hour-by-hour detail: temp, rain, wind, cloud base, freezing level</li>
            <li className="flex gap-3"><span className="text-orange-500 font-bold shrink-0">—</span>25+ popular trails built in, or upload your own GPX</li>
            <li className="flex gap-3"><span className="text-orange-500 font-bold shrink-0">—</span>One-time purchase with pay-as-you-go credits. No subscriptions.</li>
          </ul>
          <p className="text-sm text-zinc-400 max-w-xl mx-auto mb-8 md:mb-10">
            Compatible with iPhone 14+, Apple Watch Ultra, Samsung Galaxy S25+, and Garmin inReach.
          </p>

          {/* CTA after bullet points */}
          <div className="flex items-center justify-center mb-10">
            <BetaButton />
          </div>

          {/* SMS Weather Forecast Example Title */}
          <div className="text-center mb-6">
            <h3 className="text-sm font-semibold text-zinc-600 uppercase tracking-wide">SMS Weather Forecast Example</h3>
          </div>

          {/* Device Previews - Animated */}
          <DevicePreviews />

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-3">
            <BetaButton />
          </div>
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const optionA = [
    {
      icon: Navigation,
      step: '01',
      title: 'Set waypoints',
      description: 'Mark camps, peaks, and key locations along your route with precise elevations.'
    },
    {
      icon: Save,
      step: '02',
      title: 'Save your route',
      description: 'Each waypoint gets a unique SMS code. Upload GPX or build from scratch.'
    },
    {
      icon: MessageSquare,
      step: '03',
      title: 'Request forecasts',
      description: 'Text your waypoint code via satellite SMS. Receive detailed weather within minutes.'
    }
  ];

  return (
    <section id="how-it-works" className="pt-12 pb-24 md:py-24 bg-white scroll-mt-20">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 mb-4">
            How it works
          </h2>
          <p className="text-zinc-500 max-w-xl mx-auto">
            Two ways to get forecasts: pre-configure your route or text GPS coordinates on the fly.
          </p>
        </div>

        {/* Pre-configure route */}
        <div className="mb-12">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-6 text-center">Pre-configure before departure</p>
          <div className="grid md:grid-cols-3 gap-8">
            {optionA.map((item, i) => (
              <div key={i} className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center mb-5">
                    <item.icon className="w-5 h-5 text-zinc-600" />
                  </div>
                  <span className="text-xs font-medium text-zinc-400 mb-2">{item.step}</span>
                  <h3 className="text-lg font-medium text-zinc-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-zinc-500 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-zinc-200 pt-12">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-6 text-center">Or text GPS coordinates on trail</p>
          <div className="max-w-xl mx-auto text-center">
            <p className="text-zinc-600 mb-4">
              No pre-planning needed. Text your GPS coordinates from anywhere and get an instant forecast.
            </p>
            <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-4 font-mono text-sm mb-6">
              <span className="text-zinc-500">Send:</span> <span className="text-zinc-900">CAST -41.89, 146.08</span>
            </div>
            <ul className="text-sm text-zinc-500 space-y-2">
              <li className="flex items-center justify-center gap-2"><span className="text-orange-500 font-bold">—</span>Unplanned detours or route changes</li>
              <li className="flex items-center justify-center gap-2"><span className="text-orange-500 font-bold">—</span>Checking conditions at your current position</li>
              <li className="flex items-center justify-center gap-2"><span className="text-orange-500 font-bold">—</span>Exploring new areas without pre-setup</li>
            </ul>
          </div>
        </div>

        <div className="text-center mt-12">
          <BetaButton />
        </div>
      </div>
    </section>
  )
}

function WhySMS() {
  const benefits = [
    {
      icon: Satellite,
      title: "Works everywhere",
      description: "Works anywhere with sky visibility — no cell towers, no data plan. A single forecast uses less than 1KB."
    },
    {
      icon: BatteryCharging,
      title: "Battery efficient",
      description: "SMS uses a fraction of the power of a data connection. Your phone stays alive longer on trail."
    },
    {
      icon: Shield,
      title: "Reliable delivery",
      description: "SMS routes through every satellite provider. Data doesn't. Your forecast gets through."
    }
  ];

  return (
    <section id="why-sms" className="py-24 bg-zinc-50 scroll-mt-20">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 mb-4">
            Why SMS?
          </h2>
          <p className="text-zinc-500 max-w-xl mx-auto">
            Designed for the backcountry — reliable, fast, and works with minimal sky visibility.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {benefits.map((benefit, i) => (
            <div key={i} className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm text-center">
              <div className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center mb-4 mx-auto">
                <benefit.icon className="w-5 h-5 text-zinc-600" />
              </div>
              <h3 className="font-medium text-zinc-900 mb-2">{benefit.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{benefit.description}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <BetaButton />
        </div>
      </div>
    </section>
  )
}

function CompatibleDevices() {
  return (
    <section id="compatible-devices" className="py-24 bg-white scroll-mt-20">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 mb-4">
            Compatible devices
          </h2>
          <p className="text-zinc-500 max-w-xl mx-auto">
            Works with your existing satellite-capable phone or dedicated device.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-8 max-w-4xl mx-auto">
          {/* Apple Satellite */}
          <div className="flex flex-col items-center">
            <div className="w-full h-[200px] bg-gradient-to-br from-zinc-100 to-zinc-200 rounded-2xl p-4 shadow-lg border border-zinc-300 flex flex-col justify-start pt-6">
              <div className="text-center mb-3">
                <div className="h-10 flex items-end justify-center mb-2">
                  <svg className="w-8 h-8 text-zinc-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                </div>
                <span className="text-xs font-semibold text-zinc-700">Apple</span>
              </div>
              <div className="space-y-2 text-[11px] text-zinc-600 text-center">
                <div>iPhone 14, 15, 16</div>
                <div>Apple Watch Ultra 3</div>
                <div className="text-zinc-500 text-[10px] mt-2">Built-in satellite SMS<br />No carrier required</div>
              </div>
            </div>
            <span className="text-zinc-400 text-xs mt-4">Apple Satellite SMS</span>
          </div>

          {/* Android Satellite */}
          <div className="flex flex-col items-center">
            <div className="w-full h-[200px] bg-gradient-to-br from-zinc-100 to-zinc-200 rounded-2xl p-4 shadow-lg border border-zinc-300 flex flex-col justify-start pt-6">
              <div className="text-center mb-3">
                <div className="h-10 flex items-end justify-center mb-2">
                  <svg className="w-8 h-8 text-zinc-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24c-1.4-.59-2.94-.92-4.47-.92s-3.07.33-4.47.92L5.65 5.67c-.19-.29-.58-.38-.87-.2-.28.18-.37.54-.22.83L6.4 9.48C3.3 11.25 1.28 14.44 1 18h22c-.28-3.56-2.3-6.75-5.4-8.52zM7 15.25c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25zm10 0c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25z"/>
                  </svg>
                </div>
                <span className="text-xs font-semibold text-zinc-700">Android</span>
              </div>
              <div className="space-y-2 text-[11px] text-zinc-600 text-center">
                <div>Samsung Galaxy S25+</div>
                <div>Google Pixel 9, 10</div>
                <div>Pixel Watch 4</div>
                <div className="text-zinc-500 text-[10px] mt-2">Requires carrier support</div>
              </div>
            </div>
            <span className="text-zinc-400 text-xs mt-4">Android Satellite SMS</span>
          </div>

          {/* Carrier Partnerships */}
          <div className="flex flex-col items-center">
            <div className="w-full h-[200px] bg-gradient-to-br from-zinc-100 to-zinc-200 rounded-2xl p-4 shadow-lg border border-zinc-300 flex flex-col justify-start pt-6">
              <div className="text-center mb-3">
                <div className="h-10 flex items-end justify-center mb-2">
                  <Satellite className="w-8 h-8 text-zinc-600" />
                </div>
                <span className="text-xs font-semibold text-zinc-700">Starlink Direct</span>
              </div>
              <div className="space-y-1 text-[10px] text-zinc-600">
                <div className="flex justify-between"><span>USA</span><span className="font-medium">T-Mobile</span></div>
                <div className="flex justify-between"><span>Australia</span><span className="font-medium">Telstra, Optus</span></div>
                <div className="flex justify-between"><span>Canada</span><span className="font-medium">Rogers</span></div>
                <div className="flex justify-between"><span>NZ</span><span className="font-medium">One NZ</span></div>
                <div className="flex justify-between"><span>Europe</span><span className="font-medium">Orange</span></div>
              </div>
            </div>
            <span className="text-zinc-400 text-xs mt-4">Carrier Satellite SMS</span>
          </div>

          {/* Garmin */}
          <div className="flex flex-col items-center">
            <div className="w-full h-[200px] bg-gradient-to-br from-zinc-100 to-zinc-200 rounded-2xl p-4 shadow-lg border border-zinc-300 flex flex-col justify-start pt-6">
              <div className="text-center mb-3">
                <div className="h-10 flex items-end justify-center mb-2">
                  <Navigation className="w-8 h-8 text-zinc-600" />
                </div>
                <span className="text-xs font-semibold text-zinc-700">Garmin inReach</span>
              </div>
              <div className="space-y-2 text-[11px] text-zinc-600 text-center">
                <div>All Garmin satellite devices</div>
                <div className="text-zinc-500 text-[10px] mt-2">May require subscription<br />to access SMS services</div>
              </div>
            </div>
            <span className="text-zinc-400 text-xs mt-4">Iridium Satellite SMS</span>
          </div>
        </div>

        <p className="text-center text-xs text-zinc-400 mb-8">
          Carrier satellite SMS requires a compatible plan. Works with most modern smartphones on participating carriers.
          <Link href="/compatibility" className="text-zinc-500 hover:text-zinc-700 ml-1 underline underline-offset-2">
            Check compatibility
          </Link>
        </p>

        <div className="text-center">
          <BetaButton />
        </div>
      </div>
    </section>
  )
}

// Waypoint data
const overlandCamps = [
  { id: '1', name: 'Ronny Creek', smsCode: 'RONNY', lat: -41.6504, lng: 145.9614, elevation: 942, type: 'camp' as const },
  { id: '2', name: 'Waterfall Valley Hut', smsCode: 'WATER', lat: -41.7147, lng: 145.9469, elevation: 1020, type: 'camp' as const },
  { id: '3', name: 'Lake Windermere Hut', smsCode: 'WINDM', lat: -41.7641, lng: 145.9498, elevation: 993, type: 'camp' as const },
  { id: '4', name: 'New Pelion Hut', smsCode: 'PELIO', lat: -41.8295, lng: 146.0464, elevation: 739, type: 'camp' as const },
  { id: '5', name: 'Kia Ora Hut', smsCode: 'KIAOR', lat: -41.8921, lng: 146.0820, elevation: 863, type: 'camp' as const },
  { id: '6', name: 'Bert Nichols Hut', smsCode: 'BERTN', lat: -41.9321, lng: 146.0889, elevation: 1000, type: 'camp' as const },
  { id: '7', name: 'Narcissus Hut', smsCode: 'NARCI', lat: -41.9958, lng: 146.1667, elevation: 752, type: 'camp' as const },
];

const overlandPeaks = [
  { id: '8', name: 'Cradle Mountain', smsCode: 'CRADL', lat: -41.6848, lng: 145.9511, elevation: 1545, type: 'peak' as const },
  { id: '9', name: 'Marions Lookout', smsCode: 'MARIO', lat: -41.6607, lng: 145.9525, elevation: 1224, type: 'peak' as const },
  { id: '10', name: 'Barn Bluff', smsCode: 'BARNB', lat: -41.7244, lng: 145.9225, elevation: 1559, type: 'peak' as const },
  { id: '11', name: 'Mt Oakleigh', smsCode: 'OAKLE', lat: -41.7998, lng: 146.0369, elevation: 1286, type: 'peak' as const },
  { id: '12', name: 'Mt Pelion West', smsCode: 'PELOW', lat: -41.8319, lng: 145.9793, elevation: 1560, type: 'peak' as const },
  { id: '13', name: 'Mt Pelion East', smsCode: 'PELOE', lat: -41.8574, lng: 146.0675, elevation: 1461, type: 'peak' as const },
  { id: '14', name: 'Mt Ossa', smsCode: 'OSSAM', lat: -41.8713, lng: 146.0333, elevation: 1617, type: 'peak' as const },
  { id: '15', name: 'The Acropolis', smsCode: 'ACROP', lat: -41.9534, lng: 146.0645, elevation: 1471, type: 'peak' as const },
];

const overlandPois = [
  { id: '16', name: 'Kitchen Hut', smsCode: 'KITCH', lat: -41.6866, lng: 145.9481, elevation: 1200, type: 'poi' as const },
];

const allOverlandWaypoints = [...overlandCamps, ...overlandPeaks, ...overlandPois];

const overlandTrackGeojson: GeoJSON.Feature = {
  type: 'Feature',
  properties: { name: 'Overland Track' },
  geometry: {
    type: 'LineString',
    coordinates: [
      [145.9614, -41.6504], [145.9525, -41.6607], [145.9469, -41.7147],
      [145.9498, -41.7641], [146.0100, -41.8000], [146.0464, -41.8295],
      [146.0820, -41.8921], [146.0889, -41.9321], [146.1200, -41.9600],
      [146.1667, -41.9958],
    ]
  }
};

const TYPE_COLORS = {
  camp: '#22c55e',
  peak: '#64748b',
  poi: '#6366f1'
};

function GlobalCoverage() {
  const markets = [
    { country: 'Australia', resolution: '3.0km × 3.0km' },
    { country: 'USA', resolution: '2.5km × 2.5km' },
    { country: 'Canada', resolution: '2.5km × 2.5km' },
    { country: 'UK', resolution: 'Point' },
    { country: 'France', resolution: '1.5km × 1.5km' },
    { country: 'Switzerland', resolution: '1.0km × 1.0km' },
    { country: 'Italy', resolution: '7.0km × 7.0km' },
    { country: 'New Zealand', resolution: '4.0km × 4.0km' },
    { country: 'South Africa', resolution: '11.0km × 11.0km' },
  ];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 mb-4">
            High resolution global coverage
          </h2>
          <p className="text-zinc-500 max-w-xl mx-auto">
            Official weather models from national meteorological services.
          </p>
        </div>

        {/* Mobile: 3-column grid */}
        <div className="grid grid-cols-3 gap-2 md:hidden">
          {markets.map((market) => (
            <div
              key={market.country}
              className="bg-zinc-50 rounded-lg p-3 text-center border border-zinc-100"
            >
              <div className="text-xs font-semibold text-zinc-900 truncate">{market.country}</div>
              <div className="text-[10px] text-zinc-500 mt-1 whitespace-nowrap">{market.resolution}</div>
            </div>
          ))}
        </div>

        {/* Desktop: horizontal table */}
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                {markets.map((market) => (
                  <th key={market.country} className="py-3 px-2 text-center font-semibold text-zinc-900 whitespace-nowrap">
                    {market.country}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {markets.map((market) => (
                  <td key={market.country} className="py-3 px-2 text-center text-zinc-500 whitespace-nowrap">
                    {market.resolution}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-center text-xs text-zinc-400 mt-6">
          Resolution = weather model grid size. Smaller = more accurate for mountain terrain.
        </p>

        <div className="text-center mt-10">
          <BetaButton />
        </div>
      </div>
    </section>
  )
}

function RouteExample() {
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(null);
  const selectedWaypoint = allOverlandWaypoints.find(w => w.id === selectedWaypointId);

  return (
    <section id="see-it-in-action" className="py-24 bg-white scroll-mt-20">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 mb-4">
            See it in action
          </h2>
          <p className="text-zinc-500 max-w-xl mx-auto">
            The Overland Track with 16 waypoints. Click any marker to see its SMS code.
          </p>
        </div>

        <div className="bg-zinc-50 rounded-2xl border border-zinc-200 p-4 mb-6">
          <MapEditor
            trackGeojson={overlandTrackGeojson}
            waypoints={allOverlandWaypoints}
            selectedWaypointId={selectedWaypointId}
            onWaypointSelect={setSelectedWaypointId}
            initialViewport={{ latitude: -41.82, longitude: 146.0, zoom: 9 }}
          />

          <div className="mt-4 flex flex-wrap justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-zinc-600">Camps ({overlandCamps.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-slate-500" />
              <span className="text-zinc-600">Peaks ({overlandPeaks.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-indigo-500" />
              <span className="text-zinc-600">POI ({overlandPois.length})</span>
            </div>
          </div>
        </div>

        {selectedWaypoint && (
          <div className="bg-white rounded-xl border-2 border-zinc-900 p-4 mb-6">
            <div className="flex items-center justify-center gap-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-medium"
                style={{ backgroundColor: TYPE_COLORS[selectedWaypoint.type] }}
              >
                {selectedWaypoint.smsCode.slice(0, 3)}
              </div>
              <div className="text-center">
                <h3 className="font-medium text-zinc-900">{selectedWaypoint.name}</h3>
                <p className="text-sm text-zinc-500">
                  Text <code className="bg-zinc-100 px-2 py-0.5 rounded font-mono text-zinc-700">{selectedWaypoint.smsCode}</code> for weather
                  <span className="text-zinc-400 ml-2">• {selectedWaypoint.elevation}m</span>
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4 mb-10">
          <div className="bg-white rounded-xl border border-zinc-200 p-5">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Tent className="w-4 h-4 text-emerald-600" />
              <h3 className="font-medium text-zinc-900">Camps</h3>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-sm">
              {overlandCamps.map((camp) => (
                <button
                  key={camp.id}
                  onClick={() => setSelectedWaypointId(camp.id)}
                  className={`flex items-center justify-center gap-2 p-2 rounded-lg transition-colors ${
                    selectedWaypointId === camp.id ? 'bg-emerald-50' : 'hover:bg-zinc-50'
                  }`}
                >
                  <code className="text-emerald-600 font-mono text-xs">{camp.smsCode}</code>
                  <span className="text-zinc-600 truncate text-xs">{camp.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 p-5">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Mountain className="w-4 h-4 text-slate-600" />
              <h3 className="font-medium text-zinc-900">Peaks</h3>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-sm">
              {overlandPeaks.map((peak) => (
                <button
                  key={peak.id}
                  onClick={() => setSelectedWaypointId(peak.id)}
                  className={`flex items-center justify-center gap-2 p-2 rounded-lg transition-colors ${
                    selectedWaypointId === peak.id ? 'bg-slate-50' : 'hover:bg-zinc-50'
                  }`}
                >
                  <code className="text-slate-600 font-mono text-xs">{peak.smsCode}</code>
                  <span className="text-zinc-600 truncate text-xs">{peak.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center">
          <BetaButton />
        </div>
      </div>
    </section>
  )
}

function Features() {
  const features = [
    { icon: Clock, title: 'Hour-by-hour', description: 'Hour-by-hour intervals so you know exactly when conditions change.', code: '06h' },
    { icon: Thermometer, title: 'Temperature', description: 'Min-max range adjusted for your exact elevation.', code: '5-7°' },
    { icon: Droplets, title: 'Precipitation', description: 'Rain and snow probability with expected accumulation.', code: 'Rn25% 0-3mm' },
    { icon: Wind, title: 'Wind', description: 'Sustained and gust speeds — critical for exposed ridgelines.', code: 'W18-30' },
    { icon: Cloud, title: 'Cloud cover', description: 'How much sky is covered. Plan your visibility windows.', code: 'Cld60%' },
    { icon: Mountain, title: 'Cloud base', description: "The altitude where clouds begin. Know when you'll be in them.", code: 'CB14' },
    { icon: Snowflake, title: 'Freezing level', description: 'The altitude where temperatures drop below freezing.', code: 'FL18' },
    { icon: AlertTriangle, title: 'Danger flag', description: "Lightning, high wind, trails in cloud, and ice — flagged before you're exposed.", code: '⚠' },
  ]

  return (
    <section className="py-24 bg-zinc-50">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 mb-4">
            What&apos;s in the forecast
          </h2>
          <p className="text-zinc-500 max-w-xl mx-auto">
            Every metric you need to plan your day out on trail, optimized for SMS delivery.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature, i) => (
            <div key={i} className="bg-white rounded-xl border border-zinc-200 p-5 text-center">
              <div className="flex items-center justify-center gap-3 mb-3">
                <feature.icon className="w-5 h-5 text-zinc-400" />
                <code className="text-xs font-mono text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded">{feature.code}</code>
              </div>
              <h3 className="font-medium text-zinc-900 mb-1">{feature.title}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <BetaButton />
        </div>
      </div>
    </section>
  )
}

function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-white scroll-mt-20">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 mb-4">
            Simple pricing
          </h2>
          <p className="text-zinc-500 max-w-xl mx-auto">
            One-off purchase with USD $10 SMS credits included. Top up anytime with pay-as-you-go credits.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto items-stretch">
          {/* Thunderbird */}
          <div className="bg-zinc-900 rounded-2xl p-6 text-white shadow-xl shadow-orange-500/20 ring-2 ring-orange-500 flex flex-col">
            <div className="text-center mb-6">
              <Zap className="w-8 h-8 text-orange-500 mx-auto mb-3" />
              <h3 className="text-lg font-medium">Thunderbird</h3>
            </div>
            <div className="space-y-3 text-sm flex-1">
              <div className="flex justify-between py-2 border-b border-zinc-700">
                <span className="text-zinc-400">Device</span>
                <span className="font-medium">USD $0</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-700">
                <span className="text-zinc-400">Monthly</span>
                <span className="font-medium">USD $0</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-700">
                <span className="text-zinc-400">One-time</span>
                <span className="font-medium">USD $29.99</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-zinc-400">Per forecast</span>
                <span className="font-medium">USD $0.07–$0.87</span>
              </div>
            </div>
            <BetaButton className="btn-orange block w-full text-center mt-6">Apply for Beta</BetaButton>
          </div>

          {/* Garmin */}
          <div className="bg-white rounded-2xl border border-zinc-200 p-6 flex flex-col">
            <div className="text-center mb-6">
              <Satellite className="w-8 h-8 text-zinc-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-zinc-900">Garmin inReach</h3>
            </div>
            <div className="space-y-3 text-sm flex-1">
              <div className="flex justify-between py-2 border-b border-zinc-100">
                <span className="text-zinc-500">Device</span>
                <span className="font-medium text-zinc-900">USD $399</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-100">
                <span className="text-zinc-500">Monthly</span>
                <span className="font-medium text-zinc-900">USD $15–$65</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-100">
                <span className="text-zinc-500">One-time</span>
                <span className="font-medium text-zinc-900">USD $414+</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-zinc-500">Per forecast</span>
                <span className="font-medium text-zinc-900">USD $1–$2</span>
              </div>
            </div>
            <div className="w-full bg-zinc-100 text-zinc-400 font-medium py-3 rounded-xl text-center text-sm mt-6">
              External provider
            </div>
          </div>

          {/* Zoleo */}
          <div className="bg-white rounded-2xl border border-zinc-200 p-6 flex flex-col">
            <div className="text-center mb-6">
              <MessageSquare className="w-8 h-8 text-zinc-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-zinc-900">Zoleo</h3>
            </div>
            <div className="space-y-3 text-sm flex-1">
              <div className="flex justify-between py-2 border-b border-zinc-100">
                <span className="text-zinc-500">Device</span>
                <span className="font-medium text-zinc-900">USD $199</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-100">
                <span className="text-zinc-500">Monthly</span>
                <span className="font-medium text-zinc-900">USD $20–$50</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-100">
                <span className="text-zinc-500">One-time</span>
                <span className="font-medium text-zinc-900">USD $219+</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-zinc-500">Per forecast</span>
                <span className="font-medium text-zinc-900">USD $0.14–$0.80</span>
              </div>
            </div>
            <div className="w-full bg-zinc-100 text-zinc-400 font-medium py-3 rounded-xl text-center text-sm mt-6">
              External provider
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-zinc-400 mt-8">
          Already have a satellite device? Thunderbird works with your existing equipment.{' '}
          <Link href="/compatibility" className="text-zinc-500 hover:text-zinc-700 underline underline-offset-2">
            Check compatibility
          </Link>
        </p>

        <div className="text-center mt-10">
          <BetaButton />
        </div>
      </div>
    </section>
  )
}

function About() {
  return (
    <section id="about" className="py-24 bg-zinc-50 scroll-mt-20">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 mb-4">
            About Thunderbird
          </h2>
        </div>

        <div className="space-y-6 text-zinc-600 text-center">
          <p className="text-lg leading-relaxed">
            Thunderbird is an AI agent built by{' '}
            <a
              href="https://www.linkedin.com/in/andrewcwhall/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-600 hover:text-orange-700 font-medium inline-flex items-center gap-1"
            >
              Andrew Hall
              <ExternalLink className="w-4 h-4" />
            </a>
            , an avid AI entrepreneur and hiker.
          </p>

          <p className="text-lg leading-relaxed">
            Thunderbird exists because getting detailed weather on trail shouldn&apos;t require
            a specialist device or a monthly subscription. It delivers the data you need to
            decide when to go and when to stay — directly to the satellite-enabled phone or
            watch you already carry.
          </p>

          <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Mail className="w-5 h-5 text-orange-600" />
              <span className="font-semibold text-zinc-900">Get in Touch</span>
            </div>
            <p className="text-zinc-700">
              Come say hi at{' '}
              <a
                href="mailto:hello@thunderbird.bot"
                className="text-orange-600 hover:text-orange-700 font-medium"
              >
                hello@thunderbird.bot
              </a>
              {' '}— see you out on trail soon.
            </p>
          </div>

          <div className="text-center mt-10">
            <BetaButton />
          </div>
        </div>
      </div>
    </section>
  )
}

const faqData = [
  {
    question: "What phones work with Thunderbird?",
    answer: "Thunderbird works with any phone that supports satellite SMS, including iPhone 14 and newer, Apple Watch Ultra 3, and select Android phones on T-Mobile or Verizon (Pixel 9+, Galaxy S24+/S25+)."
  },
  {
    question: "How does satellite SMS delivery work?",
    answer: "Text your waypoint code to our service number. Your phone routes the message through satellite when out of cell range. You receive a detailed weather forecast within minutes — no app or internet required."
  },
  {
    question: "What weather data is included?",
    answer: "Each forecast includes hour-by-hour temperature (elevation-adjusted), rain/snow probability, wind speed, cloud cover, cloud base height, freezing level, and danger indicators for hazardous conditions."
  },
  {
    question: "Do I need a subscription?",
    answer: "No. Thunderbird is a one-time $29.99 purchase that includes $10 in SMS credits. Top up only when you need more. Credits never expire."
  },
  {
    question: "How much does each forecast cost?",
    answer: "Costs vary by country. The $10 USD starter credits cover up to 30 days on trail (30 US / 7 AU). Top up anytime — credits never expire."
  },
  {
    question: "Can I create custom routes?",
    answer: "Yes. Upload your own GPX file or build from scratch using our map editor. You can also start from popular trail templates and customize them."
  },
];

function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 bg-zinc-50 scroll-mt-20">
      <div className="max-w-2xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 mb-4">
            Questions
          </h2>
        </div>

        <div className="space-y-2">
          {faqData.map((faq, index) => (
            <div key={index} className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 hover:bg-zinc-50 transition-colors"
              >
                <span className="font-medium text-zinc-900 text-sm">{faq.question}</span>
                <span className="text-zinc-400 text-lg flex-shrink-0">
                  {openIndex === index ? '−' : '+'}
                </span>
              </button>
              <div className={`overflow-hidden transition-all duration-200 ${openIndex === index ? 'max-h-48' : 'max-h-0'}`}>
                <div className="px-5 pb-4 text-sm text-zinc-500 leading-relaxed">
                  {faq.answer}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <BetaButton />
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": faqData.map(faq => ({
              "@type": "Question",
              "name": faq.question,
              "acceptedAnswer": { "@type": "Answer", "text": faq.answer }
            }))
          })
        }}
      />
    </section>
  )
}

function FinalCTA() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-2xl mx-auto px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-900 mb-4">
          Ready to get started?
        </h2>
        <p className="text-zinc-500 mb-8">
          $29.99 one-time. Includes $10 SMS credits. No subscription.
        </p>
        <BetaButton className="btn-orange inline-flex items-center gap-2 px-8 py-4" />
      </div>
    </section>
  )
}

function HomeContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    initPathTracking(params);
    trackPageView('/');
  }, [searchParams]);

  return (
    <>
      <Hero />
      <Features />
      <GlobalCoverage />
      <WhySMS />
      <CompatibleDevices />
      <HowItWorks />
      <RouteExample />
      <Pricing />
      <About />
      <FAQ />
      <FinalCTA />
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}
