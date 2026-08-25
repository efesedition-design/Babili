# Babili — Smart Money Concept (SMC) Pozisyon Sistemi

Piyasa yapisina (market structure) dayali, Smart Money Concept mantigiyla
calisan bir sinyal ve backtest sistemi. **Kripto (Binance)** verisiyle
calisir, **Python** ile yazilmistir. Bu surum sadece analiz/sinyal ve
backtest uretir; hicbir borsaya otomatik emir gondermez.

## Kullandigi SMC kavramlari

- **Market structure**: Fraktal bazli swing high/low tespiti, BOS (Break of
  Structure) ve CHoCH (Change of Character) ile trend takibi.
- **Order Block**: Bir yapisal kirilimdan once olusan son ters yonlu mum.
- **Fair Value Gap (FVG)**: 3 mumluk fiyat dengesizligi (imbalance).
- **Likidite havuzlari ve supurme (liquidity sweep)**: Esit tepe/dip
  kumeleri ve bu seviyelerin fitille gecilip geri kapanmasi (stop hunt).
- **Premium / Discount / Equilibrium / OTE**: Bir yapisal bacagin %50
  dengesi ve %61.8–%79 optimal giris bolgesi.

## Strateji mantigi (ozet)

1. **Ust zaman dilimi (HTF)** piyasa yapisi analiz edilir, en son BOS/CHoCH
   yon verir (`htf_bias`).
2. **Alt zaman diliminde (LTF)**, HTF bias ile ayni yonde en guncel CHoCH
   aranir — bu, kurumsal oyuncularin yon degistirdigi noktadir.
3. CHoCH'u yaratan hareketin basindaki **order block** bulunur.
4. Order block, ilgili bacagin discount (long icin) / premium (short icin)
   bolgesinde degilse sinyal reddedilir (kalite filtresi).
5. **Giris** = order block siniri, **stop** = order block disinda tampon
   payli, **kar al** = sabit risk/odul carpani (varsayilan 2R).

Kod, her bir kavram icin ayri ve test edilebilir modullere bolunmustur:

```
babili/
  core/
    structure.py     # swing tespiti + BOS/CHoCH state machine
    order_blocks.py  # order block tespiti ve mitigation takibi
    fvg.py            # fair value gap tespiti ve mitigation takibi
    liquidity.py       # likidite havuzlari ve supurme tespiti
    zones.py            # premium/discount/OTE hesaplari
  strategy/
    smc_strategy.py      # yukaridakileri birlestiren sinyal motoru
    risk.py                # pozisyon buyuklugu / R:R yardimcilari
  backtest/
    engine.py               # lookahead-free, bar-bar backtest motoru
    metrics.py                # win rate, profit factor, max drawdown vb.
  data/
    binance_client.py          # Binance public klines (API key gerekmez)
  cli.py                        # `signal` ve `backtest` komutlari
```

## Kurulum

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Kullanim

Guncel sinyali gormek icin:

```bash
python -m babili.cli signal --symbol BTCUSDT --htf 4h --ltf 15m --days 30
```

Gecmis veri uzerinde backtest calistirmak icin:

```bash
python -m babili.cli backtest --symbol BTCUSDT --htf 4h --ltf 15m --days 90 \
  --risk-pct 0.01 --balance 10000 --min-rr 2.0
```

Parametreler:

- `--symbol`: Binance sembolu (orn. `BTCUSDT`, `ETHUSDT`)
- `--htf` / `--ltf`: Bias ve giris icin kullanilan zaman dilimleri
  (`1m,3m,5m,15m,30m,1h,2h,4h,6h,8h,12h,1d`)
- `--days` / `--start`: Cekilecek veri araligi
- `--min-rr`: Minimum risk/odul orani
- `--risk-pct` / `--balance`: Backtest icin islem basina risk ve baslangic bakiyesi

## Backtest motorunun onemli ozellikleri

- **Lookahead icermez**: Her mumda, sadece o ana kadar kapanmis HTF
  mumlari ve LTF gecmisi kullanilir; swing'ler ancak saglarindaki mumlar
  olustuktan sonra "bilinir" sayilir.
- **Bekleyen emir simulasyonu**: Sinyal, bir limit order gibi ele alinir;
  fiyat giris seviyesine dokununca islem acilir, stop'a once dokunursa
  iptal edilir, belirli bir sure icinde dolmazsa zaman asimina ugrar.
- Ayni anda **tek islem** yonetilir (basitlik icin).

## Testler

```bash
python -m pytest -q
```

## Onemli uyari

Bu proje **yatirim tavsiyesi degildir**. Sinyaller gecmis fiyat verisine
dayali kural tabanli bir modelin ciktisidir; kar garantisi vermez. Gercek
parayla islem yapmadan once kapsamli backtest/forward-test yapin ve riski
kendi sorumlulugunuzda yonetin. Bu surum canli emir gondermez.
