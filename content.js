// Debug line
console.log("Workday Helper Extension loaded!");

// Global Variables
const SELECTOR = 'div.gwt-Label[data-automation-id="promptOption"][aria-label*=","]';
let hideTimer = null;
const TIME_OUT_TIME = 200;
let currentPopupAnchor = null;

// Helper function to check if an element is a valid professor
function isValidProfessor(el) {
  const name = el.getAttribute("aria-label") || el.innerText || el.textContent;
  
  // Skip empty or malformed text
  if (!name) return false;

  // Skip if it starts with a course code like "CSE 131"
  if (/^[A-Z]{2,5} \d{3,4}/.test(name)) return false;

  // Skip if contains digits
  if (/\d/.test(name)) return false;

  // Keep if it includes a comma (e.g., "LastName, FirstName")
  return name.includes(',');
}

// Helper functions to approximate name
function normalizeName(name) {
  return name.toLowerCase().replace(/\./g, '').trim();
}

// When mouse enters *any* descendant of body, capture it if it matches SELECTOR
document.body.addEventListener("mouseenter", e => {
  console.log("chechking for professor name"); // DEBUGGING LINE; DELETE BEFORE PUBLISH
  const el = e.target;
  if (el.matches(SELECTOR) && isValidProfessor(el)) {
    console.log("hovered over professor name"); // DEBUGGING LINE; DELETE BEFORE PUBLISH
    clearTimeout(hideTimer);
    const fullName = el.getAttribute("aria-label") || el.innerHTML || el.textContent;
    if (currentPopupAnchor !== el) {
      removePopup();  // remove any existing one immediately
      currentPopupAnchor = el;
      showPopup(el, fullName);
    }
  }
}, true);

// When mouse leaves a professor element, schedule popup removal
document.body.addEventListener("mouseleave", e => {
  const el = e.target;
  if (el.matches(SELECTOR) && isValidProfessor(el)) {
    hideTimer = setTimeout(removePopup, TIME_OUT_TIME);
  }
}, true);

// Get RMP basic info from the website
async function fetchRMPInfo(fullName) {
  const firstLast = convertToFirstLast(fullName);
  const searchUrl = `https://www.ratemyprofessors.com/search/professors/1147?q=${encodeURIComponent(firstLast)}`;
  console.log("Matched teacher entries:", searchUrl);
  
  try {
  const response = await chrome.runtime.sendMessage({
      action: "fetchRMP",
      url: searchUrl
    });
  
  if (!response.success) throw new Error(response.error);
  const html = await response.html;

  const relayMarker = "window.__RELAY_STORE__ = ";
  const processMarker = "window.process = {}";

  const startIdx = html.indexOf(relayMarker);
  const endIdx = html.indexOf(processMarker);
  if (startIdx === -1 || endIdx === -1) throw new Error("Relay store not found");

  let jsonText = html.substring(startIdx + relayMarker.length, endIdx).trim();
  jsonText = jsonText.replace(/;\s*$/, "");

  const relayData = JSON.parse(jsonText);

  // Extracting __typename = 'Teacher' from RMP
  const teacherEntries = Object.values(relayData).filter(entry => 
      entry.__typename === "Teacher" &&
      entry.firstName &&
      entry.lastName &&
      entry.legacyId &&
      entry.school?.__ref === "U2Nob29sLTExNDc=" // WashU ID can be changed in future for all universities
    );
  
  console.log("Matched teacher entries:", teacherEntries);

  if (teacherEntries.length === 0) throw new Error("No valid professor found");
    const fullNameLower = firstLast.toLowerCase();
    const parts = fullNameLower.split(' ');

    // Try to find exact match first
    let bestMatch = teacherEntries.find(
      entry => `${entry.firstName} ${entry.lastName}`.toLowerCase() === fullNameLower
    );

    //if no exact matches
    if (!bestMatch) {
      console.log("No exact matches found. Searching for last name only");
      const lastName = parts[parts.length - 1]; // Ignores middle name
      bestMatch = teacherEntries.find(
        entry => entry.lastName.toLowerCase() === lastName
      );
    }

    if (!bestMatch) {
      console.log("No exact matches found. Trying fuzzy matching");

      function simpleCharDiff(a, b) {
        a = normalizeName(a);
        b = normalizeName(b);
        let errors = 0;
        const len = Math.min(a.length, b.length);
        for (let i = 0; i < len; i++) {
          if (a[i] !== b[i]) errors++;
        }
        return errors;
      }

      const targetFirst = normalizeName(parts[0]);
      const targetLast = normalizeName(parts[parts.length - 1]);

      bestMatch = teacherEntries.find(entry => {
        const entryFirst = normalizeName(entry.firstName);
        const entryLast = normalizeName(entry.lastName);
        return (
          simpleCharDiff(entryFirst, targetFirst) <= 1 &&
          simpleCharDiff(entryLast, targetLast) <= 1
        );
      });
    }

        
    if (!bestMatch){
      console.log("No best matches");
    }

    return {
      name: `${bestMatch.firstName} ${bestMatch.lastName}`,
      rating: bestMatch.avgRating || "N/A",
      would_take_again: bestMatch.wouldTakeAgainPercent >= 0 ? Math.ceil(bestMatch.wouldTakeAgainPercent) : "N/A",
      difficulty: bestMatch.avgDifficulty || "N/A",
      url: `https://www.ratemyprofessors.com/professor/${bestMatch.legacyId}`
    };

  } catch (err) {
    console.log("RMP fetch error:", err);
    return {
      name: firstLast,
      // rating: "N/A",
      // would_take_again: "N/A",
      // difficulty: "N/A",
      url: `https://www.ratemyprofessors.com/search/professors/1147?q=${encodeURIComponent(firstLast)}`
    };
  }
}


// Showing the pop-up window
async function showPopup(targetElem, fullName) {

  console.log("showing popup"); // DEBUGGING LINE; DELETE BEFORE PUBLISH

  const popup = document.createElement("div");
  popup.className = "rmp-popup";

  // Fetch saved settings for theme and color
  chrome.storage.sync.get(["theme", "primaryColor", "textColor"], (settings) => {
    let bgColor = "#ffffff";
    let textColor = "#000000";

    switch (settings.theme) {
      case "dark":
        bgColor = "#222";
        textColor = "#fff";
        break;
      case "blue":
        bgColor = "#d0e8ff";
        textColor = "#000";
        break;
      case "custom":
        bgColor = settings.primaryColor || "#ffffff";
        textColor = settings.textColor || "#000000";
        break;
      case "light":
      default:
        bgColor = "#ffffff";
        textColor = "#000000";
    }

    popup.style.backgroundColor = bgColor;
    popup.style.color = textColor;
    popup.style.border = "1px solid #ccc";
    popup.style.padding = "10px";
    popup.style.borderRadius = "8px";
    popup.style.maxWidth = "250px";
    popup.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
  });

  document.body.appendChild(popup);

  const popup_inner = document.createElement("span");
  popup_inner.innerHTML = "Loading...";
  popup.appendChild(popup_inner);

  const rect = targetElem.getBoundingClientRect();
  popup.style.top = `${rect.top + window.scrollY}px`;
  popup.style.left = `${rect.right + window.scrollX + 10}px`;

  popup.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  popup.addEventListener('mouseleave', () => removePopup());

  // Fetch RMP info asynchronously
  const info = await fetchRMPInfo(fullName);

  if (info.rating) {
    popup_inner.innerHTML = `
    <h2>
      <a href="${info.url}" target="_blank">${info.name}</a>
    </h2>
    <strong>Rating: ${info.rating}</strong><br>
    <strong>Would take again: ${info.would_take_again}%</strong>
    <strong>Level of Difficulty: ${info.difficulty}</strong>
  `;
  } else {
    popup_inner.innerHTML = `
    <h2>
      <a href="${info.url}" target="_blank">${info.name}</a>
    </h2>
    <strong>No results found. Tap the link to check manually. \u2B06\uFE0F</strong>
  `;
  }
}

// Removing the pop-up window
function removePopup() {
  currentPopupAnchor = null;
  document.querySelectorAll(".rmp-popup").forEach(e => e.remove());
}

// Converts "lastName, firstName" to "firstName lastName"
function convertToFirstLast(fullName) {
  if (typeof fullName !== 'string') return '';

  const parts = fullName.split(',');

  // If there isn’t exactly one comma, just trim and return as-is
  if (parts.length !== 2) return fullName.trim();
  
  const lastName  = parts[0].trim();
  const firstName = parts[1].trim();

  return `${firstName} ${lastName}`;
}