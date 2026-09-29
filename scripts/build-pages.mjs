/**
 * Build statique pour GitHub Pages.
 *
 * L'export statique (`output: "export"`) est incompatible avec les routes API
 * et le proxy : on les déplace temporairement hors de `app/`, on build en mode
 * `local` (localStorage), puis on restaure toujours les fichiers, même en cas
 * d'échec du build.
 */
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
const stash = path.join(root, ".pages-stash")
const moves = [
  ["app/api", "api"],
  ["proxy.ts", "proxy.ts"],
]

function restore() {
  for (const [source, target] of moves) {
    const from = path.join(stash, target)
    if (existsSync(from)) renameSync(from, path.join(root, source))
  }
  rmSync(stash, { recursive: true, force: true })
}

if (existsSync(stash)) {
  console.log("Restauration d'un build précédent interrompu…")
  restore()
}

mkdirSync(stash, { recursive: true })
let status = 1
try {
  for (const [source, target] of moves) {
    const from = path.join(root, source)
    if (existsSync(from)) renameSync(from, path.join(stash, target))
  }
  rmSync(path.join(root, ".next"), { recursive: true, force: true })
  const result = spawnSync("npx", ["next", "build"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, NEXT_PUBLIC_STORAGE_MODE: "local", GITHUB_PAGES: "true" },
  })
  status = result.status ?? 1
  if (status === 0) {
    writeFileSync(path.join(root, "out", ".nojekyll"), "")
    console.log("\nExport statique prêt dans ./out")
  }
} finally {
  restore()
}
process.exit(status)
