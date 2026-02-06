'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/lib/auth';
import { getRoutes, RouteResponse } from '@/app/lib/api';
import {
  Map, Plus, CreditCard, Settings, Phone, LogOut,
  ChevronRight, Wallet, Route, AlertCircle, Check
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

function formatBalance(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function BalanceCard({ disabled = false }: { disabled?: boolean }) {
  const { balance, refreshBalance } = useAuth();
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);

  const handleTopUp = async (amount: number) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/api/payments/top-up`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ amount_cents: amount })
      });

      if (!res.ok) throw new Error('Failed to create checkout');

      const { checkout_url } = await res.json();
      window.location.href = checkout_url;
    } catch (err) {
      console.error('Top-up error:', err);
    }
  };

  return (
    <div className={`bg-white rounded-xl border border-zinc-200 p-6 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-zinc-400" />
          Balance
        </h2>
      </div>

      <div className="text-3xl font-bold text-zinc-900 mb-1">
        {balance ? formatBalance(balance.balance_cents) : '$0.00'}
      </div>
      <p className="text-sm text-zinc-500 mb-4">
        SMS credits for forecasts
      </p>

      {!isTopUpOpen ? (
        <button
          onClick={() => setIsTopUpOpen(true)}
          disabled={disabled}
          className="w-full btn-orange py-2.5 flex items-center justify-center gap-2"
        >
          <CreditCard className="w-4 h-4" />
          Top Up
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-zinc-600 mb-2">Select amount:</p>
          <div className="grid grid-cols-3 gap-2">
            {[500, 1000, 2000].map((amount) => (
              <button
                key={amount}
                onClick={() => handleTopUp(amount)}
                className="py-2 px-3 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-sm font-medium text-zinc-700 transition-colors"
              >
                ${amount / 100}
              </button>
            ))}
          </div>
          <button
            onClick={() => setIsTopUpOpen(false)}
            className="w-full mt-2 py-2 text-sm text-zinc-500 hover:text-zinc-700"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function RoutesCard({ disabled = false }: { disabled?: boolean }) {
  const [routes, setRoutes] = useState<RouteResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        const data = await getRoutes();
        setRoutes(data);
      } catch (err) {
        setError('Failed to load routes');
      } finally {
        setIsLoading(false);
      }
    };
    if (!disabled) {
      fetchRoutes();
    }
  }, [disabled]);

  return (
    <div className={`bg-white rounded-xl border border-zinc-200 p-6 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
          <Route className="w-5 h-5 text-zinc-400" />
          Route Library
        </h2>
        <Link
          href="/create"
          className="btn-orange px-4 py-2 text-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Route
        </Link>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-zinc-400">Loading routes...</div>
      ) : error ? (
        <div className="py-8 text-center text-red-500 flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      ) : routes.length === 0 ? (
        <div className="py-8 text-center">
          <Map className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
          <p className="text-zinc-500 mb-4">No routes in your library</p>
          <Link href="/create" className="btn-orange inline-flex items-center gap-2 px-4 py-2">
            <Plus className="w-4 h-4" />
            Add Your First Route
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {routes.slice(0, 5).map((route) => {
            // Generate 5-letter track code from route name
            const trackCode = route.name
              .replace(/[^A-Za-z]/g, '')
              .toUpperCase()
              .slice(0, 5);

            return (
              <div key={route.id} className="p-3 rounded-lg hover:bg-zinc-50 transition-colors">
                <Link
                  href={`/create?id=${route.id}`}
                  className="flex items-center justify-between group"
                >
                  <div>
                    <div className="font-medium text-zinc-900">{route.name}</div>
                    <div className="text-sm text-zinc-500">
                      {route.waypoint_count} waypoint{route.waypoint_count !== 1 ? 's' : ''}
                      <span className="mx-1.5 text-zinc-300">·</span>
                      <span className={route.status === 'active' ? 'text-emerald-600' : 'text-zinc-400'}>
                        {route.status}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-zinc-300 group-hover:text-zinc-500" />
                </Link>
                {route.status === 'active' && (
                  <div className="mt-2 text-sm text-zinc-600">
                    Activate by sending "<span className="font-bold text-zinc-800">START {trackCode}</span>" to +1 (866) 280-1940
                  </div>
                )}
              </div>
            );
          })}
          {routes.length > 5 && (
            <Link
              href="/routes"
              className="block text-center py-2 text-sm text-zinc-500 hover:text-zinc-700"
            >
              View all {routes.length} routes
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function SettingsCard() {
  const { account, refreshAccount } = useAuth();
  const [phone, setPhone] = useState('');
  const [isLinkingPhone, setIsLinkingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [phoneSuccess, setPhoneSuccess] = useState(false);
  const [unitSystem, setUnitSystem] = useState(account?.unit_system || 'metric');
  const [isSavingUnits, setIsSavingUnits] = useState(false);

  const hasPhone = !!account?.phone;

  const handleLinkPhone = async () => {
    if (!phone) return;
    setPhoneError('');
    setPhoneSuccess(false);
    setIsLinkingPhone(true);

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/auth/phone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ phone })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Failed to link phone');
      }

      setPhoneSuccess(true);
      setPhone('');
      refreshAccount();
    } catch (err) {
      setPhoneError(err instanceof Error ? err.message : 'Failed to link phone');
    } finally {
      setIsLinkingPhone(false);
    }
  };

  const handleUnitChange = async (system: string) => {
    setUnitSystem(system);
    setIsSavingUnits(true);

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      await fetch(`${API_BASE}/auth/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ unit_system: system })
      });
      refreshAccount();
    } catch (err) {
      console.error('Failed to update units:', err);
    } finally {
      setIsSavingUnits(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-6">
      <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2 mb-4">
        <Settings className="w-5 h-5 text-zinc-400" />
        Settings
      </h2>

      <div className="space-y-6">
        {/* Phone Number */}
        <div>
          {!hasPhone && (
            <div className="mb-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm font-medium text-orange-900 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Phone number required to receive forecasts
              </p>
            </div>
          )}
          <label className="block text-sm font-medium text-zinc-700 mb-2">
            <Phone className="w-4 h-4 inline mr-1.5" />
            Phone Number
          </label>
          {hasPhone ? (
            <div className="flex items-center gap-2 text-zinc-900">
              <Check className="w-4 h-4 text-emerald-500" />
              {account.phone}
            </div>
          ) : (
            <div>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555 123 4567"
                  className="flex-1 px-4 py-3 border-2 border-orange-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
                <button
                  onClick={handleLinkPhone}
                  disabled={isLinkingPhone || !phone}
                  className="px-6 py-3 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {isLinkingPhone ? 'Linking...' : 'Link Phone'}
                </button>
              </div>
              {phoneError && (
                <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {phoneError}
                </p>
              )}
              {phoneSuccess && (
                <p className="mt-2 text-sm text-emerald-600 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Phone linked successfully!
                </p>
              )}
              <p className="mt-2 text-xs text-zinc-500">
                Enter your satellite device phone number to receive weather forecasts via SMS
              </p>
            </div>
          )}
        </div>

        {/* Unit System */}
        <div className={!hasPhone ? 'opacity-40' : ''}>
          <label className="block text-sm font-medium text-zinc-700 mb-2">
            Units
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => handleUnitChange('metric')}
              disabled={isSavingUnits || !hasPhone}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                unitSystem === 'metric'
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              } ${!hasPhone ? 'cursor-not-allowed' : ''}`}
            >
              Metric (°C, m)
            </button>
            <button
              onClick={() => handleUnitChange('imperial')}
              disabled={isSavingUnits || !hasPhone}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                unitSystem === 'imperial'
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              } ${!hasPhone ? 'cursor-not-allowed' : ''}`}
            >
              Imperial (°F, ft)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const { account, isLoading, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!account) {
    return null;
  }

  const hasPhone = !!account?.phone;

  return (
    <div className="py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">Account</h1>
            <p className="text-zinc-500">{account.email}</p>
          </div>
          <button
            onClick={() => { logout(); router.push('/'); }}
            className="flex items-center gap-2 px-4 py-2 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>

        {/* Alert Banner */}
        {!hasPhone && (
          <div className="mb-6 p-4 bg-orange-100 border-2 border-orange-400 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-orange-900 mb-1">
                  Complete Setup: Link Your Phone Number
                </h3>
                <p className="text-sm text-orange-800">
                  You need to link your satellite device phone number before you can create routes or receive forecasts.
                  Add your phone number in Settings below to get started.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          <BalanceCard disabled={!hasPhone} />
          <SettingsCard />
          <div className="md:col-span-2">
            <RoutesCard disabled={!hasPhone} />
          </div>
        </div>
      </div>
    </div>
  );
}
