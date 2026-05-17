import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

export function LoginPage() {
  const { signInWithGoogle } = useAuthStore();
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    setLoading(true);
    await signInWithGoogle();
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex w-1/2 bg-foreground flex-col justify-between p-12">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-background/10 flex items-center justify-center">
            <Zap className="w-4 h-4 text-background" />
          </div>
          <span className="text-[16px] font-bold text-background tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            SalesBuddy
          </span>
        </Link>

        <div>
          <blockquote
            className="text-[22px] text-background/80 leading-relaxed mb-8 max-w-sm"
            style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic' }}
          >
            "We shut down our outbound SDR team and replaced them with SalesBuddy. Pipeline tripled in 60 days."
          </blockquote>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center text-white text-sm font-bold">JL</div>
            <div>
              <p className="text-sm font-semibold text-background">Jason Lemkin</p>
              <p className="text-xs text-background/50">Founder & CEO, SaaStr</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-background/30" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          © 2026 SalesBuddy AI Inc.
        </p>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-xl bg-foreground flex items-center justify-center">
              <Zap className="w-4 h-4 text-background" />
            </div>
            <span className="text-[16px] font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>SalesBuddy</span>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            Sign in to your AI sales workspace
          </p>

          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 border border-border rounded-xl px-4 py-3 text-sm font-medium text-foreground bg-card hover:bg-secondary transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
            {loading ? 'Redirecting…' : 'Continue with Google'}
          </button>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Email / password login coming soon.{' '}
            <a href="mailto:hello@salesbuddy.ai" className="text-primary hover:underline">
              Request early access
            </a>
          </p>

          <p className="text-center text-xs text-muted-foreground mt-8 leading-relaxed">
            By continuing you agree to our{' '}
            <a href="#" className="hover:underline">Terms</a> and{' '}
            <a href="#" className="hover:underline">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
