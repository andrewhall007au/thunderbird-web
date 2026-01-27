'use client';

import { useState } from 'react';
import {
  Satellite, BatteryCharging, Shield, Clock, Thermometer,
  Wind, Droplets, Cloud, Mountain, Snowflake, AlertTriangle,
  ChevronRight, Navigation, MessageSquare, Mail, ExternalLink, Zap
} from 'lucide-react';

type Version = 'current' | 'proposed';

// ─── Section Data ────────────────────────────────────────────────

const sections = [
  {
    id: 'how-it-works-bullets',
    label: 'How It Works — GPS bullets',
    page: 'Homepage',
  },
  {
    id: 'why-sms',
    label: 'Why SMS?',
    page: 'Homepage',
  },
  {
    id: 'compatible-devices-footnote',
    label: 'Compatible Devices — footnote',
    page: 'Homepage',
  },
  {
    id: 'features',
    label: "What's in the forecast",
    page: 'Homepage',
  },
  {
    id: 'about',
    label: 'About Thunderbird',
    page: 'Homepage',
  },
  {
    id: 'pricing-header',
    label: 'Pricing — header & footnotes',
    page: 'Pricing',
  },
  {
    id: 'how-it-works-page',
    label: 'What Makes Thunderbird Different',
    page: 'How It Works',
  },
];

// ─── Section Renderers ───────────────────────────────────────────

function HowItWorksBullets({ version }: { version: Version }) {
  const bullet = version === 'current' ? '•' : '—';
  const bulletColor = 'text-orange-500';

  return (
    <div className="px-5 py-6">
      <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide mb-4 text-center">
        Or text GPS coordinates on trail
      </p>
      <p className="text-[13px] text-zinc-600 mb-3 text-center">
        No pre-planning needed. Text your GPS coordinates from anywhere and get an instant forecast.
      </p>
      <div className="bg-zinc-50 rounded-lg border border-zinc-200 p-3 font-mono text-[12px] mb-4 text-center">
        <span className="text-zinc-500">Send:</span>{' '}
        <span className="text-zinc-900">CAST -41.89, 146.08</span>
      </div>
      <ul className="text-[12px] text-zinc-500 space-y-2">
        <li className="flex items-center gap-2">
          <span className={`${bulletColor} font-bold`}>{bullet}</span>
          Unplanned detours or route changes
        </li>
        <li className="flex items-center gap-2">
          <span className={`${bulletColor} font-bold`}>{bullet}</span>
          Checking conditions at your current position
        </li>
        <li className="flex items-center gap-2">
          <span className={`${bulletColor} font-bold`}>{bullet}</span>
          Exploring new areas without pre-setup
        </li>
      </ul>
    </div>
  );
}

function WhySMS({ version }: { version: Version }) {
  const current = {
    subtitle: 'Small payload, prioritized delivery, works with brief satellite visibility.',
    benefits: [
      {
        icon: Satellite,
        title: 'Works everywhere',
        description: 'Satellite SMS reaches you anywhere with sky visibility — no cell towers needed. Better than data: ~1KB vs ~3MB to get your forecast.',
      },
      {
        icon: BatteryCharging,
        title: 'Battery efficient',
        description: 'SMS uses minimal power compared to data. Your phone lasts longer on trail.',
      },
      {
        icon: Shield,
        title: 'Reliable delivery',
        description: 'SMS over satellite works on all providers, data only a few. SMS guaranteed to get through.',
      },
    ],
  };

  const proposed = {
    subtitle: 'Designed for the backcountry — reliable, fast, and works with minimal sky visibility.',
    benefits: [
      {
        icon: Satellite,
        title: 'Works everywhere',
        description: 'Works anywhere with sky visibility — no cell towers, no data plan. A single forecast uses less than 1KB.',
      },
      {
        icon: BatteryCharging,
        title: 'Battery efficient',
        description: 'SMS uses a fraction of the power of a data connection. Your phone stays alive longer on trail.',
      },
      {
        icon: Shield,
        title: 'Reliable delivery',
        description: "SMS routes through every satellite provider. Data doesn't. Your forecast gets through.",
      },
    ],
  };

  const data = version === 'current' ? current : proposed;

  return (
    <div className="px-5 py-6">
      <h2 className="text-[18px] font-semibold text-zinc-900 mb-2 text-center">Why SMS?</h2>
      <p className="text-[12px] text-zinc-500 mb-5 text-center">{data.subtitle}</p>
      <div className="space-y-4">
        {data.benefits.map((b, i) => (
          <div key={i} className="bg-white rounded-xl border border-zinc-200 p-4 text-center">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center mb-2 mx-auto">
              <b.icon className="w-4 h-4 text-zinc-600" />
            </div>
            <h3 className="font-medium text-zinc-900 text-[13px] mb-1">{b.title}</h3>
            <p className="text-[11px] text-zinc-500 leading-relaxed">{b.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompatibleFootnote({ version }: { version: Version }) {
  if (version === 'current') {
    return (
      <div className="px-5 py-6">
        <div className="space-y-3 mb-4">
          <div className="bg-zinc-50 rounded-lg p-3 text-center border border-zinc-100">
            <div className="text-[11px] text-zinc-600">Requires carrier support*</div>
          </div>
          <div className="text-center">
            <span className="text-zinc-400 text-[10px]">Carrier Satellite SMS*</span>
          </div>
        </div>
        <p className="text-[10px] text-zinc-400 text-center">
          *Carrier satellite SMS requires compatible plan. Available on most modern smartphones with participating carriers.{' '}
          <span className="text-zinc-500 underline">Check compatibility</span>
        </p>
      </div>
    );
  }

  return (
    <div className="px-5 py-6">
      <div className="space-y-3 mb-4">
        <div className="bg-zinc-50 rounded-lg p-3 text-center border border-zinc-100">
          <div className="text-[11px] text-zinc-600">Requires carrier support</div>
        </div>
        <div className="text-center">
          <span className="text-zinc-400 text-[10px]">Carrier Satellite SMS</span>
        </div>
      </div>
      <p className="text-[10px] text-zinc-400 text-center">
        Carrier satellite SMS requires a compatible plan. Works with most modern smartphones on participating carriers.{' '}
        <span className="text-zinc-500 underline">Check compatibility</span>
      </p>
    </div>
  );
}

function Features({ version }: { version: Version }) {
  const current = [
    { icon: Clock, title: 'Hour-by-hour', description: '2-hour intervals. Know exactly when conditions change.', code: '06h' },
    { icon: Thermometer, title: 'Temperature', description: 'Min-max adjusted for elevation (6.5°C/1000m lapse).', code: '5-7°' },
    { icon: Droplets, title: 'Precipitation', description: 'Rain/snow probability plus expected accumulation.', code: 'Rn25% 0-3mm' },
    { icon: Wind, title: 'Wind', description: 'Sustained and gust speeds. Critical for ridgelines.', code: 'W18-30' },
    { icon: Cloud, title: 'Cloud cover', description: 'Percentage of sky covered. Plan visibility.', code: 'Cld60%' },
    { icon: Mountain, title: 'Cloud base', description: 'Height where clouds begin (×100m).', code: 'CB14' },
    { icon: Snowflake, title: 'Freezing level', description: 'Altitude where temp hits 0°C (×100m).', code: 'FL18' },
    { icon: AlertTriangle, title: 'Danger flag', description: 'Lightning risk, high wind, trails in cloud, ice conditions.', code: '⚠' },
  ];

  const proposed = [
    { icon: Clock, title: 'Hour-by-hour', description: 'Hour-by-hour intervals so you know exactly when conditions change.', code: '06h' },
    { icon: Thermometer, title: 'Temperature', description: 'Min-max range adjusted for your exact elevation.', code: '5-7°' },
    { icon: Droplets, title: 'Precipitation', description: 'Rain and snow probability with expected accumulation.', code: 'Rn25% 0-3mm' },
    { icon: Wind, title: 'Wind', description: 'Sustained and gust speeds — critical for exposed ridgelines.', code: 'W18-30' },
    { icon: Cloud, title: 'Cloud cover', description: "How much sky is covered. Plan your visibility windows.", code: 'Cld60%' },
    { icon: Mountain, title: 'Cloud base', description: "The altitude where clouds begin. Know when you'll be in them.", code: 'CB14' },
    { icon: Snowflake, title: 'Freezing level', description: 'The altitude where temperatures drop below freezing.', code: 'FL18' },
    { icon: AlertTriangle, title: 'Danger flag', description: "Lightning, high wind, trails in cloud, and ice — flagged before you're exposed.", code: '⚠' },
  ];

  const data = version === 'current' ? current : proposed;

  return (
    <div className="px-5 py-6">
      <h2 className="text-[18px] font-semibold text-zinc-900 mb-2 text-center">
        What&apos;s in the forecast
      </h2>
      <p className="text-[12px] text-zinc-500 mb-4 text-center">
        Every metric you need to plan your day on trail.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {data.map((f, i) => (
          <div key={i} className="bg-white rounded-lg border border-zinc-200 p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1.5">
              <f.icon className="w-3.5 h-3.5 text-zinc-400" />
              <code className="text-[9px] font-mono text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">{f.code}</code>
            </div>
            <h3 className="font-medium text-zinc-900 text-[11px] mb-0.5">{f.title}</h3>
            <p className="text-[9px] text-zinc-500 leading-snug">{f.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function About({ version }: { version: Version }) {
  const currentText = "Thunderbird is Andrew\u2019s response to being frustrated by not being able to get detailed weather forecasts out on trail to make decisions on when to go and when to stay. No more having to buy a specialist satellite device, no more guessing, no more hoping for the best \u2014 just the detailed data you need to make on trail decisions, delivered directly to your satellite enabled phone, watch or even specialist satellite device (our forecasts are better).";

  const proposedText = "Thunderbird exists because getting detailed weather on trail shouldn\u2019t require a specialist device or a monthly subscription. It delivers the data you need to decide when to go and when to stay \u2014 directly to the satellite-enabled phone or watch you already carry.";

  return (
    <div className="px-5 py-6">
      <h2 className="text-[18px] font-semibold text-zinc-900 mb-4 text-center">About Thunderbird</h2>
      <p className="text-[13px] text-zinc-600 leading-relaxed text-center mb-4">
        Thunderbird is an AI agent built by{' '}
        <span className="text-orange-600 font-medium">Andrew Hall</span>, an avid AI entrepreneur and hiker.
      </p>
      <p className="text-[12px] text-zinc-600 leading-relaxed text-center">
        {version === 'current' ? currentText : proposedText}
      </p>
    </div>
  );
}

function PricingHeader({ version }: { version: Version }) {
  if (version === 'current') {
    return (
      <div className="px-5 py-6">
        <h2 className="text-[20px] font-bold text-zinc-900 mb-2 text-center">Simple, Transparent Pricing</h2>
        <p className="text-[13px] text-zinc-500 text-center mb-5">One trip, one price. No subscriptions.</p>

        <div className="bg-white rounded-xl border border-zinc-200 p-4 mb-4">
          <div className="text-center mb-3">
            <span className="bg-orange-100 text-orange-500 text-[10px] font-medium px-2 py-0.5 rounded-full">Intro Pricing</span>
          </div>
          <div className="text-center text-[22px] font-bold text-zinc-900">USD $29.99</div>
          <p className="text-orange-500 text-[11px] text-center font-medium mt-1">Includes USD $10 SMS credits</p>
        </div>

        <div className="bg-zinc-50 rounded-lg p-3 text-center">
          <div className="text-[11px] text-zinc-600 mb-1">Thunderbird device cost:</div>
          <div className="text-orange-500 font-medium text-[12px]">USD $0*</div>
        </div>
        <p className="text-[9px] text-zinc-400 text-center mt-2">
          *Works with iPhone 14+ satellite SMS, or any device you already own
        </p>
        <p className="text-[10px] text-zinc-400 text-center mt-3">
          Beta launching January 2026
        </p>
      </div>
    );
  }

  return (
    <div className="px-5 py-6">
      <h2 className="text-[20px] font-bold text-zinc-900 mb-2 text-center">Simple, Transparent Pricing</h2>
      <p className="text-[13px] text-zinc-500 text-center mb-5">One-time purchase. Pay-as-you-go credits. No subscriptions.</p>

      <div className="bg-white rounded-xl border border-zinc-200 p-4 mb-4">
        <div className="text-center mb-3">
          <span className="bg-orange-100 text-orange-500 text-[10px] font-medium px-2 py-0.5 rounded-full">Intro Pricing</span>
        </div>
        <div className="text-center text-[22px] font-bold text-zinc-900">USD $29.99</div>
        <p className="text-orange-500 text-[11px] text-center font-medium mt-1">Includes USD $10 SMS credits</p>
      </div>

      <div className="bg-zinc-50 rounded-lg p-3 text-center">
        <div className="text-[11px] text-zinc-600 mb-1">Thunderbird device cost:</div>
        <div className="text-orange-500 font-medium text-[12px]">USD $0</div>
      </div>
      <p className="text-[9px] text-zinc-400 text-center mt-2">
        Works with iPhone 14+ satellite SMS, or any device you already own.
      </p>
    </div>
  );
}

function HowItWorksPage({ version }: { version: Version }) {
  const current = {
    items: [
      { title: 'BOM 3km Model', description: 'Official Bureau of Meteorology data, not aggregated third-party forecasts.' },
      { title: 'Elevation-Specific', description: 'Separate forecasts for camps and peaks using lapse rate adjustments.' },
      { title: 'Real-Time Warnings', description: 'BOM warnings delivered within 15 minutes, not hours.' },
    ],
  };

  const proposed = {
    items: [
      { title: 'Official weather models', description: 'Direct from national meteorological services — not aggregated third-party data.' },
      { title: 'Elevation-adjusted', description: 'Separate forecasts for camps and peaks, corrected for altitude.' },
      { title: 'Real-time warnings', description: 'Severe weather warnings delivered within 15 minutes, not hours.' },
    ],
  };

  const data = version === 'current' ? current : proposed;

  return (
    <div className="px-5 py-6">
      <h2 className="text-[16px] font-bold text-zinc-900 mb-4 text-center">What Makes Thunderbird Different</h2>
      <div className="space-y-4">
        {data.items.map((item, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-5 h-5 rounded bg-orange-100 flex items-center justify-center shrink-0 mt-0.5">
              <Zap className="w-3 h-3 text-orange-500" />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-900 text-[12px] mb-0.5">{item.title}</h3>
              <p className="text-[11px] text-zinc-500 leading-relaxed">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Phone Mockup ────────────────────────────────────────────────

function PhoneMockup({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-zinc-800 rounded-[2.5rem] p-3 shadow-2xl w-[320px] mx-auto">
      <div className="flex justify-center mb-1">
        <div className="w-24 h-5 bg-zinc-900 rounded-full" />
      </div>
      <div className="bg-white rounded-[2rem] overflow-hidden min-h-[500px] max-h-[600px] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

// ─── Section Renderer ────────────────────────────────────────────

function SectionContent({ sectionId, version }: { sectionId: string; version: Version }) {
  switch (sectionId) {
    case 'how-it-works-bullets':
      return <HowItWorksBullets version={version} />;
    case 'why-sms':
      return <WhySMS version={version} />;
    case 'compatible-devices-footnote':
      return <CompatibleFootnote version={version} />;
    case 'features':
      return <Features version={version} />;
    case 'about':
      return <About version={version} />;
    case 'pricing-header':
      return <PricingHeader version={version} />;
    case 'how-it-works-page':
      return <HowItWorksPage version={version} />;
    default:
      return null;
  }
}

// ─── Main Page ───────────────────────────────────────────────────

export default function CopyComparePage() {
  const [activeSection, setActiveSection] = useState(0);
  const [version, setVersion] = useState<Version>('current');

  const section = sections[activeSection];

  return (
    <div className="min-h-screen bg-zinc-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-white mb-1">Copy Comparison</h1>
          <p className="text-zinc-400 text-sm">
            Toggle between current and proposed copy for each section
          </p>
        </div>

        {/* Section Selector */}
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {sections.map((s, i) => (
            <button
              key={s.id}
              onClick={() => { setActiveSection(i); setVersion('current'); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeSection === i
                  ? 'bg-orange-500 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Page badge */}
        <div className="text-center mb-4">
          <span className="text-[10px] font-medium text-zinc-500 bg-zinc-800 px-3 py-1 rounded-full">
            Page: {section.page}
          </span>
        </div>

        {/* Version Toggle */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex bg-zinc-800 rounded-lg p-1">
            <button
              onClick={() => setVersion('current')}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${
                version === 'current'
                  ? 'bg-zinc-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-300'
              }`}
            >
              Current
            </button>
            <button
              onClick={() => setVersion('proposed')}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-all ${
                version === 'proposed'
                  ? 'bg-orange-500 text-white'
                  : 'text-zinc-400 hover:text-zinc-300'
              }`}
            >
              Proposed
            </button>
          </div>
        </div>

        {/* Phone Preview */}
        <PhoneMockup>
          <SectionContent sectionId={section.id} version={version} />
        </PhoneMockup>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-6 max-w-[320px] mx-auto">
          <button
            onClick={() => { setActiveSection(Math.max(0, activeSection - 1)); setVersion('current'); }}
            disabled={activeSection === 0}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            &larr; Previous
          </button>
          <span className="text-zinc-500 text-xs">
            {activeSection + 1} / {sections.length}
          </span>
          <button
            onClick={() => { setActiveSection(Math.min(sections.length - 1, activeSection + 1)); setVersion('current'); }}
            disabled={activeSection === sections.length - 1}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
