"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
  minimize: () => electron.ipcRenderer.send("window-minimize"),
  maximize: () => electron.ipcRenderer.send("window-maximize"),
  close: () => electron.ipcRenderer.send("window-close"),
  openFileDialog: (options) => electron.ipcRenderer.invoke("open-file-dialog", options || {}),
  listUsbDevices: () => electron.ipcRenderer.invoke("list-usb-devices")
});
