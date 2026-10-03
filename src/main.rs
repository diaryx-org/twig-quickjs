//! `twig-quickjs <module.mjs>`: serve the format a module defines to a
//! `twig` binary, as a helper process — what a line of twig's `languages`
//! file names as the language's command:
//!
//! ```text
//! # name   extensions   command…
//! org      org          twig-quickjs ~/.config/twig/org.mjs
//! ```
//!
//! In place of a module, the name of a built-in language (`djot`) serves
//! that language from the binary. Named after the compiled format it twins,
//! it needs `--prefix js-` to be served beside one — as `js-djot`, with the
//! extension `dj-js` — which is how `twig lang check js-djot --against djot`
//! holds the two to each other:
//!
//! ```text
//! js-djot  dj-js  twig-quickjs --prefix js- djot
//! ```
//!
//! `twig-quickjs check <module.mjs>` loads the module and registers it here,
//! in this process, which runs twig's load check over the module's samples
//! — the same check the `twig` CLI makes when it loads a helper — and prints
//! what it declared or why it was refused.

use std::process::ExitCode;

use twig_quickjs::JsLanguage;

fn usage() -> String {
    format!(
        "twig-quickjs {}\n\
         \n\
         Usage: twig-quickjs [--prefix <p>] <module.mjs | name>        serve the format on stdin/stdout\n\
         \x20      twig-quickjs check [--prefix <p>] <module.mjs | name>  load it, run twig's load check, report\n\
         \x20      twig-quickjs --version | --help\n\
         \n\
         A module is an ES module whose default export describes the format and\n\
         carries its parse (and print, and render) functions; see the crate's\n\
         `module` docs. A name is a language served from the binary: {}.\n\
         --prefix puts <p> before the language's name and its sets' (`js-djot`), and\n\
         after its extensions (`dj-js`), so it registers beside the compiled format it\n\
         is named after.\n",
        env!("CARGO_PKG_VERSION"),
        twig_quickjs::builtin_languages()
            .collect::<Vec<_>>()
            .join(", "),
    )
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let mut rest: Vec<&str> = args.iter().map(String::as_str).collect();
    // `--prefix <p>`, wherever it stands.
    let mut prefix = None;
    if let Some(i) = rest.iter().position(|a| *a == "--prefix") {
        let Some(p) = rest.get(i + 1).copied() else {
            eprint!("{}", usage());
            return ExitCode::from(2);
        };
        prefix = Some(p);
        rest.drain(i..=i + 1);
    }
    match rest[..] {
        ["-h" | "--help" | "help"] => {
            print!("{}", usage());
            ExitCode::SUCCESS
        }
        ["-V" | "--version" | "version"] => {
            println!("twig-quickjs {}", env!("CARGO_PKG_VERSION"));
            ExitCode::SUCCESS
        }
        ["check", module] => check(module, prefix),
        [module] => serve(module, prefix),
        _ => {
            eprint!("{}", usage());
            ExitCode::from(2)
        }
    }
}

/// `module` loaded: a built-in language by name, unless a file by that
/// name is at hand; otherwise the module file.
fn load(module: &str, prefix: Option<&str>) -> Result<JsLanguage, ExitCode> {
    let builtin = !std::path::Path::new(module).exists()
        && twig_quickjs::builtin_languages().any(|n| n == module);
    let lang = if builtin {
        JsLanguage::builtin(module)
    } else {
        JsLanguage::from_file(module)
    };
    let lang = lang.map_err(|e| {
        eprintln!("twig-quickjs: {module}: {e}");
        ExitCode::from(2)
    })?;
    Ok(match prefix {
        Some(p) => lang.with_prefix(p),
        None => lang,
    })
}

/// The wire, answered by twig's own codec over the language until stdin
/// ends.
fn serve(module: &str, prefix: Option<&str>) -> ExitCode {
    let lang = match load(module, prefix) {
        Ok(l) => l,
        Err(code) => return code,
    };
    match twig::serve(lang) {
        Ok(()) => ExitCode::SUCCESS,
        // The reader went away; nothing more to say to it.
        Err(e) if e.kind() == std::io::ErrorKind::BrokenPipe => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("twig-quickjs: {e}");
            ExitCode::FAILURE
        }
    }
}

fn check(module: &str, prefix: Option<&str>) -> ExitCode {
    let lang = match load(module, prefix) {
        Ok(l) => l,
        Err(code) => return code,
    };
    let d = lang.description().clone();
    match twig::register(lang) {
        Ok(_) => {
            let caps = [(true, "read"), (d.write, "write"), (d.author, "author")]
                .iter()
                .filter(|(on, _)| *on)
                .map(|(_, name)| *name)
                .collect::<Vec<_>>()
                .join(" ");
            let samples = d.samples.len() + d.feature_samples.len();
            println!(
                "{}: registered ({caps}); {samples} sample(s) parsed{}{}",
                d.name,
                if d.write {
                    ", printed and reparsed to the same tree"
                } else {
                    ""
                },
                if d.author {
                    "; every gesture kept its promise"
                } else {
                    ""
                },
            );
            for f in &d.features {
                let on = if f.default { " (on by default)" } else { "" };
                println!("  feature {}{on}", f.name);
            }
            for s in &d.sets {
                println!("  set {}: {}", s.name, s.features.join(" "));
            }
            ExitCode::SUCCESS
        }
        Err(e) => {
            eprintln!("{}: refused: {e}", d.name);
            ExitCode::FAILURE
        }
    }
}
