# Update Architecture

Phase 4D adds a signed-release updater for the Bash client. The updater is
separate from the license backend so customers can still update when an older
client has license compatibility problems.

## Trust Model

- Release metadata is published as `release-manifest.json`.
- The manifest is signed outside the repo with an Ed25519 private key.
- The client stores only the public verification key in `keys/update-public.pem`.
- SHA256 verifies the downloaded artifact after the manifest signature is valid.
- The private signing key must live in CI secrets or a secure release machine.

## Manifest

```json
{
  "schemaVersion": 1,
  "version": "4.1.0",
  "channel": "stable",
  "releasedAt": "2026-09-10T00:00:00Z",
  "minimumVersion": "4.0.0",
  "mandatory": false,
  "artifact": {
    "url": "https://downloads.example.com/auto-rejoin/4.1.0.tar.gz",
    "sha256": "64 lowercase hex characters",
    "size": 123456
  },
  "notesUrl": "https://example.com/releases/4.1.0"
}
```

The manifest URL is configured with `AUTO_REJOIN_UPDATE_MANIFEST_URL`. The
signature URL defaults to `<manifest-url>.sig` and can be overridden with
`AUTO_REJOIN_UPDATE_SIGNATURE_URL`. Production URLs must use HTTPS. HTTP is only
accepted when `AUTO_REJOIN_UPDATE_ALLOW_HTTP_DEV=true`.

## Apply Flow

The updater downloads into `tmp/update/job.*`, writes partial files as `.part`,
verifies the signed manifest, validates schema, downloads the artifact, checks
size and SHA256, rejects unsafe archive paths, extracts into staging, runs
`bash -n` self-tests, backs up current code under `tmp/update/backups/`, applies
the release, runs a final self-test, then verifies the installed `VERSION`.

The updater refuses to run while monitor runtime locks are active. It does not
kill Roblox or monitor sessions.

## User Data

Release artifacts must not include `.env`, `config.env`, `config_*.cfg`, `config/`,
`logs/`, `tmp/`, `.git/`, `node_modules/`, license cache, or installation state.
The updater rejects these paths before extraction.

## Rollback

If apply or post-update verification fails, the updater restores the previous
backup and logs `event=update_rollback`. If rollback fails, the command prints a
critical message with the backup location and does not claim success.
