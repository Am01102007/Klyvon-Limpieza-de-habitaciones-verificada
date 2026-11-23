import { RouterProvider } from 'react-router';

import { AuthProvider } from '@/app/AuthProvider';
import { PreferenciasProvider } from '@/app/PreferenciasProvider';
import { QueryProvider } from '@/app/QueryProvider';
import { router } from '@/app/router';

export function App() {
  return (
    <QueryProvider>
      <PreferenciasProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </PreferenciasProvider>
    </QueryProvider>
  );
}
