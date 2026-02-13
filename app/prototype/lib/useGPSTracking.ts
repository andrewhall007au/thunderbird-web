'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { haversineKm } from '../../lib/trailMatch';

export interface TrackPoint {
  lat: number;
  lng: number;
  ts: number;
  acc?: number;
  elev?: number;
}

const STORAGE_KEY = 'tb-gps-track';
const MIN_DISTANCE_KM = 0.02; // 20 meters

function loadTrack(): TrackPoint[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // corrupt data — discard
  }
  return [];
}

function saveTrack(track: TrackPoint[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(track));
  } catch {
    // quota exceeded — continue in memory only
  }
}

export function useGPSTracking() {
  const [tracking, setTracking] = useState(false);
  const [track, setTrack] = useState<TrackPoint[]>(() => loadTrack());
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trackRef = useRef(track);
  const watchIdRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    trackRef.current = track;
  }, [track]);

  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
    } catch {
      // wake lock not available — non-fatal
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }, []);

  // Re-acquire wake lock when tab becomes visible while tracking
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && watchIdRef.current !== null) {
        acquireWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [acquireWakeLock]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not available');
      return;
    }
    setError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy, altitude } = pos.coords;
        setCurrentPosition({ lat, lng });

        const prev = trackRef.current;
        const last = prev[prev.length - 1];
        if (!last || haversineKm(last.lat, last.lng, lat, lng) >= MIN_DISTANCE_KM) {
          const point: TrackPoint = { lat, lng, ts: Date.now() };
          if (accuracy != null) point.acc = Math.round(accuracy);
          if (altitude != null) point.elev = Math.round(altitude);

          const next = [...prev, point];
          setTrack(next);
          saveTrack(next);
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setError('Location permission denied');
          stopTracking();
        }
        // POSITION_UNAVAILABLE and TIMEOUT: watchPosition keeps retrying
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    setTracking(true);
    acquireWakeLock();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acquireWakeLock]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTracking(false);
    releaseWakeLock();
  }, [releaseWakeLock]);

  const clearTrack = useCallback(() => {
    setTrack([]);
    trackRef.current = [];
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      releaseWakeLock();
    };
  }, [releaseWakeLock]);

  // Cumulative distance (km) and elevation gain (m)
  const stats = useMemo(() => {
    let distanceKm = 0;
    let elevGain = 0;
    for (let i = 1; i < track.length; i++) {
      distanceKm += haversineKm(track[i - 1].lat, track[i - 1].lng, track[i].lat, track[i].lng);
      if (track[i].elev != null && track[i - 1].elev != null) {
        const diff = track[i].elev! - track[i - 1].elev!;
        if (diff > 0) elevGain += diff;
      }
    }
    return { distanceKm, elevGain: Math.round(elevGain) };
  }, [track]);

  return { tracking, track, currentPosition, error, stats, startTracking, stopTracking, clearTrack };
}
