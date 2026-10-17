import fs from "node:fs";

import { deleteTestUser } from "./auth-helper";
import { ANON_FILE, AUTH_DIR, USER_FILE } from "./global-setup";

export default async function globalTeardown() {
  for (const file of [ANON_FILE, USER_FILE]) {
    if (!fs.existsSync(file)) continue;
    const data = JSON.parse(fs.readFileSync(file, "utf8")) as { id?: string; user?: { id: string } };
    const id = data.id ?? data.user?.id;
    if (id) await deleteTestUser(id);
  }
  fs.rmSync(AUTH_DIR, { recursive: true, force: true });
}
