export function toBase64(data: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

export function fromBase64(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Reads a structured websocket argument. In `msgpack` transmission mode wings embeds it as a
 * value, in the older modes (and in panel broadcasts) it arrives as a JSON string.
 */
export function structuredArg<T = unknown>(arg: unknown): T {
  return (typeof arg === 'string' ? JSON.parse(arg) : arg) as T;
}

/**
 * Reads a binary websocket argument. In `msgpack` transmission mode it arrives as raw bytes, in
 * the older modes as a standard base64 string.
 */
export function binaryArg(arg: unknown): Uint8Array {
  if (arg instanceof Uint8Array) {
    return arg;
  }
  if (typeof arg === 'string') {
    return fromBase64(arg);
  }

  throw new TypeError('websocket argument is not binary');
}
