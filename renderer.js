const statusOutput = document.querySelector("#status-output");
const commandOutput = document.querySelector("#command-output");
const statusPill = document.querySelector("#status-pill");
const lastCommand = document.querySelector("#last-command");
const commandButtons = document.querySelectorAll("[data-command]");
const openPageButton = document.querySelector("#open-page");
const profileSelect = document.querySelector("#profile-select");
const latestCountInput = document.querySelector("#latest-count");
const outputDirInput = document.querySelector("#output-dir");
const runProfileButton = document.querySelector("#run-profile");
const saveProfileButton = document.querySelector("#save-profile");

let profiles = [];

async function run(command, options = {}) {
  statusPill.textContent = "Running";
  lastCommand.textContent = options.args?.length ? `${command} ${options.args.join(" ")}` : command;

  try {
    const result = options.open
      ? await window.notionSyncDesktop.openLastPage()
      : await window.notionSyncDesktop.runCommand(command, options.args || []);

    commandOutput.textContent = result || "Command completed with no output.";

    if (command === "status" || command === "doctor") {
      statusOutput.textContent = result;
      statusPill.textContent = "Ready";
      return;
    }

    statusPill.textContent = "Ready";
    await refreshStatus();
  } catch (error) {
    const message = error.message || String(error);
    commandOutput.textContent = message;
    statusPill.textContent = "Error";
  }
}

async function refreshStatus() {
  try {
    const result = await window.notionSyncDesktop.runCommand("status");
    statusOutput.textContent = result;
    if (lastCommand.textContent === "status") {
      commandOutput.textContent = result;
    }
  } catch (error) {
    const message = error.message || String(error);
    statusOutput.textContent = message;
    statusPill.textContent = "Error";
  }
}

for (const button of commandButtons) {
  button.addEventListener("click", () => {
    const args = button.dataset.args ? button.dataset.args.split(" ").filter(Boolean) : [];
    run(button.dataset.command, { args });
  });
}

openPageButton.addEventListener("click", () => run("open", { open: true }));

runProfileButton.addEventListener("click", () => {
  const profile = profiles.find((item) => item.id === profileSelect.value) || profiles[0];
  if (!profile) {
    commandOutput.textContent = "No export profile available.";
    statusPill.textContent = "Error";
    return;
  }
  const latestCount = Math.max(1, Number.parseInt(latestCountInput.value || "1", 10) || 1);
  const args = ["--latest", String(latestCount), "--destination", profile.destination];
  if (profile.destination === "file") {
    args.push("--output-dir", outputDirInput.value.trim() || "./exports");
  }
  run("export-codex-latest", { args });
});

saveProfileButton.addEventListener("click", async () => {
  const selected = profiles.find((item) => item.id === profileSelect.value) || profiles[0];
  const destination = selected?.destination || "file";
  const outputDir = destination === "file" ? outputDirInput.value.trim() || "./exports" : "";
  const latest = Math.max(1, Number.parseInt(latestCountInput.value || "1", 10) || 1);
  const name = window.prompt("Profile name", selected?.name || `${destination} profile`);
  if (!name) {
    return;
  }

  const id = slugify(name);
  const next = profiles.filter((item) => item.id !== id).concat({
    id,
    name,
    destination,
    latest,
    outputDir,
  });

  profiles = await window.notionSyncDesktop.saveProfiles(next);
  renderProfiles(id);
});

profileSelect.addEventListener("change", () => {
  syncProfileInputs();
});

function renderProfiles(selectedId) {
  profileSelect.innerHTML = "";
  for (const profile of profiles) {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.name;
    profileSelect.appendChild(option);
  }

  const fallbackId = selectedId && profiles.some((item) => item.id === selectedId) ? selectedId : profiles[0]?.id;
  if (fallbackId) {
    profileSelect.value = fallbackId;
  }
  syncProfileInputs();
}

function syncProfileInputs() {
  const profile = profiles.find((item) => item.id === profileSelect.value) || profiles[0];
  if (!profile) {
    return;
  }
  latestCountInput.value = String(profile.latest || 1);
  outputDirInput.value = profile.outputDir || "./exports";
  outputDirInput.disabled = profile.destination !== "file";
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "profile";
}

refreshStatus().then(() => {
  lastCommand.textContent = "status";
  commandOutput.textContent = statusOutput.textContent;
});

window.notionSyncDesktop.listProfiles().then((loadedProfiles) => {
  profiles = Array.isArray(loadedProfiles) ? loadedProfiles : [];
  renderProfiles();
});
