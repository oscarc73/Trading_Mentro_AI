import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const appDirectory = path.resolve(scriptDirectory, "..");
const nextDirectory = path.resolve(appDirectory, ".next");

if (
  path.basename(nextDirectory) !== ".next" ||
  path.dirname(nextDirectory) !== appDirectory
) {
  throw new Error(`Refusing to remove unexpected path: ${nextDirectory}`);
}

await rm(nextDirectory, { recursive: true, force: true });
console.log(`Removed generated Next.js cache: ${nextDirectory}`);
