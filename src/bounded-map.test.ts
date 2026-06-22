import assert from "node:assert/strict";
import { BoundedMap } from "./bounded-map.js";

// BoundedMap evicts the oldest entry when capacity is reached.
const m = new BoundedMap<string, number>(2);
m.set("a", 1);
m.set("b", 2);
m.set("c", 3);
assert.equal(m.size, 2);
assert.equal(m.has("a"), false, "oldest key a must be evicted");
assert.equal(m.get("b"), 2);
assert.equal(m.get("c"), 3);

// Re-setting an existing key must not count toward eviction.
m.set("b", 20);
assert.equal(m.size, 2);
assert.equal(m.get("b"), 20);

// max:0 disables eviction.
const unbounded = new BoundedMap<string, number>(0);
for (let i = 0; i < 50; i++) unbounded.set(`k${i}`, i);
assert.equal(unbounded.size, 50);
