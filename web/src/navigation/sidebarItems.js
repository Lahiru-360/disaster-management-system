import {
  ClipboardList,
  FileText,
  House,
  LayoutDashboard,
  LifeBuoy,
  MapIcon,
  Package,
  Settings,
  TriangleAlert,
} from 'lucide-react';

// The console sidebar's links, in order. Each `to` must match a route in
// ConsoleRoutes.jsx. `icon` is a lucide-react component
// (https://lucide.dev/icons).
export const SIDEBAR_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/hazard-warnings', label: 'Hazard Warnings', icon: TriangleAlert },
  { to: '/ground-reports', label: 'Ground Reports', icon: ClipboardList },
  { to: '/shelter-resources', label: 'Shelter & Resources', icon: House },
  { to: '/rescue-teams', label: 'Rescue Teams', icon: LifeBuoy },
  { to: '/relief-supplies', label: 'Relief Supplies', icon: Package },
  { to: '/map', label: 'Map', icon: MapIcon },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
];
