function extractFields() {
  const skipTypes = ["hidden", "submit", "button"]; //Skip  these
  const seen = new Set(); //Seen these? good. 

  const templates = {}; //Template storage for prefixes. 
  document.querySelectorAll('input[name$="[baseTemplate]"]').forEach((input) => {
    const prefix = input.name.replace("[baseTemplate]", "");
    try {
      templates[prefix] = JSON.parse(input.value);
    } catch {
    }
  }); //This is to parse the JSON data from the input fields and store it in the templates object.

  function templateField(el) { //input name = field name, to correspond with it p much 
    const match = el.name.match(/\[field(\d+)\]/);
    if (!match) return null;
    const prefix = el.name.split("]")[0] + "]";
    return templates[prefix]?.fields?.[Number(match[1])] ?? null;
  }

  return Array.from(document.querySelectorAll("input, select, textarea")) // This is to select everything in F12 
    .filter((el) => !skipTypes.includes(el.type)) //This is to skip hidden, submit, and button types
    .filter((el) => { 
      if (el.type !== "radio" && el.type !== "checkbox") return true;
      if (seen.has(el.name)) return false; 
      seen.add(el.name);
      return true; //This basically skips duplicate radio and checkbox inputs
    })
    .map((elem, order) => {
      const field = templateField(elem);
      const rawLabel = elem.labels?.[0]?.innerText ?? "";

      return {
        order: order,
        tag: elem.tagName,
        type: elem.type,
        name: elem.name,
        id: elem.id,
        label: (field?.text ?? rawLabel).split("\n")[0].trim(),
        required: field?.required ?? (elem.required || rawLabel.includes("✱") || rawLabel.includes("*")),
        autocomplete: elem.autocomplete,
        placeholder: elem.placeholder,
        section: elem.closest(".section")?.querySelector("h1, h2, h3, h4, h5, h6")?.innerText ?? "", //A whole lot of data fields to receive, receiving at their core titles. 
      };
    });
}

console.table(extractFields());

//Below is the API payload that Im making. Give me a sec, it's gonna be for reference
const api_Payload = { 
    url: location.href, 
    site: location.hostname, 
    title: document.title,
    collectedAt: new Date().toISOString(),
    fields: extractFields()
}

//This is gonna be the function to send the data from the payload itself through JSON convert. 
async function SendingtheFields() {
const responseofAPI = await fetch("http://localhost:5000/collect", { //where to send to 
    method: "POST", // what to send it with (post, get... whatever)
    headers: {"Content-Type": "application/json"}, //what type of data (JSON)
    body: JSON.stringify(api_Payload) //Actually converting the data from JS to JSON
})
}
