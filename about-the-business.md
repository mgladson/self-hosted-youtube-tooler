# About the Business

A plain-language overview of what this product is, who it is for, and the real
risks of running it (with the payment-processor problem treated as the main one).

---

## 1. General Product Information

**What it is:** a self-hosted YouTube toolkit. Paste a YouTube URL and get back
the things creators, marketers, and researchers pull out of a video, with no
install and no account required to start.

The tools:

| Feature | Where it runs | Free | Paid (Pro) |
| --- | --- | --- | --- |
| Thumbnails (every size, frame grabs, copy & download) | Browser | Unlimited | Unlimited |
| Metadata (title, description, tags, keywords) | Browser | 25 / day | Unlimited |
| Transcripts (view, copy, export TXT / MD / SRT) | Server | 25 / day | Unlimited |
| Audio (MP3) & up to 720p downloads | Server | 3 / day | Unlimited |
| HD downloads (1080p, 1440p, 4K) | Server | No | Yes |
| Unlimited daily downloads | Server | No | Yes |
| Priority processing (no throttling) | Server | No | Yes |

**How it works (this matters for the risk section):**

- **Thumbnails and metadata/tags run in the visitor's own browser**, sourced from
  YouTube's public image CDN and YouTube's oEmbed / official Data API. These are
  sanctioned, low-risk, and cost us nothing.
- **Transcripts and downloads run server-side through `yt-dlp`** (plus ffmpeg to
  merge video). yt-dlp reaches YouTube's private internal client API ("InnerTube")
  by impersonating the YouTube Android app, which is how it gets past YouTube's
  anti-bot / PO-token wall. This is **not** an API Google offers to developers. It
  is the same technique every YouTube downloader uses, and it is against YouTube's
  Terms of Service.
- To run at scale, the server path routes yt-dlp through a rotating pool of
  residential / ISP proxies (`YT_DLP_PROXY`) so the traffic does not all originate
  from one server IP and trip YouTube's blocks. Transcripts are cached (Valkey, 30
  days, since they never change). Downloads have an optional Cloudflare R2 cache
  (24h) to cut repeat bandwidth cost.

**Stack:** Next.js storefront (mostly Server Components), Fastify API, Postgres,
Valkey cache, MinIO / R2 object storage, Stripe for billing, all in Docker Compose.
Production runs on a Hetzner bare-metal box where egress is free and unmetered, so
the only real variable cost is proxy traffic (roughly cents per transcript or
download).

**Monetization:** Free vs Paid subscription. Monthly is $10/mo; annual is $8/mo
billed once a year ($96/yr, about 20% off). The paywall sits on **downloads**:
HD/4K, unlimited daily downloads, and priority processing. This is deliberate:
transcripts are cheap (cached, immutable), but downloads are the expensive part
(proxy bandwidth plus compute), so that is where the money gate belongs.

---

## 2. Target User / Audience

**Primary audiences:**

- **Content creators, YouTubers, video editors:** pulling thumbnails, titles,
  tags, and transcripts for research, repurposing, competitive analysis, and
  reusing footage.
- **Marketers and SEO people:** harvesting tags, titles, and descriptions to
  reverse-engineer what ranks.
- **Researchers, students, journalists:** who want a clean text transcript of a
  talk, lecture, or interview.
- **The broad "I just want the MP3 or the video file" crowd:** the high-volume,
  low-intent traffic that any "youtube downloader" search captures.

**The positioning split that matters:** the defensible-sounding audience
(transcripts, metadata, thumbnails for creators and researchers) is who the
storefront leads with. The download crowd is the high-traffic monetization engine
but also the part that attracts processor and legal scrutiny, so it stays
lower-key in marketing.

**Reach:** global, fully self-serve, no sales process, English UI today.

**Not the audience:** enterprise / B2B buyers, anyone needing a contract or SLA,
or anyone who needs YouTube's official blessing. This is explicitly an unofficial
tool.

---

## 3. Risks of Running This Business, and Solutions

The single most important reframe: there are **two separate risks that look like
one**. Conflating them leads to bad decisions.

### Risk A: Legal / Terms of Service (low, manageable)

- The yt-dlp transcript and download path **violates YouTube's Terms of Service**
  (the ToS bans automated access and downloading outside YouTube's own download
  button). This is a contract matter between us and YouTube. It is **not a crime**.
- yt-dlp itself is legal software (the RIAA tried to remove it from GitHub in 2020
  and lost). Realistic worst cases: YouTube blocks our IPs (already handled by the
  proxy pool and caching), or, if we get large and loud, a cease-and-desist or DMCA
  notice. Copyright liability mostly attaches to *redistribution*; a tool that lets
  a user fetch a file is grey but very commonly operated.
- **Mitigations:** do not market "pirate copyrighted videos"; respond to any DMCA
  or cease-and-desist promptly; keep the legally cleaner features (transcripts,
  metadata, thumbnails) as the public face. (None of this is legal advice. If
  revenue becomes real, get a lawyer's read.)

### Risk B: Payment Processor (high, near-term, the one that actually bites)

This is the real threat to the money. A processor does not hold a trial; it runs a
risk model. "Products or services that enable infringement of copyright or a third
party's terms of service" is a **verbatim prohibited-business clause** at Stripe,
Paddle, and Dodo (all checked). When a compliance review or a single complaint
flags us into that bucket, the response is not a polite email. It is the **account
frozen and funds held for 90 to 180 days**, usually after a balance has built up.

**Verdict: Stripe is the right primary, and not because we already built it.**
Score the options against what actually matters here (cheapest per-transaction fee,
end-user UX, frequent fee-free low withdrawals, easy integration, grey-area
tolerance) and Stripe wins four of the five outright, and nothing else on the table
beats it on the fifth either:

- **Fees:** Stripe 2.9% + 30c. MoRs are 4 to 6%+. High-risk acquirers 4 to 14%.
- **UX:** Stripe Checkout natively does cards, Apple Pay, Google Pay, PayPal, and
  Link. Best available.
- **Withdrawals:** Stripe standard payouts are **free, $0.01 minimum, automatic
  daily**. The MoRs structurally fail this: Lemon Squeezy holds a $50 minimum, pays
  twice a month, and charges $0.50 per US payout; Paddle holds a $100 minimum and
  pays once a month. The "withdraw low amounts, often, for free" requirement alone
  eliminates the entire MoR category.
- **Integration:** Stripe is the best-documented API in the space, and already wired.
- **Grey-area tolerance:** the only criterion Stripe loses, and it loses it tied
  with every other mainstream option. The MoRs are *worse* here, not better, because
  an MoR legally becomes the seller and so screens the grey area harder and drops
  faster.

**Why no MoR makes sense for us specifically:** a Merchant of Record's entire value
proposition is handling global VAT / sales-tax compliance. We have explicitly
decided not to care about VAT at this scale. So an MoR (Paddle, Lemon Squeezy,
FastSpring, Dodo, 2Checkout/Verifone) charges a higher rate, pays out on a slow
schedule with minimums and fees, *and* screens the grey area harder, all in exchange
for a tax benefit we do not want. Strictly worse trade. (Lemon Squeezy is now
Stripe-owned and inherits Stripe's exact AUP, so it is not even an escape from
Stripe's policy.)

**How we define the business to a processor:** a **"video transcript and
content-analysis / media-utility toolkit."** Lead with transcripts, metadata,
thumbnails, and caption export. The download feature is framed as a "media utility,"
and the thing actually being billed is "a subscription that raises usage limits and
unlocks HD and priority," which is benign and true. Keep this framing consistent
across the website, the Stripe business description, the checkout product name, and
support replies.

**Solutions ladder (what we actually do):**

1. **Primary: Stripe + positioning + daily sweep.** The freeze risk is the one real
   downside, and it is *managed*, not processor-shopped away (managing it is cheaper
   than any processor that would tolerate us). A freeze only bites the balance
   sitting in the account, so we keep that near zero. See the payout runbook below.
   Accept that the account can still be cut off, and stay rebuild-ready (keep
   customer and billing data portable).
2. **Durable: high-risk merchant account** (a dedicated acquirer such as
   PaymentCloud, DirectPayNet, or Durango-type providers; or a high-risk
   subscription biller like CCBill / Verotel). They *expect* grey digital goods and
   will not freeze us for being what we declared. Cost: roughly 4 to 14%, a monthly
   fee, and a rolling reserve (they hold back ~5 to 10% for ~6 months, which itself
   works against frequent withdrawals). Stand this up only when volume makes a freeze
   likely enough to matter, not before.
3. **Backup rail: crypto** (BTCPay self-hosted, NOWPayments, Coinbase Commerce). No
   copyright acceptable-use clause, irreversible payments (zero chargebacks), but
   lower conversion for normal users. Secondary "cannot be frozen" option, not the
   default checkout.

**Stripe payout + chargeback-buffer runbook:**

- **Payout schedule:** Dashboard → Settings → Payouts → set **Automatic, Daily**.
  Standard payouts are free and pay out the available balance every business day, so
  parked funds stay minimal without paying the 1 to 1.5% Instant Payout fee. (New
  accounts sit on a longer initial rolling window, often 7 to 14 days, before the
  daily cadence settles in. Normal; it eases as history builds.)
- **Do not sweep to literal zero.** Chargebacks and refunds land *after* the sale (a
  card dispute can arrive up to ~120 days later), and Stripe debits them from the
  balance first; if the balance is empty it debits the linked bank or pushes the
  account negative. Keep a self-set buffer in the Stripe balance: **the greater of
  ~$300 to $500 or ~5% of trailing-30-day net revenue.** That absorbs a bad dispute
  stretch without bouncing to the bank. Keep the linked bank account funded as the
  secondary backstop, and do not close it even if we pause the business (late
  disputes). Treat the number as a starting heuristic and adjust to the real observed
  dispute rate.
- **Keep the dispute rate down** (card networks flag merchants around 0.9 to 1%;
  Stripe warns earlier): a clear statement descriptor matching the brand cuts "I
  don't recognize this charge" disputes, Radar + 3DS/SCA cut fraud disputes, and an
  easy self-serve cancel/refund cuts "I couldn't cancel" disputes.
- **Statement descriptor (locked spec; only the literal word is pending a brand):** it
  is a Stripe setting, not code. Nothing in `api/src` sets `statement_descriptor`, so
  charges inherit the account default from Dashboard → Settings → Business → statement
  descriptor. Decision: **the bare brand name in caps, no suffix** (brand "Foo" →
  `FOO`), 5 to 22 chars, at least 5 letters, none of the characters `< > \ ' " *`, set
  once at account level (leave the API inheriting it, no code change). It must match
  the site name the buyer just saw at checkout, and must contain no `YT / YOUTUBE /
  DOWNLOAD / MP3 / RIP / DL`. Set the optional shortened descriptor (≤10 chars) to the
  same word. **Launch blocker:** do not ship with a placeholder or Stripe's auto-guess
  (a "YOUR SITE" or mismatched descriptor is exactly what triggers "I don't recognize
  this charge" disputes). Drop in the real word once the name is chosen.

**Business structure note (US, personal income):** operating as a sole proprietor
is fine. Income flows onto Schedule C of the personal return, and processors will
issue a 1099-K. No incorporation or business license is needed federally just to
accept payments (local rules vary). An LLC is not required, but it (a) smooths
onboarding with some processors and (b) provides liability separation if the
copyright side ever gets hot.

### Other operational risks (brief)

- **YouTube breaks the extraction.** They periodically shift the anti-bot wall,
  which breaks yt-dlp until it ships a fix. Mitigation: keep yt-dlp updated; the
  Android-client parameters drift. This is a "service down until patched" risk, not
  a fatal one.
- **Proxy cost and abuse.** Downloads are the cost center. The paywall, per-IP rate
  limits, daily quotas, and the R2 cache keep it bounded. Watch for free-tier abuse.
- **Single point of failure on payments.** Mitigated by having rail #2 or #3 ready
  *before* rail #1 is cut off, not after.
