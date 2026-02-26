import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import AppSidebar from './AppSidebar';
import BackgroundOrbs from './BackgroundOrbs';
import { Bell, Search } from 'lucide-react';

const AppLayout = () => {
  return (
    <div className="min-h-screen relative">
      <BackgroundOrbs />
      <AppSidebar />

      {/* Main content area */}
      <div className="ml-[260px] min-h-screen relative z-10 transition-all duration-300">
        {/* Top bar */}
        <header className="sticky top-0 z-30 glass px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--glass-border)' }}>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search campaigns, analytics..."
              className="glass-input pl-10 text-sm"
            />
          </div>
          <div className="flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative p-2 rounded-xl hover:bg-[var(--glass-bg-hover)] transition-all"
            >
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full warm-gradient text-[10px] font-bold flex items-center justify-center text-foreground">
                3
              </span>
            </motion.button>
          </div>
        </header>

        {/* Page content */}
        <motion.main
          className="p-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Outlet />
        </motion.main>
      </div>
    </div>
  );
};

export default AppLayout;
