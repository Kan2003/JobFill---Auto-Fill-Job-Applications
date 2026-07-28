"use strict";

// ── Service Worker: background.js ────────────────────────────────────────────
// Initialises default (empty) storage when the extension is first installed.

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    const defaults = {
      fullName:        "",
      firstName:       "",
      lastName:        "",
      email:           "",
      phone:           "",
      address:         "",
      city:            "",
      state:           "",
      zip:             "",
      country:         "",
      jobTitle:        "",
      yearsExperience: "",
      resumeUrl:       "",
      linkedin:        "",
      github:          "",
      portfolio:       "",
    };
    chrome.storage.local.set(defaults, () => {
      console.log("[JobFill] Extension installed. Default storage initialised.");
    });
  }
});

// Keep service worker alive only while a message is being processed.
chrome.runtime.onMessage.addListener((_msg, _sender, _sendResponse) => {
  // Nothing to handle here — content script and popup communicate directly.
});
