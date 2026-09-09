const levels = Array.isArray(window.WORM_LEVELS) ? window.WORM_LEVELS : [];
const SVG_NS = "http://www.w3.org/2000/svg";

const gameState = {
  levelIndex: 0,
  currentLevel: null,
  nodeMap: null,
  graphEdges: null,
  neighbors: null,
  isLevelWon: false,
  wormLength: 1,
  wormPath: [],
  animation: null
};

function validateGraph({ nodes, edges }) {
  const nodeIds = new Set();
  let startCount = 0;
  for (const node of nodes) {
    if (nodeIds.has(node.id)) {
      throw new Error(`Duplicate node id found: ${node.id}`);
    }
    if (!node.type) {
      throw new Error(`Node ${node.id} is missing a type.`);
    }
    if (node.type === "start") {
      startCount += 1;
    }
    nodeIds.add(node.id);
  }
  if (startCount !== 1) {
    throw new Error(`Graph must have exactly one start node, found: ${startCount}.`);
  }

  const edgeSet = new Set();
  for (const [a, b] of edges) {
    if (!nodeIds.has(a) || !nodeIds.has(b)) {
      throw new Error(`Invalid edge: ${a}-${b} references unknown node.`);
    }
    const key = [a, b].sort().join("-");
    if (edgeSet.has(key)) {
      throw new Error(`Duplicate edge found: ${a}-${b}`);
    }
    edgeSet.add(key);
  }
}

function edgeKey(a, b) {
  return [a, b].sort().join("-");
}

function edgeIndex(edges) {
  return new Set(edges.map(([a, b]) => edgeKey(a, b)));
}

function neighborIndex(nodes, edges) {
  const map = new Map(nodes.map((node) => [node.id, new Set()]));
  for (const [a, b] of edges) {
    map.get(a).add(b);
    map.get(b).add(a);
  }
  return map;
}

function findStartNode(nodes) {
  const startNode = nodes.find((node) => node.type === "start");
  if (!startNode) {
    throw new Error("No start node found.");
  }
  return startNode.id;
}

function validateWormPath(path, nodeMap, graphEdges, maxLength) {
  if (!Array.isArray(path) || path.length === 0) {
    throw new Error("Worm path must contain at least one node.");
  }
  if (path.length > maxLength) {
    throw new Error(`Worm path length (${path.length}) exceeds total worm length (${maxLength}).`);
  }

  const seen = new Set();
  for (let i = 0; i < path.length; i += 1) {
    const currentNodeId = path[i];
    if (!nodeMap.has(currentNodeId)) {
      throw new Error(`Worm path node ${currentNodeId} does not exist in graph.`);
    }
    if (seen.has(currentNodeId)) {
      throw new Error(`Worm path self-collision at node ${currentNodeId}.`);
    }
    seen.add(currentNodeId);

    if (i === path.length - 1) {
      continue;
    }
    const nextNodeId = path[i + 1];
    if (!graphEdges.has(edgeKey(currentNodeId, nextNodeId))) {
      throw new Error(`Worm path uses a non-existent edge: ${currentNodeId}-${nextNodeId}.`);
    }
  }
}

function nodeIndex(nodes) {
  return new Map(nodes.map((node) => [node.id, node]));
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function cloneLevel(level) {
  return {
    id: level.id,
    name: level.name,
    nodes: level.nodes.map((node) => ({ ...node })),
    edges: level.edges.map(([a, b]) => [a, b])
  };
}

function foodNodeCount(level) {
  return level.nodes.filter((node) => node.type === "food").length;
}

function isWinningState(state) {
  const headNodeId = state.wormPath[0];
  const headNode = state.nodeMap.get(headNodeId);
  if (!headNode || headNode.type !== "end") {
    return false;
  }
  return foodNodeCount(state.currentLevel) === 0;
}

function createSvgElement(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
  return el;
}

function renderWorm(svg, data, path, anim) {
  const map = nodeIndex(data.nodes);
  const wormLayer = createSvgElement("g", {
    class: "worm-layer",
    "pointer-events": "none"
  });

  function nodePos(nodeId) {
    const n = map.get(nodeId);
    return { x: n.x, y: n.y };
  }

  let renderPath;
  let fadeCount;

  if (anim && anim.oldPath) {
    const oldPath = anim.oldPath;
    const newPath = path;
    const maxLen = Math.max(oldPath.length, newPath.length);
    fadeCount = oldPath.length - newPath.length;
    renderPath = [];
    for (let i = 0; i < maxLen; i += 1) {
      const oldPos = i < oldPath.length ? nodePos(oldPath[i]) : nodePos(oldPath[oldPath.length - 1]);
      const newPos = i < newPath.length ? nodePos(newPath[i]) : nodePos(newPath[newPath.length - 1]);
      renderPath.push({
        x: lerp(oldPos.x, newPos.x, anim.t),
        y: lerp(oldPos.y, newPos.y, anim.t),
        opacity: i >= newPath.length ? 1 - anim.t : 1
      });
    }
  } else {
    fadeCount = 0;
    renderPath = path.map((id) => {
      const p = nodePos(id);
      return { x: p.x, y: p.y, opacity: 1 };
    });
  }

  for (let i = 0; i < renderPath.length - 1; i += 1) {
    const from = renderPath[i];
    const to = renderPath[i + 1];
    const opacity = i >= renderPath.length - 1 - fadeCount
      ? Math.min(from.opacity, to.opacity)
      : 0.95;
    const line = createSvgElement("line", {
      x1: from.x, y1: from.y,
      x2: to.x, y2: to.y,
      class: "worm-edge",
      opacity: opacity
    });
    wormLayer.appendChild(line);
  }

  for (let i = 0; i < renderPath.length; i += 1) {
    const pos = renderPath[i];
    const isFadeNode = i >= path.length;
    const roleClass = i === 0 ? "worm-head" : (isFadeNode ? "worm-tail" : "worm-body");
    const radius = 19;
    const circle = createSvgElement("circle", {
      cx: pos.x, cy: pos.y,
      r: radius,
      class: `worm-node ${roleClass}`,
      opacity: pos.opacity
    });
    wormLayer.appendChild(circle);

    if (i === 0 && renderPath.length > 1) {
      const targetPos = renderPath[0];
      const behindPos = anim && anim.oldPath
        ? nodePos(anim.oldPath[0])
        : renderPath[1];
      const dx = targetPos.x - behindPos.x;
      const dy = targetPos.y - behindPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;
      const perpX = -ny;
      const perpY = nx;
      const eyeR = 4;
      const eyeOffset = 6;
      const eyeForward = 4;
      for (const side of [-1, 1]) {
        const eye = createSvgElement("circle", {
          cx: targetPos.x + nx * eyeForward + perpX * eyeOffset * side,
          cy: targetPos.y + ny * eyeForward + perpY * eyeOffset * side,
          r: eyeR,
          class: "worm-eye"
        });
        wormLayer.appendChild(eye);
      }
    }
  }

  svg.appendChild(wormLayer);
}

function renderGraph(svg, data, state, onNodeClick) {
  svg.textContent = "";
  const map = nodeIndex(data.nodes);
  const layers = {
    edges: createSvgElement("g", { class: "edges-layer" }),
    nodes: createSvgElement("g", { class: "nodes-layer" }),
    labels: createSvgElement("g", { class: "labels-layer" })
  };

  for (const [from, to] of data.edges) {
    const source = map.get(from);
    const target = map.get(to);
    const line = createSvgElement("line", {
      x1: source.x,
      y1: source.y,
      x2: target.x,
      y2: target.y,
      class: "edge"
    });
    layers.edges.appendChild(line);
  }

  for (const node of data.nodes) {
    const circle = createSvgElement("circle", {
      cx: node.x,
      cy: node.y,
      r: 14,
      class: `node node-${node.type}`,
      "data-id": node.id
    });
    circle.addEventListener("click", () => onNodeClick(node.id));

    const label = createSvgElement("text", {
      x: node.x,
      y: node.y + 34,
      class: "node-label"
    });
    label.textContent = `${node.id}${node.type === "food" ? " •" : ""}`;

    layers.nodes.appendChild(circle);
    layers.labels.appendChild(label);
  }

  svg.appendChild(layers.edges);
  svg.appendChild(layers.nodes);
  svg.appendChild(layers.labels);
  renderWorm(svg, data, state.wormPath, state.animation);
}

function init() {
  if (levels.length === 0) {
    throw new Error("No levels loaded. Add level files to levels/ and include them in index.html.");
  }

  const svg = document.getElementById("graph");
  const prevButton = document.getElementById("prev-level");
  const nextButton = document.getElementById("next-level");
  const retryButton = document.getElementById("retry-level");
  const winNextButton = document.getElementById("win-next-level");
  const winMessage = document.getElementById("win-message");
  const levelName = document.getElementById("level-name");
  const levelMeta = document.getElementById("level-meta");

  if (!(svg instanceof SVGSVGElement)) {
    throw new Error("Missing #graph SVG element.");
  }
  if (!(prevButton instanceof HTMLButtonElement) || !(nextButton instanceof HTMLButtonElement)) {
    throw new Error("Missing level navigation buttons.");
  }
  if (!(retryButton instanceof HTMLButtonElement) || !(winNextButton instanceof HTMLButtonElement)) {
    throw new Error("Missing bottom control buttons.");
  }
  if (!(winMessage instanceof HTMLElement)) {
    throw new Error("Missing win message element.");
  }
  if (!(levelName instanceof HTMLElement) || !(levelMeta instanceof HTMLElement)) {
    throw new Error("Missing level info elements.");
  }

  function updateHeader() {
    const level = gameState.currentLevel;
    levelName.textContent = level.name;
    levelMeta.textContent = `Level ${gameState.levelIndex + 1}/${levels.length} · Length ${gameState.wormPath.length}/${gameState.wormLength}`;
    prevButton.disabled = gameState.levelIndex === 0;
    nextButton.disabled = gameState.levelIndex === levels.length - 1;
  }

  function updateBottomControls() {
    const hasNextLevel = gameState.levelIndex < levels.length - 1;
    winNextButton.hidden = !(gameState.isLevelWon && hasNextLevel);
    winMessage.hidden = !gameState.isLevelWon;
    retryButton.disabled = false;
  }

  function renderCurrentState() {
    validateWormPath(gameState.wormPath, gameState.nodeMap, gameState.graphEdges, gameState.wormLength);
    renderGraph(svg, gameState.currentLevel, gameState, (clickedNodeId) => {
      const head = gameState.wormPath[0];
      if (clickedNodeId === head) {
        return;
      }
      if (gameState.wormPath.includes(clickedNodeId)) {
        console.log(`Invalid move: ${clickedNodeId} is occupied by the worm.`);
        return;
      }
      if (!gameState.neighbors.get(head).has(clickedNodeId)) {
        console.log(`Invalid move: ${clickedNodeId} is not connected to ${head}.`);
        return;
      }

      const shouldGrowThisMove = gameState.wormPath.length < gameState.wormLength;
      const movedPath = [clickedNodeId, ...gameState.wormPath];
      const nextPath = shouldGrowThisMove ? movedPath : movedPath.slice(0, gameState.wormPath.length);
      if (new Set(nextPath).size !== nextPath.length) {
        console.log(`Invalid move: ${clickedNodeId} causes self-collision.`);
        return;
      }

      const oldPath = [...gameState.wormPath];

      gameState.wormPath = nextPath;
      const nextHeadNode = gameState.nodeMap.get(clickedNodeId);
      if (nextHeadNode.type === "food") {
        nextHeadNode.type = "normal";
        gameState.wormLength += 1;
      }
      gameState.isLevelWon = isWinningState(gameState);
      gameState.animation = {
        oldPath,
        t: 0,
        startTime: performance.now(),
        duration: 500
      };
      updateHeader();
      updateBottomControls();
      startAnimation();
    });
    updateHeader();
    updateBottomControls();
  }

  let animationFrameId = null;

  function startAnimation() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    animationFrameId = requestAnimationFrame(tick);
  }

  function tick(now) {
    const anim = gameState.animation;
    if (!anim) {
      animationFrameId = null;
      return;
    }
    const elapsed = now - anim.startTime;
    const rawT = Math.min(elapsed / anim.duration, 1);
    anim.t = easeInOutCubic(rawT);

    renderCurrentState();

    if (rawT < 1) {
      animationFrameId = requestAnimationFrame(tick);
    } else {
      gameState.animation = null;
      animationFrameId = null;
      renderCurrentState();
    }
  }

  function loadLevel(index) {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    gameState.animation = null;

    const level = cloneLevel(levels[index]);
    validateGraph(level);

    gameState.levelIndex = index;
    gameState.currentLevel = level;
    gameState.nodeMap = nodeIndex(level.nodes);
    gameState.graphEdges = edgeIndex(level.edges);
    gameState.neighbors = neighborIndex(level.nodes, level.edges);
    gameState.isLevelWon = false;
    gameState.wormLength = 1;
    gameState.wormPath = [findStartNode(level.nodes)];

    renderCurrentState();
  }

  prevButton.addEventListener("click", () => {
    if (gameState.levelIndex > 0) {
      loadLevel(gameState.levelIndex - 1);
    }
  });

  nextButton.addEventListener("click", () => {
    if (gameState.levelIndex < levels.length - 1) {
      loadLevel(gameState.levelIndex + 1);
    }
  });

  retryButton.addEventListener("click", () => {
    loadLevel(gameState.levelIndex);
  });

  winNextButton.addEventListener("click", () => {
    if (gameState.isLevelWon && gameState.levelIndex < levels.length - 1) {
      loadLevel(gameState.levelIndex + 1);
    }
  });

  loadLevel(0);
}

init();
