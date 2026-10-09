import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';

import { SIDEBAR_ITEMS } from './sidebarItems';
import Brand from '../components/ui/Brand';
import Button from '../components/ui/Button';
import NotificationBell from '../components/notifications/NotificationBell';
import { roleLabel } from '../constants/roles';
import useAuth from '../hooks/useAuth';
import useNotifications from '../hooks/useNotifications';

// The signed-in console's frame: a top bar (portal name, who's signed in, Log
// out), the sidebar of pages, and the current page (<Outlet />) beside it.
// The web counterpart of MainTabs' tab bar; the pages it frames are declared
// in ConsoleRoutes.jsx.
export default function ConsoleLayout() {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const inbox = useNotifications();
  const navigate = useNavigate();

  // Opening an item marks it read and follows its link, when it has one.
  const handleOpenNotification = (item) => {
    inbox.markRead(item.id);
    if (item.link) navigate(item.link);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // logout() ends the local session even when the API call fails, which
      // unmounts this layout - there's nothing left to recover here.
    }
  };

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between gap-6 border-b border-navy-hi bg-navy px-5">
        <Brand />

        <div className="flex items-center gap-4">
          <NotificationBell
            notifications={inbox.notifications}
            unreadCount={inbox.unreadCount}
            loading={inbox.loading}
            error={inbox.error}
            onOpenItem={handleOpenNotification}
            onRetry={inbox.refresh}
          />
          <div className="text-right leading-tight">
            <p className="text-sm font-semibold text-paper">{user?.name}</p>
            <p className="mt-0.5 text-xs text-muted-dark">{roleLabel(user?.role)}</p>
          </div>
          <Button
            variant="small-inverse"
            fullWidth={false}
            onClick={handleLogout}
            loading={loggingOut}
          >
            Log out
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav aria-label="Console" className="w-60 shrink-0 overflow-y-auto bg-navy px-3 py-4">
          <ul className="flex flex-col gap-1">
            {SIDEBAR_ITEMS.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-navy-hi text-paper'
                        : 'text-muted-dark hover:bg-navy-hi hover:text-paper',
                    ].join(' ')
                  }
                >
                  <Icon aria-hidden="true" size={18} strokeWidth={2} />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
