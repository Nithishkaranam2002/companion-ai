import fs from "node:fs";

import { deleteTestUser } from "./auth-helper";
import { authPaths } from "./global-setup";

export default async function globalTeardown() {
  const paths = authPaths();
  for (const file of [paths.anon, paths.user]) {
    if (!fs.existsSync(file)) continue;
    const data = JSON.parse(fs.readFileSync(file, "utf8")) as { id?: string; user?: { id: string } };
    const id = data.id ?? data.user?.id;
    if (id) await deleteTestUser(id);
  }
  fs.rmSync(paths.dir, { recursive: true, force: true }); // only this run's folder
}
