const path = require("path");
const os = require("os");
const fs = require("fs");
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { execFile } = require("child_process");

const APP_DIR = __dirname;
const CLI_PATH = process.env.NOTION_SYNC_CLI_PATH || "notion-sync";
const CLI_CWD = process.env.NOTION_SYNC_WORKDIR || os.homedir();
const DEFAULT_PROFILES = [
  { id: "file", name: "File archive", destination: "file", latest: 1, outputDir: "./exports" },
  { id: "notion", name: "Notion page", destination: "notion", latest: 1, outputDir: "" },
  { id: "remote", name: "Remote intake", destination: "remote", latest: 1, outputDir: "" },
  { id: "supabase", name: "Supabase row", destination: "supabase", latest: 1, outputDir: "" },
];

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

function runCli(command, extraArgs = []) {
  return new Promise((resolve, reject) => {
    execFile(CLI_PATH, [command, ...extraArgs], { cwd: CLI_CWD }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

function getProfilesFilePath() {
  return path.join(app.getPath("userData"), "profiles.json");
}

function loadProfiles() {
  const filePath = getProfilesFilePath();
  if (!fs.existsSync(filePath)) {
    return DEFAULT_PROFILES;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!Array.isArray(parsed) || !parsed.length) {
      return DEFAULT_PROFILES;
    }
    return parsed.map(normalizeProfile).filter(Boolean);
  } catch {
    return DEFAULT_PROFILES;
  }
}

function saveProfiles(profiles) {
  const filePath = getProfilesFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(profiles.map(normalizeProfile).filter(Boolean), null, 2));
}

function normalizeProfile(profile) {
  if (!profile || typeof profile !== "object") {
    return null;
  }

  const destination = String(profile.destination || "file");
  return {
    id: String(profile.id || slugify(profile.name || destination)),
    name: String(profile.name || destination),
    destination,
    latest: Math.max(1, Number.parseInt(String(profile.latest || "1"), 10) || 1),
    outputDir: String(profile.outputDir || ""),
  };
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "profile";
}

app.whenReady().then(() => {
  ipcMain.handle("notion-sync:command", async (_event, command, extraArgs = []) => {
    if (!["init", "doctor", "status", "report", "open", "dry-run", "run", "help", "remote", "export-codex", "export-codex-latest"].includes(command)) {
      throw new Error(`Unsupported command: ${command}`);
    }
    return runCli(command, extraArgs);
  });

  ipcMain.handle("notion-sync:open-url", async () => {
    const url = await runCli("open");
    await shell.openExternal(url);
    return url;
  });

  ipcMain.handle("notion-sync:profiles:list", async () => {
    return loadProfiles();
  });

  ipcMain.handle("notion-sync:profiles:save", async (_event, profiles) => {
    saveProfiles(Array.isArray(profiles) ? profiles : DEFAULT_PROFILES);
    return loadProfiles();
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
