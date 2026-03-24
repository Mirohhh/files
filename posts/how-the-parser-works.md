---
title: How the Markdown Parser Works
date: 2026-03-15
description: A walkthrough of the custom markdown parser powering this blog.
tags: [code, javascript]
---

This blog runs on a custom markdown parser written in Node.js. Let's walk through how it works.

## The approach

The parser works in two passes. First, a pre-pass strips out footnote definitions and stores them by label. Then the main pass reads the source line by line, decides what kind of block each line starts, collects its content, and emits HTML.

There are two levels of parsing:

1. **Block-level** — headings, code fences, lists, tables, blockquotes, paragraphs
2. **Inline-level** — bold, italic, links, inline code, footnote references, and more

## Inline parsing

Inline parsing runs on the *text content* of each block using a chain of regex replacements. Order matters — images must come before links, and bold-italic (`***`) before bold (`**`) before italic (`*`), so longer delimiters are matched first:

```js
function inline(text, ctx) {
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)"]+)(?:\s+"([^"]*)")?\)/g, ...)
    .replace(/<(https?:\/\/[^>]+)>/g, '<a href="$1">$1</a>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g,     '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,         '<em>$1</em>')
    .replace(/~~(.+?)~~/g,         '<del>$1</del>')
    .replace(/`([^`]+)`/g,         '<code>$1</code>');
}
```

The `ctx` parameter carries footnote state across the document so references can be numbered in the order they appear.

## Block parsing

For each line, the parser checks a series of patterns in priority order:

- Starts with `<tag` → raw HTML passthrough
- Starts with ` ``` ` → fenced code block (collect until closing fence)
- Starts with `#` → ATX heading
- Next line is `===` or `---` → setext heading
- Matches `---`, `***`, `___` → horizontal rule
- Starts with `> ` → blockquote
- Contains `|` with a separator row next → table
- Starts with `- `, `* `, `+ `, or `N.` → list (handled recursively for nesting)
- Empty → skip
- Anything else → paragraph

## Nested lists

Lists are handled by a separate recursive function `renderList()`. When it encounters lines indented deeper than the current level, it recurses to build a child `<ul>` or `<ol>`. This supports arbitrary nesting depth:

```js
function renderList(listLines, indent, ctx) {
  // collect items at this indent level
  // when sub-lines are found, recurse:
  const subIndent = subLines[0].match(/^(\s*)/)[1].length;
  nested = renderList(subLines, subIndent, ctx);
}
```

Task list items (`- [ ]` / `- [x]`) are detected inside the list renderer and rendered as disabled checkboxes.

## Tables

GFM pipe tables are parsed by `renderTable()`. The separator row drives column alignment — colons on either side mean center, colon on the right means right-aligned:

```js
const aligns = separator.map(s => {
  if (/^:-+:$/.test(s)) return ' style="text-align:center"';
  if (/^-+:$/.test(s))  return ' style="text-align:right"';
  return '';
});
```

## Footnotes

Footnote definitions (<code>[^label]: text</code>) are stripped out in a pre-pass before block parsing, so they don't accidentally render as paragraphs. References (<code>[^label]</code>) in the body are replaced with numbered superlinks. At the end of the document, all referenced footnotes are rendered as a numbered list with back-links.[^example]

## Raw HTML passthrough

Any line starting with an HTML tag is passed through verbatim without escaping. This lets you drop `<video>`, `<details>`, `<figure>`, or any custom element directly into a post when markdown isn't enough.

---

The full source is in `build.js`. The parser, including all features, comes in under 200 lines.

---

## Live examples

Everything below is a live test of each feature.

### Inline formatting

**bold**, *italic*, ***bold and italic***, ~~strikethrough~~, `inline code`

A [regular link](https://example.com) and a [link with a title](https://example.com "I am the title, hover me").

Auto-links: <https://example.com> and an email address <hello@example.com>.

### Headings (setext style)

Setext H1
=========

Setext H2
---------

### Blockquote

> This is a blockquote.
> It can span multiple lines
> and they all merge into one block.

### Unordered list with nesting

- Apples
- Bananas[^banan]
    - Cavendish
    - Plantain
        - Green plantain
        - Ripe plantain
- Cherries

### Ordered list with nesting

1. First
2. Second
    1. Sub-item A
    2. Sub-item B
3. Third

### Task list

- [x] Build the markdown parser
- [x] Add nested list support
- [x] Add table support
- [x] Add footnote support
- [ ] World domination

### Table

| Feature         | Supported | Notes                        |
| --------------- | :-------: | ---------------------------: |
| Bold / italic   | ✓         | `**bold**`, `*italic*`       |
| Nested lists    | ✓         | Arbitrary depth              |
| Tables          | ✓         | Left, center, right align    |
| Footnotes       | ✓         | Auto-numbered, with backlink |
| HTML passthrough| ✓         | Any tag at line start        |

### Code block

```js
// A fenced code block with syntax highlighting via Prism.js
const greet = name => `Hello, ${name}!`;
console.log(greet('world'));
```

### Footnote examples

The parser handles footnotes inline[^one] and you can have as many as you like.[^two] They are numbered in the order they appear in the text, not the order they are defined.

### Raw HTML passthrough

<details>
<summary>Click to expand — this is a native HTML details element</summary>
This content is written as raw HTML directly in the markdown source. The parser passes it through untouched. Useful for accordions, videos, figures, or anything markdown can't express.
</details>

[^example]: Like this one. Click the arrow to jump back.
[^one]: This is the first footnote. It will appear in the list at the bottom.
[^two]: And this is the second. Note the numbered superscripts above.
[^banan]: Bananas are yellow.