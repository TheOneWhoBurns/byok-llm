# Releasing

Releases follow [Semantic Versioning](https://semver.org) and every user-visible change is recorded in [CHANGELOG.md](./CHANGELOG.md) under "Unreleased" as it lands.

## Cutting a release

The commands below use `1.1.0`, the next planned release; replace it with the version being released.

1. Start from an up-to-date, clean `main` with green CI.

   ```bash
   git checkout main && git pull --ff-only
   npm ci
   ```

2. In `CHANGELOG.md`, rename the "Unreleased" heading to `## [1.1.0] - YYYY-MM-DD`, add a fresh empty "Unreleased" section above it, and update the link references at the bottom of the file. In `README.md`, update the "Status" note and remove the "In 1.0.0 ..." notes that the release makes obsolete. Commit:

   ```bash
   git commit -am "docs: prepare 1.1.0"
   ```

3. Bump the version. This edits `package.json` and `package-lock.json`, commits, and creates the tag `v1.1.0`.

   ```bash
   npm version 1.1.0 -m "chore(release): %s"
   ```

4. Check what will be published.

   ```bash
   npm pack --dry-run
   ```

   The tarball should contain `LICENSE`, `README.md`, `package.json` and six files under `dist/`.

5. Push the commit and the tag.

   ```bash
   git push origin main --follow-tags
   ```

6. Publish. `prepublishOnly` runs lint, typecheck, the tests and the build first.

   ```bash
   npm login
   npm publish
   ```

7. Create the GitHub release from the tag, using the changelog section as the notes.

   ```bash
   gh release create v1.1.0 --title "v1.1.0" --notes "See CHANGELOG.md for details."
   ```

## Publishing from CI instead (optional, not yet enabled)

`.github/workflows/release.yml` can publish to npm when a GitHub release is published, using npm [trusted publishing](https://docs.npmjs.com/trusted-publishers). That needs no npm token and attaches a provenance attestation to the package. The workflow is dormant and has never run. To enable it:

1. On npmjs.com, open the `byok-llm` package settings and add a trusted publisher: GitHub Actions, user `TheOneWhoBurns`, repository `byok-llm`, workflow filename `release.yml`.
2. In the GitHub repository, set the Actions variable `NPM_PUBLISH_ENABLED` to `true`.

With that in place, skip step 6 above: step 7 triggers the publish. The workflow refuses to publish if the release tag does not match the version in `package.json`.

## About 1.0.0

1.0.0 was published to npm on 2026-03-25 from a working tree that was committed afterwards. The tag `v1.0.0` points at that commit: running `npm pack` there reproduces the published tarball exactly (shasum `a7374405b955fc656a0ca1e8720e3cfcad60266c`). The `gitHead` npm recorded for 1.0.0 is the parent of the tagged commit.
