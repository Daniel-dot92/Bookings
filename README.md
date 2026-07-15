# DM PHYSIO Booking App

Next.js booking flow for DM PHYSIO with:

- online slot booking
- Google Calendar event creation
- Google Sheets logging
- email confirmations
- SMS appointment reminders
- review follow-up by email or SMS

## Local run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

Copy `.env.local.example` to `.env.local` and fill in:

- Google Calendar / Sheets credentials
- SMTP credentials for confirmation and review emails
- Twilio credentials for SMS reminders / SMS reviews
- `CRON_SECRET` for protected cron endpoints

Calendar setup for the two studios:

- `BOOKING_CALENDAR_ID_STUDENTSKI`
  Studentski Grad calendar. If this is omitted, the app falls back to the legacy `BOOKING_CALENDAR_ID`.

- `BOOKING_CALENDAR_ID_MLADOST`
  Mladost 1A calendar.

Spreadsheet setup for the two studios:

- `SHEETS_SPREADSHEET_ID_STUDENTSKI`
  Optional explicit spreadsheet for Studentski Grad. Falls back to `SHEETS_SPREADSHEET_ID`.

- `SHEETS_SPREADSHEET_ID_MLADOST`
  Optional explicit spreadsheet for Mladost 1A. If omitted, Mladost falls back to `SHEETS_SPREADSHEET_ID`.

- `SHEETS_TAB_NAME_STUDENTSKI` / `SHEETS_TAB_NAME_MLADOST`
  Booking tabs per office. Mladost defaults to `Bookings - Mladost 1A`.

- `REVIEW_SMS_SHEET_TAB_STUDENTSKI` / `REVIEW_SMS_SHEET_TAB_MLADOST`
  Name and phone directory tabs per office. Mladost defaults to `Имена и тел - Младост 1А`.

Important reminder / review env vars:

- `REVIEW_DELAY_MINUTES`
  Default: `15`
  Controls how long after the appointment end a review request becomes due.

- `REVIEW_SENT_LOG_TAB_STUDENTSKI` / `REVIEW_SENT_LOG_TAB_MLADOST`
  Optional per-office tabs used to log phone numbers that have already received a review SMS.

- Reminder timing
  No env var is needed for reminder timing.
  The app now sends one reminder at:
  - `09:00` on the same day for appointments starting from `12:00` onward
  - `21:00` on the previous day for morning appointments

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM` or `TWILIO_MESSAGING_SERVICE_SID`
  Required for confirmation, reminder and review SMS.

- `GMAPS_REVIEW_URL`
  Your Google review URL.

- `GMAPS_REVIEW_URL_HRISTO_DANOV`
- `GMAPS_REVIEW_URL_MLADOST`
  Optional per-location review URLs. If omitted, the app falls back to the office-level review link.

- `DM_PHYSIO_ADDRESS`
- `DM_PHYSIO_MAPS_URL`
- `DM_PHYSIO_CONTACT_PHONE`

## Cron endpoints

Vercel runs both every 15 minutes:

- `/api/cron/reminder`
- `/api/cron/review`

They accept one of:

- Vercel cron header
- `Authorization: Bearer <CRON_SECRET>`
- `?secret=<CRON_SECRET>`

## Safe test modes

Test review email:

```bash
curl "http://localhost:3000/api/cron/review?secret=YOUR_SECRET&testEmail=1&testTo=you@example.com&testName=Test"
```

Test review SMS:

```bash
curl "http://localhost:3000/api/cron/review?secret=YOUR_SECRET&testSms=1&testTo=0888123456&testName=Test"
```

Test reminder SMS:

```bash
curl "http://localhost:3000/api/cron/reminder?secret=YOUR_SECRET&testSms=1&testTo=0888123456&testName=Test"
```

Dry run reminder scan:

```bash
curl "http://localhost:3000/api/cron/reminder?secret=YOUR_SECRET&dryRun=1"
```

Dry run review scan:

```bash
curl "http://localhost:3000/api/cron/review?secret=YOUR_SECRET&dryRun=1"
```

## Current behavior

- The booking flow starts with studio selection and only then shows the therapists and free slots for that location.
- Booking rows can now be written per office into separate spreadsheet tabs or separate spreadsheet files.
- The review/name-phone directory can now be maintained separately for each office.
- Website bookings store follow-up metadata in the calendar event.
- Reminder SMS is sent once per event when due.
- Review requests are deduplicated by recipient.
- Website bookings use review email when an email is available.
- Calendar/manual phone-based bookings can receive review SMS when Twilio is configured.
