window.WORM_LEVEL_FILES = [
  "level-1.js",
  "level-2.js",
  "level-3.js",
  "level-4.js",
  "level-5.js",
  "level-6.js",
  "level-7.js",
  "level-8.js",
  "level-9.js",
  "level-10.js"
];

for (const levelFile of window.WORM_LEVEL_FILES) {
  document.write(`<script src="levels/${levelFile}"><\/script>`);
}
