import { useState, useRef, useEffect, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import AppSidebar from './AppSidebar';
import BackgroundOrbs from './BackgroundOrbs';
import { Bell, Search, Rocket, AlertTriangle, BarChart3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const PageLoader = () => (
  <div className="flex items-center justify-center py-24">
    <div className="w-8 h-8 rounded-full border-2 border-t-transparent warm-gradient animate-spin" />
  </div>
);

const AppLayout = () => {
  const { user } = useAuth();
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Scroll to top on every route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data } = await supabase
        .from('campaigns')
        .select('id, name, status, updated_at')
        .eq('user_id', user!.id)
        .order('updated_at', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!user,
  });

  // Build notifications from recent campaign activity
  const notifications = campaigns.map(c => {
    const icons: Record<string, typeof Rocket> = {
      Active: Rocket,
      Paused: AlertTriangle,
      Draft: BarChart3,
      Completed: BarChart3,
    };
    const Icon = icons[c.status] || BarChart3;
    const messages: Record<string, string> = {
      Active: `"${c.name}" is live`,
      Paused: `"${c.name}" was paused`,
      Draft: `"${c.name}" saved as draft`,
      Completed: `"${c.name}" completed`,
    };
    const timeAgo = getTimeAgo(c.updated_at);
    return { id: c.id, message: messages[c.status] || `"${c.name}" updated`, time: timeAgo, Icon };
  });

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="min-h-screen relative">
      <BackgroundOrbs />
      <AppSidebar />

      <div className="ml-[260px] min-h-screen relative z-10 transition-all duration-300">
        <header className="sticky top-0 z-30 glass px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--glass-border)' }}>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search campaigns, analytics..."
              className="glass-input pl-10 text-sm"
            />
          </div>
          <div className="flex items-center gap-4" ref={notifRef}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowNotifs(prev => !prev)}
              className="relative p-2 rounded-xl hover:bg-[var(--glass-bg-hover)] transition-all"
            >
              <Bell className="w-5 h-5 text-muted-foreground" />
              {notifications.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full warm-gradient text-[10px] font-bold flex items-center justify-center text-foreground">
                  {notifications.length}
                </span>
              )}
            </motion.button>

            <AnimatePresence>
              {showNotifs && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-6 top-16 w-80 glass rounded-2xl overflow-hidden z-50"
                  style={{ border: '1px solid var(--glass-border)' }}
                >
                  <div className="p-4 border-b" style={{ borderColor: 'var(--glass-border)' }}>
                    <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-sm text-muted-foreground">
                        No notifications yet
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className="px-4 py-3 hover:bg-[var(--glass-bg-hover)] transition-all flex items-start gap-3"
                        >
                          <div className="w-8 h-8 rounded-lg warm-gradient flex items-center justify-center flex-shrink-0 mt-0.5">
                            <n.Icon className="w-4 h-4 text-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate">{n.message}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{n.time}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        <main className="p-6">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
};

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default AppLayout;
