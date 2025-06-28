async function automateCourseFilters() {
    const dropdowns = document.querySelectorAll('[data-automation-id="multiselectInputContainer"]');
   
    // Start Day Within element
    const start_day_within = dropdowns[0];
    const input = start_day_within.querySelector('input');
    start_day_within.click();
    
    input.value = "08/25/2025";
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
    }));

    // Semester Calendar element
    const semester_calendar = document.querySelector('[data-automation-label="Semester Calendar"]');
    semester_calendar.click();

    // Scroll & Find current year
    await scrollAndSelectYear();

    // Semester element
    const semester = document.querySelector('[data-automation-label="Fall 2025(08/25/2025-12/17/2025)"]');
    semester.click();

    console.log("Course filter automation complete");
}

function getSemester() {
    const now = newDate();
    const year = now.getFullYear();
    const month = now.getMonth();
    const date = now.getDate();

    const startYear = month < 2 ? year - 1 : year;
    const endYear = startYear + 1;
    schoolYear = `${startYear}-${endYear}`;


    // Before late March, students check for spring startYear
    // e.g., Februrary 2025, students check Spring; April 2025, students check Fall
    if (month < 2 || (month === 2 && day <= 20)) { // Before March 20th:
        return 'Spring';
    } else { // After March 20th:
        return 'Fall';
    }
    
    // July–Dec
    // After mid-September, show spring
    if (month > 8 || (month === 8 && day >= 23)) {
        semester = `Spring ${schoolYearEnd}`;  // e.g., Spring 2026
    } else {
        semester = `Fall ${schoolYearEnd}`;    // e.g., Fall 2025
    }
    
}

async function scrollAndSelectYear() {
    const SCROLL_STEP = 200;
    const DELAY = 100;

    // Getting current year
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    // School year cutoff logic
    const startYear = month < 2 ? currentYear - 1 : currentYear; // if now < March, startYear = lastYear, else startYear = thisYear
    const targetText = `${startYear}-${startYear+1}`; // e.g. targetText = 2025-2026

    let previousScrollTop = -1;

    const scrollContainer = document.querySelector('.ReactVirtualized__Grid.ReactVirtualized__List');
    // Error where scroll container not found
    if (!scrollContainer) {
        console.error("Scroll container not found.");
        return;
    }

    while (true){
        const options = [...scrollContainer.querySelectorAll('[data-automation-id="promptOption"]')];
        const match = options.find(el => el.textContent.includes(targetText));
        if (match) {
            match.click();
            return;
        }

        if (scrollContainer.scrollTop === previousScrollTop) {
        console.warn(`Reached end of list, "${targetText}" not found.`);
        return;
        }

        
        previousScrollTop = scrollContainer.scrollTop;
        scrollContainer.scrollTop += SCROLL_STEP;
        await sleep(DELAY);
    }
}

scrollAndSelectYear();

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
