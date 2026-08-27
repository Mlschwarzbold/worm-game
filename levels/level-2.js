window.WORM_LEVELS = window.WORM_LEVELS || [];

window.WORM_LEVELS.push({
  id: "level-2",
  name: "Crossroads",
  nodes: [
    { id: "A", x: 120, y: 300, type: "start" },
    { id: "B", x: 240, y: 190, type: "normal" },
    { id: "C", x: 240, y: 410, type: "food" },
    { id: "D", x: 380, y: 300, type: "normal" },
    { id: "E", x: 520, y: 190, type: "food" },
    { id: "F", x: 520, y: 410, type: "normal" },
    { id: "G", x: 680, y: 300, type: "end" }
  ],
  edges: [
    ["A", "B"], ["A", "C"], ["B", "D"], ["C", "D"],
    ["D", "E"], ["D", "F"], ["E", "G"], ["F", "G"]
  ]
});
