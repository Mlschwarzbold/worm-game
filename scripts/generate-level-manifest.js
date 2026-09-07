const fs = require("fs");
const path = require("path");

const levelsDirectory = path.resolve(__dirname, "..", "levels");
const levelFiles = fs.readdirSync(levelsDirectory)
  .filter((file) => /^level-.*\.js$/.test(file))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

const manifest = `window.WORM_LEVEL_FILES = ${JSON.stringify(levelFiles, null, 2)};\n\n` +
  "for (const levelFile of window.WORM_LEVEL_FILES) {\n" +
  "  document.write(`<script src=\"levels/${levelFile}\"><\\/script>`);\n" +
  "}\n";

fs.writeFileSync(path.join(levelsDirectory, "manifest.js"), manifest);
console.log(`Generated levels/manifest.js with ${levelFiles.length} level files.`);
