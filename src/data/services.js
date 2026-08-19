import imgService1 from '../assets/service1.png';
import imgService2 from '../assets/service2.png';
import imgService3 from '../assets/service3.png';
import imgService4 from '../assets/service4.png';

/**
 * Public services listing page (Services.jsx) mock data.
 * Replace with API data later without touching the page component.
 */

export const publicServices = [
  {
    id: 'whole-house-assessment-1',
    image: imgService1,
    tag: 'PAS 2035',
    title: 'Retrofit Whole-House Assessment',
    description: 'Comprehensive technical survey and digital energy model according',
    duration: '5-7 Days',
    price: 450,
    currency: 'GBP',
    category: 'Assessment',
    budget: 'under500',
  },
  {
    id: 'whole-house-assessment-2',
    image: imgService2,
    tag: 'PAS 2035',
    title: 'Retrofit Whole-House Assessment',
    description: 'Comprehensive technical survey and digital energy model according',
    duration: '5-7 Days',
    price: 450,
    currency: 'GBP',
    category: 'Design',
    budget: 'under500',
  },
  {
    id: 'whole-house-assessment-3',
    image: imgService3,
    tag: 'PAS 2035',
    title: 'Retrofit Whole-House Assessment',
    description: 'Comprehensive technical survey and digital energy model according',
    duration: '5-7 Days',
    price: 450,
    currency: 'GBP',
    category: 'Coordination',
    budget: 'under500',
  },
  {
    id: 'whole-house-assessment-4',
    image: imgService4,
    tag: 'FUNDING',
    title: 'Retrofit Whole-House Assessment',
    description: 'Comprehensive technical survey and digital energy model according',
    duration: '5-7 Days',
    price: 450,
    currency: 'GBP',
    category: 'Funding',
    budget: 'under500',
  },
  {
    id: 'whole-house-assessment-5',
    image: imgService2,
    tag: 'PAS 2035',
    title: 'Retrofit Whole-House Assessment',
    description: 'Comprehensive technical survey and digital energy model according',
    duration: '5-7 Days',
    price: 450,
    currency: 'GBP',
    category: 'Full Package',
    budget: 'under500',
  },
  {
    id: 'whole-house-assessment-6',
    image: imgService3,
    tag: 'PAS 2035',
    title: 'Retrofit Whole-House Assessment',
    description: 'Comprehensive technical survey and digital energy model according',
    duration: '5-7 Days',
    price: 450,
    currency: 'GBP',
    category: 'Assessment',
    budget: 'under500',
  },
];

export const serviceCategories = [
  'All Services',
  'Assessment',
  'Design',
  'Coordination',
  'Full Package',
  'Funding',
];

export const serviceBudgets = [
  { key: 'under500', label: 'Under £500' },
  { key: '500to1000', label: '£500–£1000' },
  { key: '1000plus', label: '£1000+' },
];