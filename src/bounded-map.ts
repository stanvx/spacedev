/**
 * A Map with a fixed maximum size. When `set` would exceed `max`, the oldest
 * entry (first key inserted) is evicted. This guards long-running MCP servers
 * from unbounded growth of per-session Maps (transports, workspaces, OAuth
 * codes) when sessions accumulate without proper cleanup.
 */
export class BoundedMap<K, V> extends Map<K, V> {
  constructor(private readonly max: number) {
    super();
  }

  override set(key: K, value: V): this {
    if (this.max > 0 && !this.has(key) && this.size >= this.max) {
      const oldest = this.keys().next().value;
      if (oldest !== undefined) this.delete(oldest);
    }
    super.set(key, value);
    return this;
  }
}
