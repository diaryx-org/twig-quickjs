//! The JavaScript engine: one QuickJS runtime per language, on a thread of
//! its own.
//!
//! A [`twig::Language`] is `Send + Sync`, and a QuickJS runtime is
//! neither, so the runtime lives on one thread for the life of the language
//! and every call is a message to it — an operation and its payload in, a
//! string out. What the module's object means is decided once, in
//! JavaScript: `js/wire.js`'s `describe` reads the description and `invoke`
//! makes a call, the same two functions its `handle` answers the wire with
//! under Node, so this crate converts nothing but the description into a
//! Rust value.
//!
//! What the engine adds to QuickJS is what a module written for Node or the
//! browser assumes and QuickJS does not have: `TextEncoder` and
//! `TextDecoder` (UTF-8, over two native functions), and a `console` that
//! writes to stderr, since stdout is the wire.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::rc::Rc;
use std::sync::mpsc::{self, Receiver, Sender};
use std::thread::{self, JoinHandle};

use rquickjs::loader::{ImportAttributes, Loader, Resolver};
use rquickjs::{Context, Ctx, Function, Module, Object, Runtime, TypedArray, Value};
use twig::{Description, Feature, Sample, Set};

/// What QuickJS may use of its thread's stack, in bytes. djot.js recurses
/// once per level of nesting, and a document nests as deep as it likes.
const JS_STACK_BYTES: usize = 16 << 20;

/// The modules served from the binary, by the name a module imports.
///
/// `twig` is the kit — the node table and byte offsets — and `twig/wire`
/// the module-to-wire step; `@djot/djot` is djot.js, vendored into
/// `js/djot/` by `scripts/vendor-djot.sh`; `twig/languages/<name>` are the
/// languages built in.
const MODULES: &[(&str, &str)] = &[
    ("twig", include_str!("../js/twig.js")),
    ("twig/wire", include_str!("../js/wire.js")),
    ("@djot/djot", include_str!("../js/djot/djot.js")),
    (
        "twig/languages/djot",
        include_str!("../js/languages/djot.js"),
    ),
];

/// The languages this binary carries, by the name a command line gives one
/// (`djot`, for `twig/languages/djot`).
pub fn builtin_languages() -> impl Iterator<Item = &'static str> {
    MODULES
        .iter()
        .filter_map(|(n, _)| n.strip_prefix("twig/languages/"))
}

/// What QuickJS lacks that a module assumes.
const PRELUDE: &str = r#"
globalThis.TextEncoder = class TextEncoder {
  get encoding() { return "utf-8"; }
  encode(s) { return __twig_utf8_encode(s === undefined ? "" : String(s)); }
};
globalThis.TextDecoder = class TextDecoder {
  constructor(label) {
    const l = label === undefined ? "utf-8" : String(label).toLowerCase();
    if (l !== "utf-8" && l !== "utf8") throw new RangeError("TextDecoder: only utf-8 is supported here");
  }
  get encoding() { return "utf-8"; }
  decode(b) { return b === undefined ? "" : __twig_utf8_decode(b); }
};
const __twig_console = (level) => (...args) => __twig_stderr(level + ": " + args.map((a) => typeof a === "string" ? a : JSON.stringify(a)).join(" "));
globalThis.console = { log: __twig_console("log"), info: __twig_console("info"), warn: __twig_console("warn"), error: __twig_console("error"), debug: __twig_console("debug") };
"#;

/// Where a language's module comes from.
#[derive(Debug, Clone)]
pub enum Source {
    /// A file; relative imports resolve beside it.
    File(PathBuf),
    /// Text, under a name error messages use.
    Text { name: String, source: String },
    /// One of the languages served from the binary, by its name (`djot`) —
    /// see [`builtin_languages`].
    Builtin(String),
}

/// Why the engine could not load a module. A failure inside `parse`,
/// `print` or `render` is the call's error instead, and never reaches here.
#[derive(Debug)]
pub enum LoadError {
    Io(std::io::Error),
    Script(String),
}

impl std::fmt::Display for LoadError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LoadError::Io(e) => write!(f, "{e}"),
            LoadError::Script(m) => f.write_str(m),
        }
    }
}

impl std::error::Error for LoadError {}

impl From<std::io::Error> for LoadError {
    fn from(e: std::io::Error) -> Self {
        LoadError::Io(e)
    }
}

/// One call into the language: `op` is `parse`, `print` or `render`.
struct Job {
    op: &'static str,
    row: String,
    features: Vec<String>,
    payload: String,
    reply: Sender<Result<String, String>>,
}

/// A loaded language: a QuickJS runtime on its own thread, answering one
/// call at a time.
pub struct Engine {
    jobs: Sender<Job>,
    _thread: JoinHandle<()>,
}

impl std::fmt::Debug for Engine {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Engine")
    }
}

impl Engine {
    /// Start a runtime, load the module and its imports, find its language
    /// — the default export, or the first export with a `parse` function —
    /// and read its description.
    pub fn load(source: Source) -> Result<(Engine, Description), LoadError> {
        let (name, text, dir) = match &source {
            Source::File(path) => {
                let path = std::fs::canonicalize(path)?;
                let text = std::fs::read_to_string(&path)?;
                let dir = path.parent().map(Path::to_path_buf);
                (path.to_string_lossy().into_owned(), text, dir)
            }
            Source::Text { name, source } => (name.clone(), source.clone(), None),
            Source::Builtin(name) => {
                let spec = format!("twig/languages/{name}");
                if !MODULES.iter().any(|(n, _)| *n == spec) {
                    let known = builtin_languages().collect::<Vec<_>>().join(", ");
                    return Err(LoadError::Script(format!(
                        "no language named `{name}` is built in (these are: {known})"
                    )));
                }
                (spec, String::new(), None)
            }
        };
        let (jobs, inbox) = mpsc::channel::<Job>();
        let (ready, loaded) = mpsc::channel::<Result<Description, String>>();
        let thread = thread::Builder::new()
            .name(format!("twig-quickjs {name}"))
            // The thread gets twice what the engine is allowed to use, so
            // QuickJS's own limit is what a deep document meets.
            .stack_size(2 * JS_STACK_BYTES)
            .spawn(move || run(name, text, dir, ready, inbox))
            .map_err(LoadError::Io)?;
        match loaded.recv() {
            Ok(Ok(description)) => Ok((
                Engine {
                    jobs,
                    _thread: thread,
                },
                description,
            )),
            Ok(Err(message)) => Err(LoadError::Script(message)),
            Err(_) => Err(LoadError::Script(
                "the engine thread ended before the module loaded".to_owned(),
            )),
        }
    }

    /// One call: the language's answer as a string, or its refusal — what
    /// it threw — as the message. A dead engine is a refusal too.
    pub fn invoke(
        &self,
        op: &'static str,
        row: &str,
        features: &[&str],
        payload: String,
    ) -> Result<String, String> {
        let (reply, answer) = mpsc::channel();
        self.jobs
            .send(Job {
                op,
                row: row.to_owned(),
                features: features.iter().map(|f| (*f).to_owned()).collect(),
                payload,
                reply,
            })
            .map_err(|_| "the engine thread is gone".to_owned())?;
        answer
            .recv()
            .map_err(|_| "the engine thread ended without answering".to_owned())?
    }
}

/// The engine thread: everything that touches the runtime happens here.
fn run(
    name: String,
    text: String,
    dir: Option<PathBuf>,
    ready: Sender<Result<Description, String>>,
    inbox: Receiver<Job>,
) {
    let rt = match Runtime::new() {
        Ok(rt) => rt,
        Err(e) => {
            let _ = ready.send(Err(format!("could not start QuickJS: {e}")));
            return;
        }
    };
    rt.set_max_stack_size(JS_STACK_BYTES);
    let mut inline: HashMap<String, String> = MODULES
        .iter()
        .map(|(n, s)| ((*n).to_owned(), (*s).to_owned()))
        .collect();
    if dir.is_none() && !inline.contains_key(&name) {
        inline.insert(name.clone(), text);
    }
    let modules = Modules {
        inline: Rc::new(inline),
    };
    rt.set_loader(modules.clone(), modules);
    let ctx = match Context::full(&rt) {
        Ok(ctx) => ctx,
        Err(e) => {
            let _ = ready.send(Err(format!("could not start QuickJS: {e}")));
            return;
        }
    };
    let loaded = ctx.with(|ctx| -> Result<Description, String> {
        install_natives(&ctx).map_err(|e| describe_error(&ctx, e))?;
        ctx.eval::<(), _>(PRELUDE)
            .map_err(|e| describe_error(&ctx, e))?;
        let main = format!(
            r#"import {{ describe, invoke }} from "twig/wire";
import * as mod from {module};
const lang = mod.default ?? Object.values(mod).find((v) => v !== null && typeof v === "object" && typeof v.parse === "function");
if (!lang) throw new Error("the module exports no language: neither a default export nor an export with a `parse` function");
const d = describe(lang);
const json = (v) => (v === null || v === undefined ? null : JSON.stringify(v));
globalThis.__twig_description = {{ ...d, syntax: json(d.syntax), features: d.features.map((f) => ({{ ...f, syntax: json(f.syntax) }})) }};
globalThis.__twig_invoke = (op, row, features, payload) => invoke(lang, op, row, features, payload);"#,
            module = js_string(&name),
        );
        let promise = Module::evaluate(ctx.clone(), "twig-quickjs:main", main)
            .map_err(|e| describe_error(&ctx, e))?;
        promise
            .finish::<()>()
            .map_err(|e| describe_error(&ctx, e))?;
        let d: Object = ctx
            .globals()
            .get("__twig_description")
            .map_err(|e| describe_error(&ctx, e))?;
        description(&d).map_err(|e| describe_error(&ctx, e))
    });
    match loaded {
        Ok(d) => {
            let _ = ready.send(Ok(d));
        }
        Err(message) => {
            let _ = ready.send(Err(format!("{name}: {message}")));
            return;
        }
    }
    // A `Function<'js>` cannot outlive one `with`; the call is held by its
    // global name and fetched per call, a property lookup.
    while let Ok(job) = inbox.recv() {
        let answer = ctx.with(|ctx| -> Result<String, String> {
            ctx.globals()
                .get::<_, Function>("__twig_invoke")
                .and_then(|f| f.call((job.op, job.row, job.features, job.payload)))
                .map_err(|e| describe_error(&ctx, e))
        });
        let _ = job.reply.send(answer);
    }
}

/// The description `twig/wire`'s `describe` checked, as the Rust value —
/// its `syntax` members already JSON text.
fn description(d: &Object<'_>) -> rquickjs::Result<Description> {
    let caps: Object = d.get("caps")?;
    let features: Vec<Object> = d.get("features")?;
    let sets: Vec<Object> = d.get("sets")?;
    let samples: Vec<Value> = d.get("samples")?;
    let mut out = Description {
        name: d.get("name")?,
        extensions: d.get("extensions")?,
        aliases: d.get("aliases")?,
        write: caps.get("write")?,
        author: caps.get("author")?,
        syntax: d.get("syntax")?,
        ..Description::default()
    };
    for f in features {
        out.features.push(Feature {
            name: f.get("name")?,
            default: f.get("default")?,
            requires: f.get("requires")?,
            syntax: f.get("syntax")?,
        });
    }
    for s in sets {
        out.sets.push(Set {
            name: s.get("name")?,
            extensions: s.get("extensions")?,
            aliases: s.get("aliases")?,
            features: s.get("features")?,
        });
    }
    for s in samples {
        if let Some(text) = s.as_string() {
            out.samples.push(text.to_string()?);
        } else if let Some(o) = s.as_object() {
            out.feature_samples.push(Sample {
                text: o.get("text")?,
                features: o.get("features")?,
            });
        }
    }
    Ok(out)
}

/// `TextEncoder`/`TextDecoder`'s work, and `console`'s: the functions the
/// prelude wraps.
fn install_natives<'js>(ctx: &Ctx<'js>) -> rquickjs::Result<()> {
    let g = ctx.globals();
    g.set(
        "__twig_utf8_encode",
        Function::new(ctx.clone(), |ctx: Ctx<'js>, s: String| {
            TypedArray::<u8>::new(ctx, s.into_bytes())
        })?,
    )?;
    g.set(
        "__twig_utf8_decode",
        Function::new(ctx.clone(), |b: TypedArray<'js, u8>| -> String {
            // The view's bytes, offset and length honoured. Nothing else
            // runs on the engine while a native does, so the buffer cannot
            // move under it.
            let bytes = unsafe { b.as_bytes() }.unwrap_or(&[]);
            String::from_utf8_lossy(bytes).into_owned()
        })?,
    )?;
    g.set(
        "__twig_stderr",
        Function::new(ctx.clone(), |line: String| {
            eprintln!("{line}");
        })?,
    )?;
    Ok(())
}

/// A JavaScript error as one line for a message: the exception's message
/// and, where QuickJS gives one, the first frame of its stack.
fn describe_error(ctx: &Ctx<'_>, err: rquickjs::Error) -> String {
    match err {
        rquickjs::Error::Exception => {
            let ex = ctx.catch();
            if let Some(ex) = ex.as_exception() {
                let message = ex.message().unwrap_or_else(|| "error".to_owned());
                match ex.stack() {
                    Some(stack) if !stack.trim().is_empty() => {
                        let first = stack.lines().next().unwrap_or("").trim();
                        format!("{message} ({first})")
                    }
                    _ => message,
                }
            } else if let Some(s) = ex.as_string() {
                s.to_string().unwrap_or_else(|_| "error".to_owned())
            } else {
                format!("{ex:?}")
            }
        }
        other => other.to_string(),
    }
}

/// `s` as a JavaScript string literal.
fn js_string(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 || c == '\u{2028}' || c == '\u{2029}' => {
                out.push_str(&format!("\\u{:04x}", c as u32));
            }
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

/// The module resolver and loader: a name in `inline` is served from
/// memory (the embedded modules, and a language given as text); anything
/// else is a file, absolute or relative to the module importing it.
#[derive(Clone)]
struct Modules {
    inline: Rc<HashMap<String, String>>,
}

impl Resolver for Modules {
    fn resolve<'js>(
        &mut self,
        _ctx: &Ctx<'js>,
        base: &str,
        name: &str,
        _attributes: Option<ImportAttributes<'js>>,
    ) -> rquickjs::Result<String> {
        if self.inline.contains_key(name) {
            return Ok(name.to_owned());
        }
        let candidate: PathBuf = if name.starts_with("./") || name.starts_with("../") {
            Path::new(base)
                .parent()
                .map(|d| d.join(name))
                .unwrap_or_else(|| PathBuf::from(name))
        } else {
            PathBuf::from(name)
        };
        match std::fs::canonicalize(&candidate) {
            Ok(path) if path.is_file() => Ok(path.to_string_lossy().into_owned()),
            _ => Err(rquickjs::Error::new_resolving_message(
                base,
                name,
                "not one of the modules twig-quickjs serves (twig, twig/wire, twig/languages/<name>, @djot/djot), and not a file",
            )),
        }
    }
}

impl Loader for Modules {
    fn load<'js>(
        &mut self,
        ctx: &Ctx<'js>,
        name: &str,
        _attributes: Option<ImportAttributes<'js>>,
    ) -> rquickjs::Result<Module<'js>> {
        let source = match self.inline.get(name) {
            Some(s) => s.clone(),
            None => std::fs::read_to_string(name)
                .map_err(|e| rquickjs::Error::new_loading_message(name, e.to_string()))?,
        };
        Module::declare(ctx.clone(), name, source)
    }
}
