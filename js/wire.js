// `twig/wire`: a module's language object, answering twig's helper wire.
//
// The object a module exports is the `describe` document — `name`,
// `extensions`, `aliases`, `caps`, `syntax`, `features`, `sets`, `samples`,
// the field names `twig lang check` and the wire use — with the functions
// that are the format beside it:
//
//   parse(call, input)    -> a node table: { nodes: [...], labels?: [...] }
//   print(call, table)    -> the document, a string         (caps.write)
//   render(call, request) -> a string, or a boolean for spells_autolink
//
// `call` is `{ row, features }`: the row the call is through — the
// language's name, or one of its sets' — and the names of the features in
// force. twig-quickjs calls these through `describe` and `invoke` below; a
// module run under Node is a helper the `twig` command line can spawn
// through `serve`, which reads the wire from stdin with `handle`:
//
//   node --import ./scripts/node-imports.mjs -e \
//     'import("twig/wire").then(async (w) => w.serve((await import("./org.mjs")).default))'
//
// The wire itself — one JSON request line to one JSON response line — is
// documented at the top of twig's `src/wire.zig`.

/** The `describe` document for `lang`, checked for shape. */
export function describe(lang) {
  if (lang === null || typeof lang !== "object") throw new Error("the module's language is not an object");
  if (typeof lang.parse !== "function") throw new Error("the language has no `parse` function");
  if (typeof lang.name !== "string") throw new Error("the language's `name` is not a string");
  if ("dialects" in lang) {
    throw new Error("`dialects` is not a twig language's: a named configuration is a set (`sets`) of the language's `features`");
  }
  const caps = lang.caps ?? {};
  const write = caps.write === true;
  const author = caps.author === true;
  if (write && typeof lang.print !== "function") throw new Error("caps.write needs a `print` function");
  return {
    name: lang.name,
    extensions: strings(lang.extensions, "extensions"),
    aliases: strings(lang.aliases, "aliases"),
    caps: { read: true, write, author },
    syntax: lang.syntax ?? null,
    features: (lang.features ?? []).map((f, i) => ({
      name: string(f.name, `features[${i}].name`),
      default: f.default === true,
      requires: strings(f.requires, `features[${i}].requires`),
      syntax: f.syntax ?? null,
    })),
    sets: (lang.sets ?? []).map((s, i) => ({
      name: string(s.name, `sets[${i}].name`),
      extensions: strings(s.extensions, `sets[${i}].extensions`),
      aliases: strings(s.aliases, `sets[${i}].aliases`),
      features: strings(s.features, `sets[${i}].features`),
    })),
    samples: (lang.samples ?? []).map((s, i) =>
      typeof s === "string"
        ? s
        : { text: string(s?.text, `samples[${i}].text`), features: strings(s.features, `samples[${i}].features`) },
    ),
  };
}

/**
 * One call into the language: `op` is "parse", "print" or "render", and
 * `payload` the input text, the table's JSON or the render request's JSON.
 * Answers the response's payload as a string — the table's JSON for a
 * parse, the output for a print or a render ("true"/"false" for
 * spells_autolink) — and throws the language's refusal.
 */
export function invoke(lang, op, row, features, payload) {
  const call = Object.freeze({ row, features: Object.freeze([...features]) });
  switch (op) {
    case "parse": {
      const t = lang.parse(call, payload);
      if (t === null || typeof t !== "object") throw new Error("parse returned no node table");
      return JSON.stringify(t);
    }
    case "print": {
      if (typeof lang.print !== "function") throw new Error("this language does not print");
      const out = lang.print(call, JSON.parse(payload));
      if (typeof out !== "string") throw new Error("print returned no string");
      return out;
    }
    case "render": {
      const request = JSON.parse(payload);
      if (typeof lang.render !== "function") {
        // A language that prints spells a fragment with its print.
        if (request.which === "render_block" && typeof lang.print === "function") {
          return invoke(lang, "print", row, features, JSON.stringify(request.table));
        }
        throw new Error("this language has no `render` function");
      }
      const out = lang.render(call, request);
      if (request.which === "spells_autolink") return out ? "true" : "false";
      if (typeof out !== "string") throw new Error(`render ${request.which} returned no string`);
      return out;
    }
    default:
      throw new Error(`no operation \`${op}\``);
  }
}

/** One request line to one response line. Never throws. */
export function handle(lang, line) {
  try {
    const req = JSON.parse(line);
    const features = req.features ?? [];
    switch (req.op) {
      case "describe":
        return JSON.stringify({ ok: true, description: describe(lang) });
      case "parse":
        return `{"ok":true,"table":${invoke(lang, "parse", req.dialect, features, req.input)}}`;
      case "print":
        return JSON.stringify({ ok: true, output: invoke(lang, "print", req.dialect, features, JSON.stringify(req.table)) });
      case "render": {
        const { op: _op, dialect: _d, features: _f, ...request } = req;
        const out = invoke(lang, "render", req.dialect, features, JSON.stringify(request));
        return JSON.stringify({ ok: true, output: req.which === "spells_autolink" ? out === "true" : out });
      }
      default:
        return JSON.stringify({ ok: false, message: `no operation \`${req.op}\`` });
    }
  } catch (e) {
    return JSON.stringify({ ok: false, message: e instanceof Error ? e.message : String(e) });
  }
}

/** Under Node: answer the wire on stdin and stdout until stdin ends. */
export async function serve(lang) {
  const proc = globalThis.process;
  if (!proc) throw new Error("serve runs under Node; twig-quickjs serves a module itself");
  const { createInterface } = await import("node:readline");
  const lines = createInterface({ input: proc.stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    if (line.trim() === "") continue;
    proc.stdout.write(handle(lang, line) + "\n");
  }
}

function string(v, label) {
  if (typeof v !== "string") throw new Error(`${label} is not a string`);
  return v;
}

function strings(v, label) {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.some((s) => typeof s !== "string")) throw new Error(`${label} is not an array of strings`);
  return v;
}
