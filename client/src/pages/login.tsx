import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Lock, User, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import { getLandingPathForRole } from "@/lib/roles";
import { login } from "@/service/api";

export default function Login() {
  const [, setLocation] = useLocation();
  const { setUser } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await login({
        user_username: username,
        user_password: password,
      });

      // Store token and user data
      localStorage.setItem("token", response.token);
      localStorage.setItem("user", JSON.stringify(response.user));

      // Update auth context
      setUser(response.user);

      toast({
        title: "Login Successful",
        description: `Welcome back, ${response.user.user_name}!`,
      });

      // Redirect to this role's landing page
      setLocation(getLandingPathForRole(response.user.user_type));
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.response?.data?.message || "Invalid username or password");
      toast({
        title: "Login Failed",
        description: err.response?.data?.message || "Invalid username or password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
      {/* Aluminum-themed background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Metallic texture overlay */}
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `
              linear-gradient(45deg, #334155 25%, transparent 25%),
              linear-gradient(-45deg, #334155 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, #334155 75%),
              linear-gradient(-45deg, transparent 75%, #334155 75%)
            `,
            backgroundSize: '20px 20px',
            backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
          }}
        />
        
        {/* Animated metallic shine effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-500/10 to-transparent animate-shine" />
        
        {/* Industrial pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `repeating-linear-gradient(
              0deg,
              #64748b,
              #64748b 1px,
              transparent 1px,
              transparent 8px
            )`,
          }} />
          <div className="absolute inset-0" style={{
            backgroundImage: `repeating-linear-gradient(
              90deg,
              #64748b,
              #64748b 1px,
              transparent 1px,
              transparent 8px
            )`,
          }} />
        </div>
      </div>

      {/* Login Card */}
      <Card className="relative z-10 w-full max-w-md mx-4 bg-white/10 backdrop-blur-xl border-slate-400/20 shadow-2xl">
        <div className="p-8">
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 mb-4 shadow-lg">
              <Lock className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Al Sadat Footwear IMS</h1>
            <p className="text-slate-300 text-sm">Inventory Management System</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/20 border border-red-500/50">
                <AlertCircle className="h-4 w-4 text-red-300" />
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-200">
                Username
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 bg-white/5 border-slate-400/30 text-white placeholder:text-slate-400 focus:border-slate-300 focus:ring-slate-300"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-200">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-white/5 border-slate-400/30 text-white placeholder:text-slate-400 focus:border-slate-300 focus:ring-slate-300"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 text-white font-semibold py-6 shadow-lg hover:shadow-xl transition-all"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-slate-400">
              © 2025 Al Sadat Footwear IMS. All rights reserved.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
