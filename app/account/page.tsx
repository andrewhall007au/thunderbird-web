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

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function formatBalance(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function BalanceCard() {
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
    <div className="bg-white rounded-xl border border-zinc-200 p-6">
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

function RoutesCard() {
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
    fetchRoutes();
  }, []);

  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
          <Route className="w-5 h-5 text-zinc-400" />
          My Routes
        </h2>
        <Link
          href="/create"
          className="text-sm text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"
        >
          <Plus className="w-4 h-4" />
          New
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
          <p className="text-zinc-500 mb-4">No routes yet</p>
          <Link href="/create" className="btn-orange inline-flex items-center gap-2 px-4 py-2">
            <Plus className="w-4 h-4" />
            Create Your First Route
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {routes.slice(0, 5).map((route) => (
            <Link
              key={route.id}
              href={`/create?route=${route.id}`}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-zinc-50 transition-colors group"
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
          ))}
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
          <label className="block text-sm font-medium text-zinc-700 mb-2">
            <Phone className="w-4 h-4 inline mr-1.5" />
            Phone Number
          </label>
          {account?.phone ? (
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
                  className="flex-1 px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <button
                  onClick={handleLinkPhone}
                  disabled={isLinkingPhone || !phone}
                  className="px-4 py-2 bg-zinc-900 text-white text-sm rounded-lg hover:bg-zinc-800 disabled:opacity-50"
                >
                  {isLinkingPhone ? 'Linking...' : 'Link'}
                </button>
              </div>
              {phoneError && (
                <p className="mt-1 text-sm text-red-500">{phoneError}</p>
              )}
              {phoneSuccess && (
                <p className="mt-1 text-sm text-emerald-600">Phone linked successfully!</p>
              )}
              <p className="mt-1 text-xs text-zinc-400">
                Link your phone to receive SMS forecasts
              </p>
            </div>
          )}
        </div>

        {/* Unit System */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-2">
            Units
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => handleUnitChange('metric')}
              disabled={isSavingUnits}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                unitSystem === 'metric'
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              Metric (°C, m)
            </button>
            <button
              onClick={() => handleUnitChange('imperial')}
              disabled={isSavingUnits}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                unitSystem === 'imperial'
                  ? 'bg-zinc-900 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
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

        {/* Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          <BalanceCard />
          <SettingsCard />
          <div className="md:col-span-2">
            <RoutesCard />
          </div>
        </div>
      </div>
    </div>
  );
}
