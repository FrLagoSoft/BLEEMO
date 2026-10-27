(() => {
const EXTRACTOR_VERSION = "1.0.1"; // Bump this with EVERY change to the extractor

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)); // Pause an async function for ms milliseconds

const addTexts = ["Add", "Add Another", "Agregar"];

function isAddButton(b) {
  return (
    b.dataset.automationId === "add-button" || // Workday: most reliable, language-proof
    b.id.endsWith("topBar") || // SuccessFactors: section toggles
    addTexts.includes(b.innerText.trim()) // Other sites: exact text match only, never partial
  );
}

async function expandSections() {
  const addButtons = Array.from(document.querySelectorAll("button")).filter(
    (b) =>
      isAddButton(b) &&
      b.checkVisibility() &&
      b.getAttribute("aria-expanded") !== "true"
  );

  for (const button of addButtons) {
    button.click();
    await sleep(500); // Give the page time to build the new fields
  }
}


function extractFields() {
  const skipTypes = ["hidden", "submit", "button", "password", "search"];
  const credentialAutocomplete = ["username", "current-password", "new-password"];
  const captchaNames = ["h-captcha-response", "g-recaptcha-response"]; // Skip all of these
  const seen = new Set(); // Seen these? Good.

  // Template storage, keyed by prefix. Some sites (Lever) keep each group of questions
  // as JSON inside a hidden input; the prefix is the shared start of the name that links
  // every question in the group to its template.
  const templates = {};
  document.querySelectorAll('input[name$="[baseTemplate]"]').forEach((input) => {
    const prefix = input.name.replace("[baseTemplate]", "");
    try {
      templates[prefix] = JSON.parse(input.value);
    } catch {
      // Not valid JSON: skip this one
    }
  }); // This is to parse the JSON data from the input fields and store it in the templates object.

  // Every heading on the page, in page order. Simple HTML element sorting.
  const headings = Array.from(
    document.querySelectorAll("h1, h2, h3, h4, h5, h6, [role='heading']")
  );

  // Remove counters like (1) and required stars, then take the first line with real text.
  function clean(text) {
    return (
      text
        .replace(/\(\d+\)|[*✱]/g, "")
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line !== "") ?? ""
    );
  }
  
  // Text of the elements an attribute points to by id (aria-labelledby can list several).
  function textOfIds(el, attr) {
  return (el.getAttribute(attr) ?? "")
    .split(/\s+/)
    .filter((id) => id && id !== el.id)
    .map((id) => document.getElementById(id))
    .filter((target) => target && !el.contains(target)) // never read text from inside the field itself
    .map((target) => target.innerText)
    .join(" ")
    .trim();
  }


  // Find the last heading that comes before the field in the page.
  function nearestHeading(el) {
    let found = "";
    for (const h of headings) {
      if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) {
        found = clean(h.innerText);
      } else {
        break;
      }
    }
    return found;
  }

  function templateField(el) { // Input name = field name, to correspond with it pretty much
    const match = el.name.match(/\[field(\d+)\]/);
    if (!match) return null;
    const prefix = el.name.split("]")[0] + "]";
    return templates[prefix]?.fields?.[Number(match[1])] ?? null;
  }

  // A custom dropdown only counts as a field if something labels it:
  // a <label>, aria-labelledby, or the legend of its fieldset.
  function isListboxButton(el) {
    return (
      el.matches("[aria-haspopup='listbox']") &&
      (el.labels?.length > 0 ||
        el.hasAttribute("aria-labelledby") ||
        el.closest("fieldset") !== null)
    );
  }

  // Every reason to skip a field, one per line. Visibility is NOT here: it's recorded instead.
  function isJunk(el) {
    if (skipTypes.includes(el.type) && !isListboxButton(el)) return true; // Hidden, submit, button and password types
    if (credentialAutocomplete.includes(el.autocomplete)) return true; // Login and password fields
    if (captchaNames.includes(el.name)) return true; // Captcha plumbing
    if (el.placeholder?.includes("Type to Search")) return true; // iCIMS search boxes
    return false;
  }

  return Array.from(document.querySelectorAll("input, select, textarea, button[aria-haspopup='listbox']")) // This is to select every form field on the page
    .filter((el) => !isJunk(el))
    .filter((el) => {
      if (el.type !== "radio" && el.type !== "checkbox") return true;
      if (seen.has(el.name)) return false;
      seen.add(el.name);
      return true; // This basically skips duplicate radio and checkbox inputs
    })
    .map((el, order) => {
      const field = templateField(el);
      const rawLabel = el.labels?.[0]?.innerText ?? "";
      const legendText = el.closest("fieldset")?.querySelector("legend")?.innerText ?? "";
      const questionTitle = el.closest(".ashby-application-form-field-entry") ?.querySelector(".ashby-application-form-question-title")?.innerText ?? "";
      const ariaText = textOfIds(el, "aria-labelledby") || (el.getAttribute("aria-label") ?? "");
      const isRadioInGroup = el.type === "radio" && legendText !== "";
      const ownLabel = isRadioInGroup ? "" : rawLabel || ariaText; // a radio's own label is just its option
      const labelSource = field?.text ?? (ownLabel || legendText || questionTitle);
      
      return {
        order: order,
        tag: el.tagName,
        type: el.type,
        name: el.name,
        id: el.id,
        label: clean(labelSource),
        required: field?.required ?? (el.required || el.getAttribute("aria-required") === "true" || rawLabel.includes("*") || rawLabel.includes("✱") || labelSource.includes("*") || labelSource.includes("✱")),
        autocomplete: el.autocomplete ?? "",
        placeholder: el.placeholder ?? "",
        automationId: el.closest("[data-automation-id^='formField-']")?.dataset.automationId ?? "",
        section: nearestHeading(el), // A whole lot of data fields to receive, receiving at their core titles.
        group: clean(legendText),
        visible: el.checkVisibility(), // Recorded, not filtered: autofill never fills invisible fields (honeypots)
        fieldPath: el.closest("[data-field-path]")?.dataset.fieldPath ?? "",
      };
    });
}

async function sendFields() {
  await expandSections(); // Open every section first, so its fields exist on the page

  const fields = extractFields();
  console.log(`[collector] ${location.href}: ${fields.length} fields`);
  if (fields.length === 0) {
    const frameCount = document.querySelectorAll("iframe").length;
    console.warn(
      `No fields found, so nothing was sent. This page has ${frameCount} iframe(s): ` +
      `if the form is inside one, switch the console context from "top" and run again.`
    );
    return;
  }
  if (fields.length != 0) { 
    console.warn( "Seems like the data fields went through. I think... We should be good!")
  }

  const apiPayload = {
    url: location.origin + location.pathname, // No query string, so no session tokens. Only for privacy when logged in.
    site: location.hostname,
    title: document.title,
    extractorVersion: EXTRACTOR_VERSION,
    collectedAt: new Date().toISOString(),
    fields, // Same fields the guard just checked
  };

  const result = await chrome.runtime.sendMessage(apiPayload);
  if (result?.error) {
    console.error("[collector] Could not reach the collector server:", result.error);
    return;
  }
  console.log(`[collector] Saved ${result.fields} fields to ${result.saved}`);
}

sendFields(); // Running the snippet expands, extracts and sends in one go
})();