# Where the djot twin and twig's djot differ

`js/languages/djot.js` reads djot with djot.js (`@djot/djot` 0.3.2) and maps
its AST onto twig's node table. It is held to the djot twig compiles in, table
for table, by `twig lang check js-djot --against djot` and by
`tests/twins.rs`:

| documents | equal | differ |
|---|---|---|
| twig's djot harness samples (the module's own samples) | 8 | 0 |
| djot.js 0.3.2's test corpus, `tests/corpus/*.test` (260 cases) | 248 | 12 |
| `tests/documents/*.dj` | 4 | 0 |

Every difference below is one the twin could only remove by departing from
djot.js or by copying a mistake in twig — none is a mapping bug. Each is
excluded from the gate by name (`DIFFERENT` and `DIFFERENT_DOCUMENTS` in
`tests/twins.rs`), and the tests hold it to *differ*, so a fix on either side
fails the suite until the case is moved back in. The rows are as `twig lang
check` prints them: the first row at which the tables part.

## Twig splits a lone word in two for its attributes — 9 corpus cases

**Twig's bug.** Inline attributes after a `str` attach to its last word, which
djot.js splits off into a `str` of its own — *if there is text before it*
(`m.index > 0` in `parse.ts`). Twig's `closeInlineAttributes`
(`src/languages/djot/parser.zig`) splits whenever `lastWord` finds a word,
including one that starts the `str`, so a word with nothing before it becomes
an empty `str` and a second `str` holding the word — both with the whole
word's span. The HTML is the same (an empty `str` renders as nothing), which is
why twig's conformance run does not see it; the tree has a node no source
spells.

`hi{key="{#hi"}` (attributes.test:39):

```text
js-djot: {"kind":"str","parent":1,"span":[0,2],"text":"hi","attrs":[{"key":"key","value":"{#hi"}],"attrs_span":[2,14]}
djot:    {"kind":"str","parent":1,"span":[0,2],"text":""}
```

— and twig's next row is `{"kind":"str","parent":1,"span":[0,2],"text":"hi",…}`.
The same for attributes.test:25 (`a *b{#id key="*"}*`, row 4), :47
(`hi{key="\\\\\*"}`), :60 (`hi\{key="abc{#hi}"`, row 5), :66 (`hi{key="\"#hi"}`),
:72 (`hi{key="hi\"#hi"}`), :80 (`hi{#id .class` / `key="value"}`), :217
(`foo{#ident % this is a comment % .class}`) and :223
(`foo{#ident % this is a comment}`). A second `{…}` after a split word splits
it again (`x word{.a}{.b}` gives `"x "`, `""` and `"word"`). The fix is
djot.js's condition: split only when the word starts after the `str` does.

## A table's content span runs backwards when it has a caption — 2 corpus cases

**Twig's bug.** A djot caption is written after the table's rows, and twig
makes it the table's first child, as djot.js does; `closeTable` then takes the
table's `content_span` from its first child's start to its last child's end —
from the caption, after the rows, back to the last row. The span runs
backwards, which twig's own table decoder refuses (`checkColumns`: "start is
after end"), so the compiled djot's table for these documents cannot cross the
contract it defines; and the caption lies outside the table's `span`, which
stops at the last row. The twin writes the children's whole extent instead.

```text
| a | b |

^ With a _caption_
and another line.
```

(tables.test:35)

```text
js-djot: {"kind":"table","parent":0,"span":[0,10],"content_span":[0,48]}
djot:    {"kind":"table","parent":0,"span":[0,10],"content_span":[13,10]}
```

And regression.test:46 (`| 1 | 2 |` with two captions, the later winning):
`"content_span":[0,28]` against `"content_span":[23,10]`.

## The strong wins over the link in djot.js 0.3.2 — 1 corpus case

**A version difference.** `*[closed](hello*)` (links_and_images.test:179)
is `<strong>[closed](hello</strong>)` in djot.js 0.3.2, whose corpus says so,
and a link in later djot.js, whose corpus twig vendors ("the star inside the
destination is protected from closing emphasis"). Twig follows the later one.

```text
js-djot: {"kind":"strong","parent":1,"span":[0,16],"content_span":[1,15]}
djot:    {"kind":"str","parent":1,"span":[0,1],"text":"*"}
```

## Outside the corpus

**djot.js drops the text before an image (djot.js 0.3.2's bug).** In
`x ![d](e)`, the inline parser puts the image's marker over the match before
it, which is the `str` holding `x ` — so djot.js renders `<p><img …></p>`, and
the twin has no row for the text. It happens to any text on the same line
before `![`; after a line break it does not.

```text
js-djot: {"kind":"para","parent":0,"span":[0,10],"content_span":[2,9]}
djot:    {"kind":"para","parent":0,"span":[0,10],"content_span":[0,9]}
```

**Two definitions of one label (a disagreement).** djot.js keeps the last
(`references[lab] = r`), twig the first (`if (!references.contains)`), and
neither keeps both. For `[a]: one` / `[a]: two`:

```text
js-djot: {"kind":"reference","parent":null,"span":[9,18],"label":"a","destination":"two"}
djot:    {"kind":"reference","parent":null,"span":[0,9],"label":"a","destination":"one"}
```

The same holds for two footnotes with one label.

## Against twig's newer corpus

Twig vendors djot.js's corpus from after 0.3.2 (`src/languages/djot/testdata`,
271 cases). Over it the twin differs in 18 cases: the 12 above, and six more
that are djot changes after 0.3.2 which twig follows and djot.js 0.3.2 does
not — not a gate, since the twin reads 0.3.2, but the list of what moving to a
later djot.js would close:

- a block attribute separated from its block by a blank line no longer
  applies (`{#id .class}` / blank / `A paragraph`; attributes.test:114);
- a footnote reference is left out of a heading's identifier
  (`# Introduction[^1]` is `Introduction`, not `Introduction1`;
  headings.test:148);
- emphasis does not close inside a link destination
  (`_[link](http://example.com?foo_bar=1), more text_`, `_hello [link](a_b) world_`;
  links_and_images.test:210, :216);
- an escaped `$` is not math (`` \$`e=mc^2` ``; math.test:48);
- bullets of different characters start different task lists
  (`- [ ] foo` / `+ [ ] bar` / `* [ ] baz`; task_lists.test:38).
