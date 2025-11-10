# MAX Productivity Bot

A chatbot and mini-application for the MAX messenger that allows universities and organizations to share event schedules. Students and employees can accept invitations and receive automatic reminders before their events. The solution is optimized for mock and production integrations with the MAX developer platform.

## UX Flow

1. User opens the chat.  
2. Bot greets and offers options: `[View Events]` `[Accept Invitation]` `[Set Reminder]`.  
3. User selects “View Events” → receives a list of upcoming events.  
4. User accepts invitation → bot confirms and adds event to reminder list.  
5. Bot sends reminders before each accepted event.

Detailed interaction steps are also captured in [`UX_FLOW.md`](UX_FLOW.md).

## Setup Instructions

- Install dependencies: `npm install`
- Run locally in development mode (with nodemon): `npm run dev`
- Run locally in production mode: `npm start`
- Execute demo script: `npm test`
- Docker build and run: `docker compose up --build`
- Access the HTTP API via: [http://localhost:3000](http://localhost:3000)

> **Note:** The Docker image now installs `python3`, `make`, and `g++` so native dependencies (like `sqlite3`) compile reliably on Alpine. No additional host tooling is required.

## Example `.env`

```
PORT=3000
DB_URL=sqlite:./src/db/database.sqlite
MAX_BOT_TOKEN=your_max_bot_token
MAX_WEBHOOK_URL=https://your-ngrok-url/webhook
USE_MOCK_MAX_API=true
ORG_NAME=Tech University
REMINDER_LEAD_MINUTES=30
TIMEZONE=Europe/Moscow
API_TIMEOUT_MS=5000
```

Additional optional variables:

- `DATA_SOURCE_PATH` — absolute or relative path to a JSON file with events.
- `NODE_ENV` — defaults to `development`.

## Personas

- **Anna (student)**: uses the bot to receive course and exam reminders.
- **Sergey (IT specialist)**: publishes university or corporate event timelines.
- **Elena (manager)**: receives reminders about business meetings and project calls.

## Architecture Overview

- **Bot core (`src/bot/botLogic.js`)** — parses commands, orchestrates responses, logs analytics events.
- **Reminders (`src/bot/reminders.js`)** — schedules and dispatches pre-event notifications through MAX API.
- **Data layer (`src/bot/dataSource.js` + Sequelize models)** — manages event catalogs, user subscriptions, and message history.
- **API layer (`src/routes/api.js`)** — Express endpoints for events, subscriptions, manual chat commands, and MAX webhooks.
- **Scheduler (`src/utils/scheduler.js`)** — cron-based job that scans upcoming events and triggers reminders every five minutes.
- **MAX adapter (`src/bot/maxPlatformAdapter.js`)** — encapsulates outbound/inbound calls with live or mock MAX endpoints.

## Continuous Deployment (GitHub → MAX)

The repository ships with `.github/workflows/deploy.yml`, which:

1. Runs on every push to `main` (or manually from the Actions tab).
2. Installs dependencies, executes linting (`npm run lint`), and the mock demo test (`npm test`).
3. Builds the Docker image to ensure the container starts cleanly.
4. Packages the artefacts into `deployment_bundle.tar.gz` and POSTs it to the MAX deployment endpoint.

To activate the workflow, add the following repository secrets in GitHub → Settings → Secrets and variables → Actions:

| Secret | Description |
| --- | --- |
| `MAX_DEPLOY_URL` | HTTPS endpoint provided by MAX for automated deployments. |
| `MAX_APP_ID` | The application identifier from the MAX developer console. |
| `MAX_DEPLOY_TOKEN` | Bearer token with publish permissions for the app. |

Once the secrets are configured, any merge to `main` will automatically push the new bundle to MAX and the workflow log will display the API response from the platform.

## Compliance

The project follows the [MAX developer rules](https://dev.max.ru/docs/legal/rules): credentials are loaded through environment variables, outbound requests validate HTTP responses, and GDPR-friendly logging avoids storing sensitive content.

## Contributing

1. Fork and clone the repository.
2. Create a feature branch: `git checkout -b feature/my-update`.
3. Commit your changes: `git commit -am "Add feature"`.
4. Push to the branch and open a Pull Request.

For production deployments, remember to disable mock mode (`USE_MOCK_MAX_API=false`) and provide a managed PostgreSQL connection string in `DB_URL`.
