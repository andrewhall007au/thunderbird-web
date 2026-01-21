'use client';

import { useState } from 'react';
import { PhoneSimulator } from '@/app/components/simulator/PhoneSimulator';
import { sampleSMSContent, sampleWatchContent } from '@/app/components/simulator/PhoneSimulator.test';

/**
 * Visual Test Page for PhoneSimulator Component
 *
 * Access at: http://localhost:3000/test-simulator
 *
 * Tests:
 * 1. iPhone variant renders correctly
 * 2. Watch variant renders correctly
 * 3. Content is displayed in SMS bubble
 * 4. Typing animation works when enabled
 */
export default function TestSimulatorPage() {
  const [showTyping, setShowTyping] = useState(false);
  const [typingKey, setTypingKey] = useState(0);

  const handleResetTyping = () => {
    setTypingKey((k) => k + 1);
    setShowTyping(true);
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <h1 className="text-2xl font-bold text-white mb-8">PhoneSimulator Component Test</h1>

      {/* Test 1 & 2: Static variants */}
      <section className="mb-12">
        <h2 className="text-xl text-white mb-4">Static Variants (no animation)</h2>
        <div className="flex flex-wrap gap-8 justify-center">
          <PhoneSimulator content={sampleSMSContent} variant="iphone" />
          <PhoneSimulator content={sampleWatchContent} variant="watch" />
        </div>
      </section>

      {/* Test 3: Typing animation */}
      <section className="mb-12">
        <h2 className="text-xl text-white mb-4">Typing Animation</h2>
        <button
          onClick={handleResetTyping}
          className="mb-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          {showTyping ? 'Restart Animation' : 'Start Typing Animation'}
        </button>
        {showTyping && (
          <div className="flex justify-center">
            <PhoneSimulator
              key={typingKey}
              content={sampleSMSContent}
              variant="iphone"
              animateTyping={true}
            />
          </div>
        )}
      </section>

      {/* Test 4: Custom content */}
      <section className="mb-12">
        <h2 className="text-xl text-white mb-4">Custom Content (Short Message)</h2>
        <div className="flex justify-center">
          <PhoneSimulator
            content={`CAST PINEC
Pine Creek (1250m)

Next 6 hours: Clear

06h 12o Rn0% W5-10
08h 15o Rn0% W8-12
10h 18o Rn5% W10-15`}
            variant="iphone"
          />
        </div>
      </section>

      {/* Verification checklist */}
      <section className="bg-gray-800 p-6 rounded-lg max-w-md mx-auto">
        <h2 className="text-xl text-white mb-4">Verification Checklist</h2>
        <ul className="text-gray-300 space-y-2">
          <li>[ ] iPhone frame shows black border with notch</li>
          <li>[ ] iPhone screen is white with &quot;Thunderbird&quot; header</li>
          <li>[ ] SMS bubble is gray (#e5e5ea) with proper radius</li>
          <li>[ ] Watch frame shows orange digital crown</li>
          <li>[ ] Watch screen is black with white text</li>
          <li>[ ] Typing animation reveals characters at ~30ms each</li>
          <li>[ ] Content preserves whitespace and line breaks</li>
        </ul>
      </section>
    </div>
  );
}
