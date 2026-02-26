import { useEffect, useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import GlassCard from './GlassCard';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  change?: number;
  icon: React.ReactNode;
  index?: number;
  sparkline?: number[];
}

const StatCard = ({ label, value, prefix = '', suffix = '', change, icon, index = 0, sparkline }: StatCardProps) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    const duration = 1500;
    const steps = 60;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setCount(value);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value, isInView]);

  const formatNumber = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toLocaleString();
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.1 }}
    >
      <GlassCard className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 rounded-xl warm-gradient flex items-center justify-center">
            {icon}
          </div>
          {change !== undefined && (
            <div className={cn(
              'flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-lg',
              change >= 0 ? 'text-success bg-emerald-500/10' : 'text-destructive bg-red-500/10'
            )}>
              {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(change)}%
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-bold font-data text-foreground">
          {prefix}{formatNumber(count)}{suffix}
        </p>
        {sparkline && (
          <div className="mt-3 flex items-end gap-0.5 h-8">
            {sparkline.map((v, i) => (
              <motion.div
                key={i}
                className="flex-1 rounded-sm warm-gradient opacity-60"
                initial={{ height: 0 }}
                animate={isInView ? { height: `${(v / Math.max(...sparkline)) * 100}%` } : {}}
                transition={{ duration: 0.5, delay: index * 0.1 + i * 0.05 }}
              />
            ))}
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
};

export default StatCard;
