window.WORM_LEVELS = window.WORM_LEVELS || [];

window.WORM_LEVELS.push({
  id: "level-3",
  name: "Ring and Spine",
  nodes: [
    { id: "A", x: 200, y: 150, type: "start" },
    { id: "B", x: 350, y: 100, type: "normal" },
    { id: "C", x: 520, y: 130, type: "food" },
    { id: "D", x: 640, y: 250, type: "normal" },
    { id: "E", x: 620, y: 390, type: "food" },
    { id: "F", x: 470, y: 470, type: "end" },
    { id: "G", x: 300, y: 440, type: "normal" },
    { id: "H", x: 180, y: 310, type: "food" },
    { id: "I", x: 410, y: 280, type: "normal" }
  ],
  edges: [
    ["A", "B"], ["B", "C"], ["C", "D"], ["D", "E"],
    ["E", "F"], ["F", "G"], ["G", "H"], ["H", "A"],
    ["B", "I"], ["I", "E"], ["I", "G"], ["I", "C"]
  ]
});
