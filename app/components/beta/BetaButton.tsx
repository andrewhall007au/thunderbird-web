'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { BetaApplyModal } from './BetaApplyModal';

interface BetaButtonProps {
  className?: string;
  children?: React.ReactNode;
}

export function BetaButton({ className, children }: BetaButtonProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={className || 'btn-orange inline-flex items-center gap-2 px-8 py-3.5'}
      >
        {children || (
          <>
            Apply for Beta
            <ChevronRight className="w-4 h-4" />
          </>
        )}
      </button>

      {showModal && <BetaApplyModal onClose={() => setShowModal(false)} />}
    </>
  );
}
