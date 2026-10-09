// Bottom tab bar colors, kept in sync with the design tokens in
// app/tailwind.config.js (signal / muted / paper / line). Used by MainTabs,
// and by any role-specific tab navigator added later, so they can't drift apart.
export const TAB_BAR_SCREEN_OPTIONS = {
  tabBarActiveTintColor: '#0B1F3A', // signal (navy)
  tabBarInactiveTintColor: '#71727C', // muted
  tabBarStyle: {
    backgroundColor: '#FFFFFF', // paper
    borderTopColor: '#E7E7EC', // line
  },
};
