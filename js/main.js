/*
 * Photobook entry point.
 *
 * Each feature module exports an init function (sync or async). Import it
 * here and append it to `features` in the order it should start. Failures,
 * including rejected promises, are isolated so one broken feature never
 * blanks the page. The page is usable without JavaScript; features enhance it.
 */

import { init as initGallery } from "./gallery.js";
import { init as initNav } from "./nav.js";

const features = [
  { name: "gallery", init: initGallery },
  { name: "nav", init: initNav },
];

function start() {
  for (const { name, init } of features) {
    const fail = (error) => console.error(`[photobook] ${name} failed to start`, error);
    try {
      const result = init();
      if (result && typeof result.then === "function") {
        result.catch(fail);
      }
    } catch (error) {
      fail(error);
    }
  }
}

start();
