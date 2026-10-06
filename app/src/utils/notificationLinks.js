import { TABS } from '../constants/roles';

// An inbox item's `link` is a client route (docs/api-contract.md §11.1), e.g.
// "/my-reports/<id>". The app navigates by tab, so each route's first segment
// names the tab that shows it.
const TAB_BY_SEGMENT = Object.freeze({
  'my-reports': TABS.MY_REPORTS,
  assignments: TABS.ASSIGNMENTS,
});

// The tab a link opens, or null when it has none the app knows.
export function tabForLink(link) {
  if (typeof link !== 'string') return null;
  const [segment] = link.replace(/^\/+/, '').split('/');
  return TAB_BY_SEGMENT[segment] ?? null;
}
