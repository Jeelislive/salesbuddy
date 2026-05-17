import { cn } from '@/lib/utils';

const variants = {
  default: 'bg-secondary text-secondary-foreground',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-emerald-500/10 text-emerald-500',
  warning: 'bg-amber-500/10 text-amber-600',
  danger: 'bg-red-500/10 text-red-500',
  muted: 'bg-muted text-muted-foreground',
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: keyof typeof variants;
  className?: string;
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xxs font-medium', variants[variant], className)}>
      {children}
    </span>
  );
}
