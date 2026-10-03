// @djot/djot 0.3.2 (djot.js, by John MacFarlane), vendored by
// scripts/vendor-djot.sh from https://registry.npmjs.org/@djot/djot/-/djot-0.3.2.tgz.
// MIT; see LICENSE beside this file. Generated — edit nothing here.
//
// The package's lib/*.js, as published, each wrapped in a function
// taking CommonJS's (exports, require, module), and the whole made one ES
// module whose exports are the package's. cli.js, the command line, is
// left out: it is the one file that needs Node.
const files = {
"./ast": function (exports, require, module) {
"use strict";
// Types defining the AST
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCaption = exports.isRow = exports.isBlock = exports.isInline = void 0;
/* Type predicates */
const blockTags = {
    para: true,
    heading: true,
    block_quote: true,
    thematic_break: true,
    section: true,
    div: true,
    code_block: true,
    raw_block: true,
    bullet_list: true,
    ordered_list: true,
    task_list: true,
    definition_list: true,
    table: true,
    reference: true,
    footnote: true
};
function isBlock(node) {
    return blockTags[node.tag] || false;
}
exports.isBlock = isBlock;
const inlineTags = {
    str: true,
    soft_break: true,
    hard_break: true,
    non_breaking_space: true,
    symb: true,
    verbatim: true,
    raw_inline: true,
    inline_math: true,
    display_math: true,
    url: true,
    email: true,
    footnote_reference: true,
    smart_punctuation: true,
    emph: true,
    strong: true,
    link: true,
    image: true,
    span: true,
    mark: true,
    superscript: true,
    subscript: true,
    insert: true,
    delete: true,
    double_quoted: true,
    single_quoted: true,
};
function isInline(node) {
    return inlineTags[node.tag] || false;
}
exports.isInline = isInline;
function isRow(node) {
    return ("head" in node);
}
exports.isRow = isRow;
function isCaption(node) {
    return (!("head" in node));
}
exports.isCaption = isCaption;

},
"./attributes": function (exports, require, module) {
"use strict";
/* Parser for attributes, implemented as a state machine.
 *
 * attributes { id = "foo", class = "bar baz",
 *              key1 = "val1", key2 = "val2" }
 * syntax:
 *
 * attributes <- '{' whitespace* attribute (whitespace attribute)* whitespace* '}'
 * attribute <- identifier | class | keyval
 * identifier <- '#' name
 * class <- '.' name
 * name <- (nonspace, nonpunctuation other than ':', '_', '-')+
 * keyval <- key '=' val
 * key <- (ASCII_ALPHANUM | ':' | '_' | '-')+
 * val <- bareval | quotedval
 * bareval <- (ASCII_ALPHANUM | ':' | '_' | '-')+
 * quotedval <- '"' ([^"] | '\"') '"'
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttributeParser = void 0;
// states
var State;
(function (State) {
    State[State["SCANNING"] = 0] = "SCANNING";
    State[State["SCANNING_ID"] = 1] = "SCANNING_ID";
    State[State["SCANNING_CLASS"] = 2] = "SCANNING_CLASS";
    State[State["SCANNING_KEY"] = 3] = "SCANNING_KEY";
    State[State["SCANNING_VALUE"] = 4] = "SCANNING_VALUE";
    State[State["SCANNING_BARE_VALUE"] = 5] = "SCANNING_BARE_VALUE";
    State[State["SCANNING_QUOTED_VALUE"] = 6] = "SCANNING_QUOTED_VALUE";
    State[State["SCANNING_QUOTED_VALUE_CONTINUATION"] = 7] = "SCANNING_QUOTED_VALUE_CONTINUATION";
    State[State["SCANNING_ESCAPED"] = 8] = "SCANNING_ESCAPED";
    State[State["SCANNING_ESCAPED_IN_CONTINUATION"] = 9] = "SCANNING_ESCAPED_IN_CONTINUATION";
    State[State["SCANNING_COMMENT"] = 10] = "SCANNING_COMMENT";
    State[State["FAIL"] = 11] = "FAIL";
    State[State["DONE"] = 12] = "DONE";
    State[State["START"] = 13] = "START";
})(State || (State = {}));
const reKeyChar = /^[a-zA-Z0-9_:-]/;
const isKeyChar = function (c) {
    return reKeyChar.exec(c) !== null;
};
const handlers = [];
handlers[State.START] = function (parser, pos) {
    if (parser.subject.charAt(pos) === '{') {
        return State.SCANNING;
    }
    else {
        return State.FAIL;
    }
};
handlers[State.FAIL] = function (parser, pos) {
    return State.FAIL;
};
handlers[State.DONE] = function (parser, pos) {
    return State.DONE;
};
handlers[State.SCANNING] = function (parser, pos) {
    const c = parser.subject.charAt(pos);
    if (c === '\n' || c === '\r') {
        return State.SCANNING;
    }
    else if (c === ' ' || c === '\t') {
        parser.addEvent(pos, pos, "attr_space");
        return State.SCANNING;
    }
    else if (c === '}') {
        return State.DONE;
    }
    else if (c === '#') {
        parser.begin = pos;
        parser.addEvent(pos, pos, "attr_id_marker");
        return State.SCANNING_ID;
    }
    else if (c === '%') {
        parser.begin = pos;
        return State.SCANNING_COMMENT;
    }
    else if (c === '.') {
        parser.begin = pos;
        parser.addEvent(pos, pos, "attr_class_marker");
        return State.SCANNING_CLASS;
    }
    else if (isKeyChar(c)) {
        parser.begin = pos;
        return State.SCANNING_KEY;
    }
    else {
        return State.FAIL;
    }
};
handlers[State.SCANNING_COMMENT] = function (parser, pos) {
    const c = parser.subject.charAt(pos);
    if (c === '%') {
        if (parser.begin && pos > parser.begin) {
            parser.addEvent(parser.begin, pos, "comment");
        }
        return State.SCANNING;
    }
    else if (c == '}') {
        return State.DONE;
    }
    else {
        return State.SCANNING_COMMENT;
    }
};
handlers[State.SCANNING_ID] = function (parser, pos) {
    const c = parser.subject.charAt(pos);
    if ((/^[^\]\[~!@#$%^&*(){}`,.<>\\|=+/?\s]/.exec(c) !== null)) {
        return State.SCANNING_ID;
    }
    else if (c === '}') {
        if (parser.begin && parser.lastpos && parser.lastpos > parser.begin) {
            parser.addEvent(parser.begin + 1, parser.lastpos, "id");
        }
        parser.begin = null;
        return State.DONE;
    }
    else if (/^\s/.exec(c) !== null) {
        if (parser.begin && parser.lastpos && parser.lastpos > parser.begin) {
            parser.addEvent(parser.begin + 1, parser.lastpos, "id");
        }
        if (!(c === '\r' || c === '\n')) {
            parser.addEvent(pos, pos, "attr_space");
        }
        parser.begin = null;
        return State.SCANNING;
    }
    else {
        return State.FAIL;
    }
};
handlers[State.SCANNING_CLASS] = function (parser, pos) {
    const c = parser.subject.charAt(pos);
    if ((/^\w/.exec(c) !== null) || c === '_' || c === '-' || c === ':') {
        return State.SCANNING_CLASS;
    }
    else if (c === '}') {
        if (parser.begin && parser.lastpos && parser.lastpos > parser.begin) {
            parser.addEvent(parser.begin + 1, parser.lastpos, "class");
        }
        parser.begin = null;
        return State.DONE;
    }
    else if (/^\s/.exec(c) !== null) {
        if (parser.begin && parser.lastpos && parser.lastpos > parser.begin) {
            parser.addEvent(parser.begin + 1, parser.lastpos, "class");
        }
        if (!(c === '\r' || c === '\n')) {
            parser.addEvent(pos, pos, "attr_space");
        }
        parser.begin = null;
        return State.SCANNING;
    }
    else {
        return State.FAIL;
    }
};
handlers[State.SCANNING_KEY] = function (parser, pos) {
    const c = parser.subject.charAt(pos);
    if (c === '=' && parser.begin && parser.lastpos) {
        parser.addEvent(parser.begin, parser.lastpos, "key");
        parser.addEvent(pos, pos, "attr_equal_marker");
        parser.begin = null;
        return State.SCANNING_VALUE;
    }
    else if (/^[a-zA-Z0-9_:-]/.exec(c) !== null) {
        return State.SCANNING_KEY;
    }
    else {
        return State.FAIL;
    }
};
handlers[State.SCANNING_VALUE] = function (parser, pos) {
    const c = parser.subject.charAt(pos);
    if (c === '"') {
        parser.begin = pos;
        parser.addEvent(pos, pos, "attr_quote_marker");
        return State.SCANNING_QUOTED_VALUE;
    }
    else if (/^[a-zA-Z0-9_:-]/.exec(c) !== null) {
        parser.begin = pos;
        return State.SCANNING_BARE_VALUE;
    }
    else {
        return State.FAIL;
    }
};
handlers[State.SCANNING_BARE_VALUE] = function (parser, pos) {
    const c = parser.subject.charAt(pos);
    if (/^[a-zA-Z0-9_:-]/.exec(c) !== null) {
        return State.SCANNING_BARE_VALUE;
    }
    else if (c === '}' && parser.begin && parser.lastpos) {
        parser.addEvent(parser.begin, parser.lastpos, "value");
        parser.begin = null;
        return State.DONE;
    }
    else if (/^\s/.exec(c) && parser.begin && parser.lastpos) {
        parser.addEvent(parser.begin, parser.lastpos, "value");
        if (!(c === '\r' || c === '\n')) {
            parser.addEvent(pos, pos, "attr_space");
        }
        parser.begin = null;
        return State.SCANNING;
    }
    else {
        return State.FAIL;
    }
};
handlers[State.SCANNING_ESCAPED] = function (parser, pos) {
    return State.SCANNING_QUOTED_VALUE;
};
handlers[State.SCANNING_ESCAPED_IN_CONTINUATION] = function (parser, pos) {
    return State.SCANNING_QUOTED_VALUE_CONTINUATION;
};
handlers[State.SCANNING_QUOTED_VALUE] = function (parser, pos) {
    const c = parser.subject.charAt(pos);
    if (c === '"' && parser.begin && parser.lastpos) {
        parser.addEvent(parser.begin + 1, parser.lastpos, "value");
        parser.addEvent(pos, pos, "attr_quote_marker");
        parser.begin = null;
        return State.SCANNING;
    }
    else if (c === "\n" && parser.begin && parser.lastpos) {
        parser.addEvent(parser.begin + 1, pos, "value");
        parser.begin = null;
        return State.SCANNING_QUOTED_VALUE_CONTINUATION;
    }
    else if (c === "\\") {
        return State.SCANNING_ESCAPED;
    }
    else {
        return State.SCANNING_QUOTED_VALUE;
    }
};
handlers[State.SCANNING_QUOTED_VALUE_CONTINUATION] = function (parser, pos) {
    const c = parser.subject.charAt(pos);
    if (parser.begin === null) {
        parser.begin = pos;
    }
    if (c === '"' && parser.begin && parser.lastpos) {
        parser.addEvent(pos, pos, "attr_quote_marker");
        parser.addEvent(parser.begin, parser.lastpos, "value");
        parser.begin = null;
        return State.SCANNING;
    }
    else if (c === "\n" && parser.begin && parser.lastpos) {
        parser.addEvent(parser.begin, pos, "value");
        parser.begin = null;
        return State.SCANNING_QUOTED_VALUE_CONTINUATION;
    }
    else if (c === "\\") {
        return State.SCANNING_ESCAPED_IN_CONTINUATION;
    }
    else {
        return State.SCANNING_QUOTED_VALUE_CONTINUATION;
    }
};
class AttributeParser {
    constructor(subject) {
        this.subject = subject;
        this.state = State.START;
        this.begin = null;
        this.lastpos = null;
        this.matches = [];
    }
    addEvent(startpos, endpos, annot) {
        this.matches.push({ startpos: startpos, endpos: endpos, annot: annot });
    }
    /* Feed parser a slice of text from the subject, between
     * startpos and endpos inclusive.  Return object with
     * status and position,
     * where status is either "done" (position should point to
     * final '}'), "fail" (position should point to first character
     * that could not be parsed), or "continue" (position should
     * point to last character parsed). */
    feed(startpos, endpos) {
        let pos = startpos;
        while (pos <= endpos) {
            this.state = handlers[this.state](this, pos);
            if (this.state === State.DONE) {
                return { status: "done", position: pos };
            }
            else if (this.state === State.FAIL) {
                this.lastpos = pos;
                return { status: "fail", position: pos };
            }
            else {
                this.lastpos = pos;
                pos = pos + 1;
            }
        }
        return { status: "continue", position: endpos };
    }
}
exports.AttributeParser = AttributeParser;

},
"./block": function (exports, require, module) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseEvents = void 0;
const options_1 = require("./options");
const attributes_1 = require("./attributes");
const find_1 = require("./find");
const inline_1 = require("./inline");
// Return array of list styles that match a marker.
// In ambiguous cases we return multiple values.
const getListStyles = function (marker) {
    if (marker === "+" || marker === "-" || marker === "*" || marker === ":") {
        return [marker];
    }
    else if (/^[+*-] \[[Xx ]\]/.exec(marker)) {
        return ["X"]; // task list
    }
    else if (/^[(]?[0-9]+[).]/.exec(marker)) {
        return [marker.replace(/[0-9]+/, "1")];
    }
    else if (/^[(]?[ivxlcdm][).]/.exec(marker)) {
        return [marker.replace(/[a-z]+/, "i"), marker.replace(/[a-z]+/, "a")];
    }
    else if (/^[(]?[IVXLCDM][).]/.exec(marker)) {
        return [marker.replace(/[A-Z]+/, "I"), marker.replace(/[A-Z]+/, "A")];
    }
    else if (/^[(]?[ivxlcdm]+[).]/.exec(marker)) {
        return [marker.replace(/[a-z]+/, "i")];
    }
    else if (/^[(]?[IVXLCDM]+[).]/.exec(marker)) {
        return [marker.replace(/[A-Z]+/, "I")];
    }
    else if (/^[(]?[a-z][).]/.exec(marker)) {
        return [marker.replace(/[a-z]/, "a")];
    }
    else if (/^[(]?[A-Z][).]/.exec(marker)) {
        return [marker.replace(/[A-Z]/, "A")];
    }
    else { // doesn't match any list style
        return [];
    }
};
const isSpaceOrTab = function (cp) {
    return (cp === 32 || cp === 9);
};
const isEolChar = function (cp) {
    return (cp === 10 || cp === 13);
};
const pattEndline = (0, find_1.pattern)("[ \\t]*\\r?\\n");
const pattWord = (0, find_1.pattern)("^\\w+\\s");
const pattWhitespace = (0, find_1.pattern)("[ \\t\\r\\n]");
const pattNonWhitespace = (0, find_1.pattern)("[^ \\t\\r\\n]+");
const pattBlockquotePrefix = (0, find_1.pattern)("[>][ \\t\\r\\n]");
const pattBangs = (0, find_1.pattern)("#+");
const pattCodeFence = (0, find_1.pattern)("(~~~~*|````*)([ \\t]*)([^ \\t\\r\\n`]*)[ \\t]*\\r?\\n");
const pattRowSep = (0, find_1.pattern)("(:?)--*(:?)([ \\t]*\\|[ \\t]*)");
const pattNextBarOrTicks = (0, find_1.pattern)("[^`|\\r\\n]*(?:[|]|`+)");
const pattCaptionStart = (0, find_1.pattern)("\\^[ \\t]+");
const pattFootnoteStart = (0, find_1.pattern)("\\[\\^([^\\]]+)\\]:[ \\t\\r\\n]");
const pattThematicBreak = (0, find_1.pattern)("[-*][ \t]*[-*][ \\t]*[-*][-* \\t]*\\r?\\n");
const pattDivFence = (0, find_1.pattern)("(::::*)[ \\t]*\\r?\\n");
const pattDivFenceStart = (0, find_1.pattern)("(::::*)[ \\t]*");
const pattDivFenceEnd = (0, find_1.pattern)("([\\w_-]*)[ \\t]*\\r?\\n");
const pattReferenceDefinition = (0, find_1.pattern)("\\[([^\\]\\r\\n]*)\\]:[ \\t]*([^ \\t\\r\\n]*)[\\r\\n]");
const pattTableRow = (0, find_1.pattern)("(\\|[^\\r\\n]*\\|)[ \\t]*\\r?\\n");
const pattListMarker = (0, find_1.pattern)("(:?[-*+:]|\\([0-9]+\\)|[0-9]+[.)]|[ivxlcdmIVXLCDM]+[.)]|\\([ivxlcdmIVXLCDM]+\\)|[a-zA-Z][.)]|\\([a-zA-Z]\\))[ \\t\\r\\n]");
const pattTaskListMarker = (0, find_1.pattern)("[*+-] \\[[Xx ]\\][ \\t\\r\\n]");
var ContentType;
(function (ContentType) {
    ContentType[ContentType["None"] = 0] = "None";
    ContentType[ContentType["Inline"] = 1] = "Inline";
    ContentType[ContentType["Block"] = 2] = "Block";
    ContentType[ContentType["Text"] = 3] = "Text";
    ContentType[ContentType["Cells"] = 4] = "Cells";
    ContentType[ContentType["Attributes"] = 5] = "Attributes";
    ContentType[ContentType["ListItem"] = 6] = "ListItem";
})(ContentType || (ContentType = {}));
class Container {
    constructor(spec, extra) {
        this.name = spec.name;
        this.type = spec.type;
        this.content = spec.content;
        this.continue = spec.continue;
        this.close = spec.close;
        this.indent = 0;
        this.inlineParser = null;
        this.attributeParser = null;
        this.extra = extra;
    }
}
class EventParser {
    constructor(subject, options = {}) {
        // Ensure the subject ends with a newline character
        if (subject.charAt(subject.length - 1) !== '\n') {
            subject = subject + "\n";
        }
        this.subject = subject;
        this.maxoffset = subject.length - 1;
        this.options = options;
        this.warn = options.warn || (() => { });
        this.indent = 0;
        this.startline = 0;
        this.starteol = 0;
        this.endeol = 0;
        this.matches = [];
        this.containers = [];
        this.pos = 0;
        this.lastMatchedContainer = 0;
        this.finishedLine = false;
        this.returned = 0;
        this.paraSpec =
            {
                name: "para",
                type: ContentType.Block,
                content: ContentType.Inline,
                continue: (container) => {
                    if (this.find(pattWhitespace) === null) {
                        return true;
                    }
                    else {
                        return false;
                    }
                },
                open: (spec) => {
                    this.addContainer(new Container(spec, {}));
                    this.addMatch(this.pos, this.pos, "+para");
                    return true;
                },
                close: () => {
                    this.getInlineMatches();
                    this.containers.pop();
                    const last = this.matches[this.matches.length - 1];
                    const ep = (last && last.endpos + 1) || this.pos;
                    this.addMatch(ep, ep, "-para");
                }
            };
        this.specs = [
            {
                name: "block_quote",
                type: ContentType.Block,
                content: ContentType.Block,
                continue: (container) => {
                    if (this.find(pattBlockquotePrefix) !== null) {
                        this.pos = this.pos + 1;
                        return true;
                    }
                    else {
                        return false;
                    }
                },
                open: (spec) => {
                    if (this.find(pattBlockquotePrefix) !== null) {
                        this.addContainer(new Container(spec, {}));
                        this.addMatch(this.pos, this.pos, "+block_quote");
                        this.pos = this.pos + 1;
                        return true;
                    }
                    else {
                        return false;
                    }
                },
                close: () => {
                    this.containers.pop();
                    this.addMatch(this.pos, this.pos, "-block_quote");
                }
            },
            {
                name: "heading",
                type: ContentType.Block,
                content: ContentType.Inline,
                continue: (container) => {
                    const m = this.find(pattBangs);
                    if (m && container.extra.level === (m.endpos - m.startpos + 1) &&
                        (0, find_1.find)(this.subject, pattWhitespace, m.endpos + 1)) {
                        this.pos = m.endpos + 1;
                        return true;
                    }
                    else {
                        return false;
                    }
                },
                open: (spec) => {
                    const m = this.find(pattBangs);
                    if (m && (0, find_1.find)(this.subject, pattWhitespace, m.endpos + 1)) {
                        const level = m.endpos - m.startpos + 1;
                        this.addContainer(new Container(spec, { level: level }));
                        this.addMatch(m.startpos, m.endpos, "+heading");
                        this.pos = m.endpos + 1;
                        return true;
                    }
                    else {
                        return false;
                    }
                },
                close: () => {
                    this.getInlineMatches();
                    this.containers.pop();
                    const last = this.matches[this.matches.length - 1];
                    const ep = (last && last.endpos + 1) || this.pos;
                    this.addMatch(ep, ep, "-heading");
                }
            },
            {
                name: "caption",
                type: ContentType.Block,
                content: ContentType.Inline,
                continue: (container) => {
                    return ((0, find_1.find)(this.subject, pattWhitespace, this.pos) === null);
                },
                open: (spec) => {
                    const m = this.find(pattCaptionStart);
                    if (m) {
                        this.pos = m.endpos + 1;
                        this.addContainer(new Container(spec, {}));
                        this.addMatch(this.pos, this.pos, "+caption");
                        return true;
                    }
                    else {
                        return false;
                    }
                },
                close: () => {
                    this.getInlineMatches();
                    this.containers.pop();
                    this.addMatch(this.pos - 1, this.pos - 1, "-caption");
                }
            },
            // should go before reference definitions
            {
                name: "footnote",
                type: ContentType.Block,
                content: ContentType.Block,
                continue: (container) => {
                    if (this.indent > (container.extra.indent || 0) ||
                        this.pos === this.starteol) {
                        return true;
                    }
                    else {
                        return false;
                    }
                },
                open: (spec) => {
                    const m = this.find(pattFootnoteStart);
                    if (m) {
                        const sp = m.startpos;
                        const ep = m.endpos;
                        const label = m.captures[0];
                        // adding container will close others
                        this.addContainer(new Container(spec, {
                            note_label: label,
                            indent: this.indent
                        }));
                        this.addMatch(sp, sp, "+footnote");
                        this.addMatch(sp + 2, ep - 3, "note_label");
                        this.pos = ep;
                        return true;
                    }
                    else {
                        return false;
                    }
                },
                close: () => {
                    this.containers.pop();
                    this.addMatch(this.pos, this.pos, "-footnote");
                }
            },
            {
                name: "reference_definition",
                type: ContentType.Block,
                content: ContentType.None,
                continue: (container) => {
                    if (container.extra.indent >= this.indent) {
                        return false;
                    }
                    const nws = this.find(pattNonWhitespace);
                    if (this.pos < this.starteol &&
                        nws && nws.endpos === this.starteol - 1) {
                        this.addMatch(this.pos, this.starteol - 1, "reference_value");
                        this.pos = this.starteol;
                        return true;
                    }
                    else {
                        return false;
                    }
                },
                open: (spec) => {
                    const m = this.find(pattReferenceDefinition);
                    if (m) {
                        const label = m.captures[0];
                        const value = m.captures[1];
                        this.addContainer(new Container(spec, { key: label, indent: this.indent }));
                        this.addMatch(m.startpos, m.startpos, "+reference_definition");
                        this.addMatch(m.startpos, m.startpos + label.length + 1, "reference_key");
                        if (value.length > 0) {
                            this.addMatch(this.starteol - value.length, this.starteol - 1, "reference_value");
                        }
                        this.pos = this.starteol - 1;
                        return true;
                    }
                    else {
                        return false;
                    }
                },
                close: () => {
                    this.containers.pop();
                    this.addMatch(this.pos, this.pos, "-reference_definition");
                }
            },
            // should go before list_item_spec
            {
                name: "thematic_break",
                type: ContentType.Block,
                content: ContentType.None,
                continue: (container) => {
                    return false;
                },
                open: (spec) => {
                    const m = this.find(pattThematicBreak);
                    if (m) {
                        this.addContainer(new Container(spec, {}));
                        this.addMatch(m.startpos, m.endpos, "thematic_break");
                        this.pos = m.endpos;
                        return true;
                    }
                    else {
                        return false;
                    }
                },
                close: () => {
                    this.containers.pop();
                }
            },
            {
                name: "list",
                type: ContentType.Block,
                content: ContentType.ListItem,
                continue: (container) => {
                    // TODO remove code duplication btw list and list_item
                    if (this.indent > container.extra.indent ||
                        this.pos === this.starteol) {
                        return true;
                    }
                    else { // match a list item of the correct type
                        const m = this.find(pattListMarker);
                        if (m === null) {
                            return false;
                        }
                        let marker = this.subject.substring(m.startpos, m.endpos);
                        const mtask = this.find(pattTaskListMarker);
                        if (mtask !== null) {
                            marker = this.subject.substring(mtask.startpos, mtask.startpos + 5);
                        }
                        const styles = getListStyles(marker);
                        const newstyles = [];
                        for (const style of container.extra.styles) {
                            if (styles.includes(style)) {
                                newstyles.push(style);
                            }
                        }
                        if (newstyles.length > 0) {
                            // narrow styles
                            container.extra.styles = newstyles;
                            return true;
                        }
                    }
                    return false;
                },
                open: (spec) => {
                    const m = this.find(pattListMarker);
                    if (m === null) {
                        return false;
                    }
                    const sp = m.startpos;
                    const ep = m.endpos;
                    let marker = this.subject.substring(sp, ep);
                    const mtask = this.find(pattTaskListMarker);
                    if (mtask !== null) {
                        marker = this.subject.substring(mtask.startpos, mtask.startpos + 5);
                    }
                    // some items have ambiguous style
                    const styles = getListStyles(marker);
                    if (styles.length === 0) {
                        return false;
                    }
                    const data = { styles: styles, indent: this.indent };
                    // adding container will close others
                    this.addContainer(new Container(spec, data));
                    let annot = "+list";
                    for (const style of styles) {
                        annot = annot + "|" + style;
                    }
                    this.addMatch(sp, ep - 1, annot);
                    return true;
                },
                close: () => {
                    this.containers.pop();
                    this.addMatch(this.pos, this.pos, "-list");
                }
            },
            {
                name: "list_item",
                type: ContentType.ListItem,
                content: ContentType.Block,
                continue: (container) => {
                    return (this.indent > container.extra.indent ||
                        this.pos === this.starteol);
                },
                open: (spec) => {
                    const m = this.find(pattListMarker);
                    if (m === null) {
                        return false;
                    }
                    const sp = m.startpos;
                    const ep = m.endpos;
                    let marker = this.subject.substring(sp, ep);
                    let checkbox = null;
                    const mtask = this.find(pattTaskListMarker);
                    if (mtask !== null) {
                        marker = this.subject.substring(mtask.startpos, mtask.startpos + 5);
                        checkbox = this.subject.substring(mtask.startpos + 3, mtask.startpos + 4);
                    }
                    // some items have ambiguous style
                    const styles = getListStyles(marker);
                    if (styles.length === 0) {
                        return false;
                    }
                    const data = { styles: styles, indent: this.indent };
                    // adding container will close others
                    this.addContainer(new Container(spec, data));
                    let annot = "+list_item";
                    for (const style of styles) {
                        annot = annot + "|" + style;
                    }
                    this.addMatch(sp, ep - 1, annot);
                    this.pos = ep;
                    if (checkbox) {
                        if (checkbox === " ") {
                            this.addMatch(sp + 2, sp + 4, "checkbox_unchecked");
                        }
                        else {
                            this.addMatch(sp + 2, sp + 4, "checkbox_checked");
                        }
                        this.pos = sp + 5;
                    }
                    return true;
                },
                close: () => {
                    this.containers.pop();
                    this.addMatch(this.pos - 1, this.pos - 1, "-list_item");
                }
            },
            {
                name: "table",
                type: ContentType.Block,
                content: ContentType.Cells,
                continue: (container) => {
                    const m = this.find(pattTableRow);
                    if (m) {
                        const rawrow = m.captures[0];
                        return this.parseTableRow(m.startpos, m.startpos + rawrow.length - 1);
                    }
                    else {
                        return false;
                    }
                },
                open: (spec) => {
                    const m = this.find(pattTableRow);
                    if (m) {
                        this.addContainer(new Container(spec, { columns: 0 }));
                        const rawrow = m.captures[0];
                        this.addMatch(m.startpos, m.startpos, "+table");
                        if (this.parseTableRow(m.startpos, m.startpos + rawrow.length - 1)) {
                            return true;
                        }
                        else {
                            this.matches.pop(); // remove "+table" match
                            this.containers.pop();
                            return false;
                        }
                    }
                    else {
                        return false;
                    }
                },
                close: () => {
                    this.containers.pop();
                    this.addMatch(this.pos, this.pos, "-table");
                }
            },
            {
                name: "attributes",
                type: ContentType.Block,
                content: ContentType.Attributes,
                open: (spec) => {
                    if (this.subject.codePointAt(this.pos) === 123) { // {
                        const attributeParser = new attributes_1.AttributeParser(this.subject);
                        const res = attributeParser.feed(this.pos, this.starteol);
                        if (res.status === "fail") {
                            return false;
                        }
                        else if (res.status === "done" &&
                            (0, find_1.find)(this.subject, pattEndline, res.position + 1)
                                === null) {
                            return false;
                        }
                        else {
                            const container = this.addContainer(new Container(spec, {
                                status: res.status,
                                indent: this.indent,
                                startpos: this.pos,
                                slices: []
                            }));
                            container.attributeParser = attributeParser;
                            container.extra.slices =
                                [{ startpos: this.pos, endpos: this.starteol }];
                            this.pos = this.starteol;
                            return true;
                        }
                    }
                    else {
                        return false;
                    }
                },
                continue: (container) => {
                    if (container.extra.status === "done") {
                        return false;
                    }
                    if (container.attributeParser && this.indent > container.extra.indent) {
                        container.extra.slices.push({
                            startpos: this.pos,
                            endpos: this.starteol
                        });
                        const res = container.attributeParser.feed(this.pos, this.endeol);
                        container.extra.status = res.status;
                        if (res.status !== "fail" ||
                            !(0, find_1.find)(this.subject, pattEndline, res.position + 1)) {
                            this.pos = this.starteol;
                            return true;
                        }
                    }
                    // if we get to here, we don't continue; either we
                    // reached the end of indentation or we failed in
                    // parsing attributes
                    // attribute parsing failed; convert to para and continue with that
                    this.addMatch(container.extra.startpos, container.extra.startpos, "+para");
                    const attrContainer = this.containers.pop(); // remove attribute contain
                    // add para container
                    const para = this.addContainer(new Container(this.paraSpec, {}));
                    // reparse the text we couldn't parse as a block attribute:
                    if (!para.inlineParser || !attrContainer) {
                        throw (new Error("Missing inlineParser or attrContainer"));
                        return false;
                    }
                    para.inlineParser.attributeSlices = attrContainer.extra.slices;
                    para.inlineParser.reparseAttributes();
                    this.pos = para.inlineParser.lastpos + 1;
                    return true;
                },
                close: () => {
                    const container = this.containers.pop();
                    if (!container)
                        return;
                    if (container.extra.status === "continue") {
                        // attribute parsing failed; convert to para
                        this.addMatch(container.extra.startpos, container.extra.startpos, "+para");
                        // add para container
                        const para = this.addContainer(new Container(this.paraSpec, {}), true);
                        if (!para || !para.inlineParser) {
                            throw (new Error("Could not add paragraph"));
                        }
                        // reparse the text we couldn't parse as a block attribute:
                        para.inlineParser.attributeSlices = container.extra.slices;
                        para.inlineParser.reparseAttributes();
                        para.close();
                    }
                    else {
                        this.addMatch(container.extra.startpos, container.extra.startpos, "+block_attributes");
                        if (container.attributeParser) { // should always be true
                            const attrMatches = container.attributeParser.matches;
                            for (const match of attrMatches) {
                                this.matches.push(match);
                            }
                        }
                        this.addMatch(this.pos, this.pos, "-block_attributes");
                    }
                }
            },
            {
                name: "fenced_div",
                type: ContentType.Block,
                content: ContentType.Block,
                continue: (container) => {
                    const tip = this.tip();
                    if (tip && tip.name === "code_block") {
                        return true; // see #109
                    }
                    const m = this.find(pattDivFence);
                    if (m && container.extra.colons) {
                        const colons = m.captures[0];
                        if (colons.length >= container.extra.colons) {
                            container.extra.endFenceStartpos = m.startpos;
                            container.extra.endFenceEndpos = m.startpos + colons.length - 1;
                            this.pos = m.endpos; // before newline
                            return false;
                        }
                    }
                    return true;
                },
                open: (spec) => {
                    const m = this.find(pattDivFenceStart);
                    if (!m) {
                        return false;
                    }
                    const colons = m.captures[0];
                    const m2 = (0, find_1.find)(this.subject, pattDivFenceEnd, m.endpos + 1);
                    if (!m2) {
                        return false;
                    }
                    const clsp = m2.startpos;
                    const lang = m2.captures[0];
                    this.addContainer(new Container(spec, { colons: colons.length }));
                    this.addMatch(m.startpos, m.endpos, "+div");
                    if (lang.length > 0) {
                        this.addMatch(clsp, clsp + lang.length - 1, "class");
                    }
                    this.pos = m2.endpos + 1;
                    this.finishedLine = true;
                    return true;
                },
                close: () => {
                    const container = this.containers.pop();
                    if (!container)
                        return;
                    const sp = container.extra.endFenceStartpos || this.pos;
                    const ep = container.extra.endFenceEndpos || this.pos;
                    // check to make sure the match is in order
                    this.addMatch(sp, ep, "-div");
                    if (sp === ep) {
                        this.warn(new options_1.Warning("Unclosed div", this.pos));
                    }
                }
            },
            {
                name: "code_block",
                type: ContentType.Block,
                content: ContentType.Text,
                continue: (container) => {
                    const m = this.find(container.extra.closePattern);
                    if (m) {
                        container.extra.endFenceStartpos = m.startpos;
                        container.extra.endFenceEndpos = m.startpos + m.captures[0].length - 1;
                        this.pos = m.endpos; // before newline
                        this.finishedLine = true;
                        return false;
                    }
                    else {
                        return true;
                    }
                },
                open: (spec) => {
                    const m = this.find(pattCodeFence);
                    if (m) {
                        const [border, ws, lang] = m.captures;
                        const isRaw = lang.charAt(0) === "=" && true || false;
                        const closePattern = (0, find_1.pattern)("(" + border +
                            border.substring(0, 1) + "*)[ \\t]*[\\r\\n]");
                        const cont = this.addContainer(new Container(spec, { closePattern: closePattern }));
                        cont.indent = this.indent;
                        this.addMatch(m.startpos, m.startpos + border.length - 1, "+code_block");
                        if (lang.length > 0) {
                            const langstart = m.startpos + border.length + ws.length;
                            if (isRaw) {
                                this.addMatch(langstart, langstart + lang.length - 1, "raw_format");
                            }
                            else {
                                this.addMatch(langstart, langstart + lang.length - 1, "code_language");
                            }
                        }
                        this.pos = m.endpos; // before newline;
                        this.finishedLine = true;
                        return true;
                    }
                    else {
                        return false;
                    }
                },
                close: () => {
                    const container = this.containers.pop();
                    if (!container)
                        return;
                    const sp = container.extra.endFenceStartpos || this.pos;
                    const ep = container.extra.endFenceEndpos || this.pos;
                    this.addMatch(sp, ep, "-code_block");
                    if (sp === ep) {
                        this.warn(new options_1.Warning("Unclosed code block", this.pos));
                    }
                }
            }
        ];
    }
    find(patt) {
        return (0, find_1.find)(this.subject, patt, this.pos);
    }
    tip() {
        if (this.containers.length >= 1) {
            return this.containers[this.containers.length - 1];
        }
        else {
            return null;
        }
    }
    addMatch(startpos, endpos, annot) {
        this.matches.push({
            startpos: Math.min(startpos, this.maxoffset),
            endpos: Math.min(endpos, this.maxoffset),
            annot: annot
        });
    }
    getInlineMatches() {
        var _a;
        const ilparser = (_a = this.tip()) === null || _a === void 0 ? void 0 : _a.inlineParser;
        if (ilparser) {
            let last;
            for (const match of ilparser.getMatches()) {
                if (last && last.annot === "str" && match.annot === "str" &&
                    match.startpos === last.endpos + 1) {
                    // just extend last str:
                    this.matches[this.matches.length - 1].endpos = match.endpos;
                }
                else {
                    this.matches.push(match);
                }
                last = match;
            }
        }
    }
    closeUnmatchedContainers() {
        const lastMatched = this.lastMatchedContainer;
        // close unmatched containers
        let tip = this.tip();
        while (tip &&
            this.containers.length - 1 > lastMatched) {
            tip.close();
            tip = this.tip();
        }
    }
    addContainer(container, skipCloseUnmatched) {
        if (!skipCloseUnmatched) {
            this.closeUnmatchedContainers();
        }
        // close containers that can't contain this one:
        let tip = this.tip();
        while (tip && tip.content !== container.type) {
            tip.close();
            tip = this.tip();
        }
        if (container.content === ContentType.Inline) {
            container.inlineParser =
                new inline_1.InlineParser(this.subject, { warn: this.warn });
        }
        this.containers.push(container);
        return container;
    }
    // move parser position to first nonspace, adjusting indent
    skipSpace() {
        const subject = this.subject;
        let newpos = this.pos;
        while (isSpaceOrTab(subject.codePointAt(newpos)))
            newpos++;
        this.indent = newpos - this.startline;
        this.pos = newpos;
    }
    // set this.starteol, this.endeol
    getEol() {
        const subject = this.subject;
        let i = this.pos;
        while (!isEolChar(subject.codePointAt(i))) {
            i++;
        }
        this.starteol = i;
        if (subject.codePointAt(i) === 13 && subject.codePointAt(i + 1) === 10) {
            this.endeol = i + 1;
        }
        else {
            this.endeol = i;
        }
    }
    parseTableCell() {
        const inlineParser = new inline_1.InlineParser(this.subject, { warn: this.warn });
        let cellComplete = false;
        const sp = this.pos - 1; // we start on char after |
        let ep = sp; // for now
        this.skipSpace();
        while (!cellComplete) {
            const m = this.find(pattNextBarOrTicks);
            if (m === null) {
                cellComplete = false;
                break;
            }
            else { // we matched a | or `+
                const nextbar = m.endpos;
                if (this.subject.charAt(nextbar) === "`" ||
                    inlineParser.inVerbatim()) {
                    inlineParser.feed(this.pos, nextbar);
                }
                else if (this.subject.charAt(nextbar - 1) === "\\") { // escaped |
                    inlineParser.feed(this.pos, nextbar);
                }
                else {
                    inlineParser.feed(this.pos, nextbar - 1);
                    ep = nextbar;
                    cellComplete = true;
                }
                this.pos = nextbar + 1;
            }
        }
        if (cellComplete) {
            const cellMatches = inlineParser.getMatches();
            return { startpos: sp, endpos: ep, matches: cellMatches };
        }
        else {
            return null;
        }
    }
    // Parameters are start and end position
    parseTableRow(sp, ep) {
        const origMatches = this.matches.length; // so we can rewind
        const startpos = this.pos;
        this.addMatch(sp, sp, "+row");
        // skip | and any initial space in the cell:
        this.pos++;
        // check to see if we have a separator line
        const seps = [];
        let p = this.pos;
        let sepfound = false;
        while (!sepfound) {
            const m = (0, find_1.find)(this.subject, pattRowSep, p);
            if (m !== null) {
                const [left, right, trailing] = m.captures;
                let st = "separator_default";
                if (left.length > 0 && right.length > 0) {
                    st = "separator_center";
                }
                else if (right.length > 0) {
                    st = "separator_right";
                }
                else if (left.length > 0) {
                    st = "separator_left";
                }
                seps.push({
                    startpos: m.startpos, endpos: m.endpos - trailing.length,
                    annot: st
                });
                p = m.endpos + 1;
                if (p === this.starteol) {
                    sepfound = true;
                    break;
                }
            }
            else {
                break;
            }
        }
        if (sepfound) {
            for (const match of seps) {
                this.addMatch(match.startpos, match.endpos, match.annot);
            }
            this.addMatch(this.starteol - 1, this.starteol - 1, "-row");
            this.pos = this.starteol;
            this.finishedLine = true;
            return true;
        }
        // if we get here, we're parsing a regular row
        while (this.pos <= ep) {
            const cell = this.parseTableCell();
            if (cell !== null) {
                // add matches for cell
                this.addMatch(cell.startpos, cell.startpos, "+cell");
                const cellMatches = cell.matches;
                cellMatches.forEach((match, i) => {
                    const s = match.startpos;
                    let e = match.endpos;
                    if (i === cellMatches.length - 1 && match.annot === "str") {
                        // strip trailing space
                        while (this.subject.codePointAt(e) === 32 && e >= s) {
                            e = e - 1;
                        }
                    }
                    this.addMatch(s, e, match.annot);
                });
                this.addMatch(cell.endpos, cell.endpos, "-cell");
            }
            else {
                // rewind, this is not a valid table row
                this.pos = startpos;
                while (this.matches.length > origMatches) {
                    this.matches.pop();
                }
                return false;
            }
        }
        // if we get here, we've parsed a table row
        this.addMatch(this.pos, this.pos, "-row");
        this.pos = this.starteol;
        this.finishedLine = true;
        return true;
    }
    // Returns an iterator over events.  At each iteration, the iterator
    // returns three values: start byte position, end byte position,
    // and annotation.
    [Symbol.iterator]() {
        const specs = this.specs;
        const subjectlen = this.subject.length;
        this.returned = 0;
        const self = this;
        return {
            next() {
                while (self.pos < subjectlen) {
                    // return any accumulated matches
                    if (self.matches.length > 0 && self.returned < self.matches.length) {
                        self.returned = self.returned + 1;
                        return {
                            value: self.matches[self.returned - 1],
                            done: false
                        };
                    }
                    self.indent = 0;
                    self.startline = self.pos;
                    self.finishedLine = false;
                    self.getEol();
                    // check open containers for continuation
                    self.lastMatchedContainer = -1;
                    let idx = 0;
                    while (idx < self.containers.length) {
                        const container = self.containers[idx];
                        // skip any indentation
                        self.skipSpace();
                        if (container.continue(container)) {
                            self.lastMatchedContainer = idx;
                        }
                        else {
                            break;
                        }
                        idx = idx + 1;
                    }
                    // if we hit a close fence, we can move to next line
                    if (self.finishedLine) {
                        while (self.containers.length > 0 &&
                            self.lastMatchedContainer < self.containers.length - 1) {
                            const tip = self.tip();
                            if (tip) {
                                tip.close();
                            }
                        }
                    }
                    if (!self.finishedLine) {
                        // check for new containers
                        self.skipSpace();
                        let isBlank = (self.pos === self.starteol);
                        let newStarts = false;
                        let lastMatch = self.containers[self.lastMatchedContainer];
                        let checkStarts = !isBlank &&
                            (!lastMatch ||
                                lastMatch.content === ContentType.Block ||
                                lastMatch.content === ContentType.ListItem) &&
                            !self.find(pattWord); // optimization
                        while (checkStarts) {
                            checkStarts = false;
                            for (const spec of specs) {
                                if ((!lastMatch && spec.type === ContentType.Block) ||
                                    (lastMatch && lastMatch.content === spec.type)) {
                                    if (spec.open(spec)) {
                                        const tip = self.tip();
                                        if (tip) {
                                            self.lastMatchedContainer = self.containers.length - 1;
                                            lastMatch = self.containers[self.lastMatchedContainer];
                                            if (self.finishedLine) {
                                                checkStarts = false;
                                            }
                                            else {
                                                self.skipSpace();
                                                newStarts = true;
                                                checkStarts = spec.content === ContentType.Block ||
                                                    spec.content === ContentType.ListItem;
                                            }
                                        }
                                        else {
                                            throw (new Error("No tip after opening container"));
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                        if (!self.finishedLine) {
                            // handle remaining content
                            self.skipSpace();
                            isBlank = (self.pos === self.starteol);
                            let tip = self.tip();
                            const isLazy = !isBlank &&
                                !newStarts &&
                                self.lastMatchedContainer < self.containers.length - 1 &&
                                tip &&
                                tip.content === ContentType.Inline;
                            if (!isLazy) {
                                self.closeUnmatchedContainers();
                            }
                            tip = self.tip();
                            // add para by default if there's text
                            if (!tip || tip.content === ContentType.Block) {
                                if (isBlank) {
                                    if (!newStarts) {
                                        // need to track these for tight/loose lists
                                        self.addMatch(self.pos, self.endeol, "blankline");
                                    }
                                }
                                else {
                                    self.paraSpec.open(self.paraSpec);
                                    tip = self.tip();
                                    if (tip) {
                                        tip.inlineParser = new inline_1.InlineParser(self.subject, self.options);
                                    }
                                }
                            }
                            if (tip && tip.content === ContentType.Text) {
                                let startpos = self.pos;
                                if (tip.indent !== null && self.indent > tip.indent) {
                                    // get back the leading spaces we gobbled
                                    startpos = startpos - (self.indent - tip.indent);
                                }
                                self.addMatch(startpos, self.endeol, "str");
                            }
                            else if (tip && tip.content === ContentType.Inline &&
                                !isBlank && tip.inlineParser) {
                                tip.inlineParser.feed(self.pos, self.endeol);
                            }
                        }
                    }
                    self.pos = (self.endeol || self.pos) + 1;
                }
                // close all remaining containers
                self.lastMatchedContainer = -1;
                self.closeUnmatchedContainers();
                // return any accumulated matches
                if (self.matches.length > 0 && self.returned < self.matches.length) {
                    self.returned = self.returned + 1;
                    return { value: self.matches[self.returned - 1], done: false };
                }
                // catch-all (should not be needed)
                return {
                    value: { startpos: self.pos, endpos: self.pos, annot: "" },
                    done: true
                };
            }
        };
    }
}
const parseEvents = function (input, options = {}) {
    return new EventParser(input, options);
};
exports.parseEvents = parseEvents;

},
"./djot-renderer": function (exports, require, module) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderDjot = void 0;
const ast_1 = require("./ast");
const parse_1 = require("./parse");
const isWhitespace = function (node) {
    const tag = node.tag;
    return (tag === "space" || tag === "soft_break" || tag === "hard_break");
};
const beginsWithWhitespace = function (node) {
    return (node.children[0] && isWhitespace(node.children[0]));
};
const endsWithWhitespace = function (node) {
    return (node.children[0] &&
        isWhitespace(node.children[node.children.length - 1]));
};
const verbatimDelim = function (node, minticks) {
    const backtickGroups = node.text.match(/(`+)/g);
    const backtickGroupLens = {};
    if (backtickGroups) {
        for (const i in backtickGroups) {
            backtickGroupLens[backtickGroups[i].length] = true;
        }
    }
    let numticks = minticks;
    while (backtickGroupLens[numticks]) {
        numticks++;
    }
    return "`".repeat(numticks);
};
const toRoman = function (x) {
    if (x < 0 || x >= 4000) {
        return "?";
    }
    let rom = "";
    while (x > 0) {
        if (x >= 1000) {
            rom += "M";
            x -= 1000;
        }
        else if (x >= 900) {
            rom += "CM";
            x -= 900;
        }
        else if (x >= 500) {
            rom += "D";
            x -= 500;
        }
        else if (x >= 400) {
            rom += "CD";
            x -= 400;
        }
        else if (x >= 100) {
            rom += "C";
            x -= 100;
        }
        else if (x >= 90) {
            rom += "XC";
            x -= 90;
        }
        else if (x >= 50) {
            rom += "L";
            x -= 50;
        }
        else if (x >= 40) {
            rom += "XL";
            x -= 40;
        }
        else if (x >= 10) {
            rom += "X";
            x -= 10;
        }
        else if (x == 9) {
            rom += "IX";
            x -= 9;
        }
        else if (x >= 5) {
            rom += "V";
            x -= 5;
        }
        else if (x == 4) {
            rom += "IV";
            x -= 4;
        }
        else if (x >= 1) {
            rom += "I";
            x -= 1;
        }
        else {
            throw (new Error("toRoman encountered x = " + x));
        }
    }
    return rom;
};
const formatNumber = function (num, style) {
    const delimPattern = style.replace(/[a-zA-Z0-9]+/g, "$");
    const numFormat = style.replace(/[.()]/g, "");
    let numStr;
    switch (numFormat) {
        case "1":
            numStr = num.toString();
            break;
        case "a":
            numStr = String.fromCodePoint(96 + (num % 26));
            break;
        case "A":
            numStr = String.fromCodePoint(64 + (num % 26));
            break;
        case "i":
            numStr = toRoman(num).toLowerCase();
            break;
        case "I":
            numStr = toRoman(num);
            break;
        default:
            throw (new Error("formatNumber encountered unknown style " + style));
    }
    return delimPattern.replace("$", numStr);
};
class DjotRenderer {
    constructor(doc, options = {}) {
        this.prefixes = [];
        this.buffer = [];
        this.startOfLine = true;
        this.endOfPrefix = 0;
        this.column = 0;
        this.needsBlankLine = false;
        this.handlers = {
            doc: (node) => {
                this.renderChildren(node.children);
                this.prefixes = [];
                this.cr();
                const hasReferences = Object.keys(node.references).length > 0;
                if (hasReferences) {
                    this.cr();
                    this.newline();
                }
                for (const k in node.references) {
                    this.renderNode(node.references[k]);
                }
                const hasFootnotes = Object.keys(node.footnotes).length > 0;
                for (const k in node.footnotes) {
                    this.renderNode(node.footnotes[k]);
                }
                this.prefixes = [];
                this.cr();
            },
            footnote: (node) => {
                this.lit("[^" + node.label + "]:");
                this.space();
                this.needsBlankLine = false;
                this.prefixes.push("  ");
                this.renderChildren(node.children);
                this.prefixes.pop();
                this.blankline();
            },
            reference: (node) => {
                this.lit("[");
                this.lit(node.label);
                this.lit("]:");
                this.prefixes.push("  ");
                this.space();
                this.lit(node.destination);
                this.wrap();
                this.prefixes.pop();
                this.blankline();
            },
            para: (node) => {
                this.renderChildren(node.children);
                this.blankline();
            },
            thematic_break: () => {
                this.lit("* * * * *");
                this.blankline();
            },
            div: (node) => {
                this.lit(":::");
                this.cr();
                this.renderChildren(node.children);
                this.cr();
                this.lit(":::");
                this.blankline();
            },
            heading: (node) => {
                const hashes = "#".repeat(node.level);
                this.lit(hashes + " ");
                this.prefixes.push(hashes + " ");
                this.renderChildren(node.children);
                this.prefixes.pop();
                this.blankline();
            },
            block_quote: (node) => {
                this.prefixes.push("> ");
                this.lit("> ");
                this.renderChildren(node.children);
                this.prefixes.pop();
                this.blankline();
            },
            section: (node) => {
                this.renderChildren(node.children);
            },
            code_block: (node) => {
                const ticks = verbatimDelim(node, 3);
                this.lit(ticks);
                if (node.lang) {
                    this.lit(" " + node.lang);
                }
                this.cr();
                this.litlines(node.text);
                this.cr();
                this.lit(ticks);
                this.blankline();
            },
            raw_block: (node) => {
                const ticks = verbatimDelim(node, 3);
                this.lit(ticks);
                this.lit(" =" + node.format);
                this.cr();
                this.litlines(node.text);
                this.cr();
                this.lit(ticks);
                this.blankline();
            },
            definition_list: (node) => {
                const items = node.children;
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    if (i > 0) {
                        this.newline();
                    }
                    this.lit(":");
                    this.needsBlankLine = false;
                    this.space();
                    this.prefixes.push(" ".repeat(2));
                    this.renderChildren(item.children);
                    this.prefixes.pop();
                }
            },
            ordered_list: (node) => {
                const style = node.style;
                const start = node.start || 1;
                const items = node.children;
                const tight = node.tight;
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    if (i > 0) {
                        this.cr();
                        if (!tight) {
                            this.newline();
                        }
                    }
                    const marker = formatNumber(start + i, style);
                    this.lit(marker);
                    this.needsBlankLine = false;
                    this.space();
                    this.prefixes.push(" ".repeat(marker.length + 1));
                    this.renderChildren(item.children);
                    this.prefixes.pop();
                }
                if (tight) { // otherwise we already have a blankline
                    this.blankline();
                }
            },
            bullet_list: (node) => {
                const items = node.children;
                const tight = node.tight;
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    if (i > 0) {
                        this.cr();
                        if (!tight) {
                            this.newline();
                        }
                    }
                    const marker = node.style;
                    this.lit(marker);
                    this.needsBlankLine = false;
                    this.space();
                    this.prefixes.push(" ".repeat(marker.length + 1));
                    this.renderChildren(item.children);
                    this.prefixes.pop();
                }
                if (tight) { // otherwise we already have a blankline
                    this.blankline();
                }
            },
            task_list: (node) => {
                const items = node.children;
                const tight = node.tight;
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    if (i > 0) {
                        this.cr();
                        if (!tight) {
                            this.newline();
                        }
                    }
                    this.needsBlankLine = false;
                    this.lit(`- [${item.checkbox === "checked" ? "X" : " "}]`);
                    this.space();
                    this.prefixes.push(" ".repeat(6));
                    this.renderChildren(item.children);
                    this.prefixes.pop();
                }
                if (tight) { // otherwise we already have a blankline
                    this.blankline();
                }
            },
            term: (node) => {
                this.renderChildren(node.children);
                this.blankline();
            },
            definition: (node) => {
                this.renderChildren(node.children);
            },
            table: (node) => {
                const captions = node.children.filter(ast_1.isCaption);
                const rows = node.children.filter(ast_1.isRow);
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    // if last row was head and this is not, add separator line
                    if ("head" in row && !row.head && i > 0 &&
                        rows[i - 1].head) {
                        const lastRow = rows[i - 1];
                        for (let j = 0; j < lastRow.children.length; j++) {
                            if (j === 0) {
                                this.lit("|");
                            }
                            switch (lastRow && lastRow.children[j].align) {
                                case "left":
                                    this.lit(":--");
                                    break;
                                case "right":
                                    this.lit("--:");
                                    break;
                                case "center":
                                    this.lit(":-:");
                                    break;
                                default:
                                    this.lit("---");
                            }
                            this.lit("|");
                        }
                        this.cr();
                    }
                    // now add the proper row
                    for (let j = 0; j < row.children.length; j++) {
                        const cell = row.children[j];
                        if (j === 0) {
                            this.lit("|");
                        }
                        this.noWrap(() => {
                            // this awkward test is needed because a Caption can
                            // be a child of Table; revisit this?
                            if (cell.tag === "cell") {
                                this.renderChildren(cell.children);
                            }
                        });
                        this.lit("|");
                    }
                    this.cr();
                }
                if (captions.length > 0 && captions[0].children.length > 0) {
                    this.newline();
                    this.lit("^ ");
                    this.needsBlankLine = false;
                    this.prefixes.push("  ");
                    this.renderChildren(captions[0].children);
                    this.prefixes.pop();
                    this.blankline();
                }
                this.blankline();
            },
            str: (node) => {
                node.text.split(/  */).forEach((s, i) => {
                    if (i > 0) {
                        this.space();
                    }
                    this.out(s);
                });
            },
            space: () => { this.space(); },
            soft_break: () => { this.soft_break(); },
            smart_punctuation: (node) => { this.lit(node.text); },
            non_breaking_space: () => { this.lit("\\ "); },
            single_quoted: this.inlineContainer("'"),
            double_quoted: this.inlineContainer("\""),
            emph: this.inlineContainer("_"),
            strong: this.inlineContainer("*"),
            superscript: this.inlineContainer("^"),
            subscript: this.inlineContainer("~"),
            mark: this.inlineContainer("=", true),
            delete: this.inlineContainer("-", true),
            insert: this.inlineContainer("+", true),
            footnote_reference: (node) => {
                this.lit("[^" + node.text + "]");
            },
            symb: (node) => {
                this.lit(":" + node.alias + ":");
            },
            email: (node) => {
                this.lit("<" + node.text + ">");
            },
            url: (node) => {
                this.lit("<" + node.text + ">");
            },
            span: (node) => {
                this.lit("[");
                this.renderChildren(node.children);
                this.lit("]");
            },
            link: (node) => {
                this.lit("[");
                this.renderChildren(node.children);
                this.lit("]");
                if (node.reference) {
                    this.lit("[");
                    if (node.reference !== (0, parse_1.getStringContent)(node)) {
                        this.lit(node.reference);
                    }
                    this.lit("]");
                }
                else if (node.destination) {
                    this.lit("(");
                    this.lit(node.destination);
                    this.lit(")");
                }
                else { // should not happen
                    this.lit("()");
                }
            },
            image: (node) => {
                this.lit("![");
                this.renderChildren(node.children);
                this.lit("]");
                if (node.reference) {
                    this.lit("[");
                    if (node.reference !== (0, parse_1.getStringContent)(node)) {
                        this.lit(node.reference);
                    }
                    this.lit("]");
                }
                else if (node.destination) {
                    this.lit("(");
                    this.lit(node.destination);
                    this.lit(")");
                }
                else { // should not happen
                    this.lit("()");
                }
            },
            raw_inline: (node) => {
                this.verbatimNode(node);
                this.lit("{=" + node.format + "}");
            },
            verbatim: (node) => {
                this.verbatimNode(node);
            },
            inline_math: (node) => {
                this.lit("$");
                this.verbatimNode(node);
            },
            display_math: (node) => {
                this.lit("$$");
                this.verbatimNode(node);
            }
        };
        this.doc = doc;
        this.wrapWidth = (options === null || options === void 0 ? void 0 : options.wrapWidth) || 0;
    }
    escape(s) {
        s = s.replace(/([~`'"${}[\]^<>\\*_]|-(?=-)|!(=\[)|\.(?=\.))/g, "\\$1");
        if (this.column === 0 || this.column === this.endOfPrefix) {
            s = s.replace(/^#/, "\\#");
        }
        return s;
    }
    out(s) {
        this.lit(this.escape(s));
    }
    doBlankLines() {
        if (this.needsBlankLine) {
            this.cr();
            this.newline();
            this.needsBlankLine = false;
        }
    }
    lit(s) {
        this.buffer.push(s);
        this.column += s.length;
        this.startOfLine = false;
    }
    blankline() {
        this.needsBlankLine = true;
    }
    newline() {
        if (this.endOfPrefix === this.column) {
            // remove spaces after prefix
            while (/  *$|^$/.test(this.buffer[this.buffer.length - 1])) {
                this.buffer[this.buffer.length - 1] =
                    this.buffer[this.buffer.length - 1].replace(/  *$/, "");
                if (this.buffer[this.buffer.length - 1] === "") {
                    this.buffer.pop();
                }
            }
        }
        this.endOfPrefix = 0;
        this.column = 0;
        this.buffer.push("\n");
        if (this.prefixes.length > 0) {
            for (let i = 0, len = this.prefixes.length; i < len; i++) {
                this.buffer.push(this.prefixes[i]);
                this.column += this.prefixes[i].length;
            }
            this.endOfPrefix = this.column;
        }
        this.startOfLine = true;
    }
    cr() {
        if (!this.startOfLine) {
            this.newline();
        }
    }
    wrap() {
        if (this.wrapWidth <= 0) {
            return;
        }
        let idx = this.buffer.length - 1;
        if (!this.startOfLine && this.buffer.length > 0 &&
            this.column > this.wrapWidth) {
            // backup to last space:
            let lastbuff;
            while (idx >= 0) {
                lastbuff = this.buffer[idx];
                if (lastbuff === " ") {
                    break;
                }
                else if (/^[ \r\n]+$/.test(lastbuff)) { // e.g. indentation
                    return; // can't wrap
                }
                idx--;
            }
        }
        if (idx < this.buffer.length - 1) {
            const excessOnLine = this.buffer.splice(idx + 1);
            if (this.buffer[this.buffer.length - 1] === " ") {
                this.buffer.pop(); // pop space at end of line
            }
            // put the content on next line:
            this.newline();
            this.startOfLine = true;
            for (let i = 0; i < excessOnLine.length; i++) {
                this.buffer.push(excessOnLine[i]);
                this.column += excessOnLine[i].length;
                this.startOfLine = false;
            }
        }
    }
    space() {
        this.wrap();
        this.lit(" ");
    }
    soft_break() {
        if (this.wrapWidth === 0) {
            this.newline();
        }
        else {
            this.space();
        }
    }
    needsBraces(node) {
        return (beginsWithWhitespace(node) ||
            endsWithWhitespace(node) ||
            (this.buffer.length > 0 &&
                /\w$/.test(this.buffer[this.buffer.length - 1])));
    }
    noWrap(action) {
        const oldWrapWidth = this.wrapWidth;
        this.wrapWidth = -1; // no wrap + soft breaks are spaces
        action();
        this.wrapWidth = oldWrapWidth;
    }
    inlineContainer(delim, needsBraces) {
        const self = this;
        return function (node) {
            needsBraces = needsBraces || self.needsBraces(node);
            if (needsBraces)
                self.lit("{");
            self.lit(delim);
            self.renderChildren(node.children);
            self.lit(delim);
            if (needsBraces)
                self.lit("}");
        };
    }
    litlines(s) {
        const lns = s.split(/\r?\n/);
        if (lns[lns.length - 1] === "") {
            lns.pop();
        }
        for (const ln of lns) {
            this.lit(ln);
            this.cr();
        }
    }
    verbatimNode(node) {
        const ticks = verbatimDelim(node, 1);
        this.lit(ticks);
        if (/^`/.test(node.text)) {
            this.lit(" ");
        }
        this.lit(node.text);
        if (/`$/.test(node.text)) {
            this.lit(" ");
        }
        this.lit(ticks);
    }
    renderChildren(children) {
        for (let i = 0, len = children.length; i < len; i++) {
            this.renderNode(children[i]);
        }
        if (children[0] && !(0, ast_1.isBlock)(children[0])) {
            this.wrap();
        }
    }
    renderNode(node) {
        this.doBlankLines();
        const handler = this.handlers[node.tag];
        if (handler) {
            if (node.attributes && (0, ast_1.isBlock)(node)) {
                this.renderAttributes(node);
                this.cr();
            }
            handler(node);
            if (node.attributes && (0, ast_1.isInline)(node)) {
                this.renderAttributes(node);
            }
        }
        else {
            throw (new Error("No renderer defined for node type " + node.tag));
        }
    }
    renderAttributes(node) {
        if (!node.attributes || Object.keys(node.attributes).length === 0) {
            return;
        }
        const attr = node.attributes;
        this.lit("{");
        let isfirst = true;
        if ((0, ast_1.isBlock)(node)) {
            this.prefixes.push(" ");
        }
        for (const k in attr) {
            if (!isfirst) {
                this.space();
            }
            if (k === "id") {
                this.lit("#");
                this.lit(attr[k]);
            }
            else if (k === "class") {
                const classes = attr[k].split(/  */);
                for (let i = 0; i < classes.length; i++) {
                    if (i > 0) {
                        this.space();
                    }
                    this.lit(".");
                    this.lit(classes[i]);
                }
            }
            else {
                this.lit(k);
                this.lit("=\"");
                this.out(attr[k]);
                this.lit("\"");
            }
            isfirst = false;
        }
        if ((0, ast_1.isBlock)(node)) {
            this.prefixes.pop();
        }
        this.lit("}");
    }
    render() {
        this.renderNode(this.doc);
        return this.buffer.join("");
    }
}
const renderDjot = function (doc, options = {}) {
    return new DjotRenderer(doc, options).render();
};
exports.renderDjot = renderDjot;

},
"./event": function (exports, require, module) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

},
"./filter": function (exports, require, module) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyFilter = void 0;
class Walker {
    constructor(node) {
        this.finished = false;
        this.stack = [];
        this.enter = true;
        this.top = node;
        this.current = node;
    }
    walk(callback) {
        while (!this.finished) {
            callback(this); // apply the action to current this state
            const topStack = this.stack && this.stack[this.stack.length - 1];
            if (this.enter) {
                if ("children" in this.current &&
                    this.current.children.length > 0) {
                    // move to first child
                    this.stack.push({ node: this.current, childIndex: 0 });
                    this.current = this.current.children[0];
                    this.enter = true;
                }
                else {
                    // no children, set to exit
                    this.enter = false;
                }
            }
            else { // exit
                if (topStack) {
                    // try next sibling
                    topStack.childIndex++;
                    const nextChild = topStack.node.children[topStack.childIndex];
                    if (nextChild) {
                        this.current = nextChild;
                        this.enter = true;
                    }
                    else {
                        this.stack.pop();
                        // go up to parent
                        this.current = topStack.node;
                        this.enter = false;
                    }
                }
                else {
                    this.finished = true;
                }
            }
        }
    }
}
const applyFilterPartToNode = function (node, enter, filterpart) {
    if (!node || !node.tag) {
        throw (new Error("Filter called on a non-node."));
    }
    const trans = filterpart[node.tag];
    if (!trans) {
        return false;
    }
    let transform;
    if (enter) {
        if ("enter" in trans && trans.enter) {
            transform = trans.enter;
        }
    }
    else {
        if ("exit" in trans && trans.exit) {
            transform = trans.exit;
        }
        else {
            transform = trans;
        }
    }
    if (typeof transform === "function") {
        return transform(node);
    }
};
// Returns the node for convenience (but modifies it in place).
const traverse = function (node, filterpart) {
    new Walker(node).walk((walker) => {
        let result = applyFilterPartToNode(walker.current, walker.enter, filterpart);
        const stackTop = walker.stack[walker.stack.length - 1];
        if (typeof result === "object" && "stop" in result && result.stop) {
            result = result.stop;
            walker.enter = false; // set to exit, which stops traversal of children
        }
        if (result) {
            if (Array.isArray(result)) {
                if (stackTop) {
                    stackTop.node.children.splice(stackTop.childIndex, 1, ...result);
                    // next line is needed for cases where we delete an element
                    walker.current = stackTop.node.children[stackTop.childIndex];
                    // adjust childIndex to skip multiple items added;
                    if (result.length > 1) {
                        stackTop.childIndex += result.length - 1;
                    }
                }
                else {
                    throw (Error("Cannot replace top node with multiple nodes"));
                }
            }
            else if (typeof result === "object" && "tag" in result && result.tag) {
                if (stackTop) {
                    stackTop.node.children[stackTop.childIndex] = result;
                }
                else {
                    return result;
                }
            }
        }
    });
    return node;
};
// Apply a filter to a document.
const applyFilter = function (doc, filter) {
    const f = filter();
    let filterparts;
    if (Array.isArray(f)) {
        filterparts = f;
    }
    else {
        filterparts = [f];
    }
    for (const f of filterparts) {
        traverse(doc, f);
        for (const i in doc.footnotes) {
            traverse(doc.footnotes[i], f);
        }
        for (const i in doc.references) {
            traverse(doc.references[i], f);
        }
    }
};
exports.applyFilter = applyFilter;

},
"./find": function (exports, require, module) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.find = exports.pattern = void 0;
const pattern = function (patt) {
    return new RegExp(patt, 'yd');
};
exports.pattern = pattern;
const find = function (subject, patt, startpos, endpos) {
    patt.lastIndex = startpos;
    let subj;
    if (endpos !== undefined) {
        subj = subject.substring(0, endpos + 1);
    }
    else {
        subj = subject;
    }
    const result = patt.exec(subj);
    if (result !== null) {
        let idx = 1;
        const capts = [];
        if (result.indices.length > 1) {
            for (let i = 1; i < result.indices.length; i++) {
                const [sp, ep] = result.indices[i];
                capts.push(subj.substring(sp, ep));
            }
        }
        return { startpos: result.indices[0][0],
            endpos: result.indices[0][1] - 1,
            captures: capts };
    }
    else {
        return null;
    }
};
exports.find = find;

},
"./html": function (exports, require, module) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTMLRenderer = exports.renderHTML = void 0;
const parse_1 = require("./parse");
const options_1 = require("./options");
const reNeedsEscape = /[&<>]/;
const reNeedsEscapeAttr = /[&<>"]/;
class HTMLRenderer {
    constructor(options) {
        this.smartPunctuationMap = {
            right_single_quote: "’",
            left_single_quote: "‘",
            right_double_quote: "”",
            left_double_quote: "“",
            ellipses: "…",
            em_dash: "—",
            en_dash: "–"
        };
        this.warn = options.warn || (() => { });
        this.options = options || {};
        this.tight = false;
        this.footnoteIndex = {};
        this.nextFootnoteIndex = 1;
        this.references = {};
        this.autoReferences = {};
    }
    escape(s) {
        if (reNeedsEscape.test(s)) {
            return s
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
        }
        else {
            return s;
        }
    }
    escapeAttribute(s) {
        if (reNeedsEscapeAttr.test(s)) {
            return s
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;");
        }
        else {
            return s;
        }
    }
    renderAttributes(node, extraAttrs) {
        let result = "";
        if (extraAttrs) {
            for (const k in extraAttrs) {
                if (k === "class") {
                    let v = extraAttrs[k];
                    if (node.attributes && node.attributes.class) {
                        v = `${v} ${node.attributes.class}`;
                    }
                    result += ` ${k}="${this.escapeAttribute(v)}"`;
                }
                else {
                    result += ` ${k}="${this.escapeAttribute(extraAttrs[k])}"`;
                }
            }
        }
        const attributes = Object.assign(Object.assign({}, node.autoAttributes), node.attributes);
        if (attributes) {
            for (const k in attributes) {
                const v = attributes[k];
                if (!(k === "class" && extraAttrs && extraAttrs.class)) {
                    result += ` ${k}="${this.escapeAttribute(v)}"`;
                }
            }
        }
        if (node.pos) {
            const sp = node.pos.start;
            const ep = node.pos.end;
            result += ` data-startpos="${sp.line}:${sp.col}:${sp.offset}" data-endpos="${ep.line}:${ep.col}:${ep.offset}"`;
        }
        return result;
    }
    renderTag(tag, node, extraAttrs) {
        let attributes = "";
        if (node.attributes || node.autoAttributes || extraAttrs || node.pos) {
            attributes = this.renderAttributes(node, extraAttrs);
        }
        return `<${tag}${attributes}>`;
    }
    renderCloseTag(tag) {
        return `</${tag}>`;
    }
    inTags(tag, node, newlines, extraAttrs) {
        const afterOpenSpace = newlines >= 2 ? "\n" : "";
        const afterCloseSpace = newlines >= 1 ? "\n" : "";
        return `${this.renderTag(tag, node, extraAttrs)}${afterOpenSpace}${this.renderChildren(node)}</${tag}>${afterCloseSpace}`;
    }
    addBacklink(note, ident) {
        const backlink = `<a href="#fnref${ident}" role="doc-backlink">\u21A9\uFE0E</a>`;
        if (/\<\/p\>[\r\n]*$/.test(note)) {
            return note.replace(/\<\/p\>([\r\n]*)$/, backlink + "</p>$1");
        }
        else {
            return note + `<p>${backlink}</p>\n`;
        }
    }
    renderChildren(node) {
        let result = "";
        const oldtight = this.tight;
        if ("tight" in node) {
            this.tight = !!node.tight;
        }
        for (const child of node.children) {
            result += this.renderAstNode(child);
        }
        if ("tight" in node) {
            this.tight = oldtight;
        }
        return result;
    }
    renderAstNode(node) {
        var _a;
        const override = (_a = this.options.overrides) === null || _a === void 0 ? void 0 : _a[node.tag];
        if (override) {
            return override(node, this);
        }
        return this.renderAstNodeDefault(node);
    }
    renderNotes(notes) {
        let result = "";
        const orderedFootnotes = [];
        const renderedNotes = {};
        for (const k in notes) {
            renderedNotes[k] = this.renderChildren(notes[k]);
        }
        // now this.footnoteIndex includes notes only indexed in other notes (#37)
        for (const k in this.footnoteIndex) {
            const index = this.footnoteIndex[k];
            if (index) {
                orderedFootnotes[index] = renderedNotes[k];
            }
        }
        result += `<section role="doc-endnotes">\n<hr>\n<ol>\n`;
        for (let i = 1; i < orderedFootnotes.length; i++) {
            // note: there can be gaps in the sequence, so we
            // want to insert a dummy note in that case
            const note = orderedFootnotes[i] || "";
            result += `<li id="fn${i}">\n`;
            result += this.addBacklink(note, i);
            result += `</li>\n`;
        }
        result += `</ol>\n</section>\n`;
        return result;
    }
    renderAstNodeDefault(node) {
        var _a;
        switch (node.tag) {
            case "doc": {
                let result = "";
                result += this.renderChildren(node);
                if (this.nextFootnoteIndex > 1) {
                    // render notes
                    result += this.renderNotes(node.footnotes);
                }
                return result;
            }
            case "para": {
                if (this.tight) {
                    return `${this.renderChildren(node)}\n`;
                }
                else {
                    return this.inTags("p", node, 1);
                }
            }
            case "block_quote":
                return this.inTags("blockquote", node, 2);
            case "div":
                return this.inTags("div", node, 2);
            case "section":
                return this.inTags("section", node, 2);
            case "list_item":
                return this.inTags("li", node, 2);
            case "task_list_item":
                let result = "<li>\n";
                if (node.checkbox === "checked") {
                    result += '<input disabled="" type="checkbox" checked=""/>\n';
                }
                else {
                    result += '<input disabled="" type="checkbox"/>\n';
                }
                result += this.renderChildren(node);
                result += this.renderCloseTag("li");
                result += "\n";
                return result;
            case "definition_list_item":
                return this.renderChildren(node);
            case "definition":
                return this.inTags("dd", node, 2);
            case "term":
                return this.inTags("dt", node, 1);
            case "definition_list":
                return this.inTags("dl", node, 2);
            case "bullet_list":
                return this.inTags("ul", node, 2);
            case "task_list":
                return this.inTags("ul", node, 2, { class: "task-list" });
            case "ordered_list": {
                const extraAttr = {};
                if (node.start && node.start !== 1) {
                    extraAttr.start = node.start.toString();
                }
                if (node.style && !/1/.test(node.style)) {
                    extraAttr.type = node.style.replace(/[().]/g, "");
                }
                return this.inTags("ol", node, 2, extraAttr);
            }
            case "heading":
                return this.inTags(`h${node.level}`, node, 1);
            case "footnote_reference": {
                let result = "";
                const label = node.text;
                let index = this.footnoteIndex[label];
                if (!index) {
                    index = this.nextFootnoteIndex;
                    this.footnoteIndex[label] = index;
                    this.nextFootnoteIndex++;
                }
                result += this.renderTag("a", node, {
                    id: "fnref" + index,
                    href: "#fn" + index,
                    role: "doc-noteref"
                });
                result += "<sup>";
                result += this.escape(index.toString());
                result += "</sup></a>";
                return result;
            }
            case "table":
                return this.inTags("table", node, 2);
            case "caption": {
                let result = "";
                // AST always has at least a dummy caption, no
                // need to render that.
                if (node.children.length > 0) {
                    result += this.inTags("caption", node, 1);
                }
                return result;
            }
            case "row":
                return this.inTags("tr", node, 2);
            case "cell": {
                const cellAttr = {};
                if (node.align && node.align !== "default") {
                    cellAttr.style = `text-align: ${node.align};`;
                }
                return this.inTags(node.head ? "th" : "td", node, 1, cellAttr);
            }
            case "thematic_break": {
                let result = "";
                result += this.renderTag("hr", node);
                result += "\n";
                return result;
            }
            case "code_block": {
                let result = "";
                result += this.renderTag("pre", node);
                result += "<code";
                if (node.lang) {
                    result += ` class="language-${this.escapeAttribute(node.lang)}"`;
                }
                result += ">";
                result += this.escape(node.text);
                result += this.renderCloseTag("code");
                result += this.renderCloseTag("pre");
                result += "\n";
                return result;
            }
            case "raw_block": {
                let result = "";
                if (node.format === "html") {
                    result += node.text;
                }
                return result;
            }
            case "str": {
                if (node.attributes || node.autoAttributes) {
                    return `${this.renderTag("span", node)}${this.escape(node.text)}</span>`;
                }
                else {
                    return this.escape(node.text);
                }
            }
            case "smart_punctuation":
                return this.smartPunctuationMap[node.type] || node.text;
            case "double_quoted": {
                let result = "";
                result += this.smartPunctuationMap.left_double_quote || '"';
                result += this.renderChildren(node);
                result += this.smartPunctuationMap.right_double_quote || '"';
                return result;
            }
            case "single_quoted": {
                let result = "";
                result += this.smartPunctuationMap.left_single_quote || "'";
                result += this.renderChildren(node);
                result += this.smartPunctuationMap.right_single_quote || "'";
                return result;
            }
            case "symb":
                return this.escape(`:${node.alias}:`);
            case "inline_math": {
                let result = "";
                result += this.renderTag("span", node, { class: "math inline" });
                result += `\\(${this.escape(node.text)}\\)`;
                result += this.renderCloseTag("span");
                return result;
            }
            case "display_math": {
                let result = "";
                result += this.renderTag("span", node, { class: "math display" });
                result += `\\[${this.escape(node.text)}\\]`;
                result += this.renderCloseTag("span");
                return result;
            }
            case "verbatim": {
                let result = "";
                result += this.renderTag("code", node);
                result += this.escape(node.text);
                result += this.renderCloseTag("code");
                return result;
            }
            case "raw_inline": {
                let result = "";
                if (node.format === "html") {
                    result += node.text;
                }
                return result;
            }
            case "soft_break":
                return "\n";
            case "hard_break":
                return "<br>\n";
            case "non_breaking_space":
                return "&nbsp;";
            case "link":
            case "image": {
                const extraAttr = {};
                let dest = node.destination;
                if (node.reference) {
                    const ref = this.references[node.reference] || this.autoReferences[node.reference];
                    if (ref) {
                        dest = ref.destination;
                        if (node.tag === "image") {
                            extraAttr.alt = (0, parse_1.getStringContent)(node);
                            extraAttr.src = dest;
                        }
                        else {
                            extraAttr.href = dest;
                        }
                        if (ref.attributes) {
                            for (const k in ref.attributes) {
                                if (!node.attributes || !node.attributes[k]) {
                                    // attribs on link take priority over attribs on reference
                                    extraAttr[k] = ref.attributes[k];
                                }
                            }
                        }
                        if (ref.autoAttributes) {
                            for (const k in ref.autoAttributes) {
                                if (!node.autoAttributes || !node.autoAttributes[k]) {
                                    // attribs on link take priority over attribs on reference
                                    extraAttr[k] = ref.autoAttributes[k];
                                }
                            }
                        }
                    }
                    else {
                        this.warn(new options_1.Warning(`Reference ${JSON.stringify(node.reference)} not found`, (_a = node === null || node === void 0 ? void 0 : node.pos) === null || _a === void 0 ? void 0 : _a.end));
                    }
                }
                else {
                    if (node.tag === "image") {
                        extraAttr.alt = (0, parse_1.getStringContent)(node);
                        if (dest !== undefined) {
                            extraAttr.src = dest;
                        }
                    }
                    else {
                        if (dest !== undefined) {
                            extraAttr.href = dest;
                        }
                    }
                }
                if (node.tag === "image") {
                    return this.renderTag("img", node, extraAttr);
                }
                else {
                    return this.inTags("a", node, 0, extraAttr);
                }
            }
            case "url":
            case "email": {
                let result = "";
                const extraAttr = {};
                if (node.tag === "email") {
                    extraAttr.href = "mailto:" + node.text;
                }
                else {
                    extraAttr.href = node.text;
                }
                result += this.renderTag("a", node, extraAttr);
                result += this.escape(node.text);
                result += this.renderCloseTag("a");
                return result;
            }
            case "strong":
                return this.inTags("strong", node, 0);
            case "emph":
                return this.inTags("em", node, 0);
            case "span":
                return this.inTags("span", node, 0);
            case "mark":
                return this.inTags("mark", node, 0);
            case "insert":
                return this.inTags("ins", node, 0);
            case "delete":
                return this.inTags("del", node, 0);
            case "superscript":
                return this.inTags("sup", node, 0);
            case "subscript":
                return this.inTags("sub", node, 0);
            default:
                return "";
        }
    }
    render(doc) {
        this.references = doc.references;
        this.autoReferences = doc.autoReferences;
        return this.renderAstNode(doc);
    }
}
exports.HTMLRenderer = HTMLRenderer;
const renderHTML = function (ast, options = {}) {
    const renderer = new HTMLRenderer(options);
    return renderer.render(ast);
};
exports.renderHTML = renderHTML;

},
"./index": function (exports, require, module) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isInline = exports.isBlock = exports.version = exports.renderDjot = exports.toPandoc = exports.fromPandoc = exports.applyFilter = exports.HTMLRenderer = exports.renderHTML = exports.parseEvents = exports.renderAST = exports.parse = void 0;
var parse_1 = require("./parse");
Object.defineProperty(exports, "parse", { enumerable: true, get: function () { return parse_1.parse; } });
Object.defineProperty(exports, "renderAST", { enumerable: true, get: function () { return parse_1.renderAST; } });
var block_1 = require("./block");
Object.defineProperty(exports, "parseEvents", { enumerable: true, get: function () { return block_1.parseEvents; } });
var html_1 = require("./html");
Object.defineProperty(exports, "renderHTML", { enumerable: true, get: function () { return html_1.renderHTML; } });
Object.defineProperty(exports, "HTMLRenderer", { enumerable: true, get: function () { return html_1.HTMLRenderer; } });
var filter_1 = require("./filter");
Object.defineProperty(exports, "applyFilter", { enumerable: true, get: function () { return filter_1.applyFilter; } });
var pandoc_1 = require("./pandoc");
Object.defineProperty(exports, "fromPandoc", { enumerable: true, get: function () { return pandoc_1.fromPandoc; } });
Object.defineProperty(exports, "toPandoc", { enumerable: true, get: function () { return pandoc_1.toPandoc; } });
var djot_renderer_1 = require("./djot-renderer");
Object.defineProperty(exports, "renderDjot", { enumerable: true, get: function () { return djot_renderer_1.renderDjot; } });
var version_1 = require("./version");
Object.defineProperty(exports, "version", { enumerable: true, get: function () { return version_1.version; } });
var ast_1 = require("./ast");
Object.defineProperty(exports, "isBlock", { enumerable: true, get: function () { return ast_1.isBlock; } });
Object.defineProperty(exports, "isInline", { enumerable: true, get: function () { return ast_1.isInline; } });

},
"./inline": function (exports, require, module) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InlineParser = void 0;
const attributes_1 = require("./attributes");
const options_1 = require("./options");
const find_1 = require("./find");
const C_TAB = 9;
const C_LF = 10;
const C_CR = 13;
const C_SPACE = 32;
const C_BANG = 33;
const C_DOUBLE_QUOTE = 34;
const C_DOLLARS = 36;
const C_SINGLE_QUOTE = 39;
const C_LEFT_PAREN = 40;
const C_RIGHT_PAREN = 41;
const C_ASTERISK = 42;
const C_PLUS = 43;
const C_HYPHEN = 45;
const C_PERIOD = 46;
const C_COLON = 58;
const C_LESSTHAN = 60;
const C_EQUALS = 61;
const C_LEFT_BRACKET = 91;
const C_BACKSLASH = 92;
const C_RIGHT_BRACKET = 93;
const C_HAT = 94;
const C_UNDERSCORE = 95;
const C_BACKTICK = 96;
const C_LEFT_BRACE = 123;
const C_RIGHT_BRACE = 125;
const C_TILDE = 126;
const reSpecial = /[\r\n"'()*+.:<=[\\\]^_`${}~-]/g;
// find first special character starting from startpos, and not
// going beyond endpos, or null if none found.
const findSpecial = function (s, startpos, endpos) {
    reSpecial.lastIndex = startpos;
    const result = reSpecial.exec(s);
    if (result && result.index <= endpos) {
        return result.index;
    }
    else {
        return null;
    }
};
const pattNonspace = (0, find_1.pattern)("[^ \t\r\n]");
const pattLineEnd = (0, find_1.pattern)("[ \\t]*\\r?\\n");
const pattPunctuation = (0, find_1.pattern)("['!\"#$%&\\\\'()\\*+,\\-\\.\\/:;<=>?@\\[\\]\\^_`{|}~']");
const pattAutolink = (0, find_1.pattern)("\\<([^<>\\s]+)\\>");
const pattDelim = (0, find_1.pattern)("[_*~^+='\"-]");
const pattSymbol = (0, find_1.pattern)(":[\\w_+-]+:");
const pattTwoPeriods = (0, find_1.pattern)("\\.\\.");
const pattBackticks0 = (0, find_1.pattern)("`*");
const pattBackticks1 = (0, find_1.pattern)("`+");
const pattDoubleDollars = (0, find_1.pattern)("\\$\\$");
const pattSingleDollar = (0, find_1.pattern)("\\$");
const pattBackslash = (0, find_1.pattern)("\\\\");
const pattRawAttribute = (0, find_1.pattern)("\\{=[^\\s{}`]+\\}");
const pattNoteReference = (0, find_1.pattern)("\\^([^\\]]+)\\]");
const hasBrace = function (self, pos) {
    return ((pos > 0 && self.subject.codePointAt(pos - 1) === C_LEFT_BRACE) ||
        self.subject.codePointAt(pos + 1) === C_RIGHT_BRACE);
};
const alwaysTrue = function () { return true; };
const betweenMatched = function (c, annotation, defaultmatch, opentest) {
    return function (self, pos, endpos) {
        const subject = self.subject;
        let can_open = (0, find_1.find)(subject, pattNonspace, pos + 1) !== null &&
            opentest(self, pos);
        let can_close = (0, find_1.find)(subject, pattNonspace, pos - 1) !== null;
        const lastmatch = self.matches[self.matches.length - 1];
        const has_open_marker = lastmatch && lastmatch.annot === "open_marker";
        const has_close_marker = pos + 1 <= endpos &&
            subject.codePointAt(pos + 1) === C_RIGHT_BRACE;
        let endcloser = pos;
        let startopener = pos;
        // Allow explicit open/close markers to override:
        if (has_open_marker) {
            can_open = true;
            can_close = false;
            startopener = pos - 1;
        }
        if (!has_open_marker && has_close_marker) {
            can_close = true;
            can_open = false;
            endcloser = pos + 1;
        }
        if (has_open_marker && defaultmatch.match(/^right/)) {
            defaultmatch = defaultmatch.replace(/^right/, "left");
        }
        else if (has_close_marker && defaultmatch.match(/^left/)) {
            defaultmatch = defaultmatch.replace(/^left/, "right");
        }
        let d = c;
        if (has_close_marker) {
            d = "{" + d;
        }
        const openers = self.openers[d];
        if (can_close && openers && openers.length > 0) {
            // check openers for a match
            const opener = openers[openers.length - 1];
            if (opener.endpos !== pos - 1) { // exclude empty emph
                self.clearOpeners(opener.startpos, pos);
                self.addMatch(opener.startpos, opener.endpos, "+" + annotation, opener.matchIndex);
                self.addMatch(pos, endcloser, "-" + annotation);
                return endcloser + 1;
            }
        }
        // If we get here, we didn't match an opener:
        if (can_open) {
            let e = c;
            if (has_open_marker) {
                e = "{" + e;
            }
            self.addOpener(e, startopener, pos, defaultmatch);
            return pos + 1;
        }
        else {
            self.addMatch(pos, endcloser, defaultmatch);
            return endcloser + 1;
        }
    };
};
// handlers for specific code points:
const matchers = {
    [C_BACKTICK]: function (self, pos, endpos) {
        const subject = self.subject;
        const m = (0, find_1.find)(subject, pattBackticks0, pos, endpos);
        if (m === null) {
            return null;
        }
        const endchar = m.endpos;
        if ((0, find_1.find)(subject, pattDoubleDollars, pos - 2) &&
            !(0, find_1.find)(subject, pattBackslash, pos - 3)) {
            self.matches.pop(); // remove first $
            self.matches.pop(); // remove second $
            self.addMatch(pos - 2, endchar, "+display_math");
            self.verbatimType = "display_math";
        }
        else if ((0, find_1.find)(subject, pattSingleDollar, pos - 1)) {
            self.matches.pop(); // remove $
            self.addMatch(pos - 1, endchar, "+inline_math");
            self.verbatimType = "inline_math";
        }
        else {
            self.addMatch(pos, endchar, "+verbatim");
            self.verbatimType = "verbatim";
        }
        self.verbatim = endchar - pos + 1;
        return endchar + 1;
    },
    [C_BACKSLASH]: function (self, pos, endpos) {
        const subject = self.subject;
        const mLineEnd = (0, find_1.find)(subject, pattLineEnd, pos + 1, endpos);
        if (mLineEnd !== null) {
            // see if there were preceding spaces and remove them
            if (self.matches.length > 0) {
                const lastmatch = self.matches[self.matches.length - 1];
                if (lastmatch.annot === "str") {
                    let ep = lastmatch.endpos;
                    const sp = lastmatch.startpos;
                    while (ep >= sp &&
                        (subject.codePointAt(ep) === C_SPACE ||
                            subject.codePointAt(ep) === C_TAB)) {
                        ep = ep - 1;
                    }
                    if (ep < sp) {
                        self.matches.pop();
                    }
                    else {
                        lastmatch.endpos = ep;
                    }
                }
            }
            self.addMatch(pos, pos, "escape");
            self.addMatch(pos + 1, mLineEnd.endpos, "hard_break");
            return mLineEnd.endpos + 1;
        }
        else {
            const mPunct = (0, find_1.find)(subject, pattPunctuation, pos + 1, endpos);
            if (mPunct !== null) {
                self.addMatch(pos, pos, "escape");
                self.addMatch(mPunct.startpos, mPunct.endpos, "str");
                return mPunct.endpos + 1;
            }
            else if (pos + 1 <= endpos &&
                subject.codePointAt(pos + 1) === C_SPACE) {
                self.addMatch(pos, pos, "escape");
                self.addMatch(pos + 1, pos + 1, "non_breaking_space");
                return pos + 2;
            }
            else {
                self.addMatch(pos, pos, "str");
                return pos + 1;
            }
        }
    },
    [C_LESSTHAN]: function (self, pos, endpos) {
        const subject = self.subject;
        const m = (0, find_1.find)(subject, pattAutolink, pos, endpos);
        if (m === null) {
            return null;
        }
        const endurl = m.endpos;
        const starturl = m.startpos;
        const url = m.captures[0];
        if (url.match(/[^:]@/)) { // email
            self.addMatch(starturl, starturl, "+email");
            self.addMatch(starturl + 1, endurl - 1, "str");
            self.addMatch(endurl, endurl, "-email");
            return endurl + 1;
        }
        else if (url.match(/[a-zA-Z]:/)) { /// url
            self.addMatch(starturl, starturl, "+url");
            self.addMatch(starturl + 1, endurl - 1, "str");
            self.addMatch(endurl, endurl, "-url");
            return endurl + 1;
        }
        return null;
    },
    [C_TILDE]: betweenMatched('~', 'subscript', 'str', alwaysTrue),
    [C_HAT]: betweenMatched('^', 'superscript', 'str', alwaysTrue),
    [C_UNDERSCORE]: betweenMatched('_', 'emph', 'str', alwaysTrue),
    [C_ASTERISK]: betweenMatched('*', 'strong', 'str', alwaysTrue),
    [C_PLUS]: betweenMatched("+", "insert", "str", hasBrace),
    [C_EQUALS]: betweenMatched("=", "mark", "str", hasBrace),
    [C_SINGLE_QUOTE]: betweenMatched("'", "single_quoted", "right_single_quote", function (self, pos) {
        if (pos === 0) {
            return true;
        }
        else {
            const cp = self.subject.codePointAt(pos - 1);
            return (cp === C_SPACE ||
                cp === C_TAB ||
                cp === C_CR ||
                cp === C_LF ||
                cp === C_DOUBLE_QUOTE ||
                cp === C_SINGLE_QUOTE ||
                cp === C_HYPHEN ||
                cp === C_LEFT_PAREN ||
                cp === C_LEFT_BRACKET);
        }
    }),
    [C_DOUBLE_QUOTE]: betweenMatched('"', "double_quoted", "left_double_quote", alwaysTrue),
    [C_LEFT_BRACE]: function (self, pos, endpos) {
        if ((0, find_1.find)(self.subject, pattDelim, pos + 1, endpos)) {
            self.addMatch(pos, pos, "open_marker");
            return pos + 1;
        }
        else if (self.allowAttributes) {
            self.attributeParser = new attributes_1.AttributeParser(self.subject);
            self.attributeStart = pos;
            self.attributeSlices = [];
            return pos;
        }
        else {
            self.addMatch(pos, pos, "str");
            return pos + 1;
        }
    },
    [C_COLON]: function (self, pos, endpos) {
        const m = (0, find_1.find)(self.subject, pattSymbol, pos, endpos);
        if (m) {
            self.addMatch(m.startpos, m.endpos, "symb");
            return m.endpos + 1;
        }
        else {
            self.addMatch(pos, pos, "str");
            return pos + 1;
        }
    },
    [C_PERIOD]: function (self, pos, endpos) {
        if ((0, find_1.find)(self.subject, pattTwoPeriods, pos + 1, endpos)) {
            self.addMatch(pos, pos + 2, "ellipses");
            return pos + 3;
        }
        else {
            return null;
        }
    },
    [C_LEFT_BRACKET]: function (self, pos, endpos) {
        const m = (0, find_1.find)(self.subject, pattNoteReference, pos + 1, endpos);
        if (m) { // footnote ref
            self.addMatch(pos, m.endpos, "footnote_reference");
            return m.endpos + 1;
        }
        else {
            self.addOpener("[", pos, pos, "str");
            return pos + 1;
        }
    },
    [C_RIGHT_BRACKET]: function (self, pos, endpos) {
        const openers = self.openers["["];
        const subject = self.subject;
        if (openers && openers.length > 0) {
            const opener = openers[openers.length - 1];
            if (opener.annot === "reference_link") {
                // found a reference link
                // convert all matches inside reference to str
                self.strMatches((opener.subendpos || opener.endpos) + 1, pos - 1);
                // add the matches
                const isImage = subject.codePointAt(opener.startpos - 1) === C_BANG &&
                    subject.codePointAt(opener.startpos - 2) !== C_BACKSLASH;
                if (isImage) {
                    self.addMatch(opener.startpos - 1, opener.startpos - 1, "image_marker", opener.matchIndex - 1);
                    self.addMatch(opener.startpos, opener.endpos, "+imagetext", opener.matchIndex);
                    self.addMatch(opener.substartpos || opener.startpos, opener.substartpos || opener.startpos, "-imagetext", opener.subMatchIndex);
                }
                else {
                    self.addMatch(opener.startpos, opener.endpos, "+linktext", opener.matchIndex);
                    self.addMatch(opener.substartpos || opener.startpos, opener.substartpos || opener.startpos, "-linktext", opener.subMatchIndex);
                }
                self.addMatch(opener.subendpos || opener.endpos, opener.subendpos || opener.endpos, "+reference", opener.subMatchIndex + 1);
                self.addMatch(pos, pos, "-reference");
                // remove from openers
                self.clearOpeners(opener.startpos, pos);
                return pos + 1;
            }
            else if (pos + 1 <= endpos &&
                subject.codePointAt(pos + 1) === C_LEFT_BRACKET) {
                opener.annot = "reference_link";
                self.addMatch(pos, pos, "str");
                opener.subMatchIndex = self.matches.length - 1;
                self.addMatch(pos + 1, pos + 1, "str");
                opener.substartpos = pos; // intermediate ]
                opener.subendpos = pos + 1; // intermediate [
                // remove any openers between [ and ]
                self.clearOpeners(opener.startpos + 1, pos - 1);
                return pos + 2;
            }
            else if (pos + 1 <= endpos &&
                subject.codePointAt(pos + 1) === C_LEFT_PAREN) {
                self.openers["("] = []; // clear ( openers
                opener.annot = "explicit_link";
                self.addMatch(pos, pos, "str"); // ]
                opener.subMatchIndex = self.matches.length - 1;
                self.addMatch(pos + 1, pos + 1, "str"); // (
                opener.substartpos = pos; // intermediate ]
                opener.subendpos = pos + 1; // intermediate (
                self.destination = true;
                // remove any openers between [ and ]
                self.clearOpeners(opener.startpos + 1, pos - 1);
                return pos + 2;
            }
            else if (pos + 1 <= endpos &&
                subject.codePointAt(pos + 1) === C_LEFT_BRACE) {
                // assume this is attributes, bracketed span
                self.addMatch(opener.startpos, opener.endpos, "+span", opener.matchIndex);
                self.addMatch(pos, pos, "-span");
                // remove any openers between [ and ]
                self.clearOpeners(opener.startpos, pos);
                return pos + 1;
            }
        }
        return null;
    },
    [C_LEFT_PAREN]: function (self, pos, endpos) {
        if (!self.destination) {
            return null;
        }
        self.addOpener("(", pos, pos, "str");
        return pos + 1;
    },
    [C_RIGHT_PAREN]: function (self, pos, endpos) {
        if (!self.destination) {
            return null;
        }
        const parens = self.openers["("];
        if (parens && parens.length > 0) {
            parens.pop(); // clear opener
            self.addMatch(pos, pos, "str");
            return pos + 1;
        }
        else {
            const subject = self.subject;
            const openers = self.openers["["];
            const opener = openers[openers.length - 1];
            if (openers && openers.length > 0 && opener.annot === "explicit_link") {
                // we have inline link
                // convert all matches inside destination to str
                self.strMatches((opener.subendpos || opener.endpos) + 1, pos - 1);
                const isImage = subject.codePointAt(opener.startpos - 1) === C_BANG &&
                    subject.codePointAt(opener.startpos - 2) !== C_BACKSLASH;
                if (isImage) {
                    self.addMatch(opener.startpos - 1, opener.startpos - 1, "image_marker", opener.matchIndex - 1);
                    self.addMatch(opener.startpos, opener.endpos, "+imagetext", opener.matchIndex);
                    self.addMatch(opener.substartpos || opener.startpos, opener.substartpos || opener.startpos, "-imagetext", opener.subMatchIndex);
                }
                else {
                    self.addMatch(opener.startpos, opener.endpos, "+linktext", opener.matchIndex);
                    self.addMatch(opener.substartpos || opener.startpos, opener.substartpos || opener.startpos, "-linktext", opener.subMatchIndex);
                }
                self.addMatch(opener.subendpos || opener.endpos, opener.subendpos || opener.endpos, "+destination", opener.subMatchIndex + 1);
                self.addMatch(pos, pos, "-destination");
                self.destination = false;
                // remove from openers
                self.clearOpeners(opener.startpos, pos);
                return pos + 1;
            }
        }
        return null;
    },
    [C_HYPHEN]: function (self, pos, endpos) {
        const subject = self.subject;
        if (subject.codePointAt(pos - 1) === C_LEFT_BRACE ||
            subject.codePointAt(pos + 1) === C_RIGHT_BRACE) {
            const newpos = betweenMatched("-", "delete", "str", hasBrace)(self, pos, endpos);
            if (newpos) {
                return newpos;
            }
        }
        // didn't match a del, try for smart hyphens:
        let ep = pos;
        let hyphens = 0;
        while (ep <= endpos && subject.codePointAt(ep) === C_HYPHEN) {
            ep++;
            hyphens++;
        }
        if (subject.codePointAt(ep) === C_RIGHT_BRACE) {
            hyphens--; // last hyphen is close del
        }
        if (hyphens === 0) { // this means we have '-}'
            self.addMatch(pos, pos + 1, "str");
            return pos + 2;
        }
        // Try to construct a homogeneous sequence of dashes
        const all_em = hyphens % 3 === 0;
        const all_en = hyphens % 2 === 0;
        while (hyphens > 0) {
            if (all_em) {
                self.addMatch(pos, pos + 2, "em_dash");
                pos = pos + 3;
                hyphens = hyphens - 3;
            }
            else if (all_en) {
                self.addMatch(pos, pos + 1, "en_dash");
                pos = pos + 2;
                hyphens = hyphens - 2;
            }
            else if (hyphens >= 3 && (hyphens % 2 !== 0 || hyphens > 4)) {
                self.addMatch(pos, pos + 2, "em_dash");
                pos = pos + 3;
                hyphens = hyphens - 3;
            }
            else if (hyphens >= 2) {
                self.addMatch(pos, pos + 1, "en_dash");
                pos = pos + 2;
                hyphens = hyphens - 2;
            }
            else {
                self.addMatch(pos, pos, "str");
                pos = pos + 1;
                hyphens = hyphens - 1;
            }
        }
        return pos;
    }
};
class InlineParser {
    constructor(subject, options = {}) {
        this.options = options;
        this.warn = options.warn || (() => { });
        this.subject = subject;
        this.matches = []; // array of matches
        this.openers = {};
        this.verbatim = 0;
        this.verbatimType = "";
        this.destination = false;
        this.firstpos = -1;
        this.lastpos = 0;
        this.allowAttributes = true;
        this.attributeParser = null;
        this.attributeStart = null;
        this.attributeSlices = null;
        this.matchers = matchers;
    }
    addMatch(startpos, endpos, annot, matchIndex) {
        const match = { startpos: startpos, endpos: endpos, annot: annot };
        if (matchIndex !== undefined) {
            // insert into the proper place, replacing placeholder
            this.matches.splice(matchIndex, 1, match);
        }
        else {
            this.matches.push(match);
        }
    }
    inVerbatim() {
        return (this.verbatim > 0);
    }
    singleChar(pos) {
        this.addMatch(pos, pos, "str");
        return pos + 1;
    }
    reparseAttributes() {
        // Reparse attributeSlices that we tried to parse as an attribute
        const slices = this.attributeSlices;
        if (slices === null) {
            return;
        }
        this.allowAttributes = false;
        this.attributeParser = null;
        this.attributeStart = null;
        if (slices !== null) {
            for (const slice of slices) {
                this.feed(slice.startpos, slice.endpos);
            }
        }
        this.allowAttributes = true;
        this.attributeSlices = null;
    }
    getMatches() {
        const subject = this.subject;
        if (this.attributeParser) {
            // we're still in an attribute parse
            this.reparseAttributes();
        }
        let i = this.matches.length - 1;
        // remove trailing softbreak and any spaces
        if (this.matches[i] && this.matches[i].annot === "soft_break") {
            this.matches.pop();
            const match = this.matches[this.matches.length - 1];
            if (match && match.annot === "str" &&
                subject.codePointAt(match.endpos) === 32) {
                while (match.endpos >= match.startpos &&
                    subject.codePointAt(match.endpos) === 32) {
                    match.endpos = match.endpos - 1;
                }
                if (match.endpos < match.startpos) {
                    this.matches.pop();
                }
            }
        }
        // add -verbatim if needed
        if (this.matches.length > 0 && this.verbatim > 0) { // unclosed verbatim
            const last = this.matches[this.matches.length - 1];
            this.warn(new options_1.Warning("Unclosed verbatim", last.endpos));
            this.matches.push({
                startpos: last.endpos,
                endpos: last.endpos,
                annot: "-" + this.verbatimType
            });
        }
        return this.matches;
    }
    addOpener(name, startpos, endpos, defaultAnnot) {
        if (!this.openers[name]) {
            this.openers[name] = [];
        }
        this.openers[name].push({ matchIndex: this.matches.length,
            startpos: startpos,
            endpos: endpos,
            annot: null,
            subMatchIndex: this.matches.length,
            substartpos: null,
            subendpos: null });
        // add default match (to be used if we don't match the opener)
        this.addMatch(startpos, endpos, defaultAnnot);
    }
    clearOpeners(startpos, endpos) {
        // Remove other openers in between the matches
        for (const k in this.openers) {
            const v = this.openers[k];
            let i = v.length - 1;
            while (v[i]) {
                const opener = v[i];
                if (opener.startpos >= startpos && opener.endpos <= endpos) {
                    v.splice(i, 1);
                }
                else if ((opener.substartpos && opener.substartpos >= startpos) &&
                    (opener.subendpos && opener.subendpos <= endpos)) {
                    v[i].substartpos = null;
                    v[i].subendpos = null;
                    v[i].annot = null;
                }
                else {
                    break;
                }
                i--;
            }
        }
    }
    strMatches(startpos, endpos) {
        // convert matches between startpos and endpos to str
        let i = this.matches.length - 1;
        // backup to startpos
        while (i > 0 && this.matches[i].startpos >= startpos) {
            i--;
        }
        if (this.matches[i].startpos < startpos) {
            i++;
        }
        while (this.matches[i] && this.matches[i].endpos <= endpos) {
            const m = this.matches[i];
            if (m.annot !== "escape" && m.annot !== "str") {
                m.annot = "str";
            }
            i++;
        }
    }
    feed(startpos, endpos) {
        // Feed a slice to the parser, updating state.
        const subject = this.subject;
        if (this.firstpos === -1 || startpos < this.firstpos) {
            this.firstpos = startpos;
        }
        if (this.lastpos === 0 || endpos > this.lastpos) {
            this.lastpos = endpos;
        }
        let pos = startpos;
        while (pos <= endpos) {
            if (this.attributeParser !== null) {
                const sp = pos;
                const nextSpecial = findSpecial(subject, pos, endpos);
                let ep2;
                if (nextSpecial === null) {
                    ep2 = endpos;
                }
                else {
                    ep2 = nextSpecial;
                }
                const result = this.attributeParser.feed(sp, ep2);
                const ep = result.position;
                if (result.status === "done") {
                    const attributeStart = this.attributeStart;
                    // add attribute matches
                    if (attributeStart !== null) {
                        this.addMatch(attributeStart, attributeStart, "+attributes");
                    }
                    const attrMatches = this.attributeParser.matches;
                    // add attribute matches
                    for (const match of attrMatches) {
                        this.addMatch(match.startpos, match.endpos, match.annot);
                    }
                    this.addMatch(ep, ep, "-attributes");
                    // restore state to prior to adding attribute parser
                    this.attributeParser = null;
                    this.attributeStart = null;
                    this.attributeSlices = null;
                    pos = ep + 1;
                }
                else if (result.status === "fail") {
                    this.reparseAttributes();
                    pos = sp;
                    // as no slice was added for it
                }
                else if (result.status === "continue") {
                    if (this.attributeSlices === null) {
                        this.attributeSlices = [];
                    }
                    this.attributeSlices.push({ startpos: sp, endpos: ep });
                    pos = ep + 1;
                }
            }
            else {
                // find next interesting character:
                const nextSpecial = findSpecial(subject, pos, endpos);
                let newpos;
                if (nextSpecial === null) {
                    newpos = endpos + 1;
                }
                else {
                    newpos = nextSpecial;
                }
                if (newpos > pos) {
                    this.addMatch(pos, newpos - 1, "str");
                    pos = newpos;
                    if (pos > endpos) {
                        break; // otherwise, fall through:
                    }
                }
                // if we get here, then newpos = pos,
                // i.e. we have something interesting at pos
                const c = subject.codePointAt(pos);
                if (c === undefined) {
                    throw (new Error("Code point at " + pos + " is undefined."));
                }
                if (c === C_CR || c === C_LF) { // cr or lf
                    if (c === C_CR && subject.codePointAt(pos + 1) === C_LF &&
                        pos + 1 <= endpos) {
                        this.addMatch(pos, pos + 1, "soft_break");
                        pos = pos + 2;
                    }
                    else {
                        this.addMatch(pos, pos, "soft_break");
                        pos = pos + 1;
                    }
                }
                else if (this.verbatim > 0) {
                    if (c === 96) {
                        const m = (0, find_1.find)(subject, pattBackticks1, pos, endpos);
                        if (m) {
                            const endchar = m.endpos;
                            if (m.endpos - pos + 1 === this.verbatim) {
                                // check for raw attribute
                                const m2 = (0, find_1.find)(subject, pattRawAttribute, endchar + 1, endpos);
                                if (m2 && this.verbatimType === "verbatim") { // raw
                                    this.addMatch(pos, endchar, "-" + this.verbatimType);
                                    this.addMatch(m2.startpos, m2.endpos, "raw_format");
                                    pos = m2.endpos + 1;
                                }
                                else {
                                    this.addMatch(pos, endchar, "-" + this.verbatimType);
                                    pos = endchar + 1;
                                }
                                this.verbatim = 0;
                                this.verbatimType = "verbatim";
                            }
                            else {
                                this.addMatch(pos, endchar, "str");
                                pos = endchar + 1;
                            }
                        }
                        else {
                            this.addMatch(pos, endpos, "str");
                            pos = endpos + 1;
                        }
                    }
                    else {
                        this.addMatch(pos, pos, "str");
                        pos = pos + 1;
                    }
                }
                else {
                    const matcher = this.matchers[c];
                    if (matcher) {
                        const res = matcher(this, pos, endpos);
                        if (res === null) {
                            pos = this.singleChar(pos);
                        }
                        else {
                            pos = res;
                        }
                    }
                    else {
                        pos = this.singleChar(pos);
                    }
                }
            }
        }
        return;
    }
}
exports.InlineParser = InlineParser;

},
"./options": function (exports, require, module) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Warning = void 0;
class Warning {
    constructor(message, pos) {
        this.message = message;
        if (typeof pos === "number") {
            this.offset = pos;
        }
        else if (pos && "line" in pos) {
            this.sourceLoc = pos;
            this.offset = pos.offset;
        }
    }
    render() {
        let result = this.message;
        if (this.sourceLoc) {
            result += ` at line ${this.sourceLoc.line}, col ${this.sourceLoc.col}`;
        }
        else if (this.offset) {
            result += ` at offset ${this.offset}`;
        }
        return result;
    }
}
exports.Warning = Warning;

},
"./pandoc": function (exports, require, module) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fromPandoc = exports.toPandoc = void 0;
const options_1 = require("./options");
const styleMap = { Decimal: { Period: "1.",
        OneParen: "1)",
        TwoParens: "(1)" },
    LowerAlpha: { Period: "a.",
        OneParen: "a)",
        TwoParens: "(a)" },
    UpperAlpha: { Period: "A.",
        OneParen: "A)",
        TwoParens: "(A)" },
    LowerRoman: { Period: "i.",
        OneParen: "i)",
        TwoParens: "(i)" },
    UpperRoman: { Period: "I.",
        OneParen: "I)",
        TwoParens: "(I)" } };
const reverseStyleMap = {};
for (const i in styleMap) {
    for (const j in styleMap[i]) {
        reverseStyleMap[styleMap[i][j]] = [i, j];
    }
}
const paraToPlain = function (elt) {
    if (elt.t === "Para") {
        elt.t = "Plain";
    }
    return elt;
};
const toPandocAttr = function (node) {
    const attributes = Object.assign(Object.assign({}, node.autoAttributes), node.attributes);
    if (attributes) {
        const id = attributes.id || "";
        const classes = (attributes.class && attributes.class.split(" ")) || [];
        const kvs = [];
        for (const k in attributes) {
            if (k !== id && k !== "class") {
                kvs.push([k, attributes[k]]);
            }
        }
        return [id, classes, kvs];
    }
    else {
        return ["", [], []];
    }
};
class PandocRenderer {
    constructor(options = {}) {
        this.references = {};
        this.footnotes = {};
        this.options = options;
        this.smartPunctuationMap = this.options.smartPunctuationMap ||
            { right_single_quote: "’",
                left_single_quote: "‘",
                right_double_quote: "”",
                left_double_quote: "“",
                ellipses: "…",
                em_dash: "—",
                en_dash: "–"
            };
        this.warn || (this.warn = () => { });
    }
    toPandocChildren(node) {
        if ("children" in node) {
            const children = [];
            node.children.forEach((child) => {
                this.addToPandocElts(children, child);
            });
            return children;
        }
        else {
            return [];
        }
    }
    toPandocDefinitionListItem(list) {
        const self = this;
        return function (item) {
            if (!("children" in item)) {
                return [];
            }
            const [term, definition] = item.children;
            return [
                self.toPandocChildren(term),
                [self.toPandocChildren(definition)],
            ];
        };
    }
    toPandocListItem(list) {
        const self = this;
        return function (item) {
            let elts = self.toPandocChildren(item);
            if ("checkbox" in item && item.checkbox && elts[0].t === "Para") {
                if (item.checkbox === "checked") {
                    elts[0].c.unshift({ t: "Str", c: "☒" }, { t: "Space" });
                }
                else {
                    elts[0].c.unshift({ t: "Str", c: "☐" }, { t: "Space" });
                }
            }
            if ("tight" in list && list.tight) {
                elts = elts.map(paraToPlain);
            }
            return elts;
        };
    }
    addToPandocElts(elts, node) {
        switch (node.tag) {
            case "section":
            case "div": {
                const attrs = toPandocAttr(node);
                if (node.tag === "section") {
                    attrs[1].unshift("section");
                }
                elts.push({ t: "Div", c: [attrs, this.toPandocChildren(node)] });
                break;
            }
            case "block_quote":
                elts.push({ t: "BlockQuote", c: this.toPandocChildren(node) });
                break;
            case "definition_list": {
                const items = node.children.map(this.toPandocDefinitionListItem(node));
                elts.push({ t: "DefinitionList", c: items });
                break;
            }
            case "task_list":
            case "bullet_list": {
                let items;
                items = node.children.map(this.toPandocListItem(node));
                elts.push({ t: "BulletList", c: items });
                break;
            }
            case "ordered_list": {
                const items = node.children.map(this.toPandocListItem(node));
                const [style, delim] = reverseStyleMap[node.style];
                const start = node.start || 1;
                elts.push({ t: "OrderedList", c: [[start, { t: style }, { t: delim }],
                        items] });
                break;
            }
            case "task_list_item": // should be handled at "list" above
            case "list_item": // should be handled at "list" above
                break;
            case "para":
                elts.push({ t: "Para", c: this.toPandocChildren(node) });
                break;
            case "heading":
                elts.push({ t: "Header", c: [node.level, toPandocAttr(node),
                        this.toPandocChildren(node)] });
                break;
            case "code_block": {
                const attrs = toPandocAttr(node);
                if (node.lang) {
                    attrs[1].unshift(node.lang);
                }
                elts.push({ t: "CodeBlock", c: [attrs, node.text] });
                break;
            }
            case "raw_block":
                elts.push({ t: "RawBlock", c: [node.format, node.text] });
                break;
            case "thematic_break":
                elts.push({ t: "HorizontalRule" });
                break;
            case "table": {
                const attrs = toPandocAttr(node);
                const nullattr = ["", [], []];
                let caption = [];
                let colspecs = [];
                let theadrows = [];
                const tbodies = [];
                const tfoot = [nullattr, []];
                let curheads = [];
                let currows = [];
                const alignMap = { left: "AlignLeft",
                    right: "AlignRight",
                    center: "AlignCenter",
                    default: "AlignDefault" };
                const toColSpec = function (cell) {
                    return [{ t: alignMap[cell.align] || "AlignDefault" },
                        { t: "ColWidthDefault" }];
                };
                const self = this;
                const toPandocCell = function (cell) {
                    if ("children" in cell) {
                        return [toPandocAttr(cell),
                            { t: ("align" in cell && alignMap[cell.align]) ||
                                    "AlignDefault" },
                            1,
                            1,
                            [{ t: "Plain", c: self.toPandocChildren(cell) }]];
                    }
                };
                const toPandocRow = function (row) {
                    if ("children" in row) {
                        return [toPandocAttr(row), row.children.map(toPandocCell)];
                    }
                };
                for (let i = 0; i < node.children.length; i++) {
                    const row = node.children[i];
                    if (!("children" in row)) {
                        break;
                    }
                    if (colspecs.length === 0) {
                        colspecs = row.children.map(toColSpec);
                    }
                    if (row.tag === "caption") {
                        if (row.children.length) {
                            caption = this.toPandocChildren(row);
                        }
                    }
                    else if (row.head) {
                        if (currows.length === 0) {
                            curheads.push(toPandocRow(row));
                        }
                        else {
                            tbodies.push([nullattr, 0, curheads, currows]);
                            currows = [];
                            curheads = [toPandocRow(row)];
                        }
                    }
                    else {
                        if (tbodies.length === 0 && currows.length === 0) {
                            theadrows = curheads;
                            curheads = [];
                        }
                        currows.push(toPandocRow(row));
                    }
                }
                if (curheads.length > 0 || currows.length > 0) {
                    tbodies.push([nullattr, 0, curheads, currows]);
                }
                elts.push({ t: "Table", c: [attrs,
                        [null, [{ t: "Plain",
                                    c: caption }]],
                        colspecs,
                        [nullattr, theadrows],
                        tbodies,
                        tfoot] });
                break;
            }
            case "raw_inline":
                elts.push({ t: "RawInline", c: [node.format, node.text] });
                break;
            case "soft_break":
                elts.push({ t: "SoftBreak" });
                break;
            case "hard_break":
                elts.push({ t: "LineBreak" });
                break;
            case "str":
                node.text.split(/ +/).forEach((s, i) => {
                    if (i > 0) {
                        elts.push({ t: "Space" });
                    }
                    if (s.length > 0) {
                        elts.push({ t: "Str", c: s });
                    }
                });
                break;
            case "verbatim":
                elts.push({ t: "Code", c: [toPandocAttr(node), node.text] });
                break;
            case "inline_math":
                elts.push({ t: "Math",
                    c: [{ t: "InlineMath" }, node.text] });
                break;
            case "display_math":
                elts.push({ t: "Math",
                    c: [{ t: "DisplayMath" }, node.text] });
                break;
            case "non_breaking_space":
                elts.push({ t: "Str", c: "\u00A0" });
                break;
            case "smart_punctuation":
                elts.push({ t: "Str", c: this.smartPunctuationMap[node.type] ||
                        node.text });
                break;
            case "symb":
                elts.push({ t: "Span", c: [["", ["symbol"], [["alias", node.alias]]],
                        [{ t: "Str", c: ":" + node.alias + ":" }]] });
                break;
            case "single_quoted":
            case "double_quoted": {
                const quoteType = { t: node.tag === "single_quoted" ? "SingleQuote"
                        : "DoubleQuote" };
                elts.push({ t: "Quoted", c: [quoteType, this.toPandocChildren(node)] });
                break;
            }
            case "email":
            case "url": {
                let url = node.text;
                if (node.tag === "email") {
                    url = "mailto:" + url;
                }
                const attr = toPandocAttr(node);
                attr[1].unshift(node.tag === "email" ? "email" : "uri");
                elts.push({ t: "Link",
                    c: [attr,
                        [{ t: "Str", c: node.text }],
                        [url, ""]] });
                break;
            }
            case "image":
            case "link": {
                let destination = node.destination || "";
                const linkAttrs = {};
                if (node.reference) {
                    const ref = this.references[node.reference];
                    if (ref) {
                        destination = ref.destination || "";
                        const attributes = Object.assign(Object.assign({}, ref.autoAttributes), ref.attributes);
                        if (attributes) {
                            for (const k in attributes) {
                                linkAttrs[k] = attributes[k];
                            }
                        }
                    }
                    else {
                        this.warn(new options_1.Warning("Reference " + node.reference + " not found."));
                    }
                }
                const attributes = Object.assign(Object.assign({}, node.autoAttributes), node.attributes);
                if (attributes) {
                    for (const k in attributes) {
                        if (linkAttrs[k] && k === "class") {
                            linkAttrs[k] += " " + attributes[k];
                        }
                        else if (!linkAttrs[k]) {
                            linkAttrs[k] = attributes[k];
                        }
                    }
                }
                const attrs = toPandocAttr({ tag: "link", attributes: linkAttrs,
                    children: [] });
                const url = destination || "";
                const title = (node.attributes && node.attributes.title) || (node.autoAttributes && node.autoAttributes.title) || "";
                if (title) {
                    attrs[2] = attrs[2].filter(([k, v]) => k !== "title");
                }
                elts.push({ t: node.tag === "link" ? "Link" : "Image",
                    c: [attrs, this.toPandocChildren(node), [url, title]] });
                break;
            }
            case "emph":
                elts.push({ t: "Emph", c: this.toPandocChildren(node) });
                break;
            case "strong":
                elts.push({ t: "Strong", c: this.toPandocChildren(node) });
                break;
            case "superscript":
                elts.push({ t: "Superscript", c: this.toPandocChildren(node) });
                break;
            case "subscript":
                elts.push({ t: "Subscript", c: this.toPandocChildren(node) });
                break;
            case "span":
                elts.push({ t: "Span", c: [toPandocAttr(node),
                        this.toPandocChildren(node)] });
                break;
            case "mark":
                elts.push({ t: "Span", c: [["", ["mark"], []], this.toPandocChildren(node)] });
                break;
            case "insert":
                elts.push({ t: "Underline", c: this.toPandocChildren(node) });
                break;
            case "delete":
                elts.push({ t: "Strikeout", c: this.toPandocChildren(node) });
                break;
            case "footnote_reference": {
                const note = this.footnotes[node.text];
                if (note) {
                    elts.push({ t: "Note", c: this.toPandocChildren(note) });
                }
                else {
                    elts.push({ t: "Superscript", c: [{ t: "Str", c: node.text }] });
                }
                break;
            }
            default:
                this.warn(new options_1.Warning("Skipping unhandled node " + node.tag));
        }
    }
    toPandoc(doc) {
        this.references = doc.references;
        this.footnotes = doc.footnotes;
        return { ["pandoc-api-version"]: [1, 23],
            meta: {},
            blocks: this.toPandocChildren(doc) };
    }
}
const fromPandocAttr = function (pattr) {
    const attr = {};
    if (pattr[0]) {
        attr.id = pattr[0];
    }
    if (pattr[1].length > 0) {
        attr.class = pattr[1].join(" ");
    }
    for (let i = 0; i < pattr[2].length; i++) {
        attr[pattr[2][i][0].toString()] = pattr[2][i][1];
    }
    if (Object.keys(attr).length === 0) {
        return null;
    }
    else {
        return attr;
    }
};
const isPlainOrPara = function (x) {
    return (x.t === "Plain" || x.t === "Para");
};
const hasCheckbox = function (elt) {
    if (!elt[0]) {
        return null;
    }
    const x = elt[0];
    if (!isPlainOrPara(x)) {
        return null;
    }
    if (x.c.length >= 2 && x.c[0].t === "Str" && x.c[1].t === "Space") {
        if (x.c[0].c === "☒") {
            x.c.shift(); // remove the checkbox
            x.c.shift();
            return "checked";
        }
        else if (x.c[0].c === "☐") {
            x.c.shift(); // remove the checkbox
            x.c.shift();
            return "unchecked";
        }
        else {
            return null;
        }
    }
    else {
        return null;
    }
};
class PandocParser {
    constructor(options = {}) {
        this.footnotes = {};
        this.footnoteIndex = 0;
        this.options = options;
        this.warn = options.warn || (() => { });
    }
    fromPandocInlines(elts) {
        let accum = [];
        const inlines = [];
        for (let i = 0; i < elts.length; i++) {
            const elt = elts[i];
            if (elt.t === "Str") {
                accum.push(elt.c);
            }
            else if (elt.t === "Space") {
                accum.push(" ");
            }
            else {
                if (accum.length > 0) {
                    inlines.push({ tag: "str", text: accum.join("") });
                    accum = [];
                }
                switch (elt.t) {
                    case "SoftBreak":
                        inlines.push({ tag: "soft_break" });
                        break;
                    case "LineBreak":
                        inlines.push({ tag: "hard_break" });
                        break;
                    case "Emph":
                        inlines.push({ tag: "emph", children: this.fromPandocInlines(elt.c) });
                        break;
                    case "Strong":
                        inlines.push({ tag: "strong", children: this.fromPandocInlines(elt.c) });
                        break;
                    case "Superscript":
                        inlines.push({ tag: "superscript", children: this.fromPandocInlines(elt.c) });
                        break;
                    case "Subscript":
                        inlines.push({ tag: "subscript", children: this.fromPandocInlines(elt.c) });
                        break;
                    case "Strikeout":
                        inlines.push({ tag: "delete", children: this.fromPandocInlines(elt.c) });
                        break;
                    case "Span": {
                        const span = { tag: "span",
                            children: this.fromPandocInlines(elt.c[1]) };
                        const attr = fromPandocAttr(elt.c[0]);
                        if (attr) {
                            span.attributes = attr;
                        }
                        inlines.push(span);
                        break;
                    }
                    case "Underline":
                        inlines.push({ tag: "span",
                            attributes: { class: "underline" },
                            children: this.fromPandocInlines(elt.c) });
                        break;
                    case "SmallCaps":
                        inlines.push({ tag: "span",
                            attributes: { class: "smallcaps" },
                            children: this.fromPandocInlines(elt.c) });
                        break;
                    case "Math":
                        inlines.push({ tag: elt.c[0].t === "DisplayMath"
                                ? "display_math" : "inline_math",
                            text: elt.c[1] });
                        break;
                    case "Quoted":
                        if (elt.c[0].t === "SingleQuote") {
                            inlines.push({ tag: "single_quoted",
                                children: this.fromPandocInlines(elt.c[1]) });
                        }
                        else {
                            inlines.push({ tag: "double_quoted",
                                children: this.fromPandocInlines(elt.c[1]) });
                        }
                        break;
                    case "RawInline":
                        inlines.push({ tag: "raw_inline", format: elt.c[0], text: elt.c[1] });
                        break;
                    case "Code": {
                        const attr = fromPandocAttr(elt.c[0]);
                        const code = ({ tag: "verbatim",
                            text: elt.c[1] });
                        if (attr) {
                            code.attributes = attr;
                        }
                        inlines.push(code);
                        break;
                    }
                    case "Image":
                    case "Link": {
                        let attr = fromPandocAttr(elt.c[0]);
                        if (elt.c[2][1]) {
                            attr = attr || {};
                            attr.title = elt.c[2][1];
                        }
                        const dest = elt.c[2][0];
                        const children = this.fromPandocInlines(elt.c[1]);
                        if (elt.t === "Image") {
                            const img = { tag: "image",
                                destination: dest,
                                children: children };
                            if (attr) {
                                img.attributes = attr;
                            }
                            inlines.push(img);
                        }
                        else {
                            const link = { tag: "link",
                                destination: dest,
                                children: children };
                            if (attr) {
                                link.attributes = attr;
                            }
                            inlines.push(link);
                        }
                        break;
                    }
                    case "Cite":
                        inlines.push({ tag: "span",
                            attributes: { class: "cite" },
                            children: this.fromPandocInlines(elt.c[1]) });
                        break;
                    case "Note": {
                        this.footnoteIndex++;
                        const label = this.footnoteIndex.toString();
                        const note = elt.c.map((b) => {
                            return this.fromPandocBlock(b);
                        });
                        this.footnotes[this.footnoteIndex.toString()] =
                            { tag: "footnote", label: label, children: note };
                        inlines.push({ tag: "footnote_reference",
                            text: label });
                        break;
                    }
                    default:
                }
            }
        }
        if (accum.length > 0) {
            inlines.push({ tag: "str", text: accum.join("") });
        }
        return inlines;
    }
    fromPandocBlock(block) {
        switch (block.t) {
            case "Plain":
            case "Para":
                return { tag: "para", children: this.fromPandocInlines(block.c) };
            case "BlockQuote":
                return { tag: "block_quote",
                    children: block.c.map((b) => {
                        return this.fromPandocBlock(b);
                    }) };
            case "Div": {
                let attr = fromPandocAttr(block.c[0]);
                const tag = /\bsection\b/.test((attr && attr.class) || "")
                    ? "section" : "div";
                const blocks = block.c[1].map((b) => {
                    return this.fromPandocBlock(b);
                });
                if (tag === "section") {
                    attr = attr || {};
                    attr.class = attr.class.replace(/section */, "");
                    if (!attr.class) {
                        delete attr.class;
                    }
                    return { tag: "section", attributes: attr, children: blocks };
                }
                else {
                    const div = { tag: "div", children: blocks };
                    if (attr) {
                        div.attributes = attr;
                    }
                    return div;
                }
            }
            case "Header": {
                const attr = fromPandocAttr(block.c[1]);
                const heading = { tag: "heading",
                    level: block.c[0],
                    children: this.fromPandocInlines(block.c[2]) };
                if (attr) {
                    heading.attributes = attr;
                }
                return heading;
            }
            case "HorizontalRule":
                return { tag: "thematic_break" };
            case "RawBlock":
                return { tag: "raw_block", format: block.c[0], text: block.c[1] };
            case "CodeBlock": {
                const attr = fromPandocAttr(block.c[0]);
                let lang;
                if (attr && attr.class) {
                    const classes = attr.class.split(/  */);
                    lang = classes[0];
                    classes.shift();
                    if (classes.length > 0) {
                        attr.class = classes.join(" ");
                    }
                    else {
                        delete attr.class;
                    }
                }
                const res = { tag: "code_block",
                    lang: lang,
                    text: block.c[1] };
                if (attr) {
                    res.attributes = attr;
                }
                if (!lang) {
                    delete res.lang;
                }
                return res;
            }
            case "DefinitionList": {
                const items = [];
                const tight = false;
                for (let i = 0; i < block.c.length; i++) {
                    const rawterm = block.c[i][0];
                    const rawdefs = block.c[i][1];
                    const term = this.fromPandocInlines(rawterm);
                    const def = [];
                    for (let j = 0; j < rawdefs.length; j++) {
                        rawdefs[j].map((b) => {
                            def.push(this.fromPandocBlock(b));
                        });
                    }
                    items.push({ tag: "definition_list_item",
                        children: [{ tag: "term", children: term },
                            { tag: "definition", children: def }] });
                }
                return { tag: "definition_list", children: items };
            }
            case "OrderedList":
            case "BulletList": {
                const items = [];
                const taskListItems = [];
                let tight = false;
                let rawitems;
                if (block.t === "BulletList") {
                    rawitems = block.c;
                }
                else {
                    rawitems = block.c[1];
                }
                for (let i = 0; i < rawitems.length; i++) {
                    const checkbox = hasCheckbox(rawitems[i]);
                    const children = rawitems[i].map((b) => {
                        if (b.t === "Plain") {
                            tight = true;
                        }
                        else if (b.t === "Para") {
                            tight = false;
                        }
                        return this.fromPandocBlock(b);
                    });
                    if (checkbox !== null) {
                        taskListItems.push({ tag: "task_list_item",
                            checkbox: checkbox,
                            children: children });
                    }
                    else {
                        items.push({ tag: "list_item",
                            children: children });
                    }
                }
                if (block.t === "BulletList") {
                    if (taskListItems.length > 0) {
                        return { tag: "task_list",
                            tight: tight,
                            children: taskListItems };
                    }
                    else {
                        return { tag: "bullet_list",
                            style: "-",
                            tight: tight,
                            children: items };
                    }
                }
                else if (block.t === "OrderedList") {
                    const start = block.c[0][0];
                    let pandocStyle = block.c[0][1].t;
                    if (pandocStyle === "DefaultStyle") {
                        pandocStyle = "Decimal";
                    }
                    let pandocDelim = block.c[0][2].t;
                    if (pandocDelim === "DefaultDelim") {
                        pandocDelim = "Period";
                    }
                    const style = styleMap[pandocStyle][pandocDelim];
                    return { tag: "ordered_list",
                        style: style,
                        start: start,
                        tight: tight,
                        children: items };
                }
            }
            case "Table": {
                const attr = fromPandocAttr(block.c[0]);
                const rawcaption = block.c[1][1];
                const caption = { tag: "caption", children: [] };
                if (rawcaption.length > 1 ||
                    (rawcaption.length === 1 && !isPlainOrPara(rawcaption[0]))) {
                    this.warn(new options_1.Warning("Skipping block-level content in table caption."));
                }
                else if (rawcaption[0] && "c" in rawcaption[0]) {
                    caption.children = this.fromPandocInlines(rawcaption[0].c);
                }
                const rawcolspecs = block.c[2];
                const aligns = [];
                for (const i in rawcolspecs) {
                    aligns.push(rawcolspecs[i][0].t.slice(5).toLowerCase());
                }
                const rows = [];
                const rawtheadrows = block.c[3][1];
                for (const i in rawtheadrows) {
                    rows.push(this.fromPandocRow(rawtheadrows[i], true, 0, aligns));
                }
                const tbodies = block.c[4];
                for (const i in tbodies) {
                    const rowheadcolumns = tbodies[i][1];
                    const rawsubheadrows = tbodies[i][2];
                    for (const i in rawsubheadrows) {
                        rows.push(this.fromPandocRow(rawsubheadrows[i], true, rowheadcolumns, aligns));
                    }
                    const rawbodyrows = tbodies[i][3];
                    for (const i in rawbodyrows) {
                        rows.push(this.fromPandocRow(rawbodyrows[i], false, rowheadcolumns, aligns));
                    }
                }
                const rawfootrows = block.c[5][1];
                for (const i in rawfootrows) {
                    rows.push(this.fromPandocRow(rawfootrows[i], false, 0, aligns));
                }
                const table = { tag: "table", children: [caption, ...rows] };
                if (attr) {
                    table.attributes = attr;
                }
                return table;
            }
            case "Figure": {
                const attr = fromPandocAttr(block.c[0]);
                const tag = /\bsection\b/.test((attr && attr.class) || "")
                    ? "section" : "div";
                const blocks = block.c[2].map((b) => {
                    return this.fromPandocBlock(b);
                });
                const rawcapt = block.c[1][1];
                if (rawcapt.length > 0) {
                    const capt = rawcapt.map((b) => {
                        return this.fromPandocBlock(b);
                    });
                    blocks.push(...capt);
                }
                const div = { tag: "div", children: blocks };
                if (attr) {
                    div.attributes = attr;
                }
                return div;
            }
            case "LineBlock": {
                const ils = [];
                for (let i = 0; i < block.c.length; i++) {
                    if (i > 0) {
                        ils.push({ tag: "hard_break" });
                    }
                    ils.push(...this.fromPandocInlines(block.c[i]));
                }
                return { tag: "para", children: ils };
            }
            case "Null": // better options?
                return { tag: "raw_block", format: "none", text: "" };
            default:
        }
        return { tag: "raw_block", format: "error",
            text: "Could not convert " + block.t };
    }
    fromPandocRow(rawrow, head, rowheadcols, aligns) {
        const attr = fromPandocAttr(rawrow[0]);
        const rawcells = rawrow[1];
        const cells = [];
        for (let i = 0; i < rawcells.length; i++) {
            cells.push(this.fromPandocCell(rawcells[i], head || i < rowheadcols, aligns[i]));
        }
        const row = { tag: "row", head: head, children: cells };
        if (attr) {
            row.attributes = attr;
        }
        return row;
    }
    fromPandocCell(rawcell, head, defaultAlign) {
        let cs = [];
        const attr = fromPandocAttr(rawcell[0]);
        let align = rawcell[1].t.slice(5).toLowerCase();
        if (align === "default") {
            align = defaultAlign;
        }
        const rawblocks = rawcell[4];
        if (rawblocks.length > 1 || (rawblocks.length === 1 &&
            !isPlainOrPara(rawblocks[0]))) {
            this.warn(new options_1.Warning("Skipping table cell with block-level content."));
            cs = [{ tag: "str", text: "((content omitted))" }];
        }
        else if (rawblocks[0]) {
            cs = this.fromPandocInlines(rawblocks[0].c);
        }
        const cell = { tag: "cell", head: head, align: align, children: cs };
        if (attr) {
            cell.attributes = attr;
        }
        return cell;
    }
    fromPandoc(pandoc) {
        if (typeof pandoc !== "object") {
            throw (Error("Pandoc document must be an object"));
        }
        else if (!pandoc["pandoc-api-version"]) {
            throw (Error("Pandoc document lacks pandoc-api-version"));
        }
        else if (!pandoc.blocks) {
            throw (Error("Pandoc document lacks blocks"));
        }
        else if (!pandoc.meta) {
            throw (Error("Pandoc document lacks meta"));
        }
        const blocks = pandoc.blocks;
        const docblocks = blocks.map((b) => {
            return this.fromPandocBlock(b);
        });
        return { tag: "doc",
            children: docblocks,
            footnotes: this.footnotes,
            references: {},
            autoReferences: {} };
    }
}
const toPandoc = function (doc, options) {
    return new PandocRenderer(options).toPandoc(doc);
};
exports.toPandoc = toPandoc;
const fromPandoc = function (pandoc, options) {
    return new PandocParser(options).fromPandoc(pandoc);
};
exports.fromPandoc = fromPandoc;

},
"./parse": function (exports, require, module) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isInline = exports.isCaption = exports.isRow = exports.isBlock = exports.getStringContent = exports.renderAST = exports.parse = void 0;
const block_1 = require("./block");
const options_1 = require("./options");
const ast_1 = require("./ast");
Object.defineProperty(exports, "isRow", { enumerable: true, get: function () { return ast_1.isRow; } });
Object.defineProperty(exports, "isBlock", { enumerable: true, get: function () { return ast_1.isBlock; } });
Object.defineProperty(exports, "isCaption", { enumerable: true, get: function () { return ast_1.isCaption; } });
Object.defineProperty(exports, "isInline", { enumerable: true, get: function () { return ast_1.isInline; } });
const getStringContent = function (node) {
    const buffer = [];
    addStringContent(node, buffer);
    return buffer.join("");
};
exports.getStringContent = getStringContent;
const addStringContent = function (node, buffer) {
    if ("text" in node) {
        buffer.push(node.text);
    }
    else if ("tag" in node &&
        (node.tag === "soft_break" || node.tag === "hard_break")) {
        buffer.push("\n");
    }
    else if ("children" in node) {
        for (const child of node.children) {
            addStringContent(child, buffer);
        }
    }
};
// in verbatim text, trim one space next to ` at beginning or end:
const trimVerbatim = function (s) {
    return s
        .replace(/^ `/, "`")
        .replace(/` $/, "`");
};
const romanDigits = {
    i: 1,
    v: 5,
    x: 10,
    l: 50,
    c: 100,
    d: 500,
    m: 1000,
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000
};
const romanToNumber = function (s) {
    // go backwards through the digits
    let total = 0;
    let prevdigit = 0;
    let i = s.length - 1;
    while (i >= 0) {
        const c = s.charAt(i);
        const n = romanDigits[c];
        if (!n) {
            throw (new Error("Encountered bad character in roman numeral " + s));
        }
        if (n < prevdigit) { // e.g. ix
            total = total - n;
        }
        else {
            total = total + n;
        }
        prevdigit = n;
        i = i - 1;
    }
    return total;
};
const getListStart = function (marker, style) {
    const numtype = style.replace(/[().]/g, "");
    const s = marker.replace(/[().]/g, "");
    switch (numtype) {
        case "1": return parseInt(s, 10);
        case "A": return ((s.codePointAt(0) || 65) - 65 + 1); // 65 = "A"
        case "a": return ((s.codePointAt(0) || 97) - 97 + 1); // 97 = "a"
        case "I": return romanToNumber(s);
        case "i": return romanToNumber(s);
    }
    return undefined;
};
// Parsing ocntext:
var Context;
(function (Context) {
    Context[Context["Normal"] = 0] = "Normal";
    Context[Context["Verbatim"] = 1] = "Verbatim";
    Context[Context["Literal"] = 2] = "Literal"; // gather str, soft_break, hard_break in accumulatedText
})(Context || (Context = {}));
const normalizeLabel = function (label) {
    return label.trim().replace(/[ \t\r\n]+/g, " ");
};
const parse = function (input, options = {}) {
    const linestarts = [-1];
    if (options.sourcePositions) { // construct map of newline positions
        for (let i = 0; i < input.length; i++) {
            if (input[i] === "\n") {
                linestarts.push(i);
            }
        }
    }
    // use binary search on linestarts to find line number and col
    const getSourceLoc = function (pos) {
        const numlines = linestarts.length;
        let bottom = 0;
        let top = numlines - 1;
        let line = 0;
        let col = 0;
        while (!line) {
            const mid = bottom + ~~((top - bottom) / 2);
            if (linestarts[mid] > pos) {
                top = mid;
            }
            else if (linestarts[mid] <= pos) {
                if (mid === top || linestarts[mid + 1] > pos) {
                    line = mid + 1;
                    col = pos - linestarts[mid];
                }
                else {
                    if (bottom === mid && bottom < top) {
                        bottom = mid + 1;
                    }
                    else {
                        bottom = mid;
                    }
                }
            }
        }
        return { line: line, col: col, offset: pos };
    };
    let context = Context.Normal;
    let accumulatedText = "";
    const references = {};
    const autoReferences = {};
    const footnotes = {};
    const identifiers = {}; // identifiers used
    const blockAttributes = {}; // accumulated block attributes
    let listDepth = 0;
    const parser = (0, block_1.parseEvents)(input, options);
    const warn = options.warn || (() => { });
    const addBlockAttributes = function (container) {
        if (Object.keys(blockAttributes).length > 0) {
            container.attributes = container.attributes || {};
            for (const k in blockAttributes) {
                container.attributes[k] = blockAttributes[k];
                delete blockAttributes[k];
            }
        }
    };
    const getUniqueIdentifier = function (s) {
        const base = s.replace(/[\]\[~!@#$%^&*(){}`,.<>\\|=+/?\s]+/g, " ")
            .trim()
            .replace(/ +/g, "-");
        let i = 0;
        let ident = base;
        // generate unique id
        while (!ident || identifiers[ident]) {
            i = i + 1;
            ident = (base || "s") + "-" + i;
        }
        return ident;
    };
    const pushContainer = function (pos) {
        const container = {
            children: [],
            data: {},
            pos: pos,
            attributes: undefined
        };
        addBlockAttributes(container);
        containers.push(container);
    };
    const popContainer = function (pos) {
        const node = containers.pop();
        if (!node) {
            throw (new Error("Container stack is empty (popContainer)"));
        }
        if (pos && node.pos) {
            node.pos = {
                start: node.pos.start,
                end: pos.end,
            };
        }
        return node;
    };
    const topContainer = function () {
        if (containers.length > 0) {
            return containers[containers.length - 1];
        }
        else {
            throw (new Error("Container stack is empty (topContainer)"));
        }
    };
    // points to last child of top container, or top container if
    // it doesn't have children
    const getTip = function () {
        const top = topContainer();
        if (top.children.length > 0) {
            return top.children[top.children.length - 1];
        }
        else {
            return top;
        }
    };
    const addChildToTip = function (child) {
        if (containers.length > 0) {
            const tip = containers[containers.length - 1];
            tip.children.push(child);
        }
    };
    const handlers = { str: (suffixes, startpos, endpos, pos) => {
            const txt = input.substring(startpos, endpos + 1);
            if (context === Context.Normal) {
                addChildToTip({ tag: "str", text: txt, pos: pos });
            }
            else {
                accumulatedText += txt;
            }
        },
        soft_break: (suffixes, startpos, endpos, pos) => {
            if (context === Context.Normal) {
                addChildToTip({ tag: "soft_break", pos: pos });
            }
            else {
                accumulatedText += "\n";
            }
        },
        escape: (suffixes, startpos, endpos, pos) => {
            if (context === Context.Verbatim) {
                accumulatedText += "\\";
            }
        },
        hard_break: (suffixes, startpos, endpos, pos) => {
            if (context === Context.Normal) {
                addChildToTip({ tag: "hard_break", pos: pos });
            }
            else {
                accumulatedText += "\n";
            }
        },
        non_breaking_space: (suffixes, startpos, endpos, pos) => {
            if (context === Context.Verbatim) {
                accumulatedText += "\\ ";
            }
            else {
                addChildToTip({ tag: "non_breaking_space", pos: pos });
            }
        },
        symb: (suffixes, startpos, endpos, pos) => {
            if (context === Context.Normal) {
                const alias = input.substring(startpos + 1, endpos);
                addChildToTip({ tag: "symb", alias: alias, pos: pos });
            }
            else {
                const txt = input.substring(startpos, endpos + 1);
                accumulatedText += txt;
            }
        },
        footnote_reference: (suffixes, startpos, endpos, pos) => {
            const fnref = input.substring(startpos + 2, endpos);
            addChildToTip({ tag: "footnote_reference",
                text: normalizeLabel(fnref), pos: pos });
        },
        ["+reference_definition"]: (suffixes, startpos, endpos, pos) => {
            pushContainer(pos);
        },
        ["-reference_definition"]: (suffixes, startpos, endpos, pos) => {
            const node = popContainer(pos);
            const lab = normalizeLabel(node.data.key);
            const r = {
                tag: "reference",
                label: lab,
                destination: node.data.value || "",
                attributes: node.attributes,
                pos: node.pos,
            };
            if (node.data.key) {
                references[lab] = r;
            }
        },
        reference_key: (suffixes, startpos, endpos, pos) => {
            topContainer().data.key = input.substring(startpos + 1, endpos);
            topContainer().data.value = "";
        },
        reference_value: (suffixes, startpos, endpos, pos) => {
            topContainer().data.value =
                topContainer().data.value + input.substring(startpos, endpos + 1);
        },
        ["+emph"]: (suffixes, startpos, endpos, pos) => {
            pushContainer(pos);
        },
        ["-emph"]: (suffixes, startpos, endpos, pos) => {
            const node = popContainer(pos);
            addChildToTip({ tag: "emph", children: node.children, pos: node.pos });
        },
        ["+strong"]: (suffixes, startpos, endpos, pos) => {
            pushContainer(pos);
        },
        ["-strong"]: (suffixes, startpos, endpos, pos) => {
            const node = popContainer(pos);
            addChildToTip({ tag: "strong", children: node.children, pos: node.pos });
        },
        ["+span"]: (suffixes, startpos, endpos, pos) => {
            pushContainer(pos);
        },
        ["-span"]: (suffixes, startpos, endpos, pos) => {
            const node = popContainer(pos);
            addChildToTip({ tag: "span", children: node.children, pos: node.pos });
        },
        ["+mark"]: (suffixes, startpos, endpos, pos) => {
            pushContainer(pos);
        },
        ["-mark"]: (suffixes, startpos, endpos, pos) => {
            const node = popContainer(pos);
            addChildToTip({ tag: "mark", children: node.children, pos: node.pos });
        },
        ["+superscript"]: (suffixes, startpos, endpos, pos) => {
            pushContainer(pos);
        },
        ["-superscript"]: (suffixes, startpos, endpos, pos) => {
            const node = popContainer(pos);
            addChildToTip({ tag: "superscript", children: node.children, pos: node.pos });
        },
        ["+subscript"]: (suffixes, startpos, endpos, pos) => {
            pushContainer(pos);
        },
        ["-subscript"]: (suffixes, startpos, endpos, pos) => {
            const node = popContainer(pos);
            addChildToTip({ tag: "subscript", children: node.children, pos: node.pos });
        },
        ["+delete"]: (suffixes, startpos, endpos, pos) => {
            pushContainer(pos);
        },
        ["-delete"]: (suffixes, startpos, endpos, pos) => {
            const node = popContainer(pos);
            addChildToTip({ tag: "delete", children: node.children, pos: node.pos });
        },
        ["+insert"]: (suffixes, startpos, endpos, pos) => {
            pushContainer(pos);
        },
        ["-insert"]: (suffixes, startpos, endpos, pos) => {
            const node = popContainer(pos);
            addChildToTip({ tag: "insert", children: node.children, pos: node.pos });
        },
        ["+double_quoted"]: (suffixes, startpos, endpos, pos) => {
            pushContainer(pos);
        },
        ["-double_quoted"]: (suffixes, startpos, endpos, pos) => {
            const node = popContainer(pos);
            addChildToTip({ tag: "double_quoted", children: node.children, pos: node.pos });
        },
        ["+single_quoted"]: (suffixes, startpos, endpos, pos) => {
            pushContainer(pos);
        },
        ["-single_quoted"]: (suffixes, startpos, endpos, pos) => {
            const node = popContainer(pos);
            addChildToTip({ tag: "single_quoted", children: node.children, pos: node.pos });
        },
        ["+attributes"]: (suffixes, startpos, endpos, pos) => {
            pushContainer(pos);
        },
        ["-attributes"]: (suffixes, startpos, endpos, pos) => {
            const node = popContainer(pos);
            if (node.attributes && containers.length > 0) {
                if (node.attributes.id) {
                    identifiers[node.attributes.id] = true;
                }
                let tip = getTip();
                if (tip === topContainer()) {
                    // no inline children to add the attribute to...
                    return;
                }
                let endsWithSpace = false;
                if ("tag" in tip && tip.tag === "str") { // bare word
                    // split off last consecutive word of string
                    // and attach attributes to it
                    const m = tip.text.match(/[^\s]+$/);
                    if (m && m.index && m.index > 0) {
                        let wordpos;
                        if (tip.pos) {
                            const origend = tip.pos.end;
                            tip.pos.end = {
                                line: origend.line,
                                col: origend.col - m[0].length,
                                offset: origend.offset - m[0].length
                            };
                            wordpos = {
                                start: {
                                    line: origend.line,
                                    col: origend.col - m[0].length + 1,
                                    offset: origend.offset - m[0].length + 1
                                },
                                end: origend
                            };
                        }
                        tip.text = tip.text.substring(0, m.index);
                        addChildToTip({ tag: "str", text: m[0], pos: wordpos });
                    }
                    else if (!m) {
                        endsWithSpace = true;
                    }
                }
                tip = getTip(); // get new tip, which may be the new element
                if (endsWithSpace) {
                    warn(new options_1.Warning("Ignoring unattached attribute", options.sourcePositions ?
                        getSourceLoc(startpos) : startpos));
                    return;
                }
                if (!tip.attributes) {
                    tip.attributes = {};
                }
                for (const k in node.attributes) {
                    if (k === "class") {
                        if (tip.attributes[k]) {
                            tip.attributes[k] = tip.attributes[k] +
                                " " + node.attributes[k];
                        }
                        else {
                            tip.attributes[k] = node.attributes[k];
                        }
                    }
                    else {
                        tip.attributes[k] = node.attributes[k];
                    }
                }
            }
        },
        ["+block_attributes"]: (suffixes, startpos, endpos, pos) => {
            pushContainer(pos);
        },
        ["-block_attributes"]: (suffixes, startpos, endpos, pos) => {
            const node = popContainer(pos);
            if (node.attributes && containers.length > 0) {
                if (node.attributes.id) {
                    identifiers[node.attributes.id] = true;
                }
                for (const k in node.attributes) {
                    if (k === "class") {
                        if (blockAttributes[k]) {
                            blockAttributes[k] = blockAttributes[k] +
                                " " + node.attributes[k];
                        }
                        else {
                            blockAttributes[k] = node.attributes[k];
                        }
                    }
                    else {
                        blockAttributes[k] = node.attributes[k];
                    }
                }
            }
        },
        class: (suffixes, startpos, endpos, pos) => {
            const top = topContainer();
            const cl = input.substring(startpos, endpos + 1);
            if (!top.attributes) {
                top.attributes = {};
            }
            if (top.attributes.class) {
                top.attributes.class = top.attributes.class + " " + cl;
            }
            else {
                top.attributes.class = cl;
            }
        },
        id: (suffixes, startpos, endpos, pos) => {
            const top = topContainer();
            const id = input.substring(startpos, endpos + 1);
            if (!top.attributes) {
                top.attributes = { id: id };
            }
            else {
                top.attributes.id = id;
            }
        },
        key: (suffixes, startpos, endpos, pos) => {
            const top = topContainer();
            const key = input.substring(startpos, endpos + 1);
            top.data.key = key;
            if (!top.attributes) {
                top.attributes = {};
            }
            top.attributes[top.data.key] = "";
        },
        value: (suffixes, startpos, endpos, pos) => {
            const top = topContainer();
            const val = input.substring(startpos, endpos + 1)
                .replace(/[ \r\n]+/g, " ") // collapse interior whitespace
                .replace(/\\([.,\\/#!$%^&*;:{}=\-_`~+[\]()'"?|])/g, "$1");
            // resolve backslash escapes
            if (!top.attributes) {
                top.attributes = {};
            }
            if (top.data.key) {
                top.attributes[top.data.key] = // append multiple values to key
                    top.attributes[top.data.key] + val;
            }
            else {
                throw (new Error("Encountered value without key"));
            }
        },
        ["+linktext"]: (suffixes, startpos, endpos, pos) => {
            pushContainer(pos);
            topContainer().data.isimage = false;
        },
        ["-linktext"]: (suffixes, startpos, endpos, pos) => {
            // we don't pop yet, but wait for -destination
        },
        ["+imagetext"]: (suffixes, startpos, endpos, pos) => {
            pushContainer(pos);
            topContainer().data.isimage = true;
        },
        ["-imagetext"]: (suffixes, startpos, endpos, pos) => {
            // we don't pop yet, but wait for -destination
        },
        ["+destination"]: (suffixes, startpos, endpos, pos) => {
            context = Context.Literal;
        },
        ["-destination"]: (suffixes, startpos, endpos, pos) => {
            const node = popContainer(pos); // the container added by +linktext/+imagetext
            addChildToTip({
                tag: node.data.isimage ? "image" : "link",
                destination: accumulatedText.replace(/[\r\n]/g, ""),
                children: node.children,
                pos: node.pos
            });
            context = Context.Normal;
            accumulatedText = "";
        },
        ["+reference"]: (suffixes, startpos, endpos, pos) => {
            context = Context.Literal;
        },
        ["-reference"]: (suffixes, startpos, endpos, pos) => {
            const node = popContainer(pos); // the container added by +linktext
            let ref = accumulatedText;
            if (ref.length === 0) {
                ref = getStringContent(node);
            }
            addChildToTip({
                tag: node.data.isimage ? "image" : "link",
                reference: normalizeLabel(ref),
                children: node.children,
                pos: node.pos
            });
            context = Context.Normal;
            accumulatedText = "";
        },
        ["+verbatim"]: (suffixes, startpos, endpos, pos) => {
            context = Context.Verbatim;
            pushContainer(pos);
        },
        ["-verbatim"]: (suffixes, startpos, endpos, pos) => {
            const node = popContainer(pos);
            addChildToTip({
                tag: "verbatim",
                text: trimVerbatim(accumulatedText),
                pos: node.pos
            });
            context = Context.Normal;
            accumulatedText = "";
        },
        raw_format: (suffixes, startpos, endpos, pos) => {
            const format = input.substring(startpos, endpos + 1)
                .replace(/^\{?=/, "")
                .replace(/\}$/, "");
            const top = topContainer();
            if (context === Context.Verbatim) { // in a code block
                top.data.format = format;
            }
            else {
                const tip = top.children[top.children.length - 1];
                if (tip && "tag" in tip && tip.tag === "verbatim") {
                    tip.tag = "raw_inline";
                    tip.format = format;
                }
                else {
                    throw (new Error("raw_format is not after verbatim or code_block."));
                }
            }
        },
        ["+display_math"]: (suffixes, startpos, endpos, pos) => {
            context = Context.Verbatim;
            pushContainer(pos);
        },
        ["+inline_math"]: (suffixes, startpos, endpos, pos) => {
            context = Context.Verbatim;
            pushContainer(pos);
        },
        ["-display_math"]: (suffixes, startpos, endpos, pos) => {
            const node = popContainer(pos);
            addChildToTip({
                tag: "display_math",
                text: trimVerbatim(accumulatedText),
                pos: node.pos
            });
            context = Context.Normal;
            accumulatedText = "";
        },
        ["-inline_math"]: (suffixes, startpos, endpos, pos) => {
            const node = popContainer(pos);
            addChildToTip({
                tag: "inline_math",
                text: trimVerbatim(accumulatedText),
                pos: node.pos
            });
            context = Context.Normal;
            accumulatedText = "";
        },
        ["+url"]: (suffixes, startpos, endpos, pos) => {
            context = Context.Literal;
            pushContainer(pos);
        },
        ["-url"]: (suffixes, startpos, endpos, pos) => {
            const node = popContainer(pos);
            addChildToTip({ tag: "url",
                text: accumulatedText.replace(/[\r\n]/g, ""),
                pos: node.pos });
            context = Context.Normal;
            accumulatedText = "";
        },
        ["+email"]: (suffixes, startpos, endpos, pos) => {
            context = Context.Literal;
            pushContainer(pos);
        },
        ["-email"]: (suffixes, startpos, endpos, pos) => {
            const node = popContainer(pos);
            addChildToTip({ tag: "email",
                text: accumulatedText.replace(/[\r\n]/g, ""),
                pos: node.pos });
            context = Context.Normal;
            accumulatedText = "";
        },
        ["+para"]: (suffixes, startpos, endpos, pos) => {
            pushContainer(pos);
        },
        ["-para"]: (suffixes, startpos, endpos, pos) => {
            const node = popContainer(pos);
            addChildToTip({
                tag: "para",
                children: node.children,
                attributes: node.attributes,
                pos: node.pos
            });
        },
        ["+heading"]: (suffixes, startpos, endpos, pos) => {
            pushContainer(pos);
            topContainer().data.level = 1 + endpos - startpos;
        },
        ["-heading"]: (suffixes, startpos, endpos, pos) => {
            var _a, _b;
            const node = popContainer(pos);
            const headingStr = getStringContent(node).trim();
            if (!node.attributes || !node.attributes.id) {
                if (!node.autoAttributes) {
                    node.autoAttributes = {};
                }
                node.autoAttributes.id = getUniqueIdentifier(headingStr);
                identifiers[node.autoAttributes.id] = true;
            }
            // add implicit heading reference
            const lab = normalizeLabel(headingStr);
            if (!references[lab] && !autoReferences[lab]) {
                autoReferences[lab] = {
                    tag: "reference",
                    label: lab,
                    destination: "#" + (((_a = node.attributes) === null || _a === void 0 ? void 0 : _a.id) || ((_b = node.autoAttributes) === null || _b === void 0 ? void 0 : _b.id))
                };
            }
            // add section structure
            let pnode = topContainer();
            if (pnode.data.headinglevel !== undefined) { // doc or section
                while (pnode && pnode.data.headinglevel !== undefined &&
                    pnode.data.headinglevel >= node.data.level) {
                    // close sections til we get to the right level
                    pnode = popContainer(pos);
                    addChildToTip({
                        tag: "section",
                        children: pnode.children,
                        attributes: pnode.attributes,
                        autoAttributes: pnode.autoAttributes,
                        pos: pnode.pos
                    });
                    pnode = topContainer();
                }
                // now we know that pnode.data.headinglevel is either
                // undefined or < node.data.level
                pushContainer(node.pos);
                topContainer().data.headinglevel = node.data.level;
                // move id attribute from heading to section
                if (node.autoAttributes && node.autoAttributes.id) {
                    topContainer().autoAttributes = node.autoAttributes;
                    delete node.autoAttributes;
                }
                if (node.attributes && node.attributes.id) {
                    topContainer().attributes = node.attributes;
                    delete node.attributes;
                }
            }
            addChildToTip({
                tag: "heading",
                level: node.data.level,
                children: node.children,
                attributes: node.attributes,
                autoAttributes: node.autoAttributes,
                pos: node.pos
            });
        },
        ["+list"]: (suffixes, startpos, endpos, pos) => {
            pushContainer(pos);
            topContainer().data.styles = suffixes;
            topContainer().data.blanklines = false;
            topContainer().data.tight = true;
            listDepth++;
        },
        ["-list"]: (suffixes, startpos, endpos, pos) => {
            const node = popContainer(pos);
            // take first if ambiguous
            const listStyle = node.data.styles[0];
            if (!listStyle) {
                throw (new Error("No style defined for list"));
            }
            const listStart = getListStart(node.data.firstMarker, listStyle);
            if (listStyle === ":") {
                addChildToTip({
                    tag: "definition_list",
                    children: node.children,
                    attributes: node.attributes,
                    autoAttributes: node.autoAttributes,
                    pos: node.pos
                });
            }
            else if (listStyle === "X") {
                addChildToTip({
                    tag: "task_list",
                    tight: node.data.tight,
                    children: node.children,
                    attributes: node.attributes,
                    autoAttributes: node.autoAttributes,
                    pos: node.pos
                });
            }
            else if (listStyle === "+" || listStyle === "*" ||
                listStyle === "-") {
                addChildToTip({
                    tag: "bullet_list",
                    tight: node.data.tight,
                    style: listStyle,
                    children: node.children,
                    attributes: node.attributes,
                    autoAttributes: node.autoAttributes,
                    pos: node.pos
                });
            }
            else {
                addChildToTip({
                    tag: "ordered_list",
                    style: listStyle,
                    children: node.children,
                    start: listStart,
                    tight: node.data.tight,
                    attributes: node.attributes,
                    autoAttributes: node.autoAttributes,
                    pos: node.pos
                });
            }
            listDepth--;
        },
        ["+list_item"]: (suffixes, startpos, endpos, pos) => {
            // narrow styles
            if (suffixes.length < topContainer().data.styles.length) {
                topContainer().data.styles = suffixes;
            }
            if (!topContainer().data.firstMarker) {
                topContainer().data.firstMarker =
                    input.substring(startpos, endpos + 1);
            }
            pushContainer(pos);
            if (suffixes.length === 1 && suffixes[0] === ":") {
                topContainer().data.definitionList = true;
            }
        },
        ["-list_item"]: (suffixes, startpos, endpos, pos) => {
            const node = popContainer(pos);
            if (node.data.definitionList) {
                if (node.children[0] && node.children[0].tag === "para") {
                    const term = {
                        tag: "term",
                        children: node.children[0].children
                    };
                    node.children.shift();
                    const definition = {
                        tag: "definition",
                        children: node.children
                    };
                    addChildToTip({
                        tag: "definition_list_item",
                        children: [term, definition],
                        attributes: node.attributes,
                        autoAttributes: node.autoAttributes,
                        pos: node.pos
                    });
                }
                else {
                    const term = { tag: "term", children: [] };
                    const definition = {
                        tag: "definition",
                        children: node.children
                    };
                    addChildToTip({
                        tag: "definition_list_item",
                        children: [term, definition],
                        attributes: node.attributes,
                        autoAttributes: node.autoAttributes,
                        pos: node.pos
                    });
                }
            }
            else if (node.data.checkbox) {
                addChildToTip({
                    tag: "task_list_item",
                    children: node.children,
                    attributes: node.attributes,
                    autoAttributes: node.autoAttributes,
                    checkbox: node.data.checkbox,
                    pos: node.pos
                });
            }
            else {
                addChildToTip({
                    tag: "list_item",
                    children: node.children,
                    attributes: node.attributes,
                    autoAttributes: node.autoAttributes,
                    pos: node.pos
                });
            }
        },
        checkbox_checked: (suffixes, startpos, endpos, pos) => {
            topContainer().data.checkbox = "checked";
        },
        checkbox_unchecked: (suffixes, startpos, endpos, pos) => {
            topContainer().data.checkbox = "unchecked";
        },
        ["+block_quote"]: (suffixes, startpos, endpos, pos) => {
            pushContainer(pos);
        },
        ["-block_quote"]: (suffixes, startpos, endpos, pos) => {
            const node = popContainer(pos);
            addChildToTip({
                tag: "block_quote",
                children: node.children,
                attributes: node.attributes,
                autoAttributes: node.autoAttributes,
                pos: node.pos
            });
        },
        ["+table"]: (suffixes, startpos, endpos, pos) => {
            pushContainer(pos);
            topContainer().data.aligns = [];
        },
        ["-table"]: (suffixes, startpos, endpos, pos) => {
            var _a;
            const node = popContainer(pos);
            const rows = node.children;
            let caption = {
                tag: "caption",
                children: []
            };
            if (((_a = rows[0]) === null || _a === void 0 ? void 0 : _a.tag) === "caption") {
                caption = rows.shift();
            }
            addChildToTip({
                tag: "table",
                children: [caption, ...rows],
                attributes: node.attributes,
                autoAttributes: node.autoAttributes,
                pos: node.pos
            });
        },
        ["+row"]: (suffixes, startpos, endpos, pos) => {
            pushContainer(pos);
            topContainer().data.aligns = [];
        },
        ["-row"]: (suffixes, startpos, endpos, pos) => {
            const node = popContainer(pos);
            if (node.children.length === 0) { // a separator line
                // set table aligns, so they can be propagated to future rows
                topContainer().data.aligns = node.data.aligns;
                const tip = getTip();
                if (tip && "tag" in tip && tip.tag === "row") { // prev row of table
                    tip.head = true;
                    for (let i = 0; i < tip.children.length; i++) {
                        tip.children[i].head = true;
                        tip.children[i].align = node.data.aligns[i] || "default";
                    }
                }
            }
            else {
                // get aligns from table
                node.data.aligns = [];
                for (let i = 0; i < node.children.length; i++) {
                    node.children[i].align = topContainer().data.aligns[i] || "default";
                }
                addChildToTip({
                    tag: "row",
                    children: node.children,
                    head: false,
                    attributes: node.attributes,
                    autoAttributes: node.autoAttributes,
                    pos: node.pos
                });
            }
        },
        separator_default: (suffixes, startpos, endpos, pos) => {
            topContainer().data.aligns.push("default");
        },
        separator_left: (suffixes, startpos, endpos, pos) => {
            topContainer().data.aligns.push("left");
        },
        separator_right: (suffixes, startpos, endpos, pos) => {
            topContainer().data.aligns.push("right");
        },
        separator_center: (suffixes, startpos, endpos, pos) => {
            topContainer().data.aligns.push("center");
        },
        ["+cell"]: (suffixes, startpos, endpos, pos) => {
            pushContainer(pos);
        },
        ["-cell"]: (suffixes, startpos, endpos, pos) => {
            const node = popContainer(pos);
            addChildToTip({
                tag: "cell",
                children: node.children,
                head: false,
                align: "default",
                attributes: node.attributes,
                autoAttributes: node.autoAttributes,
                pos: node.pos
            });
        },
        ["+caption"]: (suffixes, startpos, endpos, pos) => {
            pushContainer(pos);
        },
        ["-caption"]: (suffixes, startpos, endpos, pos) => {
            var _a;
            const node = popContainer(pos);
            const tip = getTip();
            if (!tip || ("tag" in tip && tip.tag !== "table")) {
                return;
            }
            const capt = {
                tag: "caption",
                children: node.children,
                attributes: node.attributes,
                autoAttributes: node.autoAttributes,
                pos: node.pos
            };
            if (((_a = tip.children[0]) === null || _a === void 0 ? void 0 : _a.tag) === "caption") {
                tip.children[0] = capt;
            }
        },
        ["+footnote"]: (suffixes, startpos, endpos, pos) => {
            pushContainer(pos);
        },
        ["-footnote"]: (suffixes, startpos, endpos, pos) => {
            const node = popContainer(pos);
            if (node.data.label) {
                const lab = normalizeLabel(node.data.label);
                footnotes[lab] =
                    {
                        tag: "footnote",
                        label: lab || "",
                        children: node.children,
                        attributes: node.attributes,
                        autoAttributes: node.autoAttributes,
                        pos: node.pos
                    };
            }
            else {
                warn(new options_1.Warning("Ignoring footnote without a label.", options.sourcePositions ?
                    getSourceLoc(endpos) : endpos));
            }
        },
        note_label: (suffixes, startpos, endpos, pos) => {
            topContainer().data.label =
                input.substring(startpos, endpos + 1);
        },
        ["+code_block"]: (suffixes, startpos, endpos, pos) => {
            pushContainer(pos);
            context = Context.Verbatim;
        },
        ["-code_block"]: (suffixes, startpos, endpos, pos) => {
            const node = popContainer(pos);
            if (node.data.format) {
                addChildToTip({
                    tag: "raw_block",
                    format: node.data.format,
                    text: accumulatedText,
                    attributes: node.attributes,
                    autoAttributes: node.autoAttributes,
                    pos: node.pos
                });
            }
            else {
                addChildToTip({
                    tag: "code_block",
                    text: accumulatedText,
                    lang: node.data.lang,
                    attributes: node.attributes,
                    autoAttributes: node.autoAttributes,
                    pos: node.pos
                });
            }
            context = Context.Normal;
            accumulatedText = "";
        },
        code_language: (suffixes, startpos, endpos, pos) => {
            const top = topContainer();
            top.data.lang = input.substring(startpos, endpos + 1);
        },
        ["+div"]: (suffixes, startpos, endpos, pos) => {
            pushContainer(pos);
        },
        ["-div"]: (suffixes, startpos, endpos, pos) => {
            const node = popContainer(pos);
            addChildToTip({
                tag: "div",
                children: node.children,
                attributes: node.attributes,
                autoAttributes: node.autoAttributes,
                pos: node.pos
            });
        },
        thematic_break: (suffixes, startpos, endpos, pos) => {
            const tb = { tag: "thematic_break", pos: pos };
            addBlockAttributes(tb);
            addChildToTip(tb);
        },
        left_single_quote: (suffixes, startpos, endpos, pos) => {
            addChildToTip({ tag: "smart_punctuation",
                type: "left_single_quote",
                text: "'", pos: pos });
        },
        right_single_quote: (suffixes, startpos, endpos, pos) => {
            addChildToTip({ tag: "smart_punctuation",
                type: "right_single_quote",
                text: "'", pos: pos });
        },
        left_double_quote: (suffixes, startpos, endpos, pos) => {
            addChildToTip({ tag: "smart_punctuation",
                type: "left_double_quote",
                text: '"', pos });
        },
        right_double_quote: (suffixes, startpos, endpos, pos) => {
            addChildToTip({ tag: "smart_punctuation",
                type: "right_double_quote",
                text: '"', pos });
        },
        ellipses: (suffixes, startpos, endpos, pos) => {
            addChildToTip({ tag: "smart_punctuation",
                type: "ellipses",
                text: "...", pos });
        },
        en_dash: (suffixes, startpos, endpos, pos) => {
            addChildToTip({ tag: "smart_punctuation",
                type: "en_dash",
                text: "--", pos });
        },
        em_dash: (suffixes, startpos, endpos, pos) => {
            addChildToTip({ tag: "smart_punctuation",
                type: "em_dash",
                text: "---", pos });
        },
        // We set the blanklines property of a parent list or
        // sublist to aid with tight/loose list determination.
        blankline: (suffixes, startpos, endpos, pos) => {
            let listnode;
            if ("tight" in topContainer().data) {
                listnode = topContainer();
            }
            else if (containers.length >= 2 &&
                "tight" in containers[containers.length - 2].data) {
                listnode = containers[containers.length - 2];
            }
            if (listnode) {
                listnode.data.blanklines = true;
            }
        } };
    const handleEvent = function (containers, event) {
        let sp;
        let ep;
        let pos;
        if (options.sourcePositions) {
            sp = getSourceLoc(event.startpos);
            ep = getSourceLoc(event.endpos);
            pos = { start: sp, end: ep };
        }
        let annot = event.annot;
        let suffixes = [];
        if (event.annot.includes("|")) {
            const parts = event.annot.split("|");
            annot = parts[0];
            suffixes = parts.slice(1);
        }
        // The following is for tight/loose determination.
        // If blanklines have already been seen, and we're
        // about to process something other than a blankline,
        // the end of a list or list item, or the start of
        // a list, then it's a loose list.
        if (listDepth > 0 && annot !== "blankline") {
            let ln;
            const top = topContainer();
            if (top) {
                if (top.data && "tight" in top.data) {
                    ln = top;
                }
                else if (containers.length >= 2 &&
                    "tight" in containers[containers.length - 2].data) {
                    ln = containers[containers.length - 2];
                }
            }
            if (ln) {
                if (!/^[+-]list/.test(annot) && ln.data.blanklines) {
                    ln.data.tight = false;
                }
                if (!/^[-+]list_item$/.test(annot)) {
                    ln.data.blanklines = false;
                }
            }
        }
        const fn = handlers[annot];
        if (fn) {
            fn(suffixes, event.startpos, event.endpos, pos);
        }
    };
    const containers = [{
            children: [],
            data: { headinglevel: 0 },
            pos: {
                start: { line: 0, col: 0, offset: 0 },
                end: { line: 0, col: 0, offset: 0 }
            }
        }];
    let lastpos = 0;
    for (const event of parser) {
        handleEvent(containers, event);
        lastpos = event.endpos;
    }
    let lastloc;
    if (options.sourcePositions) {
        lastloc = getSourceLoc(lastpos);
    }
    // close any open sections:
    let pnode = topContainer();
    while (pnode && pnode.data.headinglevel > 0) {
        // close sections til we get to the doc level
        popContainer(lastloc && { start: lastloc, end: lastloc });
        addChildToTip({
            tag: "section",
            children: pnode.children,
            attributes: pnode.attributes,
            autoAttributes: pnode.autoAttributes,
            pos: pnode.pos
        });
        pnode = topContainer();
    }
    const doc = {
        tag: "doc",
        references: references,
        autoReferences: autoReferences,
        footnotes: footnotes,
        children: containers[0].children,
    };
    if (containers[0].autoAttributes) {
        doc.autoAttributes = containers[0].autoAttributes;
    }
    if (containers[0].attributes) {
        doc.attributes = containers[0].attributes;
    }
    return doc;
};
exports.parse = parse;
const omitFields = {
    children: true,
    tag: true,
    pos: true,
    attributes: true,
    autoAttributes: true,
    references: true,
    autoReferences: true,
    footnotes: true
};
const stringify = function (x) {
    return JSON.stringify(x).replace(/\\\n/g, "\\n");
};
const renderAstNode = function (node, buff, indent) {
    buff.push(" ".repeat(indent));
    if (indent > 128) {
        buff.push("(((DEEPLY NESTED CONTENT OMITTED)))\n");
        return;
    }
    buff.push(node.tag);
    if (node.pos) {
        buff.push(` (${node.pos.start.line}:${node.pos.start.col}:${node.pos.start.offset}-${node.pos.end.line}:${node.pos.end.col}:${node.pos.end.offset})`);
    }
    for (const k in node) {
        if (!omitFields[k]) {
            const v = node[k];
            if (v !== undefined && v !== null) {
                buff.push(` ${k}=${stringify(v)}`);
            }
        }
    }
    if (node.attributes) {
        for (const k in node.attributes) {
            buff.push(` ${k}=${stringify(node.attributes[k])}`);
        }
    }
    buff.push("\n");
    if (node.children) {
        for (const child of node.children) {
            renderAstNode(child, buff, indent + 2);
        }
    }
};
// Render an AST in human-readable form, with indentation
// showing the hierarchy.
const renderAST = function (doc) {
    const buff = [];
    renderAstNode(doc, buff, 0);
    if (Object.keys(doc.references).length > 0) {
        buff.push("references\n");
        for (const k in doc.references) {
            buff.push(`  [${stringify(k)}] =\n`);
            renderAstNode(doc.references[k], buff, 4);
        }
    }
    if (Object.keys(doc.footnotes).length > 0) {
        buff.push("footnotes\n");
        for (const k in doc.footnotes) {
            buff.push(`  [${stringify(k)}] =\n`);
            renderAstNode(doc.footnotes[k], buff, 4);
        }
    }
    return buff.join("");
};
exports.renderAST = renderAST;

},
"./version": function (exports, require, module) {
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = void 0;
exports.version = "0.3.2";

},
};
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
