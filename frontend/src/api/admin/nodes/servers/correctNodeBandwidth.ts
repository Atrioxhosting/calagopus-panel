import { axiosInstance } from '@/api/axios.ts';

export default async function correctNodeBandwidth(nodeUuid: string, id: string, deltaBytes: number) {
  const { data } = await axiosInstance.post(`/api/admin/nodes/${nodeUuid}/servers/bandwidth-correction`, {
    id,
    delta_bytes: deltaBytes,
  });
  return data.results as { server_uuid: string; applied: boolean; error?: string }[];
}
