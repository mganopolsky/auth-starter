# ADR 0001: Google Drive scope

Status: accepted for proof-of-concept use. Revisit before a public launch.

## Question
Can the app list and read the files in a folder the user picked, using only the non-sensitive `drive.file` scope?

## Evidence
Tested live (issue #10, matrix test A) with a folder containing four files that were added through the Drive web UI:

| Scope | Folder picked in the Picker | `files.list` on that folder |
|-------|-----------------------------|-----------------------------|
| `drive.file` | Yes, saved | HTTP 200, zero files |
| `drive.readonly` | Yes, saved | HTTP 200, all four files |

`drive.file` gives the app access to the picked folder itself, not to the files inside it.

## Decision
Request `drive.readonly` (read-only, restricted scope). The agent use case needs to read every file in a chosen folder, and the app never needs to write.

The scope lives in one constant (`DRIVE_SCOPE` in `src/lib/drive/oauth.ts`), so changing it is a code change plus a reconnect for existing users.

## Consequences
Facts from Google's OAuth verification FAQ (https://support.google.com/cloud/answer/13463817):
- Restricted scopes require app verification (Google estimates about 6 weeks, not guaranteed).
- They also require a security assessment, repeated every year. Google does not charge for it; the cost is agreed with an independent assessor and is not known yet.
- An unverified app using restricted or sensitive scopes is capped at 100 new users for the lifetime of the Google Cloud project. The cap cannot be reset.

Practical rules that follow:
- Use one Google Cloud project per app, so one app's testers do not use up another app's 100 users.
- Keep proof-of-concept apps within the 100 testers. Remove nothing from the tester list expecting to free a slot.
- Get a quote from an assessor before committing to a public launch.

## Alternatives not built
- **File-level selection on `drive.file`:** users pick individual files in the Picker and the app lists those. No review needed and scales without a cap, but the app does not see files added to the folder later.
- **Hybrid:** start with `drive.readonly` for the proof of concept, add the file-level mode on `drive.file` if verification is not worth the cost.

## Not yet tested
Matrix tests B (file added after picking), C (subfolder), D and E (second user cannot see the first user's folder) from issue #10.
