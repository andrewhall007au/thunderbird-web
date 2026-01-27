'use client';

import { useState, useEffect } from 'react';
import { Smartphone, Tablet, Monitor } from 'lucide-react';

const devices = [
  { id: 'phone', label: 'Phone', icon: Smartphone, width: 375, height: 812 },
  { id: 'tablet', label: 'Tablet', icon: Tablet, width: 768, height: 1024 },
  { id: 'laptop', label: 'Laptop', icon: Monitor, width: 1440, height: 900 },
];

const pages = [
  { path: '/', label: 'Landing Page' },
  { path: '/create', label: 'Create Route' },
  { path: '/library', label: 'Route Library' },
  { path: '/pricing', label: 'Pricing' },
  { path: '/how-it-works', label: 'How It Works' },
  { path: '/compatibility', label: 'Device Compatibility' },
  { path: '/register', label: 'Register' },
  { path: '/login', label: 'Login' },
];

export default function PreviewPage() {
  const [activeDevice, setActiveDevice] = useState('phone');
  const [activePage, setActivePage] = useState('/');
  const [scale, setScale] = useState(1);
  const [mounted, setMounted] = useState(false);
  const device = devices.find(d => d.id === activeDevice)!;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const updateScale = () => {
      const maxWidth = window.innerWidth - 100;
      const maxHeight = window.innerHeight - 180;
      const newScale = Math.min(maxWidth / device.width, maxHeight / device.height, 1);
      setScale(newScale);
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [mounted, device.width, device.height]);

  if (!mounted) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-zinc-400">Loading preview...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      {/* Tab Header */}
      <div className="fixed top-0 left-0 right-0 z-[110] bg-zinc-800 border-b border-zinc-700">
        <div className="flex items-center justify-center gap-4 p-3">
          {/* Device toggles */}
          <div className="flex gap-2">
            {devices.map((d) => {
              const Icon = d.icon;
              return (
                <button
                  key={d.id}
                  onClick={() => setActiveDevice(d.id)}
                  className={
                    activeDevice === d.id
                      ? 'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all bg-orange-500 text-white'
                      : 'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                  }
                >
                  <Icon className="w-4 h-4" />
                  {d.label}
                  <span className="text-xs opacity-70">
                    {d.width}x{d.height}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Page selector */}
          <div className="border-l border-zinc-600 pl-4">
            <select
              value={activePage}
              onChange={(e) => setActivePage(e.target.value)}
              className="bg-zinc-700 text-zinc-200 text-sm px-3 py-2 rounded-lg border border-zinc-600 focus:outline-none focus:border-orange-500"
            >
              {pages.map((p) => (
                <option key={p.path} value={p.path}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Device Frame */}
      <div className="flex items-center justify-center pt-20 pb-8">
        <div
          className="bg-zinc-800 rounded-2xl p-4 shadow-2xl"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
          }}
        >
          <div
            className="bg-white rounded-lg overflow-hidden shadow-inner"
            style={{ width: device.width, height: device.height }}
          >
            <iframe
              key={activePage}
              src={activePage}
              className="w-full h-full border-0"
              title={`${device.label} Preview - ${activePage}`}
            />
          </div>
        </div>
      </div>

      {/* Current dimensions */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[110] bg-zinc-800 text-zinc-400 px-4 py-2 rounded-full text-sm">
        {device.width} x {device.height} ({Math.round(scale * 100)}% scale)
      </div>
    </div>
  );
}
