'use client';

import { useState, useEffect, useCallback } from 'react';
import type { LabSession, LabRecord } from './types';
import { api } from './api';

/**
 * Persist the active session across page navigations.
 *
 * The teacher's flow:
 *   1. Create a session on /new-session → session is "active"
 *   2. Click Dashboard / Records / Students tab → come back to /new-session
 *      → the active session is restored automatically (no re-creation needed).
 *   3. Click "End Session" → session is cleared, fresh form is shown.
 *
 * The session ID and basic metadata are stored in localStorage so the
 * session survives navigation, page refresh, and tab close (within reason —
 * the backend still has the session, so even if localStorage is cleared, the
 * teacher could re-fetch by ID, but we don't expose that path here).
 */

const STORAGE_KEY = 'active_lab_session_v1';

interface StoredSession {
  sessionId: string;
  // Cache a few display fields so we can render the header instantly
  // even before the GET /sessions/:id resolves on remount.
  cached: {
    class: number;
    section: string;
    date: string;
    topic: string;
    materialsRequired: string | null;
  };
}

function readStored(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

function writeStored(s: StoredSession | null) {
  if (typeof window === 'undefined') return;
  try {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* localStorage unavailable — fail silently */
  }
}

export function useActiveSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<LabSession | null>(null);
  const [records, setRecords] = useState<LabRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // On mount, try to restore the active session from localStorage.
  useEffect(() => {
    const stored = readStored();
    if (!stored) return;

    // Auto-expire: if the stored session is older than 24 hours, discard it.
    // This prevents the "I forgot to End Session on Friday" problem from
    // auto-restoring a stale session on Monday morning.
    const storedAt = (stored as any).storedAt as number | undefined;
    const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
    if (storedAt && Date.now() - storedAt > MAX_AGE_MS) {
      writeStored(null);
      return;
    }

    setRestoring(true);
    api<LabSession>(`/sessions/${stored.sessionId}`)
      .then((data) => {
        setSessionId(stored.sessionId);
        setSession(data);
        setRecords(data.labRecords || []);
      })
      .catch(() => {
        // Session was probably deleted from the backend. Clear local state.
        writeStored(null);
      })
      .finally(() => setRestoring(false));
  }, []);

  /** Activate a freshly-created session (or any session by ID). */
  const activate = useCallback((s: LabSession) => {
    setSessionId(s.id);
    setSession(s);
    setRecords(s.labRecords || []);
    writeStored({
      sessionId: s.id,
      cached: {
        class: s.class,
        section: s.section,
        date: s.date,
        topic: s.topic,
        materialsRequired: s.materialsRequired,
      },
      // We also stash the activation timestamp for the 24h auto-expire.
      storedAt: Date.now(),
    } as any);
  }, []);

  /** Check if there's an active session (used by sidebar indicator). */
  const isActive = useCallback(() => sessionId !== null, [sessionId]);

  /** End the active session — clears local state + localStorage. */
  const end = useCallback(() => {
    setSessionId(null);
    setSession(null);
    setRecords([]);
    writeStored(null);
  }, []);

  /** Refresh records from the backend (used after bulk updates). */
  const refreshRecords = useCallback(async () => {
    if (!sessionId) return;
    const fresh = await api<LabSession>(`/sessions/${sessionId}`);
    setSession(fresh);
    setRecords(fresh.labRecords || []);
  }, [sessionId]);

  return {
    sessionId,
    session,
    records,
    setRecords,
    loading,
    restoring,
    activate,
    end,
    refreshRecords,
    isActive, // for sidebar indicator
  };
}
