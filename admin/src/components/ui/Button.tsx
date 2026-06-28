import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  href?: string;
  // `external` renders a native <a> (a real browser navigation) instead of a
  // react-router <Link>. Use it for hrefs that are NOT admin SPA routes —
  // backend endpoints, file downloads, off-site links — which a <Link> would
  // otherwise try (and fail) to client-side route to within the admin app.
  external?: boolean;
  target?: string;
  rel?: string;
  children: React.ReactNode;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'>;

const variants = {
  primary: 'bg-accent text-accent-foreground hover:bg-accent-hover',
  secondary: 'bg-surface text-primary border border-border hover:bg-hover-bg',
  outline: 'border border-border bg-transparent text-primary hover:bg-surface',
  ghost: 'bg-transparent text-primary hover:bg-hover-bg',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-red-600',
};

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-sm',
  icon: 'h-9 w-9 p-0 flex items-center justify-center',
};

export function Button({
  variant = 'primary',
  size = 'md',
  href,
  external,
  target,
  rel,
  children,
  className,
  ...props
}: ButtonProps) {
  const classes = cn(
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50 disabled:pointer-events-none',
    variants[variant],
    sizes[size],
    className,
  );

  if (href && external) {
    return (
      <a href={href} target={target} rel={rel} className={classes}>
        {children}
      </a>
    );
  }

  if (href) {
    return (
      <Link to={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
