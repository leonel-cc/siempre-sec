"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const child_process = require("child_process");
const fs = require("fs");
const path = require("path");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const fs__namespace = /* @__PURE__ */ _interopNamespaceDefault(fs);
const path__namespace = /* @__PURE__ */ _interopNamespaceDefault(path);
function resolveFfmpeg() {
  const candidates = [];
  const envPath = process.env.FFMPEG_PATH;
  if (envPath) {
    candidates.push(envPath);
    candidates.push(path__namespace.join(envPath, "ffmpeg.exe"));
  }
  if (process.resourcesPath) {
    candidates.push(path__namespace.join(process.resourcesPath, "bin", "ffmpeg.exe"));
  }
  candidates.push(path__namespace.join(__dirname, "..", "bin", "ffmpeg.exe"));
  for (const c of candidates) {
    try {
      if (fs__namespace.existsSync(c)) {
        const stat = fs__namespace.statSync(c);
        if (stat.isDirectory()) {
          const inner = path__namespace.join(c, "ffmpeg.exe");
          if (fs__namespace.existsSync(inner)) return inner;
        } else {
          return c;
        }
      }
    } catch {
    }
  }
  return "ffmpeg";
}
function listUsbDevices() {
  return new Promise((resolve) => {
    const ffmpeg = resolveFfmpeg();
    child_process.execFile(
      ffmpeg,
      ["-hide_banner", "-list_devices", "true", "-f", "dshow", "-i", "dummy"],
      { timeout: 15e3, windowsHide: true },
      (err, _stdout, stderr) => {
        const output = String(stderr || "");
        if (!output && err) {
          console.error(`USB enumeration failed (${ffmpeg}):`, err.message);
          return resolve({ devices: [], count: 0 });
        }
        const devices = [];
        let section = null;
        for (const line of output.split(/\r?\n/)) {
          if (/DirectShow video devices/i.test(line)) {
            section = "video";
            continue;
          }
          if (/DirectShow audio devices/i.test(line)) {
            section = "audio";
            continue;
          }
          if (/Alternative name/i.test(line)) continue;
          let name;
          let type = null;
          const typed = line.match(/"([^"]+)"\s*\((video|audio)\)/);
          if (typed) {
            name = typed[1];
            type = typed[2];
          } else {
            const plain = line.match(/"([^"]+)"/);
            if (plain && section === "video") {
              name = plain[1];
              type = "video";
            }
          }
          if (name && type === "video" && name.trim()) {
            devices.push({ index: devices.length, name: name.trim() });
          }
        }
        resolve({ devices, count: devices.length });
      }
    );
  });
}
exports.listUsbDevices = listUsbDevices;
