import imgAssessment from '../assets/Assessmet.png';
import imgDesign from '../assets/Design.png';
import imgCoordination from '../assets/Coordination.png';

/**
 * Services showcased on the landing page ("How it works" service cards).
 * `img` is a pre-imported asset so the page component stays data-free.
 */
export const landingServices = [
  {
    id: 'service-assessment',
    tag: 'PAS 2035',
    title: 'Retrofit Assessment',
    price: '$69',
    desc: 'Complete on-site measurement and energy modeling for compliance.',
    img: imgAssessment,
  },
  {
    id: 'service-design',
    tag: 'PAS 2035',
    title: 'Design Package',
    price: '$69',
    desc: 'Detailed technical drawings and thermal bridging calculations.',
    img: imgDesign,
  },
  {
    id: 'service-coordination',
    tag: 'PAS 2035',
    title: 'Retrofit Coordination',
    price: '$69',
    desc: 'End-to-end management from risk assessment to final sign-off.',
    img: imgCoordination,
  },
];
