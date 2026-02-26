import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Megaphone,
  Upload,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Flame,
  LogOut,
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { label: 'Campaigns', path: '/campaigns', icon: Megaphone },
  { label: 'Upload Video', path: '/upload', icon: Upload },
  { label: 'Analytics', path: '/analytics', icon: BarChart3 },
  { label: 'Settings', path: '/settings', icon: Settings },
];

const AppSidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const displayName = profile?.full_name || profile?.email?.split('@')[0] || 'User';
  const displayEmail = profile?.email || '';
  const initials = displayName.charAt(0).toUpperCase();

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <motion.aside
      initial={{ x: -260 }}
      animate={{ x: 0, width: collapsed ? 72 : 260 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed left-0 top-0 h-screen z-40 glass flex flex-col"
      style={{ borderRight: '1px solid var(--glass-border)' }}
    >
      {/* Logo */}
      <div className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl warm-gradient flex items-center justify-center flex-shrink-0">
          <Flame className="w-5 h-5 text-foreground" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="text-xl font-bold warm-gradient-text whitespace-nowrap"
            >
              AdFlow
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 mt-4 space-y-1">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path}>
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group',
                  active
                    ? 'warm-gradient text-foreground shadow-lg'
                    : 'text-muted-foreground hover:bg-[var(--glass-bg-hover)]'
                )}
                style={active ? { boxShadow: '0 4px 20px rgba(255,107,107,0.3)' } : {}}
              >
                <item.icon className={cn('w-5 h-5 flex-shrink-0', active ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground')} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-sm font-medium whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-3 space-y-2">
        <div className={cn('flex items-center gap-3 px-3 py-2', !collapsed && 'justify-between')}>
          {!collapsed && (
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full warm-gradient flex items-center justify-center text-sm font-bold text-foreground flex-shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
              </div>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-[var(--glass-bg-hover)] transition-all"
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span className="text-sm">Sign out</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-[var(--glass-bg-hover)] transition-all"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>
    </motion.aside>
  );
};

export default AppSidebar;
