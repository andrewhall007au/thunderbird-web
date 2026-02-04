'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export interface Account {
  id: number;
  email: string;
  phone: string | null;
  unit_system: string;
  created_at: string;
}

export interface Balance {
  balance_cents: number;
  currency: string;
}

interface AuthContextType {
  account: Account | null;
  balance: Balance | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshAccount: () => Promise<void>;
  refreshBalance: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  };

  const setToken = (token: string) => {
    localStorage.setItem('token', token);
  };

  const clearToken = () => {
    localStorage.removeItem('token');
  };

  const fetchAccount = async (): Promise<Account | null> => {
    const token = getToken();
    if (!token) return null;

    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 401) {
          clearToken();
          return null;
        }
        throw new Error('Failed to fetch account');
      }
      return res.json();
    } catch {
      return null;
    }
  };

  const fetchBalance = async (): Promise<Balance | null> => {
    const token = getToken();
    if (!token) return null;

    try {
      const res = await fetch(`${API_BASE}/api/payments/balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  };

  const refreshAccount = async () => {
    const acc = await fetchAccount();
    setAccount(acc);
  };

  const refreshBalance = async () => {
    const bal = await fetchBalance();
    setBalance(bal);
  };

  // Initialize auth state on mount
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const acc = await fetchAccount();
      setAccount(acc);
      if (acc) {
        const bal = await fetchBalance();
        setBalance(bal);
      }
      setIsLoading(false);
    };
    init();
  }, []);

  const login = async (email: string, password: string) => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const res = await fetch(`${API_BASE}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: 'Login failed' }));
      throw new Error(error.detail || 'Invalid credentials');
    }

    const { access_token } = await res.json();
    setToken(access_token);

    // Fetch account and balance
    const acc = await fetchAccount();
    setAccount(acc);
    if (acc) {
      const bal = await fetchBalance();
      setBalance(bal);
    }
  };

  const register = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: 'Registration failed' }));
      throw new Error(error.detail || 'Registration failed');
    }

    // Auto-login after registration
    await login(email, password);
  };

  const logout = () => {
    clearToken();
    setAccount(null);
    setBalance(null);
  };

  return (
    <AuthContext.Provider
      value={{
        account,
        balance,
        isLoading,
        isAuthenticated: !!account,
        login,
        register,
        logout,
        refreshAccount,
        refreshBalance
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
