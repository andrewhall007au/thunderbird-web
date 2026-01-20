'use client'

import { useState, useEffect } from 'react'
import { Settings, Check, ThermometerSun, Mountain } from 'lucide-react'

interface AccountSettings {
  unit_system: 'metric' | 'imperial'
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AccountSettings>({
    unit_system: 'metric'
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch current settings on mount
  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setError('Please log in to view settings')
        setLoading(false)
        return
      }

      const res = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (res.ok) {
        const data = await res.json()
        setSettings({
          unit_system: data.unit_system || 'metric'
        })
      } else if (res.status === 401) {
        setError('Session expired. Please log in again.')
      }
    } catch (e) {
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async (newUnitSystem: 'metric' | 'imperial') => {
    setSaving(true)
    setSaved(false)
    setError(null)

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setError('Please log in to save settings')
        return
      }

      const res = await fetch('/api/auth/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ unit_system: newUnitSystem })
      })

      if (res.ok) {
        setSettings({ unit_system: newUnitSystem })
        setSaved(true)
        // Clear saved indicator after 3 seconds
        setTimeout(() => setSaved(false), 3000)
      } else {
        const data = await res.json()
        setError(data.detail || 'Failed to save settings')
      }
    } catch (e) {
      setError('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="py-20">
        <div className="max-w-md mx-auto px-4 text-center">
          <div className="animate-pulse">
            <div className="h-12 w-12 bg-gray-200 rounded-full mx-auto mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-48 mx-auto mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-64 mx-auto"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="py-20">
      <div className="max-w-md mx-auto px-4">
        <div className="text-center mb-8">
          <Settings className="w-12 h-12 text-orange-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-gray-600">
            Customize your forecast display preferences
          </p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6 text-center text-red-300">
            {error}
          </div>
        )}

        {saved && (
          <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 mb-6 flex items-center justify-center gap-2 text-green-300">
            <Check className="w-5 h-5" />
            Settings saved
          </div>
        )}

        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <ThermometerSun className="w-5 h-5 text-orange-500" />
            Units
          </h2>

          <p className="text-gray-600 mb-4">
            Choose how temperature and elevation are displayed in your forecasts.
          </p>

          <div className="space-y-3">
            <label
              className={`block p-4 rounded-lg border cursor-pointer transition-colors ${
                settings.unit_system === 'metric'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input
                type="radio"
                name="unit_system"
                value="metric"
                checked={settings.unit_system === 'metric'}
                onChange={() => saveSettings('metric')}
                disabled={saving}
                className="sr-only"
              />
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">Metric</p>
                  <p className="text-gray-500 text-sm">Celsius, meters</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm">15°C, 1200m</span>
                  {settings.unit_system === 'metric' && (
                    <Check className="w-5 h-5 text-orange-500" />
                  )}
                </div>
              </div>
            </label>

            <label
              className={`block p-4 rounded-lg border cursor-pointer transition-colors ${
                settings.unit_system === 'imperial'
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              <input
                type="radio"
                name="unit_system"
                value="imperial"
                checked={settings.unit_system === 'imperial'}
                onChange={() => saveSettings('imperial')}
                disabled={saving}
                className="sr-only"
              />
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">Imperial</p>
                  <p className="text-gray-500 text-sm">Fahrenheit, feet</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-sm">59°F, 3900ft</span>
                  {settings.unit_system === 'imperial' && (
                    <Check className="w-5 h-5 text-orange-500" />
                  )}
                </div>
              </div>
            </label>
          </div>

          <div className="mt-6 p-4 bg-gray-100 rounded-lg">
            <div className="flex items-start gap-3">
              <Mountain className="w-5 h-5 text-gray-500 mt-0.5" />
              <div className="text-sm text-gray-500">
                <p className="mb-2">
                  <strong className="text-gray-700">SMS users:</strong> You can also change units by texting:
                </p>
                <code className="bg-gray-200 px-2 py-1 rounded text-gray-700">
                  UNITS METRIC
                </code>
                {' or '}
                <code className="bg-gray-200 px-2 py-1 rounded text-gray-700">
                  UNITS IMPERIAL
                </code>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-gray-400 text-sm">
          <p>Changes apply to all future forecasts</p>
        </div>
      </div>
    </div>
  )
}
