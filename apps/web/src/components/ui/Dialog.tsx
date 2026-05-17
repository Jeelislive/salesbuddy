import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const SIZE = {
  sm:  'max-w-md',
  md:  'max-w-lg',
  lg:  'max-w-2xl',
  xl:  'max-w-4xl',
  '2xl': 'max-w-5xl',
};

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: keyof typeof SIZE;
  className?: string;
  noPadding?: boolean;
}

export function Dialog({ open, onClose, title, description, children, size = 'md', className, noPadding }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={cn(
        'relative bg-card border border-border rounded-xl shadow-2xl w-full flex flex-col max-h-[90vh]',
        SIZE[size],
        className
      )}>
        {(title || description) && (
          <div className="flex items-start justify-between px-6 py-4 border-b border-border flex-shrink-0">
            <div>
              {title && <h2 className="text-sm font-semibold">{title}</h2>}
              {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-accent text-muted-foreground ml-4 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className={cn('flex-1 overflow-y-auto', !noPadding && 'p-6')}>
          {children}
        </div>
      </div>
    </div>
  );
}
