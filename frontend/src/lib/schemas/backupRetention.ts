import { z } from 'zod';

export const backupRetentionMax = 2147483647;

const retentionRule = z.number().int().min(0).max(backupRetentionMax);

export const backupRetentionSchema = z.object({
  count: retentionRule,
  days: retentionRule,
  daily: retentionRule,
  weekly: retentionRule,
  monthly: retentionRule,
  yearly: retentionRule,
});

export type BackupRetention = z.infer<typeof backupRetentionSchema>;

export const backupRetentionRules = ['count', 'days', 'daily', 'weekly', 'monthly', 'yearly'] as const;

export const emptyBackupRetention: BackupRetention = {
  count: 0,
  days: 0,
  daily: 0,
  weekly: 0,
  monthly: 0,
  yearly: 0,
};

export const isBackupRetentionDisabled = (retention: BackupRetention) =>
  backupRetentionRules.every((rule) => retention[rule] === 0);

export const backupRetentionRule = z.enum(backupRetentionRules);

export const serverBackupRetentionStatusSchema = z.object({
  state: z.enum(['retained', 'locked', 'indefinite', 'expired', 'failed']),
  retention: backupRetentionSchema,
  rule: backupRetentionRule.nullable(),
  rules: z.array(backupRetentionRule),
  expires: z.coerce.date().nullable(),
});

export type ServerBackupRetentionStatus = z.infer<typeof serverBackupRetentionStatusSchema>;
