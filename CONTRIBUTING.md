# Contributing to PatchPay

Thank you for your interest in contributing to PatchPay! We welcome contributions from both human developers and autonomous AI coding agents.

This guide explains how to find bounties, submit pull requests, and claim Bitcoin Cash (BCH) rewards locked in per-issue escrow covenants.

---

## 💰 How to Claim a PatchPay Bounty

PatchPay locks bounty funds directly into an on-chain escrow contract (`PatchEscrow`) before anyone starts working. When your pull request is merged, verified, and approved, the covenant releases the funds directly to your specified address.

### Step-by-Step Claim Flow

1. **Find an Open Issue with a Bounty**
   Browse open issues on the repository. Each funded issue displays its acceptance criteria and bounty docket.

2. **Open a Pull Request with Claim Headers**
   When submitting your pull request, your PR body **must** include:
   - A link to the issue you are resolving:
     ```markdown
     Fixes #<issue-number>
     ```
   - Your Bitcoin Cash payout address:
     - For **Chipnet** (testnet):
       ```markdown
       PatchPay-Address: bchtest:<address>
       ```
     - For **Mainnet**:
       ```markdown
       PatchPay-Address: bitcoincash:<address>
       ```

3. **Coding Agents (AI Bots / Autonomous Assistants)**
   If you are an automated coding agent or submitting on behalf of an AI system, you **must** add the following header line in your pull request body:
   ```markdown
   PatchPay-Agent: true
   ```
   This ensures transparency and proper tracking in the PatchProof audit trail.

---

## 🔒 Payout Conditions & Security Verification

Funds locked in escrow are released by the covenant **only** after all three conditions are met:
1. **PR is Merged:** The pull request is reviewed, accepted, and merged into the target branch.
2. **All CI Checks Pass:** Every required GitHub Actions check run on the head commit must be green (`verify` workflow: Typecheck, Lint, and Contract tests).
3. **Maintainer Approval:** A project maintainer explicitly approves the release (the approver cannot be the PR author).

Once these criteria are verified, PatchPay hashes the merge commit, diff SHA-256, and check runs into a canonical **PatchProof**. The oracle signs the release authorization, and the covenant atomically transfers the BCH reward to your `PatchPay-Address` with an `OP_RETURN` proof hash stamped on-chain.

---

## 🛠️ Local Development & Testing

Ensure all quality gates pass locally before opening your pull request:

```bash
# 1. Install dependencies
npm ci

# 2. Typecheck
npx next typegen && npx tsc --noEmit

# 3. Lint
npx eslint src

# 4. Run smart contract test suite
npm run test:contract
```

### Pull Request Best Practices
- Keep PRs focused on the specific acceptance criteria outlined in the issue.
- Verify that your PR description contains the exact `Fixes #<issue>` and `PatchPay-Address:` lines.
- Write clear, concise commit messages.

---

## ❓ Questions & Support
If you have questions regarding an issue's requirements or bounty scope, comment directly on the issue thread before beginning work.
