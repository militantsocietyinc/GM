# How OSINT Practitioners Collect Data from Twitter/X and Telegram

> Research compiled: March 2026
> Context: Educational guide for understanding OSINT data collection methods

---

## Table of Contents

1. [Twitter/X: The API Landscape](#twitterx-the-api-landscape)
2. [Twitter/X: Alternatives to the Official API](#twitterx-alternatives-to-the-official-api)
3. [Twitter/X: How OSINT Teams Actually Get Data](#twitterx-how-osint-teams-actually-get-data)
4. [Telegram: Not WhatsApp -- A Fundamentally Different Platform](#telegram-not-whatsapp----a-fundamentally-different-platform)
5. [Telegram: How OSINT Uses It](#telegram-how-osint-uses-it)
6. [Telegram: The API (Free and Powerful)](#telegram-the-api-free-and-powerful)
7. [Telegram: Key OSINT Channels](#telegram-key-osint-channels)
8. [How omni-sentinel Uses Telegram](#how-omni-sentinel-uses-telegram)
9. [Platform Comparison Table](#platform-comparison-table)
10. [Cost Comparison: Getting 100K Tweets](#cost-comparison-getting-100k-tweets)
11. [Recommendations](#recommendations)

---

## Twitter/X: The API Landscape

### The Big Picture

Twitter/X has the most valuable real-time public discourse data on the internet. Journalists, researchers, intelligence analysts, and OSINT practitioners all need access to it. But since Elon Musk's acquisition, API access has become dramatically more expensive and restrictive.

Here is how the official API tiers work as of March 2026:

### Official API Tiers

#### Free Tier -- $0/month
- **What you get**: Write-only access. You can post up to ~500 tweets/month.
- **What you CAN'T do**: No reading tweets. No search. No user lookup. No timeline access.
- **OSINT value**: Zero. This tier is useless for data collection.
- **Use case**: Bots that post automated content (weather alerts, etc.)

#### Basic Tier -- $200/month
- **Read limit**: ~15,000 tweet reads per month
- **Write limit**: ~50,000 posts per month
- **Search**: Yes, but **only the last 7 days** of tweets
- **Endpoints**: Most common endpoints (tweet lookup, user lookup, timeline, search)
- **Rate limits**: 15-minute rolling windows
- **OSINT value**: Minimal. 15K reads is tiny for any serious monitoring. 7-day search window means no historical research.
- **The math**: 15,000 tweets / 30 days = 500 tweets/day. That is roughly one medium-traffic account's daily output.

#### Pro Tier -- $5,000/month
- **Read limit**: 1,000,000 tweet reads per month
- **Write limit**: 300,000 posts per month
- **Search**: **Full archive search** (all of Twitter history, back to 2006)
- **Filtered stream**: Real-time firehose with keyword/user/location filters
- **OSINT value**: This is where real work begins. Full archive + filtered streams = actual intelligence capability.
- **The gap**: $200 to $5,000 is a 25x price jump. This is the "valley of death" that kills most indie researchers.

#### Enterprise Tier -- $42,000+/month (custom pricing)
- **Everything in Pro** plus dedicated account management
- **Higher rate limits** and custom data volumes
- **Compliance endpoints** for regulated industries
- **OSINT value**: For large organizations (news agencies, government contractors, major research institutions)

#### Pay-Per-Use (NEW -- February 2026)
X launched a pay-as-you-go model on February 6, 2026:
- **How it works**: Purchase credits in advance; each API call deducts from your balance
- **Cost**: Varies by endpoint; reading a post starts at ~$0.005 per read
- **X's estimate**: "Moderate monthly usage" costs ~$215/month
- **Legacy free tier users** get a one-time $10 voucher
- **Still available alongside** the fixed monthly tiers (Basic/Pro)
- **OSINT value**: Potentially useful for occasional/bursty research. Still expensive at scale.

### What Can You Search For?

| Capability | Free | Basic ($200) | Pro ($5,000) | Enterprise |
|---|---|---|---|---|
| Search by keyword | No | Yes (7 days) | Yes (full archive) | Yes (full archive) |
| Search by hashtag | No | Yes (7 days) | Yes (full archive) | Yes (full archive) |
| Search by user | No | Yes (7 days) | Yes (full archive) | Yes (full archive) |
| Search by location | No | Yes (7 days) | Yes (full archive) | Yes (full archive) |
| Real-time filtered stream | No | No | Yes | Yes |
| Full archive access | No | No | Yes | Yes |
| Monthly read quota | 0 | 15K | 1M | Custom |

Sources:
- [X API Pricing Tiers 2025](https://twitterapi.io/blog/twitter-api-pricing-2025)
- [X API Pricing 2026 -- Every Tier Explained](https://www.wearefounders.uk/the-x-api-price-hike-a-blow-to-indie-hackers/)
- [X API Pay-Per-Use Announcement](https://devcommunity.x.com/t/announcing-the-launch-of-x-api-pay-per-use-pricing/256476)
- [Twitter API Pricing 2026: Tiers, Costs & Alternatives](https://www.xpoz.ai/blog/guides/understanding-twitter-api-pricing-tiers-and-alternatives/)

---

## Twitter/X: Alternatives to the Official API

Because the official API is so expensive, an entire ecosystem of third-party services has emerged. These generally work by scraping Twitter's web interface or using internal/undocumented APIs, then reselling the data through their own REST APIs.

### 1. TwitterAPI.io

The most prominent third-party alternative as of 2026.

- **Pricing**: $0.15 per 1,000 tweets; $0.18 per 1,000 user profiles; $0.15 per 1,000 followers
- **Free credits**: $0.10-$1.00 for new users, no credit card required
- **Auth required from you**: No. You don't need a Twitter developer account.
- **How it works**: You get a TwitterAPI.io API key. You call their endpoints. They handle scraping/data retrieval.
- **Features**: Tweet search, user profiles, followers/following, trends, real-time data
- **OSINT value**: High. Pay-per-use model means you only pay for what you need. No monthly commitment.
- **Risk**: Third-party service; could be shut down if X enforces ToS aggressively.
- **Website**: [twitterapi.io](https://twitterapi.io/)

### 2. SocialData API

- **Pricing**: $0.20 per 1,000 tweets or user records
- **Monitoring**: $0.0002 per tweet delivered via search monitors; flat $0.0002 per execution if no results
- **Features**: Tweet search, user profiles, followers, real-time monitoring
- **OSINT value**: Good for continuous monitoring with the search monitor feature
- **Website**: [socialdata.tools](https://socialdata.tools/)

### 3. Apify Twitter Scrapers

Apify is a web scraping platform with a marketplace of "actors" (pre-built scrapers).

- **Pricing**: Multiple scrapers available, ranging from $0.20-$0.40 per 1,000 tweets
- **Profile scraping**: ~$3.00 per 1,000 profiles
- **Pro options**: Some actors charge $24.99/month + usage
- **Strengths**: Good for bulk historical data projects. Many community-maintained scrapers.
- **OSINT value**: Flexible. Good for one-off research projects.
- **Website**: [apify.com/scrapers/twitter](https://apify.com/scrapers/twitter)

### 4. Nitter Instances

Nitter was an open-source, privacy-focused Twitter frontend that let you browse Twitter without JavaScript or an account.

**Current status (March 2026):**
- The original developer shut down the project in early 2024 when Twitter removed guest accounts
- **Development resumed** in February 2025, with nitter.net coming back online
- Instances now **require registered Twitter accounts** to function (no more guest access)
- Some public instances still work (xcancel.com, some community instances)
- Running a large public instance is "difficult and expensive"; small private instances are feasible
- **OSINT value**: Limited. Useful for quick manual browsing without a Twitter account, but unreliable for automated data collection.

Sources: [Nitter Instance Health](https://status.d420.de/), [Nitter Wikipedia](https://en.wikipedia.org/wiki/Nitter)

### 5. RapidAPI Twitter Endpoints

RapidAPI hosts hundreds of third-party Twitter API wrappers.

- **Quality varies wildly** -- some are excellent, many are abandoned
- **Notable option**: "Old Bird v2" mimics the old Twitter API at reasonable prices
- **Pricing**: Varies by provider; typically $10-50/month for basic access
- **Risk**: Quality and reliability are inconsistent. Some providers disappear without notice.
- **OSINT value**: Use with caution. Good as a backup, not as a primary source.

### 6. Twexapi

- **Pricing**: Starting at $50/month for unlimited access
- **Features**: No rate limits, 200+ QPS (queries per second), real-time data
- **OSINT value**: Good for high-volume monitoring if reliability holds up
- **Website**: [twexapi.io](https://twexapi.io/)

### 7. TweetAPI

- **Pricing**: Starting at $17/month, up to 180 requests/minute
- **OSINT value**: Budget option for light monitoring
- **Website**: [tweetapi.com](https://www.tweetapi.com)

### 8. Bright Data

- **Pricing**: Pay-as-you-go starting at $1.50 per 1,000 records; Growth Plan $499/month; Scale Plan $999/month
- **Strengths**: Enterprise-grade infrastructure, proxy network, compliance features
- **OSINT value**: For organizations that need bulletproof reliability and legal cover
- **Website**: [brightdata.com](https://brightdata.com/)

### 9. Direct Web Scraping (DIY)

Python libraries like `snscrape` and `twscrape` allow direct scraping of Twitter's web interface.

- **Cost**: Free (your compute + proxy costs)
- **snscrape**: Retrieves profiles and tweets without API limits on volume or date range
- **twscrape**: Fast scraper for public profiles and tweets
- **Risk**: Twitter actively fights scrapers. Accounts get banned. IPs get blocked. Requires proxy rotation.
- **Legal status**: See below.

### Legal Considerations for Scraping

Key court cases have established the following legal landscape:

- **hiQ v. LinkedIn (2022)**: Scraping publicly available data does not violate the Computer Fraud and Abuse Act (CFAA)
- **Van Buren v. United States (2021)**: Supreme Court narrowed the CFAA -- accessing data you're authorized to view is not "unauthorized access"
- **X v. anonymous scrapers**: X has sued scrapers who overwhelmed its servers, using "trespass to chattels" claims
- **Terms of Service**: Courts have generally ruled that ToS violations alone do not trigger federal criminal law, but can support civil contract claims

**Bottom line for OSINT**: Scraping public tweets is likely legal, but:
- Respect rate limits (don't hammer servers)
- Don't scrape behind login walls under false pretenses
- Don't redistribute bulk data commercially without understanding licensing
- Consider jurisdictional differences (EU, etc.)

Sources: [Web Scraping Legal Issues 2025](https://groupbwt.com/blog/is-web-scraping-legal/), [hiQ case analysis](https://www.whitecase.com/insight-our-thinking/web-scraping-website-terms-and-cfaa-hiqs-preliminary-injunction-affirmed-again)

---

## Twitter/X: How OSINT Teams Actually Get Data

### Bellingcat's Approach

Bellingcat, the gold standard of OSINT organizations, uses a combination of methods:

1. **Manual research**: Analysts use Twitter's web search (advanced search operators) for initial discovery
2. **Custom tools**: Their hackathons produced tools like "Blattodea" -- a GUI tool that scrapes post info from specified accounts and generates network visualizations
3. **Community tools**: They maintain an [Online Investigation Toolkit](https://bellingcat.gitbook.io/toolkit) with free open-source tools
4. **Methodology over tools**: Bellingcat emphasizes that the real skill is investigative methodology, not any specific tool
5. **Post-Musk challenges**: They have noted that Twitter/X has become significantly harder to use for OSINT since the acquisition

### Typical OSINT Practitioner Stack

Most serious OSINT practitioners use a layered approach:

1. **Discovery**: Manual browsing + Twitter advanced search operators
2. **Monitoring**: Third-party API (TwitterAPI.io, SocialData) for continuous keyword/account monitoring
3. **Historical research**: Pro API tier or third-party services for archive access
4. **Archiving**: Tools like Wayback Machine, archive.today, or local screenshots for evidence preservation
5. **Analysis**: Network analysis tools, geolocation tools, metadata extractors

### Twitter Advanced Search Operators (Free, Manual)

You don't always need the API. Twitter's advanced search is powerful:

```
from:username               -- Tweets from a specific user
to:username                 -- Replies to a user
"exact phrase"              -- Exact phrase match
keyword1 OR keyword2        -- Boolean OR
keyword -exclude            -- Exclude a term
since:2026-01-01            -- Date range start
until:2026-03-01            -- Date range end
near:"Kyiv" within:50km    -- Geographic search
filter:media                -- Only tweets with media
min_replies:100             -- Minimum engagement
lang:en                     -- Language filter
```

These work directly at [twitter.com/search-advanced](https://twitter.com/search-advanced) -- no API needed.

Sources: [Bellingcat Resources](https://www.bellingcat.com/category/resources/), [Twitter OSINT Advanced Search](https://www.authentic8.com/blog/twitter-x-osint)

---

## Telegram: Not WhatsApp -- A Fundamentally Different Platform

This is the most important conceptual shift to understand. **Telegram is not a private messaging app like WhatsApp.** While it can do private messaging, that is only one small part of what it is.

### The Three Types of Telegram Communication

#### 1. Private Chats (Like WhatsApp)
- One-on-one messaging between two people
- End-to-end encrypted (in "Secret Chats" mode)
- Not accessible to OSINT practitioners
- This is what most people think Telegram is

#### 2. Groups (Like WhatsApp Groups, but Bigger)
- Up to **200,000 members** (WhatsApp max is 1,024)
- Can be **public** (anyone can join via link) or **private** (invite only)
- All members can post messages
- New members may or may not see message history (configurable)
- **OSINT value**: Public groups are goldmines. Members discuss, share info, argue, leak

#### 3. Channels (Nothing Like WhatsApp -- This is the Key Concept)
- **One-way broadcast**: Only admins post. Subscribers read.
- **Unlimited subscribers** (some channels have millions)
- **Always shows full history**: Anyone who joins can see every past message
- **Public channels have a URL**: `t.me/channelname` -- anyone can read without even joining
- **No member list visible** to subscribers
- Think of it as a **blog/RSS feed/news wire** inside a messaging app

**This is the fundamental difference**: Telegram channels are essentially **public broadcasting platforms**. They are more like Twitter feeds or RSS feeds than like WhatsApp chats. Anyone can read them. Anyone can build tools to monitor them. And the content ranges from breaking news to military intelligence to government announcements.

### Why This Matters for OSINT

WhatsApp is a black box -- you can only see messages in groups you've joined, and there's no public content to monitor. Telegram is the opposite: tens of thousands of public channels broadcast information 24/7, and all of it is accessible via API.

| Feature | Telegram Channels | WhatsApp | Twitter/X |
|---|---|---|---|
| Public content anyone can read | Yes | No | Yes |
| Full message history visible | Yes | No | Yes (with API) |
| API access to read | Free | No API for messages | $200-$5,000/mo |
| Subscriber limit | Unlimited | 1,024 per group | N/A (followers) |
| Media support | Photos, video, docs, polls | Photos, video, docs | Photos, video |
| Anonymous reading | Yes (public channels) | No | Partially (limited) |

Sources: [Telegram Channel vs Group](https://www.such.chat/blog/telegram-channel-vs-group-whats-the-difference), [Telegram FAQ](https://telegram.org/faq)

---

## Telegram: How OSINT Uses It

### 1. Military Bloggers (Milbloggers)

Telegram is the **primary platform** for real-time conflict reporting, especially in the Russia-Ukraine war.

**Russian milbloggers** (the "Z-community"):
- Embedded with troops, posting real-time frontline updates
- Share drone footage, equipment photos, troop movements
- Run crowdfunding for military equipment
- Often post information faster than official military channels
- Examples: WarGonzo, Rybar, Military Informant

**Ukrainian channels**:
- Air Force Command posts air raid alerts in real-time
- Military units share engagement results
- Volunteer organizations coordinate supplies
- OSINT groups geolocate Russian positions

**Why Telegram for military content**: Unlike Twitter, Telegram has minimal content moderation for military/violent content. Channels can post graphic combat footage, detailed maps of troop positions, and equipment destruction videos that would be removed from other platforms.

### 2. Breaking News Channels

Telegram channels often break news **minutes to hours** before traditional media:

- **Aurora Intel** (@AuroraIntel): Global events as they happen, Middle East focus
- **BNO News** (@BNONews): Breaking news aggregator, one of the fastest in the world
- **LiveUAMap** (@LiveUAMap): Real-time conflict mapping
- **The Spectator Index** (@spectatorindex): Geopolitical developments

### 3. Government and Official Channels

Governments use Telegram channels for official communications:

- **Ukrainian Air Force** (@kpszsu): Real-time air raid alerts
- **Iranian government channels**: Official statements and press releases
- **Russian government/military channels**: Official briefings
- City-level emergency services in Ukraine, Russia, and Middle East

### 4. Citizen Journalism

Ordinary people in conflict zones broadcast what they see:

- Residents of bombed cities posting damage photos
- Witnesses to military movements
- Protest documentation in countries with limited press freedom

### 5. How to FIND Relevant Channels

- **Telegram's built-in search**: Search for keywords, channel names, or usernames
- **Directories**: Sites like tgstat.com, telemetr.io index public channels with analytics
- **Community lists**: OSINT community members share curated channel lists (like the one in this project's `telegram-channels.json`)
- **Cross-referencing**: Channels mention other channels; follow the network
- **OSINT toolkits**: Bellingcat's toolkit, The OSINT Toolbox on GitHub

### 6. Recent Developments (2025-2026)

- **June 2025**: Telegram blocked multiple OSINT-focused channels including Ukrainian OSINT groups (OSINT Bees, Cat Eyes OSINT, OSINT Georgia) and channels from Belarus and Russia
- **February 2026**: The Kremlin initiated a sweeping crackdown on Telegram, throttling services and pushing users toward a state-controlled alternative. This sparked backlash from soldiers and pro-war bloggers who rely on Telegram for military communications.
- These events highlight that Telegram OSINT is not risk-free -- channels can be blocked, and platform availability in certain regions is uncertain.

Sources: [Telegram OSINT Channels and WhatsApp Disruptions](https://www.specialeurasia.com/2025/07/01/telegram-whatsapp-osint-russia/), [Flashpoint: Why Telegram is Essential](https://flashpoint.io/blog/why-telegram-is-essential-to-open-source-investigations/), [Authentic8: Understanding Telegram for OSINT](https://www.authentic8.com/blog/telegram-osint-research)

---

## Telegram: The API (Free and Powerful)

This is where Telegram truly shines for OSINT. Telegram offers **two free APIs**, and both are far more generous than anything Twitter offers.

### API Option 1: Telegram Bot API

- **Cost**: Free
- **Setup**: Message @BotFather on Telegram, create a bot, get a token
- **What it can do**: Send messages, read messages in groups where the bot is a member, respond to commands
- **Limitations**: Bots can only read messages in groups/channels where they've been added as members. Can't browse arbitrary public channels.
- **Rate limits**: 30 messages/second for sending; reading is more generous
- **OSINT value**: Moderate. Good for building alert bots that forward messages from channels you manage.

### API Option 2: Telegram MTProto API (via Telethon)

This is the real power tool for OSINT.

- **Cost**: Free
- **Setup**: Register at [my.telegram.org](https://my.telegram.org) to get `api_id` and `api_hash`
- **Library**: [Telethon](https://github.com/LonamiWebs/Telethon) (Python 3)
- **What it can do**:
  - Read **any public channel** without joining it
  - Search messages by keyword within channels
  - Download all media (photos, videos, documents)
  - Get full channel history (every message ever posted)
  - List channel members (for public groups)
  - Monitor channels in real-time for new messages
  - Export structured data (timestamps, message IDs, sender info, media URLs)

#### Code Example: Reading a Public Channel

```python
from telethon import TelegramClient

api_id = 12345          # from my.telegram.org
api_hash = 'your_hash'  # from my.telegram.org

client = TelegramClient('session_name', api_id, api_hash)

async def main():
    # Read last 100 messages from a public channel
    channel = await client.get_entity('https://t.me/AuroraIntel')

    async for message in client.iter_messages(channel, limit=100):
        print(f"[{message.date}] {message.text}")

        # Download any attached media
        if message.media:
            await client.download_media(message, file='./downloads/')

with client:
    client.loop.run_until_complete(main())
```

#### Code Example: Keyword Search Within a Channel

```python
async def search_channel(channel_name, keyword, limit=50):
    channel = await client.get_entity(channel_name)

    async for message in client.iter_messages(channel, search=keyword, limit=limit):
        print(f"[{message.date}] {message.text[:200]}")
```

#### Code Example: Real-Time Monitoring

```python
from telethon import events

@client.on(events.NewMessage(chats=['AuroraIntel', 'BNONews', 'kpszsu']))
async def handler(event):
    print(f"NEW from {event.chat.title}: {event.text[:200]}")
    # Forward to your alert system, database, etc.
```

### Rate Limits

Telegram's rate limits are generous compared to Twitter:

- Reading messages: No hard per-message limit; throttled if you make too many requests too fast
- The practical limit is ~30 requests/second for most operations
- For bulk historical scraping, add small delays (0.5-1 second) between batches
- Paid broadcast option (0.1 Telegram Stars per message) allows up to 1,000 messages/second for sending

### Other Telegram OSINT Tools

- **Telepathy**: Automated Telegram channel analysis tool
- **Tosint**: Analyzes bot tokens and chat IDs for security investigations
- **telegram-scraper**: Bulk message and media extraction using Telethon
- **Sherlock**: Username search across platforms (includes Telegram)
- **Lyzem**: Telegram search engine
- **IntelX (Intelligence X)**: Indexes Telegram content alongside other platforms

Sources: [Telethon GitHub](https://github.com/LonamiWebs/Telethon), [Telegram Bot API](https://core.telegram.org/bots/api), [The OSINT Toolbox: Telegram](https://github.com/The-Osint-Toolbox/Telegram-OSINT), [Telegram OSINT Ultimate Guide](https://espysys.com/blog/telegram-osint-the-ultimate-guide/)

---

## Telegram: Key OSINT Channels

Below is a curated list of significant Telegram channels used by OSINT practitioners, organized by category. All are public channels accessible via `t.me/handle`.

### Breaking News and Aggregators

| # | Channel | Handle | Description |
|---|---------|--------|-------------|
| 1 | BNO News | @BNONews | One of the fastest breaking news sources globally. Covers natural disasters, conflicts, major incidents. |
| 2 | Aurora Intel | @AuroraIntel | Real-time global events with Middle East focus. Highly respected in OSINT community. |
| 3 | LiveUAMap | @LiveUAMap | Real-time conflict and crisis mapping worldwide. |
| 4 | The Spectator Index | @spectatorindex | Geopolitical news and data, large subscriber base. |
| 5 | Clash Report | @ClashReport | Global conflict reporting with verified sources. |
| 6 | Witness | @wfwitness | Citizen-sourced breaking news and eyewitness accounts. |

### OSINT and Investigation

| # | Channel | Handle | Description |
|---|---------|--------|-------------|
| 7 | Bellingcat | @bellingcat | The leading OSINT investigation group. Publishes methodologies and findings. |
| 8 | OSINTdefender | @OSINTdefender | Conflict tracking and defense intelligence. Large following. |
| 9 | OSINT Updates | @OsintUpdates | Aggregated OSINT news from multiple sources. |
| 10 | CyberDetective | @CyberDetective | OSINT tools, techniques, and tutorials. Great for learning. |
| 11 | OSINT Industries | @OSINTIndustries | Professional OSINT tools and investigation resources. |
| 12 | OSINT Live | @osintlive | Real-time OSINT event coverage. |
| 13 | OSIntOps News | @Osintlatestnews | OSINT operational updates and tool announcements. |
| 14 | OsintTV | @OsintTv | Geopolitical analysis through OSINT lens. |
| 15 | The Defender Dome | @DefenderDome | Defense and security intelligence. |

### Russia-Ukraine Conflict

| # | Channel | Handle | Description |
|---|---------|--------|-------------|
| 16 | DeepState | @DeepStateUA | Ukrainian conflict mapping. Detailed frontline updates with maps. |
| 17 | Air Force of Ukraine | @kpszsu | **Official Ukrainian Air Force channel.** Real-time air raid alerts. |
| 18 | NEXTA | @nexta_tv | Eastern European news, originally Belarusian opposition media. |
| 19 | War Monitor | @war_monitor | Ukraine conflict alerts and updates. |

### Middle East

| # | Channel | Handle | Description |
|---|---------|--------|-------------|
| 20 | Abu Ali Express | @abualiexpress | Hebrew-language Middle East military intelligence (one of the most cited Israeli OSINT channels). |
| 21 | Abu Ali Express EN | @englishabuali | English translation of the above. |
| 22 | Middle East Spectator | @Middle_East_Spectator | Regional conflict and political analysis. |
| 23 | Middle East Now Breaking | @MiddleEastNow_Breaking | Real-time Middle East breaking news. |

### Iran and Regional Politics

| # | Channel | Handle | Description |
|---|---------|--------|-------------|
| 24 | Vahid Online | @VahidOnline | Iranian political analysis and news. |
| 25 | Iran International | @iranintltv | Persian-language news network covering Iran. |

### Geopolitics and Analysis

| # | Channel | Handle | Description |
|---|---------|--------|-------------|
| 26 | GeopoliticalCenter | @GeopoliticalCenter | Global geopolitical analysis and forecasting. |
| 27 | Open Source Intel (Osint613) | @Osint613 | Middle East and US global events (~916K followers). |
| 28 | IntelSky | @Intel_Sky | Middle East military aviation tracking (~51K followers). |
| 29 | OSINT Insider | @OSINT_Insider | Defense and diplomacy coverage (~130K followers). |
| 30 | OSINTWarfare | @OSINTWarfare | Real-time global conflict tracking (~95K followers). |

### How to Subscribe

To follow any of these channels:
1. Open Telegram (app or web at web.telegram.org)
2. Search for the handle (e.g., `@AuroraIntel`) or visit `t.me/AuroraIntel`
3. Click "Join" to subscribe, or just read -- public channels are viewable without joining
4. Many of these channels have linked discussion groups for community commentary

---

## How omni-sentinel Uses Telegram

The omni-sentinel codebase already has a working Telegram integration. Here is how it works:

### Architecture

```
[Telegram Public Channels]
        |
        v
[Backend Scraper]  <-- Runs on the backend; polls channels via Telegram API
        |
        v
[/telegram/feed endpoint]  <-- Backend REST API serving scraped data
        |
        v
[Vercel Edge Relay]  <-- api/telegram-feed.js proxies to backend
        |
        v
[Frontend TelegramIntel service]  <-- src/services/telegram-intel.ts
        |
        v
[UI Components]  <-- Displays feed with topic filters
```

### Key Files

- **`src/services/telegram-intel.ts`**: Frontend service that fetches the Telegram feed from the API, with 30-second caching. Defines the `TelegramItem` interface and topic filters (breaking, conflict, alerts, osint, politics, middleeast).

- **`api/telegram-feed.js`**: Vercel Edge Function that relays requests to the backend `/telegram/feed` endpoint. Supports `limit`, `topic`, and `channel` query parameters. Has aggressive caching headers (60s browser, 600s CDN).

- **`data/telegram-channels.json`**: Curated channel list with 26 channels organized by tier:
  - **Tier 1** (highest priority): Vahid Online
  - **Tier 2** (high priority): Aurora Intel, BNO News, Clash Report, DeepState, Abu Ali Express, etc.
  - **Tier 3** (standard): Bellingcat, CyberDetective, NEXTA, Spectator Index, etc.
  - Each channel has: handle, label, topic, tier, enabled flag, region, maxMessages

### Data Flow

1. The backend scraper (not in this repo -- lives on the backend service) uses the channel list to poll each channel via Telegram's API
2. Messages are classified by topic and tagged
3. Results are served via REST API
4. The frontend fetches and displays with topic-based filtering
5. The `earlySignal` flag marks channels/items that tend to break news first

---

## Platform Comparison Table

| Feature | Telegram | Twitter/X | WhatsApp |
|---|---|---|---|
| **Public content** | Yes -- channels are fully public, readable by anyone | Yes -- tweets are public by default | No -- all content is private |
| **API access** | Free (both Bot API and MTProto) | $200-$5,000+/month official; $0.15-0.20/1K via third-party | No public API for messages |
| **Cost for OSINT** | $0 (API is free) | $200-$5,000/month official; or ~$15-50/month via third-party for moderate use | N/A |
| **Search capability** | Search within channels, global username search | Full-text search (7-day on Basic, full archive on Pro) | No search API |
| **Historical access** | Full history of any public channel, for free | Requires Pro tier ($5K/month) or third-party | No access |
| **Real-time monitoring** | Built-in event handlers, free | Filtered streams on Pro tier ($5K/month) | No capability |
| **Rate limits** | Generous (~30 req/sec) | Strict quotas (15K-1M reads/month) | N/A |
| **Media downloads** | Free, included in API | Included in API read quota | N/A |
| **Content moderation** | Minimal -- military, graphic content allowed | Moderate -- some content removed | Strong -- relies on user reports |
| **OSINT value** | Extremely high for conflict/geopolitical intel | High for public discourse, political analysis, breaking news | Near zero |
| **User anonymity** | Can read public channels without account | Limited anonymous browsing (Nitter) | Requires phone number |
| **Geographic strength** | Russia/Ukraine, Middle East, Central Asia | Global, strongest in US/Europe | Global, strongest in personal networks |
| **Bot/automation** | Easy -- free Bot API, Telethon | Expensive -- requires paid API tier | Very limited (WhatsApp Business API) |
| **Risk of platform changes** | Moderate (recent channel bans, Russia throttling) | High (pricing changes, API restrictions under Musk) | Low (but no OSINT utility) |

---

## Cost Comparison: Getting 100K Tweets

To put the pricing in perspective, here is what it costs to retrieve 100,000 tweets through different methods:

| Method | Cost for 100K Tweets | Notes |
|---|---|---|
| **X API Free Tier** | Impossible | Cannot read tweets |
| **X API Basic ($200/mo)** | $200/month (but capped at 15K) | Cannot even reach 100K in a month |
| **X API Pro ($5,000/mo)** | $5,000/month | 100K is 10% of monthly quota |
| **X API Pay-Per-Use** | ~$500 (at $0.005/read) | New Feb 2026 option |
| **TwitterAPI.io** | $15 | $0.15 per 1,000 tweets |
| **SocialData API** | $20 | $0.20 per 1,000 tweets |
| **Apify Scrapers** | $20-$40 | $0.20-0.40 per 1,000 tweets |
| **Bright Data** | $150 | $1.50 per 1,000 records |
| **Twexapi** | $50/month (unlimited) | Flat rate |
| **DIY Scraping** | $0 + compute/proxy | Risk of account bans |
| **Telegram equivalent** | $0 | 100K messages from public channels, free via Telethon |

---

## Recommendations

### For This Project (omni-sentinel)

1. **Telegram is the clear winner for cost-effective OSINT monitoring.** The existing integration is well-architected. Continue expanding the channel list and improving classification.

2. **For Twitter/X data**, if needed:
   - Start with **TwitterAPI.io** ($0.15/1K tweets) for cost-effective access
   - Use the **Pay-Per-Use** official API for occasional needs where you want "official" data
   - Avoid the Basic tier ($200/month) -- 15K reads is too limited and 7-day search is too restrictive
   - Only consider Pro ($5K/month) if full archive search is a core product requirement

3. **Multi-source approach**: The best OSINT systems cross-reference Telegram speed with Twitter breadth. Telegram channels often break news first; Twitter provides the public reaction and amplification.

### For Learning OSINT

1. **Start with Telegram**: Install the app, join 5-10 channels from the list above, watch how information flows during a live event
2. **Learn Twitter advanced search**: Master the search operators before spending money on APIs
3. **Follow Bellingcat**: Their guides and toolkit are the best free OSINT education available
4. **Practice with Telethon**: Write a simple script to pull messages from a public channel. It takes 15 minutes and costs nothing
5. **Join the community**: The OSINT community is active on both platforms. Follow practitioners, learn their methods

### Key Insight

The fundamental asymmetry is this: **Telegram gives away for free what Twitter charges thousands for.** A well-curated list of 25-30 Telegram channels, monitored via the free API, provides real-time intelligence that would cost $5,000+/month to replicate via Twitter's official API. This is why every serious OSINT operation monitors Telegram as a primary source.
