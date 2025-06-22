// Debug line
console.log("CourseProf RMP Extension loaded!");

// Const variables
const SELECTOR = 'div.gwt-Label.WLRO.WEQO[data-automation-id="promptOption"]';
const set = new WeakSet();

// Helper function to check if an element is a valid professor
function isValidProfessor(el) {
  const name = el.getAttribute("aria-label") || el.innerText || el.textContent;
  
  // Skip empty or malformed text
  if (!name) return false;

  // Skip if it starts with a department code like "AFAS 1105"
  if (/^[A-Z]{2,5} \d{3,4}/.test(name)) return false;

  // Keep if it includes a comma (e.g., "Last, First")
  return name.includes(',');
}

// Helper function to bind events to a professor element
function bindProfessorEvents(professor) {
  if (professor.dataset.rmpBound === "true") return;
  professor.dataset.rmpBound = "true";

  // // DEBUG
  // professor.style.border = "1px solid red";  

  professor.addEventListener('mouseenter', () => {
    const fullName = professor.getAttribute("aria-label") || professor.innerText || professor.textContent;
    showPopup(professor, fullName);
  });

  professor.addEventListener('mouseleave', () => {
    removePopup();
  });
}

function processInitialElements() {
  const professorElems = [...document.querySelectorAll(SELECTOR)].filter(isValidProfessor);
  professorElems.forEach(bindProfessorEvents);
}

// Get Professor Names from the Website Page
const observer = new MutationObserver((mutations) => {
    let newProfessorCount = 0;

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        // Skip text nodes and non-element nodes
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        
        // Check if the added node itself matches our selector
        if (node.matches && node.matches(SELECTOR) && isValidProfessor(node)) {
          bindProfessorEvents(node);
          newProfessorCount++;
        }
        
        // Check if any descendant nodes match our selector
        if (node.querySelectorAll) {
          const professorElems = [...node.querySelectorAll(SELECTOR)].filter(isValidProfessor);
          professorElems.forEach(bindProfessorEvents);
          newProfessorCount += professorElems.length;
        }
      }
    }
    
});

// Process initial elements
processInitialElements();

// Start observing for new elements
observer.observe(document.body, { childList: true, subtree: true });


// Get RMP basic info from the website
async function fetchRMPInfo(fullName) {
  // TO DO:
  // Fetch info from RMP
  
  // Delete after completed
  // Example stub data until fetchRMPInfo is added
  await new Promise(resolve => setTimeout(resolve, 2000));
    
  const info = {
      score: "4.5",
      subject: "Computer Science",
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

  // Fetch RMP info asynchronously
  const info = await fetchRMPInfo(fullName);

  // Update popup content
  popup_inner.innerHTML = `
    <strong>Rating: ${info.score || "N/A"}</strong><br>
    Subject: ${info.subject || "Unknown"}<br>
    <a href="${info.url}" target="_blank">View on RMP</a>
  `;
}

// Removing the pop-up window
function removePopup() {
  document.querySelectorAll(".rmp-popup").forEach(e => e.remove());
}