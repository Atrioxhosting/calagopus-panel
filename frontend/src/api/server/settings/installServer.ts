import { axiosInstance } from '@/api/axios.ts';

interface Data {
  truncateDirectory: boolean;
  startOnCompletion: boolean;
}

export default async (uuid: string, data: Data): Promise<void> => {
  await axiosInstance.post(`/api/client/servers/${uuid}/settings/install`, {
    truncate_directory: data.truncateDirectory,
    start_on_completion: data.startOnCompletion,
  });
};
