import { z } from 'zod';
import { adminEggRepositoryEggInstalledEggSchema } from '@/lib/schemas/admin/eggRepositories.ts';
import { adminEggSchema } from '@/lib/schemas/admin/eggs.ts';

export const isEggUpdateAvailable = (egg: z.infer<typeof adminEggSchema>): boolean =>
  !!egg.eggRepositoryEgg && !!egg.eggRepositoryEggHash && egg.eggRepositoryEgg.hash !== egg.eggRepositoryEggHash;

export const isInstalledEggUpdateAvailable = (
  repositoryEggHash: string,
  installed: z.infer<typeof adminEggRepositoryEggInstalledEggSchema>,
): boolean => !!installed.eggRepositoryEggHash && installed.eggRepositoryEggHash !== repositoryEggHash;
