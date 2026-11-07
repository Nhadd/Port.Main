# Portfolio backend maintenance

The Firebase backend is activated for `leonard-dacpano-portfolio` on the owner's account. Email/password login and database rules have deployed successfully. All four public pages are seeded in Singapore Realtime Database. The real owner signed in privately and a publish of the unchanged content was verified.

Owner email: `nhaddacpano00@gmail.com`

Owner UID: `mplk1JMenjfCgSix8rhe3Zourpu2`

Database URL: `https://leonard-dacpano-portfolio-default-rtdb.asia-southeast1.firebasedatabase.app`

The password was entered privately by the owner in Firebase. It is not in source files, setup logs, or content exports. The login's Set or reset password button uses Firebase's password email flow; its requests are only sent when the user clicks it.

## Access model

`firebase/database.rules.json` is the complete, authoritative ruleset for this new project. Root access is closed. Anyone may read the published portfolio snapshot at `portfolioContent/site`. Only a valid Firebase Authentication token belonging to the exact owner UID may write it. Client writes to the legacy-compatible `portfolioAdmins` branch are denied; that branch does not grant editing access in this configuration.

The source also checks the owner UID before showing the editor. Backend rules independently enforce it. A modified browser UI cannot grant database access. Content payloads cannot edit the owner UID, API configuration, or rules.

Published records contain a schema version, monotonically increasing revision, server timestamp, and bounded JSON payload. Conditional ETag writes protect against conflicting sessions. The renderer validates supported elements and attributes, URLs, required page controls, IDs, and size limits before displaying saved content.

## Maintenance commands

The root `.firebaserc` selects this project; `firebase.json` configures only Authentication and Realtime Database. It contains no website Hosting deployment.

After reviewing a backend configuration change, deploy only the intended services:

```sh
npx -y firebase-tools@latest deploy --only auth,database --project leonard-dacpano-portfolio
```

Sign in to the CLI through its normal authentication flow. Keep credential files outside the repository. Do not copy passwords or tokens into this project. Updating the website on GitHub Pages remains a separate, owner-authorized action.

Changing the owner requires creating the intended Firebase user, then updating both `ownerUid` in `assets/content-store.js` and the server rule in `firebase/database.rules.json`. Deploy the reviewed rules and distribute the updated frontend together. An email-only match does not replace the UID check.

## Verification

The local suite has 21 passing tests. Real cloud checks additionally verified public snapshot reads, denied private root reads, denied anonymous and authenticated non-admin content writes, denied client admin enrollment, and rejection of non-admin editor sign-in. Temporary test users were deleted. The real owner login and publishing succeeded; the saved content matched the initial source snapshot exactly after publishing.

The Java-based rules emulator was unavailable; these authorization checks ran against the actual new database. Contact form and password-reset email delivery were not tested by sending real messages.

## Backups and limits

Use the editor's JSON export for a content backup. Device drafts are optional browser-local recovery, not a cross-device backup. The bundled HTML remains the fallback when Firebase is unavailable. Database edits do not rewrite repository files.

The existing limits are 300 KB per inline raster image and 1 MB for the total content payload. Use hosted image or document URLs for larger assets. The original CV and recovered media are preserved byte for byte.

Official references: [password authentication and password email requests](https://firebase.google.com/docs/reference/rest/auth), [authenticated REST requests](https://firebase.google.com/docs/database/rest/auth), [conditional database writes](https://firebase.google.com/docs/database/rest/save-data), [database security rules](https://firebase.google.com/docs/database/security/core-syntax).
