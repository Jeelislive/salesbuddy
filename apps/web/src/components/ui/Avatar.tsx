import { cn } from '@/lib/utils';

const sizes = { xs: 'w-6 h-6 text-xxs', sm: 'w-7 h-7 text-xs', md: 'w-8 h-8 text-sm', lg: 'w-10 h-10 text-base' };

interface AvatarProps {
  src?: string;
  fallback: string;
  size?: keyof typeof sizes;
  className?: string;
}

export function Avatar({ src, fallback, size = 'md', className }: AvatarProps) {
  return (
    <div className={cn('rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden bg-primary/15 text-primary font-semibold', sizes[size], className)}>
      {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : fallback.toUpperCase()}
    </div>
  );
}
