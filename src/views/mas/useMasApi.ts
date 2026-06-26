import { useEffect, useState } from 'react';
import { MasApiClient } from '@mas/ui';

// window.ipcRenderer is typed in ./global.d.ts. The main process answers
// 'mas:api-info' with the loopback base URL + bearer token for the embedded API.
interface ApiInfo {
  baseUrl: string;
  token: string;
}

/**
 * Resolves the embedded API client once the main process reports its address.
 * Returns null until ready so pages can show a loading state.
 */
export function useMasApi(): MasApiClient | null {
  const [client, setClient] = useState<MasApiClient | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.ipcRenderer
      .invoke('mas:api-info')
      .then((info) => {
        if (cancelled) return;
        const { baseUrl, token } = info as ApiInfo;
        setClient(new MasApiClient({ baseUrl, token }));
      })
      .catch(() => {
        if (!cancelled) setClient(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return client;
}
