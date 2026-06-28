import { useState } from 'react';
import { Menu, Search, Github } from '@/lib/icons';
import { NotificationDropdown } from './NotificationDropdown';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { commitToGit } from '@/lib/api';

type TopBarProps = {
  onToggleSidebar: () => void;
  onOpenSearch: () => void;
};

export function TopBar({ onToggleSidebar, onOpenSearch }: TopBarProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [committing, setCommitting] = useState(false);

  // Fire the "Sync Admin Data → Git" workflow so the current prod state
  // (employees, agencies, invoices) is committed to main. The dispatch is
  // fire-and-forget — GitHub accepts it, then the commit lands when the runner
  // finishes — so we confirm "started" rather than "committed".
  async function handleCommit() {
    if (committing) return;
    setCommitting(true);
    try {
      await commitToGit();
      toast('Sync to GitHub started — a commit will land on main shortly.');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Sync failed', 'error');
    } finally {
      setCommitting(false);
    }
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-surface px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg hover:bg-hover-bg transition-colors lg:hidden"
        >
          <Menu size={20} />
        </button>
        <button
          onClick={onOpenSearch}
          className="hidden sm:flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 hover:bg-hover-bg transition-colors cursor-pointer"
        >
          <Search size={16} className="text-muted" />
          <span className="text-sm text-muted-foreground w-48 text-left">Search... ⌘K</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleCommit}
          disabled={committing}
          aria-label="Sync admin data to GitHub (main)"
          title="Commit current data to GitHub (main)"
          className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-primary hover:bg-hover-bg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Github size={18} className={committing ? 'animate-pulse' : ''} />
          <span className="hidden sm:inline">{committing ? 'Syncing…' : 'Sync to GitHub'}</span>
        </button>
        <ThemeToggle />
        <NotificationDropdown />
        <span className="hidden md:block text-sm font-medium text-primary mr-1">{user?.name}</span>
        <img
          src={`${import.meta.env.BASE_URL}logo.png`}
          alt="Admin"
          className="h-8 w-8 rounded-full object-cover ml-1"
        />
      </div>
    </header>
  );
}
