const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("notionSyncDesktop", {
  runCommand(command, extraArgs = []) {
    return ipcRenderer.invoke("notion-sync:command", command, extraArgs);
  },
  openLastPage() {
    return ipcRenderer.invoke("notion-sync:open-url");
  },
  listProfiles() {
    return ipcRenderer.invoke("notion-sync:profiles:list");
  },
  saveProfiles(profiles) {
    return ipcRenderer.invoke("notion-sync:profiles:save", profiles);
  },
});
