import { z } from 'zod';
import { maskAddress } from '@/lib/network/redact.ts';
import { getUserSetting, useUserSetting } from '@/lib/userSettings.ts';

export const REDACT_ADDRESSES_KEY = 'app::redact_addresses';

const redactAddressesSchema = z.boolean();

export function useRedactAddresses() {
  return useUserSetting(REDACT_ADDRESSES_KEY, redactAddressesSchema, false);
}

export function getRedactAddresses(): boolean {
  return getUserSetting(REDACT_ADDRESSES_KEY, redactAddressesSchema, false);
}

export function useRedactedAddress(value: string | null | undefined): string {
  const [redact] = useRedactAddresses();

  return redact ? maskAddress(value) : (value ?? '');
}
