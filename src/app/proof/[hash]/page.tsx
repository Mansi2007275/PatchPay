import { connection } from 'next/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db/supabase';
import { canonicalJson, proofHash, type PatchProof } from '@/lib/patchproof/proof';
import { EXPLORER_TX } from '@/lib/bch/network';
import { VerifyInBrowser } from './VerifyInBrowser';
import { getUsdPerBch } from '@/lib/price';
import { Usd } from '@/components/Usd';

export default async function ProofPage({ params }: { params: Promise<{ hash: string }> }) {
  await connection();
  const { hash } = await params;
  const { data: row } = await db().from('proofs').select('*').eq('proof_hash', hash).maybeSingle();
  if (!row) notFound();
  const proof = row.proof as PatchProof;
  const { data: pays } = await db().from('payments').select('*').eq('proof_id', row.id);
  const json = canonicalJson(proof);
  const usd = await getUsdPerBch();
  const serverOk = proofHash(proof) === hash;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="receipt relative">
        <p className="label">PatchProof · v{proof.v}</p>
        <h1 className="text-2xl sm:text-3xl font-medium mt-1 [overflow-wrap:anywhere]">{proof.bounty.repo}#{proof.bounty.issue} → PR #{proof.patch.pr}</h1>
        <div className="mono text-[13px] mt-5 grid grid-cols-[7.5rem_1fr] sm:grid-cols-[10rem_1fr] gap-x-2 gap-y-1">
          <span>contributor</span><span><Link href={`/u/${proof.contributor.github}`} className="ink-link">@{proof.contributor.github}</Link> ({proof.contributor.kind})</span>
          <span>merged by</span><span>@{proof.patch.mergedBy ?? '—'}</span>
          <span>head sha</span><span className="break-all">{proof.patch.headSha}</span>
          <span>diff sha256</span><span className="break-all">{proof.patch.diffSha256}</span>
          <span>checks</span><span>{proof.checks.map((c) => `${c.name}:${c.conclusion}`).join(', ') || 'none'}</span>
          <span>AI review</span><span>{proof.review.score}/100 · criteria met {String(proof.review.criteriaMet)} · {proof.review.model}</span>
          <span>amount</span><span>{(Number(proof.bounty.amountSats) / 1e8).toFixed(5)} BCH<Usd sats={Number(proof.bounty.amountSats)} rate={usd} /></span>
          <span>payout tx</span>
          <span className="space-y-1">
            {(pays ?? []).filter((p) => p.kind === 'release').length === 0 && <span className="text-ink-2">—</span>}
            {(pays ?? []).filter((p) => p.kind === 'release').map((p) => (
              <a key={p.txid} className="ink-link block break-words [overflow-wrap:anywhere]" href={EXPLORER_TX(p.txid)}>
                {p.amount_sats ? `${(Number(p.amount_sats) / 1e8).toFixed(5)} BCH` : ''}
                {p.amount_sats ? <Usd sats={Number(p.amount_sats)} rate={usd} /> : null}
                {p.amount_sats ? ' · ' : ''}
                {p.txid.slice(0, 12)}…
              </a>
            ))}
          </span>
        </div>
        <div className="border-t border-dashed rule my-4" />
        <p className="label">proof hash (sha256 of canonical JSON, also in the payout OP_RETURN after the 4-byte PPPF prefix)</p>
        <p className="mono text-sm break-all">{hash}</p>
        <VerifyInBrowser json={json} expected={hash} />
        {serverOk && row.status === 'paid' && <span className="stamp text-bch absolute right-6 top-6 text-lg">paid</span>}
      </div>
      <details className="mt-8">
        <summary className="label cursor-pointer">raw canonical JSON</summary>
        <pre className="mono text-[11px] whitespace-pre-wrap break-all mt-3 bg-paper-2 p-3">{json}</pre>
      </details>
    </div>
  );
}
