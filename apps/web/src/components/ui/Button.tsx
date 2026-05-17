import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const variants = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  outline: 'border border-border bg-background hover:bg-accent hover:text-accent-foreground',
  danger: 'bg-red-500/10 text-red-500 hover:bg-red-500/20',
};
const sizes = { sm: 'h-7 px-2.5 text-xs', md: 'h-8 px-3 text-sm', lg: 'h-9 px-4 text-sm' };

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({ variant = 'primary', size = 'md', loading, icon, children, className, disabled, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant], sizes[size], className
      )}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
}
