# Focus Trading Engine v2.0 → v3.0
### Independent Audit, 2025–2026 Research Review, and Improvement Roadmap

*Based on the 24-hour Supabase dry-run audit (202 trades, Bitget USDT-M perpetuals, $10 virtual capital, 5x leverage). This is engineering and research analysis, not financial advice — nothing here promises profitability, and everything should be re-validated on your own data before risking real capital.*

---

## Part 1 — Audit of the Current System

### 1.1 What's already right about this architecture

Before the criticism: this is a genuinely well-built piece of infrastructure. Persistent WebSocket ingestion, a real multi-tier signal hierarchy (pullback / momentum / chop-wait), an independent tick-level position guardian, full Supabase telemetry, and — most importantly — **you tested in dry-run and instrumented it well enough to produce this audit at all.** Most retail bots never get diagnosed this precisely because they never log enough to be diagnosed. That instrumentation is the reason every recommendation below can be specific instead of generic.

### 1.2 Quantitative diagnosis (numbers not stated in the original report)

| Metric | Value | What it means |
|---|---|---|
| Gross trading PnL (before fees) | **-$0.29** over 202 trades | The raw signal + stop/TP logic is close to breakeven *even before touching fees*. Fixing fees alone gets you to ~flat, not profitable. |
| Breakeven reward:risk at 37.62% win rate | **1.66 : 1** | `loss_rate ÷ win_rate = 62.38 ÷ 37.62`. You need average wins 1.66x average losses just to break even, before fees. |
| Realized reward:risk | **1.29 : 1** | Short of the 1.66:1 bar by ~28%. This is a math problem, not (only) a discipline problem. |
| Alternative breakeven: win rate needed at current 1.29 RR | **43.7%** | `1 ÷ (1 + RR)`. You're 6 points short of that too. Either lever (raise RR or raise WR) closes the gap — you don't need both. |
| Loss concentration | LSK -$0.80 (43.5% of trades) + CVC -$0.60 (15.3% of trades) = **93.7% of net loss**; all other 83 trades combined ≈ **-$0.09** (near flat) | The strategy isn't "broken everywhere" — it's breakeven-ish almost everywhere, and catastrophic on two specific symbols the coin selector kept re-picking. |
| Trade count | 202 in 24h | Large enough (100+) that this negative-expectancy read is a real signal, not noise — see §2.1. |

**Data-quality note:** one recurring symbol in your PDF's trade log extracted as a garbled string (`Ÿ™†~USDT`) rather than a readable ticker — this looks like a font/encoding bug in your PDF export pipeline (possibly a special character in that ticker) rather than a trading issue, but worth fixing so future audits don't lose that symbol's identity.

### 1.3 Root causes, ranked by dollar impact

1. **Stop/TP math doesn't clear its own breakeven bar** (see 1.2) — this is upstream of everything else. Even a perfect LLM filter and zero fees wouldn't have made this configuration profitable as designed.
2. **Fixed 0.8% stop applied uniformly to a coin universe explicitly selected for being the *most volatile* available** — a structural mismatch, not just "the stop is too tight." Your own selector rewards `|24h% move| × log10(volume)`, which has no liquidity or spread floor, so it systematically surfaces thin names (LSK, CVC, STEEM, VTHO, GRIFFAIN, POWR, ARK) whose normal 1-minute wick size exceeds 0.8%. A fixed percentage stop can never be "right" across a universe that's deliberately chosen for maximum, variable volatility.
3. **Fee drag from 8.4 trades/hour** — real ($1.21, 80.7% of *net* loss) but secondary to #1: it turned a roughly-breakeven signal into a clear loser, it didn't create the losing signal.
4. **LLM as 100% rubber stamp** — the audit stage added zero information. Not catastrophic on its own (the signal was already weak), but it removed your one chance to filter the weakest 60-70% of setups before they ever reached the market.
5. **No consecutive-loss circuit breaker** — allowed the coin-selector problem (#2) to compound into concentrated damage on two symbols instead of being spread thin and diluted.

---

## Part 2 — Current Research & Industry Practice (2025–2026)

### 2.1 Is there a real edge here, or is this noise?

This is the right question to lead with, because it's the one your final goal ("only trade when there's a statistically validated edge") depends on. The standard framework, going back to Bailey & López de Prado's work on the **Probabilistic and Deflated Sharpe Ratios**, is built to answer exactly this: whether an observed result could plausibly be luck given (a) sample size, (b) return non-normality, and (c) how many strategy variations you tried before landing on this one ([Deflated Sharpe Ratio, SSRN](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2460551); [Wikipedia summary](https://en.wikipedia.org/wiki/Deflated_Sharpe_ratio)).

Practically, for a system your size, the useful takeaways are:
- **Sample size matters more than most people think.** Industry rules of thumb converge around needing 100+ trades before a win rate or profit factor is trustworthy at all, and 200+ before you'd call it convincing ([DarwinIQ](https://www.darwintiq.com/articles/statistical-significance-in-trading); [TradersSecondBrain](https://traderssecondbrain.com/guides/do-you-have-trading-edge)). **Your 202 trades clear that bar** — the negative-expectancy read on this specific configuration is real, not noise. Don't keep running the same config hoping variance turns it around.
- **If you tune parameters against this same 24-hour window repeatedly, you reintroduce the exact selection-bias problem the DSR was built to catch** — you'll find a config that "worked" on this one day purely because you searched enough configs against it. Any change needs to be validated on *new* data, ideally spanning a different market regime, not re-optimized against this report.
- **One 24-hour window is one draw from one market regime.** It's excellent for diagnosing *this run's* failure modes (which it does very well), but it cannot tell you whether a fixed strategy has a durable edge across trending, choppy, and volatile regimes. Treat this report as a bug list, not a backtest.

### 2.2 LLM-as-risk-filter: state of the art

This is an active research area, not settled practice, and the honest picture is mixed:
- A 2026 systems paper on LLM/multi-agent trading identifies a real, unresolved gap: there's no rigorous, **cost-adjusted benchmark for LLM-generated trading signals**, and the field doesn't yet have standard evaluation for how these filters behave under adversarial or illiquid conditions ([SSRN taxonomy survey](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7017418)).
- **TrustTrade** (2026) directly targets your failure mode — LLM agents in high-noise markets tend toward "hallucination-driven volatility" in their decisions from single-pass reasoning, and proposes selective consensus (weighting multiple short LLM calls, discounting the ones that disagree or are weakly grounded) rather than trusting one verdict ([arXiv 2603.22567](https://arxiv.org/pdf/2603.22567)).
- Separately, researchers have demonstrated that LLM trading agents can be misled by adversarially crafted news text invisible to human readers — a reminder that if you ever feed the LLM external news/social text (not just your own indicator narrative, which you currently do), that input channel needs the same skepticism as price data ([arXiv 2601.13082](https://arxiv.org/abs/2601.13082)).
- The realistic framing from broader agentic-finance research: most institutions treat LLM agents as **assistive** (signal synthesis, narrative context, flagging risk) inside a bounded-autonomy design with hard-coded risk limits around them — not as the final arbiter of whether to trade ([arXiv 2603.13942](https://arxiv.org/html/2603.13942v1)).

**Implication for your router:** the fix isn't "trust the LLM less" or "trust it more" — it's that a single Groq call asking "is this trade OK?" is the wrong shape of question. Ask it to argue *against* the trade using specific, falsifiable criteria (RSI extension, volume z-score, structural support level), require it to cite which criterion it's invoking, and track the approval rate as a live metric.

### 2.3 Market regime detection

Hidden Markov Models are the dominant practical technique for regime detection in crypto specifically, and there's now crypto-specific literature validating the approach: HMMs are explicitly used to accommodate cryptocurrency markets' non-stationary character, distinguishing trending/bullish, ranging, and volatile/turbulent states from observable returns and volatility alone ([Bitcoin regime detection study](https://www.academia.edu/165182244/Markov_and_Hidden_Markov_Models_for_Regime_Detection_in_Cryptocurrency_Markets_Evidence_from_Bitcoin_2024_2026_); [QuantStart implementation](https://www.quantstart.com/articles/market-regime-detection-using-hidden-markov-models-in-qstrader/)). A documented, directly analogous use case: overlaying an HMM as a **risk-management gate** that blocks trades in high-volatility/choppy regimes (rather than trying to predict direction) has been shown to cut unprofitable trades and improve realized Sharpe ratio ([QuantifiedStrategies](https://www.quantifiedstrategies.com/hidden-markov-model-market-regimes-how-hmm-detects-market-regimes-in-trading-strategies/)).

This is directly relevant: your Tier 3 logic (CHOP > 62 or ADX < 20 → WAIT) is already a crude regime filter — it's just not being applied where it matters most, which is *per-candidate-coin before the coin is even selected*, and it only recognizes "choppy," not "trending but about to reverse" or "high volatility, thin liquidity."

### 2.4 Which ML/AI models actually help, and for what

The evidence doesn't point to one universal "best" model — it points to task-specific fits, several of them contradicting AI hype:

- **Gradient boosting (XGBoost/LightGBM) is repeatedly competitive with or better than deep learning for short-horizon crypto price/direction prediction**, especially with engineered features on short windows — one comparative study found Gradient Boosting outperforming LSTM on multiple cryptocurrencies with meaningfully lower error ([Discover AI / Springer](https://link.springer.com/article/10.1007/s44163-025-00519-y)); another found gradient boosting methods work best on short (5-10 day) windows while LSTM does better with longer lookbacks ([Cryptocurrency Trading Survey](https://arxiv.org/pdf/2003.11352)).
- **Transformers do not automatically beat LSTMs on crypto**, despite the general LLM-era assumption that they should. A 2025 controlled benchmark across six architectures (LSTM, GPT-2, Informer, Autoformer, TFT, vanilla Transformer) plus econometric baselines found no universal winner, with results highly dependent on horizon and asset ([Symmetry journal, Dec 2025](https://doi.org/10.3390/sym18010032)). A dedicated crypto limit-order-book study found **LSTM more robust than most Transformer variants** for the mid-price-difference prediction task specifically ([arXiv 2309.11400](https://arxiv.org/pdf/2309.11400)).
- **Reinforcement learning is promising in research but has real, underdiscussed limitations for a solo operator**: a large 2025 meta-review of 167 RL-in-finance studies found the strongest, most consistent RL gains concentrated in market-making and portfolio optimization, not necessarily short-horizon directional crypto trading ([arXiv 2512.10913](https://arxiv.org/html/2512.10913v1)). Separately, researchers explicitly flag that raw deep RL for trading suffers from myopic behavior, unstable value estimation (Bellman backup instability), and credit-assignment failure under partial observability — problems that don't go away with more compute, only with careful reward design and much more data than a $10 test account will generate ([arXiv 2508.02366](https://arxiv.org/html/2508.02366v1)).
- **Hybrid stacks (LSTM + XGBoost, or indicator features + gradient boosting) consistently outperform single-model approaches** in the recent literature, which supports keeping your existing quantitative indicator layer rather than replacing it wholesale with a black-box model ([LSTM+XGBoost hybrid study](https://ui.adsabs.harvard.edu/abs/2025arXiv250622055G/abstract)).

**Bottom line for your bot:** a lightweight gradient-boosting classifier trained on your existing indicator features (EMA/RSI/ADX/CHOP/VWAP/MACD/ATR/volume z-score, plus regime label and recent per-symbol performance) is far more realistic to build, validate, and run on modest infrastructure than an RL agent or a custom transformer — and the current evidence doesn't clearly favor the latter anyway.

### 2.5 Combining quant indicators with AI instead of picking one

The research and the hybrid-model results above point the same direction: use technical indicators and market-structure rules to do the cheap, fast, high-precision filtering (regime, liquidity, volatility-relative stop sizing — things that don't need a model), and reserve AI/ML for the genuinely fuzzy judgment calls (is this setup's narrative context favorable, is this specific breakout more likely genuine than the last ten). Your architecture already has this shape (quant signal detector → LLM narrative check) — the problem isn't the design, it's that the LLM stage isn't doing its assigned job (§2.2) and the quant stage's stop/TP math is off (§1.2–1.3).

### 2.6 Additional data sources — what's actually worth it for your coin universe

Your trade log is dominated by micro-cap alts (LSK, CVC, STEEM, VTHO, GRIFFAIN, POWR, ARK), which changes which data sources are useful:

- **Order book depth / spread, not whale-tracking on-chain data, is the higher-value addition for these specific coins.** On-chain whale-tracking platforms (Nansen, Glassnode, Arkham) are built around and most reliable for majors like BTC/ETH ([BingX on-chain tools guide](https://bingx.com/en/learn/article/what-are-the-top-on-chain-analysis-tools-for-crypto-traders); [Glassnode/Nansen overview](https://mycryptoparadise.com/best-on-chain-analytics-tools-in-2026-which-ones-help-you-track-whales-and-market-makers/)) — coverage and reliability on thin alts like CVC or STEEM is much weaker, so this spend/effort is lower priority for your actual universe than a simple Bitget order-book-depth and bid-ask-spread check before entry.
- **Funding rate + open interest is genuinely useful and cheap** for perpetuals specifically — extreme funding combined with rising open interest is a documented leading indicator of crowded positioning and reversal/liquidation risk ([Gate.io derivatives signals explainer](https://www.gate.com/crypto-wiki/article/how-to-interpret-crypto-derivatives-market-signals-funding-rates-open-interest-and-liquidation-data-explained-20251227); [Amberdata Oct-2025 crash analysis](https://blog.amberdata.io/how-3.21b-vanished-in-60-seconds-october-2025-crypto-crash-explained-through-7-charts)). This is a natural addition to your Groq narrative check.
- **Social/crowd sentiment has more documented value on lower-market-cap names than you might expect** — a 2025 event-study found that explicit crowd-sourced trading signals from social platforms significantly predicted short-term crypto price moves, and the effect was *stronger* for lower-market-cap assets and names with recent negative returns ([Electronic Markets, Springer](https://link.springer.com/content/pdf/10.1007/s12525-025-00815-6.pdf)) — which is exactly your coin universe. This is a more relevant sentiment source for you than general BTC/ETH news-sentiment models.
- **Skip options data and deep on-chain analytics for now.** They're built for and most useful on major-cap, liquid assets — low marginal value for a bot trading LSK/CVC/STEEM, and meaningful engineering overhead to integrate well.

### 2.7 Preventing overfitting, leakage, and look-ahead bias

The standard failure modes are well documented and all avoidable with process discipline, not more compute:
- **Data leakage / look-ahead bias**: ensure any feature used at decision time (e.g., regime label, ATR) is computed only from data available *strictly before* the candle you're deciding on — a common bug is computing indicators on a candle using its own close before that candle has actually closed.
- **Backtest overfitting from repeated parameter search** is the single most-cited failure mode in quant literature — the more configurations you try against the same historical window, the more likely you are to find one that "worked" by chance rather than by edge ([Deflated Sharpe Ratio paper](https://www.davidhbailey.com/dhbpapers/deflated-sharpe.pdf)). Track how many configurations you've tried; if it's more than a handful, discount the result accordingly or require a longer/fresh out-of-sample window.
- **Survivorship bias** is less of a concern for you specifically (you're not backtesting a historical coin universe that includes delisted tokens), but becomes relevant if you ever backtest against "top volatility movers of the past year" — that list is itself survivorship-biased toward coins that didn't collapse to zero.

### 2.8 Modern backtesting and validation methodology

**Walk-forward analysis remains the industry "gold standard"** for trading-strategy validation — optimize on an in-sample window, test on the next out-of-sample window, then roll forward, so the strategy has to keep re-proving itself across different conditions rather than being fit once to a single lucky period ([Wikipedia: Walk forward optimization](https://en.wikipedia.org/wiki/Walk_forward_optimization); [QuantInsti](https://blog.quantinsti.com/walk-forward-optimization-introduction/)). For your ML-based additions (§2.4/§2.9), **purged cross-validation with an embargo period** is the necessary refinement over plain walk-forward or k-fold: because your labels (e.g., "did this setup win") depend on future price action, naive k-fold leaks that future information into training unless overlapping samples are purged and a time buffer (embargo) is added between train and test sets ([Purged cross-validation, Wikipedia](https://en.wikipedia.org/wiki/Purged_cross-validation)). **Combinatorial Purged Cross-Validation (CPCV)** extends this further by generating multiple train/test path combinations rather than one, and recent comparative work finds it superior to plain walk-forward for overfitting mitigation specifically, though walk-forward remains the standard for realistic live-trading simulation ([2512.12924](https://arxiv.org/pdf/2512.12924)).

**Practical recipe for you:** keep dry-run/paper trading as your walk-forward "live" out-of-sample test (which you're already doing well), and if/when you build the gradient-boosting confidence model in §2.4, train and validate it with purged CV + embargo on your accumulating Supabase trade history before ever letting its output gate a real trade.

### 2.9 Risk management: sizing, stops, fees, and regime adaptation

- **ATR-relative stops, not fixed percentages, are the standard fix for your flaw #2.** Position sizing that scales inversely with ATR (wider stop in volatile conditions → smaller size, so dollar risk stays constant) is a widely used framework specifically because fixed-percentage stops get run over by an asset's own normal noise ([automatedtradebot.com](https://automatedtradebot.com/position-sizing-for-trading-bots); [SpreadsheetsHub ATR sizing](https://spreadsheetshub.com/blogs/articles/crypto-futures-how-to-calculate-position-sizing)).
- **Kelly criterion sizing is powerful but almost never run at full size in practice** — nearly all practitioner guidance converges on quarter- to half-Kelly, both because inputs (win rate, RR) are noisy with realistic sample sizes and because full Kelly's drawdowns are behaviorally and practically brutal ([Kelly Criterion for crypto](https://www.altrady.com/blog/risk-management/kelly-criterion-crypto-position-sizing); [position sizing frameworks overview](https://medium.com/@ildiveliu/risk-before-returns-position-sizing-frameworks-fixed-fractional-atr-based-kelly-lite-4513f770a82a)). Given your ~200-trade sample, any Kelly-derived sizing should currently use conservative (quarter-Kelly or less) fractions — your inputs aren't stable enough yet for anything more aggressive.
- **Maker/limit execution materially changes your fee economics.** Bitget currently offers a promotional **-0.005% maker rebate** (i.e., you're paid, not charged) on a wide range of perpetual contracts, versus the 0.06% taker fee your log shows you paying twice per round trip ([KuCoin 2026 exchange comparison](https://www.kucoin.com/blog/10-best-crypto-futures-exchanges-2026)) — flip to maker-only entries at EMA21/VWAP retest levels and this fee line could go from a $1.21 cost to a small rebate. **Caveat: this is described as a time-limited promotion (May–June 2026)** — verify Bitget's live fee schedule before architecting around a specific rebate number.
- **Regime-adaptive risk is a documented practice, not exotic**: reducing size, widening required signal strength, or fully pausing trading when a regime classifier flags high volatility/chop is exactly the QuantStart HMM-as-risk-filter pattern in §2.3, and is the correct home for your "should the bot ever just... not trade" requirement.

### 2.10 Single model vs. multi-agent

The honest state of multi-agent LLM trading research: it's an active area, but a 2026 taxonomy survey covering 40+ papers explicitly flags that the field still lacks a cost-adjusted benchmark for whether multi-agent setups actually outperform simpler pipelines, and that failure modes under adversarial or illiquid conditions are underexplored ([SSRN taxonomy](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7017418)). Your architecture is already, functionally, a modular pipeline of specialized stages (scanner → signal detector → LLM risk router → position guardian) — that's the right shape. **Adding more agents is not your next-highest-value investment; making the risk-filter agent you already have actually filter risk is.** Multi-agent complexity (separate forecasting/portfolio/risk agents communicating with each other) is worth revisiting later, once the single-pipeline version is demonstrably profitable and you're looking to scale sophistication — not before.

---

## Part 3 — Your Bot vs. Modern Practice

| Area | What Focus Trading Engine does now | What research/industry practice suggests | Recommended change | Expected benefit | Difficulty | Compute | Solo-dev realistic? |
|---|---|---|---|---|---|---|---|
| Stop loss | Fixed 0.8% unleveraged, uniform across all coins | ATR-relative stops, sized to each asset's own volatility | Stop = entry ± (1.5–2.5× ATR); reduce leverage to 2–3x to hold dollar risk constant | Removes the single largest quantifiable flaw; should cut MAX_LOSS-from-noise rate sharply | Low | Negligible (indicator already computed) | Yes — do this first |
| Reward:risk | Realized 1.29:1 vs. 1.66:1 breakeven need at current win rate | RR should exceed breakeven given realistic win rate, or win rate must rise to compensate | Let ATR trailing stop actually engage (only possible once hard stop stops firing early); consider widening TP or trailing more aggressively on trend continuation | Turns negative structural expectancy positive on paper, before even improving signal quality | Low–Medium | Negligible | Yes |
| Coin selection | `\|24h%\| × log10(volume)`, no liquidity/spread floor | Exclude illiquid names; require volume + spread thresholds before ranking by volatility | Add minimum 24h USD volume and max bid-ask spread floor to the scanner | Stops systematically selecting the exact coins (LSK/CVC/STEEM) that blew the stop | Low | Negligible | Yes |
| Risk filter (LLM) | Single Groq call, 100% approval, narrative-only | Adversarial, criteria-based rejection; consensus across multiple calls reduces single-call noise (TrustTrade) | Rewrite prompt to require explicit falsifiable rejection criteria (RSI extension, volume z-score floor, structural support); track & alert on approval rate | Turns the LLM stage from a no-op into an actual filter | Medium | Low (same API calls, better prompt) | Yes |
| Regime awareness | CHOP/ADX WAIT logic exists but isn't tied to coin selection or position sizing | HMM or rule-based regime classification gating trade eligibility and sizing | Add a regime layer (HMM or ADX/CHOP-based) evaluated per candidate coin before entry, not just as a WAIT flag | Fewer trades in genuinely unfavorable conditions | Medium | Low–Medium | Yes |
| Loss clustering | No circuit breaker; re-entered same choppy coin repeatedly | Consecutive-loss circuit breakers are standard practice | 2 consecutive stop-outs on a symbol → 4h cooldown; add account-level daily max-loss kill switch | Prevents the 88-trade LSK / 31-trade CVC churn from recurring | Low | Negligible | Yes |
| Execution | Aggressive taker market orders on 1m breakouts | Maker/limit orders at pullback/retest levels; higher timeframe primary decision | Move primary signal to 5m/15m; execute via post-only limit at EMA21/VWAP retest | Fee line flips from cost to near-zero or rebate; cuts trade frequency ~80% | Medium | Low | Yes |
| Prediction model | None beyond indicator thresholds | Gradient boosting on engineered features is competitive with or beats deep learning for short-horizon crypto prediction | Add an XGBoost/LightGBM confidence score as a numeric gate alongside the LLM narrative check | Calibrated, backtestable "trade or don't" signal instead of only indicator thresholds + LLM vibes | Medium–High | Low (CPU-trainable) | Yes, with effort |
| Validation | 24h single dry run | Walk-forward + purged CV across multiple regimes before trusting any config | Re-test each major change across a fresh window/regime, not just re-running this same day | Avoids re-optimizing to this one report's idiosyncrasies | Medium | Low | Yes |
| Reinforcement learning | Not used | Promising in research, but myopic/unstable without large data and careful reward design | Defer — not your highest-value next step | N/A | High | Medium–High | Not yet — P4 at earliest |
| Multi-agent architecture | Already pipeline-shaped (scanner/detector/LLM/guardian) | Field lacks benchmarks showing multi-agent beats well-built single pipelines | Fix the agents you have before adding more | Avoids complexity that current research can't yet justify | — | — | Deprioritize |

---

## Part 4 — Prioritized Improvement Roadmap

### Priority 1 — Critical, fix before running another dry-run session

| # | Fix | Expected impact | Difficulty | Compute | Cost | Solo-dev realistic | Risks/limitations |
|---|---|---|---|---|---|---|---|
| 1 | Replace fixed 0.8% stop with ATR-relative stop (1.5–2.5x ATR); reduce leverage to 2–3x | High — addresses the largest single flaw (61.9% of trades stopped by noise) | Low | Negligible | Free | Yes | Wider stops mean larger per-trade losses in dollar terms if size isn't reduced correspondingly — must pair with reduced leverage/size |
| 2 | Add liquidity/spread floor to coin selector (min 24h USD volume, max spread) | High — stops systematically picking LSK/CVC-type coins | Low | Negligible | Free | Yes | May reduce available "highest volatility" candidates on quiet days — acceptable trade-off |
| 3 | Consecutive-loss circuit breaker (2 losses/symbol → 4h cooldown) + daily max-loss kill switch | High — prevents concentrated damage like the 93.7%-of-losses LSK/CVC pattern | Low | Negligible | Free | Yes | None significant |
| 4 | Rewrite LLM prompt with explicit falsifiable rejection criteria; log and alert on approval rate | Medium-High — restores the risk filter as an actual filter | Medium | Low (same call volume) | Free (existing Groq keys) | Yes | Small open models can still be inconsistent; treat as one filter layer, not the only one |

### Priority 2 — High-impact, next 2–4 weeks

| # | Fix | Expected impact | Difficulty | Compute | Cost | Solo-dev realistic | Risks/limitations |
|---|---|---|---|---|---|---|---|
| 5 | Move primary decision timeframe to 5m/15m; execute via maker-only post-only limit orders at EMA21/VWAP retests | High — cuts trade frequency ~80%, flips fee line from cost to near-zero/rebate | Medium | Low | Free | Yes | Limit orders won't always fill; need logic for missed entries; verify current maker rebate before relying on it |
| 6 | Add funding rate + open interest as inputs to the LLM's risk audit | Medium — cheap, documented leading indicator for perpetuals crowding/reversal risk | Low-Medium | Low | Free–low (most exchanges expose this natively) | Yes | Signal is probabilistic, not deterministic — treat as one more input, not a trigger on its own |
| 7 | Build rolling performance dashboard: live profit factor, expectancy, approval rate, regime distribution | Medium — turns "did it work" into a continuously monitored question instead of a one-off report | Medium | Low | Free | Yes | Requires discipline to actually act on the metrics, not just display them |
| 8 | Add a rule-based regime gate (ADX/CHOP) evaluated per-candidate-coin before entry, not just as a WAIT flag | Medium | Medium | Low | Free | Yes | Simple rule-based regime detection is cruder than HMM but far cheaper to build correctly |

### Priority 3 — Advanced AI/ML improvements

| # | Fix | Expected impact | Difficulty | Compute | Cost | Solo-dev realistic | Risks/limitations |
|---|---|---|---|---|---|---|---|
| 9 | Train a gradient-boosting (XGBoost/LightGBM) confidence classifier on engineered features + regime label, validated with purged CV + embargo | Medium-High, once enough trade history accumulates | Medium-High | Low (CPU-trainable) | Free (open-source libraries) | Yes, with real effort | Needs meaningfully more trade history than 202 to train/validate reliably; risk of overfitting a small feature set |
| 10 | Replace ad-hoc CHOP/ADX regime logic with a proper HMM regime classifier | Medium | Medium-High | Low-Medium | Free (open-source) | Yes, with some ML background | HMMs need reasonably long, clean historical data per asset; thin alts may not have enough history for a stable fit |
| 11 | Multi-call LLM consensus (2-3 short calls, discount disagreement) instead of single-pass verdict | Medium — reduces single-call noise per TrustTrade-style findings | Medium | Low (more API calls) | Low (proportional to call volume) | Yes | Added latency and cost per trade decision |

### Priority 4 — Experimental / cutting-edge

| # | Fix | Expected impact | Difficulty | Compute | Cost | Solo-dev realistic | Risks/limitations |
|---|---|---|---|---|---|---|---|
| 12 | Reinforcement learning for entry/exit timing | Unproven for your use case; research shows real gains concentrated in market-making, not clearly short-horizon altcoin directional trading | High | Medium-High | Free-Low (open-source RL libraries) but time-intensive | Not yet | Myopic behavior, reward-hacking, and instability are documented, active research problems — high risk of building something that looks good in backtest and fails live |
| 13 | Crowd/social sentiment signal (given documented stronger effect on lower-cap names) | Low-Medium, speculative for your specific coin list | Medium | Low | Low-Medium (data API costs) | Maybe | Noisy, manipulable, and coverage on very thin alts may be sparse |
| 14 | Full multi-agent system (separate forecasting/portfolio/risk agents) | Unclear — field lacks benchmarks showing this beats a well-built single pipeline | High | Medium | Low-Medium | Not yet | Added complexity without current evidence it outperforms fixing the existing pipeline |

---

## Part 5 — Recommended v3.0 Architecture

```
Bitget REST/WS
     │
     ▼
[1] Universe & Liquidity Filter  (NEW)
    volatility score AND min-volume floor AND max-spread floor
    AND not on active circuit-breaker cooldown
     │
     ▼
[2] Regime Classifier  (NEW/upgraded)
    per-candidate-coin, 15m — trending / ranging / high-vol-chop
    gates whether momentum logic may fire at all
     │
     ▼
[3] Multi-Timeframe Signal Detector  (upgraded)
    primary decision on 5m/15m closed candles
    1m used only for fine entry timing, not the base signal
     │
     ▼
[4] Confidence Scorer  (NEW, optional but recommended)
    gradient-boosting classifier on engineered features + regime label
    outputs calibrated win-probability, purged-CV validated
     │
     ▼
[5] LLM Adversarial Risk Auditor  (rebuilt)
    explicit falsifiable rejection criteria; funding/OI context
    target approval rate 20-40%, tracked & alerted
     │
     ▼
[6] Execution Layer  (rebuilt)
    maker-only post-only limit at EMA21/VWAP retest
    ATR-relative stop (1.5-2.5x ATR), reduced leverage (2-3x)
    volatility-adjusted sizing (fixed-fractional or quarter-Kelly)
     │
     ▼
[7] Position Guardian  (kept, stop/TP now ATR-derived not fixed %)
     │
     ▼
[8] Risk Governor  (NEW)
    consecutive-loss circuit breaker (per-symbol + account-wide)
    daily max-loss kill switch
    "no-edge" auto-pause if rolling profit factor < 1.0
     │
     ▼
[9] Performance & Validation Layer  (NEW)
    rolling expectancy/profit factor, walk-forward re-validation cadence
     │
     ▼
[10] Telemetry & Dashboard  (kept, extended)
```

---

## Part 6 — Validation Plan Before Risking Additional Real Money

1. **Ship Priority 1 fixes together**, then re-run a fresh dry-run session (new day, ideally a different volatility regime than this report's window). Confirm gross (pre-fee) expectancy is no longer negative and LLM approval rate has moved off ~100%.
2. **Don't judge the new config on one more 24-hour window.** Given the 5m/15m move will cut trade frequency roughly 80%, expect it to take 1-3 weeks of continuous dry-run operation to accumulate another 150-200 trades — the minimum needed before a profit factor or expectancy reading is trustworthy (§2.1).
3. **Validate any ML addition (§2.4/§9 in the architecture) with purged cross-validation and an embargo period**, not a simple train/test split, before it's allowed to gate a live decision.
4. **Re-test across more than one regime before trusting a "profitable" result.** A config that looks good only in the specific chop/trend mix of your test window may not generalize — walk it forward across at least a few weeks spanning different conditions.
5. **When moving to live (non-simulated) capital, start at the same small size ($10 or less)** to validate that real slippage, real maker-order fill rates, and real latency match what the dry-run assumed — these routinely differ from simulation. Scale up only after live results track paper results within a reasonable tolerance over another 100+ trades.
6. **Keep the "no-edge" auto-pause live permanently**, not just during testing — the goal stated at the outset (trade only with a validated edge, not constantly) is best enforced as an always-on governor, not a one-time check.
7. **Resist re-optimizing repeatedly against this same report.** Every additional parameter search against this one 24-hour dataset increases the odds that whatever "wins" is a lucky fit to this specific day, not a real edge (§2.1, §2.7).

---

## Part 7 — Top 5 Highest-Impact Changes

1. **ATR-relative stops + reduced leverage.** Fixes the single largest, most rigorously quantifiable flaw: the strategy's stop/TP math doesn't clear its own 1.66:1 breakeven bar at the observed 37.62% win rate.
2. **Liquidity/spread floor on the coin selector.** Removes the structural reason LSK/CVC/STEEM kept getting picked in the first place — addresses 93.7% of net losses at the source, not just the symptom.
3. **Consecutive-loss circuit breaker + daily kill switch.** Cheap, low-risk, prevents any remaining edge-negative period from compounding into concentrated damage.
4. **Rebuild the LLM stage as an actual adversarial filter** with falsifiable rejection criteria and a monitored approval rate — turns a 100%-rubber-stamp stage into the risk filter it was meant to be.
5. **Move to 5m/15m primary timeframe with maker-only limit execution.** Simultaneously reduces false-breakout exposure (higher timeframe = less HFT noise) and flips the fee line from an $1.21 cost to near-zero or a small rebate.

---

## Sources

- Bailey & López de Prado, [The Deflated Sharpe Ratio](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2460551) / [full paper PDF](https://www.davidhbailey.com/dhbpapers/deflated-sharpe.pdf) / [Wikipedia summary](https://en.wikipedia.org/wiki/Deflated_Sharpe_ratio)
- [Purged cross-validation, Wikipedia](https://en.wikipedia.org/wiki/Purged_cross-validation); [Walk forward optimization, Wikipedia](https://en.wikipedia.org/wiki/Walk_forward_optimization); [QuantInsti WFO guide](https://blog.quantinsti.com/walk-forward-optimization-introduction/); [Rigorous walk-forward + CPCV framework, arXiv](https://arxiv.org/pdf/2512.12924)
- [AI Agents in Financial Markets survey, arXiv](https://arxiv.org/html/2603.13942v1); [LLM/Multi-Agent Trading taxonomy, SSRN](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7017418); [TrustTrade selective consensus, arXiv](https://arxiv.org/pdf/2603.22567); [Adversarial news manipulation of LLM trading agents, arXiv](https://arxiv.org/abs/2601.13082)
- [HMM regime detection, Bitcoin 2024-2026 study](https://www.academia.edu/165182244/Markov_and_Hidden_Markov_Models_for_Regime_Detection_in_Cryptocurrency_Markets_Evidence_from_Bitcoin_2024_2026_); [HMM as risk-management filter, QuantStart](https://www.quantstart.com/articles/market-regime-detection-using-hidden-markov-models-in-qstrader/); [QuantifiedStrategies overview](https://www.quantifiedstrategies.com/hidden-markov-model-market-regimes-how-hmm-detects-market-regimes-in-trading-strategies/)
- [Gradient boosting vs. LSTM comparative study, Discover AI/Springer](https://link.springer.com/article/10.1007/s44163-025-00519-y); [Six-architecture crypto forecasting benchmark, Symmetry 2025](https://doi.org/10.3390/sym18010032); [Transformers vs LSTMs on crypto LOB data, arXiv](https://arxiv.org/pdf/2309.11400); [Cryptocurrency trading survey, arXiv](https://arxiv.org/pdf/2003.11352)
- [RL in financial decision-making meta-review, arXiv](https://arxiv.org/html/2512.10913v1); [Language-model-guided RL limitations, arXiv](https://arxiv.org/html/2508.02366v1)
- [Maker/taker fee structures 2026, KuCoin](https://www.kucoin.com/blog/10-best-crypto-futures-exchanges-2026); [Maker vs taker fee optimization guide](https://blofin.com/en/academy/education/maker-vs-taker)
- [Funding rate / open interest signals, Gate.io](https://www.gate.com/crypto-wiki/article/how-to-interpret-crypto-derivatives-market-signals-funding-rates-open-interest-and-liquidation-data-explained-20251227); [October 2025 crash microstructure analysis, Amberdata](https://blog.amberdata.io/how-3.21b-vanished-in-60-seconds-october-2025-crypto-crash-explained-through-7-charts)
- [On-chain analytics tools overview, BingX](https://bingx.com/en/learn/article/what-are-the-top-on-chain-analysis-tools-for-crypto-traders); [Crowd/social trading signals predictive power, Electronic Markets/Springer](https://link.springer.com/content/pdf/10.1007/s12525-025-00815-6.pdf)
- [ATR/Kelly/fixed-fractional position sizing frameworks](https://medium.com/@ildiveliu/risk-before-returns-position-sizing-frameworks-fixed-fractional-atr-based-kelly-lite-4513f770a82a); [ATR position sizing for bots](https://automatedtradebot.com/position-sizing-for-trading-bots); [Kelly criterion for crypto](https://www.altrady.com/blog/risk-management/kelly-criterion-crypto-position-sizing)
- [Statistical significance / sample size in trading](https://www.darwintiq.com/articles/statistical-significance-in-trading); [How many trades for a real edge](https://traderssecondbrain.com/guides/do-you-have-trading-edge)
- [False breakouts / whipsaw in low-liquidity markets](https://finwiz.io/technical-analysis/whipsaw); [Illiquid altcoin volume filtering practice](https://academy.exmon.pro/crypto-volatility-screener-find-breakout-altcoins-fast)
