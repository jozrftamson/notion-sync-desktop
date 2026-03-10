const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("notionSyncDesktop", {
  runCommand(command, extraArgs = []) {
    return ipcRenderer.invoke("notion-sync:command", command, extraArgs);
  },
  openLastPage() {
    return ipcRenderer.invoke("notion-sync:open-url");
  },
});
