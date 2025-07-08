async function automateCourseFilters(semester) {
    const dropdowns = document.querySelectorAll('[data-automation-id="multiselectInputContainer"]');
   
    // Start Day Within element
    const start_day_within = dropdowns[0];
    const input = start_day_within.querySelector('input');
    start_day_within.click();
    
    // input.value = "08/25/2025";
    // input.dispatchEvent(new Event('blur', { bubbles: true }));
    // input.dispatchEvent(new KeyboardEvent('keydown', {
    //     key: 'Enter',
    //     keyCode: 13,
    //     which: 13,
    //     bubbles: true,
    //     cancelable: true
    // }));

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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
