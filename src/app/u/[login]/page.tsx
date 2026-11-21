import { connection } from 'next/server';
import Link from 'next/link';
import { db } from '@/lib/db/supabase';
import { EXPLORER_TX, NETWORK } from '@/lib/bch/network';
import type { PatchProof } from '@/lib/patchproof/proof';
import { getUsdPerBch } from '@/lib/price';
import { Usd } from '@/components/Usd';

type ProofRow = { id: string; bounty_id: string; pr_number: number; proof: PatchProof; proof_hash: string; checks_green: boolean; status: string; created_at: string };
type PaymentRow = { id: string; proof_id: string | null; kind: string; txid: string; amount_sats: number | null; recipient: string | null };
type BountyRow = { id: string; network: string };

const toBch = (sats: number) => (sats / 1e8).toFixed(5);

export default async function ContributorProfile({ params }: { params: Promise<{ login: string }> }) {
  await connection();
  const { login } = await params;

  // Pull proofs, release payments, and bounties, then match on the contributor login in JS
  // and filter by the active network (works whether the backend is Supabase jsonb or the local mock store).
  const [{ data: proofData }, { data: payData }, { data: bountyData }, usd] = await Promise.all([
    db().from('proofs').select('*').order('created_at', { ascending: false }).limit(500),
    db().from('payments').select('*').eq('kind', 'release').limit(1000),
    db().from('bounties').select('id, network'),
    getUsdPerBch(),
  ]);

  const bounties = (bountyData as BountyRow[] | null) ?? [];
  const bountyNetworkMap = new Map<string, string>();
  for (const b of bounties) {
    bountyNetworkMap.set(b.id, b.network);
  }

  const allProofs = (proofData as ProofRow[] | null) ?? [];
  const networkProofs = allProofs.filter(
    (p) => (bountyNetworkMap.get(p.bounty_id) ?? (p.proof?.bounty?.id ? bountyNetworkMap.get(p.proof.bounty.id) : null)) === NETWORK
  );
  const mine = networkProofs.filter((p) => p.proof?.contributor?.github?.toLowerCase() === login.toLowerCase());
  const releases = (payData as PaymentRow[] | null) ?? [];

  const myProofIds = new Set(mine.map((p) => p.id));
  const myReleases = releases.filter((r) => r.proof_id && myProofIds.has(r.proof_id));
  const totalSats = myReleases.reduce((s, r) => s + (Number(r.amount_sats) || 0), 0);
  const isAgent = mine.some((p) => p.proof?.contributor?.kind === 'agent');
  const paidCount = mine.filter((p) => p.status === 'paid').length;
  const txByProof = new Map<string, PaymentRow[]>();
  for (const r of myReleases) if (r.proof_id) txByProof.set(r.proof_id, [...(txByProof.get(r.proof_id) ?? []), r]);

  return (
    <div className="max-w-3xl">
      <p className="label">Contributor record</p>
      <h1 className="text-4xl font-medium mt-1 flex flex-wrap items-center gap-3">
        @{login}
        {isAgent && <span className="stamp text-carbon text-sm">agent</span>}
      </h1>
      <a className="ink-link mono text-sm" href={`https://github.com/${login}`}>github.com/{login}</a>

      <div className="receipt mono text-[13px] mt-6 max-w-sm">
        <div className="flex justify-between">
          <span>TOTAL EARNED <span className="text-xs text-ink-2 font-normal">on {NETWORK}</span></span>
          <span className="font-bold text-right">{toBch(totalSats)} BCH<Usd sats={totalSats} rate={usd} block /></span>
        </div>
        <div className="border-t border-dashed rule my-2" />
        <div className="flex justify-between py-0.5"><span>bounties claimed</span><span className="font-bold">{mine.length}</span></div>
        <div className="flex justify-between py-0.5"><span>paid out</span><span className="font-bold">{paidCount}</span></div>
        <div className="flex justify-between py-0.5"><span>kind</span><span className="font-bold">{isAgent ? 'AI agent' : 'human'}</span></div>
      </div>

      <h2 className="text-2xl font-medium mt-12 border-b-2 border-ink pb-1">PatchProofs</h2>
      {mine.length === 0 ? (
        <p className="py-10 mono text-sm text-ink-2">No PatchProofs for @{login} yet.</p>
      ) : (
        <ul>
          {mine.map((p) => (
            <li key={p.id} className="border-b rule py-4 mono text-sm">
              <div className="flex justify-between gap-3 flex-wrap">
                <span>
                  <Link href={`/b/${p.bounty_id}`} className="ink-link">{p.proof.bounty.repo}#{p.proof.bounty.issue}</Link> · PR #{p.pr_number}
                  {p.proof.contributor.kind === 'agent' && <span className="text-carbon"> [agent]</span>}
                </span>
                <Link href={`/proof/${p.proof_hash}`} className="ink-link">{p.proof_hash.slice(0, 12)}…</Link>
              </div>
              <div className="text-xs text-ink-2 mt-1">
                {toBch(Number(p.proof.bounty.amountSats))} BCH · checks {p.checks_green ? 'green' : 'NOT green'} · AI review {p.proof.review.score}/100 · {p.status}
              </div>
              {(txByProof.get(p.id) ?? []).map((t) => (
                <a key={t.txid} href={EXPLORER_TX(t.txid)} className="block ink-link text-xs mt-1">payout {t.txid.slice(0, 20)}…</a>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
