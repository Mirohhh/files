---
title: Hello, World
date: 2026-03-19
description: The first post on this blog — why I'm writing and what to expect.
tags: [meta, writing]
---

![Hello Hero](/assets/hello.jpg)

Every blog starts somewhere. This is mine.

I've been meaning to start writing for years. Not because I have anything uniquely brilliant to say, but because writing is how I think. And thinking out loud — even to no one — tends to produce better thoughts than thinking quietly.

## What this is

This blog is a place for things I find interesting. Expect posts about:

- Software, tools, and how things are built
- Books I'm reading and ideas I'm chewing on
- Occasional personal updates

No particular schedule. No particular audience in mind. Just writing.

## Why build my own blog?

I could have used Substack, Ghost, or any number of excellent tools. Instead, I wrote a small markdown parser in Node.js and a build script that spits out static HTML.

Why? Because it's fun, and because I like owning my stack. The whole thing is under 300 lines of code. Here's the bit that converts headings:

```js
const hm = line.match(/^(#{1,6})\s+(.*)/);
if (hm) {
  const lvl = hm[1].length;
  const txt = inline(hm[2]);
  const id  = slugify(hm[2]);
  out.push(`<h${lvl} id="${id}">${txt}</h${lvl}>`);
}
```

Simple, readable, mine.

> The best tool is the one you understand completely.

See you in the next post.
