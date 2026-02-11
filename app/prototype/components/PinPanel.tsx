'use client';

import { useState } from 'react';
import type { Pin } from '../lib/types';
import { Copy, X, Trash2, ChevronUp } from 'lucide-react';

interface PinPanelProps {
  pins: Pin[];
  onRemovePin: (id: string) => void;
  onClearPins: () => void;
}

const MAX_PINS = 8;
const SMS_MAX_LENGTH = 160;

export default function PinPanel({ pins, onRemovePin, onClearPins }: PinPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);

  // Generate WX command for a single pin
  const getPinWxCommand = (pin: Pin): string => {
    return `WX ${pin.lat.toFixed(3)} ${pin.lng.toFixed(3)}`;
  };

  // Generate WX command for all pins
  const getAllPinsWxCommand = (): string => {
    const coordPairs = pins.map(p => `${p.lat.toFixed(3)} ${p.lng.toFixed(3)}`);
    return `WX ${coordPairs.join(' ')}`;
  };

  // Copy text to clipboard
  const copyToClipboard = async (text: string, label: string) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopyFeedback(label);
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      alert('Failed to copy to clipboard');
    }
  };

  const handleCopyPin = (pin: Pin) => {
    const command = getPinWxCommand(pin);
    copyToClipboard(command, `Copied pin ${pin.label}!`);
  };

  const handleCopyAll = () => {
    const command = getAllPinsWxCommand();
    copyToClipboard(command, 'Copied all pins!');
  };

  const handleClearPins = () => {
    if (!clearConfirm) {
      setClearConfirm(true);
      setTimeout(() => setClearConfirm(false), 3000);
      return;
    }
    onClearPins();
    setClearConfirm(false);
  };

  const allPinsCommand = getAllPinsWxCommand();
  const commandLength = allPinsCommand.length;
  const isTooLong = commandLength > SMS_MAX_LENGTH;

  return (
    <div className="bg-zinc-800 border-t border-zinc-700">
      {/* Collapsed header - always visible */}
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-zinc-750 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium">
            {pins.length}/{MAX_PINS} pins
          </div>
          {pins.length > 0 && !isExpanded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopyAll();
              }}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy
            </button>
          )}
        </div>
        <ChevronUp className={`w-5 h-5 text-zinc-400 transition-transform ${isExpanded ? '' : 'rotate-180'}`} />
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-zinc-700">
          {pins.length === 0 ? (
            /* Empty state */
            <div className="px-4 py-8 text-center text-zinc-500">
              <div className="text-4xl mb-2">📍</div>
              <div className="text-sm">Tap the map to drop a pin</div>
            </div>
          ) : (
            <>
              {/* Pin list */}
              <div className="max-h-48 overflow-y-auto">
                {pins.map(pin => (
                  <div
                    key={pin.id}
                    className="px-4 py-2 flex items-center justify-between hover:bg-zinc-750 border-b border-zinc-750 last:border-b-0"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Pin label circle */}
                      <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {pin.label}
                      </div>
                      {/* Coordinates */}
                      <div className="text-sm font-mono truncate">
                        {pin.lat.toFixed(3)}°, {pin.lng.toFixed(3)}°
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Copy individual pin */}
                      <button
                        onClick={() => handleCopyPin(pin)}
                        className="p-1.5 hover:bg-zinc-600 rounded transition-colors"
                        title="Copy this pin"
                      >
                        <Copy className="w-4 h-4 text-zinc-400" />
                      </button>
                      {/* Remove pin */}
                      <button
                        onClick={() => onRemovePin(pin.id)}
                        className="p-1.5 hover:bg-zinc-600 rounded transition-colors"
                        title="Remove pin"
                      >
                        <X className="w-4 h-4 text-zinc-400" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* SMS Export section */}
              <div className="p-4 bg-zinc-900 border-t border-zinc-700">
                {pins.length === 1 ? (
                  /* Single pin copy */
                  <button
                    onClick={handleCopyAll}
                    className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copy WX Command
                  </button>
                ) : (
                  /* Multi-pin copy */
                  <div className="space-y-2">
                    <button
                      onClick={handleCopyAll}
                      className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      Copy All Pins for SMS
                    </button>
                    <div className="text-xs text-center">
                      <span className={isTooLong ? 'text-red-400' : 'text-zinc-400'}>
                        {commandLength} / {SMS_MAX_LENGTH} characters
                      </span>
                      {isTooLong && (
                        <div className="text-red-400 mt-1">
                          ⚠️ Too long for single SMS — reduce pins
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Command preview */}
                <div className="mt-3 p-2 bg-zinc-800 rounded border border-zinc-700">
                  <div className="text-xs text-zinc-500 mb-1">Preview:</div>
                  <div className="text-xs font-mono text-zinc-300 break-all">
                    {allPinsCommand}
                  </div>
                </div>

                {/* Clear all button */}
                <button
                  onClick={handleClearPins}
                  className={`
                    w-full mt-3 px-4 py-2 rounded text-sm font-medium transition-colors
                    ${clearConfirm
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-zinc-700 hover:bg-zinc-600'
                    }
                  `}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Trash2 className="w-4 h-4" />
                    {clearConfirm ? 'Click again to confirm' : 'Clear All Pins'}
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Copy feedback toast */}
      {copyFeedback && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 bg-green-600 text-white rounded shadow-lg text-sm font-medium animate-fade-in">
          {copyFeedback}
        </div>
      )}
    </div>
  );
}
