# ASCII fish

Vendored from the user's existing `/Users/jovakind/mars/src/vendor/ascii-sharks`
implementation of [stackedlol/ascii-sharks](https://github.com/stackedlol/ascii-sharks),
based on upstream revision `a0074c16a106f0abc665fe9712ca445f8f98ad8e`.
Copyright (c) 2026 drewdi; MIT license retained here and served at
`/ascii-sharks-LICENSE.txt`.

The source adaptation preserves the orange palette, transparent rendering,
pointer interaction, manual pause, reduced-motion still frame, offscreen pause,
resize handling, and cleanup. Goneoffmars uses four sharks with 200 small fish,
or three sharks with 120 small fish below 640px. Crossing that breakpoint resets
the population while preserving the user's pause state. It omits the grid, caps
drawing at 30 fps, and pauses when the document is hidden.
The shared root layout dynamically loads one engine through
`components/site-ocean.tsx`. It stays mounted across client navigation; the
decorative, fixed canvas never receives pointer events. Controls remain in
normal page flow before the footer, with a keyboard skip link from the top.
Pause state survives route changes and is stored for reloads in this tab when
session storage is available. The controls reserve space while the engine loads.

The normal palette uses navy `#000052`; dark mode uses muted slate navy `#101426`.
Shared semantic colors cover cards, menus, forms, borders, and status text.
Fish are brighter on the homepage and subdued behind content on other pages.
Dark mode further desaturates/dims the canvas and coral; poster images and the
portrait retain their original colors. CSS changes the palette without restarting
the animation. Reduced motion displays a still frame and hides the motion toggle.
