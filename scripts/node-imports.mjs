// Run a module written for twig-quickjs under Node: a loader hook that
// resolves the names the binary serves — `twig`, `twig/wire`,
// `twig/languages/<name>` and `@djot/djot` — to the files in this
// repository's `js/` that it serves them from.
//
//   node --import ./scripts/node-imports.mjs my-test.mjs
import { register } from "node:module";

const js = new URL("../js/", import.meta.url).href;
register(
  "data:text/javascript," +
    encodeURIComponent(`
const JS = ${JSON.stringify(js)};
const MAP = { "twig": "twig.js", "twig/wire": "wire.js", "@djot/djot": "djot/djot.js" };
export async function resolve(specifier, context, next) {
  if (Object.hasOwn(MAP, specifier)) return next(JS + MAP[specifier], context);
  if (specifier.startsWith("twig/languages/")) return next(JS + "languages/" + specifier.slice(15) + ".js", context);
  return next(specifier, context);
}
`),
  import.meta.url,
);
