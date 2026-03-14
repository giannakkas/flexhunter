# FlexHunter — Shopify App Landing Page Prompt for Lovable.dev

Build a stunning, high-converting, single-page marketing website for **FlexHunter** — an AI-powered Shopify app that helps dropshippers discover winning products before competitors. The site must be fully responsive, SEO-optimized, and designed to convert visitors into Shopify app installs.

---

## TECH STACK

- React + TypeScript + Tailwind CSS
- Framer Motion for animations
- React Helmet for SEO meta tags
- Single page with smooth scroll navigation
- Mobile-first responsive design
- Deploy-ready on Vercel/Netlify

---

## DESIGN DIRECTION

**Aesthetic:** Dark premium SaaS — deep navy/charcoal (#0A0F1C) background with electric blue (#3B82F6), neon cyan (#06B6D4), and hot orange (#F97316) accents. Think "Bloomberg Terminal meets TikTok energy."

**Typography:**
- Headlines: "Clash Display" or "Cabinet Grotesk" (bold, modern)
- Body: "Satoshi" or "General Sans" (clean, readable)
- Import from Google Fonts or Fontshare

**Visual Style:**
- Glassmorphism cards with backdrop-blur and subtle borders
- Gradient mesh background blobs (animated, slow-moving)
- Grain texture overlay for depth
- Glowing accent borders on hover
- Smooth scroll-triggered fade-in animations (stagger children)
- Dark theme ONLY — no light mode

**Key Differentiator:** This is NOT a generic SaaS landing page. It should feel like a premium intelligence tool — like having a secret weapon for dropshipping.

---

## PAGE SECTIONS (in order)

### 1. NAVIGATION BAR (sticky)
- Logo: "FlexHunter" with a crosshair/target icon (use SVG)
- Tagline next to logo: "Product Discovery Intelligence"
- Nav links: Features | How It Works | Pricing | Reviews | Demo
- CTA button: "Install on Shopify →" (glowing blue, links to: https://apps.shopify.com/flexhunter — use # as placeholder)
- Mobile: hamburger menu with slide-in drawer

### 2. HERO SECTION
- **Headline:** "Find Winning Products Before Your Competitors"
- **Subheadline:** "FlexHunter uses 6 AI agents to analyze trends across Google, TikTok & Amazon — detecting viral products 1-2 weeks before they go mainstream."
- **Two CTA buttons:**
  - "Install Free on Shopify →" (primary, large, glowing)
  - "Watch Demo ↓" (secondary, scrolls to demo section)
- **Hero visual:** A mockup of the FlexHunter dashboard inside a laptop frame. Use a screenshot placeholder div with gradient overlay. Size: 1200x750. Show a dashboard with product cards, scores, and viral badges.
- **Social proof strip below hero:**
  - "🔥 134 products discovered today"
  - "⚡ 2.8 requests/min"
  - "🏪 Trusted by 500+ Shopify stores" (use fake but realistic numbers)
  - Animated counter that increments slowly

### 3. LOGOS / TRUST BAR
- "Powered by" section showing: Shopify, Google Trends, TikTok, Amazon, Gemini AI (use text logos with opacity, no actual brand images — use styled text)
- Subtle horizontal scroll on mobile

### 4. FEATURES SECTION
Title: "6 AI Agents Working For You 24/7"
Subtitle: "Each agent is a specialist. Together, they find products humans would miss."

Display as a 3x2 grid of glassmorphism cards. Each card has:
- Icon (emoji or Lucide icon)
- Title
- 2-line description

**Feature cards:**

1. 🔍 **Store Fit Agent**
   "Analyzes your store's DNA — niche, audience, pricing — and only recommends products that belong in YOUR store."

2. 🔥 **Viral Prediction Agent**
   "Detects products going viral 1-2 weeks early by analyzing order velocity, TikTok signals, and search acceleration."

3. 📊 **Trend Intelligence**
   "Cross-references Google Trends, TikTok hashtags, and Amazon demand in real-time to spot rising opportunities."

4. 💰 **Profit Analyzer**
   "Calculates real margins including shipping, ad costs, and refund risk — so you only sell products that actually make money."

5. 🚀 **1-Click Import**
   "Import products to Shopify with optimized titles, descriptions, and SEO — ready to sell in seconds."

6. 🔄 **Smart Replacements**
   "Automatically detects weak products and suggests higher-performing replacements based on your store's data."

### 5. HOW IT WORKS
Title: "From Zero to Selling in 3 Steps"

Horizontal timeline / step cards with connecting lines:

**Step 1: Connect Your Store**
"Install FlexHunter and tell us what you sell. Our AI builds your Store DNA in seconds."
→ Show: Store DNA form mockup

**Step 2: AI Finds Winners**
"6 AI agents scan thousands of products from AliExpress, CJ Dropshipping, and trending sources. Each product is scored on 22 signals."
→ Show: Research results with scores and viral badges

**Step 3: Import & Profit**
"Select winners, customize pricing, and import to Shopify with 1 click. SEO is auto-optimized."
→ Show: Import modal with SEO optimization

### 6. SCREENSHOTS / APP PREVIEW
Title: "See FlexHunter in Action"

Carousel or tabbed screenshots showing:
- **Dashboard** — overview with stats, health scores
- **Research** — AI-discovered products with viral badges and score rings
- **Trend Intelligence** — Google/TikTok/Amazon trend analysis
- **Early Viral Products** — products detected before competitors
- **Import Flow** — pre-edit modal + SEO optimization
- **Admin Panel** — API health monitoring (show this as "Built for Scale")

Use placeholder screenshot divs (800x500) with gradient backgrounds and overlay text describing what each screen shows. Use a realistic app mockup frame.

### 7. DEMO SECTION (Interactive)
Title: "Try FlexHunter — Live Demo"
Subtitle: "See how AI scores products for YOUR store. No sign-up required."

Build an INTERACTIVE demo widget:
- Input field: "What does your store sell?" (placeholder: "e.g., outdoor camping gear")
- Button: "🔍 Find Products"
- On click: Show 3 fake product cards with:
  - Product name (randomly picked from a pool of 15 products)
  - Score ring (random 60-95)
  - Viral badge (random: 🔥 Early Viral, 🚀 Breakout, 📈 Rising)
  - Price and margin
  - "Store Fit: 85/100" bar
  - Recommendation badge (Strong Buy / Buy / Maybe)
- Add a 1.5s loading spinner before showing results
- Below results: "Want real results? Install FlexHunter →"

**Product pool for demo (pick 3 random each time):**
1. LED Hexagon Wall Lights — $45.99 (cost $12)
2. Portable Blender Cup — $29.99 (cost $8)
3. Magnetic Phone Mount — $19.99 (cost $3)
4. Smart Posture Corrector — $34.99 (cost $9)
5. Mini Projector — $89.99 (cost $35)
6. Sunrise Alarm Clock — $39.99 (cost $11)
7. Levitating Moon Lamp — $49.99 (cost $15)
8. Transparent Bluetooth Speaker — $59.99 (cost $18)
9. Kinetic Sand Art Frame — $44.99 (cost $14)
10. 3D Hologram Fan — $79.99 (cost $25)
11. Electric Scalp Massager — $24.99 (cost $6)
12. UV Phone Sanitizer — $29.99 (cost $8)
13. Collapsible Water Bottle — $19.99 (cost $4)
14. Smart Ring Doorbell — $69.99 (cost $22)
15. Heated Eye Massager — $54.99 (cost $16)

### 8. PRICING SECTION
Title: "Simple, Transparent Pricing"
Subtitle: "Start free. Upgrade when you're ready to scale."

3 pricing cards side by side (middle card highlighted as "Most Popular"):

**Free Plan — $0/month**
- 3 AI research runs per month
- 10 product imports
- Basic trend analysis
- Community support
- Button: "Start Free →"

**Pro Plan — $29/month** ⭐ MOST POPULAR
- Unlimited AI research
- Unlimited imports
- Advanced viral detection
- Pairwise AI ranking
- Priority support
- Smart replacements
- Button: "Start Pro →" (highlighted, glowing)

**Enterprise — $79/month**
- Everything in Pro
- API access
- Custom AI training on your store data
- Dedicated account manager
- White-glove onboarding
- Button: "Contact Sales →"

Add below cards: "All plans include: Shopify embedded app • Gemini AI engine • 22-signal scoring • SEO optimization • Store DNA analysis"

### 9. CUSTOMER REVIEWS
Title: "What Dropshippers Are Saying"

Masonry or carousel layout with 6 review cards:

**Review 1:**
"FlexHunter found me 3 winning products in my first research run. One of them did $4,200 in the first week. The viral prediction is scary accurate."
— **Jake M.**, US 🇺🇸, ★★★★★
Store: Tech gadgets

**Review 2:**
"I was spending hours on AliExpress manually. FlexHunter does in 30 seconds what took me 3 hours. The store fit scoring is genius."
— **Sarah L.**, UK 🇬🇧, ★★★★★
Store: Home & living

**Review 3:**
"The early viral detection is the real game changer. I found a product 2 weeks before it blew up on TikTok. My competitors were too late."
— **Marcus T.**, CA 🇨🇦, ★★★★★
Store: Pet accessories

**Review 4:**
"Finally a Shopify app that actually uses AI properly. Not just a ChatGPT wrapper. The 6-agent scoring system is legit."
— **Emma R.**, AU 🇦🇺, ★★★★★
Store: Beauty & wellness

**Review 5:**
"The auto-replacement feature saved my store. It flagged 3 dying products and suggested replacements that are now my top sellers."
— **David K.**, DE 🇩🇪, ★★★★★
Store: Fitness equipment

**Review 6:**
"Best $29 I spend every month. The trend intelligence page alone is worth it. I check it every morning before my competitors wake up."
— **Priya S.**, IN 🇮🇳, ★★★★★
Store: Fashion accessories

Each card: avatar placeholder (colored circle with initials), name, country flag, stars, review text, store type.

### 10. FAQ SECTION
Title: "Frequently Asked Questions"

Accordion-style FAQ:

**Q: How does FlexHunter find viral products early?**
A: Our AI analyzes order velocity, review-to-order ratios, TikTok hashtag growth, Google search interest, and Amazon demand signals. Products showing acceleration patterns are flagged 1-2 weeks before they go mainstream.

**Q: Does it work with any Shopify store?**
A: Yes. FlexHunter adapts to your specific niche, audience, and price range. The Store DNA feature ensures every recommendation is tailored to YOUR store.

**Q: What product sources does it use?**
A: AliExpress, CJ Dropshipping, and more coming soon. We also analyze Google Trends, TikTok Creative Center, and Amazon for demand signals.

**Q: Can I try it before paying?**
A: Absolutely. The Free plan gives you 3 research runs per month with full AI scoring. No credit card required.

**Q: How is this different from other product research tools?**
A: Most tools just show you what's already popular. FlexHunter predicts what WILL be popular using 6 specialized AI agents and 22 scoring signals. It's intelligence, not just search.

**Q: Does it import products to my Shopify store?**
A: Yes. One-click import with auto-optimized titles, descriptions, images, and SEO tags. You can customize everything before importing.

### 11. FINAL CTA SECTION
- Large gradient background section
- Headline: "Stop Guessing. Start Winning."
- Subheadline: "Join 500+ dropshippers who discover winning products before everyone else."
- Large CTA button: "Install FlexHunter Free →"
- Below: "Free forever plan available • No credit card required • 30-second setup"

### 12. FOOTER
- Logo + tagline
- Links: Features | Pricing | Demo | Privacy Policy | Terms of Service | Contact
- "Built with ❤️ for Shopify dropshippers"
- © 2026 FlexHunter. All rights reserved.

---

## SOCIAL PROOF NOTIFICATION POPUP (Bottom-Left Corner)

Build a sliding notification component that shows fake "recent subscriber" alerts. It should:

1. Slide in from the left bottom corner
2. Show for 4 seconds
3. Slide out
4. Wait 8-12 seconds (random)
5. Show the next notification
6. Cycle through all 50 notifications, then repeat from the start

**Design:**
- Small card (max-width: 320px)
- Rounded corners, glassmorphism background
- Small avatar (32px circle with face emoji or initials)
- Name, location, time ago
- "just subscribed to FlexHunter Pro"
- Subtle "✕" close button (hides for 5 minutes if clicked)
- Slide animation: translateX(-120%) → translateX(0) → wait → translateX(-120%)

**50 Notifications (vary names, locations, plans, time-ago):**

1. 👨 Jake from New York, USA — "just subscribed to Pro" — 2 min ago
2. 👩 Sarah from London, UK — "just started a free trial" — 5 min ago
3. 👨 Marcus from Toronto, Canada — "just subscribed to Pro" — 3 min ago
4. 👩 Emma from Sydney, Australia — "just subscribed to Enterprise" — 7 min ago
5. 👨 David from Berlin, Germany — "just started a free trial" — 1 min ago
6. 👩 Priya from Mumbai, India — "just subscribed to Pro" — 4 min ago
7. 👨 Liam from Dublin, Ireland — "just subscribed to Pro" — 6 min ago
8. 👩 Mei from Singapore — "just started a free trial" — 2 min ago
9. 👨 Carlos from Miami, USA — "just subscribed to Enterprise" — 8 min ago
10. 👩 Aisha from Dubai, UAE — "just subscribed to Pro" — 3 min ago
11. 👨 Tom from Los Angeles, USA — "just subscribed to Pro" — 1 min ago
12. 👩 Nina from Amsterdam, Netherlands — "just started a free trial" — 5 min ago
13. 👨 Raj from Delhi, India — "just subscribed to Pro" — 4 min ago
14. 👩 Lisa from Vancouver, Canada — "just subscribed to Enterprise" — 9 min ago
15. 👨 Omar from Cairo, Egypt — "just started a free trial" — 2 min ago
16. 👩 Anna from Stockholm, Sweden — "just subscribed to Pro" — 6 min ago
17. 👨 James from Chicago, USA — "just subscribed to Pro" — 3 min ago
18. 👩 Yuki from Tokyo, Japan — "just started a free trial" — 7 min ago
19. 👨 Pedro from São Paulo, Brazil — "just subscribed to Pro" — 1 min ago
20. 👩 Fatima from Istanbul, Turkey — "just subscribed to Pro" — 4 min ago
21. 👨 Chris from Austin, USA — "just subscribed to Enterprise" — 2 min ago
22. 👩 Elena from Madrid, Spain — "just started a free trial" — 8 min ago
23. 👨 Kevin from Seattle, USA — "just subscribed to Pro" — 5 min ago
24. 👩 Sophie from Paris, France — "just subscribed to Pro" — 3 min ago
25. 👨 Ahmed from Riyadh, Saudi Arabia — "just started a free trial" — 6 min ago
26. 👩 Rachel from Tel Aviv, Israel — "just subscribed to Pro" — 1 min ago
27. 👨 Daniel from Melbourne, Australia — "just subscribed to Pro" — 4 min ago
28. 👩 Chloe from Auckland, New Zealand — "just started a free trial" — 7 min ago
29. 👨 Alex from San Francisco, USA — "just subscribed to Enterprise" — 2 min ago
30. 👩 Maria from Rome, Italy — "just subscribed to Pro" — 5 min ago
31. 👨 Ryan from Denver, USA — "just subscribed to Pro" — 3 min ago
32. 👩 Hana from Seoul, South Korea — "just started a free trial" — 8 min ago
33. 👨 Viktor from Warsaw, Poland — "just subscribed to Pro" — 1 min ago
34. 👩 Grace from Nairobi, Kenya — "just subscribed to Pro" — 4 min ago
35. 👨 Max from Munich, Germany — "just started a free trial" — 6 min ago
36. 👩 Julia from Buenos Aires, Argentina — "just subscribed to Enterprise" — 2 min ago
37. 👨 Nathan from Boston, USA — "just subscribed to Pro" — 5 min ago
38. 👩 Ingrid from Oslo, Norway — "just started a free trial" — 3 min ago
39. 👨 Leo from Lisbon, Portugal — "just subscribed to Pro" — 7 min ago
40. 👩 Diana from Bucharest, Romania — "just subscribed to Pro" — 1 min ago
41. 👨 Mike from Phoenix, USA — "just subscribed to Enterprise" — 4 min ago
42. 👩 Zara from Karachi, Pakistan — "just started a free trial" — 8 min ago
43. 👨 Felix from Zurich, Switzerland — "just subscribed to Pro" — 2 min ago
44. 👩 Olivia from Manchester, UK — "just subscribed to Pro" — 6 min ago
45. 👨 Sam from Portland, USA — "just started a free trial" — 3 min ago
46. 👩 Leah from Cape Town, South Africa — "just subscribed to Pro" — 5 min ago
47. 👨 Arjun from Bangalore, India — "just subscribed to Enterprise" — 1 min ago
48. 👩 Mia from Copenhagen, Denmark — "just subscribed to Pro" — 4 min ago
49. 👨 Jason from Atlanta, USA — "just started a free trial" — 7 min ago
50. 👩 Ava from Helsinki, Finland — "just subscribed to Pro" — 2 min ago

---

## SEO OPTIMIZATION

Implement full SEO using React Helmet on the page:

```html
<title>FlexHunter — AI Product Discovery for Shopify Dropshippers</title>
<meta name="description" content="Find winning dropshipping products before your competitors. FlexHunter uses 6 AI agents to detect viral products 1-2 weeks early across Google Trends, TikTok & Amazon. Free Shopify app." />
<meta name="keywords" content="shopify dropshipping, winning products, product research tool, viral products, dropshipping AI, tiktok products, aliexpress products, shopify app, product discovery, trend analysis, dropshipping automation" />
<link rel="canonical" href="https://flexhunter.app" />

<!-- Open Graph -->
<meta property="og:title" content="FlexHunter — Find Winning Products Before Competitors" />
<meta property="og:description" content="AI-powered product discovery for Shopify. 6 agents analyze trends across Google, TikTok & Amazon to find viral products 1-2 weeks early." />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://flexhunter.app" />
<meta property="og:image" content="https://flexhunter.app/og-image.png" />

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="FlexHunter — AI Product Discovery for Shopify" />
<meta name="twitter:description" content="Find viral dropshipping products 1-2 weeks before competitors. Free Shopify app with 6 AI agents." />

<!-- Schema.org -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "FlexHunter",
  "description": "AI-powered product discovery tool for Shopify dropshippers",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "offers": [
    { "@type": "Offer", "price": "0", "priceCurrency": "USD", "name": "Free Plan" },
    { "@type": "Offer", "price": "29", "priceCurrency": "USD", "name": "Pro Plan" },
    { "@type": "Offer", "price": "79", "priceCurrency": "USD", "name": "Enterprise Plan" }
  ],
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.9",
    "ratingCount": "127",
    "bestRating": "5"
  }
}
</script>
```

Additional SEO:
- All images have alt text
- Semantic HTML: use `<header>`, `<main>`, `<section>`, `<article>`, `<footer>`
- H1 only once (hero headline)
- H2 for each section title
- Internal anchor links for navigation
- Lazy-load images below fold
- Performance: minimize layout shifts, use will-change for animations

---

## ANIMATIONS

- **Page load:** Logo fades in, then headline slides up, then subheadline, then CTA buttons (stagger 0.1s each)
- **Scroll reveals:** Each section fades in + slides up when entering viewport (Intersection Observer or Framer Motion whileInView)
- **Feature cards:** Stagger reveal, hover: scale(1.02) + glow border
- **Pricing cards:** Hover: lift shadow + scale(1.01)
- **Stats counter:** Number counting animation when scrolling into view
- **Screenshots:** Fade between tabs or slide carousel
- **Notification popup:** slideInLeft → hold 4s → slideOutLeft
- **Background:** Slowly moving gradient mesh blobs (CSS animation, 20s infinite)
- **CTA buttons:** Subtle pulse glow animation (2s infinite)

---

## IMPORTANT NOTES

1. The entire page should be ONE React component file (or a few sub-components in the same file)
2. Use Tailwind CSS classes ONLY (no external CSS files)
3. All content is hardcoded (no API calls needed except the interactive demo which uses local state)
4. The demo section is fully client-side — no backend needed
5. Make the page feel PREMIUM and EXCLUSIVE — not like a generic template
6. Mobile responsive: everything must look perfect on phones
7. The "Install on Shopify" buttons should link to "#" for now (replace with real Shopify app URL later)
8. Use smooth scrolling for all anchor links
9. Add a "Back to top" button that appears after scrolling past the hero
10. Total page load should feel fast — no heavy images, use CSS for visual effects
