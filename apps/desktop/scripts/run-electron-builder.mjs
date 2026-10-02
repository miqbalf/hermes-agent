// Resolve electronDist at runtime (#38673, #47917): electron-builder 26.8.x can
// re-unpack a broken Electron.app; reusing the installed dist dodges that.
// npm workspace hoisting is non-deterministic — require.resolve finds electron
// wherever it landed. Dist present → -c.electronDist=<abs>/dist; absent → let
// electron-builder fetch via @electron/get (electronVersion + ELECTRON_MIRROR).

import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

function electronDistDir() {
  try {
    return path.join(path.dirname(require.resolve("electron/package.json")), "dist")
  } catch {
    return null
  }
}

function distBinary(dist) {
  if (process.platform === "darwin") {
    return path.join(dist, "Electron.app", "Contents", "MacOS", "Electron")
  }
  if (process.platform === "win32") {
    return path.join(dist, "electron.exe")
  }
  return path.join(dist, "electron")
}

function electronBuilderCli() {
  const pkgJson = require.resolve("electron-builder/package.json")
  const bin = require(pkgJson).bin
  const rel = typeof bin === "string" ? bin : bin["electron-builder"]
  return path.join(path.dirname(pkgJson), rel)
}

// macOS TCC binds privacy grants (Documents, Desktop, ...) to the designated
// requirement. Ad-hoc builds pin it to the cdhash, so every rebuild loses the
// grant. A stable local identity makes the requirement survive rebuilds.
const LOCAL_MAC_IDENTITY = process.env.HERMES_MAC_SIGN_IDENTITY || "Hermes Local Signing"

function localMacIdentityEnv() {
  if (process.platform !== "darwin") return {}
  if (process.env.CSC_NAME || process.env.CSC_LINK) return {}
  if (process.env.CSC_IDENTITY_AUTO_DISCOVERY === "false") return {}
  const res = spawnSync("security", ["find-identity", "-p", "codesigning"], { encoding: "utf8" })
  const lines = (res.stdout || "").split("\n").filter((l) => l.includes(`"${LOCAL_MAC_IDENTITY}"`))
  if (lines.length === 0) return {}
  if (lines.every((l) => l.includes("CSSMERR_TP_NOT_TRUSTED"))) {
    console.warn(
      `[run-electron-builder] "${LOCAL_MAC_IDENTITY}" is in the keychain but not trusted for ` +
        "code signing; electron-builder will skip it and the build will be ad-hoc signed."
    )
    return {}
  }
  console.log(`[run-electron-builder] signing with local identity "${LOCAL_MAC_IDENTITY}"`)
  return { CSC_NAME: LOCAL_MAC_IDENTITY }
}

const dist = electronDistDir()
const args = []
if (dist && fs.existsSync(distBinary(dist))) {
  args.push(`-c.electronDist=${dist}`)
} else {
  console.warn(
    "[run-electron-builder] no local electron dist; electron-builder will fetch " +
      "via @electron/get (electronVersion + ELECTRON_MIRROR)."
  )
}
args.push(...process.argv.slice(2))

const result = spawnSync(process.execPath, [electronBuilderCli(), ...args], {
  stdio: "inherit",
  env: { ...process.env, ...localMacIdentityEnv() },
})
if (result.error) {
  console.error(`[run-electron-builder] spawn failed: ${result.error.message}`)
  process.exit(1)
}
process.exit(result.status == null ? 1 : result.status)
