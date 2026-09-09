const levels = Array.isArray(window.WORM_LEVELS) ? window.WORM_LEVELS : [];
const SVG_NS = "http://www.w3.org/2000/svg";

const proximityState = {
  nodeCircles: [],
  highlightCircle: null,
  svg: null,
  onNodeClick: null
};

const gameState = {
  levelIndex: 0,
  currentLevel: null,
  nodeMap: null,
  graphEdges: null,
  neighbors: null,
  isLevelWon: false,
  wormLength: 1,
  wormPath: [],
  animation: null,
  lastEyeDir: null
};

const confettiCanvas = document.getElementById("confetti-canvas");
const confettiCtx = confettiCanvas.getContext("2d");
let confettiParticles = [];
let confettiRunning = false;

function resizeConfettiCanvas() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeConfettiCanvas);
resizeConfettiCanvas();

function launchConfetti() {
  confettiCanvas.classList.add("active");
  const colors = ["#22c55e", "#3a7afe", "#f2b635", "#da4b4b", "#a855f7", "#ec4899"];
  confettiParticles = [];
  for (let i = 0; i < 120; i += 1) {
    confettiParticles.push({
      x: Math.random() * confettiCanvas.width,
      y: confettiCanvas.height + Math.random() * 100,
      vx: (Math.random() - 0.5) * 8,
      vy: -(Math.random() * 12 + 8),
      w: Math.random() * 8 + 4,
      h: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      opacity: 1
    });
  }
  if (!confettiRunning) {
    confettiRunning = true;
    requestAnimationFrame(tickConfetti);
  }
}

function tickConfetti() {
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  let alive = false;
  for (const p of confettiParticles) {
    p.x += p.vx;
    p.vy += 0.25;
    p.y += p.vy;
    p.rotation += p.rotationSpeed;
    if (p.y > confettiCanvas.height + 50) {
      p.opacity -= 0.02;
    }
    if (p.opacity <= 0) continue;
    alive = true;
    confettiCtx.save();
    confettiCtx.translate(p.x, p.y);
    confettiCtx.rotate((p.rotation * Math.PI) / 180);
    confettiCtx.globalAlpha = Math.max(0, p.opacity);
    confettiCtx.fillStyle = p.color;
    confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    confettiCtx.restore();
  }
  if (alive) {
    requestAnimationFrame(tickConfetti);
  } else {
    confettiRunning = false;
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    confettiCanvas.classList.remove("active");
  }
}

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
  const tailAnimated = hasAnim && !anim.isGrowing && path.length > 1;

  for (let i = hasAnim ? 1 : 0; i < path.length - 1; i += 1) {
    const from = nodePos(path[i]);
    const to = nodePos(path[i + 1]);
    wormLayer.appendChild(createSvgElement("line", {
      x1: from.x, y1: from.y, x2: to.x, y2: to.y,
      class: "worm-edge", opacity: 1
    }));
  }

  for (let i = 0; i < path.length; i += 1) {
    const isHead = i === 0;
    const isTail = i === path.length - 1;
    if (isTail && tailAnimated) continue;
    if (isHead) continue;

    const pos = nodePos(path[i]);
    const roleClass = isTail ? "worm-tail" : "worm-body";
    wormLayer.appendChild(createSvgElement("circle", {
      cx: pos.x, cy: pos.y, r: 19,
      class: `worm-node ${roleClass}`, opacity: 1
    }));
  }

  const headPos = hasAnim
    ? { x: lerp(nodePos(anim.oldPath[0]).x, nodePos(path[0]).x, anim.t),
        y: lerp(nodePos(anim.oldPath[0]).y, nodePos(path[0]).y, anim.t) }
    : nodePos(path[0]);

  if (hasAnim) {
    if (tailAnimated) {
      const ghostTailPos = nodePos(anim.oldPath[anim.oldPath.length - 1]);
      const newTailPos = nodePos(path[path.length - 1]);
      const animTailPos = {
        x: lerp(ghostTailPos.x, newTailPos.x, anim.t),
        y: lerp(ghostTailPos.y, newTailPos.y, anim.t)
      };
      const lastReal = nodePos(path[path.length - 1]);
      wormLayer.appendChild(createSvgElement("line", {
        x1: lastReal.x, y1: lastReal.y,
        x2: animTailPos.x, y2: animTailPos.y,
        class: "worm-edge", opacity: 1
      }));
    }

    if (path.length > 1) {
      const secondReal = nodePos(path[1]);
      wormLayer.appendChild(createSvgElement("line", {
        x1: headPos.x, y1: headPos.y,
        x2: secondReal.x, y2: secondReal.y,
        class: "worm-edge", opacity: 1
      }));
    }
  }

  wormLayer.appendChild(createSvgElement("circle", {
    cx: headPos.x, cy: headPos.y, r: 19,
    class: "worm-node worm-head", opacity: 1
  }));

  let eyeDir;
  if (hasAnim) {
    const behind = path.length > 1 ? nodePos(anim.oldPath[0]) : nodePos(anim.oldPath[0]);
    const dx = headPos.x - behind.x;
    const dy = headPos.y - behind.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    eyeDir = { x: dx / dist, y: dy / dist };
    gameState.lastEyeDir = eyeDir;
  } else if (gameState.lastEyeDir) {
    eyeDir = gameState.lastEyeDir;
  } else {
    eyeDir = { x: 0, y: -1 };
  }
  const perpX = -eyeDir.y;
  const perpY = eyeDir.x;
  for (const side of [-1, 1]) {
    wormLayer.appendChild(createSvgElement("circle", {
      cx: headPos.x + eyeDir.x * 4 + perpX * 6 * side,
      cy: headPos.y + eyeDir.y * 4 + perpY * 6 * side,
      r: 4, class: "worm-eye"
    }));
  }

  svg.appendChild(wormLayer);
}

function renderGraph(svg, data, state, onNodeClick) {
  svg.textContent = "";
  proximityState.onNodeClick = onNodeClick;
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

  proximityState.nodeCircles = [];
  proximityState.highlightCircle = createSvgElement("circle", {
    r: 18, fill: "none", stroke: "#22c55e", "stroke-width": 3,
    "pointer-events": "none", visibility: "hidden"
  });

  for (const node of data.nodes) {
    const circle = createSvgElement("circle", {
      cx: node.x,
      cy: node.y,
      r: 14,
      class: `node node-${node.type}`,
      "data-id": node.id
    });
    circle.addEventListener("click", () => onNodeClick(node.id));
    proximityState.nodeCircles.push({ id: node.id, x: node.x, y: node.y, el: circle });

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
  svg.appendChild(proximityState.highlightCircle);
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

  proximityState.svg = svg;
  const PROXIMITY_RADIUS = 60;

  svg.addEventListener("mousemove", (e) => {
    const rect = svg.getBoundingClientRect();
    const scaleX = svg.viewBox.baseVal.width / rect.width;
    const scaleY = svg.viewBox.baseVal.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const head = gameState.wormPath[0];
    const reachable = head && gameState.neighbors.get(head)
      ? new Set([...gameState.neighbors.get(head)].filter((id) => !gameState.wormPath.includes(id)))
      : new Set();

    let closest = null;
    let closestDist = Infinity;

    for (const node of proximityState.nodeCircles) {
      const dx = mx - node.x;
      const dy = my - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < PROXIMITY_RADIUS) {
        const intensity = 1 - dist / PROXIMITY_RADIUS;
        const blur = 4 + intensity * 12;
        node.el.style.filter = `drop-shadow(0 0 ${blur}px rgba(180, 180, 180, ${0.3 + intensity * 0.5}))`;
      } else {
        node.el.style.filter = "";
      }

      if (dist < closestDist) {
        closestDist = dist;
        closest = node;
      }
    }

    if (closest && closestDist < PROXIMITY_RADIUS) {
      const color = reachable.has(closest.id) ? "#22c55e" : "#999999";
      proximityState.highlightCircle.setAttribute("cx", closest.x);
      proximityState.highlightCircle.setAttribute("cy", closest.y);
      proximityState.highlightCircle.setAttribute("stroke", color);
      proximityState.highlightCircle.setAttribute("visibility", "visible");
    } else {
      proximityState.highlightCircle.setAttribute("visibility", "hidden");
    }
  });

  svg.addEventListener("mouseleave", () => {
    for (const node of proximityState.nodeCircles) {
      node.el.style.filter = "";
    }
    proximityState.highlightCircle.setAttribute("visibility", "hidden");
  });

  svg.addEventListener("click", (e) => {
    if (e.target !== svg && !e.target.classList.contains("edge")) return;

    const rect = svg.getBoundingClientRect();
    const scaleX = svg.viewBox.baseVal.width / rect.width;
    const scaleY = svg.viewBox.baseVal.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const head = gameState.wormPath[0];
    const reachable = head && gameState.neighbors.get(head)
      ? new Set([...gameState.neighbors.get(head)].filter((id) => !gameState.wormPath.includes(id)))
      : new Set();

    let closest = null;
    let closestDist = Infinity;

    for (const node of proximityState.nodeCircles) {
      const dx = mx - node.x;
      const dy = my - node.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist) {
        closestDist = dist;
        closest = node;
      }
    }

    if (closest && closestDist < PROXIMITY_RADIUS && reachable.has(closest.id)) {
      proximityState.onNodeClick(closest.id);
    }
  });

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

    const head = gameState.wormPath[0];
    const reachable = head && gameState.neighbors.get(head)
      ? [...gameState.neighbors.get(head)].filter((id) => !gameState.wormPath.includes(id))
      : [];
    const stuck = reachable.length === 0 && !gameState.isLevelWon;

    if (stuck) {
      retryButton.style.background = "#da4b4b";
      retryButton.style.color = "#ffffff";
      retryButton.style.borderColor = "#da4b4b";
    } else {
      retryButton.style.background = "";
      retryButton.style.color = "";
      retryButton.style.borderColor = "";
    }
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
      if (gameState.isLevelWon) {
        launchConfetti();
      }
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
    gameState.lastEyeDir = null;

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
