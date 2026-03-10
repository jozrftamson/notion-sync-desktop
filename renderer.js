const statusOutput = document.querySelector("#status-output");
const commandOutput = document.querySelector("#command-output");
const statusPill = document.querySelector("#status-pill");
const lastCommand = document.querySelector("#last-command");
const commandButtons = document.querySelectorAll("[data-command]");
const openPageButton = document.querySelector("#open-page");
const profileSelect = document.querySelector("#profile-select");
const latestCountInput = document.querySelector("#latest-count");
const runProfileButton = document.querySelector("#run-profile");

const profileArgs = {
  file: ["--destination", "file", "--output-dir", "./exports"],
  notion: ["--destination", "notion"],
  remote: ["--destination", "remote"],
  supabase: ["--destination", "supabase"],
};

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
  const latestCount = Math.max(1, Number.parseInt(latestCountInput.value || "1", 10) || 1);
  const profile = profileSelect.value || "file";
  const args = ["--latest", String(latestCount), ...profileArgs[profile]];
  run("export-codex-latest", { args });
});

refreshStatus().then(() => {
  lastCommand.textContent = "status";
  commandOutput.textContent = statusOutput.textContent;
});
