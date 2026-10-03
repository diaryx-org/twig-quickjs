//! The binary is a helper: it answers twig's wire on stdin and stdout, which
//! is checked twice — line by line, as a `twig` CLI would speak to it, and
//! through `twig::helper::spawn`, which registers it in this process as a
//! format the compiled djot is then held to.

use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};

use twig::{Document, Format};

const BIN: &str = env!("CARGO_BIN_EXE_twig-quickjs");

/// Each request line to the helper, and the response line it answered.
fn exchange(args: &[&str], requests: &[&str]) -> Vec<String> {
    let mut child = Command::new(BIN)
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .expect("the helper starts");
    let mut stdin = child.stdin.take().unwrap();
    let mut stdout = BufReader::new(child.stdout.take().unwrap());
    let mut out = Vec::new();
    for r in requests {
        writeln!(stdin, "{r}").unwrap();
        stdin.flush().unwrap();
        let mut line = String::new();
        stdout.read_line(&mut line).unwrap();
        out.push(line.trim_end_matches('\n').to_owned());
    }
    drop(stdin);
    assert!(
        child.wait().unwrap().success(),
        "the helper exits cleanly when stdin ends"
    );
    out
}

#[test]
fn the_helper_answers_the_wire() {
    let answers = exchange(
        &["--prefix", "js-", "djot"],
        &[
            r#"{"op":"describe"}"#,
            r#"{"op":"parse","dialect":"js-djot","features":[],"input":"Hi *x* é\n"}"#,
            r#"{"op":"print","dialect":"js-djot","features":[],"table":{"nodes":[{"kind":"doc"},{"kind":"para","parent":0},{"kind":"emph","parent":1},{"kind":"str","parent":2,"text":"hi"}]}}"#,
            r#"{"op":"render","dialect":"js-djot","features":[],"which":"render_text","text":"*","position":"inline_text"}"#,
            "not json",
        ],
    );
    assert!(
        answers[0].starts_with(
            r#"{"ok":true,"description":{"name":"js-djot","extensions":["dj-js","djot-js"]"#
        ),
        "{}",
        answers[0]
    );
    assert!(
        answers[0].contains(r#""caps":{"read":true,"write":true,"author":false}"#),
        "{}",
        answers[0]
    );
    assert_eq!(
        answers[1],
        r#"{"ok":true,"table":{"nodes":[{"kind":"doc","parent":null,"span":[0,10],"content_span":[0,10]},{"kind":"para","parent":0,"span":[0,10],"content_span":[0,9]},{"kind":"str","parent":1,"span":[0,3],"text":"Hi "},{"kind":"strong","parent":1,"span":[3,6],"content_span":[4,5]},{"kind":"str","parent":3,"span":[4,5],"text":"x"},{"kind":"str","parent":1,"span":[6,9],"text":" é"}],"labels":[]}}"#
    );
    assert_eq!(answers[2], r#"{"ok":true,"output":"_hi_\n"}"#);
    // It does not author: no renderer answers.
    for refused in &answers[3..] {
        assert!(
            refused.starts_with(r#"{"ok":false,"message":"#),
            "{refused}"
        );
    }
}

#[test]
fn a_spawned_helper_is_a_format_holding_the_compiled_tables() {
    let f = twig::helper::spawn([BIN, "--prefix", "js-", "djot"]).expect("the helper registers");
    assert_eq!(f.name(), "js-djot");
    let input = "# Title\n\n> A *quote* with [a link](https://example.com).\n\n- one\n- two\n";
    let mut mine = Document::parse_str(input, f).unwrap();
    let mut theirs = Document::parse_str(input, Format::Djot).unwrap();
    assert_eq!(mine.nodes().unwrap(), theirs.nodes().unwrap());
    assert_eq!(mine.ast_json().unwrap(), theirs.ast_json().unwrap());
}

#[test]
fn check_registers_and_reports() {
    let out = Command::new(BIN)
        .args(["check", "--prefix", "js-", "djot"])
        .output()
        .unwrap();
    assert!(out.status.success());
    assert_eq!(
        String::from_utf8_lossy(&out.stdout),
        "js-djot: registered (read write); 8 sample(s) parsed, printed and reparsed to the same tree\n"
    );

    // Under its own name it is refused: twig compiles djot in.
    let out = Command::new(BIN).args(["check", "djot"]).output().unwrap();
    assert!(!out.status.success());
    let err = String::from_utf8_lossy(&out.stderr);
    assert!(
        err.contains("djot: refused:") && err.contains("already a format's"),
        "{err}"
    );
}

#[test]
fn the_command_line_says_what_it_is() {
    let out = Command::new(BIN).arg("--version").output().unwrap();
    assert_eq!(
        String::from_utf8_lossy(&out.stdout),
        format!("twig-quickjs {}\n", env!("CARGO_PKG_VERSION"))
    );
    let out = Command::new(BIN).arg("--help").output().unwrap();
    assert!(String::from_utf8_lossy(&out.stdout).contains("Usage: twig-quickjs"));
    let out = Command::new(BIN).output().unwrap();
    assert_eq!(out.status.code(), Some(2));
    let out = Command::new(BIN)
        .arg("no-such-module.mjs")
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(2));
}
