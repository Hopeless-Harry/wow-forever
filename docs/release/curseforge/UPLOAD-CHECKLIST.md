# CurseForge upload checklist

Nothing has been uploaded. These are the steps for the project owner, in order. The package, description, summary and changelog are ready in this folder and in `tester-releases`.

## Before uploading

- [ ] **Confirm the licence.** `addons/MAMChronicles/LICENSE.txt` is now "All Rights Reserved with personal, non-commercial use permitted". The earlier text was for private guild testing only and did not allow public distribution. Change it if you want something else (for example an open-source licence) before you upload.
- [ ] Confirm the addon name you want on CurseForge (suggested: **Moms Against Magic Chronicles**).
- [ ] Take fresh screenshots from the newest build (Home, Medals, Settings, a toast, and one theme). Older screenshots show earlier versions.
- [ ] Run the live checklist at least once on WoW Forever and Retail and note anything that fails.

## Create the project (author dashboard)

- [ ] Project name and URL slug.
- [ ] Summary: paste `SUMMARY.txt` (under 250 characters).
- [ ] Description: paste `PROJECT-DESCRIPTION.md` (Markdown).
- [ ] Category: something like Achievements, Guild, or Miscellaneous.
- [ ] License: choose "All Rights Reserved" (or the licence you picked above).
- [ ] Add the screenshots.

## Upload the file

- [ ] Upload `MAMChronicles-<version>.zip` from the release folder. It contains a single `MAMChronicles` folder with 21 files.
- [ ] Release type: **Alpha**.
- [ ] Game versions: Retail (12.1.x). Also choose WoW Forever if CurseForge lists it; otherwise say so in the description and file notes.
- [ ] Changelog: paste the top section of `CHANGELOG.md`.
- [ ] Dependencies: none.

## After it is approved

- [ ] Download the file from CurseForge and compare its SHA-256 with the value recorded in `PROJECT-HANDOFF.md`.
- [ ] Install that download on both clients and run `/mam diag`.
- [ ] Optionally add `## X-Curse-Project-ID: <id>` to `MAMChronicles.toc` for the next release so the CurseForge client can track updates.

## Not done, and why

- **Upload itself:** it publishes under your account, so it is yours to do.
- **Automatic packaging (`.pkgmeta`, BigWigs packager):** unnecessary for a manual upload of a dependency-free addon.
