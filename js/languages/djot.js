// djot, read by djot.js: the twin of the djot twig compiles in.
//
// djot.js (`@djot/djot`, John MacFarlane's reference implementation,
// vendored in js/djot/) parses the document; this module maps its AST onto
// twig's node table — the table the compiled djot produces for the same
// input, row for row, which is what `twig lang check js-djot --against
// djot` holds it to. Every structural decision is djot.js's: which blocks
// and inlines there are, how they nest, their attributes, a heading's
// identifier, a list's tightness. What the module adds is what twig's table
// carries and djot.js's AST does not — and what twig decides differently
// where the two have no reason to agree:
//
// - **Bytes.** djot.js measures in UTF-16 units with inclusive ends; twig
//   in UTF-8 bytes, `[start, end)`.
// - **Where a block ends.** djot.js closes a block quote, a list, a list
//   item, a footnote, a reference definition, a table, a caption and an
//   unterminated fence where the line that stopped it is; twig closes it at
//   the end of the last line that carried content, so a blank line between
//   two blocks belongs to neither (`contentEnd`). A section ends at its last
//   child; the document is the whole input.
// - **The columns djot.js has no field for.** `content_span` (the interior
//   an editor splices: children's extent, a fence's body, the text between
//   a verbatim's backticks, or the whole node for a marker-prefixed
//   container), `marker_span` (a heading's `#`s, a quote's `>`, a list
//   item's marker and checkbox, each with the spaces after), `spelling` (a
//   bullet's character, an ordered list's delimiter, and that djot's divs
//   and spans are directive containers) and `attrs_span` (where the one
//   `{…}` that supplied a node's attributes was written).
// - **Definitions.** Reference and footnote definitions, and the reference
//   a heading defines implicitly, are rows with no parent after the tree,
//   in the order the parser finished them.
//
// The AST lacks some positions twig records — where a `{…}` block was
// written, a fence's body, the inside of a verbatim's backticks — so the
// module also reads djot.js's event stream (`parseEvents`), the same events
// `parse` builds its AST from, for those and nothing else.
//
// Read tier: no `print`. docs/twin-differences.md lists where djot.js and
// twig's djot disagree.

import { parse as parseDjot, parseEvents } from "@djot/djot";
import { offsets, table } from "twig";

/** twig's djot harness samples (`src/languages/djot/djot.zig`), verbatim. */
const SAMPLES = [
  "# Heading without a final newline",
  "A paragraph without a final newline",
  "",
  "A paragraph with _emphasis_ and *strong* text.\n",
  "# Heading\n\n> Quote\n\n- first\n- second\n",
  "{#intro .note}\nA paragraph.\n",
  "``` zig\nconst x = 1;\n```\n",
  "A paragraph that runs\nover two lines.\n",
];

export default {
  name: "djot",
  extensions: ["dj", "djot"],
  caps: { read: true, write: false, author: false },
  samples: SAMPLES,
  parse(_call, input) {
    return djotTable(input);
  },
};

const MARKS = new Set([
  "emph", "strong", "mark", "superscript", "subscript", "delete", "insert",
  "double_quoted", "single_quoted",
]);

const BULLETS = { "-": "dash", "+": "plus", "*": "star" };

/** The node table twig's djot gives for `input`, from djot.js's parse. */
export function djotTable(input) {
  const ast = parseDjot(input, { sourcePositions: true });
  const events = Array.from(parseEvents(input));
  const B = offsets(input);
  const n = input.length;
  const t = table();

  // ── lines ─────────────────────────────────────────────────────────────
  // `starts[k]` is line k's first index; line k runs to `ends[k]`, one past
  // its newline (or the end of the input).
  const starts = [0];
  for (let i = 0; i < n; i++) if (input.charCodeAt(i) === 10 && i + 1 < n) starts.push(i + 1);
  const ends = starts.map((s, k) => (k + 1 < starts.length ? starts[k + 1] : n));
  const lineOf = (i) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= i) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  // A line carries content when it is not blank — or when it is a code
  // block's, where a blank line is body text.
  const content = starts.map((s, k) => /[^ \t\r\n]/.test(input.slice(s, ends[k])));
  const markCodeLines = (node) => {
    if (node.tag === "code_block" || node.tag === "raw_block") {
      const from = lineOf(node.pos.start.offset);
      const to = fenceClosed(node) ? lineOf(node.pos.end.offset) : linesBefore(node.pos.end.offset, "-code_block") - 1;
      for (let k = from; k <= to; k++) content[k] = true;
    }
    if (node.children) node.children.forEach(markCodeLines);
  };
  // The lines wholly before the line holding djot.js's close position `p`
  // — every line, for a close at the end. djot.js puts that on the input's
  // last byte (with its newline), where a close on the last line can also
  // fall; a close at the end is one of the run of closes the stream ends
  // with, so `closer`, the annotation of the close, tells the two apart.
  const maxoffset = input.charCodeAt(n - 1) === 10 ? n - 1 : n;
  const finalClosers = new Set();
  for (let i = events.length - 1; i >= 0 && events[i].annot[0] === "-"; i--) {
    finalClosers.add(events[i].annot.split("|")[0]);
  }
  const atEnd = (p, closer) => p > maxoffset || (p === maxoffset && finalClosers.has(closer));
  const linesBefore = (p, closer) => (atEnd(p, closer) ? starts.length : lineOf(p));
  // Where twig ends a container djot.js closed at `p`: one past the last
  // line before p's that carried content, or where the container began if
  // none did.
  const contentEnd = (p, start, closer) => {
    for (let k = linesBefore(p, closer) - 1; k >= 0 && ends[k] > start; k--) {
      if (content[k]) return ends[k];
    }
    return start;
  };

  // ── events: positions the AST does not keep ─────────────────────────────
  // For each block that consumed pending block attributes, where they were
  // written: one `{…}` block's span, or `null` for none or several.
  const blockOrigin = new Map();
  // For each inline attribute block, by its `{`: its end and whether it
  // carried any attribute.
  const inlineAttrs = new Map();
  // Opening events by position, for a fence's body and a delimited leaf's
  // interior.
  const opened = new Map();
  {
    let pending = []; // the `{…}` spans of the block attributes waiting
    let stack = []; // open attribute blocks: { start, filled }
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      const a = e.annot.split("|")[0];
      if (a === "blankline") pending = [];
      if (a === "+block_attributes" || a === "+attributes") {
        stack.push({ start: e.startpos, filled: false, last: e.startpos });
        continue;
      }
      if (a === "id" || a === "class" || a === "key") {
        if (stack.length) stack[stack.length - 1].filled = true;
      }
      if (stack.length && a !== "-block_attributes" && a !== "-attributes") {
        stack[stack.length - 1].last = e.endpos;
      }
      if (a === "-block_attributes") {
        const b = stack.pop();
        // djot.js closes a block attribute where the next line starts;
        // the block itself ends at its `}`.
        const close = input.indexOf("}", b.last + 1);
        if (b.filled) pending.push(close < 0 ? null : [b.start, close + 1]);
        continue;
      }
      if (a === "-attributes") {
        const b = stack.pop();
        inlineAttrs.set(b.start, { end: e.endpos, filled: b.filled });
        continue;
      }
      if (a[0] === "+" || a === "thematic_break") {
        if (!opened.has(e.startpos + a)) opened.set(e.startpos + a, i);
        if (pending.length && a !== "+block_attributes") {
          if (!blockOrigin.has(e.startpos)) {
            blockOrigin.set(e.startpos, pending.length === 1 ? pending[0] : null);
          }
          pending = [];
        }
      }
    }
  }
  // The events from an opening event at `start` to its close.
  const between = (start, open, close) => {
    const i = opened.get(start + open);
    if (i === undefined) return null;
    let depth = 0;
    for (let j = i + 1; j < events.length; j++) {
      const a = events[j].annot.split("|")[0];
      if (a === open) depth++;
      else if (a === close) {
        if (depth === 0) return { open: events[i], close: events[j], inside: events.slice(i + 1, j) };
        depth--;
      }
    }
    return null;
  };

  // ── small helpers ───────────────────────────────────────────────────────
  const span = (s, e) => [B.at(s), B.at(e)];
  const startOf = (node) => node.pos.start.offset;
  const endOf = (node) => node.pos.end.offset; // inclusive
  const pastSpaces = (i) => {
    while (i < n && (input[i] === " " || input[i] === "\t")) i++;
    return i;
  };
  const marker = (s, e) => (e > s ? span(s, e) : null);
  // A fenced block that found its closing fence (djot.js closes an
  // unterminated one wherever it stopped).
  function fenceClosed(node) {
    const s = startOf(node);
    const ch = input[s];
    let len = 0;
    while (input[s + len] === ch) len++;
    const e = endOf(node);
    if (e >= n || input[e] !== ch) return false;
    let k = e;
    while (k >= 0 && input[k] === ch) k--;
    return e - k >= len && lineOf(k + 1) > lineOf(s);
  }
  const attrsOf = (node, keep) => {
    const out = [];
    const add = (obj) => {
      if (!obj) return;
      for (const key in obj) if (keep(key)) out.push({ key, value: obj[key] });
    };
    add(node.attributes);
    add(node.autoAttributes);
    return out.length ? out : null;
  };
  const all = () => true;
  // The `{…}` an inline node's attributes came from: the blocks written
  // straight after it, the first one alone when it is the only one that
  // carried anything.
  const inlineOrigin = (end) => {
    let at = end + 1;
    let found = null;
    let count = 0;
    for (let b = inlineAttrs.get(at); b; b = inlineAttrs.get(at)) {
      if (b.filled) {
        count++;
        found = [at, b.end + 1];
      }
      at = b.end + 1;
    }
    return count === 1 ? span(found[0], found[1]) : null;
  };
  const blockAttrsSpan = (start) => {
    const o = blockOrigin.get(start);
    return o ? span(o[0], o[1]) : null;
  };
  const fromChildren = (ids) => {
    if (!ids.length) return null;
    return [t.nodes[ids[0]].span[0], t.nodes[ids[ids.length - 1]].span[1]];
  };

  // ── the walk ────────────────────────────────────────────────────────────
  const listMarkerEnd = (s, task) => {
    let j = s;
    if (j >= n) return s;
    if (input[j] === "-" || input[j] === "+" || input[j] === "*") j++;
    else {
      if (input[j] === "(") j++;
      const from = j;
      while (j < n && input[j] >= "0" && input[j] <= "9") j++;
      if (j === from) return s;
      if (j >= n || (input[j] !== "." && input[j] !== ")")) return s;
      j++;
    }
    j = pastSpaces(j);
    if (!task) return j;
    if (j + 2 >= n || input[j] !== "[" || input[j + 2] !== "]") return j;
    return pastSpaces(j + 3);
  };

  // Children, with a str that inline attributes split in two given back
  // the span it had before: twig keeps the whole word's span on both.
  function walkChildren(node, parent) {
    const ids = [];
    const kids = node.children || [];
    for (let i = 0; i < kids.length; i++) {
      const k = kids[i];
      const next = kids[i + 1];
      if (k.tag === "str" && next && next.tag === "str" && next.attributes &&
          k.pos && next.pos && endOf(k) + 1 === startOf(next)) {
        const whole = span(startOf(k), endOf(next) + 1);
        ids.push(t.row("str", parent, { span: whole, text: k.text }));
        ids.push(t.row("str", parent, {
          span: whole, text: next.text, attrs: attrsOf(next, all), attrs_span: inlineOrigin(endOf(next)),
        }));
        i++;
        continue;
      }
      ids.push(walk(k, parent));
    }
    return ids;
  }

  // The row for `node` and its subtree; answers the row's id.
  function walk(node, parent) {
    const tag = node.tag;
    const s = node.pos ? startOf(node) : 0;
    const e = node.pos ? endOf(node) : 0;
    const simple = () => span(s, e + 1);
    let id;
    const row = (kind, fields) => (id = t.row(kind, parent, fields));
    const withChildren = (kind, fields) => {
      row(kind, fields);
      const r = t.nodes[id];
      r.content_span = fromChildren(walkChildren(node, id));
      if (r.content_span === null) delete r.content_span;
      return id;
    };
    // A marker-prefixed container: its interior is itself.
    const prefixed = (kind, sp, fields) => {
      row(kind, { span: sp, content_span: sp, ...fields });
      walkChildren(node, id);
      return id;
    };

    switch (tag) {
      case "section": {
        const explicit = node.attributes && Object.keys(node.attributes).length > 0;
        row("section", {
          span: [B.at(s), B.at(s)],
          attrs: attrsOf(node, all),
          attrs_span: explicit ? blockAttrsSpan(s) : null,
        });
        const r = t.nodes[id];
        const cs = fromChildren(walkChildren(node, id));
        // A section a later heading closed ends at its last child; one still
        // open at the end of the input runs to the end.
        if (cs) r.content_span = cs;
        r.span = [r.span[0], openAtEnd.has(node) ? B.length : cs ? cs[1] : r.span[0]];
        // Attributes after the content columns, as twig writes them.
        const { attrs, attrs_span } = r;
        delete r.attrs;
        delete r.attrs_span;
        if (attrs) r.attrs = attrs;
        if (attrs_span) r.attrs_span = attrs_span;
        return id;
      }
      case "heading": {
        const explicit = node.attributes && Object.keys(node.attributes).length > 0;
        return withChildren("heading", {
          span: simple(),
          marker_span: marker(s, (() => {
            let j = s;
            while (j < n && input[j] === "#") j++;
            return j === s ? s : pastSpaces(j);
          })()),
          level: node.level,
          attrs: attrsOf(node, all),
          attrs_span: explicit ? blockAttrsSpan(s) : null,
        });
      }
      case "para":
        return withChildren("para", { span: simple(), attrs: attrsOf(node, all), attrs_span: blockAttrsSpan(s) });
      case "block_quote": {
        const sp = span(s, contentEnd(e, s, "-block_quote"));
        let j = s;
        const m = input[j] === ">" ? pastSpaces(j + 1) : s;
        return prefixed("block_quote", sp, {
          marker_span: marker(s, m), attrs: attrsOf(node, all), attrs_span: blockAttrsSpan(s),
        });
      }
      case "thematic_break":
        return row("thematic_break", { span: simple(), attrs: attrsOf(node, all), attrs_span: blockAttrsSpan(s) });
      case "bullet_list":
      case "ordered_list":
      case "task_list":
      case "definition_list": {
        const fields = { span: span(s, contentEnd(e, s, "-list")) };
        if (tag === "bullet_list") {
          fields.spelling = { bullet: BULLETS[node.style] };
          fields.tight = node.tight;
        } else if (tag === "ordered_list") {
          const st = node.style;
          fields.spelling = { ordered_delim: st[0] === "(" ? "paren_both" : st.endsWith(")") ? "paren_after" : "period" };
          const c = st.replace(/[().]/g, "");
          fields.numbering = { "1": "decimal", a: "lower_alpha", A: "upper_alpha", i: "lower_roman", I: "upper_roman" }[c];
          fields.tight = node.tight;
          fields.start = node.start ?? null;
        } else if (tag === "task_list") {
          fields.tight = node.tight;
        }
        fields.attrs = attrsOf(node, all);
        fields.attrs_span = blockAttrsSpan(s);
        return withChildren(tag, fields);
      }
      case "list_item":
      case "task_list_item": {
        const sp = span(s, contentEnd(e + 1, s));
        const task = tag === "task_list_item";
        const fields = { marker_span: marker(s, listMarkerEnd(s, task)) };
        if (task) fields.checked = node.checkbox === "checked";
        fields.attrs = attrsOf(node, all);
        return prefixed(tag, sp, fields);
      }
      case "definition_list_item": {
        const sp = span(s, contentEnd(e + 1, s));
        row("definition_list_item", { span: sp, content_span: sp, attrs: attrsOf(node, all) });
        const item = id;
        const [term, definition] = node.children;
        const termId = t.row("term", item, { span: sp });
        const tc = fromChildren(walkChildren(term, termId));
        if (tc) t.nodes[termId].content_span = tc;
        const defId = t.row("definition", item, { span: sp, content_span: sp });
        walkChildren(definition, defId);
        return item;
      }
      case "code_block":
      case "raw_block": {
        const closed = fenceClosed(node);
        const sp = closed ? simple() : span(s, contentEnd(e, s, "-code_block"));
        const body = between(s, "+code_block", "-code_block");
        const strs = body ? body.inside.filter((x) => x.annot === "str") : [];
        const cs = strs.length ? span(strs[0].startpos, strs[strs.length - 1].endpos + 1) : null;
        const fields = tag === "code_block"
          ? { lang: node.lang ?? null, text: node.text }
          : { format: node.format, text: node.text };
        return row(tag, { span: sp, content_span: cs, ...fields, attrs: attrsOf(node, all), attrs_span: blockAttrsSpan(s) });
      }
      case "div": {
        const closed = fenceClosed(node);
        const sp = closed ? simple() : span(s, contentEnd(e, s, "-div"));
        row("container", {
          span: sp,
          spelling: { container_origin: "directive" },
          name: "",
          form: "block_fenced",
          argument: null,
          attrs: attrsOf(node, all),
          attrs_span: blockAttrsSpan(s),
        });
        const r = t.nodes[id];
        const cs = fromChildren(walkChildren(node, id));
        if (cs) r.content_span = cs;
        return id;
      }
      case "table": {
        const sp = span(s, contentEnd(e, s, "-table"));
        row("table", { span: sp, attrs: attrsOf(node, all), attrs_span: blockAttrsSpan(s) });
        const tbl = id;
        const [caption, ...rows] = node.children;
        const ids = [];
        if (caption.pos) {
          const cs0 = startOf(caption);
          const capId = t.row("caption", tbl, {
            span: span(cs0, contentEnd(endOf(caption) + 1, cs0)),
            attrs: attrsOf(caption, all),
          });
          const cc = fromChildren(walkChildren(caption, capId));
          if (cc) t.nodes[capId].content_span = cc;
          ids.push(capId);
        } else {
          ids.push(t.row("caption", tbl, { span: sp }));
        }
        for (const r of rows) ids.push(walk(r, tbl));
        // The caption comes first among the children and last in the
        // source, so the compiled djot's "first child to last" runs
        // backwards when one is written (docs/twin-differences.md); the
        // children's whole extent is what the twin records instead.
        const cs = fromChildren(ids);
        t.nodes[tbl].content_span = cs[0] <= cs[1] ? cs : [
          Math.min(...ids.map((i) => t.nodes[i].span[0])),
          Math.max(...ids.map((i) => t.nodes[i].span[1])),
        ];
        return tbl;
      }
      case "row":
        return withChildren("row", { span: simple(), head: node.head, attrs: attrsOf(node, all) });
      case "cell":
        return withChildren("cell", {
          span: simple(), head: node.head, alignment: node.align, colspan: 1, rowspan: 1, attrs: attrsOf(node, all),
        });
      case "caption":
        return withChildren("caption", { span: simple() });

      // ── inlines ──
      case "str":
        return row("str", { span: simple(), text: node.text, attrs: attrsOf(node, all), attrs_span: node.attributes ? inlineOrigin(e) : null });
      case "soft_break":
      case "hard_break":
      case "non_breaking_space":
        return row(tag, { span: simple(), attrs: attrsOf(node, all), attrs_span: node.attributes ? inlineOrigin(e) : null });
      case "smart_punctuation":
        return row("smart_punctuation", {
          span: simple(), punctuation_kind: node.type, text: node.text,
          attrs: attrsOf(node, all), attrs_span: node.attributes ? inlineOrigin(e) : null,
        });
      case "span":
        return withChildren("container", {
          span: simple(),
          spelling: { container_origin: "directive" },
          name: "",
          form: "inline_text",
          argument: null,
          attrs: attrsOf(node, all),
          attrs_span: node.attributes ? inlineOrigin(e) : null,
        });
      case "link":
      case "image":
        return withChildren(tag, {
          span: span(tag === "image" ? s - 1 : s, e + 1),
          destination: node.destination ?? null,
          reference: node.reference ?? null,
          attrs: attrsOf(node, all),
          attrs_span: node.attributes ? inlineOrigin(e) : null,
        });
      case "verbatim":
      case "raw_inline":
      case "inline_math":
      case "display_math":
      case "url":
      case "email": {
        const open = { verbatim: "+verbatim", raw_inline: "+verbatim", inline_math: "+inline_math",
          display_math: "+display_math", url: "+url", email: "+email" }[tag];
        const d = between(s, open, "-" + open.slice(1));
        const cs = d && d.open.endpos + 1 < d.close.startpos ? span(d.open.endpos + 1, d.close.startpos) : null;
        const fields = tag === "raw_inline" ? { format: node.format, text: node.text } : { text: node.text };
        return row(tag, {
          span: simple(), content_span: cs, ...fields,
          attrs: attrsOf(node, all), attrs_span: node.attributes ? inlineOrigin(e) : null,
        });
      }
      case "symb":
        return row("symb", {
          span: simple(), content_span: marker(s + 1, e), text: node.alias,
          attrs: attrsOf(node, all), attrs_span: node.attributes ? inlineOrigin(e) : null,
        });
      case "footnote_reference":
        return row("footnote_reference", {
          span: simple(), content_span: marker(s + 2, e), text: node.text,
          attrs: attrsOf(node, all), attrs_span: node.attributes ? inlineOrigin(e) : null,
        });
      default:
        if (MARKS.has(tag)) {
          return withChildren(tag, { span: simple(), attrs: attrsOf(node, all), attrs_span: node.attributes ? inlineOrigin(e) : null });
        }
        throw new Error(`djot.js produced a node twig has no row for: ${tag}`);
    }
  }

  // The sections still open when the input ends: the doc's last child if
  // it is one, that section's last child if it is one, and so on.
  const openAtEnd = new Set();
  for (let at = ast; at.children && at.children.length;) {
    const last = at.children[at.children.length - 1];
    if (last.tag !== "section") break;
    openAtEnd.add(last);
    at = last;
  }
  markCodeLines(ast);
  for (const k of Object.values(ast.footnotes)) markCodeLines(k);

  const root = t.row("doc", null, { span: [0, B.length], attrs: attrsOf(ast, all) });
  const cs = fromChildren(walkChildren(ast, root));
  if (cs) t.nodes[root].content_span = cs;

  // ── definitions ─────────────────────────────────────────────────────────
  // In the order the parser finished them: a reference or a footnote at
  // its close, a heading's implicit reference at the heading's.
  const defs = [];
  for (const r of Object.values(ast.references)) {
    defs.push({ at: endOf(r), node: r, kind: "reference" });
  }
  for (const f of Object.values(ast.footnotes)) defs.push({ at: endOf(f), node: f, kind: "footnote" });
  // A heading's reference: djot.js keeps it without a position, so it is
  // found again by the label it was made from, at the first heading with
  // that label — the one that made it.
  const wanted = new Map(Object.entries(ast.autoReferences));
  const headings = [];
  const findHeadings = (node) => {
    if (node.tag === "heading") headings.push(node);
    if (node.children) node.children.forEach(findHeadings);
  };
  findHeadings(ast);
  for (const f of Object.values(ast.footnotes)) findHeadings(f);
  headings.sort((a, b) => startOf(a) - startOf(b));
  for (const h of headings) {
    const lab = normalizeLabel(stringContent(h).trim());
    const r = wanted.get(lab);
    if (!r) continue;
    wanted.delete(lab);
    defs.push({ at: endOf(h), node: r, kind: "auto", heading: h, tie: -1 });
  }
  defs.sort((a, b) => a.at - b.at || (a.tie ?? 0) - (b.tie ?? 0));
  // Each definition under its label, in the registry it was made in —
  // djot.js's say on which of two with one label wins (the later).
  const labels = [];
  for (const d of defs) {
    const r = d.node;
    const registry = { auto: "auto_reference", reference: "reference", footnote: "footnote" }[d.kind];
    labels.push({ registry, label: r.label, node: t.nodes.length });
    if (d.kind === "auto") {
      const he = endOf(d.heading);
      t.row("reference", null, { span: span(he, he + 1), label: r.label, destination: r.destination });
    } else if (d.kind === "reference") {
      const s = startOf(r);
      t.row("reference", null, {
        span: span(s, contentEnd(endOf(r), s, "-reference_definition")), label: r.label, destination: r.destination,
        attrs: attrsOf(r, all), attrs_span: blockAttrsSpan(s),
      });
    } else {
      const s = startOf(r);
      const sp = span(s, contentEnd(endOf(r), s, "-footnote"));
      const fid = t.row("footnote", null, {
        span: sp, content_span: sp, label: r.label, attrs: attrsOf(r, all), attrs_span: blockAttrsSpan(s),
      });
      walkChildren(r, fid);
    }
  }
  return { nodes: t.nodes, labels };
}

function normalizeLabel(label) {
  return label.trim().replace(/[ \t\r\n]+/g, " ");
}

/** djot.js's own `getStringContent`: a heading's text, as its label is. */
function stringContent(node) {
  if ("text" in node) return node.text;
  if (node.tag === "soft_break" || node.tag === "hard_break") return "\n";
  if (node.children) return node.children.map(stringContent).join("");
  return "";
}
