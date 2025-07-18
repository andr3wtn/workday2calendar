/* ------------ Google API Configuration ------------ */
const CLIENT_ID = '396216549149-vfos9j1ve4g59863n4ll6drrua02f6v9.apps.googleusercontent.com';
// const API_KEY = 'YOUR_API_KEY'; // **REPLACE THIS** (optional for client-side OAuth)
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"];
const SCOPES = "https://www.googleapis.com/auth/calendar.events"; 

let tokenClient;
let gapiInited = false;
let gisInited = false;

function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    try {
        await gapi.client.init({
            // apiKey: API_KEY, // Can be omitted if solely relying on OAuth for auth
            discoveryDocs: DISCOVERY_DOCS,
        });
        gapiInited = true;
        console.log("Google API client loaded.");
        updateButtonVisibility();
    } catch (error) {
        console.error("Error initializing GAPI client:", error);
        authStatusElement.innerText = 'Error loading Google APIs. Check console.';
    }
}

// Called when accounts.google.com/gsi/client is loaded
function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // This will be set dynamically in handleAuthClick
    });
    gisInited = true;
    console.log("Google Identity Services loaded.");
    updateButtonVisibility();
}

// Weekday mapping for ICS RRULE
const WEEKDAY_MAP = {
    'Mon': 'MO',
    "Tue": "TU",
    "Wed": "WE",
    "Thu": "TH",
    "Fri": "FR",
    "Sat": "SA",
    "Sun": "SU"
};




/* --- HTML Button Handling --- */
const authStatusElement = document.getElementById('auth-status');
const signInButton = document.getElementById('google-sign-in-button');
const exportButton = document.getElementById('export-button');

document.addEventListener('DOMContentLoaded', updateButtonVisibility); // Starting point

function updateButtonVisibility() {
    if (gapiInited && gisInited && gapi.client.getToken()) {
        // User is signed in and APIs are loaded
        signInButton.style.display = 'none'; // Hide sign-in button
        exportButton.style.display = 'block'; // Show export button
        authStatusElement.innerText = 'Signed in to Google Calendar. Ready to export!';
        authStatusElement.style.color = "#215732";
    } else {
        // Not signed in or APIs not fully loaded
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
        console.log('Authorization successful.');
        updateButtonVisibility(); // Update button visibility on successful auth
    };

    // Check if an access token already exists (e.g., from a previous session)
    if (gapi.client.getToken() === null) {
        // No token, initiate the consent flow
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        // Token exists, just refresh it if needed (or re-prompt if scope changes etc.)
        // For simplicity, we'll re-request access without prompt if token exists.
        // In a real app, you'd check token expiry and refresh silently.
        tokenClient.requestAccessToken({prompt: ''}); // Use '' for silent refresh if possible
    }
}




/* --------- Parsing Excel Files --------- */
function parseMeetingPattern(pattern) {
    const parts = pattern.split("|").map(p => p.trim());
    const daysPart = parts[0] || "";
    const timePart = parts[1] || "";

    // Exmaple: "URBAUER, Room 222" to "URBAUER" and "Room 222"
    const locationPart = parts[2] || "";
    const locationParts = locationPart.split(",").map(p => p.trim());
    const buildingPart = locationParts[0] || "";
    const roomPart = locationParts[1] || "";

    // Days -> ["Tue","Thu"] => ["TU","TH"]
    const days = daysPart.split(/[ /]+/).map(d => WEEKDAY_MAP[d]).filter(Boolean);

    let startTime = null, endTime = null;
    if (timePart.includes("-")) {
        const [startStr, endStr] = timePart.split("-").map(s => s.trim());
        startTime = parseTime(startStr);
        endTime = parseTime(endStr);
    }
    return { days, startTime, endTime, buildingPart, roomPart };
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
async function handleExport() {
    const fileInput = document.getElementById("excelFile");
    if (!fileInput.files.length) {
        alert("Please upload a file");
        return;
    }

    if (!gapi.client.getToken()) {
        alert('You are not signed in to Google. Please sign in first.');
        handleAuthClick();
        return;
    }

    authStatusElement.innerText = 'Processing and exporting events...';

    console.log("reading file"); // DEBUG
    const reader = new FileReader();
    console.log("reader created"); // DEBUG
    reader.onload = async function (e) {
        try {
            console.log("trying"); // DEBUG
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
            const rows = sheet.filter(row => row.length > 8 && typeof row[8] === "string");
            
            const TIMEZONE = "America/Chicago"; // St Louis time by default

                // DEBUG
                console.log("time zone set");
            let eventsCreatedCount = 0;
            let eventsSkippedCount = 0;
            let eventsFailedCount = 0;

                            // DEBUG
            console.log("generating calednar");
            for (const row of rows) {
                const courseName = row[4];
                const meetingPattern = row[8];
                const instructor = row[9];
                const startDateRaw = row[10];
                const endDateRaw = row[11];

                if (!meetingPattern) {
                    eventsSkippedCount++;
                    continue;
                }

                const { days, startTime, endTime, buildingPart, roomPart } = parseMeetingPattern(meetingPattern);
                if (!days.length || !startTime || !endTime) {
                    eventsSkippedCount++;
                    continue;
                }

                const startDate = new Date(startDateRaw);
                const endDate = new Date(endDateRaw);

                let startDateTime = new Date(startDate);
                startDateTime.setHours(startTime.hour, startTime.minute, 0, 0);

                let endDateTime = new Date(startDate);
                endDateTime.setHours(endTime.hour, endTime.minute, 0, 0);

                const rruleDays = days.join(",");
                const untilDate = new Date(endDate);
                untilDate.setHours(23, 59, 59, 999);
                const untilStr = untilDate.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/-/g, '').replace(/:/g, '');
                const recurrenceRule = [`RRULE:FREQ=WEEKLY;BYDAY=${rruleDays};UNTIL=${untilStr}`];

                const eventData = {
                    summary: courseName,
                    description: `Instructor: ${instructor}\nMeeting: ${meetingPattern}`,
                    location: location,
                    start: { dateTime: startDateTime.toISOString().substring(0, 19), timeZone: TIMEZONE },
                    end: { dateTime: endDateTime.toISOString().substring(0, 19), timeZone: TIMEZONE },
                    recurrence: recurrenceRule,
                };

                try {
                    await createGoogleCalendarEvent(eventData);
                    eventsCreatedCount++;
                } catch (error) {
                    eventsFailedCount++;
                    console.error(`Failed to create event for ${courseName}:`, error);
                }
                
            } 
            alert(`Export process completed!
                \nSuccessfully created: ${eventsCreatedCount} events.
                \nSkipped: ${eventsSkippedCount} events (due to missing pattern/time).
                \nFailed: ${eventsFailedCount} events (check console for details).`);
            authStatusElement.innerText = 'Export complete. Check your Google Calendar!';
        } catch (error) {
            console.error("Error during file processing or export:", error);
            alert("An error occurred during the export process. See console for details.");
            authStatusElement.innerText = 'An error occurred during export.';
        }
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
}





/* --------- Google Calendar Event Handling --------- */
/** 
 * --- New function to create a Google Calendar event ---
 * @param {*} eventData: 
 * */ 
async function createGoogleCalendarEvent(eventData) {
    const { summary, description, location, start, end, recurrence } = eventData;

    // Google Calendar expects RFC3339 format (ISO 8601 with Z for UTC or +HH:MM for offset)
    // The 'start' and 'end' objects should contain 'dateTime' and 'timeZone'.
    // Example: { "dateTime": "2025-07-20T10:00:00-05:00", "timeZone": "America/Chicago" }

    const event = {
        'summary': summary,
        'location': location,
        'description': description,
        'start': start,
        'end': end,
        'recurrence': recurrence,
        'reminders': {
            'useDefault': true,
        },
    };

    try {
        const request = gapi.client.calendar.events.insert({
            'calendarId': 'primary', // Or a specific calendar ID if you want to let the user choose
            'resource': event,
        });

        const response = await request;
        console.log('Event created: %s', response.result.htmlLink);
        return response.result;
    } catch (err) {
        console.error('Error creating event: ', err.message);
        throw err;
    }
}
