'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Zap } from 'lucide-react';

const demoSequence = [
  {
    command: 'CAST12 LAKEO',
    label: '12 Hour Forecast',
    phone: `CAST12 LAKEO 863m
-41.8921, 146.0820
Light 06:00-20:51
12 hour detailed forecast

06h 5-7°C Rn15% 0-1mm
W12-20 Cld40% CB12 FL28

07h 6-8°C Rn15% 0-1mm
W13-21 Cld42% CB12 FL27

08h 7-10°C Rn18% 0-2mm
W14-22 Cld45% CB12 FL26

09h 9-12°C Rn20% 0-2mm
W15-24 Cld48% CB11 FL25

10h 10-14°C Rn22% 0-3mm
W16-26 Cld52% CB11 FL24

11h 11-15°C Rn24% 0-3mm
W17-28 Cld56% CB10 FL23

12h 12-16°C Rn25% 1-4mm
W18-30 Cld60% CB10 FL22

Rn=Rain W=Wind Cld=Cloud
CB=CloudBase FL=Freeze(x100m)`,
  },
];

function DevicePreviews() {
  const [phase, setPhase] = useState<'typing' | 'sending' | 'response'>('typing');
  const [typedChars, setTypedChars] = useState(0);

  const current = demoSequence[0];
  const command = current.command;

  const phaseRef = useRef(phase);
  const typedCharsRef = useRef(typedChars);

  phaseRef.current = phase;
  typedCharsRef.current = typedChars;

  useEffect(() => {
    const tick = () => {
      const currentPhase = phaseRef.current;
      const currentTyped = typedCharsRef.current;

      if (currentPhase === 'typing') {
        if (currentTyped < command.length) {
          setTypedChars(prev => prev + 1);
        } else {
          setPhase('sending');
        }
      } else if (currentPhase === 'sending') {
        setPhase('response');
      } else if (currentPhase === 'response') {
        setPhase('typing');
        setTypedChars(0);
      }
    };

    const getInterval = () => {
      if (phaseRef.current === 'typing') return 80;
      if (phaseRef.current === 'sending') return 800;
      return 4000;
    };

    const interval = setInterval(tick, getInterval());
    return () => clearInterval(interval);
  }, [phase, command.length]);

  const displayedCommand = command.slice(0, typedChars);

  return (
    <div className="mb-8">
      <div className="flex justify-center">
        <div className="flex flex-col items-center">
          <div className="w-[260px] h-[520px] bg-zinc-900 rounded-[40px] p-3 shadow-2xl relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-zinc-900 rounded-b-2xl" />
            <div className="w-full h-full bg-zinc-50 rounded-[32px] overflow-hidden flex flex-col">
              <div className="bg-zinc-100 pt-10 pb-2 px-4 text-center border-b border-zinc-200">
                <span className="text-zinc-900 text-sm font-medium">Thunderbird</span>
              </div>
              <div className="flex-1 p-3 overflow-y-auto flex flex-col justify-end gap-2">
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
                {phase === 'response' && (
                  <>
                    <div className="flex justify-end mb-1">
                      <div className="bg-orange-500 text-white p-2 rounded-2xl rounded-br-sm text-xs font-mono">
                        {command}
                      </div>
                    </div>
                    <div className="bg-zinc-200 text-zinc-800 p-3 rounded-2xl rounded-bl-sm max-w-[95%] text-xs leading-relaxed font-mono whitespace-pre-wrap">
                      {current.phone}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EmbedContent() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 via-white to-white">
      <section className="pt-8 pb-6 px-4">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Zap className="w-8 h-8 text-orange-500" />
            <span className="font-bold text-xl text-gray-900">Thunderbird</span>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">
            Alpine Weather via Satellite SMS
          </h1>
          <p className="text-zinc-600 text-sm">
            Professional forecasts for remote trails
          </p>
        </div>

        <DevicePreviews />

        <div className="text-center">
          <Link
            href="/checkout?path=buy"
            className="btn-orange inline-block"
          >
            Get Started — USD $29.99
          </Link>
        </div>
      </section>
    </div>
  );
}
