/*
 * Photobook entry point.
 *
 * Later stories add a feature module (e.g. gallery.js, nav.js, lightbox.js),
 * import its init function here, and append it to `features` in the order it
 * should start. The page is fully usable without JavaScript; features only
 * enhance it.
 */

const features = [];

function start() {
  for (const { name, init } of features) {
    try {
      init();
    } catch (error) {
      // Isolate failures so one broken feature never blanks the page.
      console.error(`[photobook] ${name} failed to start`, error);
    }
  }
}

start();
