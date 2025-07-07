console.log("📦 popup.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  console.log("[Popup] DOM fully loaded");

  const theme = document.getElementById("theme");
  const primaryColor = document.getElementById("primaryColor");
  const textColor = document.getElementById("textColor");
  const colorLabel = document.getElementById("colorLabel");
  const textColorLabel = document.getElementById("textColorLabel");
  const saveBtn = document.getElementById("saveBtn");
  const openOptions = document.getElementById("openOptions");
  const backBtn = document.getElementById("backBtn");

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
      section.querySelectorAll("label, select, input, button").forEach(el => {
        el.style.color = fgColor;
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
      console.log("[Popup] Theme saved");
    });
  });

  // Handle background color input
  primaryColor.addEventListener("input", () => {
    const color = primaryColor.value;
    if (theme.value === "custom") {
      updateBackground("custom", color, textColor.value);
      chrome.storage.sync.set({ primaryColor: color }, () => {
        console.log("[Popup] Background color saved:", color);
      });
    }
  });

  // Handle text color input
  textColor.addEventListener("input", () => {
    const color = textColor.value;
    if (theme.value === "custom") {
      updateBackground("custom", primaryColor.value, color);
      chrome.storage.sync.set({ textColor: color }, () => {
        console.log("[Popup] Text color saved:", color);
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
      console.log("[Popup] Settings saved");

      saveBtn.innerText = "Saved!";
      setTimeout(() => saveBtn.innerText = "Save", 2000);
    });
  });

  // Switch to More Settings view
  openOptions.addEventListener("click", () => {
    mainContainer.style.display = "none";
    optionsContainer.style.display = "block";
  });

  // Back to main view
  backBtn.addEventListener("click", () => {
    optionsContainer.style.display = "none";
    mainContainer.style.display = "block";
  });
});
