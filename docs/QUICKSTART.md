# Quickstart

## Requirements

- **Operating system:** Windows includes the `setup_and_run.bat` launcher. On macOS and Linux, use the npm commands below.
- **Node.js:** `24.11.1`
- **npm:** `11.6.2`
- **Local services:** None. VyDex does not require a backend, database, CMS, or external content service.
- **API keys or model providers:** None.
- **Public site origin:** Static builds require a root-only HTTPS `PUBLIC_SITE_ORIGIN` so the Dataset Schema can use its absolute canonical URL.
- **Hardware:** No special hardware is required. Browser testing downloads a local Chromium build and requires additional disk space.

## Git commands

Run these commands from the repository root, which is the folder containing `package.json`.

Clone the repository:

```powershell
git clone https://github.com/Vyce101/VyDex.git
cd VyDex
```

Pull later changes without creating a merge commit:

```powershell
git pull --ff-only
```

On Windows, `update.bat` performs this fast-forward update and stops before fetching if local changes are present.

## Install

Install exactly the dependency versions recorded in the root lockfile:

```powershell
npm ci
```

## Configure static builds

For local build verification, use the reserved example origin. In PowerShell:

```powershell
$env:PUBLIC_SITE_ORIGIN = "https://vydex.example"
```

On macOS or Linux:

```bash
export PUBLIC_SITE_ORIGIN="https://vydex.example"
```

Set the real root-only HTTPS origin in the production build environment when deployment is configured. Do not add a path, query, fragment, username, or password.

## Run VyDex

Start the local Astro application:

```powershell
npm run dev
```

Open `http://127.0.0.1:4321/` in your browser.

On Windows, you can run `setup_and_run.bat` instead. It installs dependencies when needed, starts Astro, waits for the page to respond, and opens it in your browser.

## Verify the installation

Run type checking, unit tests, and the static production build:

```powershell
npm run typecheck
npm test
npm run build
```

Install Chromium once, then run the responsive browser and accessibility tests:

```powershell
npm run test:browser:install
npm run test:browser
```

The browser-test command supplies `https://vydex.example` for its isolated static build, so it does not use a production hostname.

## Downloading the latest installation

1. Open the [VyDex repository](https://github.com/Vyce101/VyDex).
2. Select **Code**, then **Download ZIP**.
3. Unzip the downloaded archive.
4. On Windows, run `setup_and_run.bat`. On macOS or Linux, open a terminal in the extracted folder, then run the install and run commands above.
