'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Smartphone,
  Watch,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Zap,
  Globe,
  Satellite
} from 'lucide-react';
import { BetaButton } from '../components/beta/BetaButton';

function Hero() {
  return (
    <section className="relative py-16 lg:py-24 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-orange-50" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="flex justify-center mb-6">
          <Satellite className="w-16 h-16 text-orange-500" />
        </div>

        <h1 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900">
          Satellite SMS Compatibility
        </h1>

        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-4">
          Find out if your phone and carrier support satellite messaging
        </p>

        <p className="text-gray-500 max-w-2xl mx-auto">
          Thunderbird works with any device that can send SMS via satellite.
          No special equipment needed - just your compatible phone or watch.
        </p>
      </div>
    </section>
  );
}

function DeviceSection({
  title,
  icon: Icon,
  iconColor,
  children
}: {
  title: string;
  icon: typeof Smartphone;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-6 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${iconColor}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function SupportedModel({
  name,
  features,
  note
}: {
  name: string;
  features: string[];
  note?: string;
}) {
  return (
    <div className="border-l-4 border-green-500 pl-4 py-2 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle2 className="w-5 h-5 text-green-500" />
        <span className="font-semibold text-gray-900">{name}</span>
      </div>
      <ul className="text-gray-600 text-sm space-y-1 ml-7">
        {features.map((feature, i) => (
          <li key={i}>{feature}</li>
        ))}
      </ul>
      {note && (
        <p className="text-orange-600 text-sm mt-2 ml-7 font-medium">{note}</p>
      )}
    </div>
  );
}

function IPhoneSection() {
  return (
    <DeviceSection title="Apple iPhone" icon={Smartphone} iconColor="bg-gray-900">
      <p className="text-gray-600 mb-4">
        Apple pioneered consumer satellite SMS with iPhone 14. All newer iPhones include this capability at no extra charge.
      </p>

      <SupportedModel
        name="iPhone 14 and newer (all variants)"
        features={[
          "Messages via satellite (iOS 18+)",
          "Emergency SOS via satellite",
          "Works with any carrier in supported countries"
        ]}
        note="Free satellite messaging included for 2 years from device activation"
      />

      <div className="bg-gray-50 rounded-lg p-4 mt-4">
        <h4 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <Globe className="w-4 h-4" />
          Supported Countries
        </h4>
        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
          <div>
            <span className="font-medium">Messages via Satellite:</span>
            <p>US, Canada, Mexico, Japan</p>
          </div>
          <div>
            <span className="font-medium">Emergency SOS:</span>
            <p>18+ countries including UK, Australia, NZ, EU</p>
          </div>
        </div>
      </div>
    </DeviceSection>
  );
}

function AppleWatchSection() {
  return (
    <DeviceSection title="Apple Watch" icon={Watch} iconColor="bg-gray-900">
      <p className="text-gray-600 mb-4">
        Apple Watch Ultra includes satellite connectivity for messaging even when your iPhone is not nearby.
      </p>

      <SupportedModel
        name="Apple Watch Ultra (all generations)"
        features={[
          "Satellite messaging when paired with compatible iPhone",
          "Works even when iPhone is not nearby",
          "Same satellite network as iPhone"
        ]}
      />
    </DeviceSection>
  );
}

function AndroidSection() {
  return (
    <DeviceSection title="Android Phones" icon={Smartphone} iconColor="bg-green-600">
      <p className="text-gray-600 mb-4">
        Android satellite SMS support is expanding rapidly through carrier partnerships with Starlink and other providers.
      </p>

      <SupportedModel
        name="Google Pixel 9+"
        features={[
          "Satellite SOS (US only)",
          "T-Mobile satellite messaging (where available)"
        ]}
      />

      <SupportedModel
        name="Samsung Galaxy S25+"
        features={[
          "Satellite messaging via carrier partnerships",
          "Supported on T-Mobile and Verizon (US)"
        ]}
      />

      <SupportedModel
        name="Samsung Galaxy S24+"
        features={[
          "T-Mobile satellite messaging (where available)"
        ]}
      />

      <div className="bg-blue-50 rounded-lg p-4 mt-4">
        <p className="text-blue-800 text-sm">
          <strong>Note:</strong> Android satellite SMS support is expanding rapidly.
          Check with your carrier for the latest device compatibility.
        </p>
      </div>
    </DeviceSection>
  );
}

function CarrierTable() {
  const carriers = [
    {
      carrier: "Apple (all carriers)",
      partner: "Globalstar",
      devices: "iPhone 14+",
      status: "Active",
      statusColor: "bg-green-100 text-green-800"
    },
    {
      carrier: "T-Mobile (US)",
      partner: "Starlink",
      devices: "iPhone 14+, Galaxy S24+, Pixel 9+",
      status: "Active",
      statusColor: "bg-green-100 text-green-800"
    },
    {
      carrier: "Verizon (US)",
      partner: "Skylo",
      devices: "Galaxy S25+, Pixel 9+",
      status: "Active",
      statusColor: "bg-green-100 text-green-800"
    },
    {
      carrier: "AT&T (US)",
      partner: "AST SpaceMobile",
      devices: "TBD",
      status: "Coming 2026",
      statusColor: "bg-yellow-100 text-yellow-800"
    }
  ];

  return (
    <section className="py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Carrier Satellite Partnerships
        </h2>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Carrier</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Satellite Partner</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Supported Devices</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {carriers.map((row, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{row.carrier}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.partner}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.devices}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${row.statusColor}`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function FAQItem({
  question,
  answer,
  isOpen,
  onToggle
}: {
  question: string;
  answer: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="card overflow-hidden mb-3">
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors"
      >
        <span className="font-semibold text-gray-900">{question}</span>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
        )}
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          isOpen ? 'max-h-96' : 'max-h-0'
        }`}
      >
        <div className="px-6 pb-4 text-gray-600 leading-relaxed">
          {answer}
        </div>
      </div>
    </div>
  );
}

function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: "Will my phone work?",
      answer: (
        <div className="space-y-3">
          <p><strong>iPhone users:</strong> If you have an iPhone 14 or newer, you have satellite SMS capability built-in. Make sure you&apos;re running iOS 18 or later for Messages via satellite.</p>
          <p><strong>Android users:</strong> Check if your device (Pixel 9+, Galaxy S24+/S25+) supports satellite messaging through your carrier (T-Mobile or Verizon in the US).</p>
          <p><strong>Apple Watch:</strong> Apple Watch Ultra models support satellite messaging when paired with a compatible iPhone.</p>
        </div>
      )
    },
    {
      question: "Do I need a special plan?",
      answer: (
        <div>
          <p>For most users, satellite SMS is included with your device at no additional cost:</p>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li><strong>Apple devices:</strong> Free for 2 years from activation</li>
            <li><strong>T-Mobile customers:</strong> Included with most plans</li>
            <li><strong>Verizon customers:</strong> Check your plan details</li>
          </ul>
          <p className="mt-2">Thunderbird itself has no monthly subscription - you only pay for the forecasts you request.</p>
        </div>
      )
    },
    {
      question: "Does it work everywhere?",
      answer: (
        <div>
          <p>Satellite SMS requires a clear view of the sky. It works best:</p>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>In open areas (meadows, ridgelines, above treeline)</li>
            <li>Away from tall buildings and dense forest canopy</li>
            <li>When the satellite is above the horizon</li>
          </ul>
          <p className="mt-2">You may need to adjust your position slightly for the best connection, just like with any satellite device.</p>
        </div>
      )
    },
    {
      question: "How long does a message take?",
      answer: (
        <div>
          <p>Typical message times:</p>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li><strong>Sending your request:</strong> 15-30 seconds</li>
            <li><strong>Receiving your forecast:</strong> 30-60 seconds</li>
          </ul>
          <p className="mt-2">Weather forecasts are formatted to minimize message size while providing all essential information.</p>
        </div>
      )
    },
    {
      question: "Can I receive messages too?",
      answer: (
        <p>Yes! Satellite SMS is bidirectional. You send your waypoint code to request a forecast, and Thunderbird sends back the detailed weather data to your device. It works just like regular SMS, but routes through satellites when you&apos;re out of cell range.</p>
      )
    }
  ];

  return (
    <section className="py-12 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Frequently Asked Questions
        </h2>

        {faqs.map((faq, index) => (
          <FAQItem
            key={index}
            question={faq.question}
            answer={faq.answer}
            isOpen={openIndex === index}
            onToggle={() => setOpenIndex(openIndex === index ? null : index)}
          />
        ))}
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="py-16 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <Zap className="w-12 h-12 text-orange-500 mx-auto mb-6" />
        <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
        <p className="text-gray-600 mb-8 max-w-xl mx-auto">
          Your phone already has satellite SMS built in. You&apos;re ready to receive forecasts anywhere on the trail.
        </p>

        <BetaButton className="btn-orange text-lg px-16 py-4">Apply for Beta</BetaButton>

        <p className="text-gray-400 text-sm mt-8">
          Last updated: January 2026
        </p>
      </div>
    </section>
  );
}

function DeviceSections() {
  return (
    <section className="py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <IPhoneSection />
        <AppleWatchSection />
        <AndroidSection />
      </div>
    </section>
  );
}

export default function CompatibilityPage() {
  return (
    <>
      <Hero />
      <DeviceSections />
      <CarrierTable />
      <FAQ />
      <CTASection />
    </>
  );
}
