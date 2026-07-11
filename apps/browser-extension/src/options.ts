import { getRules, setRules, type CaptureRule } from "./rules.js";

const rulesEl = document.getElementById("rules")!;
const patternEl = document.getElementById("pattern") as HTMLInputElement;
const addEl = document.getElementById("add") as HTMLButtonElement;

async function render() {
  const rules = await getRules();
  rulesEl.innerHTML = "";
  for (const rule of rules) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${rule.pattern}</span>`;
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", async () => {
      await setRules((await getRules()).filter((r) => r.id !== rule.id));
      render();
    });
    li.appendChild(removeBtn);
    rulesEl.appendChild(li);
  }
}

addEl.addEventListener("click", async () => {
  const pattern = patternEl.value.trim();
  if (!pattern) return;
  const rule: CaptureRule = { id: crypto.randomUUID(), pattern };
  await setRules([...(await getRules()), rule]);
  patternEl.value = "";
  render();
});

render();
