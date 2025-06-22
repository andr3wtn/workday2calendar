// Debug line
console.log("CourseProf RMP Extension loaded!");

// Const variables
const SELECTOR = 'div.gwt-Label.WLRO.WEQO[data-automation-id="promptOption"]';
let hideTimer = null;
const TIME_OUT_TIME = 200;

// Helper function to check if an element is a valid professor
function isValidProfessor(el) {
  const name = el.getAttribute("aria-label") || el.innerText || el.textContent;
  
  // Skip empty or malformed text
  if (!name) return false;

  // Skip if it starts with a course code like "CSE 131"
  if (/^[A-Z]{2,5} \d{3,4}/.test(name)) return false;

  // Keep if it includes a comma (e.g., "LastName, FirstName")
  return name.includes(',');
}

// When mouse enters *any* descendant of body, capture it if it matches SELECTOR
document.body.addEventListener("mouseenter", e => {
  const el = e.target;
  if (el.matches(SELECTOR) && isValidProfessor(el)) {
    clearTimeout(hideTimer);
    const fullName = el.getAttribute("aria-label") || el.textContent;
    showPopup(el, fullName);
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
  // TO DO:
  // Fetch info from RMP
  
  // Delete after completed
  // Example stub data until fetchRMPInfo is added
  await new Promise(resolve => setTimeout(resolve, 2000));
    
  const info = {
      score: "4.5",
      would_take_again: 60,
      url: `https://www.ratemyprofessors.com/search/professors?q=${encodeURIComponent(fullName)}`
  };
  return info;
}


// Showing the pop-up window
async function showPopup(targetElem, fullName) {
  const popup = document.createElement("div");
  popup.className = "rmp-popup";
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

  // Update popup <span> content
  popup_inner.innerHTML = `
    <h2>${fullName || "N/A"}</h2><br>
    <strong>Rating: ${info.score || "N/A"}</strong><br>
    <strong>Would take again: ${info.would_take_again+'%' || "Unknown"}</strong><br>
    <a href="${info.url}" target="_blank">View on RMP</a>
  `;
}

// Removing the pop-up window
function removePopup() {
  document.querySelectorAll(".rmp-popup").forEach(e => e.remove());
}