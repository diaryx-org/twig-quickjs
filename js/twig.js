// `twig`: what a language written for twig-quickjs is written with — the
// node table and the byte offsets it is measured in. Served from the
// binary under this name; `scripts/node-imports.mjs` resolves it the same
// way under Node.
//
// A table is the wire's: `nodes` in pre-order, the row index being the
// node id, each row naming its `parent` (`null` for the root and for a
// definition no tree holds), with its `span` — `[start, end)`, byte offsets
// into the input — and the columns and fields its kind carries, under the
// names `twig lang table <file>` prints. Twig checks every table it is
// given, so a mistake here is a parse error naming the row, not a crash.

/**
 * Byte offsets for a JavaScript string. A string is indexed by UTF-16 unit
 * and every offset twig wants is a byte offset into the UTF-8 input, so a
 * module measures with this: `at(i)` is the byte offset of UTF-16 index
 * `i`, for `0 <= i <= text.length`. An index that falls between the two
 * halves of a surrogate pair is the offset after the pair.
 */
export function offsets(text) {
  const n = text.length;
  const table = new Uint32Array(n + 1);
  let b = 0;
  for (let i = 0; i < n; i++) {
    table[i] = b;
    const c = text.charCodeAt(i);
    if (c < 0x80) b += 1;
    else if (c < 0x800) b += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < n) {
      const d = text.charCodeAt(i + 1);
      if (d >= 0xdc00 && d <= 0xdfff) {
        b += 4;
        table[i + 1] = b;
        i++;
        continue;
      }
      b += 3;
    } else b += 3;
  }
  table[n] = b;
  return {
    /** Bytes in the whole text. */
    length: b,
    at(i) {
      if (i <= 0) return 0;
      if (i >= n) return b;
      return table[i];
    },
  };
}

/**
 * A node table being built. `row(kind, parent, fields)` appends a row and
 * answers its id; rows must be appended in pre-order (a parent before its
 * children, siblings in document order), definitions after the tree.
 * `fields` is the rest of the row as the wire spells it — `span`,
 * `content_span`, `marker_span`, `spelling`, `attrs`, `attrs_span`, and
 * the kind's payload — with `null` and `undefined` columns left out.
 */
export function table() {
  const nodes = [];
  return {
    nodes,
    row(kind, parent, fields) {
      const r = { kind, parent };
      for (const k in fields) {
        const v = fields[k];
        if (v === undefined) continue;
        if (v === null && COLUMNS.has(k)) continue;
        r[k] = v;
      }
      nodes.push(r);
      return nodes.length - 1;
    },
    toJSON() {
      return { nodes };
    },
  };
}

/** The optional columns, which a row leaves out rather than writes `null`. */
const COLUMNS = new Set(["content_span", "marker_span", "spelling", "attrs", "attrs_span"]);

/** Refuse the input: the message is what twig reports as the parse error. */
export function fail(message) {
  throw new Error(message);
}
