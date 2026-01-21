'use client';

import Link from 'next/link';
import { useAuth } from '@/app/lib/auth';
import { User, LogIn } from 'lucide-react';

export function HeaderAuth() {
  const { isAuthenticated, isLoading, account } = useAuth();

  if (isLoading) {
    return (
      <div className="w-20 h-9 bg-zinc-100 rounded-lg animate-pulse" />
    );
  }

  if (isAuthenticated && account) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/account"
          className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
        >
          <User className="w-4 h-4" />
          <span className="hidden lg:inline max-w-[120px] truncate">
            {account.email.split('@')[0]}
          </span>
        </Link>
        <Link href="/checkout" className="btn-orange text-sm px-4 py-2">
          Buy Now
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/login"
        className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
      >
        <LogIn className="w-4 h-4" />
        Sign In
      </Link>
      <Link href="/checkout" className="btn-orange text-sm px-4 py-2">
        Buy Now
      </Link>
    </div>
  );
}
