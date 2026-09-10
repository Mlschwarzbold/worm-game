const editorLevels = Array.isArray(window.WORM_LEVELS) ? window.WORM_LEVELS : [];
const SVG_NS = "http://www.w3.org/2000/svg";

const state = {
  levelIndex: 0,
  level: null,
  selectedNodeId: null,
  secondSelectedNodeId: null,
  dragNodeId: null
};

let didDrag = false;

function cloneLevel(level) {
  return {
    id: level.id,
    name: level.name,
    nodes: level.nodes.map((node) => ({ ...node })),
    edges: level.edges.map(([a, b]) => [a, b])
  };
}

function edgeKey(a, b) {
  return [a, b].sort().join("-");
}

function createSvgElement(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
  return el;
}

function nodeMap(level) {
  return new Map(level.nodes.map((node) => [node.id, node]));
}

function getNodeById(level, nodeId) {
  return level.nodes.find((node) => node.id === nodeId);
}

function allNodeIds(level) {
  return level.nodes.map((node) => node.id);
}

function ensureSingleStart(level, targetNodeId) {
  for (const node of level.nodes) {
    if (node.id !== targetNodeId && node.type === "start") {
      node.type = "normal";
    }
  }
}

function ensureAtLeastOneStart(level) {
  const hasStart = level.nodes.some((node) => node.type === "start");
  if (!hasStart && level.nodes.length > 0) {
    level.nodes[0].type = "start";
  }
}

function uniqueNodeId(level) {
  const existingIds = new Set(allNodeIds(level));
  let index = 1;
  while (existingIds.has(`N${index}`)) {
    index += 1;
  }
  return `N${index}`;
}

function nextLevelId(levelsList) {
  let maxIndex = 0;
  for (const level of levelsList) {
    const match = /^level-(\d+)$/.exec(level.id);
    if (!match) {
      continue;
    }
    const value = Number(match[1]);
    if (value > maxIndex) {
      maxIndex = value;
    }
  }
  return `level-${maxIndex + 1}`;
}

function nextLevelName(levelsList) {
  return `New Level ${levelsList.length + 1}`;
}

function createBlankLevel(name, id) {
  return {
    id,
    name,
    nodes: [
      { id: "A", x: 260, y: 300, type: "start" },
      { id: "B", x: 540, y: 300, type: "end" }
    ],
    edges: [["A", "B"]]
  };
}

function persistCurrentLevelDraft() {
  if (!state.level) {
    return;
  }
  if (state.levelIndex < 0 || state.levelIndex >= editorLevels.length) {
    return;
  }
  editorLevels[state.levelIndex] = cloneLevel(state.level);
}

function svgPoint(svg, event) {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) {
    throw new Error("Unable to convert mouse coordinates to SVG coordinates.");
  }
  return point.matrixTransform(ctm.inverse());
}

function showContextMenu(x, y, items) {
  const menu = document.getElementById("context-menu");
  if (!(menu instanceof HTMLElement)) {
    return;
  }
  menu.innerHTML = "";
  for (const item of items) {
    if (item.separator) {
      const sep = document.createElement("div");
      sep.className = "context-menu-separator";
      menu.appendChild(sep);
      continue;
    }
    const button = document.createElement("button");
    button.className = "context-menu-item";
    button.textContent = item.label;
    button.addEventListener("click", () => {
      hideContextMenu();
      item.action();
    });
    menu.appendChild(button);
  }
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.classList.remove("hidden");

  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    menu.style.left = `${x - rect.width}px`;
  }
  if (rect.bottom > window.innerHeight) {
    menu.style.top = `${y - rect.height}px`;
  }
}

function hideContextMenu() {
  const menu = document.getElementById("context-menu");
  if (menu instanceof HTMLElement) {
    menu.classList.add("hidden");
  }
}

function updateNodeControls() {
  const selectedNodeLabel = document.getElementById("selected-node");
  const nodeTypeSelect = document.getElementById("node-type");
  const deleteNodeButton = document.getElementById("delete-node");
  if (!(selectedNodeLabel instanceof HTMLElement) || !(nodeTypeSelect instanceof HTMLSelectElement) || !(deleteNodeButton instanceof HTMLButtonElement)) {
    throw new Error("Missing node control elements.");
  }

  const selectedNode = state.selectedNodeId ? getNodeById(state.level, state.selectedNodeId) : null;
  if (!selectedNode) {
    selectedNodeLabel.textContent = "None";
    nodeTypeSelect.disabled = true;
    deleteNodeButton.disabled = true;
    return;
  }

  selectedNodeLabel.textContent = `${selectedNode.id} (${selectedNode.x.toFixed(0)}, ${selectedNode.y.toFixed(0)})`;
  nodeTypeSelect.disabled = false;
  nodeTypeSelect.value = selectedNode.type;
  deleteNodeButton.disabled = false;
}

function updateEdgeControls() {
  const edgeFromSelect = document.getElementById("edge-from");
  const edgeToSelect = document.getElementById("edge-to");
  const edgeList = document.getElementById("edge-list");
  const deleteEdgeButton = document.getElementById("delete-edge");
  if (!(edgeFromSelect instanceof HTMLSelectElement) || !(edgeToSelect instanceof HTMLSelectElement) || !(edgeList instanceof HTMLSelectElement) || !(deleteEdgeButton instanceof HTMLButtonElement)) {
    throw new Error("Missing edge control elements.");
  }

  const selectedEdgeValue = edgeList.value;
  const nodeIds = allNodeIds(state.level);
  edgeFromSelect.innerHTML = "";
  edgeToSelect.innerHTML = "";
  for (const id of nodeIds) {
    const fromOption = document.createElement("option");
    fromOption.value = id;
    fromOption.textContent = id;
    edgeFromSelect.appendChild(fromOption);

    const toOption = document.createElement("option");
    toOption.value = id;
    toOption.textContent = id;
    edgeToSelect.appendChild(toOption);
  }

  edgeList.innerHTML = "";
  for (const [from, to] of state.level.edges) {
    const option = document.createElement("option");
    option.value = `${from}|${to}`;
    option.textContent = `${from} - ${to}`;
    edgeList.appendChild(option);
  }

  if (state.selectedNodeId && nodeIds.includes(state.selectedNodeId)) {
    edgeFromSelect.value = state.selectedNodeId;
  }
  if (selectedEdgeValue && Array.from(edgeList.options).some((option) => option.value === selectedEdgeValue)) {
    edgeList.value = selectedEdgeValue;
  }
  deleteEdgeButton.disabled = edgeList.selectedIndex === -1;
}

function renderGraph() {
  const svg = document.getElementById("editor-graph");
  if (!(svg instanceof SVGSVGElement)) {
    throw new Error("Missing editor SVG.");
  }

  svg.textContent = "";
  const map = nodeMap(state.level);
  const edgesLayer = createSvgElement("g");
  const nodesLayer = createSvgElement("g");
  const labelsLayer = createSvgElement("g");

  for (const [from, to] of state.level.edges) {
    const source = map.get(from);
    const target = map.get(to);
    if (!source || !target) {
      continue;
    }
    const line = createSvgElement("line", {
      x1: source.x,
      y1: source.y,
      x2: target.x,
      y2: target.y,
      class: "edge"
    });
    edgesLayer.appendChild(line);
  }

  for (const node of state.level.nodes) {
    const isSelected = node.id === state.selectedNodeId;
    const isSecondSelected = node.id === state.secondSelectedNodeId;
    const classes = ["node", `node-${node.type}`];
    if (isSelected) {
      classes.push("node-selected");
    }
    if (isSecondSelected) {
      classes.push("node-second-selected");
    }

    const circle = createSvgElement("circle", {
      cx: node.x,
      cy: node.y,
      r: 14,
      class: classes.join(" "),
      "data-id": node.id
    });
    circle.addEventListener("mousedown", (event) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        return;
      }
      didDrag = false;
      state.selectedNodeId = node.id;
      state.dragNodeId = node.id;
      updateNodeControls();
      updateEdgeControls();
      renderGraph();
    });
    circle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.ctrlKey || event.metaKey) {
        if (state.selectedNodeId && state.selectedNodeId !== node.id) {
          const existingKey = edgeKey(state.selectedNodeId, node.id);
          const existingEdgeKeys = new Set(state.level.edges.map(([a, b]) => edgeKey(a, b)));
          if (existingEdgeKeys.has(existingKey)) {
            state.level.edges = state.level.edges.filter(([a, b]) => edgeKey(a, b) !== existingKey);
          } else {
            state.level.edges.push([state.selectedNodeId, node.id]);
          }
          state.secondSelectedNodeId = node.id;
          refreshUI();
          return;
        }
        state.secondSelectedNodeId = state.secondSelectedNodeId === node.id ? null : node.id;
        renderGraph();
        return;
      }

      state.selectedNodeId = node.id;
      state.secondSelectedNodeId = null;
      updateNodeControls();
      updateEdgeControls();
      renderGraph();

      if (didDrag) return;

      const typeItems = ["normal", "start", "end", "food"].map((t) => ({
        label: t,
        action: () => {
          const n = getNodeById(state.level, node.id);
          if (!n) return;
          if (n.type === "start" && t !== "start") {
            const otherStartCount = state.level.nodes.filter((c) => c.id !== n.id && c.type === "start").length;
            if (otherStartCount === 0) return;
          }
          n.type = t;
          if (t === "start") ensureSingleStart(state.level, n.id);
          ensureAtLeastOneStart(state.level);
          refreshUI();
        }
      }));
      showContextMenu(event.clientX, event.clientY, typeItems);
    });
    circle.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      state.selectedNodeId = node.id;
      updateNodeControls();
      updateEdgeControls();
      renderGraph();
      const typeItems = ["normal", "start", "end", "food"].map((t) => ({
        label: t,
        action: () => {
          const n = getNodeById(state.level, node.id);
          if (!n) return;
          if (n.type === "start" && t !== "start") {
            const otherStartCount = state.level.nodes.filter((c) => c.id !== n.id && c.type === "start").length;
            if (otherStartCount === 0) return;
          }
          n.type = t;
          if (t === "start") ensureSingleStart(state.level, n.id);
          ensureAtLeastOneStart(state.level);
          refreshUI();
        }
      }));
      showContextMenu(event.clientX, event.clientY, typeItems);
    });

    const label = createSvgElement("text", {
      x: node.x,
      y: node.y + 32,
      class: "node-label"
    });
    label.textContent = `${node.id}${node.type === "food" ? " •" : ""}`;

    nodesLayer.appendChild(circle);
    labelsLayer.appendChild(label);
  }

  svg.appendChild(edgesLayer);
  svg.appendChild(nodesLayer);
  svg.appendChild(labelsLayer);
}

function updateEditorHeader() {
  const levelSelect = document.getElementById("level-select");
  if (!(levelSelect instanceof HTMLSelectElement)) {
    throw new Error("Missing level select.");
  }

  if (levelSelect.options.length !== editorLevels.length) {
    levelSelect.innerHTML = "";
    for (let i = 0; i < editorLevels.length; i += 1) {
      const option = document.createElement("option");
      option.value = String(i);
      option.textContent = `${i + 1}. ${editorLevels[i].name}`;
      levelSelect.appendChild(option);
    }
  }
  levelSelect.value = String(state.levelIndex);
}

function refreshUI() {
  persistCurrentLevelDraft();
  updateEditorHeader();
  updateNodeControls();
  updateEdgeControls();
  renderGraph();
}

function loadLevel(index) {
  state.levelIndex = index;
  state.level = cloneLevel(editorLevels[index]);
  ensureAtLeastOneStart(state.level);
  state.selectedNodeId = null;
  state.secondSelectedNodeId = null;
  state.dragNodeId = null;
  refreshUI();
}

function exportCurrentLevel() {
  const output = document.getElementById("export-output");
  if (!(output instanceof HTMLTextAreaElement)) {
    throw new Error("Missing export output.");
  }

  const level = state.level;
  const payload = `window.WORM_LEVELS = window.WORM_LEVELS || [];\n\nwindow.WORM_LEVELS.push(${JSON.stringify(level, null, 2)});`;
  output.value = payload;
}

function initEditor() {
  if (editorLevels.length === 0) {
    throw new Error("No levels loaded. Include level files before editor.js.");
  }

  const svg = document.getElementById("editor-graph");
  const levelSelect = document.getElementById("level-select");
  const newLevelNameInput = document.getElementById("new-level-name");
  const createLevelButton = document.getElementById("create-level");
  const nodeTypeSelect = document.getElementById("node-type");
  const addNodeButton = document.getElementById("add-node");
  const deleteNodeButton = document.getElementById("delete-node");
  const edgeFromSelect = document.getElementById("edge-from");
  const edgeToSelect = document.getElementById("edge-to");
  const addEdgeButton = document.getElementById("add-edge");
  const edgeList = document.getElementById("edge-list");
  const deleteEdgeButton = document.getElementById("delete-edge");
  const exportButton = document.getElementById("export-level");

  if (!(svg instanceof SVGSVGElement)) {
    throw new Error("Missing editor graph.");
  }
  if (!(levelSelect instanceof HTMLSelectElement) || !(nodeTypeSelect instanceof HTMLSelectElement)) {
    throw new Error("Missing core editor controls.");
  }
  if (!(newLevelNameInput instanceof HTMLInputElement) || !(createLevelButton instanceof HTMLButtonElement)) {
    throw new Error("Missing new level controls.");
  }
  if (!(addNodeButton instanceof HTMLButtonElement) || !(deleteNodeButton instanceof HTMLButtonElement)) {
    throw new Error("Missing node action buttons.");
  }
  if (!(edgeFromSelect instanceof HTMLSelectElement) || !(edgeToSelect instanceof HTMLSelectElement) || !(edgeList instanceof HTMLSelectElement)) {
    throw new Error("Missing edge controls.");
  }
  if (!(addEdgeButton instanceof HTMLButtonElement) || !(deleteEdgeButton instanceof HTMLButtonElement) || !(exportButton instanceof HTMLButtonElement)) {
    throw new Error("Missing edge/export action buttons.");
  }

  levelSelect.addEventListener("change", () => {
    const index = Number(levelSelect.value);
    if (Number.isInteger(index) && index >= 0 && index < editorLevels.length) {
      loadLevel(index);
    }
  });

  createLevelButton.addEventListener("click", () => {
    const rawName = newLevelNameInput.value.trim();
    const name = rawName || nextLevelName(editorLevels);
    const id = nextLevelId(editorLevels);
    const newLevel = createBlankLevel(name, id);
    editorLevels.push(newLevel);
    newLevelNameInput.value = "";
    loadLevel(editorLevels.length - 1);
  });

  nodeTypeSelect.addEventListener("change", () => {
    if (!state.selectedNodeId) {
      return;
    }
    const node = getNodeById(state.level, state.selectedNodeId);
    if (!node) {
      return;
    }

    const nextType = nodeTypeSelect.value;
    if (node.type === "start" && nextType !== "start") {
      const otherStartCount = state.level.nodes.filter((candidate) => candidate.id !== node.id && candidate.type === "start").length;
      if (otherStartCount === 0) {
        nodeTypeSelect.value = "start";
        return;
      }
    }

    node.type = nextType;
    if (nextType === "start") {
      ensureSingleStart(state.level, node.id);
    }
    ensureAtLeastOneStart(state.level);
    refreshUI();
  });

  addNodeButton.addEventListener("click", () => {
    const id = uniqueNodeId(state.level);
    const newNode = {
      id,
      x: 400,
      y: 300,
      type: "normal"
    };
    state.level.nodes.push(newNode);
    state.selectedNodeId = id;
    refreshUI();
  });

  deleteNodeButton.addEventListener("click", () => {
    if (!state.selectedNodeId) {
      return;
    }
    const selectedNode = getNodeById(state.level, state.selectedNodeId);
    if (!selectedNode) {
      return;
    }
    if (state.level.nodes.length <= 1) {
      return;
    }

    state.level.nodes = state.level.nodes.filter((node) => node.id !== state.selectedNodeId);
    state.level.edges = state.level.edges.filter(([from, to]) => from !== state.selectedNodeId && to !== state.selectedNodeId);
    state.selectedNodeId = null;
    ensureAtLeastOneStart(state.level);
    refreshUI();
  });

  addEdgeButton.addEventListener("click", () => {
    const from = edgeFromSelect.value;
    const to = edgeToSelect.value;
    if (!from || !to || from === to) {
      return;
    }

    const existingEdgeKeys = new Set(state.level.edges.map(([a, b]) => edgeKey(a, b)));
    const key = edgeKey(from, to);
    if (existingEdgeKeys.has(key)) {
      return;
    }
    state.level.edges.push([from, to]);
    refreshUI();
  });

  edgeList.addEventListener("change", () => {
    deleteEdgeButton.disabled = edgeList.selectedIndex === -1;
  });

  deleteEdgeButton.addEventListener("click", () => {
    const value = edgeList.value;
    if (!value) {
      return;
    }
    const [from, to] = value.split("|");
    state.level.edges = state.level.edges.filter(([a, b]) => !(a === from && b === to));
    refreshUI();
  });

  exportButton.addEventListener("click", () => {
    exportCurrentLevel();
  });

  svg.addEventListener("mousemove", (event) => {
    if (!state.dragNodeId) {
      return;
    }
    const node = getNodeById(state.level, state.dragNodeId);
    if (!node) {
      return;
    }
    didDrag = true;
    const point = svgPoint(svg, event);
    node.x = Math.max(20, Math.min(780, point.x));
    node.y = Math.max(20, Math.min(580, point.y));
    updateNodeControls();
    renderGraph();
  });

  svg.addEventListener("click", (event) => {
    if (event.target !== svg) return;
    hideContextMenu();
    const point = svgPoint(svg, event);
    const items = ["normal", "start", "end", "food"].map((t) => ({
      label: `Create ${t}`,
      action: () => {
        const id = uniqueNodeId(state.level);
        const newNode = { id, x: Math.round(point.x), y: Math.round(point.y), type: t };
        state.level.nodes.push(newNode);
        if (t === "start") ensureSingleStart(state.level, id);
        ensureAtLeastOneStart(state.level);
        state.selectedNodeId = id;
        state.secondSelectedNodeId = null;
        refreshUI();
      }
    }));
    showContextMenu(event.clientX, event.clientY, items);
  });

  svg.addEventListener("contextmenu", (event) => {
    if (event.target !== svg) return;
    event.preventDefault();
    const point = svgPoint(svg, event);
    const items = ["normal", "start", "end", "food"].map((t) => ({
      label: `Create ${t}`,
      action: () => {
        const id = uniqueNodeId(state.level);
        const newNode = { id, x: Math.round(point.x), y: Math.round(point.y), type: t };
        state.level.nodes.push(newNode);
        if (t === "start") ensureSingleStart(state.level, id);
        ensureAtLeastOneStart(state.level);
        state.selectedNodeId = id;
        state.secondSelectedNodeId = null;
        refreshUI();
      }
    }));
    showContextMenu(event.clientX, event.clientY, items);
  });

  const stopDragging = () => {
    state.dragNodeId = null;
  };
  svg.addEventListener("mouseup", stopDragging);
  svg.addEventListener("mouseleave", stopDragging);
  window.addEventListener("mouseup", stopDragging);

  document.addEventListener("click", (event) => {
    const menu = document.getElementById("context-menu");
    if (menu && !menu.contains(event.target)) {
      hideContextMenu();
    }
  });

  loadLevel(0);
}

initEditor();
