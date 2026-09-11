const STORAGE_KEY = "worm-custom-levels";

function getCustomLevels() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomLevels(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function showError(msg) {
  const el = document.getElementById("import-error");
  if (el) el.textContent = msg;
}

function clearError() {
  showError("");
}

function validateLevel(level) {
  if (!level || typeof level !== "object") {
    return "Level must be a JSON object.";
  }
  if (typeof level.id !== "string" || !level.id) {
    return "Level must have a string \"id\" field.";
  }
  if (typeof level.name !== "string" || !level.name) {
    return "Level must have a string \"name\" field.";
  }
  if (!Array.isArray(level.nodes) || level.nodes.length === 0) {
    return "Level must have a non-empty \"nodes\" array.";
  }
  if (!Array.isArray(level.edges)) {
    return "Level must have an \"edges\" array.";
  }

  const ids = new Set();
  let startCount = 0;
  for (const node of level.nodes) {
    if (!node.id || typeof node.id !== "string") {
      return "Each node must have a string \"id\".";
    }
    if (typeof node.x !== "number" || typeof node.y !== "number") {
      return `Node "${node.id}" must have numeric x and y.`;
    }
    if (!node.type) {
      return `Node "${node.id}" is missing a type.`;
    }
    if (ids.has(node.id)) {
      return `Duplicate node id: "${node.id}".`;
    }
    ids.add(node.id);
    if (node.type === "start") startCount += 1;
  }
  if (startCount !== 1) {
    return `Must have exactly 1 start node (found ${startCount}).`;
  }

  const edgeSet = new Set();
  for (const edge of level.edges) {
    if (!Array.isArray(edge) || edge.length !== 2) {
      return "Each edge must be a [from, to] pair.";
    }
    const [a, b] = edge;
    if (!ids.has(a) || !ids.has(b)) {
      return `Edge "${a}-${b}" references a non-existent node.`;
    }
    const key = [a, b].sort().join("-");
    if (edgeSet.has(key)) {
      return `Duplicate edge: "${a}-${b}".`;
    }
    edgeSet.add(key);
  }

  return null;
}

function importLevel(jsonString) {
  clearError();
  let level;
  try {
    level = JSON.parse(jsonString);
  } catch (e) {
    showError("Invalid JSON: " + e.message);
    return false;
  }

  const error = validateLevel(level);
  if (error) {
    showError(error);
    return false;
  }

  const levels = getCustomLevels();
  const existingIndex = levels.findIndex((l) => l.id === level.id);
  if (existingIndex >= 0) {
    levels[existingIndex] = level;
  } else {
    levels.push(level);
  }
  saveCustomLevels(levels);
  renderSavedLevels();
  return true;
}

function deleteCustomLevel(id) {
  const levels = getCustomLevels().filter((l) => l.id !== id);
  saveCustomLevels(levels);
  renderSavedLevels();
}

function renderSavedLevels() {
  const list = document.getElementById("saved-list");
  if (!list) return;

  const levels = getCustomLevels();
  list.innerHTML = "";

  if (levels.length === 0) {
    const li = document.createElement("li");
    li.className = "empty-message";
    li.textContent = "No saved levels yet. Import one above.";
    list.appendChild(li);
    return;
  }

  for (const level of levels) {
    const li = document.createElement("li");

    const info = document.createElement("span");
    const label = document.createElement("span");
    label.className = "level-label";
    label.textContent = level.name;
    const idSpan = document.createElement("span");
    idSpan.className = "level-id";
    idSpan.textContent = level.id;
    info.appendChild(label);
    info.appendChild(idSpan);

    const actions = document.createElement("span");
    actions.className = "level-actions";

    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.className = "btn-play";
    playBtn.textContent = "Play";
    playBtn.addEventListener("click", () => playCustomLevel(level.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn-delete";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", () => deleteCustomLevel(level.id));

    actions.appendChild(playBtn);
    actions.appendChild(deleteBtn);

    li.appendChild(info);
    li.appendChild(actions);
    list.appendChild(li);
  }
}

function playCustomLevel(id) {
  const levels = getCustomLevels();
  const level = levels.find((l) => l.id === id);
  if (!level) return;

  window.WORM_LEVELS = [level];

  document.getElementById("import-section").classList.add("hidden");
  const gameSection = document.getElementById("game-section");
  gameSection.classList.add("active");

  init([level]);
}

function showImportSection() {
  document.getElementById("import-section").classList.remove("hidden");
  document.getElementById("game-section").classList.remove("active");
}

document.addEventListener("DOMContentLoaded", () => {
  const importText = document.getElementById("import-text");
  const importButton = document.getElementById("import-button");
  const importFile = document.getElementById("import-file");
  const backButton = document.getElementById("back-to-import");

  importButton.addEventListener("click", () => {
    const text = importText.value.trim();
    if (!text) {
      showError("Paste level JSON first.");
      return;
    }
    if (importLevel(text)) {
      importText.value = "";
    }
  });

  importFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (importLevel(reader.result)) {
        importText.value = "";
      }
    };
    reader.readAsText(file);
    importFile.value = "";
  });

  backButton.addEventListener("click", showImportSection);

  renderSavedLevels();
});
