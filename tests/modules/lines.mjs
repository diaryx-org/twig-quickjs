// A language of lines, small enough to read at a glance and complete enough
// to cross every tier: each non-empty line is a paragraph of one `str`. It
// prints back one line per paragraph, and authors with a renderer that
// spells a literal as itself.
//
// Two features: `crlf` prints `\r\n` line ends, which the parse reads back
// the same; `loud` gives every paragraph the class `loud`, and requires
// `crlf`, so a row with `loud` on prints `\r\n` too. The set `js-lines-loud`
// is a row of its own with `loud` on.
import { offsets, table } from "twig";

export default {
  name: "js-lines",
  extensions: ["jslines"],
  caps: { read: true, write: true, author: true },
  syntax: { renderers: ["render_text"] },
  features: [
    { name: "crlf", default: false, requires: [] },
    { name: "loud", default: false, requires: ["crlf"] },
  ],
  sets: [{ name: "js-lines-loud", extensions: ["jsloud"], features: ["loud"] }],
  samples: ["one\ntwo\n", "x\n", { text: "Loud\n", features: ["loud"] }],

  parse(call, input) {
    if (input.includes("\0")) throw new Error("a NUL byte is not a line");
    const at = offsets(input).at;
    const loud = call.features.includes("loud") ? [{ key: "class", value: "loud" }] : null;
    const t = table();
    const doc = t.row("doc", null, { span: [0, at(input.length)] });
    let start = 0;
    for (const line of input.split("\n")) {
      const text = line.replace(/\r$/, "");
      if (text !== "") {
        const span = [at(start), at(start + text.length)];
        const para = t.row("para", doc, { span, attrs: loud });
        t.row("str", para, { span, text });
      }
      start += line.length + 1;
    }
    return t;
  },

  print(call, t) {
    const end = call.features.includes("crlf") ? "\r\n" : "\n";
    return t.nodes
      .filter((n) => n.kind === "str")
      .map((n) => n.text + end)
      .join("");
  },

  render(_call, request) {
    if (request.which === "render_text") return request.text;
    throw new Error(`js-lines names no renderer ${request.which}`);
  },
};
