# FawterX Mandatory Auto-Deploy & Release Rule

> **System Rule:** Whenever any update or bug fix is applied to the codebase, the assistant must automatically perform the following steps:

1. **Verify Build**: Run `npm run build` in `frontend/`.
2. **Version Bump**: Bump patch version in `frontend/package.json` and `frontend/src/App.jsx`.
3. **Rebuild**: Re-run `npm run build` to update `dist/`.
4. **Deploy Firebase**: Deploy to Firebase Hosting (`https://fawterx.web.app`) via `npx firebase-tools deploy --only hosting` in `frontend/`.
5. **Push GitHub / Render**: `git add .`, `git commit -m "v2.14.x: ..."` and `git push origin main`.
6. **Generate English Log**: Output an English Release Log block for user release notes.
