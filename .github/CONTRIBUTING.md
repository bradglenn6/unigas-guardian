# Contributing to UniGas Guardian

Thank you for contributing to the multi-chain gasless transaction relayer and paymaster architecture.

## Development Workflow

1. **Fork the repository** and create a feature branch (`git checkout -b feature/relayer-optimization`).
2. **Adhere to Standards**:
   - Ensure all `guardian.ts` and `relayer.ts` modifications maintain compatibility with Pi Network, Arbitrum, and Story Protocol account abstraction standards.
   - Test Cloud Run deployment behaviors and top-level exception handling locally before submitting.
3. **Commit Messages**: Use concise conventional commit formats (`feat:`, `fix:`, `docs:`, `perf:`).
4. **Submitting Changes**:
   - Open a pull request against the `main` branch.
   - Include details on how changes impact transaction throughput or paymaster gas limits.
