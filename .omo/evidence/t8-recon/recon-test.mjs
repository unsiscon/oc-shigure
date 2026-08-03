import { createSignal } from "solid-js";
import { createElement, insert, setProp, testRender } from "@opentui/solid";

const [state, setState] = createSignal("idle");
const LABELS = { idle: "待机", thinking: "思考", success: "完成" };

const setup = await testRender(() => {
  const root = createElement("box");
  setProp(root, "flexDirection", "column");
  insert(root, () => {
    const nodes = [];
    const row = createElement("text");
    insert(row, "ROW-1");
    nodes.push(row);
    const row2 = createElement("text");
    insert(row2, "ROW-2");
    nodes.push(row2);
    const label = createElement("text");
    insert(label, LABELS[state()]);
    nodes.push(label);
    return nodes;
  });
  return root;
}, { width: 40, height: 20 });

await setup.flush();
console.log("--- initial ---");
console.log(setup.captureCharFrame());
setState("thinking");
await setup.flush();
console.log("--- thinking ---");
console.log(setup.captureCharFrame());
setState("success");
await setup.flush();
console.log("--- success ---");
console.log(setup.captureCharFrame());
