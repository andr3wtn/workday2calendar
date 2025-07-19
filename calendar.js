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
document.addEventListener('DOMContentLoaded', () => {
    updateButtonVisibility;}
); // Starting point

function updateButtonVisibility() {
    // User is signed in and APIs are loaded
    if (gapiInited && gisInited && gapi.client.getToken()) { 
        signInButton.style.display = 'none'; // Hide sign-in button
        exportButton.style.display = 'block'; // Show export button
        authStatusElement.innerText = 'Signed in to Google Calendar. Ready to export!';
        authStatusElement.style.color = "#215732";

    // Not signed in or APIs not fully loaded
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
function parseMeetingPattern(pattern) {
    const parts = pattern.split("|").map(p => p.trim());
    console.log(parts);
    const daysPart = parts[0] || "";
    const timePart = parts[1] || "";
    const locationPart = parts[2] || "";
    console.log(locationPart);

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

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
            fileInput.value = "";
            const TIMEZONE = "America/Chicago"; // St Louis time by default
            const rows = sheet.slice(3).filter(row => row.length > 8 && typeof row[8] === "string")
                .map(row => {
                    const startDateRaw = row[10];
                    const endDateRaw = row[11];
                    if (typeof startDateRaw === "number" && typeof endDateRaw === "number") {
                        const startDate = new Date(1900, 0, startDateRaw + 1);
                        startDate.setDate(startDate.getDate() - 1);
                        const endDate = new Date(1900, 0, endDateRaw + 1);
                        endDate.setDate(endDate.getDate() - 1); 

                        const startDateInZone = luxon.DateTime.fromJSDate(startDate, { zone: TIMEZONE }).toISO();  // Convert and format to ISO string
                        const endDateInZone = luxon.DateTime.fromJSDate(endDate, { zone: TIMEZONE }).toISO();  // Convert and format to ISO string

                        // Update the row with timezone-converted dates
                        row[10] = startDateInZone;
                        row[11] = endDateInZone;
                    }
                    return row.slice(1, 12);
                });
            // console.log("ROWS: ", rows); // DEBUG

            let eventsCreatedCount = 0;
            let eventsSkippedCount = 0;
            let eventsFailedCount = 0;

            // console.log("generating calednar"); // DEBUG
            let colorId = 1;
            for (const row of rows) {
                const courseName = formatCourseName(row[0]);
                const meetingPattern = row[7];
                const instructor = row[8];
                const startDateRaw = row[9];
                const endDateRaw = row[10];

                if (!meetingPattern) {
                    eventsSkippedCount++;
                    continue;
                }

                let { days, startTime, endTime, location } = parseMeetingPattern(meetingPattern);
                if (!days.length || !startTime || !endTime) {
                    eventsSkippedCount++;
                    continue;
                }

                let startDate = luxon.DateTime.fromISO(startDateRaw, { zone: TIMEZONE });

                // If the meetingDay is different from the startDay (usually a Monday due to WashU semester schedules)
                const meetingDays = days.map(day => luxon.DateTime.fromFormat(day, 'EEE').weekday);
                const startDayOfWeek = startDate.weekday;

                if (!meetingDays.includes(startDayOfWeek)) {
                    const dayDifference = (meetingDays[0] - startDayOfWeek + 7) % 7;  // Adjust start to the first meeting day
                    startDate = startDate.plus({ days: dayDifference });
                }
                days = days.map((day) => { return WEEKDAY_MAP[day]; })
                const endDate = luxon.DateTime.fromISO(endDateRaw, { zone: TIMEZONE });

                const startDateTime = startDate.set({
                    hour: startTime.hour,
                    minute: startTime.minute,
                    second: 0,
                    millisecond: 0
                });

                const endDateTime = startDate.set({
                    hour: endTime.hour,
                    minute: endTime.minute,
                    second: 0,
                    millisecond: 0
                });

                // console.log("start date time: ", startDateTime.toJSDate()); // DEBUG
                // console.log("end date time: ", endDateTime.toJSDate()); // DEBUG

                const rruleDays = days.join(",");
                const untilDate = endDate.endOf('day');
                const untilStr = untilDate.toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");
                // untilDate.setHours(23, 59, 59, 999);
                // const untilStr = untilDate.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/-/g, '').replace(/:/g, '');
                const recurrenceRule = [`RRULE:FREQ=WEEKLY;BYDAY=${rruleDays};UNTIL=${untilStr}`];

                const eventData = {
                    summary: courseName,
                    description: `Instructor: ${instructor}\nMeeting: ${meetingPattern}`,
                    location: location,
                    start: { 
                        dateTime: startDateTime.toFormat("yyyy-MM-dd'T'HH:mm:ss"),
                        timeZone: TIMEZONE 
                    },
                    end: { 
                        dateTime: endDateTime.toFormat("yyyy-MM-dd'T'HH:mm:ss"),
                        timeZone: TIMEZONE 
                    },
                    recurrence: recurrenceRule,
                    colorId: colorId.toString(),
                };

                console.log(eventData);
                if (colorId > 7) {
                    const message = document.createElement("p");
                    message.innerHTML = "Excuse me how many classes???";
                    if (exportButton) { exportButton.append(message); }
                }
                colorId = (colorId % 9) + 1;

                try {
                    await createGoogleCalendarEvent(eventData);
                    eventsCreatedCount++;
                } catch (error) {
                    eventsFailedCount++;
                    console.error(`Failed to create event for ${courseName}:`, error);
                }
            }

            showResultPopup(eventsCreatedCount, eventsSkippedCount, eventsFailedCount);

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
    const { summary, description, location, start, end, recurrence, colorId } = eventData;

    // The 'start' and 'end' objects contain 'dateTime' and 'timeZone'.
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
function formatCourseName(courseName) {
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

function showResultPopup(eventsCreatedCount, eventsSkippedCount, eventsFailedCount) {
    const modal = document.getElementById("result-modal");
    const successText = document.getElementById("result-success");
    const skippedText = document.getElementById("result-skipped");
    const failedText = document.getElementById("result-failed");

    // Fill in result data
    successText.textContent = `✅ Successfully created: ${eventsCreatedCount} events.`;
    skippedText.textContent = eventsSkippedCount > 0 ? `⚠️ Skipped: ${eventsSkippedCount} events (missing pattern/time).` : 'No skipped';
    failedText.textContent = eventsFailedCount > 0 ? `❌ Failed: ${eventsFailedCount} events (see console).` : 'No Failed';

    // Style failed message dynamically
    failedText.className = eventsFailedCount > 0 ? 
        "text-red-600 font-medium mt-2" : 
        "text-gray-600 mt-2";

    modal.classList.remove("hidden");
}

    // ✅ Add close functionality
document.getElementById("result-modal-close").addEventListener("click", () => {
    document.getElementById("result-modal").classList.add("hidden");
});

    // ✅ Also close modal if clicking on backdrop
document.getElementById("result-modal").addEventListener("click", (e) => {
    if (e.target.id === "result-modal") {
        e.currentTarget.classList.add("hidden");
    }
});

