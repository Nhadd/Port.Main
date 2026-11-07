# Leonard Dacpano — Developer Portfolio

A responsive portfolio built with HTML, CSS, and vanilla JavaScript. It preserves the original photographs, project screenshots, CV, contact details, and four public page routes. No framework or runtime package installation is required.

GitHub Pages target: https://nhadd.github.io/Port.Main/

## Run locally

Use Node.js 22 or newer from the project directory:

```sh
npm run dev
```

Portfolio: http://127.0.0.1:4173/Port.Main/

Admin: http://127.0.0.1:4173/Port.Main/admin.html

Use `npm.cmd` on Windows if PowerShell blocks `npm.ps1`. Stop the terminal server with Ctrl+C. The public HTML remains readable directly from disk; the HTTP server is required for JavaScript modules and administration.

## Validate and build

```sh
npm ci
npm run check
npm run build
npm test
npm run preview
```

The checks cover five HTML pages and 118 case-sensitive local references, fragments, basic markup structure, image attributes, form labels, and JavaScript syntax. The 21 tests also cover original asset integrity, contact outcomes, storage failure, safe content serialization, owner authorization, password email requests, conflicting saves, and an editor DOM workflow.

LinkeDOM is a development-only dependency for DOM tests. The check, build, and preview tools use Node's standard library. `dist/` contains only deployable HTML and assets. The build tool only replaces its own marked output directory.

## Owner editor

Click the header lock button, the footer lock, or open `admin.html`. The owner username is **nhaddacpano00@gmail.com**. Use the password created privately in Firebase. No password, refresh token, or session token is stored in this repository. If needed, enter the email and click **Set or reset password** to request Firebase's password email.

The editor supports all four public pages. Click text to edit in place; use the sidebar for images, image descriptions, links, CV destinations, input hints, page titles/descriptions, project categories, and accent colors. Projects, journal cards, skill groups, and journey entries can be added, duplicated, reordered, and removed. The four page routes remain fixed; adding a journal card does not create another page route.

Preview draft before publishing. Device drafts and JSON exports provide recovery. Discard page edits restores the latest published snapshot. Publishing saves content to Firebase, so it does not commit or push GitHub. Changes appear on new page visits. Concurrent saves use ETags and revision checks; newer edits made during a save stay in the draft. Sessions remain in memory for at most an hour; reloading the admin page requires signing in again.

Images can use HTTPS URLs, existing relative paths, or PNG/JPEG/WebP/GIF uploads under 300 KB. The total saved content limit is 1 MB. Use hosted URLs for larger images or replacement CV documents. All recovered image and CV files remain unchanged.

## Activated Firebase backend

- Project: `leonard-dacpano-portfolio`
- Web app: `1:599816665472:web:e4eaea5de7ac9238192965`
- Database: `https://leonard-dacpano-portfolio-default-rtdb.asia-southeast1.firebasedatabase.app`
- Database region: Singapore (`asia-southeast1`)
- Provider: Email/Password
- Owner UID: `mplk1JMenjfCgSix8rhe3Zourpu2`

The Firebase project was created on the signed-in owner's account. The backend is active, public content is seeded, and real owner login and publishing were verified. Anonymous and non-admin content writes, private root reads, and client admin enrollment were tested and rejected. Temporary test accounts were removed. See `firebase/README.md` for maintenance.

Authorization is enforced by the database rules against the owner UID. Hiding the editor is not the access control. Public identifiers in `assets/content-store.js` are configuration, not passwords. Content snapshots cannot modify that configuration or the backend rules. No public signup UI is provided.

## GitHub Pages

All internal page, module, and asset paths are relative, and `.nojekyll` is included. Both the source root and the contents of `dist/` work under `/Port.Main/`. Canonical/social URLs use the production target. The original blog routes and CV path are preserved.

The recovered directory is a ZIP extraction with no `.git` directory. All 22 original files matched the public repository tree at recovery. The public repository reports default branch `main` and Pages enabled; its recorded deployment uses the target above. Exact authenticated Pages settings and direct live-site HTTP access were unavailable during the original audit.

Nothing has been pushed to GitHub or deployed to GitHub Pages. When authorized, review these files in a real checkout first. For branch-based Pages, the site is ready at `main` / `(root)`; an existing Actions deployment may instead upload `dist/`. The Firebase configuration deliberately contains no Hosting section: backend maintenance must not deploy a second copy of the website.

## Services and content accuracy

The original Formspree contact action is retained. Messages only clear after an accepted response; failures retain the text and offer direct email. No real contact message was sent during verification. Live delivery remains unverified.

The original shared-likes database is separate from the new editing backend. It denied reads during recovery, so hearts fall back to labelled device-local storage. No rules or data in that old project were changed.

The “E-commerce Website” card was corrected to Joy Mini Grocery based on its actual desktop interface. Unsupported payment, checkout, grade, and attendance claims were removed. No employment dates, current year level, graduation date, qualifications, or project metrics were invented. The unchanged CV retains its original education wording and should be reviewed before use. Supplied social profile URLs were retained; signed-in account availability was not independently confirmed.

If the editing backend is unavailable or its content is invalid, the complete bundled static portfolio remains the public fallback. Export important changes: database edits do not rewrite the HTML source files.


## GitHub Actions deployment review

The repository is `Nhadd/Port.Main`; this application lives in `PORT/` inside it.
The reviewed workflow is at repository-root `.github/workflows/deploy-pages.yml`
and builds, tests, checks, and uploads only `PORT/dist/`. Run `npm run check:pages`
after building to validate the production URL and asset graph. See repository-root
`DEPLOYMENT-INSTRUCTIONS.txt` for review, commit, push, and Pages source settings.
No Firebase deployment is run by this workflow.
