'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/Providers';
import { fundEscrow } from '@/lib/bch/funding';

type Props =
  | { kind: 'approve'; bountyId: string; proofId: string; disabled: boolean; paid: boolean }
  | { kind: 'sync'; bountyId: string; escrow: string; amountSats: number; status: string; pastDeadline: boolean };

export function DocketActions(props: Props) {
  const { authFetch, wc, openQr } = useApp();
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [totalSats, setTotalSats] = useState<number | null>(null);

  useEffect(() => {
    if (props.kind !== 'sync') return;
    const onSynced = (e: Event) => {
      const j = (e as CustomEvent<{ totalSats?: string | number }>).detail;
      if (j?.totalSats != null) setTotalSats(Number(j.totalSats));
    };
    window.addEventListener('patchpay:synced', onSynced);
    return () => window.removeEventListener('patchpay:synced', onSynced);
  }, [props.kind]);

  const call = async (url: string, label: string) => {
    setBusy(true);
    setMsg(label);
    try {
      const r = await authFetch(url, { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j?.totalSats != null) {
        setTotalSats(Number(j.totalSats));
        window.dispatchEvent(new CustomEvent('patchpay:synced', { detail: j }));
      }
      setMsg(r.ok ? 'Done.' : typeof j.error === 'string' ? j.error : 'Something went wrong. Please try again.');
      router.refresh();
    } catch {
      setMsg('Network error — check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  if (props.kind === 'approve') {
    return (
      <div className="mt-3 flex flex-wrap gap-2 items-center">
        <button
          className="btn btn-ink !text-[11px]"
          disabled={props.disabled || busy}
          onClick={() => call(`/api/proofs/${props.proofId}/approve`, 'Signing release & broadcasting…')}
        >
          {busy ? 'Working…' : 'Approve & pay in BCH'}
        </button>
        <button
          className="btn !text-[11px]"
          disabled={busy || props.paid}
          title="Re-read the PR from GitHub and rebuild the proof (e.g. after CI turned green)"
          onClick={() => call(`/api/proofs/${props.proofId}/refresh`, 'Refreshing proof from GitHub…')}
        >
          Refresh proof
        </button>
        {msg && <span className="mono text-xs ml-1">{msg}</span>}
      </div>
    );
  }

  const { pastDeadline } = props;
  return (
    <div className="flex flex-wrap gap-3 items-center">
      {props.status === 'awaiting_funds' && (
        wc.manager && wc.state === 'connected' ? (
          <button className="btn btn-ink" disabled={busy} onClick={async () => {
            setBusy(true);
            try { setMsg('Approve in your wallet…'); await fundEscrow(wc.manager!, props.escrow, BigInt(props.amountSats)); await call(`/api/bounties/${props.bountyId}/sync`, 'Checking chain…'); }
            catch (e) { setMsg((e as Error).message || 'Funding was cancelled or failed.'); }
            finally { setBusy(false); }
          }}>{busy ? 'Waiting…' : 'Fund escrow'}</button>
        ) : <button className="btn" onClick={openQr}>Connect wallet to fund</button>
      )}
      <button className="btn !text-[11px]" disabled={busy} onClick={() => call(`/api/bounties/${props.bountyId}/sync`, 'Reading chain…')}>Re-check chain</button>
      {pastDeadline && !['paid', 'refunded'].includes(props.status) && (
        (totalSats !== null ? totalSats > 0 : props.status !== 'awaiting_funds' && props.amountSats > 0) ? (
          <button className="btn !text-[11px]" disabled={busy} onClick={() => call(`/api/bounties/${props.bountyId}/refund`, 'Refunding…')}>Trigger refund</button>
        ) : (
          <span className="mono text-xs text-ink-2">Deadline passed — nothing to refund.</span>
        )
      )}
      {msg && <p className="mono text-xs w-full break-all select-all" role="status">{msg}</p>}
    </div>
  );
}
