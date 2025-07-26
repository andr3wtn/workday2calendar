# Workday2Calendar
Export your Workday class schedule into Google Calendar or your local calendar in seconds.

## Features
Upload your Workday Excel export, which can be downloaded as an .xlsx file from Workday.

Preview extracted events & validate course name, time, date, and location before finalizing.

**Two export options:**

1. Direct Google Calendar export via Google login.

2. _ICS file download (coming soon)._

## How It Works
1. In Workday, go to your “Current Classes” page
   
3. Click Export to Excel to download your schedule
   
5. Upload the .xlsx file using the interface
   
7. Click Extract Calendar Info to generate the events table

8. Review all event entries

9. Choose:

  Sign in with Google → Export to push events directly to Google Calendar.

  OR Download ICS File for manual import.

## Notes
Course titles are truncated to 50 characters, due to Google Calendar limitations—editable in-app.
Data is processed locally in your browser; we do not store or transmit your schedule data.
This tool is not affiliated with WashU or Google.
More information can be found in the [policy page](https://andr3wtn.github.io/workday2calendar/policy.html)

## Development
Built as a simple static site using HTML, JavaScript & Tailwind CSS.
