import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsePrMeta } from '../src/lib/github/app.ts';

describe('parsePrMeta', () => {
  describe('PatchPay-Address parsing', () => {
    it('parses valid bitcoincash: address', () => {
      const body = 'PatchPay-Address: bitcoincash:qr9gjzwkvghvvdyvqg8pppcvsg084pgeyvjyx3hjjc';
      const meta = parsePrMeta(body);
      assert.equal(meta.addr, 'bitcoincash:qr9gjzwkvghvvdyvqg8pppcvsg084pgeyvjyx3hjjc');
    });

    it('parses valid bchtest: address', () => {
      const body = 'PatchPay-Address: bchtest:qq27387r6w25x97j782z5u6y74n065y0g5xuvt75j4';
      const meta = parsePrMeta(body);
      assert.equal(meta.addr, 'bchtest:qq27387r6w25x97j782z5u6y74n065y0g5xuvt75j4');
    });

    it('handles case-insensitive prefix and header', () => {
      const body = 'patchpay-address: BITCOINCASH:QP3WJPA3TJLJ042Z2WV7HAHSLDGWHWY0RQ9SYWJPYY';
      const meta = parsePrMeta(body);
      assert.equal(meta.addr, 'BITCOINCASH:QP3WJPA3TJLJ042Z2WV7HAHSLDGWHWY0RQ9SYWJPYY');

      const bodyTestnet = 'PATCHPAY-ADDRESS: bchtest:qq27387r6w25x97j782z5u6y74n065y0g5xuvt75j4';
      const metaTestnet = parsePrMeta(bodyTestnet);
      assert.equal(metaTestnet.addr, 'bchtest:qq27387r6w25x97j782z5u6y74n065y0g5xuvt75j4');
    });

    it('returns null when address is missing or invalid', () => {
      assert.equal(parsePrMeta('Some PR body without address').addr, null);
      assert.equal(parsePrMeta('PatchPay-Address: 0x53Eb00b639e3e7fD2E55faB322495d4371faB65a').addr, null);
      assert.equal(parsePrMeta('PatchPay-Address: invalid_address_format').addr, null);
      assert.equal(parsePrMeta('').addr, null);
      assert.equal(parsePrMeta(null).addr, null);
    });
  });

  describe('PatchPay-Agent parsing', () => {
    it('detects PatchPay-Agent: true', () => {
      const body = 'PatchPay-Agent: true';
      const meta = parsePrMeta(body);
      assert.equal(meta.agent, true);
    });

    it('handles case-insensitivity for agent flag', () => {
      assert.equal(parsePrMeta('patchpay-agent: TRUE').agent, true);
      assert.equal(parsePrMeta('PATCHPAY-AGENT: true').agent, true);
      assert.equal(parsePrMeta('PatchPay-Agent: True').agent, true);
    });

    it('returns false when agent flag is absent or false', () => {
      assert.equal(parsePrMeta('Just a regular PR description').agent, false);
      assert.equal(parsePrMeta('PatchPay-Agent: false').agent, false);
      assert.equal(parsePrMeta('PatchPay-Agent: 0').agent, false);
      assert.equal(parsePrMeta('').agent, false);
      assert.equal(parsePrMeta(null).agent, false);
    });
  });

  describe('Fixes/Closes/Resolves #N issue parsing', () => {
    it('parses Fixes in various casings', () => {
      assert.equal(parsePrMeta('Fixes #11').issue, 11);
      assert.equal(parsePrMeta('fixes #42').issue, 42);
      assert.equal(parsePrMeta('FIXES #99').issue, 99);
    });

    it('parses Closes in various casings', () => {
      assert.equal(parsePrMeta('Closes #5').issue, 5);
      assert.equal(parsePrMeta('closes #8').issue, 8);
      assert.equal(parsePrMeta('CLOSES #10').issue, 10);
    });

    it('parses Resolves in various casings', () => {
      assert.equal(parsePrMeta('Resolves #7').issue, 7);
      assert.equal(parsePrMeta('resolves #21').issue, 21);
      assert.equal(parsePrMeta('RESOLVES #100').issue, 100);
    });

    it('handles arbitrary whitespace between keyword and issue number', () => {
      assert.equal(parsePrMeta('Fixes   #50').issue, 50);
      assert.equal(parsePrMeta('closes  \t #88').issue, 88);
    });

    it('returns null when no issue keyword or invalid issue number is present', () => {
      assert.equal(parsePrMeta('Resolves issue without number').issue, null);
      assert.equal(parsePrMeta('Fixed #12').issue, null);
      assert.equal(parsePrMeta('#11 without keyword').issue, null);
      assert.equal(parsePrMeta('').issue, null);
      assert.equal(parsePrMeta(null).issue, null);
    });
  });

  describe('Empty and non-matching PR bodies', () => {
    it('returns default null/false values for body with none of these fields', () => {
      const body = 'Refactored button styling and improved responsive layout in mobile viewport.';
      const meta = parsePrMeta(body);
      assert.deepEqual(meta, {
        addr: null,
        agent: false,
        issue: null,
      });
    });

    it('returns default null/false values for empty string', () => {
      assert.deepEqual(parsePrMeta(''), {
        addr: null,
        agent: false,
        issue: null,
      });
    });

    it('returns default null/false values for null body', () => {
      assert.deepEqual(parsePrMeta(null), {
        addr: null,
        agent: false,
        issue: null,
      });
    });
  });

  describe('Complete realistic PR bodies', () => {
    it('extracts all metadata from full realistic PR description', () => {
      const body = `
## Summary
Fixes bug in payout distribution logic.

- Fixes #11
- PatchPay-Address: bitcoincash:qr9gjzwkvghvvdyvqg8pppcvsg084pgeyvjyx3hjjc
- PatchPay-Agent: true

All CI checks passed.
      `.trim();

      const meta = parsePrMeta(body);
      assert.deepEqual(meta, {
        addr: 'bitcoincash:qr9gjzwkvghvvdyvqg8pppcvsg084pgeyvjyx3hjjc',
        agent: true,
        issue: 11,
      });
    });

    it('extracts metadata with bchtest address and Closes keyword without agent', () => {
      const body = `
Closes #7
PatchPay-Address: bchtest:qq27387r6w25x97j782z5u6y74n065y0g5xuvt75j4
Testing completed on chipnet.
      `.trim();

      const meta = parsePrMeta(body);
      assert.deepEqual(meta, {
        addr: 'bchtest:qq27387r6w25x97j782z5u6y74n065y0g5xuvt75j4',
        agent: false,
        issue: 7,
      });
    });
  });
});
