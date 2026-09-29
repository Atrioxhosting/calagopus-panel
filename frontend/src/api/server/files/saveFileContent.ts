import { axiosInstance } from '@/api/axios.ts';

export default async (uuid: string, file: string, content: string | Blob): Promise<void> => {
  await axiosInstance.post(`/api/client/servers/${uuid}/files/write`, content, {
    params: { file },
    headers: {
      'Content-Type': typeof content === 'string' ? 'text/plain' : 'application/octet-stream',
    },
  });
};
