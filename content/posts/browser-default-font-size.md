---
title: "Get the browser default font size"
date: 2023-05-09
slug: "writing/browser-default-font-size"
draft: false
---

Use the font-size: `medium` keyword to inherit the browser default setting:

```css
.measure-element {
	font-size: medium;
}
```

Reading the value from JavaScript is as simple as querying a measurement element and relying on `getComputedStyle`:

```js
const measureElement = document.querySelector('.measure-element');
let fontSize = parseInt(getComputedStyle(measureElement).fontSize);
```

If your browser's default font size is changed (for example to "Very Large" on Chromium), the return value will reflect the new size—for instance `24px` instead of `16px`.

The value depends on the system preferences, so don't hardcode a pixel assumption unless you explicitly control the browser UI settings.
