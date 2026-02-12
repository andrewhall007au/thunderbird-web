'use client';

import { useState } from 'react';
import { Smartphone, Tablet, Monitor } from 'lucide-react';

type Device = 'iphone' | 'ipad' | 'desktop';

const DEVICES: Record<Device, { label: string; width: number; height: number; scale: number; icon: typeof Smartphone }> = {
  iphone: { label: 'iPhone 15', width: 393, height: 852, scale: 0.7, icon: Smartphone },
  ipad: { label: 'iPad Air', width: 820, height: 1180, scale: 0.55, icon: Tablet },
  desktop: { label: 'MacBook', width: 1440, height: 900, scale: 0.65, icon: Monitor },
};

export default function PreviewPage() {
  const [device, setDevice] = useState<Device>('iphone');
  const d = DEVICES[device];

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center">
      {/* Device selector */}
      <div className="flex items-center gap-3 py-6">
        {(Object.entries(DEVICES) as [Device, typeof DEVICES[Device]][]).map(([key, dev]) => {
          const Icon = dev.icon;
          return (
            <button
              key={key}
              onClick={() => setDevice(key)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${device === key
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                }
              `}
            >
              <Icon className="w-4 h-4" />
              {dev.label}
              <span className="text-xs opacity-60">{dev.width}x{dev.height}</span>
            </button>
          );
        })}
      </div>

      {/* Device frame */}
      <div className="flex-1 flex items-start justify-center pb-10">
        {device === 'iphone' && (
          <PhoneFrame width={d.width} height={d.height} scale={d.scale} />
        )}
        {device === 'ipad' && (
          <TabletFrame width={d.width} height={d.height} scale={d.scale} />
        )}
        {device === 'desktop' && (
          <DesktopFrame width={d.width} height={d.height} scale={d.scale} />
        )}
      </div>
    </div>
  );
}

function PhoneFrame({ width, height, scale }: { width: number; height: number; scale: number }) {
  return (
    <div style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
      <div
        className="relative bg-zinc-900 rounded-[60px] p-[14px] shadow-2xl shadow-black/50"
        style={{
          width: width + 28,
          border: '3px solid #3f3f46',
        }}
      >
        {/* Dynamic Island */}
        <div className="absolute top-[22px] left-1/2 -translate-x-1/2 w-[126px] h-[37px] bg-zinc-950 rounded-full z-20" />

        {/* Screen */}
        <div
          className="rounded-[46px] overflow-hidden bg-black relative"
          style={{ width, height }}
        >
          <iframe
            src="/prototype"
            className="w-full h-full border-0"
            style={{ width, height }}
          />
        </div>

        {/* Bottom bar indicator */}
        <div className="absolute bottom-[10px] left-1/2 -translate-x-1/2 w-[140px] h-[5px] bg-zinc-600 rounded-full" />
      </div>
    </div>
  );
}

function TabletFrame({ width, height, scale }: { width: number; height: number; scale: number }) {
  return (
    <div style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
      <div
        className="relative bg-zinc-900 rounded-[30px] p-[20px] shadow-2xl shadow-black/50"
        style={{
          width: width + 40,
          border: '3px solid #3f3f46',
        }}
      >
        {/* Front camera */}
        <div className="absolute top-[28px] left-1/2 -translate-x-1/2 w-[10px] h-[10px] bg-zinc-800 rounded-full z-20 border border-zinc-700" />

        {/* Screen */}
        <div
          className="rounded-[10px] overflow-hidden bg-black"
          style={{ width, height }}
        >
          <iframe
            src="/prototype"
            className="w-full h-full border-0"
            style={{ width, height }}
          />
        </div>
      </div>
    </div>
  );
}

function DesktopFrame({ width, height, scale }: { width: number; height: number; scale: number }) {
  return (
    <div style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
      {/* Monitor */}
      <div
        className="relative bg-zinc-900 rounded-t-[16px] p-[12px] shadow-2xl shadow-black/50"
        style={{
          width: width + 24,
          border: '3px solid #3f3f46',
          borderBottom: 'none',
        }}
      >
        {/* Webcam */}
        <div className="absolute top-[6px] left-1/2 -translate-x-1/2 w-[8px] h-[8px] bg-zinc-700 rounded-full z-20" />

        {/* Screen */}
        <div
          className="rounded-[4px] overflow-hidden bg-black"
          style={{ width, height }}
        >
          <iframe
            src="/prototype"
            className="w-full h-full border-0"
            style={{ width, height }}
          />
        </div>
      </div>

      {/* Chin */}
      <div
        className="mx-auto bg-zinc-800 rounded-b-[4px] h-[24px] flex items-center justify-center"
        style={{
          width: width + 30,
          borderLeft: '3px solid #3f3f46',
          borderRight: '3px solid #3f3f46',
          borderBottom: '3px solid #3f3f46',
        }}
      >
        <div className="w-[60px] h-[4px] bg-zinc-700 rounded-full" />
      </div>

      {/* Stand neck */}
      <div className="mx-auto w-[80px] h-[50px] bg-gradient-to-b from-zinc-700 to-zinc-800"
        style={{ borderLeft: '2px solid #3f3f46', borderRight: '2px solid #3f3f46' }}
      />

      {/* Stand base */}
      <div className="mx-auto w-[220px] h-[12px] bg-zinc-800 rounded-[6px]"
        style={{ border: '2px solid #3f3f46' }}
      />
    </div>
  );
}
