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

loadProjectEnv(path.join(CLI_CWD, ".env"));

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

function loadProjectEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

async function testDestinationConnection(profile) {
  const normalized = normalizeProfile(profile);
  if (!normalized) {
    throw new Error("Invalid profile.");
  }

  switch (normalized.destination) {
    case "file":
      return testFileConnection(normalized);
    case "notion":
      return testNotionConnection();
    case "remote":
      return testRemoteConnection();
    case "supabase":
      return testSupabaseConnection();
    default:
      throw new Error(`Unsupported destination: ${normalized.destination}`);
  }
}

async function testFileConnection(profile) {
  const outputDir = path.resolve(CLI_CWD, profile.outputDir || "./exports");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.accessSync(outputDir, fs.constants.W_OK);
  return `OK: file destination writable at ${outputDir}`;
}

async function testNotionConnection() {
  const notionToken = process.env.NOTION_TOKEN;
  const notionDatabaseId = process.env.NOTION_DATABASE_ID;
  if (!notionToken || !notionDatabaseId) {
    throw new Error("Missing NOTION_TOKEN or NOTION_DATABASE_ID.");
  }

  const response = await fetch(`https://api.notion.com/v1/databases/${notionDatabaseId}`, {
    headers: {
      Authorization: `Bearer ${notionToken}`,
      "Notion-Version": "2022-06-28",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Notion test failed (${response.status}): ${text}`);
  }

  return `OK: Notion database reachable (${notionDatabaseId})`;
}

async function testRemoteConnection() {
  const apiUrl = process.env.NOTION_SYNC_API_URL;
  if (!apiUrl) {
    throw new Error("Missing NOTION_SYNC_API_URL.");
  }

  const healthUrl = apiUrl.replace(/\/api\/sync\/?$/, "/api/health");
  const response = await fetch(healthUrl);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Remote test failed (${response.status}): ${text}`);
  }

  return `OK: remote intake reachable (${healthUrl})`;
}

async function testSupabaseConnection() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  const supabaseTable = process.env.SUPABASE_TABLE || "session_exports";
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_KEY.");
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${supabaseTable}?select=id&limit=1`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase test failed (${response.status}): ${text}`);
  }

  return `OK: Supabase table reachable (${supabaseTable})`;
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

  ipcMain.handle("notion-sync:profiles:test", async (_event, profile) => {
    return testDestinationConnection(profile);
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
