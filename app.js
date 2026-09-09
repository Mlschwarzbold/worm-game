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

  const hasAnim = anim && anim.oldPath;
  const tailAnimated = hasAnim && !anim.isGrowing;

  for (let i = hasAnim ? 1 : 0; i < path.length - 1; i += 1) {
    const from = nodePos(path[i]);
    const to = nodePos(path[i + 1]);
    wormLayer.appendChild(createSvgElement("line", {
      x1: from.x, y1: from.y, x2: to.x, y2: to.y,
      class: "worm-edge", opacity: 0.6
    }));
  }

  for (let i = 0; i < path.length; i += 1) {
    const isTail = i === path.length - 1;
    if (isTail && tailAnimated) continue;

    const pos = nodePos(path[i]);
    const roleClass = i === 0 ? "worm-head" : (isTail ? "worm-tail" : "worm-body");
    const opacity = i === 0 ? 1 : 0.6;
    wormLayer.appendChild(createSvgElement("circle", {
      cx: pos.x, cy: pos.y, r: 19,
      class: `worm-node ${roleClass}`, opacity: opacity
    }));

    if (i === 0 && path.length > 1) {
      const behind = nodePos(path[1]);
      const dx = pos.x - behind.x;
      const dy = pos.y - behind.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;
      const perpX = -ny;
      const perpY = nx;
      for (const side of [-1, 1]) {
        wormLayer.appendChild(createSvgElement("circle", {
          cx: pos.x + nx * 4 + perpX * 6 * side,
          cy: pos.y + ny * 4 + perpY * 6 * side,
          r: 4, class: "worm-eye"
        }));
      }
    }
  }

  if (hasAnim) {
    const oldHeadPos = nodePos(anim.oldPath[0]);
    const newHeadPos = nodePos(path[0]);
    const ghostHeadPos = {
      x: lerp(oldHeadPos.x, newHeadPos.x, anim.t),
      y: lerp(oldHeadPos.y, newHeadPos.y, anim.t)
    };

    wormLayer.appendChild(createSvgElement("circle", {
      cx: ghostHeadPos.x, cy: ghostHeadPos.y, r: 19,
      class: "worm-node worm-head",
      opacity: 0.4, "stroke-dasharray": "4 4"
    }));

    if (tailAnimated) {
      const ghostTailPos = nodePos(anim.oldPath[anim.oldPath.length - 1]);
      const newTailPos = nodePos(path[path.length - 1]);
      const animTailPos = {
        x: lerp(ghostTailPos.x, newTailPos.x, anim.t),
        y: lerp(ghostTailPos.y, newTailPos.y, anim.t)
      };
      wormLayer.appendChild(createSvgElement("circle", {
        cx: ghostTailPos.x, cy: ghostTailPos.y, r: 19,
        class: "worm-node worm-tail",
        opacity: 0.4, "stroke-dasharray": "4 4"
      }));
      wormLayer.appendChild(createSvgElement("circle", {
        cx: animTailPos.x, cy: animTailPos.y, r: 19,
        class: "worm-node worm-tail",
        opacity: 0.4, fill: "#3a7afe"
      }));
      const lastReal = nodePos(path[path.length - 1]);
      wormLayer.appendChild(createSvgElement("line", {
        x1: lastReal.x, y1: lastReal.y,
        x2: animTailPos.x, y2: animTailPos.y,
        class: "worm-edge", opacity: 0.6
      }));
    }

    if (path.length > 1) {
      const secondReal = nodePos(path[1]);
      wormLayer.appendChild(createSvgElement("line", {
        x1: ghostHeadPos.x, y1: ghostHeadPos.y,
        x2: secondReal.x, y2: secondReal.y,
        class: "worm-edge", opacity: 0.6
      }));
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
        isGrowing: shouldGrowThisMove,
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
