import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

import { ErrorApi } from '@/api/cliente';

function crearQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        retry: (fallos, error) => {
          if (error instanceof ErrorApi && error.estado >= 400 && error.estado < 500) {
            return false;
          }
          return fallos < 1;
        },
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(crearQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
