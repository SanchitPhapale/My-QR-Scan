/* ============================================================
   $anchit Builds — redirect.js
   Branded loading screen + secure URL redirect logic
   ============================================================ */

const REDIRECT_DELAY_MS = 3500;

document.addEventListener("DOMContentLoaded", () => {
  applyTheme();
  const rawParam = getUrlParam("url");

  if (!rawParam) {
    showInvalidState();
    return;
  }

  let destination;
  try {
    destination = decodeURIComponent(rawParam);
  } catch {
    showInvalidState();
    return;
  }

  if (!isValidUrl(destination)) {
    showInvalidState();
    return;
  }

  showValidState(destination);
  startRedirect(destination);
});

// ─── Theme ───────────────────────────────────────────────────
function applyTheme() {
  const saved = localStorage.getItem("anchitBuilds_theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
}

// ─── URL helpers ─────────────────────────────────────────────
function getUrlParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function isValidUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

// ─── State rendering ─────────────────────────────────────────
function showInvalidState() {
  document.getElementById("stateValid").style.display = "none";
  document.getElementById("stateInvalid").style.display = "block";
  document.title = "Invalid QR Code — $anchit Builds";
}

function showValidState(destination) {
  const destEl = document.getElementById("destUrl");
  if (destEl)
    destEl.textContent =
      destination.length > 70
        ? destination.substring(0, 67) + "…"
        : destination;
}

// ─── Redirect with progress ───────────────────────────────────
function startRedirect(destination) {
  const fill = document.getElementById("progressFill");
  const pct = document.getElementById("progressPct");
  const eta = document.getElementById("progressEta");
  const progressBar = document.getElementById("progressBar");

  const startTime = Date.now();
  const interval = 50;

  const etaMessages = [
    "Verifying destination…",
    "Checking safety…",
    "Almost there…",
    "Redirecting now…",
  ];

  const timer = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min((elapsed / REDIRECT_DELAY_MS) * 100, 100);
    const remaining = Math.max(
      0,
      Math.ceil((REDIRECT_DELAY_MS - elapsed) / 1000),
    );

    if (fill) fill.style.width = progress.toFixed(1) + "%";
    if (pct) pct.textContent = Math.round(progress) + "%";
    if (progressBar)
      progressBar.setAttribute("aria-valuenow", Math.round(progress));

    const msgIndex = Math.min(
      Math.floor(progress / 25),
      etaMessages.length - 1,
    );
    if (eta) {
      eta.textContent =
        remaining > 0
          ? `~${remaining}s remaining — ${etaMessages[msgIndex]}`
          : etaMessages[etaMessages.length - 1];
    }

    if (elapsed >= REDIRECT_DELAY_MS) {
      clearInterval(timer);
      if (fill) fill.style.width = "100%";
      if (pct) pct.textContent = "100%";
      window.location.href = destination;
    }
  }, interval);
}
