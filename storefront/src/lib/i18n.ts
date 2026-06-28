import { useContext } from "react";
import { LanguageContext } from "@/components/LanguageProvider";

// Supported UI locales. The language switcher was removed during the rebuild,
// so every locale currently resolves to the same neutral copy.
export const LOCALES = ["en", "my", "zh"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

type LegalSection = { heading: string; clauses: string[] };
type LegalDoc = {
  title: string;
  lastModified: string;
  intro: string;
  sections: LegalSection[];
};

export type Messages = {
  nav: { brandFull: string; brandTagline: string };
  privacy: LegalDoc;
  terms: LegalDoc;
};

// Legal copy preserved from the previous site. Update the wording to match the
// new business before publishing.
const privacy: LegalDoc = {
  title: "Privacy Policy",
  lastModified: "This privacy policy was last modified on 19 May 2026.",
  intro:
    "Find Care Helper Pte Ltd respects your privacy and is committed to protecting your personal information. This Policy explains what we collect, how we use it, and the rights you hold as a data subject under Singapore law.",
  sections: [
    {
      heading: "SECTION 1 – Privacy Policy Overview",
      clauses: [
        "§1.1 Find Care Helper Pte Ltd (\"FCH\", \"we\", \"us\" or \"our\") respects your privacy and is committed to protecting your personal information or, as otherwise termed, \"personal data\".",
        "§1.2 The purpose of this privacy policy (the \"Policy\") is to provide you with information about our privacy practices generally and what information we may collect, use and share about you when you visit our website (the \"Website\"), and/or when you engage our recruitment, training, and placement services (the \"Services\").",
        "§1.3 This Policy informs you about: (i) how we will handle and look after your personal data, (ii) our obligations in regard to processing your personal data responsibly and securely, (iii) your data protection rights as a data subject, and (iv) how the law protects you. This Policy should be read in conjunction with our Terms of Service.",
        "§1.4 For purposes of clarity, this Policy does not apply to any other services which we may offer, whether or not accessed through our Website, unless otherwise specified.",
      ],
    },
    {
      heading: "SECTION 2 – Who We Are And How To Contact Us",
      clauses: [
        "§2.1 FCH is the controller and responsible for determining what personal information we collect and how it is used or shared.",
        "§2.2 We are registered in Singapore as a private limited company. Our registered office address is available upon request.",
        "§2.3 The Website is operated by us, Find Care Helper Pte Ltd. The Website is not intended for minors and the Services are not offered to minors. As such, we do not knowingly collect personal data relating to minors.",
        "§2.4 If you have any questions about our Privacy Policy or privacy practices, please contact us by email at contact@findcarehelper.com or via the WhatsApp link available on our Website.",
      ],
    },
    {
      heading: "SECTION 3 – About our Privacy Policy",
      clauses: [
        "§3.1 The privacy of your Personal Information is important to us. We respect your rights to privacy and rights under the Personal Data Protection Act 2012 (Singapore) (the \"PDPA\") and are committed to complying with the requirements of Privacy Laws in the collection and handling of your Personal Information.",
        "§3.2 This policy explains how we collect, retain, process, share, transfer and handle your Personal Information and describes the kinds of Personal Information we collect, use, disclose and our purposes for doing so.",
        "§3.3 We use some defined terms in this policy. You can find the meaning of each defined term at the end of this policy.",
        "§3.4 Personal Information is information which may be used to reasonably identify you. For example, your name, address, date of birth, gender, passport number, email address and telephone number are generally considered to be Personal Information. Personal Information may also include information we collect about your individual preferences, employment history, skills assessments, training records and references.",
        "§3.5 This policy applies to your Personal Information when you use our Website, and interact generally with us, but does not apply to Third Party Sites. We are not responsible for the privacy policies or content of Third Party Sites.",
        "§3.6 For the avoidance of doubt, unless stated otherwise, this policy will govern our collection of your Personal Information irrespective of the forum.",
        "§3.7 This policy may be updated from time to time and the most up to date version will be published on our Website. We encourage you to check our Website periodically to ensure that you are aware of our current policy.",
        "§3.8 Your continued usage of our Website and/or Services will be taken to indicate your acceptance of the terms of this privacy policy.",
        "§3.9 We may disclose your personal information if we are required by law to do so or if you violate our Terms of Service.",
      ],
    },
    {
      heading: "SECTION 4 – Why we collect Personal Information",
      clauses: [
        "§4.1 When you visit our Website or engage our Services, we collect Personal Information so that we can provide you with recruitment, training, and placement services and improve and customize your experience with us. We only collect Personal Information if it is reasonably necessary for us to carry out our functions and activities.",
        "§4.2 The purposes for which we collect and hold your Personal Information include: (a) to deliver our recruitment, training, and placement services to you; (b) to improve our Services; (c) to manage our relationship with you, evaluate our business performance and build our candidate and employer database; (d) to respond to your requests and seek your feedback; (e) to provide and improve technical support and customer service; (f) to conduct research, compare information for accuracy and verification purposes, compile or analyze statistics relevant to the operations of our business; (g) to facilitate our internal business operations, including fulfilment of any legal and regulatory requirements (including those imposed by the Singapore Ministry of Manpower and the Employment Agencies Act) and monitoring, analyzing and improving the performance and functionality of our Website and investigating breaches of or enforcement of any legal terms applicable to our Website; (h) to protect our property, the Website or our legal rights including to create backups of our business records; (i) to manage risk and protect our Website and Services from fraud by verifying your identity and helping to detect and prevent fraudulent use of our Website; (j) for the direct marketing and promotional purposes as set out below; and (k) to manage our business, including analyzing data collected from our Website concerning visits and activities of users on our Website including the Analytics Services. This analysis helps us run our Website more efficiently and improve and personalize your experience online.",
      ],
    },
    {
      heading: "SECTION 5 – What Personal Information do we collect?",
      clauses: [
        "§5.1 The kinds of Personal Information we collect will depend on the type of interaction you have with us. Generally, the kinds of Personal Information we collect may include: (a) your name, address (postal and residential), email address, telephone number(s), date of birth, gender, nationality and marital status when you register or apply with us; (b) for candidates: passport details, immigration documents, work permit history, previous and current employment details, employment references, skills assessments, training records and certifications, photographs and video for portfolio and matching purposes, language proficiency, medical attestations relevant to the placement, emergency contact details, and bank account details where required to facilitate payment of wages; (c) for employers: company or household details, placement preferences, household composition (where relevant for domestic placements), and prior recruitment history; (d) information from third party sources such as background-check providers, prior employers, training providers and partner agencies, where permitted by law; (e) details of the device you have used to access any part of our Website, including carrier/operating system, connection type, IP address, browser type and referring URLs and other information that may be collected and used by us automatically if you use our Website, through the browser on your device or otherwise; (f) demographic information; (g) location data; (h) your connections with others whose personal information we may collect or hold; and (i) transaction details relating to your use of our Services including data regarding your feature usage patterns, interactions on our Website and interactions with us.",
      ],
    },
    {
      heading: "SECTION 6 – With whom do we share Personal Information?",
      clauses: [
        "§6.1 We may disclose Personal Information collected from you: (a) to our related entities, employees, officers, agents, contractors, other companies that provide services to us, government agencies (including the Singapore Ministry of Manpower, the Immigration and Checkpoints Authority, and equivalent authorities in the countries our candidates originate from or travel through) or other third parties to satisfy the purposes for which the information was collected (as outlined in clause §4.2 of this policy) or for another purpose if that other purpose is closely related to the primary purpose of collection and an individual would reasonably expect us to disclose the information for that secondary purpose; (b) to prospective or actual employers as part of the placement and matching process; (c) to partner agencies, training providers, and other recruitment intermediaries who assist us to provide the Services we provide to you; (d) to third parties who help us to verify the identity of our candidates, employers and partners, conduct background checks, and other software service providers who assist us to provide the Services we provide to you; (e) to third parties who help us analyze the information we collect so that we can administer, support, improve or develop our business and the Services we provide to you including cloud hosting services, off-site backups and customer support; (f) to third parties in the recruitment, training, advertising and marketing sectors to use your information in order to let you know about employment opportunities, services or training; (g) if the disclosure is requested by law enforcement or government agency, or is required by a law, or legal process, such as a subpoena, court or other legal process with which we are required to comply, including in relation to our obligations under applicable employment, immigration, anti-trafficking and anti-money-laundering laws; (h) if disclosure is required to enforce the terms of this policy or to enforce any of our terms and conditions with you; (i) to our professional advisers such as consultants, lawyers and auditors so that we can meet our regulatory obligations, and administer, support, improve or develop our business; (j) to any other person, with your consent (express or implied); (k) to facilitate the sale of all or a substantial part of our assets or business or to companies with which we propose to merge or who propose to acquire us and their advisers; (l) to protect the interests of our users, candidates, employers and third parties from cyber security risks or incidents and other risks or incidents; and (m) to maintain the integrity of our Website and protect our rights, interests and property and those of third parties.",
        "§6.2 In addition to the above recipients, we will disclose your Personal Information if we are required to do so under law or if the disclosure is made in connection with either the normal operation of our business in a way that you might reasonably expect, for example, if such disclosure is incidental to IT services being provided to our business or for the resolution of any dispute that arises between you and us. This disclosure may involve your Personal Information being transmitted Overseas.",
        "§6.3 In the event of a proposed restructure or sale of our business (or part of our business) or where a company proposes to acquire or merge with us, we may disclose Personal Information to the buyer and their advisers without your consent subject to compliance with Privacy Laws. If we sell the business and the sale is structured as a share sale, you acknowledge that this transaction will not constitute the \"transfer\" of Personal Information.",
        "§6.4 We may disclose de-identified, aggregated data with third parties for marketing, advertising, and analytics purposes. We do not sell or trade your personal information to third parties.",
      ],
    },
    {
      heading: "SECTION 7 – How we collect and store data and transmit Personal Information",
      clauses: [
        "§7.1 We usually collect and store information including in paper, physical and electronic form provided by you when you communicate with us by telephone (including via WhatsApp and other messaging applications), email, web-based form, in-person interview, letter, facsimile or other means, including when: (a) we provide you with our Services via email, messaging applications, or our Website; (b) we provide you with assistance or support for our Services; (c) you participate in our recruitment process, training programmes, interviews, functions or activities; (d) you request that we provide you with information concerning our Services; (e) you upload or submit information, documents, photographs or video to us or our Website; or (f) you complete any forms requesting information from you, including on registration with us, complete any survey or provide feedback to us concerning our Services.",
        "§7.2 Where practicable we will only collect information from you personally. However, we will also collect your Personal Information through our partners and third parties who supply services to us, including partner agencies, training providers, and referees.",
        "§7.3 Please note that we use our own and third party computer servers including our Website hosts and data backups, which may be located Overseas, and your Personal Information may be stored and transmitted Overseas as part of the normal operation of our business.",
        "§7.4 We also collect information from your computer or mobile device automatically when you browse our Website. This information may include: (a) the date and time of your visit; (b) your domain; (c) locality; (d) operating system; (e) the server your computer or mobile is using to access our Website; (f) your browser and version number; (g) search terms you have entered to find our Website or access our Website; (h) pages and links you have accessed both on our Website and on other websites; (i) the last website you visited; (j) the pages of our Website that you access; (k) the device you use to access our Website; and (l) your IP Address.",
        "§7.5 While we do not use some of this information to identify you personally, we may record certain information about your use of our Website such as which pages you visit and the time and date of your visit and that information could potentially be used to identify you.",
        "§7.6 It may be possible for us to identify you from information collected automatically from your visit(s) to our Website. If you have registered an account with us, we will be able to identify you through your user name and password when you log into our Website. Further, if you access our Website via links in an email or messaging application we have sent you, we will be able to identify you.",
        "§7.7 The device you use to access our Website may collect information about you including your location using longitude and latitude coordinates obtained through GPS, Wi-Fi or cell site triangulation. For information about your ability to restrict the collection and use of such information, please use the settings available on your device.",
        "§7.8 We may use statistical analytics software tools and tracking technologies such as cookies which transmit data to third party servers located Overseas. To our knowledge, our analytics providers do not identify individual users or associate your IP Address with any other data held by them.",
        "§7.9 We will retain your Personal Information for any time period we consider necessary to provide our Services to you and to comply with our legal obligations. The period may vary depending on the type of Personal Information we hold. If we no longer need your personal information for these purposes, we will take steps to destroy the information or ensure it is de-identified.",
      ],
    },
    {
      heading: "SECTION 8 – How we protect your Personal Information",
      clauses: [
        "§8.1 We will endeavor to take all reasonable steps to keep secure and protect any Personal Information which we hold about you, including: (a) securing our physical premises and digital storage media; (b) using computer safeguards such as Transport Layer Security (TLS) technology to ensure that your information is encrypted and sent across the Internet securely; (c) placing password protection and access control over our information technology systems and databases to limit access and protect electronic information from unauthorized interference, access, modification and disclosure; and (d) taking regular back-ups of our electronic systems.",
        "§8.2 Notwithstanding that we will take all reasonable steps to keep your Personal Information secure, data transmission over the internet is never guaranteed to be completely secure. We do not and cannot warrant the security of any information you transmit to us or from any online services.",
      ],
    },
    {
      heading: "SECTION 9 – Use of Cookies",
      clauses: [
        "§9.1 When you visit our Website or the website of any of our partners, we and our partners may use cookies and other tracking technology (\"Cookies\") to recognize you and customize your online experience. Cookies are small files that store information on your computer, mobile phone or other device. They enable us to recognize you across different websites, services, devices and/or browsing sessions. Cookies also assist us to customize online content and advertising, save your preferences for future visits to the Website, measure the effectiveness of our promotions, prevent potential fraud and analyze your and other users' interactions with the Website.",
        "§9.2 If you do not wish to grant us the right to use cookies to gather information about you while you are using our Website, then you may set your browser settings to delete, disable or block certain Cookies. The following browsers have publicly available information about how to adjust cookie preferences: Microsoft Edge, Mozilla Firefox, Google Chrome and Apple Safari.",
        "§9.3 You may be requested to consent to use of Cookies when you access certain parts of our Website, for example, when you are asked if you want the Website to \"remember\" certain things about you.",
        "§9.4 Certain aspects and features of the Website are only available through use of Cookies. If you disable Cookies, your use of the Website may be limited or not possible or parts of our Website may not function properly when you use them.",
        "§9.5 Upon your first visit to our Website (or the first visit after you delete your Cookies), you may be prompted by a banner to accept our use of Cookies and other tracking technology (\"Cookies policy\"). Unless you have adjusted your browser setting so that it will refuse cookies or declined to accept our Cookies policy, our system will issue Cookies when you access our Website.",
        "§9.6 Our Website may contain web beacons (also called single-pixel gifs) or similar technologies (\"Web Beacons\") which are electronic images that we use: (a) to help deliver Cookies; (b) to count users who have visited our Website; and (c) in our promotional materials, to determine whether and when you open and act on them.",
        "§9.7 We may also work with third-parties: (a) to place Web Beacons on their websites or in their promotional materials as part of our business development and data analysis; and (b) to allow Web Beacons to be placed on our Website from Analytics Services to help us compile aggregated statistics about the effectiveness of our promotional campaigns or other operations.",
        "§9.8 The Web Beacons of Analytics Services may enable such providers to place Cookies or other identifiers on your device, through which they may collect information about your online activities across applications, websites or other products.",
      ],
    },
    {
      heading: "SECTION 10 – Not identifying yourself",
      clauses: [
        "§10.1 It may be impracticable to deal with you on an anonymous basis or using a pseudonym, particularly where you are applying for placement, attending training, or engaging our Services as an employer.",
        "§10.2 We may be able to provide you with limited information in the absence of your identifying yourself but generally we will be unable to provide you with our Services unless you have identified yourself.",
      ],
    },
    {
      heading: "SECTION 11 – Queries and Complaints",
      clauses: [
        "§11.1 We have appointed a data protection contact point (\"DPCP\") who is responsible for overseeing questions in relation to this policy and our processing activities in general. If you have any questions or requests, including any requests to exercise your legal rights as a data subject, please contact the DPCP using the details set out below: Full name of legal entity: Find Care Helper Pte Ltd. Email address: contact@findcarehelper.com. You may also reach us via the WhatsApp link available on our Website.",
        "§11.2 In order to disclose information to you in response to a request for access we may require you to provide us with certain information to verify your identity. There are exceptions under Privacy Laws which may affect your right to access your Personal Information – these exceptions include where (amongst other things): (a) access would pose a serious threat to the life, health or safety of any individual; (b) access would have an unreasonable impact on the privacy of others; (c) the request for access is frivolous or vexatious; (d) the information relates to existing or anticipated legal proceedings between you and us and the information would not otherwise be accessible by the process of discovery; (e) giving access would reveal our intentions in relation to negotiations with you; (f) giving access would be unlawful; (g) denying access is required or authorized by or under a Singapore law or a court/tribunal; (h) the information relates to a commercially sensitive decision making process; or (i) giving access would prejudice enforcement related action.",
        "§11.3 If you wish to have your Personal Information deleted, please contact us using the details above and we will take reasonable steps to delete the information (unless we are obliged to keep it for legal, regulatory, or auditing purposes, including obligations under Singapore employment and immigration law).",
      ],
    },
    {
      heading: "SECTION 12 – Retention of Personal Data",
      clauses: [
        "§12.1 To determine the appropriate retention period for personal data, we consider the amount, nature, and sensitivity of the personal data, the potential risk of harm from unauthorized use or disclosure of your personal data, the purposes for which we process your personal data and whether we can achieve those purposes through other means, and the applicable legal requirements.",
        "§12.2 We will only retain your personal data for as long as necessary in order to fulfil the purposes for which we collected it, including the performance of our candidate–employer relationship with you (whilst ongoing), and thereafter: for the purpose of satisfying any legal, accounting, tax or reporting obligations to which we may be subject; and/or to the extent that we may also need to retain your personal data to be able to assert, exercise or defend possible future legal claims against or involving you.",
        "§12.3 We will maintain and retain your personal data throughout the period of your relationship with us and for a further period of five (5) years from the date of its termination. This retention period enables us to make use of your personal data in order to satisfy any applicable reporting obligations to public authorities and/or for the assertion, filing or defense of possible legal claims by or against you. In certain cases, we may need to retain personal data for a longer period of up to seven (7) years to comply with applicable accounting, tax, and employment-records laws.",
        "§12.4 There may also be other instances where the need to retain certain items of personal data about you for longer periods, as dictated by the nature of the relationship and/or Services provided.",
      ],
    },
    {
      heading: "SECTION 13 – Changes to this Privacy Policy",
      clauses: [
        "§13.1 We may amend this privacy policy from time to time at our sole discretion, particularly where we need to take into account and cater for any: (a) business developments; or (b) legal or regulatory developments.",
        "§13.2 If we make changes, we will notify you by revising the date at the top of the Privacy Policy and, in some cases, may provide you with additional notice (such as adding a statement to the Website homepage or sending you a notification). We recommend you review the Privacy Policy whenever you access the Services or otherwise interact with us to stay informed about our information practices and the ways you can help us to protect your privacy.",
      ],
    },
    {
      heading: "SECTION 14 – Definitions used in this policy",
      clauses: [
        "(a) Analytics Services means any third party website analytics provider and includes third party website analytics companies such as Google Analytics.",
        "(b) IP Address means a number automatically assigned to your computer which is required when you are using the internet, and which may be able to be used to identify you.",
        "(c) Overseas means any place or country other than Singapore.",
        "(d) Personal Information has the meaning set out in the PDPA.",
        "(e) PDPA means the Personal Data Protection Act 2012 (Singapore) and any subsidiary legislation, codes of practice, or guidelines issued under it.",
        "(f) Privacy Laws means such laws as may place requirements on the handling of Personal Information including the PDPA.",
        "(g) Services means the recruitment, training, and placement services that we provide to candidates, employers and partner agencies.",
        "(h) Third Party Sites means online websites or services that we do not own or control, including websites of our partners.",
        "(i) Website means the website operated by us and any other website we may operate from time to time.",
        "(j) you, your and similar terms means, as the context requires: (1) you, when you use our Website; (2) you, during your dealings with us as a candidate, employer or partner; (3) any agent providing your Personal Information to us; or (4) any agent dealing with us on your behalf.",
      ],
    },
  ],
};

const terms: LegalDoc = {
  title: "Terms of Service",
  lastModified: "These terms of service were last revised on 19 May 2026.",
  intro:
    "These Terms of Service govern your use of the Find Care Helper website and our recruitment, training, and placement services. Please read them carefully — by using the Services you agree to be bound by them.",
  sections: [
    {
      heading: "SECTION 1 – Terms of Service Overview",
      clauses: [
        "§1.1 This agreement (the \"Agreement\") constitutes a legal agreement between the user (\"User\", \"you\", and \"your\") and Find Care Helper Pte Ltd, a private limited company registered in Singapore with its registered office address available upon request (\"FCH\", \"we\", and \"us\").",
        "§1.2 This Agreement specifies the terms under which you use our website (the \"Website\") and any Services (defined below). Please read this Agreement carefully before agreeing to use our Services because they govern your use of the Services. By using the Services, you agree to be bound by the terms of this Agreement (the \"Terms of Service\") and any other policies or terms communicated to Users by FCH through the Services. If you do not agree to be bound by these Terms of Service, do not use the Services.",
        "§1.3 Please read the following Terms of Service carefully, together with our Privacy Policy (the \"Privacy Policy\"), which is incorporated by reference into these Terms of Service. If you do not agree to all of these Terms of Service, you may not access or use the Services. Failure to abide by these Terms of Service may result in your immediate suspension of rights and access to the Services.",
        "§1.4 Notice on Eligibility: The Services are intended for: (i) prospective candidates aged 18 or over who are legally eligible to work or to be considered for work in Singapore or other lawful jurisdictions; (ii) prospective employers in Singapore (households, businesses, and institutions) seeking to engage staff in compliance with the Singapore Employment Agencies Act, the Employment of Foreign Manpower Act, and other applicable law; and (iii) partner agencies that source, train, or place workers in accordance with applicable law. You may not use the Services for any purpose that violates applicable law, including for human trafficking, forced labour, illegal recruitment, or any form of exploitative employment. We do not make exceptions.",
        "§1.5 Notice: You agree that disputes regarding the Services will be resolved by binding, individual arbitration, and you waive your right to participate in a class-action lawsuit or class-wide arbitration.",
        "§1.6 The Website is informational. We do not guarantee any specific employment outcome, placement, salary, working conditions, retention period, or candidate availability. The Services are provided \"as is\" without any condition or warranty whatsoever. Your use of the Services is entirely at your own risk. Accordingly, it is important that you read this entire Agreement carefully to ensure that you fully understand your rights and obligations, and the potential repercussions and liability for you should you fail to adhere to your obligations or in any other way be in breach of this Agreement.",
      ],
    },
    {
      heading: "SECTION 2 – Definitions",
      clauses: [
        "§2.1 Applicable Law: any applicable national, provincial, international, federal, state, county, and local statute, law, ordinance, regulation, rule, code, and order, including (without limitation) the Singapore Employment Agencies Act, the Employment of Foreign Manpower Act, the Personal Data Protection Act 2012, and equivalent laws in the countries our candidates originate from or travel through.",
        "§2.2 Candidate: an individual considered by us, presented by us, or placed by us for employment with an Employer, whether or not such individual is ultimately engaged.",
        "§2.3 Employer: any household, company, agency, or other person engaging or considering engaging a Candidate through the Services.",
        "§2.4 Party: you or us, as applicable, and \"Parties\": you and us collectively.",
        "§2.5 Partner Agency: a third-party recruitment agency, training provider, or other intermediary with whom we collaborate to source, prepare, or place Candidates.",
        "§2.6 Placement: the introduction of a Candidate to an Employer, and any subsequent engagement, employment contract, or working arrangement that results from that introduction.",
        "§2.7 Prohibited Content: content that: (i) is illegal under Applicable Law; (ii) violates any third party's intellectual property rights, including, without limitation, copyrights, trademarks, patents, and trade secrets; (iii) contains indecent or obscene material; (iv) contains libelous, slanderous, or defamatory material, or material constituting an invasion of privacy or misappropriation of publicity rights; (v) promotes unlawful or illegal goods, services, or activities; (vi) contains false, misleading, or deceptive statements, depictions, or sales practices; or (vii) contains viruses, Trojan horses, worms, or any other harmful, malicious, or hidden procedures, routines, mechanisms, or code.",
        "§2.8 Services: the recruitment, training, placement, and related services that we provide to Candidates, Employers, and Partner Agencies, including the operation of the Website and any related communications channels we make available (such as WhatsApp, messaging applications, telephone, and email).",
        "§2.9 Service Fees: any fees FCH may charge to provide the Services to you, including (without limitation) placement fees, administrative fees, training fees, and processing fees.",
        "§2.10 Training: the pre-departure, pre-placement, or supplementary training programmes we offer to Candidates, including modules covering English communication, manners and etiquette, household cleaning, cooking, and caregiving.",
        "§2.11 Website: the website operated by us at the domain we maintain from time to time, and any successor or related properties.",
      ],
    },
    {
      heading: "SECTION 3 – Access and Use of the Services",
      clauses: [
        "§3.1 You may use the Services only if you are 18 years or older and capable of forming a binding contract with FCH, and not otherwise barred from using the Services under these Terms of Service or applicable law.",
        "§3.2 During the term of this Agreement, we will provide you access to and use of the Services, which shall be accessible through the internet and through such offline channels as we may operate from time to time. Your right to access and use the Services hereunder is limited, non-transferable, non-sublicensable, and subject to your full compliance with the Terms of Service.",
        "§3.3 You agree that you will not (and will not authorize, permit, or encourage any third party to): (i) attempt to gain unauthorized access to the accounts, communications, or information of other Users of the Services; (ii) use the Services in violation of any Applicable Law; (iii) use the Services to harass, harm, exploit, or endanger any Candidate, Employer, Partner Agency, or other person; (iv) use the Services to recruit for forced labour, debt bondage, illegal employment, or any form of human trafficking; (v) use the Services to build a competitive product or service, or for any purpose not specifically permitted in this Agreement; (vi) interfere with or disrupt the Services; (vii) attempt to circumvent any security measure associated with the Services, access the Services from any location in which they are not offered, or attempt to circumvent any access restrictions; (viii) reverse engineer, decompile, disassemble, or otherwise attempt to discern the source code or any other aspect of the Services; (ix) modify, adapt, or create (or attempt to create) derivative works from the Services or any Candidate profile, photograph, or training material made available through the Services; (x) make any copies of the Services or any Candidate profile, photograph, or training material made available through the Services (or any portion thereof); (xi) resell, distribute, or sublicense the Services or any Candidate profile, photograph, or training material made available through the Services; (xii) remove or modify any proprietary marking or restrictive legends placed on the Services; or (xiii) introduce, post, upload, transmit, or otherwise make available to or from the Services any Prohibited Content.",
        "§3.4 By using the Services, you represent and warrant that you are eligible to engage with the Services in your jurisdiction and that your engagement does not violate any law applicable to you, including any law relating to employment, immigration, or recruitment in your country of residence or in the country in which you intend to live or work.",
        "§3.5 The Services may allow you to access third-party websites or other resources, including those operated by Partner Agencies, training providers, government authorities, and messaging applications. We provide access only as a convenience and are not responsible for the content, products, or services on or available from those resources or links displayed on such websites. You acknowledge sole responsibility for and assume all risk arising from your use of any third-party resources.",
        "§3.6 Candidate profiles, photographs, videos, biographical details, training records, and assessments displayed on or transmitted through the Services are provided for informational and matching purposes. They do not constitute an offer of employment, a guarantee of suitability, or a representation of present or future availability. Engagement of any Candidate by any Employer is the subject of a separate agreement between those parties and is not warranted by FCH except as expressly set forth in a written placement agreement signed by FCH.",
      ],
    },
    {
      heading: "SECTION 4 – Changes to these Terms or the Services",
      clauses: [
        "§4.1 We may update the Terms of Service from time to time in our sole discretion. If we do, we will let you know by posting the updated Terms of Service to the Website and/or may send other communications. It is important that you review the Terms of Service whenever we update them, or you use the Services. If you continue to use the Services after we have posted updated Terms of Service, this means that you accept and agree to the changes. If you do not agree to be bound by the changes, you may not use the Services anymore. Because our Services are evolving over time we may change or discontinue all or any part of the Services, at any time and without notice, at our sole discretion.",
        "§4.2 We reserve the right to change the list of training programmes, candidate categories, supported countries of origin or placement, fee schedules, and other Service offerings in our sole discretion, for any reason or no reason at all.",
      ],
    },
    {
      heading: "SECTION 5 – Termination and Suspension",
      clauses: [
        "§5.1 We may suspend or terminate your access to and use of the Services, at our sole discretion, at any time and without notice to you, including as required by applicable law or any governmental authority, or if we determine that you are violating these Terms of Service. Such suspension or termination shall not constitute a breach of these Terms of Service by FCH. In accordance with any applicable anti-money-laundering, anti-trafficking, anti-fraud, or other compliance policies and practices, we may impose reasonable limitations and controls on your ability to use the Services. Such limitations may include, where good cause exists, rejecting placement or training requests or otherwise restricting you from using the Services. Upon any termination, discontinuation, or cancellation of the Services, the following Sections will survive: §8, §9, §11, and §12.",
        "§5.2 If you choose to terminate this Agreement and cease using the Services, you remain bound by any separate placement, training, or partner agreement you have entered into with us until such agreement is terminated according to its own terms.",
      ],
    },
    {
      heading: "SECTION 6 – Fees",
      clauses: [
        "§6.1 We may charge fees for Services we make available to you (\"Service Fees\"), and we reserve the right to change those fees at our discretion upon notice to you. We will disclose the amount of fees we will charge you for the applicable Services at or before the time that you engage those Services.",
        "§6.2 All Service Fees are non-refundable, including if you choose to terminate this Agreement or if we terminate your access to and use of the Services as provided for hereunder, except to the extent expressly required under Applicable Law or under a separate written agreement signed by FCH.",
        "§6.3 You are solely responsible for the payment of any applicable taxes, levies, or duties due with respect to fees you pay to us, salaries you pay to or receive from a Candidate or Employer, or any other amounts paid in connection with the Services. Neither FCH nor any of its agents shall provide any tax, legal, or financial advice. You are strongly encouraged to seek advice from your own qualified advisers regarding the tax and legal consequences of engaging the Services.",
      ],
    },
    {
      heading: "SECTION 7 – Placement Outcomes and Risk",
      clauses: [
        "§7.1 Recruitment, training, and placement are inherently uncertain. We do not guarantee that any Candidate will be placed, that any Employer will find a suitable Candidate, that any working arrangement will continue for any specified period, or that any Candidate or Employer will perform as represented. We will use commercially reasonable efforts to vet Candidates, deliver Training, and match parties appropriately, but we do not guarantee any specific outcome.",
        "§7.2 You acknowledge that the Services involve the participation of third parties, including Candidates, Employers, Partner Agencies, government authorities, training providers, and immigration consultants, none of whom are controlled by FCH. We are not responsible for, and disclaim all liability for, the actions, omissions, performance, or conduct of any such third party.",
      ],
    },
    {
      heading: "SECTION 8 – Intellectual Property Rights",
      clauses: [
        "§8.1 All right, title, and interest in and to the Services (and all content made available through the Services) is the sole and exclusive property of FCH or its licensors, including all modifications, improvements, adaptations, and enhancements thereto. You acknowledge that the Services are protected by copyright, trademark, and other laws of Singapore and other jurisdictions. You agree not to remove, alter, or obscure any copyright, trademark, service mark, or other proprietary rights notices incorporated in or accompanying the Services.",
        "§8.2 The limited right to access and use the Services is not a sale of the software, training materials, candidate profiles, or other content underlying the Services. This Agreement does not provide the User with any right to receive any software code, training curriculum, candidate database, or other proprietary asset of FCH.",
      ],
    },
    {
      heading: "SECTION 9 – Representations and Warranties; Disclaimers",
      clauses: [
        "§9.1 You represent and warrant that: (i) you are of legal age to enter into this Agreement; (ii) you have the authority to enter into this Agreement, and where you are entering into this Agreement on behalf of a household, company, or other entity, that you are duly authorized to bind that entity; (iii) you do not intend to use the Services for any purpose that would be in violation of Applicable Law, including any law against human trafficking, forced labour, illegal recruitment, or exploitative employment; (iv) your use of the Services does not violate any Applicable Law; (v) you are in compliance with any anti-money-laundering, anti-trafficking, employment, and immigration obligations applicable to you under the law of your jurisdiction; and (vi) any information you provide to us regarding yourself, a Candidate, an Employer, or any other matter is true, accurate, and not misleading at the time it is provided.",
        "§9.2 To the maximum extent permitted by applicable law, the Services are provided \"as is\" without any condition or warranty whatsoever, and the entire risk as to satisfactory quality, performance, accuracy, reliability, and completeness is with you. To the maximum extent permitted by applicable law, FCH makes no warranty that access to the Services will meet your requirements or be available on an uninterrupted, secure, or error-free basis. Your use of the Services is at your own risk, and your reliance on any information or data contained in the Services is at your own risk. FCH expressly disclaims all implied and statutory warranties, including without limitation, the implied warranties of merchantability, fitness for a particular purpose, and non-infringement. FCH further expressly disclaims all warranties arising from the usage of trade and course of dealing. To the maximum extent permitted by applicable law, FCH (i) does not warrant that the Services will meet your requirements or that the Services will operate in combination with other software and (ii) specifically disclaims with respect to the Services any conditions of quality, availability, reliability, security, lack of viruses, bugs, or errors.",
        "§9.3 To the extent that FCH may not, as a matter of applicable law, disclaim any implied warranty, the scope and duration of such warranty will be the minimum permitted under such law. Without limiting the foregoing, FCH makes no representations or warranties with regard to the suitability of any Candidate for any Employer, the suitability of any Employer for any Candidate, the duration of any Placement, or the satisfaction of any party to a Placement.",
        "§9.4 FCH takes no responsibility for, and will not be responsible or liable to you for any losses, damages, or claims arising from: (i) user error such as mistyped contact details, miscommunicated requirements, or misunderstood instructions; (ii) server failure or data loss; (iii) third-party messaging applications, telecommunications networks, or postal services; (iv) unauthorized access to the Services; or (v) any third-party activities, including without limitation phishing, impersonation, brute-force attempts, or other means of attack. FCH is not responsible for any actions or omissions of any Candidate, Employer, Partner Agency, training provider, government authority, or other third party.",
        "§9.5 Some jurisdictions do not allow the exclusion of certain warranties. Accordingly, some of the above disclaimers of warranties may not apply to you.",
        "§9.6 By using the Services, you represent that you are knowledgeable, experienced, and sophisticated in evaluating recruitment, training, and placement arrangements, including in evaluating the suitability of any Candidate, Employer, or Partner Agency. You represent that you have not relied upon any information, statement, omission, representation, or warranty, express or implied, written, or oral, made by or on behalf of FCH in connection therewith, except as expressly set forth in these Terms of Service or in a separate written agreement signed by FCH.",
      ],
    },
    {
      heading: "SECTION 10 – General Prohibitions and FCH's Enforcement Rights",
      clauses: [
        "§10.1 You agree not to do any of the following: (a) Use, display, mirror or frame the Services or any individual element within the Services, FCH's name, any FCH trademark, logo or other proprietary information, or the layout and design of any page or form contained on a page, without FCH's express written consent; (b) Access, tamper with, or use non-public areas of the Services, FCH's computer systems, or the technical delivery systems of FCH's providers; (c) Attempt to probe, scan or test the vulnerability of any FCH system or network or breach any security or authentication measures; (d) Avoid, bypass, remove, deactivate, impair, descramble or otherwise circumvent any technological measure implemented by FCH or any of FCH's providers or any other third party (including another User) to protect the Services; (e) Attempt to access or search the Services or download content from the Services using any engine, software, tool, agent, device or mechanism (including spiders, robots, crawlers, data mining tools or the like) other than the software and/or search agents provided by FCH or other generally available third-party web browsers; (f) Use the Services, or any portion thereof, for the benefit of any third party or in any manner not permitted by these Terms; (g) Attempt to decipher, decompile, disassemble or reverse engineer any of the software used to provide the Services; (h) Interfere with, or attempt to interfere with, the access of any User, host or network, including, without limitation, sending a virus, overloading, flooding, spamming, or mail-bombing the Services; (i) Collect or store any personally identifiable information from the Services from other Users of the Services without their express permission, including any Candidate profile or photograph for any purpose other than evaluating that Candidate for a bona fide Placement; (j) Impersonate or misrepresent your affiliation with any person or entity; (k) Violate any applicable law or regulation, including any law against human trafficking, forced labour, or exploitative recruitment; or (l) Encourage or enable any other individual to do any of the foregoing.",
        "§10.2 FCH is not obligated to monitor access to or use of the Services. However, we have the right to do so for the purpose of operating the Services, to ensure compliance with these Terms and to comply with applicable law or other legal requirements. We reserve the right, but are not obligated, to remove or disable access to any Services or content, at any time and without notice, including, but not limited to, if we, at our sole discretion, consider it objectionable or in violation of these Terms. We have the right to investigate violations of these Terms or conduct that affects the Services. We may also consult and cooperate with law enforcement authorities, including the Singapore Ministry of Manpower and the Immigration and Checkpoints Authority, to prosecute Users who violate the law.",
      ],
    },
    {
      heading: "SECTION 11 – Limitation of Liability; Indemnity",
      clauses: [
        "§11.1 To the maximum extent permitted by applicable law, you agree that FCH shall not be liable for any loss of information, data, loss of income, loss of opportunity or profits, cost of recovery, personal injury, or other loss, however caused and under any theory of liability, arising from the use of the Services, or any special, incidental, consequential, or indirect damages arising out of or in connection with the use of the Services. This limitation will apply even if FCH has been advised of the possibility of such damages, and these limitations will apply notwithstanding any failure of essential purpose of any limited remedy provided herein. To the maximum extent permitted by applicable law, in no event shall FCH's total liability to any User arising out of or related to this Agreement or your use of the Services exceed the Service Fees paid by you to FCH in the twelve (12) months preceding the event giving rise to the claim.",
        "§11.2 To the maximum extent permitted by law, in no event will FCH's total liability arising out of or in connection with these Terms of Service or from the use of or inability to use the Services exceed the amounts you have paid or are payable by you to FCH for use of the Services or one hundred Singapore dollars (S$100), if you have not had any payment obligations to FCH, as applicable.",
        "§11.3 The exclusions and limitations of damages set forth above are fundamental elements of the basis of the bargain between FCH and you.",
        "§11.4 You agree to defend, indemnify, and hold harmless FCH, and its officers, directors, managers, and employees (\"Indemnified Parties\") from any and all liabilities, damages, costs, and expenses (including reasonable attorneys' fees) incurred by such Indemnified Parties in connection with any third-party action, claim, or proceeding arising from or related to: (i) your access to or use of the Services; (ii) your violation of these Terms of Service; or (iii) any taxes, levies, duties, or related costs, interest, and penalties, applicable to any fees you pay to or receive from FCH, a Candidate, an Employer, or a Partner Agency. You may not settle or otherwise compromise any claim subject to this Section without FCH's prior written approval.",
      ],
    },
    {
      heading: "SECTION 12 – General Provisions",
      clauses: [
        "§12.1 Reservation of Rights. FCH and its licensors exclusively own all rights, title and interest in and to the Services, including all associated intellectual property rights. You acknowledge that the Services are protected by copyright, trademark, and other laws protecting intellectual property. You agree not to remove, alter or obscure any copyright, trademark, service mark or other proprietary rights notices incorporated in or accompanying the Services.",
        "§12.2 Notices. Any notices or other communications provided by FCH under these Terms of Service will be given by posting to the Website, by sending a message to the WhatsApp or email contact you have provided, or by other reasonable means. All notices and other communications you provide under these Terms of Service shall be in writing (including electronic mail and messaging applications) and shall be delivered by hand or courier service, mailed by certified or registered mail, or sent by electronic mail or messaging application. For the purposes of these Terms of Service, the contact details of FCH are: Address: available upon request. Email: contact@findcarehelper.com. You may also reach us via the WhatsApp link available on our Website.",
        "§12.3 Assignment. The User may not assign or otherwise transfer any of its rights or obligations under this Agreement without the prior, written consent of FCH. FCH may assign or otherwise transfer this Agreement in conjunction with a transfer of the Services. In all cases of assignment, the assignee agrees in writing to be bound by the terms and conditions of this Agreement. Any assignment or other transfer in violation of this Section will be null and void. Subject to the foregoing, this Agreement will be binding upon and inure to the benefit of the Parties hereto and their permitted successors and assigns.",
        "§12.4 This Agreement shall be governed by and construed in accordance with the laws of the Republic of Singapore, without regard for choice of law provisions thereof.",
        "§12.5 Arbitration. Any dispute, controversy, difference or claim arising out of or relating to this Agreement, including the existence, validity, interpretation, performance, breach or termination thereof or any dispute regarding non-contractual obligations arising out of or relating to it shall be referred to and finally resolved by arbitration administered by the Singapore International Arbitration Centre (SIAC) in accordance with the SIAC Arbitration Rules in force at the time of commencement of the arbitration. The seat of the arbitration shall be Singapore, unless agreed to otherwise by the Parties. The arbitration shall be conducted in the English language. The number of arbitrators shall be one.",
        "§12.6 All disputes and arbitrations must be resolved on an individual basis. Class actions and class arbitrations are not permitted; you may bring a claim only on your own behalf and cannot seek relief that would affect other Users. If there is a final judicial determination that any particular claim (or a request for particular relief) cannot be arbitrated in accordance with this provision's limitations, then only that claim (or only that request for relief) may be brought in court. All other claims (or requests for relief) remain subject to this provision.",
        "§12.7 Severability. If any provision of this Agreement is found invalid or unenforceable by a court of competent jurisdiction, that provision shall be amended to achieve as nearly as possible the same economic effect as the original provision, and the remainder of this Agreement shall remain in full force and effect. Any provision of this Agreement, which is unenforceable in any jurisdiction, shall be ineffective only as to that jurisdiction, and only to the extent of such unenforceability, without invalidating the remaining provisions hereof.",
        "§12.8 Force Majeure. Neither Party shall be deemed to be in breach of this Agreement for any failure or delay in performance to the extent caused by reasons beyond its reasonable control, including, but not limited to, acts of God, earthquakes, strikes, work stoppages, shortages of materials or resources, civil or military disturbances, pandemics, border closures, immigration restrictions, and interruptions, loss or malfunctions of utilities, communications or computer (software and hardware) services (including cloud service providers and messaging applications).",
        "§12.9 Third-Party Beneficiaries. Except for the Indemnified Parties that are third parties, there are no third-party beneficiaries under this Agreement.",
        "§12.10 Complete Understanding. This Agreement constitutes the final and complete agreement between the Parties regarding the subject matter hereof, and supersedes any prior or contemporaneous communications, representations, or agreements between the Parties, whether oral or written, including, without limitation, any confidentiality or non-disclosure agreements. No term included in any confirmation, acceptance, or any other similar document from you in connection with this Agreement will apply to this Agreement or have any force or effect.",
        "§12.11 Waiver. No failure or delay by either Party in exercising any right or remedy under this Agreement shall operate or be deemed as a waiver of any such right or remedy. Except as expressly set forth in these Terms of Service, the exercise by either party of any of its remedies under these Terms of Service will be without prejudice to its other remedies under these Terms of Service or otherwise.",
      ],
    },
  ],
};

const base: Messages = {
  nav: { brandFull: "Your Site", brandTagline: "" },
  privacy,
  terms,
};

export const messages: Record<Locale, Messages> = {
  en: base,
  my: base,
  zh: base,
};

export function useTranslation(): {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Messages;
} {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useTranslation must be used inside <LanguageProvider>");
  }
  return { locale: ctx.locale, setLocale: ctx.setLocale, t: messages[ctx.locale] };
}
