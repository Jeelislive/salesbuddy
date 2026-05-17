import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-lg border border-border bg-card text-card-foreground shadow-sm',
        onClick && 'cursor-pointer hover:border-primary/40 transition-colors',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-col space-y-1 p-4 pb-3', className)}>{children}</div>;
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn('text-sm font-semibold leading-none', className)}>{children}</h3>;
}

export function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('p-4 pt-0', className)}>{children}</div>;
}
