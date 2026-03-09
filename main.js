const path = require("path");
const os = require("os");
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { execFile } = require("child_process");

const APP_DIR = __dirname;
const CLI_PATH = process.env.NOTION_SYNC_CLI_PATH || "notion-sync";
const CLI_CWD = process.env.NOTION_SYNC_WORKDIR || os.homedir();

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 980,
    minHeight: 700,
    backgroundColor: "#e8ece6",
    webPreferences: {
      preload: path.join(APP_DIR, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(APP_DIR, "index.html"));
}

function runCli(command) {
  return new Promise((resolve, reject) => {
    execFile(CLI_PATH, [command], { cwd: CLI_CWD }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

app.whenReady().then(() => {
  ipcMain.handle("notion-sync:command", async (_event, command) => {
    if (!["init", "doctor", "status", "report", "open", "dry-run", "run", "help", "remote"].includes(command)) {
      throw new Error(`Unsupported command: ${command}`);
    }
    return runCli(command);
  });

  ipcMain.handle("notion-sync:open-url", async () => {
    const url = await runCli("open");
    await shell.openExternal(url);
    return url;
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
