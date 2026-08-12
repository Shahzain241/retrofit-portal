import imgAssessment from '../assets/Assessmet.png';
import imgDesign from '../assets/Design.png';
import imgCoordination from '../assets/Coordination.png';

/**
 * Services showcased on the landing page ("How it works" service cards).
 * `img` is a pre-imported asset so the page component stays data-free.
 */
export const landingServices = [
  {
    id: 'whole-house-assessment-1',
    tag: 'PAS 2035',
    title: 'Retrofit Assessment',
    price: '$69',
    desc: 'Complete on-site measurement and energy modeling for compliance.',
    img: imgAssessment,
  },
  {
    id: 'whole-house-assessment-2',
    tag: 'PAS 2035',
    title: 'Design Package',
    price: '$69',
    desc: 'Detailed technical drawings and thermal bridging calculations.',
    img: imgDesign,
  },
  {
    id: 'whole-house-assessment-3',
    tag: 'PAS 2035',
    title: 'Retrofit Coordination',
    price: '$69',
    desc: 'End-to-end management from risk assessment to final sign-off.',
    img: imgCoordination,
  },
];