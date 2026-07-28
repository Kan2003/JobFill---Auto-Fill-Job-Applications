"use strict";

const FIELD_MAP = [
  "fullName", "firstName", "lastName",
  "email", "phone",
  "address", "city", "state", "zip", "country",
  "jobTitle", "currentCompany", "expYears", "expMonths", "skills",
  "noticePeriod", "desiredSalary", "willingToRelocate", "startDateAvailable",
  "resumeUrl",
  "linkedin", "github", "portfolio"
];

// Education is stored as one nested object under the "education" key
const EDUCATION_FIELDS = ["school", "degree", "fieldOfStudy", "graduationDate", "gpa", "location"];

const TABS = ["personal", "professional", "education", "social"];
let currentTab = 0;

// ── Status bar ───────────────────────────────────────────────────────────────
function showStatus(msg, type = "info") {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.className = type;
  if (type !== "error") setTimeout(() => { el.className = ""; el.textContent = ""; }, 2500);
}

// ── Progress UI ──────────────────────────────────────────────────────────────
function updateProgress() {
  TABS.forEach((tab, i) => {
    const step = document.getElementById("step-" + tab);
    step.classList.remove("active", "done");
    if (i < currentTab)       step.classList.add("done");
    else if (i === currentTab) step.classList.add("active");
  });

  // Connecting lines
  for (let i = 1; i < TABS.length; i++) {
    const line = document.getElementById("line-" + i);
    if (line) line.classList.toggle("done", currentTab >= i);
  }

  // Back button
  document.getElementById("btnBack").disabled = currentTab === 0;

  // Save button label
  const btnSave = document.getElementById("btnSave");
  btnSave.textContent = currentTab < TABS.length - 1 ? "Save & Continue →" : "Save Details ✓";
}

function switchToTab(index) {
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
  const panel = document.getElementById("tab-" + TABS[index]);
  if (panel) panel.classList.add("active");
  currentTab = index;
  updateProgress();
}

// ── PDF upload handling ──────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function showPdfLoaded(name, size) {
  document.getElementById("pdfEmpty").style.display  = "none";
  document.getElementById("pdfLoaded").style.display = "block";
  document.getElementById("pdfFileName").textContent = name;
  document.getElementById("pdfFileSize").textContent = size;
}

function showPdfEmpty() {
  document.getElementById("pdfEmpty").style.display  = "block";
  document.getElementById("pdfLoaded").style.display = "none";
}

document.getElementById("pdfUploadArea").addEventListener("click", () => {
  document.getElementById("resumeFilePicker").click();
});

document.getElementById("resumeFilePicker").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
    showStatus("Please select a PDF file.", "error");
    return;
  }
  const sizeLabel = formatBytes(file.size);
  const reader = new FileReader();
  reader.onload = (ev) => {
    const base64 = ev.target.result; // "data:application/pdf;base64,..."
    chrome.storage.local.set({ resumePdf: base64, resumePdfName: file.name }, () => {
      if (chrome.runtime.lastError) {
        showStatus("PDF too large to store: " + chrome.runtime.lastError.message, "error");
      } else {
        showPdfLoaded(file.name, sizeLabel);
        showStatus("Resume PDF saved!", "success");
      }
    });
  };
  reader.readAsDataURL(file);
});

document.getElementById("pdfRemoveBtn").addEventListener("click", (e) => {
  e.stopPropagation(); // don't re-open file picker
  chrome.storage.local.remove(["resumePdf", "resumePdfName"], () => {
    showPdfEmpty();
    document.getElementById("resumeFilePicker").value = "";
    showStatus("Resume PDF removed.", "info");
  });
});

// ── Load saved data ──────────────────────────────────────────────────────────
function loadData() {
  chrome.storage.local.get([...FIELD_MAP, "education", "resumePdfName", "resumePdf"], (data) => {
    FIELD_MAP.forEach((key) => {
      const el = document.getElementById(key);
      if (el && data[key] !== undefined) el.value = data[key];
    });
    const edu = data.education || {};
    EDUCATION_FIELDS.forEach((key) => {
      const el = document.getElementById(key);
      if (el && edu[key] !== undefined) el.value = edu[key];
    });
    if (data.resumePdfName && data.resumePdf) {
      // Estimate stored size from base64 length
      const bytes = Math.round((data.resumePdf.length * 3) / 4);
      showPdfLoaded(data.resumePdfName, formatBytes(bytes));
    }
  });
}

// ── Collect current form values ──────────────────────────────────────────────
function collectData() {
  const data = {};
  FIELD_MAP.forEach((key) => {
    const el = document.getElementById(key);
    if (el) data[key] = el.value.trim();
  });
  const education = {};
  EDUCATION_FIELDS.forEach((key) => {
    const el = document.getElementById(key);
    if (el) education[key] = el.value.trim();
  });
  data.education = education;
  return data;
}

// ── Save & advance to next tab ───────────────────────────────────────────────
function saveAndAdvance() {
  const data = collectData();
  chrome.storage.local.set(data, () => {
    if (chrome.runtime.lastError) {
      showStatus("Error saving: " + chrome.runtime.lastError.message, "error");
      return;
    }
    if (currentTab < TABS.length - 1) {
      showStatus("Saved!", "success");
      switchToTab(currentTab + 1);
    } else {
      showStatus("All details saved!", "success");
    }
  });
}

// ── Fill the active browser tab ──────────────────────────────────────────────
function fillPage() {
  const data = collectData();
  const hasAny = Object.values(data).some((v) =>
    typeof v === "string" ? v !== "" : Object.values(v || {}).some((s) => s !== "")
  );
  if (!hasAny) {
    showStatus("Add your details first, then click Fill Page.", "error");
    return;
  }

  chrome.storage.local.set(data, () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) { showStatus("No active tab found.", "error"); return; }
      const tabId = tabs[0].id;

      chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }, () => {
        const err = chrome.runtime.lastError;
        if (err && !err.message.includes("already")) {
          showStatus("Cannot fill this page: " + err.message, "error");
          return;
        }
        chrome.tabs.sendMessage(tabId, { action: "fill" }, (response) => {
          if (chrome.runtime.lastError) {
            showStatus("Could not reach page. Try refreshing.", "error");
            return;
          }
          if (response && response.filled !== undefined) {
            showStatus(
              response.filled > 0
                ? `Filled ${response.filled} field(s) on the page.`
                : "No matching fields found on this page.",
              response.filled > 0 ? "success" : "info"
            );
          }
        });
      });
    });
  });
}

// ── Progress step click (jump to any tab) ────────────────────────────────────
document.querySelectorAll(".progress-step").forEach((step) => {
  step.addEventListener("click", () => {
    const idx = TABS.indexOf(step.dataset.tab);
    if (idx !== -1) switchToTab(idx);
  });
});

// ── Wire buttons ─────────────────────────────────────────────────────────────
document.getElementById("btnSave").addEventListener("click", saveAndAdvance);
document.getElementById("btnBack").addEventListener("click", () => {
  if (currentTab > 0) switchToTab(currentTab - 1);
});
document.getElementById("btnFill").addEventListener("click", fillPage);

// ── Init ─────────────────────────────────────────────────────────────────────
loadData();
updateProgress();
