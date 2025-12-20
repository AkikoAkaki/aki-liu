---
title: "Safari favicon showing white background on dark mode"
date: 2023-04-19
slug: "safari-favicon"
draft: false
aliases:
  - /posts/safari-favicon/
---

This happens as recently as Safari 16.4. It's because your favicon fails to meet contrast requirements.

I don't know what the requirements are, or how Safari calculates them, and I can’t find any official information online (beyond some discussion deciding that Safari should stop automatically adjusting colors for improved contrast in places like `::placeholder` and `::selection`). It’s definitely related to color contrast, though I didn’t see any consistent behavior by matching or exceeding AA/4.5:1 or AAA/7:1 requirements of the foreground color against both #000 and #282828 (Safari's default tabbar background in dark mode).

### Solving

You can fix it by changing the primary color of your favicon to be “brighter”. Decreasing white space or adding a border to the icon may also help.

### Validating

Safari has an agressive favicon cache that is not easy to clear. Here's how to forcefully refresh your website's favicon in Safari:

- Click the menu item "Clear Caches" under the Develop menu
    - If you don't see the Develop menu, enable it in Safari Preferences › Advanced
- Quit Safari
- Delete everything in `~/Library/Safari/Favicon Cache`
    - Terminal users can run `rm -rf ~/Library/Safari/Favicon\ Cache`
- Restart Safari
- Visit your site
