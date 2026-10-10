# MicroEmulator browser experiment

Separate browser experiment using MicroEmulator 2.0.4 and CheerpJ 4.3. It does not replace the existing FreeJ2ME deployment. Select a local JAR or run the included probe MIDlet. JAR bytes are kept in the browser; the server does not receive them. RMS is stored in the browser's CheerpJ filesystem, separate from FreeJ2ME.

The restricted WebSocket/TCP and HTTP gateway accepts only approved Ngoc Rong endpoints, including Universe 15. No credentials or packet contents are logged. This gateway is not an arbitrary network proxy.

Desktop printable keys inside the emulator display are sent as text to the focused Java ME editor, avoiding keypad mappings for characters such as `@`. Canvas games without a focused text editor still receive key events. Arrow keys, commands and the separate HTML input dialog retain their existing behavior. Select another JAR from the button above the display; this resets the current runtime. Mobile keyboard composition has not been verified.

Build with `python3 build.py` (JDK 17+) and run `npm ci && npm start`. Docker builds the Java bridge automatically. For Render, use a separate Free Docker Web Service, health path `/healthz`, and manual deploys. Free usage is shared across the Render workspace.

MicroEmulator artifacts and matching source are downloaded from Maven Central. The original main JAR SHA256 is `dbd5f3eb8365d3e839d6a203149e0e3776fc1a0585e16ac1fc23f76c9fcae1c6`, matching the user-supplied ZIP. MicroEmulator source offers Apache-2.0 or LGPL-2.1-or-later licensing. Its original sources and the modified ConnectorImpl are distributed under `web/source`; the build script documents modifications. The gateway and glue follow the included GPL-3.0 license. CheerpJ is vendor-hosted and subject to its separate non-commercial license.

Compatibility with a particular game must be verified in the browser. Bluetooth, UDP and unrestricted hosts are not provided. This project does not bundle proprietary game JARs.
