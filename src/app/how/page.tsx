export default function How() {
  const steps = [
    ['File', 'A maintainer pastes a GitHub issue. Issue Scout (Gemini) summarises it, rates difficulty and drafts testable acceptance criteria, which the maintainer edits.'],
    ['Lock', 'PatchPay derives a one-off PatchEscrow contract address for that issue. The maintainer funds it from Paytaca, Cashonize or Selene over WizardConnect. Anyone can see the BCH sitting there.'],
    ['Fix', 'Anyone, human or coding agent, opens a PR with “Fixes #N” and a PatchPay-Address line. Nothing to sign up for.'],
    ['Prove', 'On merge, PatchPay reads GitHub directly: merge commit, head SHA, diff SHA-256, every CI check run, plus a sceptical AI review for missed criteria and AI-slop. That becomes the PatchProof, hashed and posted on the PR.'],
    ['Pay', 'The merge is the maintainer’s approval. If CI is green, the PR has a valid payout address, the AI review finds the criteria met, and a maintainer other than the author merged it, the oracle signs (bountyId, recipient, proofHash) and the contract pays exactly that address, writing the proof hash into an OP_RETURN. Anything less waits for a maintainer’s manual approval.'],
    ['Refund', 'Nobody fixed it by the deadline? Anyone can trigger the refund. The contract only lets funds go back to the maintainer.'],
  ];
  return (
    <div className="max-w-3xl">
      <p className="label">The rules</p>
      <h1 className="text-4xl font-medium mb-8">How PatchPay works</h1>
      <ol className="space-y-6">
        {steps.map(([t, d], i) => (
          <li key={t} className="grid grid-cols-[3rem_1fr] border-t rule pt-4">
            <span className="mono text-2xl text-ink-2">{String(i + 1).padStart(2, '0')}</span>
            <div><h2 className="text-xl font-medium">{t}</h2><p className="text-ink-2 mt-1">{d}</p></div>
          </li>
        ))}
      </ol>
      <h2 className="text-2xl font-medium mt-12 border-b-2 border-ink pb-1">When does a PR get paid?</h2>
      <ul className="mt-4 space-y-2 text-ink-2 list-disc pl-5">
        <li>The PR is merged.</li>
        <li>A maintainer other than the PR author merged it.</li>
        <li>Every required CI check is green.</li>
        <li>The PR includes a valid payout address.</li>
        <li>The AI review says the acceptance criteria are met.</li>
        <li>No AI-slop signals are found.</li>
      </ul>
      <p className="text-ink-2 mt-4">When every condition passes, the contract pays the contributor automatically on merge and writes the PatchProof hash into the payout transaction.</p>
      <p className="text-ink-2 mt-4">If an automatic check fails, payout waits for a maintainer to review it. A failed AI check does not block payment forever: a maintainer can still approve the payout manually.</p>
      <h2 className="text-2xl font-medium mt-12 border-b-2 border-ink pb-1">Trust model, plainly</h2>
      <ul className="mt-4 space-y-2 text-ink-2 list-disc pl-5">
        <li>The contract cannot pay anyone the oracle did not sign for, and cannot be refunded to anyone but the maintainer.</li>
        <li>The oracle is a PatchPay server key. It only signs after a merged PR, green checks and a maintainer approval. Its public key is printed on every docket; every signature it made is in the payout transaction.</li>
        <li>The AI never holds keys and cannot approve anything. It only writes the review section of the proof.</li>
        <li>Next: replace the single oracle with a 2-of-3 (maintainer, PatchPay, independent verifier).</li>
      </ul>
    </div>
  );
}
