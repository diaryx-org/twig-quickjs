#!/bin/sh
# Refresh `js/djot/` from `@djot/djot`, John MacFarlane's djot.js, as npm
# publishes it: the package's `lib/*.js` — CommonJS, one file per module —
# wrapped into a single ES module that QuickJS can import, with the
# package's LICENSE beside it and `VERSION` saying which release it is.
# djot.js is where the parser is written and tested; this repository serves
# it from the binary and edits none of it.
#
# And `tests/corpus/` from the same release's repository: djot.js's own test
# corpus, `test/*.test`, which the package does not ship — the documents the
# twin is held to the compiled djot over.
#
#   sh scripts/vendor-djot.sh                      # fetch the pinned release
#   sh scripts/vendor-djot.sh 0.3.2                # fetch another release
#   sh scripts/vendor-djot.sh path/to/package      # an unpacked tarball (no corpus)
#
# Then `cargo test`: the twin's tests are what notice a release that parses
# a document differently from the compiled djot.
set -eu

root="$(cd "$(dirname "$0")/.." && pwd)"
arg="${1:-0.3.2}"
scratch="$(mktemp -d "${TMPDIR:-/tmp}/agent-vendor-djot-XXXX")"
trap 'rm -rf "$scratch"' EXIT

if [ -d "$arg" ]; then
    pkg="$arg"
    source="$arg"
else
    url="https://registry.npmjs.org/@djot/djot/-/djot-$arg.tgz"
    curl -fsSL -o "$scratch/djot.tgz" "$url"
    tar xzf "$scratch/djot.tgz" -C "$scratch"
    pkg="$scratch/package"
    source="$url"
fi

for f in "$pkg/package.json" "$pkg/LICENSE" "$pkg/lib/index.js" "$pkg/lib/parse.js"; do
    [ -f "$f" ] || { echo "vendor-djot: $f not found — is $pkg the @djot/djot package?" >&2; exit 1; }
done
version="$(sed -n 's/^  "version": "\(.*\)",$/\1/p' "$pkg/package.json")"

out="$root/js/djot/djot.js"
mkdir -p "$root/js/djot"
{
    printf '%s\n' "// @djot/djot $version (djot.js, by John MacFarlane), vendored by"
    printf '%s\n' "// scripts/vendor-djot.sh from $source."
    printf '%s\n' "// MIT; see LICENSE beside this file. Generated — edit nothing here."
    printf '%s\n' "//"
    printf '%s\n' "// The package's lib/*.js, as published, each wrapped in a function"
    printf '%s\n' "// taking CommonJS's (exports, require, module), and the whole made one ES"
    printf '%s\n' "// module whose exports are the package's. cli.js, the command line, is"
    printf '%s\n' "// left out: it is the one file that needs Node."
    printf '%s\n' "const files = {"
    for f in "$pkg"/lib/*.js; do
        name="$(basename "$f" .js)"
        [ "$name" = cli ] && continue
        printf '"./%s": function (exports, require, module) {\n' "$name"
        cat "$f"
        printf '\n},\n'
    done
    printf '%s\n' "};"
    cat <<'EOF'
const loaded = {};
function require(name) {
  const key = name.replace(/\.js$/, "");
  if (Object.prototype.hasOwnProperty.call(loaded, key)) return loaded[key].exports;
  const file = files[key];
  if (!file) throw new Error(`@djot/djot: no module ${name} is vendored`);
  const module = { exports: {} };
  loaded[key] = module;
  file(module.exports, require, module);
  return module.exports;
}
const djot = require("./index");
export const {
  parse, renderAST, parseEvents, renderHTML, HTMLRenderer, applyFilter,
  fromPandoc, toPandoc, renderDjot, version, isBlock, isInline,
} = djot;
// The package's internal modules, for what its index does not export
// (`./attributes`'s AttributeParser, say).
export const internal = (name) => require(name);
export default djot;
EOF
} > "$out"

cp "$pkg/LICENSE" "$root/js/djot/LICENSE"
printf '%s\n' "$version" > "$root/js/djot/VERSION"
echo "vendor-djot: js/djot/ is @djot/djot $version"

# The corpus, from the release's tag. Not for a local package, which has
# no tag to name.
if [ ! -d "$arg" ]; then
    curl -fsSL -o "$scratch/repo.tgz" \
        "https://codeload.github.com/jgm/djot.js/tar.gz/refs/tags/@djot/djot@$version"
    mkdir -p "$scratch/repo"
    tar xzf "$scratch/repo.tgz" -C "$scratch/repo" --strip-components 1
    rm -rf "$root/tests/corpus"
    mkdir -p "$root/tests/corpus"
    cp "$scratch"/repo/test/*.test "$root/tests/corpus/"
    cp "$scratch/repo/LICENSE" "$root/tests/corpus/LICENSE"
    printf '%s\n' "$version" > "$root/tests/corpus/VERSION"
    echo "vendor-djot: tests/corpus/ is djot.js $version's test/*.test"
fi
