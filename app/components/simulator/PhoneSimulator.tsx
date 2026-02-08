'use client';

import { useState, useEffect } from 'react';

interface PhoneSimulatorProps {
  /** SMS message content to display */
  content: string;
  /** Device variant to render */
  variant?: 'iphone' | 'watch';
  /** Whether to animate typing effect */
  animateTyping?: boolean;
  /** Additional CSS classes for positioning */
  className?: string;
}

/**
 * PhoneSimulator - Renders realistic device mockups with SMS content.
 *
 * Extracted from landing page CSS (app/page.tsx lines 44-135).
 * Used to show users what SMS forecasts look like on their devices.
 *
 * @example
 * ```tsx
 * <PhoneSimulator
 *   content={`LAKEO Lake Oberon (863m)\n24hr from 06:00 Mon\n\n06h 5-7o Rn15% W12-20`}
 *   variant="iphone"
 *   animateTyping={true}
 * />
 * ```
 */
export function PhoneSimulator({
  content,
  variant = 'iphone',
  animateTyping = false,
  className = '',
}: PhoneSimulatorProps) {
  const [displayedContent, setDisplayedContent] = useState(animateTyping ? '' : content);

  // Typing animation effect
  useEffect(() => {
    if (!animateTyping) {
      setDisplayedContent(content);
      return;
    }

    // Reset on content change
    setDisplayedContent('');
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex < content.length) {
        setDisplayedContent(content.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(interval);
      }
    }, 30); // 30ms per character

    return () => clearInterval(interval);
  }, [content, animateTyping]);

  if (variant === 'watch') {
    return <WatchVariant content={displayedContent} className={className} />;
  }

  return <IPhoneVariant content={displayedContent} className={className} />;
}

/**
 * iPhone variant - 280x560px black frame with notch
 */
function IPhoneVariant({ content, className }: { content: string; className: string }) {
  return (
    <div data-testid="phone-simulator" className={`flex flex-col items-center ${className}`}>
      {/* iPhone frame - 280x560px with 36px border radius */}
      <div className="w-[280px] h-[560px] bg-black rounded-[36px] p-[12px] shadow-2xl relative">
        {/* Notch - 100x22px centered at top */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[100px] h-[22px] bg-black rounded-b-[12px] z-10" />

        {/* Screen - white with 26px radius */}
        <div className="w-full h-full bg-white rounded-[26px] overflow-hidden flex flex-col">
          {/* Header bar */}
          <div className="bg-[#f6f6f6] pt-[38px] pb-[8px] px-[12px] text-center border-b border-[#ddd]">
            <span className="text-black text-[15px] font-semibold">Thunderbird</span>
          </div>

          {/* Messages area - scrollable */}
          <div className="flex-1 p-[12px] overflow-y-auto">
            {/* SMS bubble - gray background, left-aligned */}
            <div className="bg-[#e5e5ea] text-black p-[8px_12px] rounded-[16px] rounded-bl-[4px] max-w-[90%] text-[13px] leading-[1.4] whitespace-pre-wrap">
              {content}
            </div>
          </div>
        </div>
      </div>
      <p className="text-gray-500 text-sm mt-3">iPhone</p>
    </div>
  );
}

/**
 * Apple Watch variant - 180x220px dark frame with orange digital crown
 */
function WatchVariant({ content, className }: { content: string; className: string }) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Watch frame - 180x220px dark with 44px radius */}
      <div className="w-[180px] h-[220px] bg-[#1a1a1a] rounded-[44px] p-[8px] shadow-2xl relative border-[3px] border-[#2a2a2a]">
        {/* Digital Crown - orange accent */}
        <div className="absolute right-[-6px] top-[60px] w-[6px] h-[28px] bg-[#ff6b00] rounded-r-[3px]" />
        {/* Side button */}
        <div className="absolute right-[-5px] top-[100px] w-[5px] h-[18px] bg-[#333] rounded-r-[2px]" />

        {/* Screen - black with 38px radius */}
        <div className="w-full h-full bg-black rounded-[38px] overflow-hidden flex flex-col">
          {/* Messages area */}
          <div className="flex-1 p-[10px] overflow-hidden">
            {/* Watch displays white text on black - 9px font */}
            <div className="text-white text-[9px] leading-[1.3] whitespace-pre-wrap">
              {content}
            </div>
          </div>
        </div>
      </div>
      <p className="text-gray-500 text-sm mt-3">Apple Watch Ultra</p>
    </div>
  );
}

export default PhoneSimulator;
