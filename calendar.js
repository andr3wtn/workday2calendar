/* ------------ Google API & Gobal Configuration ------------ */

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
        // redirect_uri: 'http://localhost:5501',
        callback: '',
    });
    gisInited = true;
    console.log("Google Identity Services loaded.");
    updateButtonVisibility();
}

async function initializeGapiClient() {
    try {
        await gapi.client.init({
            // apiKey: API_KEY, // Can be omitted if solely relying on OAuth for auth
            discoveryDocs: config.DISCOVERY_DOCS,
        });
        gapiInited = true;
        console.log("Google API client loaded.");
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
let authStatusElement = document.getElementById('auth-status');
let signInButton = document.getElementById('google-sign-in-button');
let exportButton = document.getElementById('export-button');
document.addEventListener('DOMContentLoaded', () => {
    authStatusElement = document.getElementById('auth-status');
    signInButton = document.getElementById('google-sign-in-button');
    exportButton = document.getElementById('export-button');
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
    const days = daysPart.split(/[ /]+/).filter(Boolean);
    // console.log("days ", days); // DEBUG
    let startTime = null, endTime = null;
    if (timePart.includes("-")) {
        const [startStr, endStr] = timePart.split("-").map(s => s.trim());

        startTime = parseTime(startStr);
        endTime = parseTime(endStr);
        // console.log("start time: ", startTime); // DEBUG
        // console.log("end time: ", endTime); // DEBUG
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
            // console.log("SHEET: ", sheet); // DEBUG

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
            console.log("ROWS: ", rows); // DEBUG

            let eventsCreatedCount = 0;
            let eventsSkippedCount = 0;
            let eventsFailedCount = 0;

            console.log("generating calednar"); // DEBUG
            let count = 1;  // DEBUG
            let colorId = 1;
            for (const row of rows) {
                console.log("Parsing Row ", count); // DEBUG
                count ++; // DEBUG
                const courseName = formatCourseName(row[0]);
                console.log("course name: ", courseName);
                const meetingPattern = row[7];
                const instructor = row[8];
                const startDateRaw = row[9];
                const endDateRaw = row[10];

                console.log("startDateRaw: ", startDateRaw); // DEBUG
                console.log("endDateRaw: ", endDateRaw); // DEBUG
                if (!meetingPattern) {
                    eventsSkippedCount++;
                    continue;
                }

                let { days, startTime, endTime, buildingPart, roomPart } = parseMeetingPattern(meetingPattern);
                if (!days.length || !startTime || !endTime) {
                    eventsSkippedCount++;
                    continue;
                }
                // console.log("days length: ", days.length); // DEBUG
                console.log("start time: ", startTime); // DEBUG
                console.log("end time: ", endTime); // DEBUG

                let startDate = luxon.DateTime.fromISO(startDateRaw, { zone: TIMEZONE });

                console.log("Parsed Start Date: ", startDate.isValid ? startDate.toISO() : "Invalid");

                // If the meetingDay is different from the startDay (usually a Monday due to WashU semester schedules)
                console.log("Days from meeting pattern: ", days);

                const meetingDays = days.map(day => luxon.DateTime.fromFormat(day, 'EEE').weekday);
                console.log("Meeting Days: ", meetingDays);

                const startDayOfWeek = startDate.weekday;
                console.log("Start Day of Week: ", startDayOfWeek);

                if (!meetingDays.includes(startDayOfWeek)) {
                    const dayDifference = (meetingDays[0] - startDayOfWeek + 7) % 7;  // Adjust start to the first meeting day
                    console.log("Day Difference: ", dayDifference);

                    startDate = startDate.plus({ days: dayDifference });
                }
                days = days.map((day) => { return WEEKDAY_MAP[day]; })
                const endDate = luxon.DateTime.fromISO(endDateRaw, { zone: TIMEZONE });

                console.log("start date: ", startDate); // DEBUG
                console.log("end date: ", endDate); // DEBUG

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

                console.log("start date time: ", startDateTime.toJSDate()); // DEBUG
                console.log("end date time: ", endDateTime.toJSDate()); // DEBUG

                const rruleDays = days.join(",");
                const untilDate = endDate.endOf('day');
                const untilStr = untilDate.toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");
                // untilDate.setHours(23, 59, 59, 999);
                // const untilStr = untilDate.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/-/g, '').replace(/:/g, '');
                const recurrenceRule = [`RRULE:FREQ=WEEKLY;BYDAY=${rruleDays};UNTIL=${untilStr}`];

                console.log("\n");
                console.log("Rrule days: ", rruleDays);
                console.log("until date: ", untilDate); // DEBUG
                console.log("until string: ", untilStr); // DEBUG
                // console.log("course name: ", courseName); // DEBUG
                // console.log("Description: ", instructor, " ", meetingPattern); // DEBUG
                console.log("Location: ", buildingPart); // DEBUG
                console.log("Reccurrence Rule: ", recurrenceRule);
                const eventData = {
                    summary: courseName,
                    description: `Instructor: ${instructor}\nMeeting: ${meetingPattern}`,
                    location: buildingPart,
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
                if (colorId > 7) {
                    const message = document.createElement("p");
                    message.innerHTML = "Excuse me how many classes???";
                    if (exportButton) { exportButton.append(message); }
                }
                colorId = (colorId % 9) + 1;
                console.log("Eventdata: ", eventData); // DEBUG

                try {
                    await createGoogleCalendarEvent(eventData);
                    eventsCreatedCount++;
                } catch (error) {
                    eventsFailedCount++;
                    console.error(`Failed to create event for ${courseName}:`, error);
                }
                console.log('\n'); // debug
            }
            const result = document.createElement("div");
            result.id = "result";
            const line1 = document.createElement("p");
            line1.innerText = "Export process completed!";
            const line2 = document.createElement("p");
            line2.innerText =  `Successfully created: ${eventsCreatedCount} events.`;
            const line3 = document.createElement("p");
            line3.innerText =  `Skipped: ${eventsSkippedCount} events (due to missing pattern/time).`;
            const line4 = document.createElement("p");
            line4.innerText = `Failed: ${eventsFailedCount} events (check console for details).`;
            result.appendChild(line1);
            result.appendChild(line2);
            result.appendChild(line3);
            result.appendChild(line4);

            document.querySelector("#buttons").appendChild(result);

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
        ...(colorId && { 'colorId': colorId }),
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