'use client';

import { useState, useEffect, useCallback } from 'react';
import type { LabSession, LabRecord } from './types';
import { api } from './api';

/**
 * Persist the active session across page navigations AND across devices.
 *
 * Two storage layers, used together:
 *
 *   1. localStorage  — for INSTANT restore on the same device. Avoids a
 *      network round-trip on mount so the teacher sees their session
 *      without waiting for /auth/me to resolve. Includes a 24h
 *      auto-expire timestamp.
 *
 *   2. Backend       — for cross-device sync. The Teacher row has an
 *      `activeSessionId` column that's set automatically by POST /sessions
 *      and cleared by DELETE /auth/active-session. When the teacher
 *      opens the app on a different device (where localStorage is empty),
 *      we fall back to /auth/me to find the active session.
 *
 * Flow:
 *   - On mount: try localStorage first. If empty, fetch /auth/me and
 *     use the returned activeSessionId (if any).
 *   - On activate(): update local state + localStorage + (the backend
 *     is updated automatically by POST /sessions, no extra call needed).
 *   - On end(): clear local state + localStorage + call
 *     DELETE /auth/active-session to clear the backend.
 *
 * The teacher's flow on the UI:
 *   1. Create a session on /new-session → session is "active"
 *   2. Open /new-session on mobile → session auto-restores from backend
 *   3. Click "End Session" on either device → both devices see the
 *      creation form again (after a refresh on the device that didn't
 *      click End Session, since we don't poll).
 */

const STORAGE_KEY = 'active_lab_session_v1';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface StoredSession {
  sessionId: string;
  cached: {
    class: number;
    section: string;
    date: string;
    topic: string;
    materialsRequired: string | null;
  };
  storedAt: number;
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

  // On mount: restore the active session from localStorage, OR fall back
  // to /auth/me (which returns activeSessionId) for cross-device sync.
  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const stored = readStored();

      // Auto-expire: if the stored session is older than 24h, discard it.
      if (stored && Date.now() - stored.storedAt > MAX_AGE_MS) {
        writeStored(null);
        // Also clear on the backend (best-effort — ignore errors).
        try {
          await api('/auth/active-session', { method: 'DELETE' });
        } catch {}
        return;
      }

      // Path A: localStorage has a session → fetch it directly.
      if (stored?.sessionId) {
        setRestoring(true);
        try {
          const data = await api<LabSession>(`/sessions/${stored.sessionId}`);
          if (cancelled) return;
          setSessionId(stored.sessionId);
          setSession(data);
          setRecords(data.labRecords || []);
        } catch {
          if (cancelled) return;
          // Session was probably deleted from the backend (e.g. via the
          // /sessions page). Clear local state AND the backend's
          // activeSessionId flag so it doesn't get re-restored later.
          writeStored(null);
          try {
            await api('/auth/active-session', { method: 'DELETE' });
          } catch {}
        } finally {
          if (!cancelled) setRestoring(false);
        }
        return;
      }

      // Path B: no localStorage entry → ask the backend.
      // This is the cross-device path. The teacher created a session on
      // their desktop, then opened the app on mobile — mobile has no
      // localStorage entry, but the backend's Teacher.activeSessionId
      // still points to the session.
      setRestoring(true);
      try {
        const me = await api<{ activeSessionId?: string | null }>('/auth/me');
        if (cancelled) return;
        if (me.activeSessionId) {
          const data = await api<LabSession>(`/sessions/${me.activeSessionId}`);
          if (cancelled) return;
          setSessionId(me.activeSessionId);
          setSession(data);
          setRecords(data.labRecords || []);
          // Cache in localStorage for next time on this device.
          writeStored({
            sessionId: me.activeSessionId,
            cached: {
              class: data.class,
              section: data.section,
              date: data.date,
              topic: data.topic,
              materialsRequired: data.materialsRequired,
            },
            storedAt: Date.now(),
          });
        }
      } catch {
        // /auth/me failed (401, etc.) — no active session to restore.
      } finally {
        if (!cancelled) setRestoring(false);
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Activate a freshly-created session. The backend already set
   *  Teacher.activeSessionId during POST /sessions, so we just update
   *  local state + localStorage here. */
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
      storedAt: Date.now(),
    });
  }, []);

  /** End the active session — clears local state + localStorage +
   *  calls DELETE /auth/active-session to clear the backend flag. */
  const end = useCallback(async () => {
    setSessionId(null);
    setSession(null);
    setRecords([]);
    writeStored(null);
    // Best-effort: tell the backend to clear activeSessionId too.
    // If this fails (network error, 401, etc.) we still clear the
    // local state so the teacher sees the creation form. The backend
    // flag will eventually clear when the teacher logs in elsewhere
    // OR when the 24h auto-expire hits.
    try {
      await api('/auth/active-session', { method: 'DELETE' });
    } catch {
      // Silent — local state is already cleared, that's what matters
      // for the immediate UX. The backend flag will clear on next
      // login or via the 24h expiry.
    }
  }, []);

  /** Refresh records from the backend (used after bulk updates). */
  const refreshRecords = useCallback(async () => {
    if (!sessionId) return;
    const fresh = await api<LabSession>(`/sessions/${sessionId}`);
    setSession(fresh);
    setRecords(fresh.labRecords || []);
  }, [sessionId]);

  /** Check if there's an active session (used by sidebar indicator). */
  const isActive = useCallback(() => sessionId !== null, [sessionId]);

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
    isActive,
  };
}
