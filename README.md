# Citizens Incident Reporter Mobile App

Citizens Incident Reporter is a hybrid mobile application built with Apache Cordova, HTML5, CSS3, and JavaScript. It provides a real-time platform for citizens to report eyewitness incidents such as accidents, fighting, rioting, and robberies, with accurate device GPS coordinates and photographic evidence.

The frontend is styled in a clean, high-contrast black high-contrast dark chronological timeline format. The application is integrated with a live FastAPI backend running PostgreSQL on Render.

---

## What was Built

The application was built from the ground up to satisfy all mobile hybrid requirements while remaining fast, lightweight, and responsive across mobile devices and web browsers.

### Key Capabilities

1. Community Timeline Feed
   - Incidents are displayed in chronological order using an intuitive social timeline format.
   - Each card displays the author's initials avatar, display name, handle, relative timestamp, category badge, report title, description, and an interactive coordinate pill that opens Google Maps.
   - Instant live search filters feed items by keywords across titles, descriptions, categories, and author handles.
   - Quick horizontal category chips allow users to switch between All, Accident, Fighting, Rioting, Robbery, and Other.

2. Real Device GPS Telemetry
   - The application accesses the device's location services via navigator.geolocation and cordova-plugin-geolocation.
   - It utilizes a resilient two-tier resolution strategy: it first requests high-accuracy satellite GPS. If indoors or if satellite acquisition takes too long, it immediately falls back to network and Wi-Fi positioning.
   - Captured coordinates (latitude and longitude) are displayed to six decimal places, stored in the form inputs, and transmitted with report submissions.
   - Manual coordinate entry is available as an alternative when location permissions are denied.

3. Photographic Evidence Capture
   - Integrated with cordova-plugin-camera for mobile devices.
   - Users can take a live photo using the device camera or select an existing photo from their gallery.
   - When running in a browser or simulator, a clean file picker handles image selection without leaving unstyled elements on the screen.
   - The selected image is converted to Base64 (data:image/jpeg;base64,...), rendered in a contained preview box with Retake and Remove actions, and transmitted to the backend.

4. User Authentication and Anonymous Submissions
   - Dedicated, separate screens for Sign In and Register within the profile modal.
   - Registration creates a new citizen account with username validation and password confirmation.
   - Logged-in users have their incident submissions associated with their account and can track them using the "My Reports" feed filter.
   - Anonymous reporting is fully supported. Citizens do not need an account to report an emergency or incident; unauthenticated submissions are saved as Anonymous.
   - Once logged in, tapping the Profile tab or header avatar displays the user's report stats and a direct Log Out button.

5. Background Polling and Notifications
   - The app polls the backend every 60 seconds for newly submitted community reports.
   - When a new incident appears that has not been cached locally, the app triggers a local device notification via cordova-plugin-local-notification and displays an in-app banner alert.

---

## Backend Architecture (FastAPI and PostgreSQL)

The mobile application communicates with a production FastAPI backend hosted on Render, backed by a PostgreSQL database.

- Base URL: https://citizenapi.onrender.com
- CORS: Configured on the backend to allow requests originating from Cordova WebView origins (file://, http://localhost, and https://localhost).
- Cold Start Resilience: Because Render free-tier web services spin down after inactivity, initial requests may take 20 to 30 seconds to wake the server. The mobile app implements local storage caching (CITIZEN_CACHED_INCIDENTS_V3) and a 30-second request timeout, ensuring cached reports display instantly while the server spins up.

### API Endpoints

1. User Registration
   - Method: POST
   - Path: /auth/register
   - Request Body:
     ```json
     {
       "username": "adebayo",
       "password": "mypassword"
     }
     ```
   - Response (201):
     ```json
     {
       "token": "jwt_token_here",
       "username": "adebayo",
       "id": 1
     }
     ```

2. User Login
   - Method: POST
   - Path: /auth/login
   - Request Body:
     ```json
     {
       "username": "adebayo",
       "password": "mypassword"
     }
     ```
   - Response (200):
     ```json
     {
       "token": "jwt_token_here",
       "username": "adebayo",
       "id": 1
     }
     ```
   - If the user account does not exist on the server, the login endpoint automatically creates the account and returns a valid session token.

3. Authenticated User Profile
   - Method: GET
   - Path: /auth/me
   - Header: Authorization: Bearer <token>
   - Response (200):
     ```json
     {
       "id": 1,
       "username": "adebayo",
       "created_at": "2026-11-02T10:00:00Z",
       "reports_count": 4
     }
     ```

4. Community Incident Feed
   - Method: GET
   - Path: /incidents?category=<category>
   - Query Parameters: category (optional, defaults to "All"). Supported categories include All, Accident, Fighting, Rioting, Robbery, and Other.
   - Response (200): Array of incident objects sorted newest first.
     ```json
     [
       {
         "id": 1,
         "title": "Two-vehicle collision on highway",
         "category": "Accident",
         "description": "Commercial bus and saloon car collided near junction.",
         "latitude": 6.5244,
         "longitude": 3.3792,
         "photo_base64": "data:image/jpeg;base64,...",
         "created_at": "2026-11-02T10:00:00Z",
         "author_username": "LagosWatch"
       }
     ]
     ```

5. Personal Reports (My Reports)
   - Method: GET
   - Path: /incidents/me
   - Header: Authorization: Bearer <token>
   - Response (200): Array of incident reports submitted specifically by the authenticated user.

6. Submit Incident Report
   - Method: POST
   - Path: /incidents
   - Header: Authorization: Bearer <token> (optional; omitted when submitting anonymously)
   - Request Body:
     ```json
     {
       "title": "Incident title",
       "category": "Accident",
       "description": "Detailed eyewitness description...",
       "latitude": 6.5244,
       "longitude": 3.3792,
       "photo_base64": "data:image/jpeg;base64,..."
     }
     ```
   - Response (201): Returns the newly created incident record with assigned ID.

---

## File Structure

```text
app/
|-- config.xml                 Cordova configuration, permissions, and plugin registry
|-- package.json               Dependencies and Cordova platform configuration
|-- www/                       Core web application directory
|   |-- index.html             Single-page HTML layout
|   |-- css/
|   |   `-- style.css          Stylesheet (pure black theme, responsive card layouts)
|   `-- js/
|       |-- api.js             FastAPI service module, token and cache manager
|       `-- app.js             Controller, hardware bridges, feed and auth logic
|-- platforms/
|   |-- android/               Generated Android project
|   `-- browser/               Generated browser platform
`-- README.md                  Project documentation
```

---

## How to Run the Code

### Prerequisites

Ensure you have the following installed on your machine:
- Node.js (version 18 or newer recommended)
- npm (installed with Node.js)
- Apache Cordova CLI (installed globally or run via npx)

To install Cordova globally:
```bash
npm install -g cordova
```

If you intend to build the Android APK, you will also need:
- Java Development Kit (JDK 17 or 21)
- Android SDK (command-line tools, platform-tools, Android SDK Platform 34)
- Gradle (handled automatically by Cordova)

---

### Option 1: Running in a Web Browser (Quickest Way to Test)

You can run the app directly in your browser using Cordova's browser platform or any local web server.

Method A: Using Cordova CLI
```bash
# From the project root folder:
npx cordova run browser
```
This prepares all web assets and starts a local development server, automatically opening your default web browser.

Method B: Using a Static Web Server
Because the app is built with standard web technologies, you can also serve the `www/` folder with any HTTP server:
```bash
# Using Node's serve utility:
npx serve www

# Or using Python:
python -m http.server 8000 --directory www
```
Then open `http://localhost:8000` or `http://localhost:3000` in your browser.

---

### Option 2: Building and Running the Android APK

1. Verify Android and Java environment variables:
   ```bash
   # In PowerShell (adjust paths to your machine if needed):
   $env:ANDROID_HOME = "C:\Users\<YourUser>\AppData\Local\Android\Sdk"
   $env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.7.6-hotspot"
   ```

2. Synchronize web assets with native platform folders:
   ```bash
   npx cordova prepare android
   ```

3. Build the debug APK:
   ```bash
   npx cordova build android
   ```
   Upon successful compilation, the generated APK file is located at:
   `platforms/android/app/build/outputs/apk/debug/app-debug.apk`

4. Run on a connected Android phone or emulator:
   ```bash
   # Ensure adb detects your device:
   adb devices

   # Deploy and run:
   npx cordova run android
   ```

---

## Testing Workflow Summary

1. Community Feed: Open the app. The feed will load existing reports from the FastAPI backend. You can filter by category chip (All, Accident, Fighting, etc.) or search in real time.
2. Incident Reporting: Tap the center "+ Report" button in the bottom dock. Enter a title, choose a category, write a description, capture or attach a photo, and tap "Acquire Device GPS Fix" (or "Update GPS") to lock your real phone coordinates. Tap "Transmit Incident Report" to submit.
3. Anonymous vs. Authenticated: You can submit immediately as a guest. Alternatively, tap the Profile icon or tab to register a new account or sign in with an existing one. Once signed in, you can filter the timeline to view only your submitted reports.
4. Logging Out: Tap the Profile icon or the Profile tab in the bottom dock, then tap the red "Log Out" button to clear your session.
