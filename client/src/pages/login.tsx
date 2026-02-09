import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Sparkles, Lock, UserPlus } from "lucide-react";

export default function Login() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const loginMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setLocation("/agent");
    },
    onError: (err: Error) => {
      toast({
        title: "Login failed",
        description: err.message.includes("401") ? "Invalid email or password" : err.message,
        variant: "destructive",
      });
    },
  });

  const signupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/signup", {
        email,
        password,
        name,
        inviteCode: inviteCode.trim() || undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Account created",
        description: `Welcome, ${data.name}! You've been assigned to ${data.organizationName || "Public / Freelance"}.`,
      });
      setLocation("/agent");
    },
    onError: (err: Error) => {
      toast({
        title: "Signup failed",
        description: err.message.includes("409") ? "An account with this email already exists" : err.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "login") {
      loginMutation.mutate();
    } else {
      signupMutation.mutate();
    }
  };

  const isPending = loginMutation.isPending || signupMutation.isPending;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-md bg-primary flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold tracking-tighter italic text-foreground" data-testid="text-login-title">
            Taste
          </h1>
          <p className="text-muted-foreground text-sm">Agent Console</p>
        </div>

        <Card className="p-6 backdrop-blur-xl bg-card/80 border-card-border space-y-5">
          <div className="flex gap-1 p-1 bg-muted rounded-md">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                mode === "login"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
              data-testid="button-tab-login"
            >
              <Lock className="w-3.5 h-3.5" />
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                mode === "signup"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
              data-testid="button-tab-signup"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  data-testid="input-signup-name"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="agent@taste.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-login-email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                data-testid="input-login-password"
              />
            </div>
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="inviteCode">Invite Code <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input
                  id="inviteCode"
                  type="text"
                  placeholder="e.g. TASTE-PRO-2025"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  data-testid="input-signup-invite-code"
                />
                <p className="text-xs text-muted-foreground">
                  Have a code from your agency? Enter it to join their team. Otherwise you'll join as an independent agent.
                </p>
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={isPending}
              data-testid="button-login-submit"
            >
              {isPending
                ? (mode === "login" ? "Signing in..." : "Creating account...")
                : (mode === "login" ? "Sign In" : "Create Account")}
            </Button>
          </form>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Consumer? <a href="/" className="text-primary hover:underline" data-testid="link-consumer-home">Browse properties</a>
        </p>
      </div>
    </div>
  );
}
