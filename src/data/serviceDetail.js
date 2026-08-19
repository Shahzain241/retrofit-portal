import imgOverview from '../assets/overview.png';
import imgAssessment from '../assets/Assessmet.png';
import imgDesign from '../assets/Design.png';
import imgCoordination from '../assets/Coordination.png';

/**
 * Service Detail page (/services/:id) mock data — hero, pricing tiers,
 * overview, whats-included list, timeline and compliance cards.
 */
export const serviceDetail = {
  badge: 'PAS 2035 CERTIFIED',
  title: 'Whole-House Retrofit Assessment &\u00A0Coordination',
  subtitle:
    'Professional compliance-led assessment for domestic energy efficiency\nprojects, ensuring eligibility for government funding and institutional\nstandards.',
  heroImage: imgOverview,
  heroBadge: 'TrustMark Certified',
  thumbnails: [imgCoordination, imgDesign, imgAssessment],
  tiers: {
    Basic: {
      id: 'tier-basic',
      price: 450,
      tierLabel: 'Basic Tier',
      description:
        'Ideal for small residential properties (up to 2 beds) requiring standard compliance assessment.',
      delivery: '5 Days Delivery',
      survey: '1 Site Survey Included',
      addons: [
        { id: 'express', label: 'Express 48h Delivery', price: 150 },
        { id: 'review', label: 'Property Review (Extended)', price: 85 },
      ],
    },
    Standard: {
      id: 'tier-standard',
      price: 750,
      tierLabel: 'Standard Tier',
      description:
        'Best for mid-sized homes (3-4 beds) needing a fuller fabric and heating system review.',
      delivery: '7 Days Delivery',
      survey: '2 Site Surveys Included',
      addons: [
        { id: 'express', label: 'Express 48h Delivery', price: 150 },
        { id: 'review', label: 'Property Review (Extended)', price: 85 },
        { id: 'thermal', label: 'Thermal Imaging Report', price: 120 },
      ],
    },
    Premium: {
      id: 'tier-premium',
      price: 1150,
      tierLabel: 'Premium Tier',
      description:
        'For larger properties or portfolios needing full PAS 2035 coordination and funding support.',
      delivery: '10 Days Delivery',
      survey: 'Unlimited Site Surveys',
      addons: [
        { id: 'express', label: 'Express 48h Delivery', price: 150 },
        { id: 'review', label: 'Property Review (Extended)', price: 85 },
        { id: 'thermal', label: 'Thermal Imaging Report', price: 120 },
        { id: 'funding', label: 'Funding Application Support', price: 200 },
      ],
    },
  },
  overview: {
    heading: 'Service Overview',
    paragraphs: [
      'Your Whole-House Retrofit Assessment is a comprehensive, PAS 2035-compliant evaluation designed to improve the energy performance, comfort, and long-term sustainability of residential properties. It provides property owners, landlords, housing associations, and professional housing providers with a clear, data-driven roadmap for reducing carbon emissions, lowering operational costs, and preparing buildings for future energy standards.',
      'The assessment takes a whole-house approach, meaning the property is evaluated as a complete system rather than focusing on isolated upgrades. This helps ensure that all recommended improvements work together effectively, avoiding issues such as poor ventilation, condensation, overheating, or inefficient energy use.',
    ],
    listIntro: 'Key areas assessed include:',
    list: [
      'Building fabric performance (walls, roof, floors, windows, and insulation)',
      'Heating and hot water systems',
      'Ventilation and indoor air quality',
      'Air tightness and thermal bridging',
      'Existing energy efficiency measures',
      'Occupancy patterns and property usage',
      'Moisture risks and building condition',
      'Renewable energy opportunities',
      'Compliance with current UK retrofit and energy regulations',
    ],
  },
  whatsIncluded: [
    'On-site property survey (Full PAS 2035)',
    'Energy performance modeling (RdSAP)',
    'Ventilation & Condition reports',
    'Occupancy assessment documentation',
    'Medium-term Improvement Plan (MTIP)',
    'Retrofit Coordinator oversight',
  ],
  timeline: [
    { id: 'tl-1001', step: 'Day 1', title: 'Project Onboarding', detail: 'Gathering existing EPC data and scheduling site visit.', status: 'completed' },
    { id: 'tl-1002', step: 'Day 3-5', title: 'Site Assessment', detail: 'Qualified assessor visits property for measurements and ventilation check.', status: 'active' },
    { id: 'tl-1003', step: 'Day 10', title: 'Technical Report & MTIP', detail: 'Final delivery of all compliance documents and certified recommendations.', status: 'upcoming' },
  ],
  compliance: [
    { id: 'cmp-1001', icon: 'audit', title: 'Audit Readiness', text: 'Full documentation prepared for potential TrustMark audits or funding body inspections.' },
    { id: 'cmp-1002', icon: 'shield', title: 'Qualified Leads', text: 'All assessments are performed by Level 3 or higher accredited Retrofit Assessors.' },
    { id: 'cmp-1003', icon: 'audit', title: 'Audit Readiness', text: 'Full documentation prepared for potential TrustMark audits or funding body inspections.' },
    { id: 'cmp-1004', icon: 'shield', title: 'Qualified Leads', text: 'All assessments are performed by Level 3 or higher accredited Retrofit Assessors.' },
  ],
};

export const detailTierNames = ['Basic', 'Standard', 'Premium'];
export const detailContentTabs = ['Overview', "What's Included", 'Timeline', 'Compliance'];