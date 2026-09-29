import { Navigate } from 'react-router';
import { useServerStore } from '@/stores/server.ts';

export default function ServerNetworkRedirect() {
  const server = useServerStore((state) => state.server);
  return <Navigate to={`/server/${server.uuidShort}/network/traffic`} replace />;
}
