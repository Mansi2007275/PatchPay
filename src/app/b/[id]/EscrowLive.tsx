'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useRouter } from 'next/navigation';
import { Usd } from '@/components/Usd';

const toBch = (sats: number | bigint) => (Number(sats) / 1e8).toFixed(5);

/**
 * Lives inside the escrow receipt. On mount it:
 *  - asks the server to read the escrow address on-chain (POST .../sync) once,
 *    and shows the live balance, and
 *  - renders a QR code of the escrow address (ink on paper) so anyone can top it
 *    up from any BCH wallet.
 */
type SyncResult = { totalSats?: string; funded?: boolean; backers?: number };

export function EscrowLive({ bountyId, escrow, amountSats, funded, backers: initialBackers, usdPerBch = null, closed = null }: { bountyId: string; escrow: string; amountSats: number; funded: boolean; backers: number; usdPerBch?: number | null; closed?: string | null }) {
  const router = useRouter();
  const [qr, setQr] = useState<string | null>(null);
  const [live, setLive] = useState<{ totalSats: string; funded: boolean } | null>(null);
  const [backers, setBackers] = useState(initialBackers);
  const [state, setState] = useState<'loading' | 'done' | 'offline'>('loading');

  // Another component (BackBounty) just synced: take its result.
  useEffect(() => {
    const onSynced = (e: Event) => {
      const j = (e as CustomEvent<SyncResult>).detail;
      if (j?.totalSats != null) { setLive({ totalSats: String(j.totalSats), funded: Boolean(j.funded) }); setState('done'); }
      if (typeof j?.backers === 'number') setBackers(j.backers);
    };
    window.addEventListener('patchpay:synced', onSynced);
    return () => window.removeEventListener('patchpay:synced', onSynced);
  }, []);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(escrow, {
      errorCorrectionLevel: 'M',
      margin: 1,
      scale: 5,
      color: { dark: '#17150fff', light: '#f7f4ecff' },
    }).then((url) => { if (!cancelled) setQr(url); }).catch(() => {});
    return () => { cancelled = true; };
  }, [escrow]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/bounties/${bountyId}/sync`, { method: 'POST' });
        const j = await r.json();
        if (cancelled) return;
        if (r.ok) {
          setLive({ totalSats: String(j.totalSats ?? '0'), funded: Boolean(j.funded) });
          if (typeof j.backers === 'number') setBackers(j.backers);
          setState('done');
          window.dispatchEvent(new CustomEvent('patchpay:synced', { detail: j }));
          // If funding status just flipped, refresh the server component once.
          if (!closed && Boolean(j.funded) !== funded) router.refresh();
        } else {
          setState('offline');
        }
      } catch {
        if (!cancelled) setState('offline');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bountyId]);

  return (
    <div className="mt-3">
      <div className="flex justify-between items-baseline">
        <span>ON CHAIN NOW</span>
        <span className="font-bold">
          {state === 'loading' && <span className="text-ink-2">reading chain…</span>}
          {state === 'done' && live && closed && Number(live.totalSats) === 0 && <span className="text-bch">{closed === 'refunded' ? 'refunded to maintainer' : 'released to contributor'}</span>}
          {state === 'done' && live && !(closed && Number(live.totalSats) === 0) && <>{toBch(Number(live.totalSats))} BCH{Number(live.totalSats) >= amountSats || closed ? '' : ' (under target)'}<Usd sats={Number(live.totalSats)} rate={usdPerBch} block /></>}
          {state === 'offline' && <span className="text-ink-2">chain offline</span>}
        </span>
      </div>
      <div className="flex justify-between items-baseline">
        <span>BACKERS</span>
        <span className="font-bold">{backers}</span>
      </div>

      {qr && !closed && (
        <div className="mt-3 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`BCH QR for ${escrow}`} width={140} height={140} className="border border-ink" style={{ imageRendering: 'pixelated' }} />
          <p className="text-[10px] text-ink-2 mt-1 text-center max-w-[180px] leading-snug">Anyone can top up this bounty from any BCH wallet</p>
        </div>
      )}
    </div>
  );
}
