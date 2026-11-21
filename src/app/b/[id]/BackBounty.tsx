'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { useApp } from '@/components/Providers';
import { CopyButton } from '@/components/CopyButton';
import { Usd } from '@/components/Usd';
import { fundEscrow } from '@/lib/bch/funding';
import { EXPLORER_TX } from '@/lib/bch/network';

const PRESETS = ['0.0005', '0.001', '0.005'];
const MIN_SATS = 5_000; // keeps every backer UTXO comfortably spendable by the release path
const MAX_SATS = 10 * 1e8;

const toSats = (bch: string) => (/^\d*\.?\d{0,8}$/.test(bch.trim()) && bch.trim() !== '' && bch.trim() !== '.' ? Math.round(Number(bch) * 1e8) : NaN);

/** Tells EscrowLive (and anyone else listening) that a fresh sync result is available. */
export const announceSync = (data: unknown) => window.dispatchEvent(new CustomEvent('patchpay:synced', { detail: data }));

const bchString = (sats: number) => (sats / 1e8).toFixed(8).replace(/0+$/, '').replace(/\.$/, '');

/**
 * No-login backing. Default path works with ANY BCH wallet (phone app, browser
 * extension, desktop): a payment QR / address for the chosen amount, then
 * "I've sent it" reads the chain. WizardConnect wallets get one-click backing.
 */
export function BackBounty({ bountyId, escrow, usdPerBch = null }: { bountyId: string; escrow: string; usdPerBch?: number | null }) {
  const { wc, openQr } = useApp();
  const router = useRouter();
  const [amount, setAmount] = useState('0.001');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [txid, setTxid] = useState<string | null>(null);

  const connected = Boolean(wc.manager && wc.state === 'connected');
  const sats = toSats(amount);
  const valid = Number.isFinite(sats) && sats >= MIN_SATS && sats <= MAX_SATS;
  // BIP21-style payment URI: phone wallets pre-fill the amount when scanning.
  const payUri = valid ? `${escrow}?amount=${bchString(sats)}` : escrow;
  const [qr, setQr] = useState<string | null>(null);
  const successHeadingRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (txid) {
      successHeadingRef.current?.focus();
    }
  }, [txid]);

  useEffect(() => {
    if (connected) return;
    let cancelled = false;
    QRCode.toDataURL(payUri, { errorCorrectionLevel: 'M', margin: 1, scale: 4, color: { dark: '#17150fff', light: '#f7f4ecff' } })
      .then((u) => { if (!cancelled) setQr(u); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [payUri, connected]);

  async function sync(): Promise<{ ok: boolean; newTxids: string[] }> {
    const r = await fetch(`/api/bounties/${bountyId}/sync`, { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    if (r.ok) announceSync(j);
    router.refresh();
    return { ok: r.ok, newTxids: Array.isArray(j.newTxids) ? j.newTxids : [] };
  }

  async function back() {
    setErr(null);
    if (!connected) { openQr(); return; }
    if (!valid) { setErr(`Enter between ${MIN_SATS / 1e8} and ${MAX_SATS / 1e8} BCH`); return; }
    try {
      setBusy('Approve the payment in your wallet…');
      const res = await fundEscrow(wc.manager!, escrow, BigInt(sats));
      setTxid(res.txid);
      setBusy('Reading the escrow on-chain…');
      await sync();
    } catch (e) {
      setErr((e as Error).message || 'The wallet cancelled or failed to send.');
    } finally {
      setBusy(null);
    }
  }

  async function checkChain() {
    setErr(null);
    setBusy('Reading the escrow on-chain…');
    try {
      const res = await sync();
      if (!res.ok) setErr('Could not reach the BCH network. Try again in a moment.');
      else if (res.newTxids.length) setTxid(res.newTxids[res.newTxids.length - 1]);
      else setErr('No new payment seen yet. It usually shows within a few seconds — check that your wallet is on the right network, then try again.');
    } finally {
      setBusy(null);
    }
  }

  if (txid) {
    return (
      <div id="back" className="receipt mono text-[13px] relative">
        <div className="flex justify-between">
          <span ref={successHeadingRef} tabIndex={-1} role="status" aria-live="polite" className="outline-none">BACKED</span>
          <span className="font-bold">on-chain ✓</span>
        </div>
        <div className="border-t border-dashed rule my-2" />
        <p className="text-xs">Your BCH is now locked for whoever fixes this issue.</p>
        <a className="ink-link text-xs break-all block mt-2" href={EXPLORER_TX(txid)} target="_blank" rel="noreferrer">tx {txid}</a>
        <button className="btn !text-[11px] mt-4" onClick={() => { setTxid(null); setAmount('0.001'); }}>Back again</button>
        <span className="stamp text-bch absolute right-4 -bottom-2">thank you</span>
      </div>
    );
  }

  return (
    <div id="back" className="receipt mono text-[13px] border-t-4 border-t-bch">
      <p className="label">Back this bounty</p>
      <p className="text-xs mt-1 text-ink-2 leading-snug">
        No sign-in needed. Your BCH joins the escrow: it pays whoever fixes the issue, or returns to the maintainer after the deadline.
      </p>

      <div className="flex flex-wrap gap-2 mt-3" role="group" aria-label="Amount presets">
        {PRESETS.map((p) => (
          <button key={p} type="button" className={`btn !py-1 !px-2 !text-[11px] ${amount === p ? 'btn-ink' : ''}`} aria-pressed={amount === p} onClick={() => setAmount(p)}>
            {p}
          </button>
        ))}
      </div>
      <label className="block mt-3">
        <span className="label">Custom (BCH)</span>
        <input className="field mt-1" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={!valid} />
      </label>
      {valid && usdPerBch ? <p className="text-[11px] mt-1"><Usd sats={sats} rate={usdPerBch} /> at today’s mainnet price</p> : null}
      {!valid && amount.trim() !== '' && <p className="text-[11px] text-del mt-1">Min {MIN_SATS / 1e8} BCH, max {MAX_SATS / 1e8} BCH.</p>}

      {connected ? (
        <button className="btn btn-ink w-full mt-4" disabled={!!busy || !valid} onClick={back}>
          {busy ? 'Working…' : `Lock ${valid ? amount : '…'} BCH`}
        </button>
      ) : (
        <>
          <p className="label mt-4">Pay from any BCH wallet</p>
          <p className="text-[11px] text-ink-2 leading-snug mt-1">
            Phone app, browser extension or desktop wallet: scan the code, or send {valid ? <b>{amount} BCH</b> : 'BCH'} to this address.
          </p>
          {qr && (
            <div className="flex justify-center mt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt={`Payment code for ${valid ? amount : ''} BCH to ${escrow}`} width={150} height={150} className="border border-ink" style={{ imageRendering: 'pixelated' }} />
            </div>
          )}
          <p className="break-all text-[11px] select-all mt-2">{escrow}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <CopyButton text={escrow} label="Copy address" />
            <a className="btn !py-1 !px-2 !text-[11px]" href={payUri}>Open in wallet app</a>
          </div>
          <button className="btn btn-ink w-full mt-4" disabled={!!busy} onClick={checkChain}>
            {busy ? 'Working…' : "I've sent it — check the chain"}
          </button>
          <p className="text-[11px] text-ink-2 mt-2 leading-snug">
            WizardConnect wallet?{' '}
            <button type="button" className="ink-link" onClick={openQr}>Connect it</button> for one-click backing.
          </p>
        </>
      )}
      {busy && <p className="text-xs mt-2" role="status" aria-live="polite">{busy}</p>}
      {err && <p className="text-xs mt-2 text-del break-all select-all" role="alert" aria-live="assertive">{err}</p>}
    </div>
  );
}
