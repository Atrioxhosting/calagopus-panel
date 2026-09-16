import { makeComponentHookable } from 'shared';
import { useRedactedAddress } from '@/plugins/privacy/useRedactAddresses.ts';

function RedactedText({ value, suffix }: { value: string | null | undefined; suffix?: string }) {
  const redacted = useRedactedAddress(value);

  return (
    <>
      {redacted}
      {suffix}
    </>
  );
}

export default makeComponentHookable(RedactedText);
