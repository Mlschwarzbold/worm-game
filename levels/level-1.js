window.WORM_LEVELS = window.WORM_LEVELS || [];

window.WORM_LEVELS.push({
  id: "level-1",
  name: "Starter Loop",
  nodes: [
    { id: "A", x: 120, y: 120, type: "start" },
    { id: "B", x: 260, y: 90, type: "normal" },
    { id: "C", x: 420, y: 120, type: "food" },
    { id: "D", x: 570, y: 90, type: "normal" },
    { id: "E", x: 680, y: 180, type: "end" },
    { id: "F", x: 600, y: 310, type: "food" },
    { id: "G", x: 430, y: 360, type: "normal" },
    { id: "H", x: 260, y: 300, type: "normal" },
    { id: "I", x: 130, y: 240, type: "food" },
    { id: "J", x: 340, y: 220, type: "normal" }
  ],
  edges: [
    ["A", "B"], ["B", "C"], ["C", "D"], ["D", "E"],
    ["E", "F"], ["F", "G"], ["G", "H"], ["H", "I"],
    ["I", "A"], ["B", "J"], ["J", "G"], ["C", "J"], ["H", "J"]
  ]
});
