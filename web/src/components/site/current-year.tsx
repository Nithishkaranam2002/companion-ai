import { cacheLife } from "next/cache";

/** Copyright year: computed at build/revalidation time, refreshed daily. */
export async function CurrentYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}
