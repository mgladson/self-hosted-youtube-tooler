// Single UI locale (English). The original multi-locale switcher was removed
// during the rebuild.
export const LOCALES = ["en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

type LegalSection = { heading: string; clauses: string[] };
type LegalDoc = {
  title: string;
  lastModified: string;
  intro: string;
  sections: LegalSection[];
};

type FaqItem = { question: string; answer: string };
type FaqBlock =
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "p"; text: string };
type FaqDoc = {
  title: string;
  intro: string;
  items: FaqItem[];
  article: FaqBlock[];
  converterFaq: FaqItem[];
};

export type Messages = {
  nav: { brandFull: string; brandTagline: string };
  privacy: LegalDoc;
  terms: LegalDoc;
  refund: LegalDoc;
  faq: FaqDoc;
};

// Legal copy for this Site, a self-hosted utility for retrieving public YouTube
// data (transcripts, thumbnails, tags) and downloading video/audio. The brand
// name ("Your Site") and the placeholder contact address below are intentionally
// generic; set them for your deployment before publishing.
const privacy: LegalDoc = {
  title: "Privacy Policy",
  lastModified: "This privacy policy was last modified on 29 June 2026.",
  intro:
    "Your Site is a self-hosted utility for working with publicly available YouTube data: transcripts, thumbnails, tags, and video or audio downloads. This Policy explains the limited information the Site handles when you use it, why, and the choices you have. The Site has no user accounts and is built to collect as little about you as possible.",
  sections: [
    {
      heading: "SECTION 1 – Overview and Scope",
      clauses: [
        "§1.1 \"Your Site\" (\"the Site\", \"we\", \"us\", or \"our\") respects your privacy. This privacy policy (the \"Policy\") explains what information we process when you visit the Site and use its tools (the \"Services\"), how we use it, and the rights and choices available to you.",
        "§1.2 The Services let you paste a public YouTube link and retrieve information about that video (its title, description, tags, thumbnails, available formats, and captions/transcript) and, where you choose, download the video or its audio. To do this, the Site requests that public information from YouTube on your behalf.",
        "§1.3 The Site has no registration, no user profiles, and no shopping or payment features. You do not need an account, and we do not ask for your name, address, or any similar identifying detail to use the Services.",
        "§1.4 This Policy applies only to the Site. It does not apply to YouTube, Google, or any third-party website you reach through a link, each of which has its own privacy practices.",
      ],
    },
    {
      heading: "SECTION 2 – Who We Are and How to Contact Us",
      clauses: [
        "§2.1 This is self-hostable software, which means the \"operator\" is whoever deploys and runs the particular instance you are using. The operator determines how this instance is configured and is responsible for the information it processes.",
        "§2.2 If you have questions about this Policy or how your information is handled, contact the operator of this Site at the address it publishes (for example, privacy@yoursite.example). Replace this with the real contact route for your deployment before publishing.",
        "§2.3 The Site is general-purpose creator and developer tooling. It is not directed to children, and we do not knowingly collect information from anyone under 18.",
      ],
    },
    {
      heading: "SECTION 3 – Information You Give Us",
      clauses: [
        "§3.1 The Services are driven by the YouTube URL or video ID you paste. We process that URL or ID to fetch the requested data and to generate downloads, thumbnails, and transcripts. The URL or ID identifies a public video, not you.",
        "§3.2 We do not ask for, and do not want, sensitive personal information. Please do not type anything other than public YouTube links into the Site's input fields.",
        "§3.3 Preferences you set in the interface (such as light/dark theme and interface language) are stored locally in your browser (see Section 6) and are not sent to us as part of your identity.",
      ],
    },
    {
      heading: "SECTION 4 – Information Collected Automatically",
      clauses: [
        "§4.1 IP address. When your browser or our server handles a request, your IP address is necessarily visible. We use it transiently to apply rate limits (so one network cannot overload the Service or get the Service blocked by YouTube) and to derive an approximate country for aggregate analytics. The Site is typically served behind Cloudflare, which forwards your originating IP to our server for this purpose.",
        "§4.2 Usage analytics. The Site includes a first-party analytics component that records how the Site is used so we can keep it working and improve it. Events include page views, clicks (including the tag, visible text, and link target of the element clicked), scroll depth, time spent on a page, basic performance (\"web vital\") measurements, your referring page, and your screen size.",
        "§4.3 Each analytics event is tagged with a randomly generated session identifier, an approximate country derived from your IP, and the device type, browser, and operating system parsed from your browser's User-Agent string. The session identifier is a random value held in your browser's sessionStorage; it is not linked to your name or any account, is not shared with other websites, and is cleared when you close the browser tab or session. We use it only to group the events of a single visit together.",
        "§4.4 Server logs. Like most web servers, the underlying infrastructure may keep short-lived operational logs (for example, request paths, status codes, and timestamps) for security, debugging, and abuse prevention.",
      ],
    },
    {
      heading: "SECTION 5 – How We Use Information",
      clauses: [
        "§5.1 We use the information described above to: (a) operate the Services and return the data, thumbnails, downloads, and transcripts you request; (b) apply rate limits and prevent abuse, fraud, scraping, and denial-of-service against the Site and against YouTube; (c) understand, in aggregate, which tools are used and how, so we can fix problems and improve the Site; (d) maintain the security and integrity of the Site; and (e) comply with applicable law.",
        "§5.2 We do not sell, rent, or trade your information. We do not use it to build advertising profiles, and the Site carries no third-party advertising or cross-site tracking pixels.",
        "§5.3 We do not use the Content you request (video metadata, thumbnails, or transcripts) to identify you. That Content describes public YouTube videos, not the person looking them up.",
      ],
    },
    {
      heading: "SECTION 6 – Cookies, Local Storage, and Your Consent",
      clauses: [
        "§6.1 The Site does not use advertising or cross-site tracking cookies. It relies on a small amount of browser storage to function: (a) localStorage holds your theme and language preferences; and (b) sessionStorage holds the random analytics session identifier described in §4.3. A first-party session cookie may be set only if the deployment you are using exposes a sign-in feature and you choose to use it.",
        "§6.2 Where a consent control is provided, you can record a choice to decline analytics. If a decline is recorded for your session identifier, the server discards analytics events for that session instead of storing them.",
        "§6.3 You can clear or block this browser storage at any time through your browser settings. Doing so may reset your theme and language preferences but will not stop the core tools (extract, transcript, thumbnail, download) from working.",
        "§6.4 Do Not Track. Some browsers can send a \"Do Not Track\" (DNT) signal. Because there is no agreed industry standard for how to respond to DNT, the Site does not currently respond to DNT signals; it instead relies on the analytics-consent choice described in §6.2 and the browser controls described in §6.3.",
      ],
    },
    {
      heading: "SECTION 7 – Who We Share Information With",
      clauses: [
        "§7.1 YouTube and Google. To fetch the data you ask for, the Site (or the optional proxy described below) sends requests to YouTube/Google servers. Those requests are governed by Google's own privacy policy. We do not send Google your analytics session identifier or your local preferences.",
        "§7.2 Infrastructure providers. We rely on standard hosting and network providers to run the Site, including a CDN/proxy (typically Cloudflare) in front of the Service, a database that stores aggregate analytics events, and an in-memory cache used for rate limits and cached video data. These providers process data on our behalf to keep the Service running.",
        "§7.3 Optional outbound proxy. The operator may route the Site's outbound requests to YouTube through a proxy so that retrieval traffic does not all originate from a single address. If configured, your submitted URL or ID is processed through that proxy to reach YouTube.",
        "§7.4 Legal and safety. We may disclose information where we believe in good faith that it is required by law, or reasonably necessary to investigate or prevent abuse, security incidents, or violations of our Terms of Service.",
        "§7.5 Business transfers. If the operator of an instance is involved in a merger, acquisition, financing, reorganization, or sale of assets, information processed by that instance may be transferred as part of that transaction. We will require any successor to honor this Policy or to provide notice of a replacement.",
        "§7.6 We do not otherwise share your information with third parties for their own independent purposes.",
      ],
    },
    {
      heading: "SECTION 8 – Cached Content",
      clauses: [
        "§8.1 To avoid contacting YouTube repeatedly for the same video (which is slow and risks YouTube rate-limiting the Service), we cache the data we retrieve (video metadata, available formats, and transcripts) in a server-side cache keyed by the YouTube video ID. This cache is shared across all visitors and is not tied to you.",
        "§8.2 Cached entries expire automatically (currently up to 30 days) and hold only public information about the video, not personal information about the person who requested it.",
      ],
    },
    {
      heading: "SECTION 9 – Downloads and Temporary Files",
      clauses: [
        "§9.1 When you download a video or audio file, the Site retrieves and assembles that file in a temporary working directory on the server and streams it to your browser. The temporary file is deleted as soon as the download finishes or fails.",
        "§9.2 We do not keep a library of the media you download, and we do not associate downloads with your identity beyond the transient, short-lived rate-limiting described in §4.1.",
      ],
    },
    {
      heading: "SECTION 10 – Data Retention",
      clauses: [
        "§10.1 Rate-limit counters keyed to your IP are held only for the length of the relevant window (on the order of one to ten minutes) and then expire automatically.",
        "§10.2 Cached video data expires automatically as described in §8.2, and temporary download files are deleted immediately after streaming as described in §9.1.",
        "§10.3 Aggregated analytics events are retained to analyze trends over time. They are stored against a per-visit session identifier and coarse attributes (approximate country, device, browser, operating system), not under your name.",
        "§10.4 Operational logs are kept only as long as needed for security and debugging.",
      ],
    },
    {
      heading: "SECTION 11 – Security",
      clauses: [
        "§11.1 The Site is served over encrypted connections (HTTPS/TLS). We apply rate limits, input validation, and tight allow-lists on what the Services will fetch, in order to limit abuse.",
        "§11.2 No method of transmission or storage is completely secure. While we take reasonable measures to protect the limited information we handle, we cannot guarantee absolute security.",
      ],
    },
    {
      heading: "SECTION 12 – Legal Bases for Processing (EEA and UK)",
      clauses: [
        "§12.1 If you are in the European Economic Area (EEA) or the United Kingdom, we process personal information only where we have a valid legal basis under the GDPR and UK GDPR. The bases we rely on are set out below.",
        "§12.2 Legitimate interests. We rely on our legitimate interests to operate, secure, and improve the Services (including returning the data you request, applying rate limits, preventing abuse, and measuring aggregate usage through first-party analytics) where those interests are not overridden by your rights and freedoms.",
        "§12.3 Consent. Where consent is required, we rely on it, for example, where a control to accept or decline analytics is presented. You may withdraw consent at any time; where a withdrawal is recorded for your session identifier, we stop storing analytics events for that session (see §6.2).",
        "§12.4 Legal obligation. We may process information where necessary to comply with a legal obligation, such as responding to a lawful request from an authority or acting on a valid copyright takedown.",
        "§12.5 We do not carry out automated decision-making that produces legal or similarly significant effects about you, and we do not use your information for that purpose.",
      ],
    },
    {
      heading: "SECTION 13 – Your Choices and Rights",
      clauses: [
        "§13.1 Because the Site has no accounts, the simplest controls are in your hands: submit only public links, clear your browser storage to reset your preferences and analytics session, and decline analytics where a control is offered.",
        "§13.2 Depending on where you live, you may have rights to access, correct, delete, or restrict the processing of personal information, to object to it, or to data portability. Because we hold very little that is tied to you, honoring such a request may simply mean explaining what is described in this Policy. To make a request, contact the operator using the route in §2.2.",
        "§13.3 Because this is open, self-hostable software, the most complete control of all is to run your own instance.",
      ],
    },
    {
      heading: "SECTION 14 – International Users",
      clauses: [
        "§14.1 The operator may run the Site, and its infrastructure providers may process data, in a country other than the one you live in. By using the Site you understand that the limited information described here may be processed in those locations.",
      ],
    },
    {
      heading: "SECTION 15 – Changes to this Privacy Policy",
      clauses: [
        "§15.1 We may update this Policy from time to time. When we do, we will revise the \"last modified\" date at the top, and significant changes may be highlighted on the Site. Your continued use of the Services after an update means you accept the revised Policy.",
      ],
    },
  ],
};

const terms: LegalDoc = {
  title: "Terms of Service",
  lastModified: "These terms of service were last revised on 29 June 2026.",
  intro:
    "These Terms of Service govern your use of Your Site, a self-hosted utility for retrieving publicly available YouTube data: transcripts, thumbnails, tags, and video or audio downloads. Please read them carefully: by using the Site you agree to them. The Site is a free tool, provided as is, and is not affiliated with YouTube or Google.",
  sections: [
    {
      heading: "SECTION 1 – Acceptance of These Terms",
      clauses: [
        "§1.1 These terms of service (the \"Terms\") are an agreement between you (\"you\", \"your\", or \"User\") and the operator of this instance of \"Your Site\" (the \"Site\", \"we\", \"us\", or \"our\"). They govern your access to and use of the Site and its tools (the \"Services\").",
        "§1.2 By accessing or using the Services, you agree to be bound by these Terms and by our Privacy Policy, which is incorporated by reference. If you do not agree, do not use the Services.",
        "§1.3 Because this is self-hostable software, the operator of the particular instance you are using may post additional or different terms for that instance; where they conflict, the operator's posted terms control for that instance.",
      ],
    },
    {
      heading: "SECTION 2 – Definitions",
      clauses: [
        "§2.1 \"Services\" means the tools the Site provides, including the extractor, transcript, thumbnail, tags/keyword, and download features, together with any related functionality.",
        "§2.2 \"Content\" means the data the Services retrieve about a video, including its title, description, tags, thumbnails, metadata, captions/transcript, and the video and audio streams themselves.",
        "§2.3 \"YouTube\" means the YouTube platform operated by Google LLC, and \"Google\" means Google LLC and its affiliates.",
        "§2.4 \"yt-dlp\" means the third-party, open-source program the Site uses to retrieve Content from YouTube.",
      ],
    },
    {
      heading: "SECTION 3 – What the Services Do",
      clauses: [
        "§3.1 The Services accept a public YouTube URL or video ID and return publicly available information about that video, let you view it through an embedded YouTube player, and, at your request, assemble a downloadable copy of the video or its audio. The Services act at your direction, as a convenience for retrieving information you could otherwise obtain from YouTube yourself.",
        "§3.2 The Services depend entirely on YouTube and on yt-dlp. YouTube may change its platform at any time, and Content may become unavailable, incomplete, rate-limited, or blocked without notice. Auto-generated transcripts in particular may be inaccurate, incomplete, or misattributed.",
      ],
    },
    {
      heading: "SECTION 4 – Eligibility and Access",
      clauses: [
        "§4.1 You may use the Services only if you are at least 18 years old (or the age of majority in your jurisdiction), can form a binding contract with the operator, and are not barred from doing so under applicable law. If you use the Services on behalf of an organization, you represent that you are authorized to accept these Terms for it.",
        "§4.2 No account is required. Access is provided on a shared, best-effort basis and is subject to the rate limits and other controls described in these Terms.",
      ],
    },
    {
      heading: "SECTION 5 – Acceptable Use",
      clauses: [
        "§5.1 You agree to use the Services only for lawful purposes and in a reasonable, personal-scale manner. In particular, you agree NOT to: (a) use the Services to infringe copyright or other rights, or to download, reproduce, or redistribute Content you do not have the right to use; (b) circumvent, disable, or interfere with rate limits, caching, or other technical controls, or attempt to access non-public parts of the Site or its infrastructure; (c) use bots, scripts, or other automation to send requests at a volume beyond ordinary personal use, or to scrape, bulk-download, or mirror the Services; (d) overload, flood, or attempt to disrupt the Site, its infrastructure, or, through the Site, YouTube's infrastructure; (e) use the Services to build or train a competing bulk-extraction or scraping service; (f) probe, scan, or test the vulnerability of the Site or breach its security or authentication measures; or (g) use the Services in any way that violates YouTube's or Google's terms, or any applicable law or regulation.",
        "§5.2 We may apply rate limits, caching, and other controls, and may suspend, restrict, or block access (including by network or IP) where we believe the Services are being misused or where necessary to protect the Site, its users, or YouTube. We are not obligated to monitor use, but may do so to operate and protect the Services.",
      ],
    },
    {
      heading: "SECTION 6 – Third-Party Content, Copyright, and YouTube's Terms",
      clauses: [
        "§6.1 All Content belongs to its respective owners: the video creators, YouTube, Google, and other rights holders. The Services do not grant you any ownership of, or license to, that Content. Being able to retrieve Content through the Site does not make it yours to use freely.",
        "§6.2 You are solely responsible for how you use Content. You must comply with YouTube's Terms of Service, Google's policies, and all applicable copyright and other laws. Download or reuse Content only where you have the right to do so, for example, Content you own, Content in the public domain or under a permissive license, or use otherwise permitted by law (such as a personal or fair-dealing/fair-use exception in your jurisdiction).",
        "§6.3 The Services are a general-purpose tool with substantial legitimate uses (for example, retrieving your own videos, accessibility, research, quotation, and offline personal viewing). We do not endorse, and you must not use the Services for, copyright infringement or any other unlawful purpose. Responsibility for your use rests with you, not with the operator.",
        "§6.4 If you are a rights holder and believe an instance is being used to infringe your rights, you may ask the operator to remove the cached Content under Section 7 (Copyright Complaints and Takedown).",
      ],
    },
    {
      heading: "SECTION 7 – Copyright Complaints and Takedown",
      clauses: [
        "§7.1 We respect the intellectual property rights of others and respond to clear notices of alleged infringement. Because the Services can retrieve, briefly process, and temporarily cache Content from YouTube, a rights holder who believes Content cached by, or made available through, an instance infringes their rights may send a takedown request to the operator of that instance using the contact route in the Privacy Policy.",
        "§7.2 To help the operator act on your request, a notice should include, at a minimum: (a) identification of the copyrighted work or other right you claim; (b) the specific video URL or Content at issue, described in enough detail to locate it; (c) your name and contact details; (d) a statement that you have a good-faith belief the use is not authorized by the rights holder, its agent, or the law; (e) a statement that the information in your notice is accurate and (under penalty of perjury, where applicable) that you are the rights holder or are authorized to act on their behalf; and (f) your physical or electronic signature.",
        "§7.3 On receipt of a valid request, the operator will remove or disable access to the identified cached Content within a reasonable time. Cached entries also expire automatically (see the Privacy Policy). The underlying video remains on YouTube and is outside the operator's control; complaints about the video itself should be directed to YouTube.",
        "§7.4 Repeat infringers. The operator may restrict or block access to the Services (including by network or IP address) for anyone who, in the operator's reasonable judgment, repeatedly uses the Services to infringe.",
        "§7.5 Good faith. Submitting a knowingly false or bad-faith notice may expose you to liability. This Section sets out a good-faith complaints process and does not waive any right or defense available to the operator or to users, including that retrieving or caching publicly available information may be lawful.",
      ],
    },
    {
      heading: "SECTION 8 – No Affiliation; Trademarks",
      clauses: [
        "§8.1 The Site is an independent, unofficial tool. It is not affiliated with, endorsed by, sponsored by, or in any way officially connected to YouTube, Google, or their affiliates.",
        "§8.2 \"YouTube\" and \"Google\" are trademarks of Google LLC. Other names and marks are the property of their respective owners. They are used here only to describe what the Services interoperate with, not to imply any association.",
      ],
    },
    {
      heading: "SECTION 9 – Availability and Changes to the Services",
      clauses: [
        "§9.1 The Services are provided free of charge and on a best-effort basis. We may change, suspend, limit, or discontinue all or part of the Services at any time, with or without notice, for any reason, including changes on YouTube's side that break retrieval.",
        "§9.2 We do not guarantee that the Services will be available, uninterrupted, timely, accurate, or error-free, or that any particular video, format, resolution, or transcript will be retrievable.",
      ],
    },
    {
      heading: "SECTION 10 – Disclaimers",
      clauses: [
        "§10.1 To the maximum extent permitted by law, the Services and all Content are provided \"AS IS\" and \"AS AVAILABLE\", without warranties of any kind, whether express, implied, or statutory, including the implied warranties of merchantability, fitness for a particular purpose, accuracy, and non-infringement.",
        "§10.2 We make no warranty that the Services will meet your requirements, that Content retrieved will be accurate or complete, or that the Services will be secure, available, or free of viruses or errors. You use the Services, and rely on any Content obtained through them, at your own risk.",
      ],
    },
    {
      heading: "SECTION 11 – Limitation of Liability",
      clauses: [
        "§11.1 To the maximum extent permitted by law, in no event will the operator be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, or for any loss of data, profits, goodwill, or opportunity, arising out of or relating to your use of (or inability to use) the Services, even if advised of the possibility of such damages.",
        "§11.2 To the maximum extent permitted by law, the operator's total liability for all claims relating to the Services will not exceed the greater of (a) the amount you paid to use the Services (which, for a free tool, is zero) or (b) USD $50.",
        "§11.3 Some jurisdictions do not allow certain limitations, so some of the above may not apply to you. In that case, our liability is limited to the smallest extent permitted by law.",
      ],
    },
    {
      heading: "SECTION 12 – Indemnification",
      clauses: [
        "§12.1 To the extent permitted by law, you agree to indemnify and hold harmless the operator from any claims, damages, liabilities, and reasonable expenses (including legal fees) arising out of your misuse of the Services, your violation of these Terms, or your infringement of any third party's rights, including any unauthorized download, reproduction, or distribution of Content.",
      ],
    },
    {
      heading: "SECTION 13 – Intellectual Property in the Site",
      clauses: [
        "§13.1 These Terms concern your use of the Services and do not transfer ownership of the Site's own software, design, or branding. Any open-source components of the Site remain governed by their respective licenses.",
        "§13.2 Nothing in these Terms grants you rights in YouTube's Content; Section 6 governs Content.",
      ],
    },
    {
      heading: "SECTION 14 – General Provisions",
      clauses: [
        "§14.1 Changes. We may update these Terms from time to time. When we do, we will revise the \"last revised\" date above. Your continued use of the Services after a change means you accept the updated Terms.",
        "§14.2 Governing law. These Terms are governed by the laws applicable where the operator of the instance is established, without regard to conflict-of-law rules. The operator may specify the governing law and venue for its instance.",
        "§14.3 Severability. If any provision of these Terms is held unenforceable, that provision will be limited or removed to the minimum extent necessary, and the remaining provisions will stay in full force.",
        "§14.4 No waiver. Our failure to enforce any provision is not a waiver of our right to enforce it later.",
        "§14.5 Entire agreement. These Terms and the Privacy Policy (together with any additional terms the operator posts for its instance) are the entire agreement between you and the operator regarding the Services, and supersede any prior understandings.",
        "§14.6 Contact. Questions about these Terms can be directed to the operator using the contact route described in the Privacy Policy.",
      ],
    },
  ],
};

const refund: LegalDoc = {
  title: "Refund Policy",
  lastModified: "This refund policy was last modified on 29 June 2026.",
  intro:
    "Your Site is free to use, and most of what it does (transcripts, thumbnails, tags, metadata, and everyday downloads) costs nothing. This Refund Policy applies only to the optional paid subscription that raises the daily limits and unlocks higher-resolution downloads. It explains when the fees for a paid plan can be refunded, how to ask for a refund, and the statutory rights you may have. It forms part of, and should be read with, our Terms of Service and Privacy Policy.",
  sections: [
    {
      heading: "SECTION 1 – Overview and Scope",
      clauses: [
        "§1.1 This Refund Policy (the \"Policy\") sets out the terms on which the operator of this instance of \"Your Site\" (the \"Site\", \"we\", \"us\", or \"our\") will refund fees paid for an optional paid subscription to the Site's tools (the \"Services\"). It is incorporated into our Terms of Service, and words defined there have the same meaning here.",
        "§1.2 The core Services are provided free of charge. A paid subscription is entirely optional: it simply raises the daily usage limits and unlocks higher-resolution (HD and 4K) downloads. If you use only the free tier, you are never charged and this Policy does not affect you.",
        "§1.3 Because the Services are delivered electronically and access to paid features begins as soon as a subscription starts, fees are generally non-refundable once a billing term is under way, except as set out in this Policy or as required by law.",
      ],
    },
    {
      heading: "SECTION 2 – 7-Day Money-Back Window",
      clauses: [
        "§2.1 You may request a full refund of the most recent fee charged for a paid subscription if you contact us within seven (7) calendar days of that charge, whether it is your first payment or a renewal. This window applies to both monthly and annual subscriptions.",
        "§2.2 A refund under this Section covers the most recent billing term only. Earlier terms that have already run are not refundable, because the paid features were available to you throughout them.",
        "§2.3 When a refund is issued, your access to the paid features ends and your plan returns to the free tier.",
      ],
    },
    {
      heading: "SECTION 3 – After the Window; Cancellation",
      clauses: [
        "§3.1 Once the seven (7) day window has passed, the fee for the current billing term is non-refundable, and we do not provide partial or pro-rata refunds for the remainder of a term you have begun.",
        "§3.2 You can cancel a subscription at any time to stop it from renewing. Cancellation prevents future charges; it does not refund the term you are already in, and you keep access to the paid features until that paid term ends.",
        "§3.3 Annual subscriptions are charged for the year in advance. Outside the seven (7) day window and the statutory rights in Section 7, the remaining months of an annual term are not refundable, though you may still cancel to prevent the next renewal.",
      ],
    },
    {
      heading: "SECTION 4 – How to Request a Refund",
      clauses: [
        "§4.1 To request a refund, contact the operator of this instance using the billing or contact route published for the Site (for example, billing@yoursite.example, or the route described in our Privacy Policy). Replace this with the real billing contact for your deployment before publishing.",
        "§4.2 To help us find your payment quickly, please include: (a) the email address or account used for the subscription; (b) the approximate date of the charge; (c) the payment reference or receipt number, if you have it; and (d) a short note of the reason for your request. We may ask for further detail to verify the payment.",
        "§4.3 We aim to acknowledge a refund request within a few business days and to process approved refunds promptly. Refunds are returned to the original payment method; depending on your bank or card provider, it can take several further business days for the funds to appear on your statement.",
      ],
    },
    {
      heading: "SECTION 5 – Non-Refundable Charges",
      clauses: [
        "§5.1 Except where this Policy or the law provides otherwise, the following are not refundable: (a) any billing term for which the request is made more than seven (7) days after the charge; and (b) the portion of a term you have already used.",
        "§5.2 Where a promotional price, coupon, or discount was applied to a subscription, only the amount you actually paid can be refunded.",
        "§5.3 Free use of the Site is never charged and therefore never refundable. Nothing in this Policy creates a right to payment for use of the free tier.",
      ],
    },
    {
      heading: "SECTION 6 – Duplicate Charges and Billing Errors",
      clauses: [
        "§6.1 If you believe you were charged more than once for the same subscription, or charged in error, contact us as described in Section 4 with the payment details. Verified duplicate charges and billing errors are refunded in full, regardless of the seven (7) day window.",
      ],
    },
    {
      heading: "SECTION 7 – Statutory Cancellation Rights (EEA and UK)",
      clauses: [
        "§7.1 If you are a consumer in the European Economic Area or the United Kingdom, you may have a statutory right to cancel a purchase within fourteen (14) days without giving a reason. Where that right applies and is more generous than the window in Section 2, the statutory right prevails.",
        "§7.2 Because the paid features are digital content supplied immediately, you may be asked to agree that supply begins at once. Where the law allows, the amount refunded under a statutory cancellation right may be reduced to reflect the use you have already made of the paid features before cancelling.",
      ],
    },
    {
      heading: "SECTION 8 – Chargebacks",
      clauses: [
        "§8.1 If something has gone wrong with a payment, please contact us first: most issues are resolved quickly and informally. Filing a chargeback or payment dispute with your bank before contacting us can lead to your subscription being suspended while the dispute is investigated.",
        "§8.2 Where a chargeback is later found to be unjustified, we may suspend or end your access to the paid features and seek to recover the disputed amount and any related fees, in addition to the remedies described in our Terms of Service.",
      ],
    },
    {
      heading: "SECTION 9 – Service Changes or Discontinuation",
      clauses: [
        "§9.1 As explained in our Terms of Service, the Services are provided on a best-effort basis and may change or be discontinued. If a paid subscription is discontinued and cannot be provided for a period you have already paid for, we will refund the unused, prepaid portion of that term.",
      ],
    },
    {
      heading: "SECTION 10 – Changes to this Refund Policy",
      clauses: [
        "§10.1 We may update this Policy from time to time. When we do, we will revise the \"last modified\" date above, and the version in effect at the time of your most recent charge applies to that charge. Your continued use of a paid subscription after an update means you accept the revised Policy.",
      ],
    },
    {
      heading: "SECTION 11 – Contact",
      clauses: [
        "§11.1 Questions about this Refund Policy, or a request for a refund, can be sent to the operator of this instance using the billing or contact route described in Section 4 and in our Privacy Policy.",
      ],
    },
  ],
};

const faq: FaqDoc = {
  title: "FAQ",
  intro:
    "Answers to the questions we hear most about pulling transcripts, thumbnails, tags and downloads from any public YouTube video.",
  items: [
    {
      question: "Is Your Site free to use?",
      answer:
        "Yes. Every tool (transcripts, thumbnails, tags, metadata and downloads) is free to use, and you don't need an account. The free tier covers 25 video lookups and 3 downloads a day, which is plenty for everyday use. If you need more, an optional Paid plan lifts the daily limits and unlocks HD and 4K downloads.",
    },
    {
      question: "How do I access the transcript after I generate it?",
      answer:
        "As soon as the transcript appears you can copy the whole thing to your clipboard with a single click, or read it side by side with the video in the embedded player. You can also switch between a clean plain-text view and a timestamped view.",
    },
    {
      question: "Can I translate the transcript into other languages?",
      answer:
        "We don't translate transcripts on the site itself. What you get is the caption track that already exists on the original YouTube video, so the languages on offer depend on what the creator, or YouTube's automatic captions, provide for that video. Once you've copied or exported the text, you're free to run it through the translator of your choice.",
    },
    {
      question: "Is there a limit to the length of video I can transcribe?",
      answer:
        "No. There's no cap on video length: a short clip and a multi-hour stream work exactly the same way. Longer videos just take a moment more to fetch the first time.",
    },
    {
      question: "How long does it take to generate a transcript?",
      answer:
        "Usually only a few seconds. Paste the YouTube link, click \"Get transcript,\" and the text appears almost immediately. The first request for a given video is fetched fresh; after that it's cached, so re-opening the same video is instant.",
    },
    {
      question: "Can I download the transcript?",
      answer:
        "Yes. Besides one-click copy, you can export the transcript as a plain-text (.txt), Markdown (.md) or subtitle (.srt) file. The Markdown export is tidied-up prose that's handy for notes or feeding into an AI assistant, and the .srt keeps the timestamps so it can be used as subtitles.",
    },
    {
      question: "Is there a limit to how many transcripts I can generate?",
      answer:
        "On the free tier you get 25 lookups a day. A \"lookup\" is the first time you fetch a particular video's transcript, metadata or tags, counted once per video per day. Re-opening a video you've already fetched is free, and thumbnails never count. The Paid plan removes the daily limit entirely.",
    },
    {
      question: "Do you offer a YouTube transcript API?",
      answer:
        "We don't offer a separate, commercial transcript API right now. The tools here are meant to be used through the site. That said, the whole project is open, self-hostable software, so if you need programmatic access you can run your own instance and call its endpoints directly.",
    },
  ],
  article: [
    { kind: "h2", text: "Free MP3 Converter: Upload Any Video or Audio File" },
    {
      kind: "p",
      text: "YTMP3 is a free MP3 converter that runs entirely in your browser. Upload a video or audio file from your device and get an MP3 in seconds: no software to install, no account to create, and no limits on how many files you convert.",
    },
    {
      kind: "p",
      text: "Whether you have an MP4 recording from your camera, a MOV clip from your iPhone, a WAV file from a studio session, or an M4A exported from GarageBand, this tool handles all of them and outputs a clean, high-quality MP3.",
    },
    { kind: "h2", text: "How to Convert a File to MP3 in Three Steps" },
    {
      kind: "p",
      text: "The process is designed to be as simple as possible. You do not need to adjust settings or create an account. Just upload and download.",
    },
    { kind: "h3", text: "Upload Your File" },
    {
      kind: "p",
      text: "Drag your video or audio file into the upload zone above, or click to browse your device. You can add multiple files at the same time for batch conversion. Supported formats include MP4, MOV, AVI, MKV, WebM, FLV, WMV, MPEG, 3GP, M4V, TS, WAV, and M4A.",
    },
    { kind: "h3", text: "Wait for the Conversion" },
    {
      kind: "p",
      text: "The converter extracts the audio track from your file and encodes it as an MP3 directly in your browser. Processing speed depends on the file size, but most files finish in under a minute.",
    },
    { kind: "h3", text: "Download Your MP3" },
    {
      kind: "p",
      text: "Click the download button next to the converted file. If you uploaded multiple files, you can download them individually or grab everything at once as a ZIP archive.",
    },
    { kind: "h2", text: "Convert MP4 to MP3 Online: The Most Common Use Case" },
    {
      kind: "p",
      text: "MP4 to MP3 is the most frequently requested conversion, and for good reason. Video files take up far more storage than audio. When all you need is the soundtrack (a lecture, a podcast recorded as video, a music performance, or a personal voice memo), converting MP4 to MP3 shrinks the file dramatically while keeping the audio intact.",
    },
    {
      kind: "p",
      text: "Upload your MP4 file, and the converter strips the video track and saves only the audio as MP3. The original video file stays on your device untouched.",
    },
    { kind: "h2", text: "Convert MOV to MP3" },
    {
      kind: "p",
      text: "MOV is the default video format used by iPhones and Mac cameras. If you have recorded something on your Apple device and want only the audio, upload the MOV file here and convert it to MP3 without needing iMovie or any desktop software.",
    },
    {
      kind: "p",
      text: "This is useful for voice recordings, interviews captured on an iPhone, and screen recordings that contain spoken audio you want to reuse.",
    },
    { kind: "h2", text: "Convert AVI and MKV to MP3" },
    {
      kind: "p",
      text: "AVI and MKV files are common on Windows PCs and older media players. Both formats store video and audio together. Use this converter to extract the audio and save it as MP3, a format compatible with virtually every device, app, and media player on the market.",
    },
    {
      kind: "p",
      text: "MKV files sometimes contain multiple audio tracks. The converter picks the primary audio track and exports it as MP3 automatically.",
    },
    { kind: "h2", text: "Convert WAV to MP3: Smaller Files, Same Quality" },
    {
      kind: "p",
      text: "WAV is a lossless, uncompressed format used in professional recording software. WAV files are large, often ten to fifty times bigger than an equivalent MP3. Converting WAV to MP3 lets you store, share, and stream the audio far more easily without a noticeable drop in perceived quality for everyday listening.",
    },
    {
      kind: "p",
      text: "This converter accepts WAV files of any size and produces an MP3 that is ready to play on phones, computers, cars, and streaming platforms.",
    },
    { kind: "h2", text: "Convert M4A to MP3 for Universal Compatibility" },
    {
      kind: "p",
      text: "M4A is Apple's audio format, commonly produced by iTunes, GarageBand, and iOS voice recorders. While M4A sounds great, it is not supported by every device or platform. Converting M4A to MP3 ensures your audio plays anywhere, including older car stereos, Android devices, Windows Media Player, and web-based audio players.",
    },
    {
      kind: "p",
      text: "Upload your M4A file above and download a universally compatible MP3 within seconds.",
    },
    { kind: "h2", text: "Batch Convert: Multiple Files at Once" },
    {
      kind: "p",
      text: "If you have several videos or audio files to convert, there is no need to do them one by one. YTMP3 supports batch conversion: select or drag in multiple files, and the converter processes them all simultaneously. When all files are ready, download them together as a single ZIP archive to keep things organized.",
    },
    {
      kind: "p",
      text: "Batch conversion saves time for content creators, students, and anyone managing a large media library.",
    },
    { kind: "h2", text: "Why MP3 Is Still the Best Format for Audio" },
    {
      kind: "p",
      text: "Despite newer formats like AAC, Opus, and FLAC, MP3 remains the most universally supported audio format in the world. Every smartphone, car system, media player, game console, and audio editing application plays MP3 files without any configuration. If you want audio that works everywhere without compatibility questions, MP3 is still the right choice.",
    },
    {
      kind: "p",
      text: "At 128 kbps, an MP3 is perfectly clear for voice content. At 192–320 kbps, it is indistinguishable from the source for music. The format strikes a balance between file size and audio quality that no other format has matched in terms of universal adoption.",
    },
    { kind: "h2", text: "Your Files Stay Private: No Upload to Any Server" },
    {
      kind: "p",
      text: "Unlike many online converters that upload your file to a remote server for processing, YTMP3 converts files directly inside your browser using your device's own processing power. Your files are never sent anywhere. They stay on your device from start to finish.",
    },
    {
      kind: "p",
      text: "This makes YTMP3 safe for converting sensitive recordings, personal videos, confidential audio, or anything you would rather not share with a third-party server.",
    },
    { kind: "h2", text: "Works on Any Device Without Installing Anything" },
    {
      kind: "p",
      text: "Because the converter runs in the browser, it works on Windows, macOS, Linux, Android, and iPhone. There is no app to download, no extension to install, and no plugin to enable. Open the page in any modern browser (Chrome, Safari, Firefox, or Edge) and start converting immediately.",
    },
    {
      kind: "p",
      text: "On mobile, tap the upload zone to access your camera roll, file manager, or cloud storage. The converted MP3 will download directly to your device's default download folder.",
    },
    { kind: "h2", text: "Who Uses an Online MP3 Converter" },
    {
      kind: "p",
      text: "Students record lectures on a phone as MP4 and convert them to MP3 for easier playback while studying. Podcasters receive video submissions and extract the audio before editing. Musicians convert demos recorded as MOV or MKV into MP3 for sharing with collaborators. Teachers convert their screen-recorded lessons into audio so learners can listen on the go.",
    },
    {
      kind: "p",
      text: "Anyone who has a video file but only needs the audio will find this converter useful.",
    },
  ],
  converterFaq: [
    {
      question: "Which file formats can I convert to MP3?",
      answer:
        "You can upload MP4, MOV, AVI, MKV, WebM, FLV, WMV, MPEG, 3GP, M4V, TS, WAV, M4A, and more. Drag the file into the upload zone or click to browse. The converter detects the format automatically.",
    },
    {
      question: "How do I convert a video to MP3 online?",
      answer:
        "Upload your video file using the upload zone at the top of this page. The converter will extract the audio track and deliver an MP3 file ready to download. No software, no sign-up required.",
    },
    {
      question: "Can I convert multiple files at the same time?",
      answer:
        "Yes. Select or drag in several files at once and the converter processes them all in parallel. When every file is ready, you can download them individually or as a ZIP archive.",
    },
    {
      question: "Is this MP3 converter completely free?",
      answer:
        "Yes. Converting files to MP3 on YTMP3 is free: no hidden fees, no ads, no email required, and no limit on how many files you convert.",
    },
    {
      question: "Does it upload my file to a server?",
      answer:
        "No. The conversion happens entirely in your browser. Your files are processed locally on your own device and are never uploaded to or stored on any external server.",
    },
    {
      question: "Can I convert MP4 to MP3?",
      answer:
        "Yes. MP4 to MP3 is the most common conversion. Upload the MP4 file, and the tool strips the video and saves the audio as a standard MP3 file.",
    },
    {
      question: "Does it work on iPhone and Android?",
      answer:
        "Yes. The converter is fully browser-based and works on any modern mobile device. Open the page, tap to select a file from your camera roll or file manager, and download the MP3 directly to your device.",
    },
    {
      question: "What is the best quality setting for MP3?",
      answer:
        "For voice recordings and podcasts, 128 kbps delivers clear audio at a small file size. For music and high-fidelity content, 192 kbps or 320 kbps preserves more detail. The converter produces output at a high quality bitrate by default.",
    },
  ],
};

const base: Messages = {
  nav: { brandFull: "Your Site", brandTagline: "" },
  privacy,
  terms,
  refund,
  faq,
};

export const messages: Record<Locale, Messages> = {
  en: base,
};
