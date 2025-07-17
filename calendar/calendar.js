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
