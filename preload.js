const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("notionSyncDesktop", {
  runCommand(command) {
    return ipcRenderer.invoke("notion-sync:command", command);
  },
  openLastPage() {
    return ipcRenderer.invoke("notion-sync:open-url");
  },
});
