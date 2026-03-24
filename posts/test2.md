---
title: Why I Switched My Blog to Deno
date: 2026-03-25
description: After years of Node.js, I finally migrated my static site generator to Deno. Here's why.
tags: [deno, javascript, meta]
---

I've been building my own static site generators for years, and they've always used Node.js. It's the standard, it's what I know, and it works. But recently, I decided to take the plunge and migrate my entire blog build system to **Deno**.

## Why Deno?

The biggest reason? **Zero configuration**. In my old Node.js setup, I had to manage a `package.json`, a `package-lock.json`, and the dreaded `node_modules` folder.

With Deno, I just import what I need:

```javascript
import { marked } from "npm:marked";
import { join } from "jsr:@std/path";
```

Deno handles the downloads and caching automatically. No `npm install`, no clutter.

## Performance and Security

Deno's security model (no file access by default) makes me feel much safer running build scripts. I have to explicitly allow it:

```bash
deno run --allow-read --allow-write build.js
```

And the startup time is noticeably faster. My build loop is now nearly instantaneous.

## Conclusion

Is it a massive change? No. But the developer experience is so much cleaner. If you're building a simple static site or a CLI tool, give Deno a try. It feels like the evolution of JavaScript on the server that we've been waiting for.
