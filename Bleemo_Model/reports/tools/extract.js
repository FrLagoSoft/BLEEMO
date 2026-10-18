function extractFields() {
  const skipTypes = ["hidden", "submit", "button"];
  const seen = new Set();

  const templates = {};
  document.querySelectorAll('input[name$="[baseTemplate]"]').forEach((input) => {
    const prefix = input.name.replace("[baseTemplate]", "");
    try {
      templates[prefix] = JSON.parse(input.value);
    } catch {
    }
  });

  function templateField(el) {
    const match = el.name.match(/\[field(\d+)\]/);
    if (!match) return null;
    const prefix = el.name.split("]")[0] + "]";
    return templates[prefix]?.fields?.[Number(match[1])] ?? null;
  }

  return Array.from(document.querySelectorAll("input, select, textarea"))
    .filter((el) => !skipTypes.includes(el.type))
    .filter((el) => {
      if (el.type !== "radio" && el.type !== "checkbox") return true;
      if (seen.has(el.name)) return false;
      seen.add(el.name);
      return true;
    })
    .map((el, i) => {
      const field = templateField(el);
      const rawLabel = el.labels?.[0]?.innerText ?? "";

      return {
        order: i,
        tag: el.tagName,
        type: el.type,
        name: el.name,
        id: el.id,
        label: (field?.text ?? rawLabel).split("\n")[0].trim(),
        required: field?.required ?? (el.required || rawLabel.includes("✱") || rawLabel.includes("*")),
        autocomplete: el.autocomplete,
        placeholder: el.placeholder,
        section: el.closest(".section")?.querySelector("h1, h2, h3, h4, h5, h6")?.innerText ?? "",
      };
    });
}

console.table(extractFields());