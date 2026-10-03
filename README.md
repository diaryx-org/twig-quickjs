# twig-quickjs

A [twig](https://github.com/diaryx-org/twig) document format written in
JavaScript.

twig parses, converts, queries and edits documents in the formats it compiles
in — djot, Markdown, HTML, XML, AsciiDoc. A format it does not compile in can
be a program — twig's *runtime language* contract, carried to a helper process
over stdin and stdout — and this is that program for JavaScript:
`twig-quickjs <module.mjs>` serves whatever format an ES module defines, on a
QuickJS built into the binary, and the `twig` command line then reads and
converts that format as it does any other.

```text
# ~/.config/twig/languages — name, extensions, command
org      org          twig-quickjs ~/.config/twig/languages/org.mjs
```

```bash
$ twig convert notes.org                 # to HTML
$ twig convert -o markdown notes.org
$ twig query notes.org 'heading[level=2]'
```

The same module is a [`twig::Language`](https://docs.rs/twig-doc) a Rust
program registers in-process, and then a `twig::Format` every entry point of
the `twig` crate takes — the carrier an editor wants, since a helper costs a
process round trip per parse.

## The djot twin

One language is built in: `djot`, which reads djot with
[djot.js](https://github.com/jgm/djot.js) — John MacFarlane's reference
implementation, `@djot/djot` 0.3.2, vendored — and maps its AST onto the node
table twig's own djot produces. It is the twin twig's runtime-language
contract was proven against: an independent parser, through the contract, giving
the compiled format's tables row for row. Named after the format it twins, it
is served beside twig's djot as `js-djot` with `--prefix js-`, and `twig lang
check` holds the two to each other:

```text
# a languages file
js-djot  dj-js  twig-quickjs --prefix js- djot
```

```bash
$ twig lang check js-djot --against djot djot-js-readme.dj unicode.dj
js-djot: registered (read write author); every sample parsed, printed and reparsed to the same tree; every gesture kept its promise; fidelity measured
sample 0: same table as `djot` (5 rows)
…
sample 7: same table as `djot` (5 rows)
djot-js-readme.dj: same table as `djot` (566 rows)
unicode.dj: same table as `djot` (68 rows)
```

Over twig's djot harness samples it gives the same table every time; over
djot.js's own test corpus, 248 of 260 cases. The other twelve are documents on
which djot.js 0.3.2 and twig's djot genuinely disagree — two bugs in twig, one
change in djot after 0.3.2 — and [`docs/twin-differences.md`](docs/twin-differences.md)
gives each, with both tables' first differing row; `tests/twins.rs` holds them
to differ, so a fix on either side shows.

Everything structural is djot.js's: which blocks and inlines there are, their
nesting, attributes, identifiers, tightness. What the twin adds is what the
table carries and the AST does not — byte offsets where djot.js counts UTF-16
units, where twig ends a block (at the last line that carried content, so a
blank line between blocks belongs to neither), the interior an editor splices
(`content_span`), the marker a rich view hides (`marker_span`), a list's
spelling, and where a node's `{…}` was written (`attrs_span`), the last few
read from djot.js's event stream.

It writes, too: a table — of a djot document, or of one converted from
Markdown or HTML (`twig convert -o js-djot`) — is rebuilt as the djot.js AST
it is and printed by djot.js's own `renderDjot`, and twig reparses every
sample's print to the same tree before it accepts the language. renderDjot
prints as djot.js 0.3.2 does — a run of spaces as one, a task list's bullet as
`-`, an escaped character so that it reads back as a `str` of its own — and has
no spelling for a hard break, which goes through as a backslash and a line
end. It fences every div with `:::`, so a div inside a div is refused rather
than printed so that it closes its parent.

And it authors: an editor over `js-djot` writes with the compiled djot's
syntax table — the spellings `twig lang syntax djot` prints, but for a ticked
task's box, which renderDjot writes `[X]` — and spells a fragment, a heading or
a quote or a link a gesture builds, by printing it as a document is printed.
The gestures write what they write over the compiled djot (`tests/twins.rs`
holds a toolbar's worth to the same bytes). The price is at registration:
twig's load check drives every gesture over every sample through the module,
some thousands of calls: about two seconds for a program that registers it
in-process, and about four for every `twig` command that loads it as a helper,
where each call is a round trip over the wire.

## Install

```bash
cargo install twig-quickjs
```

One binary, QuickJS and twig's core built in; nothing else to install — no
Node, no npm, no Zig. A module is any `.mjs` file, wherever you keep it — the
languages file names the path.

## Writing a format

A module's default export is an object: the description of the format, with
the functions it is beside it. The description has the field names of the
`describe` document on twig's wire, which `twig lang list` and `twig lang
check` report from.

```js
import { offsets, table } from "twig";

export default {
  name: "lines",
  extensions: ["lines"],
  caps: { read: true, write: true, author: false },
  features: [{ name: "crlf" }],
  sets: [{ name: "lines-crlf", extensions: ["crlines"], features: ["crlf"] }],
  samples: ["one\ntwo\n", { text: "x\r\n", features: ["crlf"] }],

  // Each non-empty line, a paragraph of one `str`.
  parse(call, input) {
    const at = offsets(input).at; // UTF-16 index -> byte offset
    const t = table();
    const doc = t.row("doc", null, { span: [0, at(input.length)] });
    let start = 0;
    for (const line of input.split("\n")) {
      const text = line.replace(/\r$/, "");
      if (text) {
        const span = [at(start), at(start + text.length)];
        t.row("str", t.row("para", doc, { span }), { span, text });
      }
      start += line.length + 1;
    }
    return t;
  },

  print(call, t) {
    const end = call.features.includes("crlf") ? "\r\n" : "\n";
    return t.nodes.filter((n) => n.kind === "str").map((n) => n.text + end).join("");
  },
};
```

**The table.** `parse(call, input)` returns the node table: one row per node
in pre-order, the row index being its id, the root `doc` first and any
definition no tree holds (a footnote, a link reference) after the tree with
`parent: null`. A row is its `kind` — the published name, `para`, `emph`,
`str`, … — its `parent`, its `span`, and the columns and fields its kind
carries, under the names `twig lang table <file>` prints for a compiled
format; that command is the fastest way to see what a table should be, and
`twig lang table -i djot` what the djot twin aims at. twig checks every table
it is given, so a mistake is a parse error naming the row, not a crash.

**Bytes, not UTF-16.** Every offset is a byte offset into the UTF-8 input, and
a JavaScript string is indexed by UTF-16 unit, so a module measures with
`offsets(input)`: `at(i)` is the byte offset of index `i`, computed once.

**Tiers.** Every language reads. One that declares `caps.write` has `print`,
which receives a table without positions — of the module's own documents, or
of a document converted from another format — and returns the source; twig
then reparses every sample's print and requires the same tree. One that
declares `caps.author` has a `syntax`, the table an editor's gestures write
with (`twig lang syntax <format>` prints a compiled format's), and answers
the renderers it names with `render(call, request)`; twig runs every gesture
over every sample, under every combination of features, before it accepts it.

**Features and sets.** A feature is a switch the parser reads; `call` says
which row a call is through and which features are on, the row's own and any
a caller laid over them (`twig convert --feature crlf`). A set is a name for a
list of features, registered as a format of its own.

**What a module may import.** `twig` — `offsets`, `table` and `fail`;
`twig/wire` — `describe`, `invoke`, `handle` and `serve`, the object turned
into the wire; `twig/languages/<name>`, a built-in language to build on; and
`@djot/djot`, djot.js, to build a djot dialect on. A relative import is a file
beside the module. Nothing else resolves: no `node:` modules, no package
lookup, no TypeScript. A module is plain ES2023, with `TextEncoder`,
`TextDecoder` and a `console` that writes to stderr provided.

`twig-quickjs check <module.mjs | name>` loads a module and registers it, which
runs twig's load check over its samples — the check the `twig` CLI makes
before it accepts a helper — and says why if it is refused. The crate's
`module` documentation is the reference for all of the above.

## In a Rust program

```rust
let org = twig_quickjs::register_file("languages/org.mjs")?;
// The built-in twin, beside the compiled djot it is named after:
let js_djot = twig::register(twig_quickjs::JsLanguage::builtin("djot")?.with_prefix("js-"))?;
let mut doc = twig::Document::parse(b"Hello *world*\n", js_djot)?;
```

## Under Node

`twig/wire`'s `serve` answers the wire under Node, so a module is a helper
there too — the way to develop one with Node's debugger, and the proof that the
object is the wire's description and nothing else:

```bash
node --import ./scripts/node-imports.mjs -e \
  'import("twig/wire").then(async (w) => w.serve((await import("./org.mjs")).default))'
```

`scripts/node-imports.mjs` resolves the names this binary serves to the files
in `js/`.

## What is vendored

`js/djot/` is `@djot/djot` 0.3.2 as npm publishes it — its `lib/*.js`,
CommonJS, wrapped by `sh scripts/vendor-djot.sh` into one ES module QuickJS can
import, with its MIT license beside it — and `tests/corpus/` is the same
release's test corpus from its repository, which the package does not ship.
`tests/documents/djot-js-readme.dj` is djot.js's `bench/readme.dj`, a
document of some length. All are John MacFarlane's, MIT; none is edited here. Refresh them with the
script, then `cargo test`: the twin's tests are what notice a release that
parses a document differently from twig's djot.

## License

MIT OR Apache-2.0. The vendored djot.js and its corpus are MIT, under their
own license files.
