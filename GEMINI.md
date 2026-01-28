# Personal Schedule Manager (my-scheduler)

## Project Overview

**Personal Schedule Manager** is a full-stack web application designed for individual schedule and task management. It features a secure user authentication system, interactive calendar views, a to-do list with time specifics, and integration with external iCal feeds. The application is built to be responsive and supports multiple languages (Korean/English).

### Key Technologies

*   **Frontend:**
    *   **Framework:** React 19 (via Vite)
    *   **Styling:** Tailwind CSS v4
    *   **Calendar Component:** FullCalendar v6
    *   **State Management:** React Hooks (`useState`, `useEffect`) & LocalStorage
*   **Backend:**
    *   **Runtime:** Node.js
    *   **Framework:** Express.js
    *   **Database:** SQLite3 (File-based: `server/schedule.db`)
    *   **Authentication:** JWT (JSON Web Tokens) & bcryptjs

## Building and Running

### Prerequisites
*   Node.js (and npm)
*   Bash shell (for installation script)

### Setup
The project includes a convenience script to handle dependency installation and initial setup.

```bash
# From the project root
./install_scheduler.sh
```

### Running the Application
To start both the backend server and the frontend development server concurrently:

```bash
# From the project root
npm start
```

*   **Frontend Access:** [http://localhost:5173](http://localhost:5173)
*   **Backend Port:** Defaults to port 3000 (implied from typical Express setups, check `server/server.js` to confirm)

### Individual Sub-project Commands

*   **Client (`client/`):**
    *   `npm run dev` or `npm run client`: Start the Vite dev server.
    *   `npm run build`: Build for production.
    *   `npm run lint`: Run ESLint.
*   **Server (`server/`):**
    *   `npm run server`: Start the Express server (`node server.js`).

## Development Conventions

*   **Project Structure:** Monorepo-style structure with separate `client` and `server` directories.
*   **Database:** SQLite is used for simplicity. The database file is located at `server/schedule.db`.
    *   **Tables:** `users`, `events`, `external_calendars`.
*   **Styling:** Tailwind CSS is used for all styling.
*   **Authentication:** JWT-based. Tokens are likely stored in the client (LocalStorage/Cookies) to maintain sessions.
*   **Internationalization:** Supported via simple state/LocalStorage toggling (Korean/English).

## Directory Structure & Key Files

*   **Root**
    *   `package.json`: Manages root scripts (like `start`) and dev dependencies (like `concurrently`).
    *   `install_scheduler.sh`: Setup script.
    *   `PROJECT_README.md`: Main project documentation.

*   **`client/` (Frontend)**
    *   `vite.config.js`: Vite configuration.
    *   `tailwind.config.js` / `postcss.config.js`: CSS framework configuration.
    *   `src/App.jsx`: Main application component.
    *   `src/main.jsx`: Entry point.

*   **`server/` (Backend)**
    *   `server.js`: Main server entry point (API routes, DB connection, middleware).
    *   `schedule.db`: SQLite database file.
