export class ObjectSet<E extends object, const K extends string> {
  public readonly identifier: K;
  private readonly identify: (entry: E) => string;
  private internalMap: Map<string, E>;

  constructor(identifier: K, initialEntries?: (E & Record<K, string>)[]);
  constructor(identifier: K, initialEntries: E[] | undefined, identify: (entry: E) => string);
  constructor(identifier: K, initialEntries?: E[], identify?: (entry: E) => string) {
    this.identifier = identifier;
    this.identify = identify ?? ((entry) => (entry as unknown as Record<K, string>)[identifier]);
    this.internalMap = new Map();

    if (initialEntries) this.add(...initialEntries);
  }

  public add(...entries: E[]): this {
    for (const entry of entries) {
      const id = this.identify(entry);

      if (!this.internalMap.has(id)) {
        this.internalMap.set(id, entry);
      }
    }

    return this;
  }

  public delete(entry: string | E): boolean {
    const id = typeof entry === 'string' ? entry : this.identify(entry);

    return this.internalMap.delete(id);
  }

  public get(id: string): E | undefined {
    return this.internalMap.get(id);
  }

  public has(entry: string | E): boolean {
    const id = typeof entry === 'string' ? entry : this.identify(entry);
    return this.internalMap.has(id);
  }

  public clear(): this {
    this.internalMap.clear();
    return this;
  }

  public clone(): ObjectSet<E, K> {
    const copy = new ObjectSet<E, K>(this.identifier, undefined, this.identify);
    copy.internalMap = new Map(this.internalMap);
    return copy;
  }

  public keys(): string[] {
    return Array.from(this.internalMap.keys());
  }

  public values(): E[] {
    return Array.from(this.internalMap.values());
  }

  public get size() {
    return this.internalMap.size;
  }
}
