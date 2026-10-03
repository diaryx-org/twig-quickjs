//! A twig document format written in JavaScript.
//!
//! [`JsLanguage`] is a [`twig::Language`] whose parser (and, if it writes,
//! printer and renderers) are functions in an ES module, run on a QuickJS
//! built into this crate. What a module is — the object it exports, the
//! node table its `parse` returns, the modules it may import — is
//! documented in [`module`]; what the crate does with one is two things:
//!
//! - the `twig-quickjs` binary serves a module to a `twig` command line as a
//!   helper process — the out-of-process carrier of twig's runtime-language
//!   contract, the wire spoken by the library's own codec through
//!   [`twig::serve`];
//! - a Rust program registers one in-process with [`twig::register`], and
//!   it is then a [`twig::Format`] every entry point of the `twig` crate
//!   accepts — parse, render, convert, query.
//!
//! The two are the same [`JsLanguage`]. Registration runs twig's load check
//! — every sample parses to a table twig accepts, a language that writes
//! reparses its prints, a language that authors keeps every gesture's
//! promise — so a module twig has refused never becomes a format.
//!
//! ```no_run
//! use twig::{Document, Format, Target};
//! use twig_quickjs::JsLanguage;
//!
//! let lang = JsLanguage::builtin("djot")?.with_prefix("js-");
//! let js_djot = twig::register(lang)?;
//! let mut doc = Document::parse(b"Hello *world*\n", js_djot)?;
//! assert_eq!(doc.render_html()?, b"<p>Hello <strong>world</strong></p>\n");
//! # Ok::<(), Box<dyn std::error::Error>>(())
//! ```

use std::path::Path;

use twig::{Call, Description, Language};

mod engine;

pub use engine::{LoadError as Error, Source, builtin_languages};

pub mod module {
    //! What a twig-quickjs module is.
    //!
    //! A module is an ES module whose default export (or, failing that,
    //! first export with a `parse` function) is the language: an object
    //! with the same fields, names and values as the `describe` document a
    //! helper answers on twig's wire — the document [`twig::Description`]
    //! is the Rust side of — plus the functions the format is:
    //!
    //! ```js
    //! import { offsets, table } from "twig";
    //!
    //! export default {
    //!   name: "lines",
    //!   extensions: ["lines"],
    //!   caps: { read: true, write: false, author: false },
    //!   features: [{ name: "shout", default: false, requires: [] }],
    //!   sets: [{ name: "lines-loud", extensions: ["loud"], features: ["shout"] }],
    //!   samples: ["one\ntwo\n", { text: "x\n", features: ["shout"] }],
    //!   parse(call, input) {
    //!     const at = offsets(input).at; // UTF-16 index -> byte offset
    //!     const t = table();
    //!     const doc = t.row("doc", null, { span: [0, at(input.length)] });
    //!     // ... a `para` and a `str` for each line, measured with `at`
    //!     return t;
    //!   },
    //! };
    //! ```
    //!
    //! **The description.** `name`, `extensions` and `aliases` are what the
    //! language answers to: lowercase, and no compiled format's. `caps` is
    //! `{read, write, author}`, the tiers: every language reads; one that
    //! writes has `print`; one that authors declares `syntax`, the table an
    //! editor's gestures write with (`twig lang syntax <format>` prints a
    //! compiled format's), and answers the renderers it names with `render`.
    //! `features` are switches its parser reads, each `{name, default,
    //! requires, syntax}` — `default` on in the language's own row,
    //! `requires` the features that come on with it, `syntax` a patch over
    //! the table while it is on — and `sets` are named lists of them, each
    //! `{name, extensions, aliases, features}` and registered as a format of
    //! its own. `samples` are small documents twig's load check holds the
    //! language to, strings or `{text, features}` for one that needs features
    //! on; at least one needs none. A `dialects` key is refused: twig spells
    //! a named configuration as a set.
    //!
    //! **The calls.** Each takes `call` first: `{row, features}`, the row the
    //! call is through — the language's name or a set's, as the module
    //! itself declared it, whatever prefix it was registered under — and the
    //! names of the features in force, the row's own and any a caller laid
    //! over them.
    //!
    //! `parse(call, input)` takes the input as a string and returns the
    //! **node table**, `{nodes, labels?}`: one row per node in pre-order, the
    //! row index being the node id — the root `doc` first, then the tree,
    //! then any definition no tree holds (a reference or footnote
    //! definition, with `parent: null`). A row is `{kind, parent, span, …}`:
    //! `kind` the published name (`"para"`, `"emph"`, `"str"`, …), `parent`
    //! a row id, `span` `[start, end)`, and the columns and fields its kind
    //! carries — `content_span`, `marker_span`, `spelling`, `attrs`
    //! (`[{key, value}]`), `attrs_span`, and the payload (`text`, `level`,
    //! `destination` and `reference`, `tight`, …) — exactly as `twig lang
    //! table <file>` prints them for a compiled format, which is the fastest
    //! way to see what a table should be. `labels` may be left out; twig
    //! indexes the definitions itself. Throwing refuses the input, with the
    //! error's message.
    //!
    //! `print(call, table)` (with `caps.write`) receives a table without
    //! positions — `nodes` only, rooted at any kind — and returns the source
    //! as a string. `render(call, request)` (with `caps.author`) answers
    //! `{which: "render_text", text, position}` with a string,
    //! `{which: "render_block", table}` with a string, and `{which:
    //! "spells_autolink", text}` with a boolean; a language with `print` and
    //! no `render` answers `render_block` with its print.
    //!
    //! **Offsets are bytes.** Every offset in a table is a byte offset into
    //! the UTF-8 input, and JavaScript indexes a string by UTF-16 unit, so a
    //! module measures with `offsets(input)` from `twig`, whose `at(i)` is
    //! the byte offset of UTF-16 index `i` — computed once, read in constant
    //! time.
    //!
    //! **What a module may import.** `twig` — `offsets`, `table` (a node
    //! table being built: `t.row(kind, parent, fields)` appends a row and
    //! answers its id, leaving out absent columns) and `fail`; `twig/wire` —
    //! `describe`, `invoke`, `handle` and `serve`, the object turned into
    //! the wire, which is how this crate calls a module and how a module
    //! under Node answers a `twig` CLI itself; `twig/languages/<name>`, a
    //! built-in language to build on; and `@djot/djot`, djot.js. A relative
    //! import is a file beside the module. Nothing else resolves: no `node:`
    //! modules, no package lookup, no TypeScript — plain ES2023, with
    //! `TextEncoder`, `TextDecoder` and a `console` that writes to stderr.
    //! `scripts/node-imports.mjs` resolves the same names under Node.
    //!
    //! **Built in.** `djot` — `js/languages/djot.js`, which
    //! [`JsLanguage::builtin`](crate::JsLanguage::builtin) loads by name — is
    //! djot read by djot.js (`@djot/djot` 0.3.2, vendored in `js/djot/` by
    //! `scripts/vendor-djot.sh`), its AST mapped onto the table the compiled
    //! djot produces. It reads; it is the twin twig's runtime-language
    //! contract was proven against, and `docs/twin-differences.md` lists the
    //! documents where djot.js and twig's djot disagree.
}

/// A format whose parser is an ES module.
#[derive(Debug)]
pub struct JsLanguage {
    engine: engine::Engine,
    /// Asked of the module once, at load; what `describe` answers, with
    /// `prefix` applied to every name.
    description: Description,
    /// Put before the language's name and each set's, and taken off a row
    /// again before the module is told it (`with_prefix`).
    prefix: String,
}

impl JsLanguage {
    /// Load the module at `path`. Its relative imports resolve beside it.
    pub fn from_file(path: impl AsRef<Path>) -> Result<Self, Error> {
        Self::load(Source::File(path.as_ref().to_path_buf()))
    }

    /// Load a module from its text; `name` is what an error message calls
    /// it. Such a module can import the served modules and nothing
    /// relative.
    pub fn from_source(name: &str, source: &str) -> Result<Self, Error> {
        Self::load(Source::Text {
            name: name.to_owned(),
            source: source.to_owned(),
        })
    }

    /// One of the languages served from the binary: `djot` is
    /// `twig/languages/djot`, and [`builtin_languages`] names them all. Each
    /// is named after the compiled format it twins, whose name and
    /// extensions twig will not give a second language — so in-process, or
    /// served to a `twig` CLI, give it a [`with_prefix`](Self::with_prefix).
    pub fn builtin(name: &str) -> Result<Self, Error> {
        Self::load(Source::Builtin(name.to_owned()))
    }

    /// The language under names that begin with `prefix`: `js-djot` for
    /// djot given `js-`, each set's name and every alias likewise, and each
    /// extension with the prefix after it instead (`dj-js`), so a file keeps
    /// the extension it is known by in front. The module is still told its
    /// rows by its own names. How a language twinning a compiled format is
    /// registered beside it.
    pub fn with_prefix(mut self, prefix: &str) -> Self {
        let tag = prefix.trim_matches(['-', '_']);
        let ext = |e: &String| {
            if tag.is_empty() {
                e.clone()
            } else {
                format!("{e}-{tag}")
            }
        };
        let d = &mut self.description;
        d.name = format!("{prefix}{}", d.name);
        d.aliases = d.aliases.iter().map(|a| format!("{prefix}{a}")).collect();
        d.extensions = d.extensions.iter().map(ext).collect();
        for s in &mut d.sets {
            s.name = format!("{prefix}{}", s.name);
            s.aliases = s.aliases.iter().map(|a| format!("{prefix}{a}")).collect();
            s.extensions = s.extensions.iter().map(ext).collect();
        }
        self.prefix = format!("{prefix}{}", self.prefix);
        self
    }

    /// What the module declared, as loaded, under the names it is
    /// registered by.
    pub fn description(&self) -> &Description {
        &self.description
    }

    fn load(source: Source) -> Result<Self, Error> {
        let (engine, description) = engine::Engine::load(source)?;
        Ok(JsLanguage {
            engine,
            description,
            prefix: String::new(),
        })
    }

    /// `row` as the module named it: the prefix taken off.
    fn own<'a>(&self, row: &'a str) -> &'a str {
        row.strip_prefix(self.prefix.as_str()).unwrap_or(row)
    }

    fn invoke(&self, op: &'static str, call: &Call<'_>, payload: &[u8]) -> Result<Vec<u8>, String> {
        // The wire carries text: what is not UTF-8 is refused here, at the
        // first byte that is not, since the module could never see it.
        let payload = std::str::from_utf8(payload).map_err(|e| {
            format!(
                "the input is not UTF-8 at byte {}, and a module reads text",
                e.valid_up_to()
            )
        })?;
        self.engine
            .invoke(op, self.own(call.row), call.features, payload.to_owned())
            .map(String::into_bytes)
    }
}

impl Language for JsLanguage {
    fn describe(&self) -> Description {
        self.description.clone()
    }

    fn parse_with(&self, call: &Call<'_>, source: &[u8]) -> Result<Vec<u8>, String> {
        self.invoke("parse", call, source)
    }

    fn print_with(&self, call: &Call<'_>, table: &[u8]) -> Result<Vec<u8>, String> {
        self.invoke("print", call, table)
    }

    fn render(&self, call: &Call<'_>, request: &[u8]) -> Result<Vec<u8>, String> {
        self.invoke("render", call, request)
    }
}

/// Convenience: [`twig::register`] over a module file — the language's own
/// row, whose sets [`twig::Format::by_name`] then finds.
pub fn register_file(path: impl AsRef<Path>) -> Result<twig::Format, Box<dyn std::error::Error>> {
    let lang = JsLanguage::from_file(path)?;
    Ok(twig::register(lang)?)
}
