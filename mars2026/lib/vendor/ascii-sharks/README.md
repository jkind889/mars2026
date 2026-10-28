# ASCII fish

Vendored from the user's existing `/Users/jovakind/mars/src/vendor/ascii-sharks`
implementation of [stackedlol/ascii-sharks](https://github.com/stackedlol/ascii-sharks),
based on upstream revision `a0074c16a106f0abc665fe9712ca445f8f98ad8e`.
Copyright (c) 2026 drewdi; MIT license retained here and served at
`/ascii-sharks-LICENSE.txt`.

The source adaptation preserves the orange palette, transparent rendering,
pointer interaction, manual pause, reduced-motion still frame, offscreen pause,
resize handling, and cleanup. Goneoffmars uses two sharks with 72 small fish,
omits the grid, caps drawing at 30 fps, and pauses when the document is hidden.
The homepage dynamically loads the engine through `components/home-ocean.tsx`.
The canvas is decorative and does not receive pointer events; theme-aware CSS
and a center mask preserve legibility. Other routes do not mount the engine.
