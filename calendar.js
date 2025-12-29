import { handleExtract } from './extract_events.js';

/* ------------ Google API & Gobal Configuration ------------ */
const config = {
    CLIENT_ID: '396216549149-vfos9j1ve4g59863n4ll6drrua02f6v9.apps.googleusercontent.com',
    DISCOVERY_DOCS: ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"],
    SCOPES: "https://www.googleapis.com/auth/calendar.events"
}

let tokenClient;
let gapiInited = false;
let gisInited = false;

function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

// Called when accounts.google.com/gsi/client is loaded
function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: config.CLIENT_ID,
        scope: config.SCOPES,
        callback: '',
    });
    gisInited = true;
    // console.debug("Google Identity Services loaded."); // DEBUG
    updateButtonVisibility();
}

async function initializeGapiClient() {
    try {
        await gapi.client.init({
            discoveryDocs: config.DISCOVERY_DOCS,
        });
        gapiInited = true;
        // console.debug("Google API client loaded."); // DEBUG
        updateButtonVisibility();
    } catch (error) {
        console.error("Error initializing GAPI client:", error);
        authStatusElement.innerText = 'Error loading Google APIs. Check console.';
    }
}



// Weekday mapping for ICS RRULE
export const WEEKDAY_MAP = {
    'Mon': 'MO',
    "Tue": "TU",
    "Wed": "WE",
    "Thu": "TH",
    "Fri": "FR",
    "Sat": "SA",
    "Sun": "SU"
};




/* --- HTML Button Handling --- */
export let authStatusElement;
export let extractStatusElement;
export let extractSkippedReasonElement;
let signInButton;
let exportButton;
export const events = [];
document.addEventListener('DOMContentLoaded', () => {
    authStatusElement = document.querySelector('#auth-status');
    extractStatusElement = document.querySelector('#extract-status');
    extractSkippedReasonElement = document.querySelector('#extract-skipped-reason');
    signInButton = document.querySelector('#google-sign-in-button');
    exportButton = document.querySelector('#export-button');
    updateButtonVisibility();
}); // Starting point

function updateButtonVisibility() {
    // User is signed in and APIs are loaded
    if (gapiInited && gisInited) { 
        const token = gapi.client.getToken();
        if (token) {
            signInButton.style.display = 'none'; // Hide sign-in button
            exportButton.style.display = 'block'; // Show export button
            authStatusElement.innerText = 'Signed in to Google Calendar. Ready to export!';
            authStatusElement.style.color = "#215732";
        }
    } else { 
        signInButton.style.display = 'block'; // Show sign-in button
        exportButton.style.display = 'none'; // Hide export button
        authStatusElement.innerText = 'Please sign in with Google to use the calendar features.';
    }
}

async function handleAuthClick() {
    authStatusElement.innerText = 'Attempting to sign in...';
    tokenClient.callback = async (resp) => {
        if (resp.error) {
            console.error('Authorization failed:', resp.error);
            authStatusElement.innerText = 'Sign-in failed. Please try again.';
            throw (resp);
        }
        // console.debug('Authorization successful.'); // DEBUG
        updateButtonVisibility(); // Update button visibility on successful auth
    };

    // Check if an access token already exists (e.g., from a previous session)
    if (gapi.client.getToken() === null) {
        // No token, initiate the consent flow
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        // Token exists, just refresh it if needed (or re-prompt if scope changes etc.)
        // For simplicity, we'll re-request access without prompt if token exists.
        tokenClient.requestAccessToken({prompt: ''});
    }
}




/* --------- Parsing Excel Files --------- */
export function parseMeetingPattern(pattern) {
    const parts = pattern.split("|").map(p => p.trim());
    const daysPart = parts[0] || "";
    const timePart = parts[1] || "";
    const locationPart = parts[2] || "";

    let location = "";
    if (locationPart) {
        // Crop room from "Room 00222" to "222"
        const locationParts = locationPart.split(",").map(p => p.trim());
        const roomPart = locationParts[1] || "";
        if (roomPart) {
            const digits = roomPart.match(/\d+/)[0];  // "Room 00222" to "00222"
            const cropped = String(Number(digits)) || "";
            location = locationParts[0] + " " + cropped;
        }

    }

    // Days -> ["Tue","Thu"] => ["TU","TH"]
    const days = daysPart.split(/[ /]+/).filter(Boolean);
    let startTime = null, endTime = null;
    if (timePart.includes("-")) {
        const [startStr, endStr] = timePart.split("-").map(s => s.trim());

        startTime = parseTime(startStr);
        endTime = parseTime(endStr);
    }
    return { days, startTime, endTime, location };
}

function parseTime(string) {
    // "1:00 PM" -> Date object today with that time
    const match = string.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return null;
    let hour = parseInt(match[1], 10);
    let minute = parseInt(match[2], 10);
    const ampm = match[3].toUpperCase();
    if (ampm === "PM" && hour !== 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    return { hour, minute };
}




/* --------- MAIN LOGIC --------- */
function generateICS(events) {
    let icsContent = `BEGIN:VCALENDAR
    VERSION:2.0
    CALSCALE:GREGORIAN
    PRODID:-//Workday2Calendar//EN
    `;
}



/* --------- Google Calendar Event Handling --------- */
async function handleGoogleExport() {
    try {
        extractStatusElement.innerText = '';
        let eventsCreatedCount = 0;
        let eventsFailedCount = 0;

        if (!gapi.client.getToken()) {
            alert('You are not signed in to Google. Please sign in first.');
            handleAuthClick();
            return;
        }

        if (events.length === 0) {
            alert('No events to export. Please upload a file first.');
            return;
        }

        authStatusElement.innerText = 'Processing and exporting events. Please wait';
        authStatusElement.classList.add('text-lg', 'animate-pulse', 'font-semibold');
        for (const event of events) {
            try {
                await createGoogleCalendarEvent(event);
                eventsCreatedCount++;
            } catch (error) {
                eventsFailedCount++;
                console.error('Error creating event: ', error.message);
            }
        }
        authStatusElement.innerText = 'Events exported successfully!';
        authStatusElement.classList.remove('text-lg', 'animate-pulse', 'font-semibold');
        document.getElementById("excelFile").value = ""; // Clear the file input
        // Clear and hide the schedule preview
        events.length = 0;
        const previewContainer = document.querySelector('#schedule-preview');
        if (previewContainer) {
            const tbody = previewContainer.querySelector('tbody');
            if (tbody) tbody.innerHTML = '';
            previewContainer.classList.add("hidden");
        }
        showResultPopup(eventsCreatedCount, eventsFailedCount);
    } catch (error) {
        console.error("Error during Google export:", error);
        authStatusElement.classList.remove('text-lg', 'animate-pulse', 'font-semibold');
        authStatusElement.innerText = 'An error occurred during export to Google Calendar.';
        
    }
}

/** 
 * --- New function to create a Google Calendar event ---
 * @param {*} eventData: 
 * */ 
async function createGoogleCalendarEvent(eventData) {
    const { summary, location, start, end, recurrence, colorId } = eventData;

    // The 'start' and 'end' objects contain 'dateTime' and 'timeZone'.
    // Example: { "dateTime": "2025-07-20T10:00:00-05:00", "timeZone": "America/Chicago" }

    const event = {
        'summary': summary,
        'location': location,
        'start': start,
        'end': end,
        'recurrence': recurrence,
        'reminders': {
            'useDefault': true,
        },
        ...(colorId && { 'colorId': colorId }),
    };

    try {
        const request = gapi.client.calendar.events.insert({
            'calendarId': 'primary',
            'resource': event,
        });

        const response = await request;
        // console.log('Event created: %s', response.result.htmlLink); // DEBUG
        return response.result;
    } catch (err) {
        console.error('Error creating event: ', err.message);
        throw err;
    }
}

/* --------- Helper Functions --------- */
export function formatCourseName(courseName) {
    const parts = courseName.split(' - ');
    const courseNumber = parts[0].split('-')[0];

    let courseTitle = parts[1];
    courseTitle = courseTitle.replace(/\bintroduction\b/gi, "Intro");

    let formattedCoursName = `${courseNumber} ${courseTitle}`;
    if (formattedCoursName.length > 50) {
        return formattedCoursName.substring(0, 50);
    }
    return formattedCoursName;
}

function showResultPopup(eventsCreatedCount, eventsFailedCount) {
    const modal = document.querySelector("#result-modal");
    const successText = document.querySelector("#result-success");
    const failedText = document.querySelector("#result-failed");
    
    if (!modal || !successText || !failedText) {
        console.error("Result popup elements not found");
        return;
    }

    // Fill in result data
    successText.textContent = `✅ Successfully created: ${eventsCreatedCount} events.`;
    failedText.textContent = eventsFailedCount > 0 ? `❌ Failed: ${eventsFailedCount} events (see console).` : 'No Failed';

    // Style failed message dynamically
    failedText.className = eventsFailedCount > 0 ? 
        "text-red-600 font-medium mt-2" : 
        "text-gray-600 mt-2";

    modal.classList.remove("hidden");
}

    // Add close functionality
document.querySelector("#result-modal-close").addEventListener("click", () => {
    document.querySelector("#result-modal").classList.add("hidden");
});

    // Also close modal if clicking on backdrop
document.querySelector("#result-modal").addEventListener("click", (e) => {
    if (e.target.id === "result-modal") {
        e.currentTarget.classList.add("hidden");
    }
});


let editingCell = null; // { idx: number, field: string } or null
export function renderSchedulePreview() {
    try {
        const previewContainer = document.querySelector('#schedule-preview');
        const tbody = previewContainer ? previewContainer.querySelector('tbody') : null;
        if (!previewContainer || !tbody) throw new Error("Preview container or table body not found");

        previewContainer.classList.remove('hidden');

        if (!events.length) { // No events extracted
            tbody.innerHTML = '<tr><td colspan="4" class="text-gray-500">No events extracted.</td></tr>';
            return;
        }

        let html = '';
        events.forEach((event, idx) => {
            html += '<tr>';
    
            // 1. Course Name Display & Edit
            html += renderEditableCell({
                idx,
                field: 'summary',
                editingCell,
                value: event.summary,
                maxlength: "50"
              });
    
            // 2. Days Display & Edit
            const days = event.recurrence ? event.recurrence[0].match(/BYDAY=([^;]+)/)?.[1] : '';
            html += renderEditableCell({
                idx,
                field: 'days',
                editingCell,
                value: days,
            });
    
            // 3. Time Display & Edit
            const start = event.start.dateTime.slice(11, 16);
            const end = event.end.dateTime.slice(11, 16);
            const isEditingTime = editingCell && editingCell.idx === idx && editingCell.field === 'time';

            if (isEditingTime) {
                html += `
                  <td class="px-2 py-1 w-1/4 flex gap-1 items-center">
                    <input type="time" id="edit-start-${idx}" value="${start}"
                        class="border border-gray-300 focus:ring-2 focus:ring-washu-red/50 rounded-lg px-2 py-1 bg-white outline-none transition-shadow" autofocus>
                    <span>-</span>
                    <input type="time" id="edit-end-${idx}" value="${end}"
                        class="border border-gray-300 focus:ring-2 focus:ring-washu-red/50 rounded-lg px-2 py-1 bg-white outline-none transition-shadow">
                  </td>`;
            } else {
                html += renderEditableCell({
                    idx,
                    field: 'time',
                    editingCell,
                    value: `${start} - ${end}`
                });
            }
    
            // 4. Location Display & Edit
            html += renderEditableCell({
                idx,
                field: 'location',
                editingCell,
                value: event.location
            });
    
            html += '</tr>';
        });
        tbody.innerHTML = html;
    } catch (error) {
        console.error("Error rendering schedule preview:", error);
        return;
    }




    // Add event listeners for save/cancel on input fields
    if (editingCell) {
        let inputIds = [];
        if (editingCell.field === 'summary') inputIds = [`edit-summary-${editingCell.idx}`];
        if (editingCell.field === 'days') inputIds = [`edit-days-${editingCell.idx}`];
        if (editingCell.field === 'time') inputIds = [`edit-start-${editingCell.idx}`, `edit-end-${editingCell.idx}`];
        if (editingCell.field === 'location') inputIds = [`edit-location-${editingCell.idx}`];

        inputIds.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') saveCell(editingCell.idx, editingCell.field);
                    if (e.key === 'Escape') cancelEdit();
                });
                input.addEventListener('blur', () => {
                    // Use setTimeout to allow Enter to fire before blur
                    if (inputIds.length) {
                        setTimeout(() => {
                            if (document.activeElement !== input) saveCell(editingCell.idx, editingCell.field);
                        }, 0);
                    }
                });
            }
        });
        // Focus the first input
        if (inputIds.length) {
            setTimeout(() => {
                const input = document.getElementById(inputIds[0]);
                if (input) input.focus();
            }, 0);
        }
    }
}

function editCell(idx, field) {
    editingCell = { idx, field };
    renderSchedulePreview();
}

function cancelEdit() {
    editingCell = null;
    renderSchedulePreview();
}

function saveCell(idx, field) {
    if (field === 'summary') {
        const input = document.querySelector(`#edit-summary-${idx}`);
        if (input) events[idx].summary = input.value;
    } else if (field === 'days') {
        const input = document.querySelector(`#edit-days-${idx}`);
        if (input) {
            const untilMatch = events[idx].recurrence[0].match(/UNTIL=([^;]+)/);
            const until = untilMatch ? untilMatch[1] : '';
            events[idx].recurrence = [`RRULE:FREQ=WEEKLY;BYDAY=${input.value};UNTIL=${until}`];
        }
    } else if (field === 'time') {
        const startInput = document.querySelector(`#edit-start-${idx}`);
        const endInput = document.querySelector(`#edit-end-${idx}`);
        if (startInput && endInput) {
            const date = events[idx].start.dateTime.slice(0, 10);
            events[idx].start.dateTime = `${date}T${startInput.value}:00`;
            events[idx].end.dateTime = `${date}T${endInput.value}:00`;
        }
    } else if (field === 'location') {
        const input = document.querySelector(`#edit-location-${idx}`);
        if (input) events[idx].location = input.value;
    }
    editingCell = null;
    renderSchedulePreview();
}

/**
 * @param {Object} param0
    * @param {number} param0.idx: The index of the cell to edit
    * @param {string} param0.field: The field to edit
    * @param {Object} param0.editingCell: The current editing cell
    * @param {string} param0.value: The value of the cell
    * @param {string} param0.placeholder: The placeholder for the input
    * @param {string} param0.type: The type of the input
    * @param {string} param0.extraClasses: Extra classes for the td
    * @param {function} param0.parseDisplay: A function to parse the value for display
 */
function renderEditableCell({ 
    idx, 
    field, 
    editingCell, 
    value, 
    placeholder = '', 
    type = 'text', 
    extraClasses = '', 
    maxlength= '',
    parseDisplay = v => v // Optional formatter for display mode
  }) {
    const isEditing = editingCell && editingCell.idx === idx && editingCell.field === field;
  
    if (isEditing) { // editing mode
      return `
        <td class="px-2 py-1 ${extraClasses}">
          <input 
            type="${type}" 
            id="edit-${field}-${idx}" 
            value="${value || ''}"
            placeholder="${placeholder}"
            class="border border-washu-red focus:ring-2 focus:ring-washu-red/50 rounded-lg px-2 py-1 w-full bg-white outline-none transition-shadow"
            autofocus
            maxlength = ${maxlength}
          >
        </td>
      `;
    } else { // display mode
      return `
        <td 
          class="px-2 py-1 group cursor-pointer transition relative ${extraClasses}" 
          onclick="editCell(${idx}, '${field}')"
        >
          <span class="group-hover:bg-gray-100 group-hover:border group-hover:border-washu-red group-hover:shadow-sm rounded px-1 py-0.5 transition">
            ${parseDisplay(value) || ''}
          </span>
        </td>
      `;
    }
  }
  
// Expose to window
window.editCell = editCell;
window.saveCell = saveCell;
window.cancelEdit = cancelEdit;
window.handleExtract = handleExtract;
window.handleAuthClick = handleAuthClick;
window.handleGoogleExport = handleGoogleExport;
window.gapiLoaded = gapiLoaded;
window.gisLoaded = gisLoaded;
