import { createNavigationContainerRef } from '@react-navigation/native';

// Lets code outside the component tree (RootNavigator's post-auth redirect)
// dispatch a navigation action once the container is mounted, without
// threading a ref prop down through App.js.
export const navigationRef = createNavigationContainerRef();
