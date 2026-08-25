# Historical Research — Not MVP Scope

This folder preserves the early survey of protocol simulators, service virtualization tools and CMDB data-source coverage.

It is **reference material only**.

Current product scope is defined by:

- `README.md`
- `docs/product.md`
- `docs/architecture.md`
- Issue #1

Qoder and reviewers must not treat the projects or capability maps in this folder as implementation requirements for the MVP.

The current MVP is only:

```text
Natural-language prompt / template
→ validated GenerationSpec
→ deterministic CI records + relations
→ Bearer Token REST API
→ JSON / CSV / XLSX export
```

Protocol simulators, real-service orchestration, lifecycle/fault injection, verifier, remote Agents and generalized importers are intentionally deferred. Revisit one researched tool only when a concrete post-MVP requirement proves that the generic API/file interface is insufficient, and re-check its current release, maintenance status and license at that time.