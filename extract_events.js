import { 
    events, 
    extractSkippedReasonElement, 
    extractStatusElement, 
    formatCourseName, 
    parseMeetingPattern, 
    renderSchedulePreview, 
    WEEKDAY_MAP 
} from './calendar.js';

async function handleExtract() {
    // Clear previous events
    events.length = 0;
    extractSkippedReasonElement.innerText = "";
    extractStatusElement.innerText = "";
    document.querySelector('#schedule-preview').classList.add("hidden");

    // Clear the schedule preview table body if it exists
    const previewContainer = document.querySelector('#schedule-preview');
    const tbody = previewContainer ? previewContainer.querySelector('tbody') : null;
    if (tbody) {
        tbody.innerHTML = '';
    }


    const fileInput = document.getElementById("excelFile");
    if (!fileInput.files.length) {
        alert("Please upload a file");
        return;
    }

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: "array" });

            const sheetName = workbook.SheetNames[0];
            const ws = workbook.Sheets[sheetName];

            // 🔧 Fix the broken used range
            const cells = Object.keys(ws).filter(k => k[0] !== "!");
            let maxR = 0, maxC = 0;

            for (const addr of cells) {
            const { r, c } = XLSX.utils.decode_cell(addr);
            maxR = Math.max(maxR, r);
            maxC = Math.max(maxC, c);
            }

            ws["!ref"] = XLSX.utils.encode_range({
            s: { r: 0, c: 0 },
            e: { r: maxR, c: maxC },
            });

            // ✅ Now this will work
            const sheet = XLSX.utils.sheet_to_json(ws, {
            header: 1,
            blankrows: false,
            defval: ""
            });

            console.log(sheet);
            const TIMEZONE = 'America/Chicago';

            const rows = sheet.slice(3).filter(row => row.length > 13 && typeof row[4] === "number")
                .map(row => {
                    const startDateRaw = row[12];
                    const endDateRaw = row[13];
                    if (typeof startDateRaw === "number" && typeof endDateRaw === "number") {
                        const startDate = new Date(1900, 0, startDateRaw + 1);
                        startDate.setDate(startDate.getDate() - 1);
                        const endDate = new Date(1900, 0, endDateRaw + 1);
                        endDate.setDate(endDate.getDate() - 1); 

                        const startDateInZone = luxon.DateTime.fromJSDate(startDate, { zone: TIMEZONE }).toISO();  // Convert and format to ISO string
                        const endDateInZone = luxon.DateTime.fromJSDate(endDate, { zone: TIMEZONE }).toISO();  // Convert and format to ISO string

                        // Update the row with timezone-converted dates
                        row[12] = startDateInZone;
                        row[13] = endDateInZone;
                    }
                    return row.slice(1, 14);
                });
            console.log(rows);
            let eventsSkippedCount = 0;
            let reasons = [];
            // console.log("generating calednar"); // DEBUG
            let colorId = 1;
            for (const row of rows) {
                if (!row[0]) {
                    eventsSkippedCount++;
                    reasons.push("No course name");
                    continue;
                }
                const courseName = formatCourseName(row[0]);

                if (!row[9]) {
                    eventsSkippedCount++;
                    reasons.push("No meeting pattern");
                    continue;
                }
                const meetingPattern = row[9];
                const startDateRaw = row[11];
                const endDateRaw = row[12];

                let { days, startTime, endTime, location } = parseMeetingPattern(meetingPattern);
                if (!days.length || !startTime || !endTime) { // Skip if no days, start time, or end time
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

                const endDateTime = startDate.set({ // Not a bug here; endDateTime refers to the end time of the event on its first occurrence
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

                // console.log(eventData); // DEBUG
                if (colorId > 12) {
                    const message = document.createElement("p");
                    message.innerHTML = "Excuse me how many classes???";
                    if (extractStatusElement) { extractStatusElement.append(message); }
                }
                colorId = (colorId % 11) + 1;

                events.push(eventData);
            }

            if (events.length > 0) {
                extractStatusElement.innerText = 'Extraction complete. Verify your schedule!';
                if (eventsSkippedCount > 0) {
                    extractSkippedReasonElement.innerText = `${eventsSkippedCount} events skipped due to: "${reasons.join(", ")}"`;
                    eventsSkippedCount = 0;
                    reasons = [];
                }
                renderSchedulePreview();
            } else {
                extractStatusElement.innerText = 'No events extracted. Please check your file and try again.';
                reasons = [];
            }
            // console.log(events); // DEBUG
        } catch (error) {
            console.error("Error during file processing or export:", error);
            alert("An error occurred during the export process. See console for details.");
            extractStatusElement.innerText = 'An error occurred during export.';
        }
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
}

function getSheetWithMostRows(workbook) {
    let best = { name: null, sheet: null, rowCount: 0 };
    for (const name of workbook.SheetNames) {
        const sheet = workbook.Sheets[name];
        if (!sheet || !sheet["!ref"]) continue;
        const range = XLSX.utils.decode_range(sheet["!ref"]);
        const rowCount = range.e.r - range.s.r + 1;
        if (rowCount > best.rowCount) {
            best = { name, sheet, rowCount };
        }
    }
    return best;
}

export { handleExtract };
