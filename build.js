#!/usr/bin/env node
// ↑ "shebang" line — tells Unix-like systems to run this file with Node.js directly
//   so you can do `./build.js` instead of `node build.js` (after chmod +x build.js)

// Node.js built-in modules — no npm install needed
const fs = require("fs"); // file system: read/write files and directories
const path = require("path"); // path utilities: safely join/split file paths cross-platform

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIG
// Everything you'd want to change to make this blog yours lives here.
// This is the only section you need to edit to set up the blog.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CONFIG = {
  siteTitle: "Omar Shabana", // shown in <title> tags and the nav bar
  siteDescHeader: "Hi There! ... Who am I?",
  siteDescription:
    "My name is Omar. I'm a software engineer from Egypt. I write about software development and technology. My main interests are Web Development and Ml/AI.", // used in the homepage subtitle and RSS feed
  siteDescLinks: ["Email", "LinkedIn", "Github"],
  siteUrl: "https://omarshabana.com", // used for absolute URLs in RSS items and the feed's self-link
  author: "Omar Shabana", // shown in the footer copyright line
  postsDir: "./posts", // where markdown source files live (relative to this script)
  outputDir: "./public", // where generated HTML files are written
};

const LINK_MAP = {
  Email: "mailto:omar.h.shabana@gmail.com",
  LinkedIn: "https://linkedin.com/in/omar-shabana11",
  Github: "https://github.com/mirohhh",
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
// Small, reusable utility functions used throughout the rest of the file.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// HTML-escape a string so it's safe to inject into HTML attributes and content.
// Without this, a post title like `<script>alert('xss')</script>` would execute
// in the browser. We replace the four characters that have special meaning in HTML:
//   &  →  &amp;   (must be first, otherwise we'd double-escape the & we add below)
//   <  →  &lt;    (prevents opening a tag)
//   >  →  &gt;    (prevents closing a tag)
//   "  →  &quot;  (prevents breaking out of an attribute value)
const esc = (s) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Convert a date string (e.g. "2026-03-19") into a human-readable format.
// toLocaleDateString with 'en-US' and these options produces e.g. "March 19, 2026".
function formatDate(str) {
  return new Date(str).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Convert a date string to ISO 8601 format (e.g. "2026-03-19T00:00:00.000Z").
// This is used in <time datetime="..."> attributes, which is the machine-readable
// format browsers and search engines use to understand dates semantically.
function isoDate(str) {
  return new Date(str).toISOString();
}

// Estimate reading time in minutes.
// The industry standard assumption is ~200 words per minute for blog-style content.
// We split on whitespace (\s+) to count words, divide by 200, round up with ceil,
// and clamp to a minimum of 1 so we never show "0 min read".
function readingTime(text) {
  return Math.max(1, Math.ceil(text.split(/\s+/).length / 200));
}

// Turn an arbitrary string into a URL-safe slug.
// Used for two things: generating heading anchor IDs and tag page filenames.
// Steps:
//   1. lowercase everything
//   2. strip any character that isn't a word char (\w = a-z, 0-9, _), space, or hyphen
//   3. trim leading/trailing whitespace
//   4. replace remaining spaces with hyphens
// Example: "Hello, World!" → "hello-world"
function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // remove punctuation like commas, exclamation marks, etc.
    .trim()
    .replace(/\s+/g, "-"); // collapse multiple spaces into a single hyphen
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FRONTMATTER PARSER
//
// Frontmatter is metadata at the very top of a markdown file, sandwiched between
// two lines containing only "---". It looks like this:
//
//   ---
//   title: Hello World
//   date: 2026-03-19
//   tags: [code, javascript]
//   ---
//
// This section is NOT content — it's a simple key: value store that provides
// structured data about the post (title, date, tags, description, etc.).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function parseFrontmatter(raw) {
  // This regex matches the entire frontmatter block structure:
  //   ^          — start of string
  //   ---\r?\n   — opening "---" (with optional \r for Windows line endings)
  //   ([\s\S]*?) — capture group 1: the key/value content inside (non-greedy)
  //   \r?\n---\r?\n — closing "---"
  //   ([\s\S]*)  — capture group 2: everything after (the actual markdown body)
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);

  // If no frontmatter block is found, return an empty meta object and the whole
  // file as the body. This lets you have .md files without frontmatter.
  if (!match) return { meta: {}, body: raw };

  const meta = {};

  // match[1] is the raw frontmatter text. Split it into individual lines
  // and parse each one as "key: value".
  for (const line of match[1].split("\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) continue; // skip any line without a colon (blank lines, etc.)

    const key = line.slice(0, colon).trim();

    // Everything after the colon is the value. We also strip surrounding
    // quotes so both `title: "Hello"` and `title: Hello` work the same.
    let val = line
      .slice(colon + 1)
      .trim()
      .replace(/^["']|["']$/g, "");

    // Special case: the `tags` field is an array, written as [tag1, tag2].
    // Strip the square brackets, split on commas, and trim each tag.
    // filter(Boolean) drops any empty strings that result from trailing commas.
    if (key === "tags") {
      val = val
        .replace(/^\[|\]$/g, "") // remove [ and ]
        .split(",") // split into individual tags
        .map((t) => t.trim()) // trim whitespace from each
        .filter(Boolean); // discard empty values
    }

    meta[key] = val;
  }

  // match[2] is everything after the closing "---" — the actual post content.
  return { meta, body: match[2] };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MARKDOWN PARSER
//
// Markdown is converted to HTML in two passes:
//
//   1. INLINE pass  — runs on individual lines of text within a block.
//      Handles: bold, italic, strikethrough, inline code, links, images.
//
//   2. BLOCK pass   — reads the file line by line, identifies the type of
//      each block (heading, code fence, list, paragraph…), collects its lines,
//      then calls inline() on the text content.
//
// This "two-pass" approach mirrors how real markdown parsers work, and keeps
// the code cleanly separated.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── Inline parser ─────────────────────────────────────────────────────────────
//
// Applies a chain of regex replacements to handle inline markdown syntax.
// ORDER MATTERS — patterns that can contain each other must go first:
//   - Images before links: `![alt](url)` starts with `!` followed by `[`, so if
//     we ran the link regex first it would match the `[alt]` part incorrectly.
//   - Bold-italic (***) before bold (**) before italic (*): matching longer
//     delimiters first prevents the shorter ones from eating the extra asterisks.

function inline(text) {
  // ── Step 1: extract inline code spans into placeholders ─────────────────
  // Code spans must be pulled out FIRST so their contents are never touched
  // by any other regex (e.g. `***` inside backticks must not become bold-italic).
  // We HTML-escape the code content here so characters like < and & are safe.
  const codeSpans = [];
  text = text.replace(/`([^`]+)`/g, (_, code) => {
    codeSpans.push(`<code>${esc(code)}</code>`);
    return `\x00${codeSpans.length - 1}\x00`; // null-byte placeholder, safe delimiter
  });

  // ── Step 2: all other inline replacements ───────────────────────────────
  text = text
    // Images: ![alt](url)  →  <img src="url" alt="alt">
    // Must come before links — the pattern is a superset of the link pattern.
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')

    // Links with optional title: [text](url) or [text](url "title")
    // The title part is captured and forwarded to the title="" attribute.
    .replace(
      /\[([^\]]+)\]\(([^)"]+?)(?:\s+"([^"]*)")?\)/g,
      (_, txt, href, title) =>
        title
          ? `<a href="${href}" title="${title}">${txt}</a>`
          : `<a href="${href}">${txt}</a>`,
    )

    // Auto-links: <https://...>  →  <a href="...">...</a>
    .replace(/<(https?:\/\/[^>]+)>/g, '<a href="$1">$1</a>')

    // Auto-links: <email@example.com>  →  <a href="mailto:...">...</a>
    .replace(/<([^\s@>]+@[^\s@>]+\.[^\s@>]+)>/g, '<a href="mailto:$1">$1</a>')

    // Bold + italic: ***text***  →  <strong><em>text</em></strong>
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")

    // Bold: **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")

    // Italic: *text* or _text_
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")

    // Strikethrough: ~~text~~
    .replace(/~~(.+?)~~/g, "<del>$1</del>");

  // ── Step 3: restore code spans ──────────────────────────────────────────
  return text.replace(/\x00(\d+)\x00/g, (_, i) => codeSpans[+i]);
}

// ── Table helpers ─────────────────────────────────────────────────────────────

// Split a GFM table row into individual cell strings.
// Pipes at the very start and end are decorative — strip them before splitting.
// Example: "| foo | bar |" → ["foo", "bar"]
function parseTableRow(line) {
  let cells = line.split("|");
  if (cells[0].trim() === "") cells = cells.slice(1);
  if (cells[cells.length - 1].trim() === "") cells = cells.slice(0, -1);
  return cells.map((c) => c.trim());
}

// Read text-alignment from a separator cell like :---, ---:, :---:, or ---
// Returns 'left', 'right', 'center', or '' (no explicit alignment).
function colAlignment(cell) {
  const c = cell.trim();
  const left = c.startsWith(":");
  const right = c.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return "";
}

// ── List helper ───────────────────────────────────────────────────────────────

// Recursively parses a ul or ol starting at line `i`, where every item at this
// level is indented by exactly `baseIndent` spaces.
// Returns { html, newI } — newI is the first line not consumed.
// `inlineFn` is the inline parser to use (supports footnote-aware variant).
//
// Handles:
//   - Nested lists  (items indented deeper become sub-lists)
//   - Task lists    ("- [ ] text" / "- [x] text" become checkboxes)
//   - Mixed nesting (a ul item can contain an ol sub-list and vice versa)
function parseList(lines, i, baseIndent, inlineFn) {
  const firstContent = lines[i].slice(baseIndent);
  const isOrdered = /^\d+\. /.test(firstContent);
  const tag = isOrdered ? "ol" : "ul";
  const items = [];

  while (i < lines.length) {
    const line = lines[i];
    const lineIndent = line.match(/^( *)/)[1].length;

    if (lineIndent < baseIndent) break; // exited this list level

    const content = line.slice(baseIndent);
    const ulM = content.match(/^[-*+] (.*)/);
    const olM = content.match(/^\d+\. (.*)/);

    if (!ulM && !olM) break; // not a list item — stop
    if (!!olM !== isOrdered) break; // list type switched — let caller handle

    const text = ulM ? ulM[1] : content.replace(/^\d+\. /, "");
    i++;

    // Task-list checkbox: "[ ] " (unchecked) or "[x]"/"[X]" (checked)
    let itemHtml;
    const taskM = text.match(/^\[( |x)\] (.*)/i);
    if (taskM) {
      const checked = taskM[1].toLowerCase() === "x" ? " checked" : "";
      itemHtml = `<input type="checkbox" disabled${checked}> ${inlineFn(taskM[2])}`;
    } else {
      itemHtml = inlineFn(text);
    }

    // Sub-list: if the next line is indented deeper, recurse
    let subHtml = "";
    if (i < lines.length) {
      const nextIndent = lines[i].match(/^( *)/)[1].length;
      const nextContent = lines[i].slice(nextIndent);
      if (
        nextIndent > baseIndent &&
        (/^[-*+] /.test(nextContent) || /^\d+\. /.test(nextContent))
      ) {
        const sub = parseList(lines, i, nextIndent, inlineFn);
        subHtml = sub.html;
        i = sub.newI;
      }
    }

    items.push(`<li>${itemHtml}${subHtml}</li>`);
  }

  return { html: `<${tag}>${items.join("")}</${tag}>`, newI: i };
}

// ── Block parser ──────────────────────────────────────────────────────────────
//
// Works as a simple state machine. We maintain an index `i` into the lines array
// and advance it manually. Each block type consumes one or more lines and then
// emits its HTML. The key insight: instead of regex-matching the whole document,
// we process it line-by-line in a while loop, which gives us full control over
// how many lines each block consumes.

function parseMarkdown(md) {
  // ── Footnote pre-pass ──────────────────────────────────────────────────────
  // Strip [^label]: definition lines out of the body before block-parsing,
  // storing their text for rendering at the bottom of the document.
  // This prevents definitions from accidentally becoming paragraphs.
  const footnoteDefs = {};
  const lines = md.split("\n").filter((line) => {
    const m = line.match(/^\[\^([^\]]+)\]:\s*(.*)/);
    if (m) {
      footnoteDefs[m[1]] = m[2];
      return false;
    }
    return true;
  });

  // footnoteOrder tracks which labels are referenced, in first-appearance order,
  // so we can number them consistently across the document.
  const footnoteOrder = [];

  // inlineF wraps inline() and additionally handles [^label] footnote references.
  // Refs become numbered superscript links: <sup><a href="#fn-label">N</a></sup>
  function inlineF(text) {
    return inline(text).replace(/\[\^([^\]]+)\]/g, (_, label) => {
      if (!footnoteOrder.includes(label)) footnoteOrder.push(label);
      const n = footnoteOrder.indexOf(label) + 1;
      return `<sup><a href="#fn-${label}" id="fnref-${label}">${n}</a></sup>`;
    });
  }

  const out = []; // accumulates HTML output strings
  let i = 0; // current line index — we advance this manually

  while (i < lines.length) {
    const line = lines[i];

    // ── Raw HTML passthrough ──────────────────────────────────────────────────
    // Any line starting with an HTML tag (opening or closing) is passed through
    // verbatim — no escaping, no inline() processing. We collect all consecutive
    // non-blank lines so multi-line blocks like <details>…</details> stay intact.
    if (/^<\/?[a-zA-Z]/.test(line)) {
      const html = [];
      while (i < lines.length && lines[i].trim()) {
        html.push(lines[i]);
        i++;
      }
      out.push(html.join("\n"));
      continue;
    }

    // ── Fenced code block ─────────────────────────────────────────────────────
    // A fenced code block starts with ``` (optionally followed by a language name)
    // and ends with another ```. Everything inside is treated as literal text —
    // we do NOT call inline() on it, and we HTML-escape it so tags don't render.
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim(); // extract language hint, e.g. "js" from "```js"
      const code = [];
      i++; // move past the opening ```

      while (i < lines.length && !lines[i].startsWith("```")) {
        code.push(esc(lines[i]));
        i++;
      }

      const cls = lang ? ` class="language-${lang}"` : "";
      out.push(`<pre><code${cls}>${code.join("\n")}</code></pre>`);
      i++; // move past the closing ```
      continue;
    }

    // ── ATX headings ──────────────────────────────────────────────────────────
    // ATX-style headings start with 1–6 # characters followed by a space.
    const hm = line.match(/^(#{1,6})\s+(.*)/);
    if (hm) {
      const lvl = hm[1].length;
      const txt = inlineF(hm[2]);
      const id = slugify(hm[2]);
      out.push(`<h${lvl} id="${id}">${txt}</h${lvl}>`);
      i++;
      continue;
    }

    // ── Setext headings ───────────────────────────────────────────────────────
    // A non-blank line followed by ==== becomes <h1>; followed by ---- becomes <h2>.
    // Must be checked BEFORE the horizontal-rule handler so a bare "---" line is
    // only treated as a setext underline when a text line immediately precedes it.
    if (
      line.trim() &&
      i + 1 < lines.length &&
      /^={2,}\s*$/.test(lines[i + 1])
    ) {
      out.push(`<h1 id="${slugify(line)}">${inlineF(line)}</h1>`);
      i += 2;
      continue;
    }
    if (
      line.trim() &&
      i + 1 < lines.length &&
      /^-{2,}\s*$/.test(lines[i + 1])
    ) {
      out.push(`<h2 id="${slugify(line)}">${inlineF(line)}</h2>`);
      i += 2;
      continue;
    }

    // ── Horizontal rule ───────────────────────────────────────────────────────
    // A line of 3+ dashes, asterisks, or underscores → <hr>
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }

    // ── Blockquote ────────────────────────────────────────────────────────────
    // Lines starting with "> " are collected into a single <blockquote>.
    if (line.startsWith("> ")) {
      const ql = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        ql.push(inlineF(lines[i].slice(2)));
        i++;
      }
      out.push(`<blockquote><p>${ql.join("<br>")}</p></blockquote>`);
      continue;
    }

    // ── GFM table ─────────────────────────────────────────────────────────────
    // Identified by a header row containing `|`, followed by a separator row
    // (cells of dashes, optionally with colons for alignment).
    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      /^\|?[\s:|-]+\|/.test(lines[i + 1]) &&
      lines[i + 1].includes("-")
    ) {
      const headers = parseTableRow(line);
      const aligns = parseTableRow(lines[i + 1]).map(colAlignment);
      i += 2; // consume header + separator

      const headCells = headers
        .map((h, ci) => {
          const align = aligns[ci] ? ` style="text-align:${aligns[ci]}"` : "";
          return `<th${align}>${inlineF(h)}</th>`;
        })
        .join("");
      const thead = `<thead><tr>${headCells}</tr></thead>`;

      const bodyRows = [];
      while (i < lines.length && lines[i].includes("|")) {
        const tds = parseTableRow(lines[i])
          .map((c, ci) => {
            const align = aligns[ci] ? ` style="text-align:${aligns[ci]}"` : "";
            return `<td${align}>${inlineF(c)}</td>`;
          })
          .join("");
        bodyRows.push(`<tr>${tds}</tr>`);
        i++;
      }

      const tbody = bodyRows.length
        ? `<tbody>${bodyRows.join("")}</tbody>`
        : "";
      out.push(`<table>${thead}${tbody}</table>`);
      continue;
    }

    // ── Unordered list ────────────────────────────────────────────────────────
    // Lines starting with "- ", "* ", or "+ " at any indentation.
    // Delegates to parseList() for nesting and task-list support.
    if (/^[-*+] /.test(line)) {
      const { html, newI } = parseList(lines, i, 0, inlineF);
      out.push(html);
      i = newI;
      continue;
    }

    // ── Ordered list ──────────────────────────────────────────────────────────
    // Lines starting with "1. ", "2. ", etc.
    if (/^\d+\. /.test(line)) {
      const { html, newI } = parseList(lines, i, 0, inlineF);
      out.push(html);
      i = newI;
      continue;
    }

    // ── Blank line ────────────────────────────────────────────────────────────
    if (!line.trim()) {
      i++;
      continue;
    }

    // ── Paragraph ─────────────────────────────────────────────────────────────
    // A run of consecutive lines that don't match any block syntax above.
    // Extra stop conditions vs. the original:
    //   - raw HTML tag at start of line
    //   - table row (contains |)
    //   - setext underline on the NEXT line (current line becomes a heading)
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() && // not blank
      !lines[i].startsWith("#") && // not ATX heading
      !lines[i].startsWith("```") && // not code fence
      !lines[i].startsWith("> ") && // not blockquote
      !/^[-*+] /.test(lines[i]) && // not ul item
      !/^\d+\. /.test(lines[i]) && // not ol item
      !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i]) && // not hr
      !/^<\/?[a-zA-Z]/.test(lines[i]) && // not raw HTML
      !lines[i].includes("|") && // not table row
      !(i + 1 < lines.length && /^={2,}\s*$/.test(lines[i + 1])) && // not setext h1
      !(i + 1 < lines.length && /^-{2,}\s*$/.test(lines[i + 1])) // not setext h2
    ) {
      para.push(lines[i]);
      i++;
    }

    // A line ending with two or more spaces is a "hard line break" (CommonMark §6.7).
    if (para.length) {
      const parts = para.map((l, idx) => {
        const isLast = idx === para.length - 1;
        const hardBreak = !isLast && /  $/.test(l);
        return hardBreak ? inlineF(l.trimEnd()) + "<br>" : inlineF(l);
      });
      out.push(`<p>${parts.join(" ")}</p>`);
    }
  }

  // ── Footnotes section ──────────────────────────────────────────────────────
  // If any [^label] references were found, render the definitions as a numbered
  // list at the bottom of the document, each with a ↩ back-link to its reference.
  if (footnoteOrder.length > 0) {
    const items = footnoteOrder
      .filter((label) => footnoteDefs[label])
      .map((label, idx) => {
        return `<li id="fn-${label}">${inline(footnoteDefs[label])} <a href="#fnref-${label}" aria-label="Back to content">↩</a></li>`;
      });
    if (items.length) {
      out.push(
        `<section class="footnotes"><hr><ol>${items.join("")}</ol></section>`,
      );
    }
  }

  return out.join("\n");
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CSS
//
// Styles live in style.css (next to this file) and are copied into public/
// during the build step. Every HTML page links to /style.css.
//
// Benefits over inlining:
//   - Browser caches the file after the first visit — not re-downloaded per page
//   - Proper editor support: syntax highlighting, linting, autocomplete
//   - Smaller HTML files — styles are no longer duplicated across every page
//   - One file to edit when you want to change the look
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HTML TEMPLATES
//
// These functions assemble the final HTML strings for each page type.
// They're kept as simple string templates — no library, no JSX, just backtick
// template literals with interpolation. Each function returns a full HTML string.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Returns the <nav> HTML used at the top of every page.
function navHtml() {
  return `<nav>
  <a class="site-title" href="/">Home</a>
  <div class="nav-links">
    <a href="/feed.xml">RSS</a>
  </div>
</nav>`;
}

// Returns the <footer> HTML used at the bottom of every page.
// new Date().getFullYear() automatically gives the current year — no manual updates needed.
function footerHtml() {
  return `<footer>
  <p>© ${new Date().getFullYear()} ${CONFIG.author} ── built with a <a href="https://github.com/mirohhh/markdown-parser">custom markdown parser</a></p>
</footer>`;
}

// Returns <link> and <script> tags that load Prism.js for syntax highlighting.
// Prism is loaded from a CDN (no local install) and uses its "autoloader" plugin,
// which automatically fetches the correct language grammar when it sees a
// <code class="language-xxx"> element — so we only load what's actually needed.
// The "prism-tomorrow" theme is a dark code theme that works well for both light/dark modes.
function prismScripts() {
  const base = "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0";
  return `
  <link rel="stylesheet" href="${base}/themes/prism-tomorrow.min.css">
  <script src="${base}/prism.min.js"></script>
  <script src="${base}/plugins/autoloader/prism-autoloader.min.js"></script>`;
}

// The "shell" function wraps any page's body content in a complete HTML document.
// Every page (posts, index, tag pages) calls this with its own content.
// Parameters:
//   title       — goes into <title> and browser tab
//   description — goes into <meta name="description"> for SEO
//   head        — optional extra content for <head> (unused currently, available for extension)
//   body        — the main content HTML (everything between <main> tags)
function htmlShell({ title, description = "", head = "", body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${esc(description)}">
  <!-- RSS autodiscovery: browsers and feed readers find the feed automatically -->
  <link rel="alternate" type="application/rss+xml" title="${CONFIG.siteTitle}" href="/feed.xml">
  <link rel="stylesheet" href="/style.css">${head}
</head>
<body>
${navHtml()}
<main>${body}</main>
${footerHtml()}
${prismScripts()}
</body>
</html>`;
}

// ── Page: individual blog post ────────────────────────────────────────────────
// Receives a fully parsed post object and returns the HTML for the post page.
// The post object shape is: { slug, meta, body, html }
//   slug — filename without .md, used for the URL
//   meta — frontmatter key/value pairs (title, date, tags, description)
//   body — raw markdown text (used for reading time calculation)
//   html — already-parsed HTML from parseMarkdown()
function postPage(post) {
  // Build tag pill links for this post (may be empty if no tags)
  const tagLinks = (post.meta.tags || [])
    .map((t) => `<a class="tag" href="/tags/${slugify(t)}.html">#${t}</a>`)
    .join("");

  const body = `
    <p><a class="back-link" href="/">← All posts</a></p>
    <article>
      <h1>${esc(post.meta.title)}</h1>
      <div class="post-meta">
        <!-- <time datetime="..."> is semantic HTML: machine-readable date for SEO/accessibility -->
        <time datetime="${isoDate(post.meta.date)}">${formatDate(post.meta.date)}</time>
        <span>·</span>
        <span>${readingTime(post.body)} min read</span>
        <!-- only render the tags section if this post has tags -->
        ${tagLinks ? `<span>·</span><div class="tags">${tagLinks}</div>` : ""}
      </div>
      <!-- post.html is the fully parsed markdown → HTML content -->
      ${post.html}
    </article>`;

  return htmlShell({
    title: `${post.meta.title}`, // "Post Title — Blog Name"
    description: post.meta.description || "",
    body,
  });
}

// ── Page: homepage / post index ───────────────────────────────────────────────
// Receives the full sorted array of posts and renders a list of them.
function indexPage(posts, work) {
  // Map each post to a list item, then join them all into one string
  const items = posts
    .map((p) => {
      const tagLinks = (p.meta.tags || [])
        .map((t) => `<a class="tag" href="/tags/${slugify(t)}.html">#${t}</a>`)
        .join("");

      return `<li class="post-item">
      <h2><a href="/posts/${p.slug}.html">${esc(p.meta.title)}</a></h2>
      <div class="item-meta">
        <!-- <time datetime="..."> is semantic HTML: machine-readable date for SEO/accessibility -->
        <time datetime="${isoDate(p.meta.date)}">${formatDate(p.meta.date)}</time>
        <span>·</span>
        <span>${readingTime(p.body)} min read</span>
        <!-- only render the tags section if this post has tags -->
        ${tagLinks ? `<span>·</span><div class="tags">${tagLinks}</div>` : ""}
      </div>
      <!-- description is optional — only show it if it exists in frontmatter -->
      ${p.meta.description ? `<p>${esc(p.meta.description)}</p>` : ""}
    </li>`;
    })
    .join("\n");

  const body = `
    <div class="index-header">
      <h1>${CONFIG.siteDescHeader}</h1>
      <p>${CONFIG.siteDescription}</p>
      <div class="site-links">
      ${(CONFIG.siteDescLinks || [])
        .map((link) => {
          const href = LINK_MAP[link] || "#";
          return `<a href="${href}">${link}</a> <span>·</span>`;
        })
        .join("")}
      </div>
    </div>
    <div class='recent'>
    <h2>Recent Posts</h2>
    <p><a class="back-link" href="/posts.html">All Posts →</a></p>
    </div>

    <ul class="post-list">${items}</ul>
    <div class='work'>
    <h2>Work</h2>
    <div>${parseMarkdown(work)}</div>
    </div>
    `;

  return htmlShell({
    title: CONFIG.siteTitle,
    description: CONFIG.siteDescription,
    body,
  });
}
// -- Page: posts page ---------------------
//
//
//
function postsPage(posts) {
  const items = posts
    .map((p) => {
      const tagLinks = (p.meta.tags || [])
        .map((t) => `<a class="tag" href="/tags/${slugify(t)}.html">#${t}</a>`)
        .join("");

      return `<li class="post-item">
      <h2><a href="/posts/${p.slug}.html">${esc(p.meta.title)}</a></h2>
      <div class="item-meta">
        <!-- <time datetime="..."> is semantic HTML: machine-readable date for SEO/accessibility -->
        <time datetime="${isoDate(p.meta.date)}">${formatDate(p.meta.date)}</time>
        <span>·</span>
        <span>${readingTime(p.body)} min read</span>
        <!-- only render the tags section if this post has tags -->
        ${tagLinks ? `<span>·</span><div class="tags">${tagLinks}</div>` : ""}
      </div>
      <!-- description is optional — only show it if it exists in frontmatter -->
      ${p.meta.description ? `<p>${esc(p.meta.description)}</p>` : ""}
    </li>`;
    })
    .join("\n");

  const body = `
    <h1>All Posts</h1>
    <ul class="post-list">${items}</ul>`;

  return htmlShell({
    title: "Posts",
    // description: ,
    body,
  });
}

// ── Page: tag archive ─────────────────────────────────────────────────────────
// Renders a filtered list of posts that share a particular tag.
// tag   — the display name of the tag (e.g. "javascript")
// posts — the subset of posts that have this tag
function tagPage(tag, posts) {
  const items = posts
    .map(
      (p) => `
    <li class="post-item">
      <h2><a href="/posts/${p.slug}.html">${esc(p.meta.title)}</a></h2>
      <div class="item-meta">
        <time datetime="${isoDate(p.meta.date)}">${formatDate(p.meta.date)}</time>
        <span>·</span>
        <span>${readingTime(p.body)} min read</span>
      </div>
      ${p.meta.description ? `<p>${esc(p.meta.description)}</p>` : ""}
    </li>`,
    )
    .join("\n");

  const body = `
    <p><a class="back-link" href="/">← All posts</a></p>
    <br>
    <h1 class="tag-heading">Posts tagged <span>#${esc(tag)}</span></h1>
    <ul class="post-list">${items}</ul>`;

  return htmlShell({
    title: `#${tag} — ${CONFIG.siteTitle}`,
    description: `Posts tagged ${tag}`,
    body,
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RSS FEED
//
// RSS is an XML format that lets readers subscribe to your blog and get notified
// of new posts automatically. Feed readers (Feedly, NetNewsWire, etc.) poll
// your /feed.xml and show new items.
//
// Structure:
//   <rss> root element
//     <channel> — one per feed, contains metadata + all items
//       <item>  — one per post
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Returns the XML for a single RSS <item> (one blog post).
// <guid> is a globally unique identifier for the item — we use the full URL.
// <pubDate> uses RFC 822 format (toUTCString) which is what the RSS spec requires.
function rssItem(post) {
  return `  <item>
    <title>${esc(post.meta.title)}</title>
    <link>${CONFIG.siteUrl}/${post.slug}.html</link>
    <guid>${CONFIG.siteUrl}/${post.slug}.html</guid>
    <pubDate>${new Date(post.meta.date).toUTCString()}</pubDate>
    <description>${esc(post.meta.description || "")}</description>
  </item>`;
}

// Returns the complete RSS feed XML document.
// The xmlns:atom namespace and <atom:link> self-referencing element are technically
// optional, but strongly recommended — they help feed validators and aggregators
// correctly identify and handle the feed.
function rssFeed(posts) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${CONFIG.siteTitle}</title>
  <link>${CONFIG.siteUrl}</link>
  <description>${CONFIG.siteDescription}</description>
  <language>en-us</language>
  <!-- The atom:link self-reference is required for RSS validators and recommended by the spec -->
  <atom:link href="${CONFIG.siteUrl}/feed.xml" rel="self" type="application/rss+xml"/>
${posts.map(rssItem).join("\n")}
</channel>
</rss>`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BUILD
//
// The main entry point. Orchestrates the entire pipeline:
//   1. Create output directories
//   2. Read and parse all .md files
//   3. Sort posts newest-first
//   4. Write one .html file per post
//   5. Write index.html
//   6. Collect all tags, write one .html file per tag
//   7. Write feed.xml
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function build() {
  const { postsDir, outputDir } = CONFIG;

  // Create output directories if they don't exist yet.
  // { recursive: true } means: create parent directories as needed, and don't
  // error if the directory already exists (idempotent).
  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(path.join(outputDir, "tags"), { recursive: true });
  fs.mkdirSync(path.join(outputDir, "posts"), { recursive: true });

  // ── Step 1: Read and parse all posts ──────────────────────────────────────
  // Get all filenames in posts/, keep only .md files
  const mdFiles = fs.readdirSync(postsDir).filter((f) => f.endsWith(".md"));

  const posts = mdFiles.map((file) => {
    // Read the raw file content as a UTF-8 string
    const raw = fs.readFileSync(path.join(postsDir, file), "utf8");

    // Split into frontmatter metadata and markdown body
    const { meta, body } = parseFrontmatter(raw);

    // The URL slug is the filename without the .md extension.
    // e.g. "hello-world.md" → slug "hello-world" → URL "/hello-world.html"
    const slug = path.basename(file, ".md");

    // Convert the markdown body to HTML
    const html = parseMarkdown(body);

    // Return a post object that all the template functions expect
    return { slug, meta, body, html };
  });

  // ── Step 2: Sort newest-first ─────────────────────────────────────────────
  // Subtracting two Date objects coerces them to milliseconds since epoch,
  // so (b - a) gives descending order (newest first).
  posts.sort((a, b) => new Date(b.meta.date) - new Date(a.meta.date));

  // ── Step 3: Write individual post pages ───────────────────────────────────
  for (const post of posts) {
    const dest = path.join(outputDir, "posts", `${post.slug}.html`);
    fs.writeFileSync(dest, postPage(post));
    console.log(`  ✓ ${post.slug}.html`);
  }

  fs.writeFileSync(path.join(outputDir, "posts.html"), postsPage(posts));
  console.log("  ✓ posts.html");
  // ── Step 4: Write the homepage ────────────────────────────────────────────
  fs.writeFileSync(
    path.join(outputDir, "index.html"),
    indexPage(
      posts.slice(0, 3),
      fs.readFileSync(path.join("./work", "work.md"), "utf8"),
    ),
  );
  console.log("  ✓ index.html");

  // ── Step 5: Build tag index and write one page per tag ────────────────────
  // tagMap groups posts by their slugified tag name.
  // Shape: { "javascript": { label: "javascript", posts: [...] }, ... }
  const tagMap = {};

  for (const post of posts) {
    for (const tag of post.meta.tags || []) {
      const key = slugify(tag); // normalize the tag to a URL-safe key

      // Initialize the tag entry if this is the first post with this tag
      if (!tagMap[key]) tagMap[key] = { label: tag, posts: [] };

      tagMap[key].posts.push(post);
    }
  }

  // Write one HTML file per unique tag into public/tags/
  for (const [key, { label, posts: tagged }] of Object.entries(tagMap)) {
    const dest = path.join(outputDir, "tags", `${key}.html`);
    fs.writeFileSync(dest, tagPage(label, tagged));
    console.log(`  ✓ tags/${key}.html`);
  }

  // ── Step 6: Copy the stylesheet ──────────────────────────────────────────
  // style.css lives next to build.js in the project root. We copy it into
  // public/ so it's served alongside the HTML files. This is the only file
  // that needs copying — everything else is generated fresh each build.
  fs.copyFileSync("./style.css", path.join(outputDir, "style.css"));
  console.log("  ✓ style.css");

  // ── Step 7: Write the RSS feed ────────────────────────────────────────────
  fs.writeFileSync(path.join(outputDir, "feed.xml"), rssFeed(posts));
  console.log("  ✓ feed.xml");

  console.log(`\nDone! ${posts.length} post(s) built → ${outputDir}/`);
}

// ── Kick everything off ───────────────────────────────────────────────────────
// Call build() immediately when the script runs. There's no async work, no
// watchers, no server — just a synchronous top-to-bottom build.
build();
