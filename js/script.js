/* ============================================================
   $anchit Builds — script.js
   QR Code Generator — all client-side logic
   ============================================================ */

// ─── Constants ──────────────────────────────────────────────
const STORAGE_KEY_HISTORY = "anchitBuilds_qrHistory";
const STORAGE_KEY_THEME = "anchitBuilds_theme";
const REDIRECT_BASE =
  window.location.origin +
  window.location.pathname.replace(/\/[^/]*$/, "/") +
  "redirect.html";
const DEBOUNCE_DELAY = 450;

// ─── State ──────────────────────────────────────────────────
let qrInstance = null;
let currentLogoData = null;
let debounceTimer = null;
let currentQrUrl = "";
let renameTargetId = null;
let historyList = [];

// ─── DOM References ──────────────────────────────────────────
const dom = {
  // form
  form: () => document.getElementById("qrForm"),
  urlInput: () => document.getElementById("qrUrl"),
  titleInput: () => document.getElementById("qrTitle"),
  descInput: () => document.getElementById("qrDesc"),
  urlError: () => document.getElementById("urlError"),
  // sliders
  sizeInput: () => document.getElementById("qrSize"),
  sizeVal: () => document.getElementById("qrSizeVal"),
  marginInput: () => document.getElementById("qrMargin"),
  marginVal: () => document.getElementById("qrMarginVal"),
  logoSizeInput: () => document.getElementById("logoSize"),
  logoSizeVal: () => document.getElementById("logoSizeVal"),
  logoSizeGroup: () => document.getElementById("logoSizeGroup"),
  // colors
  fgColor: () => document.getElementById("qrFgColor"),
  bgColor: () => document.getElementById("qrBgColor"),
  fgHex: () => document.getElementById("fgHex"),
  bgHex: () => document.getElementById("bgHex"),
  // selects
  dotStyle: () => document.getElementById("dotStyle"),
  eyeStyle: () => document.getElementById("eyeStyle"),
  errorLevel: () => document.getElementById("errorLevel"),
  // logo
  logoUpload: () => document.getElementById("logoUpload"),
  logoDropArea: () => document.getElementById("logoDropArea"),
  fileNameDisplay: () => document.getElementById("fileNameDisplay"),
  removeLogo: () => document.getElementById("removeLogo"),
  // buttons
  generateBtn: () => document.getElementById("generateBtn"),
  resetBtn: () => document.getElementById("resetBtn"),
  dlPng: () => document.getElementById("dlPng"),
  dlSvg: () => document.getElementById("dlSvg"),
  dlPdf: () => document.getElementById("dlPdf"),
  copyLinkBtn: () => document.getElementById("copyLinkBtn"),
  shareBtn: () => document.getElementById("shareBtn"),
  // preview
  qrContainer: () => document.getElementById("qrContainer"),
  qrPlaceholder: () => document.getElementById("qrPlaceholder"),
  qrLoading: () => document.getElementById("qrLoading"),
  qrPreviewArea: () => document.getElementById("qrPreviewArea"),
  downloadActions: () => document.getElementById("downloadActions"),
  qrMeta: () => document.getElementById("qrMeta"),
  qrMetaTitle: () => document.getElementById("qrMetaTitle"),
  qrMetaUrl: () => document.getElementById("qrMetaUrl"),
  // history
  historyGrid: () => document.getElementById("historyGrid"),
  historyEmpty: () => document.getElementById("historyEmpty"),
  clearHistoryBtn: () => document.getElementById("clearHistoryBtn"),
  // modal
  renameModal: () => document.getElementById("renameModal"),
  renameInput: () => document.getElementById("renameInput"),
  renameConfirm: () => document.getElementById("renameConfirm"),
  renameCancel: () => document.getElementById("renameCancel"),
  // theme
  themeToggle: () => document.getElementById("themeToggle"),
  // footer
  footerYear: () => document.getElementById("footerYear"),
};

// ─── Init ────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initSliderLabels();
  initColorPickers();
  initLogoUpload();
  initFormListeners();
  initButtons();
  initModalListeners();
  loadHistory();
  if (dom.footerYear()) dom.footerYear().textContent = new Date().getFullYear();
});

// ─── Theme ───────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY_THEME) || "light";
  applyTheme(saved);
  dom.themeToggle().addEventListener("click", () => {
    const next =
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "light"
        : "dark";
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY_THEME, next);
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  dom
    .themeToggle()
    .setAttribute(
      "aria-label",
      theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
    );
}

// ─── Slider Labels ───────────────────────────────────────────
function initSliderLabels() {
  const bind = (inputId, labelEl) => {
    const el = document.getElementById(inputId);
    if (!el || !labelEl) return;
    labelEl.textContent = el.value;
    el.addEventListener("input", () => {
      labelEl.textContent = el.value;
    });
  };
  bind("qrSize", dom.sizeVal());
  bind("qrMargin", dom.marginVal());
  bind("logoSize", dom.logoSizeVal());
}

// ─── Color Pickers ───────────────────────────────────────────
function initColorPickers() {
  dom.fgColor().addEventListener("input", () => {
    dom.fgHex().textContent = dom.fgColor().value;
    scheduleUpdate();
  });
  dom.bgColor().addEventListener("input", () => {
    dom.bgHex().textContent = dom.bgColor().value;
    scheduleUpdate();
  });
}

// ─── Logo Upload ─────────────────────────────────────────────
function initLogoUpload() {
  const drop = dom.logoDropArea();
  const input = dom.logoUpload();

  input.addEventListener("change", handleLogoFile);

  drop.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.classList.add("drag-over");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("drag-over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) processLogoFile(file);
  });

  dom.removeLogo().addEventListener("click", removeLogo);
  dom.logoSizeInput().addEventListener("input", () => {
    dom.logoSizeVal().textContent = dom.logoSizeInput().value;
    scheduleUpdate();
  });
}

function handleLogoFile(e) {
  const file = e.target.files[0];
  if (file) processLogoFile(file);
}

function processLogoFile(file) {
  if (!file.type.startsWith("image/")) {
    showToast("Please upload an image file (PNG, JPG, SVG).", "error");
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    currentLogoData = e.target.result;
    dom.fileNameDisplay().textContent = file.name;
    dom.logoSizeGroup().style.display = "block";
    scheduleUpdate();
    showToast("Logo uploaded!", "success");
  };
  reader.readAsDataURL(file);
}

function removeLogo() {
  currentLogoData = null;
  dom.logoUpload().value = "";
  dom.fileNameDisplay().textContent = "PNG, JPG, SVG supported";
  dom.logoSizeGroup().style.display = "none";
  scheduleUpdate();
  showToast("Logo removed.", "info");
}

// ─── Form Listeners ──────────────────────────────────────────
function initFormListeners() {
  // Live preview on all inputs
  ["input", "change"].forEach((evt) => {
    dom.urlInput().addEventListener(evt, () => {
      clearUrlError();
      scheduleUpdate();
    });
    dom.titleInput().addEventListener(evt, scheduleUpdate);
    dom.descInput().addEventListener(evt, scheduleUpdate);
    dom.sizeInput().addEventListener(evt, scheduleUpdate);
    dom.marginInput().addEventListener(evt, scheduleUpdate);
    dom.dotStyle().addEventListener(evt, scheduleUpdate);
    dom.eyeStyle().addEventListener(evt, scheduleUpdate);
    dom.errorLevel().addEventListener(evt, scheduleUpdate);
  });

  dom.form().addEventListener("submit", (e) => {
    e.preventDefault();
    generateQR(true);
  });
}

// ─── Buttons ─────────────────────────────────────────────────
function initButtons() {
  dom.resetBtn().addEventListener("click", resetAll);
  dom.dlPng().addEventListener("click", () => downloadQR("png"));
  dom.dlSvg().addEventListener("click", () => downloadQR("svg"));
  dom.dlPdf().addEventListener("click", downloadPDF);
  dom.copyLinkBtn().addEventListener("click", copyQRLink);
  dom.shareBtn().addEventListener("click", shareQR);
  dom.clearHistoryBtn().addEventListener("click", clearHistory);

  // Ripple on all buttons
  document
    .querySelectorAll(".btn-primary, .btn-ghost, .btn-download")
    .forEach(addRipple);
}

function addRipple(btn) {
  btn.addEventListener("click", function (e) {
    const rect = this.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.style.cssText = `
      position:absolute; border-radius:50%; background:rgba(255,255,255,0.35);
      transform:scale(0); animation:rippleAnim 0.55s linear;
      left:${e.clientX - rect.left - 20}px; top:${e.clientY - rect.top - 20}px;
      width:40px; height:40px; pointer-events:none;
    `;
    this.style.position = "relative";
    this.style.overflow = "hidden";
    this.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  });
}

// ─── Debounced Live Preview ───────────────────────────────────
function scheduleUpdate() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (dom.urlInput().value.trim()) generateQR(false);
  }, DEBOUNCE_DELAY);
}

// ─── URL Validation ──────────────────────────────────────────
function validateUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    // Try adding https:// prefix for www. URLs
    if (url.startsWith("www.")) {
      try {
        new URL("https://" + url);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

function normalizeUrl(url) {
  if (url.startsWith("www.")) return "https://" + url;
  return url;
}

function clearUrlError() {
  dom.urlError().textContent = "";
  dom.urlInput().classList.remove("error");
}

function showUrlError(msg) {
  dom.urlError().textContent = msg;
  dom.urlInput().classList.add("error");
}

// ─── Build QR Config ─────────────────────────────────────────
function buildQRConfig(qrUrl) {
  const size = parseInt(dom.sizeInput().value, 10);
  const margin = parseInt(dom.marginInput().value, 10);
  const fg = dom.fgColor().value;
  const bg = dom.bgColor().value;
  const dotType = dom.dotStyle().value;
  const eyeType = dom.eyeStyle().value;
  const errLevel = dom.errorLevel().value;
  const logoSize = parseInt(dom.logoSizeInput().value, 10) / 100;

  const config = {
    width: size,
    height: size,
    type: "canvas",
    data: qrUrl,
    margin: margin,
    qrOptions: { errorCorrectionLevel: errLevel },
    dotsOptions: { color: fg, type: dotType },
    backgroundOptions: { color: bg },
    cornersSquareOptions: { type: eyeType },
    cornersDotOptions: { type: eyeType === "dot" ? "dot" : "square" },
  };

  if (currentLogoData) {
    config.image = currentLogoData;
    config.imageOptions = {
      hideBackgroundDots: true,
      imageSize: logoSize,
      margin: 4,
      crossOrigin: "anonymous",
      saveAsBlob: true,
    };
  }

  return config;
}

// ─── Core Generate ───────────────────────────────────────────
function generateQR(saveToHistory) {
  const rawUrl = dom.urlInput().value.trim();
  if (!rawUrl) {
    if (saveToHistory) showUrlError("Please enter a URL.");
    return;
  }

  const normalized = normalizeUrl(rawUrl);
  if (!validateUrl(normalized)) {
    showUrlError("Please enter a valid URL (https://example.com).");
    if (saveToHistory)
      showToast("Invalid URL. Please check and try again.", "error");
    return;
  }

  clearUrlError();

  const redirectUrl = `${REDIRECT_BASE}?url=${encodeURIComponent(normalized)}`;
  currentQrUrl = normalized;

  const config = buildQRConfig(redirectUrl);

  showQRLoading();

  if (qrInstance) {
    qrInstance.update(config);
  } else {
    const container = dom.qrContainer();
    container.innerHTML = "";
    qrInstance = new QRCodeStyling(config);
    qrInstance.append(container);
  }

  setTimeout(() => {
    showQRPreview();

    const title = dom.titleInput().value.trim();
    dom.qrMetaTitle().textContent = title || normalized;
    dom.qrMetaUrl().textContent = normalized;
    dom.qrMeta().style.display = "block";
    dom.downloadActions().style.display = "grid";

    if (saveToHistory) {
      saveToHistoryStore(normalized, title, dom.descInput().value.trim());
      showToast("QR Code generated!", "success");
    }
  }, 350);
}

function showQRLoading() {
  dom.qrPlaceholder().style.display = "none";
  dom.qrContainer().style.display = "none";
  dom.qrLoading().style.display = "flex";
}

function showQRPreview() {
  dom.qrLoading().style.display = "none";
  dom.qrContainer().style.display = "block";
  dom.qrPreviewArea().classList.add("has-qr");
}

// ─── Downloads ───────────────────────────────────────────────
function getFilename() {
  const title = dom.titleInput().value.trim();
  return title ? title.replace(/[^a-z0-9]/gi, "_").toLowerCase() : "qr_code";
}

async function downloadQR(ext) {
  if (!qrInstance) return;
  try {
    await qrInstance.download({ name: getFilename(), extension: ext });
    showToast(`Downloaded as ${ext.toUpperCase()}!`, "success");
  } catch (err) {
    showToast("Download failed. Try again.", "error");
  }
}

async function downloadPDF() {
  if (!qrInstance) return;
  try {
    const blob = await qrInstance.getRawData("png");
    const reader = new FileReader();
    reader.onload = function () {
      const img = reader.result;
      const size = parseInt(dom.sizeInput().value, 10);
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [size + 80, size + 140],
      });
      const title = dom.titleInput().value.trim() || "$anchit Builds QR";
      const url = currentQrUrl;
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();

      // White background
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, pdfW, pdfH, "F");

      // Header bar
      pdf.setFillColor(14, 165, 233);
      pdf.rect(0, 0, pdfW, 36, "F");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.setTextColor(255, 255, 255);
      pdf.text("$anchit Builds", pdfW / 2, 23, { align: "center" });

      // QR image centered
      const margin = 40;
      pdf.addImage(img, "PNG", margin, 48, size, size);

      // Title below QR
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(15, 23, 42);
      pdf.text(title.substring(0, 50), pdfW / 2, 56 + size, {
        align: "center",
      });

      // URL
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 116, 139);
      const urlShort = url.length > 60 ? url.substring(0, 57) + "…" : url;
      pdf.text(urlShort, pdfW / 2, 56 + size + 16, { align: "center" });

      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184);
      pdf.text("Generated by sanchitbuilds.in", pdfW / 2, pdfH - 12, {
        align: "center",
      });

      pdf.save(getFilename() + ".pdf");
      showToast("Downloaded as PDF!", "success");
    };
    reader.readAsDataURL(blob);
  } catch {
    showToast("PDF generation failed.", "error");
  }
}

// ─── Copy / Share ─────────────────────────────────────────────
function copyQRLink() {
  if (!currentQrUrl) return;
  const link = `${REDIRECT_BASE}?url=${encodeURIComponent(currentQrUrl)}`;
  navigator.clipboard
    .writeText(link)
    .then(() => {
      showToast("Redirect link copied!", "success");
    })
    .catch(() => {
      fallbackCopy(link);
    });
}

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
    showToast("Link copied!", "success");
  } catch {
    showToast("Copy failed.", "error");
  }
  document.body.removeChild(ta);
}

async function shareQR() {
  if (!currentQrUrl || !qrInstance) return;
  if (!navigator.share) {
    showToast("Sharing is not supported on this browser.", "warning");
    return;
  }
  try {
    const blob = await qrInstance.getRawData("png");
    const file = new File([blob], getFilename() + ".png", {
      type: "image/png",
    });
    await navigator.share({
      title: dom.titleInput().value.trim() || "$anchit Builds QR Code",
      text: `QR Code for ${currentQrUrl}`,
      files: [file],
    });
    showToast("Shared successfully!", "success");
  } catch (err) {
    if (err.name !== "AbortError") showToast("Share failed.", "error");
  }
}

// ─── Reset ───────────────────────────────────────────────────
function resetAll() {
  dom.form().reset();
  currentLogoData = null;
  currentQrUrl = "";
  qrInstance = null;

  dom.fileNameDisplay().textContent = "PNG, JPG, SVG supported";
  dom.logoSizeGroup().style.display = "none";
  dom.qrContainer().innerHTML = "";
  dom.qrContainer().style.display = "none";
  dom.qrPlaceholder().style.display = "flex";
  dom.qrLoading().style.display = "none";
  dom.downloadActions().style.display = "none";
  dom.qrMeta().style.display = "none";
  dom.qrPreviewArea().classList.remove("has-qr");

  dom.fgHex().textContent = "#0f172a";
  dom.bgHex().textContent = "#ffffff";
  dom.sizeVal().textContent = "300";
  dom.marginVal().textContent = "2";
  dom.logoSizeVal().textContent = "30";

  clearUrlError();
  clearTimeout(debounceTimer);
  showToast("Reset complete.", "info");
}

// ─── History ─────────────────────────────────────────────────
function loadHistory() {
  try {
    historyList = JSON.parse(localStorage.getItem(STORAGE_KEY_HISTORY)) || [];
  } catch {
    historyList = [];
  }
  renderHistory();
}

function saveToHistoryStore(url, title, desc) {
  const entry = {
    id: Date.now().toString(),
    url,
    title: title || url,
    desc,
    date: new Date().toISOString(),
    fg: dom.fgColor().value,
    bg: dom.bgColor().value,
    dot: dom.dotStyle().value,
    eye: dom.eyeStyle().value,
    err: dom.errorLevel().value,
    size: dom.sizeInput().value,
    margin: dom.marginInput().value,
  };

  historyList.unshift(entry);
  if (historyList.length > 20) historyList = historyList.slice(0, 20);
  localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(historyList));
  renderHistory();
}

function renderHistory() {
  const grid = dom.historyGrid();
  const empty = dom.historyEmpty();

  // Remove all cards (keep empty placeholder)
  Array.from(grid.querySelectorAll(".history-card")).forEach((c) => c.remove());

  if (historyList.length === 0) {
    empty.style.display = "flex";
    return;
  }
  empty.style.display = "none";

  historyList.forEach((entry, idx) => {
    const card = buildHistoryCard(entry, idx);
    grid.appendChild(card);
  });
}

function buildHistoryCard(entry, idx) {
  const card = document.createElement("div");
  card.className = "history-card glass-card";
  card.setAttribute("role", "listitem");
  card.style.animationDelay = `${idx * 0.05}s`;

  const date = new Date(entry.date);
  const dateStr = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  card.innerHTML = `
    <div class="history-card-top">
      <div class="history-qr-thumb" id="thumb-${entry.id}"></div>
      <div class="history-info">
        <div class="history-title">${escapeHtml(entry.title)}</div>
        <div class="history-url">${escapeHtml(entry.url)}</div>
        <div class="history-date">${dateStr}</div>
      </div>
    </div>
    ${entry.desc ? `<div class="history-desc">${escapeHtml(entry.desc)}</div>` : ""}
    <div class="history-actions">
      <button class="history-btn" data-action="copy"       data-id="${entry.id}" aria-label="Copy link for ${escapeHtml(entry.title)}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy
      </button>
      <button class="history-btn" data-action="download"   data-id="${entry.id}" aria-label="Download ${escapeHtml(entry.title)}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Download
      </button>
      <button class="history-btn" data-action="regenerate" data-id="${entry.id}" aria-label="Regenerate ${escapeHtml(entry.title)}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.89"/></svg>Regen
      </button>
      <button class="history-btn" data-action="rename"     data-id="${entry.id}" aria-label="Rename ${escapeHtml(entry.title)}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>Rename
      </button>
      <button class="history-btn danger" data-action="delete" data-id="${entry.id}" aria-label="Delete ${escapeHtml(entry.title)}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>Delete
      </button>
    </div>
  `;

  card
    .querySelector(".history-actions")
    .addEventListener("click", handleHistoryAction);

  // Render tiny QR thumbnail
  setTimeout(() => renderThumbnail(entry), 0);

  return card;
}

function renderThumbnail(entry) {
  const thumbEl = document.getElementById(`thumb-${entry.id}`);
  if (!thumbEl) return;
  try {
    const redirectUrl = `${REDIRECT_BASE}?url=${encodeURIComponent(entry.url)}`;
    const mini = new QRCodeStyling({
      width: 72,
      height: 72,
      type: "canvas",
      data: redirectUrl,
      margin: 1,
      qrOptions: { errorCorrectionLevel: entry.err || "M" },
      dotsOptions: {
        color: entry.fg || "#0f172a",
        type: entry.dot || "rounded",
      },
      backgroundOptions: { color: entry.bg || "#ffffff" },
      cornersSquareOptions: { type: entry.eye || "extra-rounded" },
    });
    mini.append(thumbEl);
  } catch {
    /* silent */
  }
}

function handleHistoryAction(e) {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const { action, id } = btn.dataset;
  const entry = historyList.find((h) => h.id === id);
  if (!entry) return;

  switch (action) {
    case "copy":
      copyHistoryLink(entry);
      break;
    case "download":
      downloadHistoryQR(entry);
      break;
    case "regenerate":
      regenerateFromHistory(entry);
      break;
    case "rename":
      openRenameModal(id);
      break;
    case "delete":
      deleteHistoryEntry(id);
      break;
  }
}

function copyHistoryLink(entry) {
  const link = `${REDIRECT_BASE}?url=${encodeURIComponent(entry.url)}`;
  navigator.clipboard
    .writeText(link)
    .then(() => {
      showToast("Link copied!", "success");
    })
    .catch(() => fallbackCopy(link));
}

function downloadHistoryQR(entry) {
  const redirectUrl = `${REDIRECT_BASE}?url=${encodeURIComponent(entry.url)}`;
  const qr = new QRCodeStyling({
    width: parseInt(entry.size) || 400,
    height: parseInt(entry.size) || 400,
    type: "canvas",
    data: redirectUrl,
    margin: parseInt(entry.margin) || 2,
    qrOptions: { errorCorrectionLevel: entry.err || "M" },
    dotsOptions: { color: entry.fg || "#0f172a", type: entry.dot || "rounded" },
    backgroundOptions: { color: entry.bg || "#ffffff" },
    cornersSquareOptions: { type: entry.eye || "extra-rounded" },
  });
  const tmp = document.createElement("div");
  tmp.style.display = "none";
  document.body.appendChild(tmp);
  qr.append(tmp);
  setTimeout(() => {
    qr.download({
      name: entry.title.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "qr_code",
      extension: "png",
    });
    setTimeout(() => document.body.removeChild(tmp), 2000);
    showToast("Downloading QR Code…", "info");
  }, 300);
}

function regenerateFromHistory(entry) {
  dom.urlInput().value = entry.url;
  dom.titleInput().value = entry.title !== entry.url ? entry.title : "";
  dom.descInput().value = entry.desc || "";
  dom.fgColor().value = entry.fg || "#0f172a";
  dom.bgColor().value = entry.bg || "#ffffff";
  dom.dotStyle().value = entry.dot || "rounded";
  dom.eyeStyle().value = entry.eye || "extra-rounded";
  dom.errorLevel().value = entry.err || "M";
  dom.sizeInput().value = entry.size || 300;
  dom.marginInput().value = entry.margin || 2;
  dom.fgHex().textContent = entry.fg || "#0f172a";
  dom.bgHex().textContent = entry.bg || "#ffffff";
  dom.sizeVal().textContent = entry.size || 300;
  dom.marginVal().textContent = entry.margin || 2;

  window.scrollTo({
    top: document.getElementById("generator").offsetTop - 80,
    behavior: "smooth",
  });
  generateQR(false);
  showToast("QR settings restored!", "info");
}

function deleteHistoryEntry(id) {
  historyList = historyList.filter((h) => h.id !== id);
  localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(historyList));
  renderHistory();
  showToast("QR Code deleted.", "warning");
}

function clearHistory() {
  if (historyList.length === 0) return;
  historyList = [];
  localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(historyList));
  renderHistory();
  showToast("History cleared.", "warning");
}

// ─── Rename Modal ────────────────────────────────────────────
function initModalListeners() {
  dom.renameConfirm().addEventListener("click", confirmRename);
  dom.renameCancel().addEventListener("click", closeRenameModal);
  dom.renameModal().addEventListener("click", (e) => {
    if (e.target === dom.renameModal()) closeRenameModal();
  });
  dom.renameInput().addEventListener("keydown", (e) => {
    if (e.key === "Enter") confirmRename();
    if (e.key === "Escape") closeRenameModal();
  });
}

function openRenameModal(id) {
  renameTargetId = id;
  const entry = historyList.find((h) => h.id === id);
  if (!entry) return;
  dom.renameInput().value = entry.title;
  dom.renameModal().style.display = "flex";
  setTimeout(() => dom.renameInput().focus(), 50);
}

function closeRenameModal() {
  dom.renameModal().style.display = "none";
  renameTargetId = null;
}

function confirmRename() {
  const newTitle = dom.renameInput().value.trim();
  if (!newTitle) {
    showToast("Please enter a title.", "warning");
    return;
  }
  const entry = historyList.find((h) => h.id === renameTargetId);
  if (entry) {
    entry.title = newTitle;
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(historyList));
    renderHistory();
    showToast("QR Code renamed!", "success");
  }
  closeRenameModal();
}

// ─── Toast Notifications ─────────────────────────────────────
const TOAST_ICONS = {
  success:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>',
  error:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
  warning:
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
};

function showToast(message, type = "info", duration = 3500) {
  const container = dom.toastContainer
    ? dom.toastContainer()
    : document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${TOAST_ICONS[type] || TOAST_ICONS.info}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("toast-out");
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

// ─── Utilities ───────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ─── Ripple CSS (injected once) ───────────────────────────────
(function injectRippleStyle() {
  const style = document.createElement("style");
  style.textContent =
    "@keyframes rippleAnim{to{transform:scale(18);opacity:0}}";
  document.head.appendChild(style);
})();

// Expose toastContainer helper
dom.toastContainer = () => document.getElementById("toastContainer");
