import { useState, useEffect, type ReactNode } from "react";
import { Layers, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const BASE = import.meta.env.BASE_URL || "/";
const STORAGE_KEY = "cybersuite-auth";
const PASSWORD_KEY = "cybersuite-pw";

export function AuthGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved === "true") {
      setAuthed(true);
    }
    setChecking(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${BASE}api/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.valid) {
        sessionStorage.setItem(STORAGE_KEY, "true");
        sessionStorage.setItem(PASSWORD_KEY, password);
        setAuthed(true);
      } else {
        setError("Incorrect password");
        setPassword("");
      }
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (checking) return null;
  if (authed) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Layers className="w-8 h-8 text-pink-500" />
            <span className="font-bold text-3xl">
              <span className="text-white">Social Media Sister's</span>{" "}
              <span className="text-pink-400">CyberSuite</span>
            </span>
          </div>
          <p className="text-muted-foreground text-sm">Enter your password to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="pl-10 h-12 text-base"
              autoFocus
            />
          </div>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <Button type="submit" className="w-full h-12 text-base" disabled={loading || !password}>
            {loading ? "Checking..." : "Enter"}
          </Button>
        </form>
      </div>
    </div>
  );
}
