//! A module written here, `tests/modules/lines.mjs`, registered in-process:
//! every tier — it reads, prints and authors — a feature that requires
//! another, and a set that is a format of its own, each reaching the module
//! as the `call` it is told. And the modules twig refuses, refused with why.

use std::path::Path;
use std::sync::OnceLock;

use twig::{Document, Editor, Error, Format, Gesture, NodeId, Target};
use twig_quickjs::JsLanguage;

fn module(name: &str) -> std::path::PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/modules")
        .join(name)
}

/// `js-lines`, registered once for the test binary.
fn lines() -> Format {
    static FORMAT: OnceLock<Format> = OnceLock::new();
    *FORMAT.get_or_init(|| twig_quickjs::register_file(module("lines.mjs")).expect("registers"))
}

fn classes(doc: &mut Document) -> Vec<Option<String>> {
    doc.nodes()
        .unwrap()
        .iter()
        .filter(|n| n.kind == twig::Kind::Para)
        .map(|n| {
            n.attrs
                .iter()
                .find(|(k, _)| k == "class")
                .and_then(|(_, v)| v.clone())
        })
        .collect()
}

#[test]
fn the_description_is_the_modules() {
    let lang = JsLanguage::from_file(module("lines.mjs")).unwrap();
    let d = lang.description();
    assert_eq!(d.name, "js-lines");
    assert_eq!(d.extensions, ["jslines"]);
    assert!(d.write && d.author);
    assert_eq!(
        d.syntax.as_deref(),
        Some(r#"{"renderers":["render_text"]}"#)
    );
    assert_eq!(d.features.len(), 2);
    assert_eq!(d.features[1].name, "loud");
    assert_eq!(d.features[1].requires, ["crlf"]);
    assert_eq!(d.sets[0].name, "js-lines-loud");
    assert_eq!(d.samples, ["one\ntwo\n", "x\n"]);
    assert_eq!(d.feature_samples[0].text, "Loud\n");
    assert_eq!(d.feature_samples[0].features, ["loud"]);
}

#[test]
fn a_prefix_renames_the_language_its_sets_and_its_extensions() {
    let lang = JsLanguage::from_file(module("lines.mjs"))
        .unwrap()
        .with_prefix("p-");
    let d = lang.description();
    assert_eq!(d.name, "p-js-lines");
    assert_eq!(d.extensions, ["jslines-p"]);
    assert_eq!(d.sets[0].name, "p-js-lines-loud");
    assert_eq!(d.sets[0].extensions, ["jsloud-p"]);
    // The features are the module's own, and keep their names.
    assert_eq!(d.features[0].name, "crlf");

    // Registered, the prefix comes off again before the module hears the row.
    let p = twig::register(lang).expect("registers under the prefix");
    let set = Format::by_name("p-js-lines-loud").expect("the set is a format");
    assert_eq!(set.dialect_of(), Some(p));
    let mut doc = Document::parse_str("a\n", set).unwrap();
    assert_eq!(classes(&mut doc), [Some("loud".to_owned())]);
    assert_eq!(doc.serialize_to(Target::from(set)).unwrap(), b"a\r\n");
    assert_eq!(doc.serialize_to(Target::from(p)).unwrap(), b"a\n");
}

#[test]
fn features_reach_the_module() {
    let f = lines();
    let mut doc = Document::parse_str("a\nb\n", f).unwrap();
    assert_eq!(classes(&mut doc), [None, None]);
    assert_eq!(doc.serialize_to(Target::from(f)).unwrap(), b"a\nb\n");

    let mut doc = Document::parse_with_features(b"a\nb\n", f, &["crlf"]).unwrap();
    assert_eq!(doc.serialize_to(Target::from(f)).unwrap(), b"a\r\nb\r\n");

    // `loud` requires `crlf`: one feature named, both in force.
    let mut doc = Document::parse_with_features(b"a\n", f, &["loud"]).unwrap();
    assert_eq!(classes(&mut doc), [Some("loud".to_owned())]);
    assert_eq!(doc.serialize_to(Target::from(f)).unwrap(), b"a\r\n");

    assert_eq!(f.feature_flags(&["crlf"]), Ok(1));
    assert_eq!(f.feature_flags(&["whisper"]), Err(Error::NotFound));
}

#[test]
fn a_set_is_a_format_of_its_own() {
    let f = lines();
    let set = Format::by_name("js-lines-loud").expect("the set is registered");
    assert_ne!(set, f);
    assert_eq!(set.dialect_of(), Some(f));
    assert_eq!(set.name(), "js-lines-loud");
    let mut doc = Document::parse_str("x\ny\n", set).unwrap();
    assert_eq!(
        classes(&mut doc),
        [Some("loud".to_owned()), Some("loud".to_owned())]
    );
    assert_eq!(doc.serialize_to(Target::from(set)).unwrap(), b"x\r\ny\r\n");
}

#[test]
fn it_authors_through_its_renderer() {
    let f = lines();
    assert!(f.supports(Gesture::InsertLiteral));
    let mut editor = Editor::new(b"a\n", f).unwrap();
    editor.insert_literal(0, "*x* ").unwrap();
    assert_eq!(editor.source().unwrap(), b"*x* a\n");
    // A table it parses is measured in bytes.
    let mut doc = Document::parse_str("é\n", f).unwrap();
    assert_eq!(doc.span(NodeId(2)).unwrap(), 0..2);
}

#[test]
fn the_modules_refusal_is_a_parse_error() {
    let f = lines();
    assert_eq!(Document::parse(b"a\0b\n", f).err(), Some(Error::ParseError));
}

#[test]
fn a_module_twig_refuses_is_refused_with_why() {
    let refused = |name: &str, source: &str| -> String {
        match JsLanguage::from_source(name, source) {
            Err(e) => e.to_string(),
            Ok(lang) => match twig::register(lang) {
                Err(e) => e.to_string(),
                Ok(_) => panic!("{name} registered"),
            },
        }
    };
    let parse = "parse() { return { nodes: [{ kind: \"doc\", parent: null, span: [0, 0] }] }; }";

    let m = refused(
        "dialects",
        &format!(
            "export default {{ name: \"x-dialects\", dialects: [], samples: [\"\"], {parse} }};"
        ),
    );
    assert!(m.contains("`dialects` is not a twig language's"), "{m}");

    let m = refused(
        "no-samples",
        &format!("export default {{ name: \"x-no-samples\", {parse} }};"),
    );
    assert!(m.contains("at least one sample"), "{m}");

    let m = refused(
        "taken",
        &format!("export default {{ name: \"djot\", samples: [\"\"], {parse} }};"),
    );
    assert!(m.contains("already a format's"), "{m}");

    let m = refused(
        "bad-table",
        "export default { name: \"x-bad-table\", samples: [\"ab\"], parse() { return { nodes: [{ kind: \"doc\", parent: null, span: [0, 9] }] }; } };",
    );
    assert!(m.contains("past the source"), "{m}");

    let m = refused(
        "throws",
        "export default { name: \"x-throws\", samples: [\"a\"], parse() { throw new Error(\"no lines here\"); } };",
    );
    assert!(m.contains("no lines here"), "{m}");

    let m = refused(
        "no-print",
        &format!(
            "export default {{ name: \"x-no-print\", caps: {{ write: true }}, samples: [\"\"], {parse} }};"
        ),
    );
    assert!(m.contains("needs a `print` function"), "{m}");

    let m = refused("syntax-error", "export default {");
    assert!(m.starts_with("syntax-error: "), "{m}");

    let m = refused("no-language", "export const x = 1;");
    assert!(m.contains("exports no language"), "{m}");

    let m = refused("bad-import", "import x from \"node:fs\"; export default x;");
    assert!(
        m.contains("not one of the modules twig-quickjs serves"),
        "{m}"
    );
}

#[test]
fn a_built_in_language_is_named_or_refused() {
    assert!(twig_quickjs::builtin_languages().any(|n| n == "djot"));
    let e = JsLanguage::builtin("org").unwrap_err().to_string();
    assert!(e.contains("no language named `org`"), "{e}");
}
