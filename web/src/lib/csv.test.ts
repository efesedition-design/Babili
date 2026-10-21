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

describe('exchange and locale formats', () => {
  it('reads a Binance Futures position history export', () => {
    const csv = '﻿Symbol,Margin Mode,Position Side,Entry Price,Avg. Close Price,Max Open Interest,Closed Vol.,Closing PNL,Opened,Closed,Status\n' +
      'BTCUSDT,Isolated,Short,77484.3,77257.8,0.079,0.079,17.8935,2026-04-24 12:21:29,2026-04-27 18:04:51,Closed';
    const [t] = importTrades(csv).trades;
    expect(t.side).toBe('short');
    expect(t.qty).toBe(0.079);
    expect(tradePnl(t)).toBeCloseTo(17.8935, 3);
  });
  it('reads Turkish Excel headers, decimal commas and day-first dates', () => {
    const [t] = importTrades('Sembol;Yön;Giriş;Çıkış;Miktar;Tarih\nBTCUSDT;Sat;110,5;100,5;2;21.10.2026 14:30').trades;
    expect(t.side).toBe('short');
    expect(tradePnl(t)).toBe(20);
    expect(new Date(t.openedAt).getDate()).toBe(21);
  });
  it('reads MetaTrader reports with repeated Time and Price columns', () => {
    const csv = 'Time,Position,Symbol,Type,Volume,Price,S / L,T / P,Time,Price,Commission,Swap,Profit\n' +
      '2024.05.01 10:00:00,1,EURUSD,buy,1,1.08,1.078,1.084,2024.05.01 11:00:00,1.083,-7,0,300';
    const [t] = importTrades(csv).trades;
    expect([t.entry, t.exit, t.stop]).toEqual([1.08, 1.083, 1.078]);
    expect(new Date(t.closedAt).getHours()).toBe(11);
  });
  it('explains what is wrong instead of silently skipping', () => {
    expect(importTrades('foo,bar\n1,2').problem).toMatch(/symbol/);
    expect(importTrades('Date(UTC),Pair,Side,Price,Executed,Amount,Fee\n2024-05-01,BTCUSDT,BUY,1,1,1,0').problem).toMatch(/Position History/);
  });
});
