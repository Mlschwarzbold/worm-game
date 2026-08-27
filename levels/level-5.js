window.WORM_LEVELS = window.WORM_LEVELS || [];

window.WORM_LEVELS.push({
  id: "level-5",
  name: "Loopy 2",
  nodes: [
    { id: "A", x: 100, y: 250, type: "start" },
    { id: "B", x: 250, y: 100, type: "food" },
    { id: "C", x: 420, y: 130, type: "food" },
    { id: "D", x: 540, y: 250, type: "food" },
    { id: "E", x: 320, y: 420, type: "food" },
    { id: "F", x: 370, y: 270, type: "food" },
    { id: "G", x: 630, y: 250, type: "end" },
    { id: "H", x: 125, y: 80, type: "food" }
  ],
  edges: [
    ["A", "B"], ["B", "C"], ["C", "D"], ["B", "F"],
    ["A", "E"], ["E", "D"], ["A", "H"], ["H", "B"],
    ["A", "F"], ["F", "C"], ["D", "G"]

  ]
});
