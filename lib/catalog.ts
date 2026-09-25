import type { PayerType } from "./types";

// Payers and policy pages for a rural Missouri hospital. Every URL here was
// checked from GitHub's network (scripts/check-links.ts, run by the
// "Verify payer links" workflow) and serves its list in the page HTML, so the
// watcher can see changes. Used for the sample data and "Add from catalog".

export interface CatalogPage {
  label: string;
  url: string;
}

export interface CatalogPayer {
  key: string;
  name: string;
  type: PayerType;
  region: "Missouri" | "National";
  website: string;
  pages: CatalogPage[];
  note?: string;
}

const UHC = "https://www.uhcprovider.com/en";

export const CATALOG: CatalogPayer[] = [
  // --- Traditional Medicare -------------------------------------------------
  {
    key: "cms-medicare",
    name: "Medicare (CMS)",
    type: "Medicare (Traditional)",
    region: "National",
    website: "https://www.cms.gov/medicare-coverage-database/search.aspx",
    pages: [
      { label: "MLN Connects newsletter (weekly)", url: "https://www.cms.gov/training-education/medicare-learning-network/newsletter" },
      { label: "Transmittals — 2026", url: "https://www.cms.gov/medicare/regulations-guidance/transmittals/2026-transmittals" },
    ],
    note:
      "Missouri's Part A/B contractor is WPS (J5). WPS's site and the Medicare Coverage Database " +
      "reports load with JavaScript, so watch individual LCD/NCD documents on each policy instead.",
  },

  // --- Missouri Medicaid ------------------------------------------------------
  {
    key: "mo-healthnet",
    name: "MO HealthNet (Missouri Medicaid)",
    type: "Medicaid (State)",
    region: "Missouri",
    website: "https://dss.mo.gov/mhd/providers",
    pages: [
      { label: "MO HealthNet News (bulletins & hot tips)", url: "https://dss.mo.gov/mhd/news" },
      { label: "Provider manuals", url: "https://dss.mo.gov/mhd/provider-manuals" },
    ],
  },
  {
    key: "healthy-blue-mo",
    name: "Healthy Blue (MO HealthNet Managed Care)",
    type: "Managed Medicaid",
    region: "Missouri",
    website: "https://provider.healthybluemo.com/missouri-provider/resources",
    pages: [
      { label: "Provider manuals & guides", url: "https://provider.healthybluemo.com/missouri-provider/resources/manuals-and-guides" },
    ],
    note: "Healthy Blue's medical policy search and provider news load with JavaScript and can't be watched directly.",
  },
  {
    key: "home-state-health",
    name: "Home State Health (MO HealthNet Managed Care)",
    type: "Managed Medicaid",
    region: "Missouri",
    website: "https://www.homestatehealth.com/providers/tools-resources.html",
    pages: [
      { label: "Clinical & payment policies", url: "https://www.homestatehealth.com/providers/tools-resources/clinical-payment-policies.html" },
      { label: "Provider news (policy update notices)", url: "https://www.homestatehealth.com/providers/provider-news.html" },
    ],
  },
  {
    key: "uhc-community-plan-mo",
    name: "UnitedHealthcare Community Plan of Missouri",
    type: "Managed Medicaid",
    region: "Missouri",
    website: `${UHC}/health-plans-by-state/missouri-health-plans/mo-comm-plan-home.html`,
    pages: [
      {
        label: "Community Plan medical policies & monthly update bulletins",
        url: `${UHC}/policies-protocols/comm-plan-medicaid-policies/medicaid-community-state-policies.html`,
      },
      {
        label: "Missouri reimbursement policies",
        url: `${UHC}/health-plans-by-state/missouri-health-plans/mo-comm-plan-home/mo-cp-policies/reimbursement-community-state-policies-missouri.html`,
      },
    ],
  },

  // --- Medicare Advantage -----------------------------------------------------
  {
    key: "uhc-medicare-advantage",
    name: "UnitedHealthcare Medicare Advantage",
    type: "Medicare Advantage",
    region: "National",
    website: `${UHC}/policies-protocols/medicare-advantage-policies.html`,
    pages: [
      {
        label: "MA medical policies & monthly update bulletins",
        url: `${UHC}/policies-protocols/medicare-advantage-policies/medicare-advantage-medical-policies.html`,
      },
      {
        label: "MA reimbursement policies & monthly update bulletins",
        url: `${UHC}/policies-protocols/medicare-advantage-policies/medicare-advantage-reimbursement-policies.html`,
      },
    ],
  },
  {
    key: "humana-ma",
    name: "Humana Medicare Advantage",
    type: "Medicare Advantage",
    region: "National",
    website: "https://mcp.humana.com/tad/tad_new/home.aspx?type=provider",
    pages: [
      {
        label: "Medical coverage policies (newest first)",
        url: "https://mcp.humana.com/tad/tad_new/Search.aspx?sortfield=effectivedate&policyType=medical",
      },
    ],
    note: "Humana's claims payment policy pages load with JavaScript and can't be watched directly.",
  },
  {
    key: "wellcare-mo",
    name: "Wellcare (Medicare Advantage, Missouri)",
    type: "Medicare Advantage",
    region: "Missouri",
    website: "https://www.wellcare.com/en/missouri/providers/medicare",
    pages: [
      { label: "Missouri Medicare payment policies", url: "https://www.wellcare.com/en/missouri/providers/medicare/claims/payment-policy" },
    ],
  },
  {
    key: "aetna",
    name: "Aetna (commercial & Medicare Advantage)",
    type: "Commercial",
    region: "National",
    website: "https://www.aetna.com/health-care-professionals/clinical-policy-bulletins/medical-clinical-policy-bulletins.html",
    pages: [
      {
        label: "OfficeLink Updates (monthly policy notices)",
        url: "https://www.aetna.com/health-care-professionals/newsletters-news/provider-newsletters-archive.html",
      },
      {
        label: "Medical Clinical Policy Bulletins",
        url: "https://www.aetna.com/health-care-professionals/clinical-policy-bulletins/medical-clinical-policy-bulletins.html",
      },
    ],
  },

  // --- Commercial -------------------------------------------------------------
  {
    key: "anthem-mo",
    name: "Anthem Blue Cross and Blue Shield (Missouri)",
    type: "Commercial",
    region: "Missouri",
    website: "https://www.anthem.com/provider/policies/clinical-guidelines/?cnslocale=en_US_mo",
    pages: [
      {
        label: "Medical policy & clinical guideline updates (Missouri)",
        url: "https://www.anthem.com/provider/policies/clinical-guidelines/updates/?cnslocale=en_US_mo",
      },
      { label: "Missouri reimbursement policies", url: "https://www.anthem.com/mo/provider/individual-commercial/reimbursement" },
    ],
    note: "Anthem Provider News for Missouri loads with JavaScript and can't be watched directly.",
  },
  {
    key: "uhc-commercial",
    name: "UnitedHealthcare (commercial)",
    type: "Commercial",
    region: "National",
    website: `${UHC}/policies-protocols/commercial-policies.html`,
    pages: [
      {
        label: "Commercial medical & drug policies & monthly update bulletins",
        url: `${UHC}/policies-protocols/commercial-policies/commercial-medical-drug-policies.html`,
      },
      {
        label: "Commercial reimbursement policies",
        url: `${UHC}/policies-protocols/commercial-policies/commercial-reimbursement-policies.html`,
      },
    ],
  },
  {
    key: "cigna",
    name: "Cigna Healthcare",
    type: "Commercial",
    region: "National",
    website: "https://static.cigna.com/assets/chcp/resourceLibrary/coveragePolicies/index.html",
    pages: [
      {
        label: "Coverage policy updates (monthly)",
        url: "https://static.cigna.com/assets/chcp/resourceLibrary/coveragePolicies/latestUpdatesListing.html",
      },
      { label: "Medical coverage policies A–Z", url: "https://static.cigna.com/assets/chcp/resourceLibrary/coveragePolicies/medical_a-z.html" },
    ],
  },
];

/** Look up a catalog page URL by payer key and page position (for upgrade fixes). */
export function catalogPage(key: string, index: number): CatalogPage {
  const page = CATALOG.find((c) => c.key === key)?.pages[index];
  if (!page) throw new Error(`No catalog page ${key}[${index}]`);
  return page;
}

/** Sample policies with their own documents, for a new database. `payer` is a catalog key. */
export const SAMPLE_POLICIES = [
  {
    payer: "cms-medicare",
    title: "LCD L35125 — Wound Care (WPS, Missouri)",
    category: "Billing & Coding",
    impact: "High",
    sourceUrl: "https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?LCDId=35125",
    summary: "WPS local coverage determination for wound care and debridement that applies to Missouri Part A/B claims.",
    reviewInDays: 20,
    owner: "Wound clinic manager",
    nextAction: "Check the wound documentation template against the LCD's measurement requirements",
    actionInDays: 10,
  },
  {
    payer: "cms-medicare",
    title: "NCD 20.4 — Implantable Cardioverter Defibrillators",
    category: "Coverage / Benefit",
    impact: "Medium",
    sourceUrl: "https://www.cms.gov/medicare-coverage-database/view/ncd.aspx?NCDId=110",
    summary: "National coverage determination for ICDs, including shared decision-making documentation.",
    reviewInDays: 80,
  },
  {
    payer: "home-state-health",
    title: "30 Day Readmission (CC.PP.501)",
    category: "Reimbursement",
    impact: "High",
    sourceUrl: "https://www.homestatehealth.com/content/dam/centene/policies/payment-policies/CC.PP.501.pdf",
    summary: "Home State Health payment policy for readmissions within 30 days of discharge.",
    reviewInDays: -8,
    owner: "Revenue cycle director",
    nextAction: "Pull last quarter's readmission denials and compare to the policy criteria",
    actionInDays: -2,
  },
  {
    payer: "home-state-health",
    title: "3 Day Payment Window (CC.PP.500)",
    category: "Reimbursement",
    impact: "Medium",
    sourceUrl: "https://www.homestatehealth.com/content/dam/centene/policies/payment-policies/CC.PP.500.pdf",
    summary: "Home State Health payment policy bundling outpatient services before an inpatient admission.",
    reviewInDays: 45,
  },
  {
    payer: "mo-healthnet",
    title: "MO HealthNet Hospital Provider Manual",
    category: "Billing & Coding",
    impact: "High",
    sourceUrl: "https://dss.mo.gov/media/pdf/hospital-manual",
    summary: "Missouri Medicaid hospital billing and coverage manual.",
    reviewInDays: 30,
  },
  {
    payer: "uhc-commercial",
    title: "Outpatient Surgical Procedures – Site of Service",
    category: "Prior Authorization",
    impact: "High",
    sourceUrl: "https://www.uhcprovider.com/content/dam/provider/docs/public/policies/comm-medical-drug/outpatient-surg-procedures-site-service.pdf",
    summary: "UnitedHealthcare commercial medical policy requiring site-of-service review for certain outpatient surgeries in a hospital outpatient department.",
    reviewInDays: 60,
  },
  {
    payer: "aetna",
    title: "CPB 0070 — Diabetes Tests, Programs and Supplies",
    category: "Medical Necessity",
    impact: "Medium",
    sourceUrl: "https://www.aetna.com/cpb/medical/data/1_99/0070.html",
    summary: "Aetna clinical policy bulletin covering diabetes testing and supplies, including continuous glucose monitors.",
    reviewInDays: 120,
  },
] as const;

/** Every catalog and sample-policy URL, for scripts/check-links.ts. */
export function catalogUrls(): { url: string; label: string }[] {
  return [
    ...CATALOG.flatMap((p) => [
      { label: `${p.name} — website`, url: p.website },
      ...p.pages.map((pg) => ({ label: `${p.name} — ${pg.label}`, url: pg.url })),
    ]),
    ...SAMPLE_POLICIES.map((p) => ({ label: `Sample policy — ${p.title}`, url: p.sourceUrl })),
  ];
}
