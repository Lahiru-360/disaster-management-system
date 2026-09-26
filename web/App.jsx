import { BrowserRouter } from 'react-router';

import RootNavigator from './src/navigation/RootNavigator';
import { AuthProvider } from './src/store/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <RootNavigator />
      </BrowserRouter>
    </AuthProvider>
  );
}
