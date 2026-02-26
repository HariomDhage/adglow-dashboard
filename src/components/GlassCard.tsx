import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassCardProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
  gradient?: boolean;
}

const GlassCard = ({ children, className, hoverable = true, gradient = false, ...props }: GlassCardProps) => {
  return (
    <motion.div
      className={cn(
        gradient ? 'gradient-border' : 'glass-card',
        !hoverable && '!transform-none hover:!transform-none hover:!shadow-none',
        className
      )}
      whileHover={hoverable ? { y: -4, scale: 1.01 } : undefined}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default GlassCard;
