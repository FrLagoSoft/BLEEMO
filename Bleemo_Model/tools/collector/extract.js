function extractFields() {
  const skipTypes = ["hidden", "submit", "button", "password"];
  const credentialAutocomplete = ["username", "current-password", "new-password"];
  const captchaNames = ["h-captcha-response", "g-recaptcha-response"]; // Skip all of these
  const seen = new Set(); // Seen these? Good.

  const templates = {};
  document.querySelectorAll('input[name$="[baseTemplate]"]').forEach((input) => {
    const prefix = input.name.replace("[baseTemplate]", "");
    try {
      templates[prefix] = JSON.parse(input.value);
    } catch {
      // Not valid JSON: skip this one
    }
  }); // This is to parse the JSON data from the input fields and store it in the templates object.

  // Every heading on the page, in page order. simple htlml element sorting 
  const headings = Array.from(
    document.querySelectorAll("h1, h2, h3, h4, h5, h6, [role='heading']")
  );

  function nearestHeading(el) { //Hey, get the nearest element to the heading in an array location and return it `
    let found = "";
    for (const h of headings) {
      if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) {
        found = h.innerText.split("\n")[0].replace(/\(\d+\)|[*✱]/g, "").trim();
      } else {
        break;
      }
    }
    return found;
  }

  function clean(text) {
  return text.split("\n")[0].replace(/\(\d+\)|[*✱]/g, "").trim();
}

  function templateField(el) { // Input name = field name, to correspond with it pretty much
    const match = el.name.match(/\[field(\d+)\]/);
    if (!match) return null;
    const prefix = el.name.split("]")[0] + "]";
    return templates[prefix]?.fields?.[Number(match[1])] ?? null;
  }

  return Array.from(document.querySelectorAll("input, select, textarea, button[aria-haspopup='listbox']")) // This is to select every form field on the page
    .filter((el) =>
      (!skipTypes.includes(el.type) || (el.matches("[aria-haspopup='listbox']") && el.labels?.length > 0)) && // This is to skip hidden, submit, button, and password types
      !credentialAutocomplete.includes(el.autocomplete) && // This is to skip fields whose autocomplete marks them as credentials
      !captchaNames.includes(el.name) && // This is to skip h-captcha-response and g-recaptcha-response fields
      (el.tagName === "SELECT" || el.checkVisibility()) && //Honeypot for bots. 
      !el.placeholder?.includes("Type to Search") // iCIMS search boxes
    )
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
      const optionLabel = el.type === "radio" && legendText ? "" : rawLabel;

      return {
        order: order,
        tag: el.tagName,
        type: el.type,
        name: el.name,
        id: el.id,
        label: clean(field?.text ?? optionLabel) || clean(legendText),
        required:
          field?.required ??
          (el.required ||
            el.getAttribute("aria-required") === "true" ||
            rawLabel.includes("✱") ||
            rawLabel.includes("*")),
        autocomplete: el.autocomplete ?? "",
        placeholder: el.placeholder ?? "",
        automationId: el.closest("[data-automation-id^='formField-']")?.dataset.automationId ?? "",
        section: nearestHeading(el), // A whole lot of data fields to receive, receiving at their core titles.
        group: clean(legendText),
      };
    });
}


async function sendFields() {
const fields = extractFields();

  if (fields.length === 0) {
  const frameCount = document.querySelectorAll("iframe").length;
  console.warn(
    `No fields found, so nothing was sent. This page has ${frameCount} iframe(s): ` +
    `if the form is inside one, switch the console context from "top" and run again.`);
  return;
}

  const apiPayload = {
    url: location.origin + location.pathname, // No query string, so no session tokens. Only for privacy when logged in. 
    site: location.hostname,
    title: document.title,
    extractorVersion: "0.7.2",
    collectedAt: new Date().toISOString(),
    fields: extractFields(),
  };

  const response = await fetch("http://localhost:5000/collect", { // Where to send to
    method: "POST", // What to send it with (POST, GET... whatever)
    headers: { "Content-Type": "application/json" }, // What type of data (JSON)
    body: JSON.stringify(apiPayload), // Actually converting the data from JS to JSON
  });

  const result = await response.json();
  if (!response.ok) {
    console.error("Collector rejected the page:", result);
    return;
  }
  console.log(`Saved ${result.fields} fields to ${result.saved}`);
}

sendFields(); // Running the snippet extracts and sends in one go


