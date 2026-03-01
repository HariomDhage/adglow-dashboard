import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import BackgroundOrbs from '@/components/BackgroundOrbs';
import GlassCard from '@/components/GlassCard';
import { Flame, Zap, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const Landing = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user, signIn, signUp, signInWithFacebook } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = isSignUp
      ? await signUp(email, password, fullName)
      : await signIn(email, password);
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
    } else if (isSignUp) {
      toast.success('Account created! Check your email to confirm.');
    }
  };

  const handleFacebookLogin = async () => {
    const { error } = await signInWithFacebook();
    if (error) toast.error(error.message);
  };


  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
      <BackgroundOrbs />

      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-20 blur-[120px]"
        style={{ background: 'var(--gradient-warm)' }}
      />

      <div className="relative z-10 w-full max-w-md px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="flex items-center justify-center gap-3 mb-8"
        >
          <motion.div
            className="w-14 h-14 rounded-2xl warm-gradient flex items-center justify-center"
            animate={{ boxShadow: ['0 0 20px rgba(255,107,107,0.3)', '0 0 40px rgba(255,107,107,0.5)', '0 0 20px rgba(255,107,107,0.3)'] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Flame className="w-7 h-7 text-foreground" />
          </motion.div>
          <h1 className="text-4xl font-extrabold warm-gradient-text">AdFlow</h1>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-center text-muted-foreground text-lg mb-8"
        >
          Launch Facebook Ads in{' '}
          <span className="warm-gradient-text font-semibold">60 Seconds</span>
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
        >
          <GlassCard hoverable={false} className="p-8">
            <h2 className="text-xl font-bold text-foreground text-center mb-6">
              {isSignUp ? 'Create account' : 'Welcome back'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div>
                  <label className="text-sm text-muted-foreground mb-1.5 block">Full Name</label>
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="glass-input"
                    required
                  />
                </div>
              )}
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Email</label>
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="glass-input"
                  required
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="glass-input"
                  required
                  minLength={6}
                />
              </div>

              <motion.button
                type="submit"
                disabled={submitting}
                whileHover={{ scale: submitting ? 1 : 1.02 }}
                whileTap={{ scale: submitting ? 1 : 0.97 }}
                className="btn-warm w-full flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {isSignUp ? 'Create Account' : 'Sign In'}
              </motion.button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t" style={{ borderColor: 'var(--glass-border)' }} />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 text-muted-foreground" style={{ background: 'hsl(var(--card))' }}>or continue with</span>
                </div>
              </div>

              <motion.button
                type="button"
                onClick={handleFacebookLogin}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="btn-glass flex items-center justify-center gap-2 text-sm py-2.5 w-full"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.675 0H1.325C.593 0 0 .593 0 1.325v21.351C0 23.407.593 24 1.325 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116c.73 0 1.323-.593 1.323-1.325V1.325C24 .593 23.407 0 22.675 0z"/>
                </svg>
                Continue with Facebook
              </motion.button>
            </form>

            <p className="text-center text-xs text-muted-foreground mt-6">
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <span
                onClick={() => setIsSignUp(!isSignUp)}
                className="warm-gradient-text font-medium cursor-pointer"
              >
                {isSignUp ? 'Sign in' : 'Sign up'}
              </span>
            </p>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
};

export default Landing;
