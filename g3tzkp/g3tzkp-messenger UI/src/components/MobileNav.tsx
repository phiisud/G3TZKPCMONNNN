import React from 'react';
import { Map, Users, Activity, Briefcase, User, LucideIcon } from 'lucide-react';

export type PageType = 'geodesic' | 'mesh' | 'business' | 'system';

interface NavItem {
  id: PageType;
  icon: LucideIcon;
  label: string;
  badge?: number;
}

interface MobileNavProps {
  activePage: PageType;
  onPageChange: (page: PageType) => void;
  onNewAction: () => void;
  onProfileClick?: () => void;
  unreadCount?: number;
  pendingRequests?: number;
  hideOnNavigation?: boolean;
}

const MobileNav: React.FC<MobileNavProps> = ({ 
  activePage, 
  onPageChange, 
  onNewAction,
  onProfileClick,
  unreadCount = 0,
  pendingRequests = 0,
  hideOnNavigation = false
}) => {
  if (hideOnNavigation) return null;
  
  const leftNavItems: NavItem[] = [
    { id: 'geodesic', icon: Map, label: 'MAP' },
    { id: 'mesh', icon: Users, label: 'MESH', badge: unreadCount },
  ];
  
  const rightNavItems: NavItem[] = [
    { id: 'business', icon: Briefcase, label: 'BUSINESS' },
    { id: 'system', icon: Activity, label: 'SYSTEM' }
  ];

  const renderNavButton = (item: NavItem) => (
    <button
      key={item.id}
      onClick={() => onPageChange(item.id)}
      className={`flex flex-col items-center justify-center flex-1 py-1.5 transition-all relative ${
        activePage === item.id
          ? 'text-[var(--color-primary,#00f3ff)]'
          : 'text-[var(--color-secondary,#4caf50)]/60'
      }`}
    >
      <div className="relative">
        <item.icon size={18} strokeWidth={activePage === item.id ? 1.5 : 1} />
        {item.badge !== undefined && item.badge > 0 && (
          <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] flex items-center justify-center px-0.5 bg-[var(--color-primary,#00f3ff)] text-[var(--color-background,#000000)] text-[7px] font-black rounded-full">
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        )}
      </div>
      <span className="text-[8px] font-bold uppercase tracking-tight mt-0.5">{item.label}</span>
      {activePage === item.id && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] bg-[var(--color-primary,#00f3ff)] shadow-[0_0_8px_var(--color-primary,#00f3ff)]" />
      )}
    </button>
  );

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--color-border,#4caf50)]/30 bg-[var(--color-background,#000000)]/98 backdrop-blur-xl" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-end h-[58px]">
        <div className="flex flex-1 justify-around">
          {leftNavItems.map(renderNavButton)}
        </div>
        
        <div className="flex items-center justify-center px-2 -mt-4">
          <button
            onClick={onProfileClick || onNewAction}
            className="w-14 h-14 border-2 border-[var(--color-primary,#00f3ff)]/60 bg-[var(--color-background,#000000)] flex items-center justify-center text-[var(--color-primary,#00f3ff)] shadow-[0_0_25px_rgba(0,243,255,0.4)] active:scale-95 transition-all rounded-full"
          >
            <User size={24} strokeWidth={1.5} />
          </button>
        </div>
        
        <div className="flex flex-1 justify-around">
          {rightNavItems.map(renderNavButton)}
        </div>
      </div>
    </nav>
  );
};

export default MobileNav;
