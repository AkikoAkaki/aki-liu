---
title: "Why I Abandoned My \"Perfect\" Hugo Blog for Notion"
date: 2026-01-14
tags: ["productivity"]
draft: false
---

<aside>

**TL;DR**

Stop optimizing the container and start shipping the content. This post documents the move from an over-engineered Hugo blog to a frictionless Notion setup, highlighting why "Design Engineering" can become a trap that prevents you from actually learning in public.

</aside>

### The Siren Call of "Design Engineering"

It started, ironically, with Andrej Karpathy. I was digging through his blog, admiring the "content-first" philosophy. That led me to [Bear Blog](https://bearblog.dev/)—clean, minimal, no-nonsense. I loved the idea. But as soon as I hit the free tier's media upload limits, I balked. I wanted that minimalism, but I didn't want the constraints.

Then I fell down the rabbit hole.

I tried Hugo with the PaperMod theme (the one Lilian Weng uses). It was functional, but it lacked... soul. It felt like a default setting. And then, I saw [Paco Coursey's blog](http://paco.me).

It was a revelation. The high performance, the elegant typography, the subtle animations that felt "just right," and that overwhelming sense of "Quiet Luxury." I was hooked. I didn't just want a blog; I wanted that. I became obsessed with the idea of "Design Engineering."

### The 5-Day Vibe Coding Sprint

For the next five days, I didn't write a single word of content. Instead, I went into a fugue state of "vibe coding."

I spent my nights tweaking CSS and wrestling with Hugo templates to replicate Paco's aesthetic. Since I lacked the frontend expertise to build it from scratch, I relied heavily on AI tools, iteratively prompting them to fix layout shifts and animation bugs. It was a cycle of frustration: the AI would fix one thing and break two others.

But eventually, I had it. A custom, high-performance, Paco-inspired Hugo blog. It looked almost perfect. I felt incredibly productive.


### The Friction of the File System

The illusion of productivity shattered the moment I actually tried to write.

Migrating my old notes exposed the brutality of the workflow. In the Hugo/Markdown world, every post became a file management project:

- Naming conventions: I had to translate my Chinese titles into English, format them into kebab-case, and ensure they were SEO-friendly.
- The index.md Trap: To manage images properly, I couldn't just have a markdown file. I needed a folder. That folder needed to be named after the post. The file inside had to be index.md.
- The Blind Editor: In VS Code, inserting an image meant writing a path string. I couldn't see the image. To check if it worked, I had to build the site and check the local server.
- Dependency Hell: Video insertions threw errors. Frontmatter formatting had to be precise.

I realized I wasn't writing; I was maintaining a database. I was spending 90% of my energy on the container and 10% on the content.

### Vanity Metrics vs. The Distributed Queue

The turning point came from an unexpected place. I was working on a complex backend project—a Distributed Delay Queue system. It was hard, logic-heavy engineering work. During that project, I stumbled upon [Ivan Zhao's (the founder of Notion) personal site](https://ivanhzhao.notion.site/). It was... just a Notion page. No custom fonts, no fancy animations, no "Design Engineering."

It hit me: I was optimizing for the wrong thing.

Those five days of CSS tweaking were a Vanity Metric. I wanted a flashy website so that potential readers would land on it and think, "Wow, this guy is good." I was performing competence rather than demonstrating it.
My backend project required deep focus. I didn't have the mental bandwidth to fight with my blog's file system. I needed a tool where the friction to write was zero.

### Embracing the "Boring" Stack

So, I'm switching to Notion.

It's not highly customizable. It doesn't have 60fps animations. It doesn't signal "I am a frontend wizard."

But the writing experience is flawless. I can drag and drop images. I can write on my phone. I don't need to name a file index.md.

In the end, I realized that Learning in Public isn't about the platform; it's about the transparency of thought. If I'm honest, no one is reading my blog right now anyway. And that's liberating. Since I'm the only user, I might as well optimize for my own user experience.

Ship the content, not the container.
