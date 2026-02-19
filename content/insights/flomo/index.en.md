---
title: "Flomo: The Note-taking Illusion"
date: 2026-01-20
tags: ["product", "productivity"]
draft: false
---

<aside>

**TL;DR**

Flomo markets itself as a Zettelkasten implementation, but the product architecture prioritizes low-latency capture over graph connectivity. It lacks the accessible backlinks and visualization primitives necessary for knowledge compounding, effectively functioning as a linear, append-only log rather than a network. While useful as a capture buffer, the proprietary HTML exports create high friction for interoperability with the standard Markdown-based knowledge stack.

</aside>

Flomo made waves in the Chinese knowledge management community by positioning itself as a Zettelkasten tool. Founder Shaonan frequently referenced Niklas Luhmann in early podcasts and articles, emphasizing that "cards should connect like neurons." The marketing was clever—it pitched Flomo as a simplified Obsidian, a shortcut to building a "Second Brain."

But here's the problem: **Flomo can't actually do Zettelkasten.**

{{< figure 
    src="fig1.png"
>}}

{{< figure 
    src="fig2.png"
>}}

---

The essence of Zettelkasten isn't writing cards—it's connecting them. Luhmann's methodology rests on three pillars:

1. **Atomic Notes:** Each card captures a single, independent thought.
2. **Networked Structure:** Cards link together to form a knowledge network.
3. **Emergent Insights:** New ideas surface by traversing these connections.

The second and third points are crucial. Without robust linking, you don't have a Zettelkasten. You have a pile of disconnected notes.

Flomo excels at low-friction capture. Its mobile input speed is nearly unbeatable. But when it comes to the linking features that actually make Zettelkasten work? They're essentially decorative.

Here's what's broken:

- Backlinks exist but are hidden by default, requiring manual expansion
- No graph visualization to see your knowledge network
- The chronological feed buries connections under a timeline
- AI semantic search (added in 2024) doesn't compensate for poor link infrastructure

The design philosophy is fundamentally Twitter-like: "consumption of the now" rather than "compounding of knowledge." You can create links, but you can't leverage them.

Compare this to Roam Research or Obsidian:

- Backlinks appear automatically at the bottom of every note
- Graph view reveals the shape of your knowledge network
- You think by jumping through links
- "Unlinked Mentions" help discover potential connections

That's what a digital Zettelkasten looks like.

Building backlink panels and graph views was mature technology by 2021. Flomo chose not to build them because its true positioning is as a mobile quick-capture tool, not a knowledge management system. Their documentation even admits a desire to remain "small and beautiful."

Yet the marketing suggested otherwise. The slogan "Record constantly, meaning emerges naturally" is vague enough to imply Zettelkasten magic. The founder tied Flomo deeply to *How to Take Smart Notes*. The product copy repeatedly emphasizes "building connections."

---

I've observed two patterns:

**Type One:** Attracted by the Zettelkasten promise, they earnestly try to build a knowledge network. Eventually they realize the tool can't support the methodology and migrate to Obsidian or Logseq.

**Type Two:** They never understood Zettelkasten. They use Flomo as a running log but feel sophisticated because of the "card note" terminology.

The first group wastes time. The second group gets a false sense of accomplishment.

---

An excellent inbox acts like a funnel—information flows in smoothly. An excellent archive acts like a warehouse—information gets retrieved in an orderly fashion. Flomo tries to be both.

If Flomo were honest about its positioning, it would say:

> "We're a mobile jotting tool that helps you capture thoughts on the go. If you need deep organization and connection, export to Obsidian."

That would be reasonable. Inbox and archive are fundamentally different tools. But the documentation doesn't make this distinction. It insists Flomo can serve as a complete knowledge base.

---

Flomo chose a different strategy: attract users with Zettelkasten's halo, then retain them through subscriptions and poor export formats.

In 2026, Markdown is the lingua franca of knowledge management. Yet Flomo's data export is primarily HTML, cluttered with rendering code. This isn't developer laziness—it's a defensive business maneuver. Lock users in by increasing the cost of migration.

As personal knowledge management shifts toward "letting AI understand your notes," Flomo's data pollution becomes a bigger issue. While modern AI can process HTML, Flomo has done nothing to optimize its export format for this future.

Meanwhile, Flomo operates an opaque, built-in AI for basic analysis. Contrast this with Notion AI's comprehensive agent system that calls top-tier models without hard usage caps. Flomo's "2 AI insights per day" is virtually non-existent. Your years of accumulated thoughts sit trapped in a black box that's difficult to utilize.

---

Flomo's biggest problem isn't missing features. It's the mismatch between its narrative and its product.

If you treat it as a memo app with tags, it's great—clean, fast, cross-platform.

But if you believe the marketing and expect to practice Zettelkasten, you'll be disappointed.

---

**If you need quick recording:** Apple Notes, Simple Note, or even a messaging app's "Saved Messages" feature does the same thing for free.

**If you want to practice Zettelkasten:** Use Obsidian or Logseq directly. The learning curve is steeper, but the tools actually align with the methodology.

**If you're already using Flomo:** Ask yourself—are you truly utilizing the links? If you're just recording and reviewing, why pay for the concept of "Card Notes"?

---

When choosing tools, look at what they actually do, not what they claim to do.

It's dangerous when a tool gives you the illusion of "thinking" when you're really just moving text around.

For Flomo, this isn't a product flaw. It's a marketing strategy.

Users deserve to know the difference.
