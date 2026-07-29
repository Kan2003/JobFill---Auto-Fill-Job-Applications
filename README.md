# JobFill — Auto Fill Job Applications

A Chrome extension that fills job application forms for you. Enter your details once, click **Fill Page** on any application, and JobFill fills in your name, contact info, experience, education, links — and even attaches your resume PDF.

**100% local. No account. No server. Your data never leaves your browser.**

---

## Table of Contents

- [Why JobFill?](#why-jobfill)
- [What It Does](#what-it-does)
- [Installation](#installation)
- [How to Use](#how-to-use)
- [How It Works (Under the Hood)](#how-it-works-under-the-hood)
- [Security & Privacy](#security--privacy)
- [Permissions Explained](#permissions-explained)
- [Project Structure](#project-structure)
- [Supported Fields](#supported-fields)
- [Limitations & Known Behavior](#limitations--known-behavior)
- [FAQ](#faq)

---

## Why JobFill?

Job hunting means filling out the **same information dozens of times** — every company's career portal (Workday, Greenhouse, Lever, custom sites) asks for your name, email, phone, experience, education, LinkedIn, and resume, but each in a slightly different form layout.

Browser autofill only handles basic contact fields, and it doesn't understand job-application-specific fields like *notice period*, *expected salary*, *years of experience*, *GPA*, or resume uploads.

JobFill exists to solve exactly that: **save your profile once, fill any application in one click**, and spend your time on the parts that actually matter (cover letters, tailored answers) instead of retyping your address for the 40th time.

---

## What It Does

- **Stores your job-application profile** across 4 organized sections:
  - **Personal** — name, email, phone, full address
  - **Professional** — job title, company, experience, skills, notice period, expected salary, relocation preference, start date, resume link
  - **Education** — university, degree, major, graduation date, GPA, location
  - **Social** — LinkedIn, GitHub, portfolio
- **Fills any web form in one click** — smart pattern matching detects which fields on the page correspond to your saved data, even when sites name them differently (`first_name`, `fname`, `given-name`, etc.).
- **Attaches your resume PDF automatically** — upload your resume once (up to ~4 MB); JobFill detects resume/CV file-upload fields and attaches it for you.
- **Works with modern web apps** — handles React/Angular/Vue controlled inputs, dropdowns, date fields, and even form fields inside Shadow DOM (used by Workday and other enterprise portals).
- **Shows instant feedback** — a notification on the page tells you exactly how many fields were filled.

---

## Installation

JobFill is loaded as an unpacked extension (it's not on the Chrome Web Store):

1. Download or clone this repository to a folder on your computer.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the project folder (the one containing `manifest.json`).
5. Pin JobFill: click the puzzle-piece icon in the toolbar → pin **JobFill**.

Also works on other Chromium browsers (Edge, Brave, Opera) via their equivalent extensions page.

---

## How to Use

### 1. Set up your profile (one time)

1. Click the **JobFill icon** in the toolbar to open the popup.
2. Fill in the **Personal** step, then click **Save & Continue →**.
3. Repeat for **Professional**, **Education**, and **Social** steps.
   - You can jump between steps anytime by clicking the numbered dots.
4. In the Professional step, optionally upload your **resume PDF** (click the upload box, pick a PDF, max ~4 MB).
5. On the last step, click **Save Details ✓**.

Everything saves to your browser instantly — you can close the popup at any point after saving a step.

### 2. Fill an application

1. Open any job application page.
2. Click the JobFill icon → click **▶ Fill Page**.
3. JobFill scans the form, fills every field it recognizes, attaches your resume to any resume-upload input, and shows a notification like *"JobFill: Filled 12 fields"*.
4. **Always review before submitting** — verify the filled values, and complete any fields JobFill didn't recognize (custom questions, cover letters, etc.).

### 3. Update your details

Open the popup anytime, edit any field, and hit save. New values are used on the next fill.

---

## How It Works (Under the Hood)

JobFill has three parts, standard Chrome Manifest V3 architecture:

```
┌─────────────┐   saves to    ┌──────────────────────┐
│  popup.html  │ ────────────▶ │ chrome.storage.local │
│  popup.js    │               │   (your browser)     │
└──────┬───────┘               └──────────┬───────────┘
       │ "fill" message                   │ reads
       ▼                                  ▼
┌──────────────────────────────────────────────────┐
│ content.js  (runs inside the job application tab)│
│  • scans all inputs / selects / textareas         │
│  • matches each against known field patterns      │
│  • fills values + attaches resume PDF             │
└──────────────────────────────────────────────────┘
```

| File | Role |
|------|------|
| `popup.html` / `popup.js` | The UI where you enter and save your profile (4-step wizard) and trigger fills |
| `content.js` | The fill engine, injected into the page when you click Fill Page |
| `background.js` | Minimal service worker — just initializes empty storage on first install |

### The fill engine, step by step

1. **Collect fields** — walks the entire page DOM (including **Shadow DOM** roots, which enterprise portals like Workday use) and gathers every `<input>`, `<select>`, and `<textarea>`.
2. **Fingerprint each field** — combines the element's `name`, `id`, `placeholder`, `aria-label`, `autocomplete`, `data-*` attributes, CSS classes, **and its visible label text** (found via `<label for>`, `aria-labelledby`, wrapping labels, or nearby text) into one searchable string.
3. **Pattern match** — compares that fingerprint against 25+ field types, each with many known naming variations. For example, a phone field matches any of: `phone`, `telephone`, `mobile`, `cell`, `contact.number`, `phone_number`, `tel`… Separators (`-`, `_`, `.`, spaces) are normalized away, so `First-Name`, `first_name`, and `firstName` all match.
4. **Fill natively** — sets values using the browser's **native value setters** and dispatches real `input`/`change`/`blur` events. This is what makes fills stick on React, Angular, and Vue forms, which ignore plain `element.value = x` assignments.
5. **Smart handling of special fields:**
   - **Dropdowns** — matches your saved value against option values and labels (exact → starts-with → contains), so "United States" selects the right option even if the option value is "US".
   - **Experience** — integer-only number inputs get `2`; decimal-capable ones get `2.7` (2 years 7 months).
   - **Resume PDF** — your stored PDF (saved as base64) is reconstructed into a real `File` object and injected into resume/CV file inputs via the `DataTransfer` API, exactly as if you'd picked it manually. Inputs whose `accept` attribute rejects PDFs are skipped.
   - **Hidden fields** — regions marked `aria-hidden="true"` are skipped; read-only and disabled fields are never touched.

---

## Security & Privacy

This is the most important section. Here's the complete data story:

### Where your data lives

All data — every form field and your resume PDF — is stored in **`chrome.storage.local`**, Chrome's built-in extension storage **on your own computer**. It is sandboxed per-extension: websites cannot read it, and other extensions cannot read it.

### What JobFill never does

- ❌ **No network requests.** There is no server, no API, no analytics, no telemetry — the code contains zero `fetch`/`XMLHttpRequest` calls. You can verify this yourself: the entire codebase is 3 small readable JavaScript files.
- ❌ **No account or sign-up.** Nothing identifies you to anyone.
- ❌ **No cloud sync.** Data never leaves the machine (it deliberately uses `storage.local`, not `storage.sync`, so nothing is uploaded even to your Google account).
- ❌ **No background snooping.** The content script does nothing until you explicitly click **Fill Page**. It never reads what's on pages, never logs keystrokes, never auto-submits forms.
- ❌ **No third-party code.** Zero external libraries, zero CDN scripts, zero remote code — everything that runs is in this repository.

### What "filling a page" means for your data

When you click Fill Page, your saved values are written into the form fields of that page — the same as if you typed them. From that moment, the **website you're applying to** has those values (that's the whole point). JobFill itself sends nothing anywhere.

### Your controls

- **Review everything** in the popup at any time — what you see is exactly what's stored.
- **Remove the resume** with the ✕ button on the upload card.
- **Wipe all data instantly** by removing the extension (`chrome://extensions` → Remove) — Chrome deletes the extension's storage with it.

---

## Permissions Explained

Every permission in `manifest.json`, and why it's needed:

| Permission | Why JobFill needs it |
|------------|---------------------|
| `storage` | Save your profile locally in `chrome.storage.local` |
| `unlimitedStorage` | Resume PDFs are stored as base64 and can exceed the default 5 MB storage quota |
| `activeTab` | Know which tab you're on when you click Fill Page |
| `scripting` | Inject the fill engine (`content.js`) into the page on demand |
| `<all_urls>` (host permission + content script) | Job applications live on thousands of different domains — company career pages, Workday, Greenhouse, Lever, etc. — so the fill engine must be able to run anywhere. It still only *acts* when you click Fill Page |

---

## Project Structure

```
AutoFill_Extension/
├── manifest.json      # Extension config (Manifest V3)
├── popup.html         # Popup UI — 4-step wizard, glass dark design
├── popup.js           # Popup logic: save/load profile, PDF upload, trigger fill
├── content.js         # Fill engine: field detection + filling + resume injection
├── background.js      # Service worker: initializes storage on install
├── icons/             # Extension icons (16 / 48 / 128 px)
└── test.html          # Local test form for trying out the fill engine
```

**Tip:** open `test.html` in a tab and click Fill Page to safely test your setup before using it on real applications.

---

## Supported Fields

| Section | Fields |
|---------|--------|
| **Personal** | Full name, first name, last name, email, phone, street address, city, state, ZIP, country |
| **Professional** | Job title, current company, experience (years + months), skills, notice period, desired salary, willing to relocate, available start date, resume link |
| **Education** | School/university, degree, field of study/major, graduation date, GPA/CGPA, location |
| **Social** | LinkedIn URL, GitHub URL, portfolio/website |
| **Files** | Resume PDF (auto-attached to resume/CV upload inputs) |

Each field is recognized under many naming variations — e.g. *desired salary* also matches `expected salary`, `salary expectation`, `expected CTC`, `compensation`, and more.

---

## Limitations & Known Behavior

- **Multi-page / multi-step applications** — JobFill fills the fields visible on the current page. On wizards (like Workday), click Fill Page again on each step.
- **Unusual custom widgets** — some heavily customized dropdowns or typeahead components (built from `<div>`s instead of real `<select>`s) may not be fillable; fill those manually.
- **Custom questions** — "Why do you want to work here?" and similar free-text questions are yours to answer. JobFill only fills factual profile fields.
- **Overwrites existing values** — clicking Fill Page writes your saved values into matching fields, including ones that already have content. Review after filling.
- **PDF size** — resumes larger than roughly 4 MB may fail to store; compress the PDF if you see a storage error.
- **iframes** — forms embedded in cross-origin iframes may not be reachable by a single injection; most major portals work, but a few embedded widgets may not.

---

## FAQ

**Is my data safe?**
Yes — it's stored only in your browser's local extension storage, sandboxed from websites and other extensions. Nothing is transmitted anywhere. See [Security & Privacy](#security--privacy).

**Does it work on Workday / Greenhouse / Lever?**
It's built for them — label-based matching, Shadow DOM support, and native-event dispatching target exactly the tech those portals use. Coverage varies per company's customization; anything missed can be filled manually.

**Why isn't it on the Chrome Web Store?**
It's a personal-use developer tool for now, loaded unpacked. That also means you're running exactly the code you can read in this repo — nothing more.

**Can I use it for forms other than job applications?**
Yes — any form with recognizable fields (contact forms, registrations) will fill with matching data. It just won't recognize domain-specific fields outside its mapping list.

**How do I delete everything?**
Remove the extension from `chrome://extensions`. Chrome deletes all of its stored data along with it.

**Does it auto-submit applications?**
Never. JobFill only fills fields. Reviewing and clicking Submit is always your decision.

---

*Built to make job hunting a little less repetitive. Good luck out there!* 🚀
