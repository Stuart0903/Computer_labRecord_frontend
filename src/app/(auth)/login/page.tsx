'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/stores/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FetchError } from '@/lib/api';
import { Laptop, Loader2 } from 'lucide-react';

function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Server-driven lockout — set when the backend returns 429.
  const [lockedUntil, setLockedUntil] = useState(0); // epoch ms, 0 = unlocked
  const [, forceTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    tickRef.current = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const remainingMs = Math.max(0, lockedUntil - Date.now());
  const isLocked = remainingMs > 0;

  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLocked) return;

    setError('');
    setLoading(true);

    try {
      await login(username, password);
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof FetchError) {
        // 429 — start the server-driven countdown using Retry-After.
        if (err.status === 429 && err.retryAfterSec) {
          setLockedUntil(Date.now() + err.retryAfterSec * 1000);
        }
        setError(err.message);
      } else {
        setError('Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600">
            <Laptop className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl">Computer Lab Records</CardTitle>
          <CardDescription>Sign in to manage lab sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && !isLocked && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            )}
            {isLocked && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                <p className="font-semibold">
                  Too many login attempts. Please wait {formatCountdown(remainingMs)} before trying again.
                </p>
                <p className="text-xs text-red-600 mt-1">
                  This lockout is enforced by the server and applies to your IP address.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                disabled={loading || isLocked}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                disabled={loading || isLocked}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || isLocked}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : isLocked ? (
                <>Locked · {formatCountdown(remainingMs)}</>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-slate-500">
            <span>Parent? </span>
            <a href="/lookup" className="text-blue-600 hover:underline font-medium">
                Look up your child&apos;s records
            </a>
        </div>
        </CardContent>
      </Card>
    </div>
  );
}