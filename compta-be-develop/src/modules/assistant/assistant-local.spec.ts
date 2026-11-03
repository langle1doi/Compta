import { BusinessData } from './assistant-context';
import { localReply } from './assistant-local';

const data: BusinessData = {
  today: '2026-11-03',
  overdue: [{ number: 'FAC-1', customer: 'Maison Laurent', due: '2026-10-20', left: 100, lateDays: 14 }],
  upcoming: [{ number: 'FAC-2', customer: 'Verde Agro', due: '2026-11-20', left: 50, lateDays: -17 }],
  quotes: [{ status: 'SENT', count: 2, total: 300 }],
};

describe('localReply', () => {
  it('lists overdue invoices (accents and case ignored)', () => {
    expect(localReply('Quelles FACTURES sont en rétard ?', data, 'fr')).toContain('FAC-1');
  });
  it('summarizes quotes', () => {
    expect(localReply('Summarize my quote pipeline', data, 'en')).toContain('Sent : 2');
  });
  it('sums open balances per customer, owe wins over invoice', () => {
    const reply = localReply('Which customers still owe money on invoices?', data, 'en');
    expect(reply).toContain('Maison Laurent');
    expect(reply).toContain('Verde Agro');
  });
  it('explains what it can answer otherwise', () => {
    expect(localReply('blabla', data, 'en')).toContain('I can answer about');
  });
});
