# Release Process

1. Bump `VERSION` using the existing semantic style, for example `4.1.0`.
2. Update `CHANGELOG.md`.
3. Run all automated checks.
4. Build an immutable release artifact:

```bash
scripts/build-release.sh release
```

5. Review `release/release-manifest.json`.
6. Sign the manifest outside the repo using a private key from CI secrets or a
   secure release environment:

```bash
scripts/sign-release.sh release/release-manifest.json /secure/path/update-private.pem
```

7. Upload the versioned `.tar.gz` artifact to GitHub Releases, object storage, or
   a CDN.
8. Upload `release-manifest.json` and `release-manifest.json.sig`.
9. Test `roblox-manager update check` and `roblox-manager update --yes` from the
   previous version.
10. Keep the private key out of git. Public keys are not secret and may be
    distributed with the client.

Do not ship mutable `main` branch snapshots as production updates. Production
clients should install immutable, versioned release artifacts only.
