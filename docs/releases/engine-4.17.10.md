# Engine 4.17.10 publication receipt

The adjacent `engine-4.17.10.json` is the sanitized combined asset and activation
receipt for the original production publication, including read-only reconciliation
of its initially incomplete installer receipt. No duplicate engine POST was made.

- Approved source: `a96681aa6123b1e607763bdb37cbf1b9ed231e3d`.
- Independent approval: `sub-1794658886674-c27120b5` (shared release coordination).
- Exact original tarball SHA-256:
  `a21b4c587f6488fb1c75a9c6a81c182230b2ed7e9272172f33866e0d0e1df151`.
- Artwork manifest SHA-256:
  `4476a12a56b9c61e1dccfc17d02be9a6a60954371eab3f37a0c09236b954275a`.
- Live engine 4.17.10, manifest revision 5: 36 achievement definitions,
  14 new illustrations and 22 preserved achievement rows (20 distinct assets).
- Canonical delivery: GitHub `boardgamers/gaia-project`, `master`.
  The separate private `lost-fleet` fork is not a required mirror and was not pushed.

## Source-delivery checks

Anonymous GET of `https://boardgamers.space/api/boardgame/gaia-project/info/latest`
matched the complete receipt manifest and engine package reference. All 41 hosted
assets (14 new, 20 preserved achievement images, seven other preserved assets)
matched receipt SHA-256, byte size, format and dimensions and decoded successfully.
Preserved asset metadata matched exactly; all 14 local source PNG hashes matched.
The original local tarball and anonymously downloaded hosted package both matched
the approved hash and hosted byte count (915098); neither was rebuilt or repacked.

Two existing focused scene tests passed against the extracted exact tarball:
complete protocol references/preserved definitions/evaluator and depicted semantic
counts/difficulty mapping. The initial extracted-package invocation lacked dependency
resolution; rerunning with `NODE_PATH` pointing to existing engine dependencies
passed. No installation or rebuild was needed. The export-generation test was not
rerun because this delivery does not regenerate artwork.

The sanitized receipt records unchanged publication metadata. Viewer, settings and
visibility were not changed by this delivery; only these release documents were
added after the reviewed source commit. No upload, activation, server, preview or
original-checkout mutation was performed. Private raw receipts and metadata
snapshots are not included; reconciliation retains only their SHA-256 evidence.
