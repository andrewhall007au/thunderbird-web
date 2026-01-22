'use client';

import { useState } from 'react';

export default function PreviewPage() {
  const [path, setPath] = useState('/');

  const pages = [
    { label: 'Home', path: '/' },
    { label: 'How It Works', path: '/how-it-works' },
    { label: 'Pricing', path: '/pricing' },
    { label: 'Checkout', path: '/checkout' },
  ];

  return (
    <div className="min-h-screen bg-zinc-900 p-4">
      <div className="mb-4 flex items-center gap-4">
        <span className="text-white text-sm font-medium">Preview:</span>
        <div className="flex gap-2">
          {pages.map((page) => (
            <button
              key={page.path}
              onClick={() => setPath(page.path)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                path === page.path
                  ? 'bg-orange-500 text-white'
                  : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
              }`}
            >
              {page.label}
            </button>
          ))}
        </div>
        <span className="text-zinc-500 text-xs ml-4">
          Tip: iframes use container width, not viewport. For true mobile testing, use browser DevTools.
        </span>
      </div>

      <div className="flex gap-6 h-[calc(100vh-80px)]">
        {/* Mobile View - scaled down to fit */}
        <div className="flex flex-col flex-shrink-0">
          <div className="text-zinc-400 text-xs mb-2 text-center">Mobile (375×812)</div>
          <div
            className="bg-white rounded-2xl overflow-hidden shadow-2xl origin-top-left"
            style={{
              width: '375px',
              height: '812px',
              transform: 'scale(0.75)',
              transformOrigin: 'top left'
            }}
          >
            <iframe
              src={path}
              style={{ width: '375px', height: '812px' }}
              className="border-0"
              title="Mobile Preview"
            />
          </div>
        </div>

        {/* Desktop View */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="text-zinc-400 text-xs mb-2 text-center">Desktop</div>
          <div className="h-full bg-white rounded-2xl overflow-hidden shadow-2xl">
            <iframe
              src={path}
              className="w-full h-full border-0"
              title="Desktop Preview"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
