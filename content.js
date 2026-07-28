"use strict";

// ── Field pattern mappings ────────────────────────────────────────────────────
const FIELD_MAPPINGS = {
  firstName:       ["first.name","firstname","first_name","fname","given.name","given_name","givenname"],
  lastName:        ["last.name","lastname","last_name","lname","family.name","surname","familyname"],
  fullName:        ["full.name","fullname","full_name","your.name","your_name","yourname","^name$","applicant.name"],
  email:           ["email","e-mail","email.address","emailaddress","email_address"],
  phone:           ["phone","telephone","mobile","cell","contact.number","phone.number","phonenumber","phone_number","tel"],
  address:         ["street.address","streetaddress","street_address","address1","addr1","^address$","home.address","mailing.address"],
  city:            ["^city$","town","municipality","city.name"],
  state:           ["^state$","province","region","state.province"],
  zip:             ["zip","postal","zipcode","zip.code","postcode","postalcode","zip_code"],
  country:         ["^country$","nation","country.name","country_code"],
  linkedin:        ["linkedin","linked.in","linkedin.url","linkedin_url","linkedin.profile"],
  github:          ["github","git.hub","github.url","github_url","github.profile"],
  portfolio:       ["portfolio","personal.website","personalwebsite","web.site","website","portfolio.url","portfolio_url"],
  jobTitle:        ["job.title","jobtitle","job_title","current.title","currenttitle","^title$","position","current.position","currentposition","role"],
  expYears:        ["years.of.experience","yearsofexperience","years_of_experience","years.experience","yearsexperience","experience.years","^experience$","^years$","exp.years","expyears","totalyears","total.years"],
  expMonths:       ["experience.months","experiencemonths","exp.months","expmonths","months.of.experience","monthsofexperience","remaining.months","remainingmonths","^months$"],
  resumeUrl:       ["resume","cv","resume.url","cv.url","resume_url","cv_url","resume.link","cv.link"],
};

// ── Native value setter trick for React / controlled inputs ──────────────────
const nativeInputValueSetter    = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,    "value")?.set;
const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
const nativeSelectValueSetter   = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,   "value")?.set;

function setNativeValue(el, value) {
  if (el.tagName === "TEXTAREA" && nativeTextareaValueSetter) {
    nativeTextareaValueSetter.call(el, value);
  } else if (el.tagName === "SELECT" && nativeSelectValueSetter) {
    nativeSelectValueSetter.call(el, value);
  } else if (nativeInputValueSetter) {
    nativeInputValueSetter.call(el, value);
  } else {
    el.value = value;
  }
}

function dispatchEvents(el) {
  ["input", "change", "blur"].forEach((type) => {
    el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
  });
}

// ── Detect whether a number input only accepts integers ──────────────────────
function isIntegerOnlyInput(el) {
  const step = el.getAttribute("step");
  if (!step || step === "1") return true;          // default step=1 → integers only
  if (step === "any") return false;                // explicit "any" → decimals OK
  return Number(step) >= 1 && Number(step) % 1 === 0; // e.g. step="2" → integers
}

// ── Build the right experience value for a given input ───────────────────────
function expValue(el, expYears, expMonths) {
  const y = parseInt(expYears)  || 0;
  const m = parseInt(expMonths) || 0;
  if (isIntegerOnlyInput(el)) return String(y);
  return m > 0 ? `${y}.${m}` : String(y);  // "2.7" for 2 years 7 months
}

// ── Normalise a string into a flat token for matching ────────────────────────
function normalise(str) {
  return (str || "")
    .toLowerCase()
    .replace(/[\s\-_./]/g, "")   // collapse separators
    .trim();
}

// ── Build a "fingerprint" string from all relevant attributes of an element ──
function buildFingerprint(el) {
  const attrs = ["name", "id", "placeholder", "aria-label", "autocomplete", "data-field", "data-name", "data-id", "title", "class"];
  const parts = attrs.map((a) => el.getAttribute(a) || "");

  // Also grab nearby <label> text
  const labelText = getLabelText(el);
  if (labelText) parts.push(labelText);

  return parts.join(" ").toLowerCase();
}

// ── Find the label text associated with an input ────────────────────────────
function getLabelText(el) {
  // 1. aria-labelledby
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const texts = labelledBy.split(" ")
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean);
    if (texts.length) return texts.join(" ");
  }
  // 2. <label for="id">
  if (el.id) {
    const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label) return label.textContent.trim();
  }
  // 3. Wrapping <label>
  const wrappingLabel = el.closest("label");
  if (wrappingLabel) return wrappingLabel.textContent.trim();
  // 4. Previous sibling / parent text
  const parent = el.parentElement;
  if (parent) {
    const prev = el.previousElementSibling;
    if (prev && ["LABEL","SPAN","DIV","P"].includes(prev.tagName)) {
      return prev.textContent.trim();
    }
    // Check parent for short text nodes
    const parentText = Array.from(parent.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent.trim())
      .filter((t) => t.length > 0 && t.length < 60)
      .join(" ");
    if (parentText) return parentText;
  }
  return "";
}

// ── Check if a fingerprint matches any pattern for a given data key ──────────
function matchesKey(fingerprint, dataKey) {
  const patterns = FIELD_MAPPINGS[dataKey];
  if (!patterns) return false;
  const flat = normalise(fingerprint);
  return patterns.some((pattern) => {
    // Handle anchored patterns like "^name$"
    if (pattern.startsWith("^") || pattern.endsWith("$")) {
      const regex = new RegExp(pattern);
      return regex.test(flat);
    }
    return flat.includes(normalise(pattern));
  });
}

// ── Try to fill a <select> element (country/state dropdowns) ─────────────────
function fillSelect(el, value) {
  if (!value) return false;
  const lv = value.toLowerCase().trim();
  const options = Array.from(el.options);

  // Exact value match
  let opt = options.find((o) => o.value.toLowerCase() === lv);
  // Exact text match
  if (!opt) opt = options.find((o) => o.text.toLowerCase() === lv);
  // Starts-with text
  if (!opt) opt = options.find((o) => o.text.toLowerCase().startsWith(lv));
  // Includes text
  if (!opt) opt = options.find((o) => o.text.toLowerCase().includes(lv));

  if (opt) {
    setNativeValue(el, opt.value);
    dispatchEvents(el);
    return true;
  }
  return false;
}

// ── Fill a single input / textarea ───────────────────────────────────────────
function fillInput(el, value) {
  if (!value) return false;
  if (el.readOnly || el.disabled) return false;
  // Don't overwrite non-empty fields that look already filled
  // (some sites pre-fill data; be respectful but overwrite on explicit fill)
  setNativeValue(el, value);
  dispatchEvents(el);
  return true;
}

// ── Convert base64 data URL → File object ────────────────────────────────────
function base64ToFile(dataUrl, filename) {
  const [meta, b64] = dataUrl.split(",");
  const mime = meta.match(/:(.*?);/)[1];
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

// ── Inject a PDF File into a file input via DataTransfer ─────────────────────
function fillFileInput(el, file) {
  try {
    const dt = new DataTransfer();
    dt.items.add(file);
    el.files = dt.files;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("input",  { bubbles: true }));
    return true;
  } catch { return false; }
}

// ── Check if a file input is likely a resume/CV upload ───────────────────────
function isResumeFileInput(el) {
  if (el.tagName !== "INPUT" || (el.getAttribute("type") || "").toLowerCase() !== "file") return false;
  const accept = (el.getAttribute("accept") || "").toLowerCase();
  // If it explicitly rejects PDFs, skip
  if (accept && !accept.includes("pdf") && !accept.includes("*") && accept !== "") return false;
  const fp = buildFingerprint(el).toLowerCase();
  return fp.includes("resume") || fp.includes("cv") || fp.includes("curriculum") || fp.includes("upload");
}

// ── Main fill routine ─────────────────────────────────────────────────────────
function fillFields(userData) {
  let filled = 0;
  const inputTypes = ["text", "email", "tel", "url", "number", "search", ""];

  // Collect all fillable elements (including inside shadow roots)
  const elements = collectElements(document);

  elements.forEach((el) => {
    if (el.closest("[aria-hidden='true']")) return;  // skip hidden regions

    const tag  = el.tagName;
    const type = (el.getAttribute("type") || "").toLowerCase();

    const isText   = tag === "INPUT"    && (inputTypes.includes(type));
    const isArea   = tag === "TEXTAREA";
    const isSelect = tag === "SELECT";

    if (!isText && !isArea && !isSelect) return;

    const fp = buildFingerprint(el);

    // Determine which data key matches
    for (const dataKey of Object.keys(FIELD_MAPPINGS)) {
      if (matchesKey(fp, dataKey)) {
        let value;
        if (dataKey === "expYears") {
          // Smart: integer-only inputs get "2", decimal-capable inputs get "2.7"
          if (!userData.expYears) continue;
          value = expValue(el, userData.expYears, userData.expMonths);
        } else {
          if (!userData[dataKey]) continue;
          value = userData[dataKey];
        }

        let ok = false;
        if (isSelect) {
          ok = fillSelect(el, value);
        } else {
          ok = fillInput(el, value);
        }
        if (ok) { filled++; break; }
      }
    }
  });

  // ── PDF resume file inputs ──────────────────────────────────────────────────
  if (userData.resumePdf && userData.resumePdfName) {
    const pdfFile = base64ToFile(userData.resumePdf, userData.resumePdfName);
    elements.forEach((el) => {
      if (isResumeFileInput(el) && fillFileInput(el, pdfFile)) filled++;
    });
  }

  return filled;
}

// ── Collect elements, including shadow DOM ────────────────────────────────────
function collectElements(root) {
  const results = [];
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT,
    null
  );
  let node = walker.currentNode;
  while (node) {
    // Descend into shadow roots
    if (node.shadowRoot) {
      results.push(...collectElements(node.shadowRoot));
    }
    if (["INPUT", "TEXTAREA", "SELECT"].includes(node.tagName)) {
      results.push(node);
    }
    node = walker.nextNode();
  }
  return results;
}

// ── Floating notification ─────────────────────────────────────────────────────
function showNotification(message) {
  // Remove any existing notification
  const existing = document.getElementById("__jobfill_notify__");
  if (existing) existing.remove();

  const div = document.createElement("div");
  div.id = "__jobfill_notify__";
  div.textContent = message;
  Object.assign(div.style, {
    position:     "fixed",
    bottom:       "24px",
    right:        "24px",
    zIndex:       "2147483647",
    background:   "#1a56db",
    color:        "#fff",
    padding:      "12px 20px",
    borderRadius: "10px",
    fontSize:     "14px",
    fontFamily:   "system-ui, -apple-system, sans-serif",
    fontWeight:   "600",
    boxShadow:    "0 4px 24px rgba(0,0,0,0.22)",
    opacity:      "1",
    transition:   "opacity 0.5s ease",
    pointerEvents:"none",
  });
  document.documentElement.appendChild(div);

  // Fade out after 2.5 s, remove after 3 s
  setTimeout(() => { div.style.opacity = "0"; }, 2500);
  setTimeout(() => { div.remove(); }, 3000);
}

// ── Message listener ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action !== "fill") return false;

  chrome.storage.local.get(null, (userData) => {
    const count = fillFields(userData);
    const label = count === 1 ? "field" : "fields";
    showNotification(
      count > 0
        ? `JobFill: Filled ${count} ${label}`
        : "JobFill: No matching fields found"
    );
    sendResponse({ filled: count });
  });

  return true; // keep channel open for async sendResponse
});
