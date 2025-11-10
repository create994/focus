# UX Flow — MAX Productivity Bot

## Primary Scenario: Student Receives Class Reminders

1. **Greeting**  
   - The student opens the MAX messenger chat.  
   - The bot detects locale (ru/en) and sends a greeting card with quick replies.

2. **View Events**  
   - The student selects `View Events`.  
   - The bot lists upcoming university lectures and labs, including start time, location, and category.

3. **Accept Invitation**  
   - The student taps on a specific event to accept the invitation or types `Subscribe to category lecture`.  
   - The bot stores the subscription and confirms in chat.

4. **Automatic Reminder**  
   - 30 minutes before the event, the scheduler triggers the reminder service.  
   - The bot sends a structured reminder card containing event title, time, meeting link or location, and quick action to revisit the schedule.

## Secondary Scenario: Corporate Employee

1. HR specialist uploads the internal calendar via an admin interface (future extension) or JSON file.  
2. Employees receive invitations in the MAX chat and subscribe per category (e.g., `meeting`, `workshop`).  
3. Reminders are sent automatically, respecting user locales and preferences.

## Exception Handling

- **MAX API downtime**: adapter falls back to mock responses and logs the incident.  
- **Unknown commands**: bot replies with help text and suggested commands.  
- **Rate limits**: adapter retries with exponential back-off (future enhancement) and records diagnostics.

This flow aligns with UX research for students, employees, and IT specialists who require proactive, reliable notifications.

