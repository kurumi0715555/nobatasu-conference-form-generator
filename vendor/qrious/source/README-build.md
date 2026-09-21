# QRious 4.0.2 source and build inputs

This directory preserves the editable source used by QRious 4.0.2 and its locked `qrious-core` 4.0.0 dependency.

- `qrious/` comes from the official GitHub `4.0.2` tag. It includes `src/`, `Gruntfile.js`, ESLint configuration, `package.json`, `package-lock.json`, and upstream documentation and license notices.
- `qrious-core/` comes from the official `qrious-core@4.0.0` npm tarball selected by the QRious lockfile. It includes the package entrypoint, editable `src/`, package metadata, documentation, and license notice.
- `../../SOURCE-PROVENANCE.json` records the source archive URLs and hashes. `../../SOURCE-SHA256SUMS` records every selected source file.

The original upstream build expects the legacy Node/npm toolchain represented by `qrious/package-lock.json` and runs through Grunt:

```sh
cd qrious
npm ci
npm run build
```

The lockfile selects `qrious-core` 4.0.0. The adjacent `qrious-core/` directory is retained as readable corresponding source; the unmodified upstream build resolves the locked package through npm.

This repository has not rerun that legacy dependency installation or asserted a byte-identical rebuild. The distributed `qrious.min.js` was instead verified byte-for-byte against `package/dist/qrious.min.js` in the official `qrious@4.0.2` npm tarball.
