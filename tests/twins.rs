//! The djot twin (`js/languages/djot.js`, served from the binary) is held to
//! the djot twig compiles in, in-process, over three sets of documents:
//! twig's own djot harness samples, which the module declares as its
//! samples; djot.js's test corpus (`tests/corpus/*.test`, the input of each
//! case); and the documents in `tests/documents/`, which reach what the
//! corpus does not — multi-byte text, `\r\n` line ends, and a document of
//! some length, djot.js's `bench/readme.dj` (MIT, as the corpus is).
//!
//! The twin is registered as `js-djot`, each document is parsed through it
//! and through `Format::Djot`, and the two documents are compared column by
//! column: every node's kind, parent, spans, marker, payload, attributes and
//! container origin (`nodes`), where its attributes were written
//! (`attrs_span`), the nested tree with every kind's fields (`ast_json`), and
//! the definitions. That is what `twig lang check js-djot --against djot`
//! compares from the command line, less the one column the crate does not
//! surface — a list's `spelling`, its bullet character or ordered delimiter
//! — and the label table's registries, which `lang check` compares and the
//! README's check holds the twin to.
//!
//! The cases where djot.js and twig's djot genuinely disagree are listed in
//! [`DIFFERENT`] and [`DIFFERENT_DOCUMENTS`] and written up, with both
//! tables' first differing row, in `docs/twin-differences.md`. Those are
//! held to *differ*, so a fix on either side shows up here as a case to
//! move back into the gate.

use std::path::Path;
use std::sync::OnceLock;

use twig::{Document, Format, NodeId, Target};
use twig_quickjs::JsLanguage;

/// Corpus cases, by `file:line` of the fence that opens them, whose tables
/// differ for a reason that is not the twin's: see docs/twin-differences.md.
const DIFFERENT: &[(&str, &str)] = &[
    (
        "attributes.test:25",
        "twig splits a lone word in two for its attributes",
    ),
    (
        "attributes.test:39",
        "twig splits a lone word in two for its attributes",
    ),
    (
        "attributes.test:47",
        "twig splits a lone word in two for its attributes",
    ),
    (
        "attributes.test:60",
        "twig splits a lone word in two for its attributes",
    ),
    (
        "attributes.test:66",
        "twig splits a lone word in two for its attributes",
    ),
    (
        "attributes.test:72",
        "twig splits a lone word in two for its attributes",
    ),
    (
        "attributes.test:80",
        "twig splits a lone word in two for its attributes",
    ),
    (
        "attributes.test:217",
        "twig splits a lone word in two for its attributes",
    ),
    (
        "attributes.test:223",
        "twig splits a lone word in two for its attributes",
    ),
    (
        "links_and_images.test:179",
        "djot.js 0.3.2 lets the strong win; twig follows later djot",
    ),
    (
        "regression.test:46",
        "twig's table content_span runs backwards with a caption",
    ),
    (
        "tables.test:35",
        "twig's table content_span runs backwards with a caption",
    ),
];

/// Documents outside the corpus where the two disagree, each the smallest
/// that shows it.
const DIFFERENT_DOCUMENTS: &[(&str, &str)] = &[
    ("djot.js drops the text before an image", "x ![d](e)\n"),
    (
        "djot.js keeps the last of two definitions, twig the first",
        "[a]: one\n[a]: two\n\n[a][]\n",
    ),
];

/// The twin, registered once for the whole test binary: a name registers
/// once per process.
fn js_djot() -> Format {
    static FORMAT: OnceLock<Format> = OnceLock::new();
    *FORMAT.get_or_init(|| {
        let lang = JsLanguage::builtin("djot")
            .expect("the module loads")
            .with_prefix("js-");
        twig::register(lang).expect("the twin passes twig's load check")
    })
}

/// Everything twig reports about a parse that the node table carries.
fn snapshot(input: &[u8], format: Format) -> Result<String, String> {
    let mut doc = Document::parse(input, format).map_err(|e| format!("does not parse: {e}"))?;
    let nodes = doc.nodes().map_err(|e| e.to_string())?;
    let mut out = String::new();
    for n in &nodes {
        let attrs_span = doc.attrs_span(n.id).map_err(|e| e.to_string())?;
        out.push_str(&format!("{n:?} attrs_span={attrs_span:?}\n"));
    }
    out.push_str(&format!(
        "definitions {:?}\n",
        doc.definitions().map_err(|e| e.to_string())?
    ));
    out.push_str(&String::from_utf8_lossy(
        &doc.ast_json().map_err(|e| e.to_string())?,
    ));
    Ok(out)
}

/// The first line at which the two snapshots part, for a failure message.
fn first_difference(mine: &str, theirs: &str) -> String {
    for (i, (a, b)) in mine.lines().zip(theirs.lines()).enumerate() {
        if a != b {
            return format!("line {i}:\n  js-djot: {a}\n  djot:    {b}");
        }
    }
    format!(
        "one snapshot is longer ({} vs {} lines)",
        mine.lines().count(),
        theirs.lines().count()
    )
}

/// `None` when the twin's document is the compiled djot's, column for column.
fn compare(input: &[u8]) -> Option<String> {
    let theirs = match snapshot(input, Format::Djot) {
        Ok(s) => s,
        Err(e) => return Some(format!("djot: {e}")),
    };
    match snapshot(input, js_djot()) {
        Ok(mine) if mine == theirs => None,
        Ok(mine) => {
            if std::env::var("TWIN_DEBUG").is_ok() {
                eprintln!("=== js-djot\n{mine}\n=== djot\n{theirs}");
            }
            Some(first_difference(&mine, &theirs))
        }
        Err(e) => Some(format!("js-djot: {e}")),
    }
}

/// The cases of a djot.js test file, as djot.js's own runner reads them:
/// a fence of three or more backticks opens one (its line is the case's
/// name), the input runs to a line `.` or `!`, and the expected output to a
/// fence at least as long.
fn cases(name: &str, text: &str) -> Vec<(String, String)> {
    let lines: Vec<&str> = text
        .split('\n')
        .map(|l| l.strip_suffix('\r').unwrap_or(l))
        .collect();
    let mut out = Vec::new();
    let mut i = 0;
    while i < lines.len() {
        if !lines[i].starts_with("```") {
            i += 1;
            continue;
        }
        let ticks = lines[i].chars().take_while(|c| *c == '`').count();
        i += 1;
        let label = format!("{name}:{i}");
        let mut input = String::new();
        while i < lines.len() {
            let l = lines[i];
            i += 1;
            if l == "." || l == "!" {
                break;
            }
            input.push_str(l);
            input.push('\n');
        }
        while i < lines.len() {
            let l = lines[i];
            i += 1;
            if l.len() >= ticks && l.as_bytes()[..ticks].iter().all(|c| *c == b'`') {
                break;
            }
        }
        out.push((label, input));
    }
    out
}

fn corpus() -> Vec<(String, String)> {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/corpus");
    let mut files: Vec<_> = std::fs::read_dir(&dir)
        .expect("tests/corpus")
        .map(|e| e.unwrap().path())
        .filter(|p| p.extension().is_some_and(|e| e == "test"))
        .collect();
    files.sort();
    files
        .iter()
        .flat_map(|p| {
            let name = p.file_name().unwrap().to_string_lossy().into_owned();
            cases(&name, &std::fs::read_to_string(p).unwrap())
        })
        .collect()
}

#[test]
fn the_samples_give_the_compiled_tables() {
    let lang = JsLanguage::builtin("djot").unwrap();
    let samples = &lang.description().samples;
    assert_eq!(samples.len(), 8, "twig's djot harness has eight samples");
    for s in samples {
        if let Some(d) = compare(s.as_bytes()) {
            panic!("sample {s:?} differs at {d}");
        }
    }
}

#[test]
fn the_corpus_gives_the_compiled_tables() {
    let all = corpus();
    assert_eq!(all.len(), 260, "djot.js 0.3.2's corpus has 260 cases");
    let mut failures = Vec::new();
    let mut held = 0;
    for (label, input) in &all {
        let known = DIFFERENT.iter().any(|(l, _)| l == label);
        match (compare(input.as_bytes()), known) {
            (None, false) => held += 1,
            (Some(d), false) => failures.push(format!("{label}: {input:?}\n  {d}")),
            (None, true) => failures.push(format!(
                "{label} is listed as a known difference and now agrees: move it back into the gate"
            )),
            (Some(_), true) => {}
        }
    }
    assert!(
        failures.is_empty(),
        "{} case(s) failed:\n{}",
        failures.len(),
        failures.join("\n")
    );
    assert_eq!(held + DIFFERENT.len(), all.len());
}

#[test]
fn the_documents_give_the_compiled_tables() {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/documents");
    let mut seen = 0;
    for entry in std::fs::read_dir(&dir).unwrap() {
        let path = entry.unwrap().path();
        if path.extension().is_none_or(|e| e != "dj") {
            continue;
        }
        seen += 1;
        let input = std::fs::read(&path).unwrap();
        if let Some(d) = compare(&input) {
            panic!("{} differs at {d}", path.display());
        }
    }
    assert!(seen >= 4, "tests/documents holds the documents");
}

#[test]
fn the_known_differences_still_differ() {
    for (what, input) in DIFFERENT_DOCUMENTS {
        assert!(
            compare(input.as_bytes()).is_some(),
            "{what} ({input:?}) now agrees: drop it from docs/twin-differences.md"
        );
    }
}

#[test]
fn the_twin_is_a_format_like_any_other() {
    let f = js_djot();
    assert_eq!(f.name(), "js-djot");
    assert_eq!(Format::by_name("js-djot"), Some(f));
    let mut doc = Document::parse_str("Hello *world* 😀\n", f).unwrap();
    assert_eq!(
        doc.render_html().unwrap(),
        "<p>Hello <strong>world</strong> 😀</p>\n".as_bytes()
    );
    // The table's offsets are bytes, not UTF-16 units.
    let last = doc.nodes().unwrap().pop().unwrap();
    assert_eq!(last.span, 13..18);
    assert_eq!(last.text.as_deref(), Some(" 😀"));
    // It reads and does not write.
    assert!(doc.serialize_to(Target::from(f)).is_err());
    // Its refusal of bytes that are not text is a parse error, not a crash.
    assert!(Document::parse(b"a\xffb\n", f).is_err());
    // An explicit id is a node of its own, found by its attributes.
    let mut doc = Document::parse_str("{#x}\npara\n", f).unwrap();
    assert_eq!(doc.attrs_span(NodeId(1)).unwrap(), Some(0..4));
}
