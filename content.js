// Get Professor Names from the Website Page
const professorElems = [...document.querySelectorAll('div.gwt-Label.WLRO.WEQO[data-automation-id="promptOption"]')]
  .filter(el => {
    const name = el.getAttribute("aria-label") || el.innerText || el.textContent;
    
    // Skip empty or malformed text
    if (!name) return false;

    // Skip if it starts with a department code like "AFAS 1105"
    if (/^[A-Z]{2,5} \d{3,4}/.test(name)) return false;

    // Keep if it includes a comma (e.g., "Last, First")
    return name.includes(',');
  });

// // Printing out professor names (for DEBUGGING)
// for (const professor of professorElems) {
//     const name = professor.getAttribute("aria-label") || professor.innerText || professor.textContent;
//     console.log(name);
// }

for (const professor of professorElems) {
    professor.addEventListener('mouseenter', async () => {
        const fullName = professor.getAttribute("aria-label") || professor.innerText || el.textContent;
        const info = await fetchRMPInfo(fullName);
        showPopup(elem, info);
    });
}

// Get RMP basic info from the website
function fetchRMPInfo() {

}

let score = 5;
let subject = "Math";
let url = "http://ratemyprofessor/johngroberts";

// Showing the pop-up window
function showPopup() {
    const popup = document.createElement("div");
    popup.className = "rmp-popup";
    popup.innerHTML = `
    <strong>Rating: ${score || "N/A"}</strong><br>
    Subject: ${subject || "Unknown"}<br>
    <a href="${url}" target="_blank">View on RMP</a>
  `;
    document.body.appendChild(popup);
    const rect = targetElem.getBoundingClientRect();
    popup.style.top = `${rect.bottom + window.scrollY}px`;
    popup.style.left = `${rect.left + window.scrollX}px`;
}


