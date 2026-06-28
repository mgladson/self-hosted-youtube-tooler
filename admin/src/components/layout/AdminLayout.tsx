import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { CommandPalette } from '@/components/shared/CommandPalette';
import { SkeletonRect, SkeletonText } from '@/components/ui/Skeleton';
import { ScrollToTop } from '@/components/ui/ScrollToTop';

function PageSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in">
      <SkeletonRect className="h-8 w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <SkeletonRect className="h-24 rounded-xl" />
        <SkeletonRect className="h-24 rounded-xl" />
        <SkeletonRect className="h-24 rounded-xl" />
        <SkeletonRect className="h-24 rounded-xl" />
      </div>
      <SkeletonRect className="h-64 rounded-xl" />
      <SkeletonText lines={3} />
    </div>
  );
}

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        const el = document.activeElement;
        if (
          el instanceof HTMLElement &&
          (el.isContentEditable ||
            ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
        ) {
          return;
        }
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar onToggleSidebar={() => setSidebarOpen(true)} onOpenSearch={openSearch} />
        <main ref={mainRef} className="flex-1 overflow-y-auto bg-background p-6">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <ScrollToTop scrollRef={mainRef} />
      <CommandPalette open={searchOpen} onClose={closeSearch} />
    </div>
  );
}
