const PLAYTEST_STORAGE_KEY = "worm-playtest-level";

document.addEventListener("DOMContentLoaded", () => {
  const backButton = document.getElementById("back-to-editor");
  const errorEl = document.getElementById("playtest-error");
  const gameArea = document.getElementById("game-area");

  backButton.addEventListener("click", () => {
    window.location.href = "editor.html";
  });

  const raw = sessionStorage.getItem(PLAYTEST_STORAGE_KEY);
  if (!raw) {
    errorEl.textContent = "No level to playtest. Go back to the editor and click Playtest.";
    errorEl.hidden = false;
    gameArea.hidden = true;
    return;
  }

  let level;
  try {
    level = JSON.parse(raw);
  } catch {
    errorEl.textContent = "Invalid level data. Go back to the editor and try again.";
    errorEl.hidden = false;
    gameArea.hidden = true;
    return;
  }

  init([level]);
});
