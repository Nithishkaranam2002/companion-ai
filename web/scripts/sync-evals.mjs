// Copy the aggregate eval summary into the web app (run after re-running evals).
import { copyFileSync } from "node:fs";
copyFileSync(new URL("../../evals/results/summary.json", import.meta.url),
             new URL("../src/data/eval-summary.json", import.meta.url));
console.log("synced eval summary");
