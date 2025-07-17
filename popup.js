console.debug("popup.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  populateSemesterSelect();

  chrome.storage.sync.get(["lastUsedSemester", "lastUsedAcademicLevels"], (data) => {
    const { lastUsedSemester, lastUsedAcademicLevels } = data;

    if (!lastUsedSemester && !lastUsedAcademicLevels) {
      return; // Exit if no last used settings are found
    }

  
    const semesterSelect = document.querySelector("#semester");

    for (let option of semesterSelect.options) {
      if (option.value === lastUsedSemester || option.textContent === lastUsedSemester) {
        semesterSelect.value = option.value;
        break;
      }
    }

    if (Array.isArray(lastUsedAcademicLevels)) {
      const checkboxes = document.querySelectorAll("#dropdown-content input[type=checkbox]");
      checkboxes.forEach(checkbox => {
        checkbox.checked = lastUsedAcademicLevels.includes(checkbox.value);
      });
    }
  });

  const theme = document.getElementById("theme");
  const primaryColor = document.getElementById("primaryColor");
  const textColor = document.getElementById("textColor");
  const colorLabel = document.getElementById("colorLabel");
  const textColorLabel = document.getElementById("textColorLabel");
  const saveBtn = document.getElementById("saveBtn");
  const openOptions = document.getElementById("openOptions");
  const backBtn = document.getElementById("backBtn");
  const runBtn = document.querySelector("#runButton");

  const mainContainer = document.querySelector(".container");
  const optionsContainer = document.querySelector(".options-container");

  // Load saved settings
  chrome.storage.sync.get(["theme", "primaryColor", "textColor"], (data) => {
    console.log("[Popup] Loaded settings:", data);

    if (data.theme) theme.value = data.theme;
    if (data.primaryColor) primaryColor.value = data.primaryColor;
    if (data.textColor) textColor.value = data.textColor;

    updateBackground(theme.value, primaryColor.value, textColor.value);

    const isCustom = theme.value === "custom";
    colorLabel.style.display = isCustom ? "block" : "none";
    textColorLabel.style.display = isCustom ? "block" : "none";
  });

  function updateBackground(theme, primary = "#ffffff", text = "#000000") {
    console.log(`[Popup] Updating background: ${theme}, BG: ${primary}, Text: ${text}`);
    let bgColor = "#ffffff";
    let fgColor = "#000000";

    switch (theme) {
      case "dark":
        bgColor = "#222";
        fgColor = "#fff";
        break;
      case "blue":
        bgColor = "#d0e8ff";
        fgColor = "#000";
        break;
      case "custom":
        bgColor = primary;
        fgColor = text;
        break;
      case "light":
      default:
        bgColor = "#ffffff";
        fgColor = "#000000";
    }

    // Apply styles to both views
    const views = document.querySelectorAll(".container, .options-container");
    views.forEach(section => {
      section.style.backgroundColor = bgColor;
      section.style.color = fgColor;
      section.querySelectorAll("label, input, button").forEach(el => {
        el.style.color = fgColor;
      });

      section.querySelectorAll("select").forEach(select => {
      select.style.color = "#000";
      }); 

    });
  }

  // Handle theme selection
  theme.addEventListener("change", () => {
    const selectedTheme = theme.value;
    const selectedColor = primaryColor.value;
    const selectedTextColor = textColor.value;

    const isCustom = selectedTheme === "custom";
    colorLabel.style.display = isCustom ? "block" : "none";
    textColorLabel.style.display = isCustom ? "block" : "none";

    updateBackground(selectedTheme, selectedColor, selectedTextColor);

    chrome.storage.sync.set({ theme: selectedTheme }, () => {
      console.debug("[Popup] Theme saved");
    });
  });

  // Handle background color input
  primaryColor.addEventListener("input", () => {
    const color = primaryColor.value;
    if (theme.value === "custom") {
      updateBackground("custom", color, textColor.value);
      chrome.storage.sync.set({ primaryColor: color }, () => {
        console.debug("[Popup] Background color saved:", color);
      });
    }
  });

  // Handle text color input
  textColor.addEventListener("input", () => {
    const color = textColor.value;
    if (theme.value === "custom") {
      updateBackground("custom", primaryColor.value, color);
      chrome.storage.sync.set({ textColor: color }, () => {
        console.debug("[Popup] Text color saved:", color);
      });
    }
  });

  // Save button click
  saveBtn.addEventListener("click", () => {
    chrome.storage.sync.set({
      theme: theme.value,
      primaryColor: primaryColor.value,
      textColor: textColor.value
    }, () => {

      saveBtn.innerText = "Saved!";
      setTimeout(() => saveBtn.innerText = "Save", 2000);
    });
  });

  // // Switch to More Settings view
  // openOptions.addEventListener("click", () => {
  //   mainContainer.style.display = "none";
  //   optionsContainer.style.display = "block";
  // });

  // Back to main view
  backBtn.addEventListener("click", () => {
    optionsContainer.style.display = "none";
    mainContainer.style.display = "block";
  });

  // Run Automation
  runBtn.addEventListener("click", () => {
    const semesterSelect = document.querySelector("#semester");
    const selectedOption = semesterSelect.selectedOptions[0];
    const season = selectedOption.dataset.season;
    const year = selectedOption.dataset.year;

    const checkboxes = document.querySelectorAll("#dropdown-content input[type=checkbox]");
    const academicLevels = Array.from(checkboxes)
      .filter(checkbox => checkbox.checked)
      .map(checkbox => checkbox.value);

    if (academicLevels.length == 0) {
      alert('Please select at least one academic level!');
    }

    chrome.storage.sync.set({
      lastUsedSemester: `${season} ${year}`,
      lastUsedAcademicLevels: academicLevels
    }, () => { console.debug('Last used settings saved.')});

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'RUN_AUTOMATION',
        payload: { season, year, academicLevels }
      });
    });
  });

  const extensionVersionSpan = document.querySelector('#extensionVersion');
  if (extensionVersionSpan) {
    extensionVersionSpan.textContent = chrome.runtime.getManifest().version;
  }
});


function populateSemesterSelect() {
  const semesterSelect = document.querySelector('#semester');

  const CURRENT_YEAR = new Date().getFullYear();
  const SEASONS = ['Spring', 'Fall'];

  for (let i = 0; i <= 1; i++) { // Populate <select> tag with <options>: "Fall 2025", "Spring 2026", "Fall 2026", "Spring 2027", etc.
    for (let season of SEASONS) {
      let year = CURRENT_YEAR + i;
      const option = document.createElement('option');
      option.value = `${season} ${year}`;
      option.textContent = `${season} ${year}`;
      option.dataset.season = season;
      option.dataset.year = year; 
      semesterSelect.appendChild(option);
    }
  }
}


