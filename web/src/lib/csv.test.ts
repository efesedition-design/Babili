import { describe, expect, it } from 'vitest';
import { exportTrades, importTrades, parseCsv } from './csv';
import { tradePnl } from './stats';

describe('parseCsv', () => {
  it('handles quotes, escaped quotes and CRLF', () => {
    expect(parseCsv('a,b\r\n"x, y","he said ""hi"""\r\n')).toEqual([['a', 'b'], ['x, y', 'he said "hi"']]);
  });
  it('detects semicolons', () => {
    expect(parseCsv('a;b\n1;2')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('importTrades', () => {
  it('maps loose headers and prices', () => {
    const csv = 'Ticker,Direction,Entry Price,Exit Price,Quantity,Commission,Entry Time,Exit Time,Setup,Tags\n' +
      'aapl,Sell,200,190,10,2,2024-05-01 10:00,2024-05-01 11:00,Gap fade,news|open';
    const res = importTrades(csv, (n) => (n === 'Gap fade' ? 'pb1' : undefined));
    expect(res.skipped).toBe(0);
    const [t] = res.trades;
    expect(t.symbol).toBe('AAPL');
    expect(t.side).toBe('short');
    expect(tradePnl(t)).toBe(98);
    expect(t.playbookId).toBe('pb1');
    expect(t.tags).toEqual(['news', 'open']);
  });
  it('falls back to a P&L column and skips junk rows', () => {
    const res = importTrades('symbol,date,pnl\nES,2024-01-02,"1.250,50"\n,2024-01-02,5\nNQ,not a date,5');
    expect(res.trades).toHaveLength(1);
    expect(tradePnl(res.trades[0])).toBe(1250.5);
    expect(res.skipped).toBe(2);
  });
  it('round-trips through export', () => {
    const { trades } = importTrades('symbol,side,entry,exit,qty,opened_at,closed_at,notes\nBTC,long,1,2,3,2024-01-01T00:00:00Z,2024-01-01T01:00:00Z,"a, b"');
    const again = importTrades(exportTrades(trades)).trades;
    expect(again[0].notes).toBe('a, b');
    expect(tradePnl(again[0])).toBe(3);
  });
});
