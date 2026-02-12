'use client';

import { useState, useRef, useEffect } from 'react';
import type { Pin } from '../lib/types';
import { Copy, X, Trash2, ChevronUp, Pencil } from 'lucide-react';

interface PinPanelProps {
  pins: Pin[];
  onRemovePin: (id: string) => void;
  onRenamePin: (id: string, newLabel: string) => void;
  onClearPins: () => void;
  offlineMode?: boolean;
}

const MAX_PINS = 8;

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    return true;
  } catch {
    return false;
  }
}

export default function PinPanel({ pins, onRemovePin, onRenamePin, onClearPins, offlineMode }: PinPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [clearConfirm, setClearConfirm] = useState(false);

  const handleClearPins = () => {
    if (!clearConfirm) {
      setClearConfirm(true);
      setTimeout(() => setClearConfirm(false), 3000);
      return;
    }
    onClearPins();
    setClearConfirm(false);
  };

  return (
    <div className="bg-zinc-800 border-t border-zinc-700">
      {/* Collapsed header */}
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-zinc-750 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium">
            {pins.length}/{MAX_PINS} pins
            {offlineMode && <span className="text-amber-400 ml-2">SMS Mode</span>}
          </div>
        </div>
        <ChevronUp className={`w-5 h-5 text-zinc-400 transition-transform ${isExpanded ? '' : 'rotate-180'}`} />
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-zinc-700">
          {pins.length === 0 ? (
            <div className="px-4 py-3 text-center text-zinc-500">
              <div className="text-sm">
                {offlineMode ? 'Tap map to drop pins, then copy WX command' : 'Tap map to drop a pin'}
              </div>
            </div>
          ) : (
            <>
              {/* Pin cards */}
              <div className="max-h-64 overflow-y-auto">
                {pins.map(pin => (
                  <PinCard
                    key={pin.id}
                    pin={pin}
                    onRemove={() => onRemovePin(pin.id)}
                    onRename={(newLabel) => onRenamePin(pin.id, newLabel)}
                  />
                ))}
              </div>

              {/* Bottom: clear */}
              <div className="px-4 py-3 bg-zinc-900 border-t border-zinc-700">
                <button
                  onClick={handleClearPins}
                  className={`
                    w-full px-3 py-2 rounded text-sm font-medium transition-colors
                    ${clearConfirm
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-zinc-700 hover:bg-zinc-600'
                    }
                  `}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5" />
                    {clearConfirm ? 'Confirm' : 'Clear'}
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PinCard({
  pin,
  onRemove,
  onRename
}: {
  pin: Pin;
  onRemove: () => void;
  onRename: (newLabel: string) => void;
}) {
  const [copyFeedback, setCopyFeedback] = useState(false);

  const handleCopy = async () => {
    const command = `WX ${pin.lat.toFixed(3)} ${pin.lng.toFixed(3)}`;
    const ok = await copyToClipboard(command);
    if (ok) {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1500);
    }
  };

  return (
    <div className="px-4 py-3 border-b border-zinc-700 last:border-b-0">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <PinLabel label={pin.label} onRename={onRename} />
          <div className="text-sm font-mono text-zinc-300 truncate">
            {pin.lat.toFixed(3)}, {pin.lng.toFixed(3)}
          </div>
          {pin.elevation != null && (
            <div className="text-sm font-mono text-zinc-300 flex-shrink-0">Elevation {pin.elevation}m</div>
          )}
        </div>
        <button
          onClick={onRemove}
          className="p-1 hover:bg-zinc-600 rounded transition-colors flex-shrink-0"
          title="Remove pin"
        >
          <X className="w-4 h-4 text-zinc-400" />
        </button>
      </div>
      <button
        onClick={handleCopy}
        className="w-full px-2 py-1.5 bg-zinc-600 hover:bg-zinc-500 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
      >
        <Copy className="w-3 h-3" />
        {copyFeedback ? 'Copied!' : 'Copy GPS point for SMS'}
      </button>
    </div>
  );
}

function PinLabel({ label, onRename }: { label: string; onRename: (newLabel: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const save = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== label) {
      onRename(trimmed);
    } else {
      setValue(label);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={e => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') { setValue(label); setEditing(false); }
        }}
        className="bg-zinc-600 text-white text-xs font-bold rounded px-1.5 py-0.5 w-20 outline-none ring-1 ring-blue-500 flex-shrink-0"
        maxLength={12}
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="group inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600 rounded text-white text-xs font-bold flex-shrink-0 hover:bg-blue-500 transition-colors"
      title="Click to rename"
    >
      {label}
      <Pencil className="w-2.5 h-2.5 text-blue-200 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
