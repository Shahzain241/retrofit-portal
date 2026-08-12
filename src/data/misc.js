export const topbarNotifications = [
  { title: 'Technical Survey Uploaded', meta: 'Mike Ross • 2h ago' },
  { title: 'Comment on Invoice #902', meta: 'Sarah Jenkins • 5h ago' },
  { title: 'Milestone completed: Assessment', meta: 'System • 1d ago' },
];

export const topbarApps = ['Dashboard', 'Projects', 'Services', 'Billing', 'Support', 'Docs'];

export const recentActivity = [
  { title: 'Technical Survey Uploaded', meta: 'Mike Ross • 2h ago' },
  { title: 'Comment on Invoice #902', meta: 'Sarah Jenkins • 5h ago' },
  { title: 'Comment on Invoice #902', meta: 'Sarah Jenkins • 5h ago' },
];

export const users = [
  {
    name: 'John Smith',
    email: 'johnsmith123@gmail.com',
    role: 'Super Admin',
    projects: 'All',
    lastLogin: 'Just Now',
    status: 'Active',
  },
  {
    name: 'John Smith',
    email: 'johnsmith123@gmail.com',
    role: 'Coordinator',
    projects: '12',
    lastLogin: '2 hours ago',
    status: 'Offline',
  },
  {
    name: 'John Smith',
    email: 'johnsmith123@gmail.com',
    role: 'Designer',
    projects: '2',
    lastLogin: 'Yesteray',
    status: 'Active',
  },
  {
    name: 'John Smith',
    email: 'johnsmith123@gmail.com',
    role: 'Assessor',
    projects: '3',
    lastLogin: 'May 18, 2026',
    status: 'Offline',
  },
  {
    name: 'John Smith',
    email: 'johnsmith123@gmail.com',
    role: 'Designer',
    projects: '3',
    lastLogin: 'May 18, 2026',
    status: 'Active',
  },
  {
    name: 'John Smith',
    email: 'johnsmith123@gmail.com',
    role: 'Designer',
    projects: '1',
    lastLogin: 'May 18, 2026',
    status: 'Active',
  },
];

export const services = [
  { title: 'House thermal Inspection', price: 245, days: 3, updated: 'Just Now', deliverables: 4, status: 'Active' },
  { title: 'House thermal Inspection', price: 12, days: 3, updated: '2 hours ago', deliverables: 4, status: 'Inactive' },
  { title: 'House thermal Inspection', price: 2, days: 3, updated: 'Yesteray', deliverables: 4, status: 'Active' },
  { title: 'House thermal Inspection', price: 3, days: 3, updated: 'May 18, 2026', deliverables: 4, status: 'Inactive' },
  { title: 'House thermal Inspection', price: 3, days: 3, updated: 'May 18, 2026', deliverables: 4, status: 'Active' },
  { title: 'House thermal Inspection', price: 1, days: 3, updated: 'May 18, 2026', deliverables: 4, status: 'Active' },
];

export const invoices = Array.from({ length: 6 }).map(() => ({
  date: 'Sep 12, 2024',
  amount: '£29.00',
  status: 'Paid',
}));

export const deliverables = [
  {
    title: 'EPC Pre-Retrofit Report',
    desc: 'Baseline energy performance certificate.',
    icon: 'pdf',
    ready: true,
  },
  {
    title: 'Funding Assessment #V2',
    desc: 'ECO4 contribution breakdown.',
    icon: 'xls',
    ready: true,
  },
  {
    title: 'Technical Survey Report',
    desc: 'In progress • Est. July 5th',
    icon: 'doc',
    ready: false,
  },
];

export const documents = [
  { name: 'Current EPC.pdf', meta: 'Version 1 • Today' },
  { name: 'Current EPC.pdf', meta: 'Version 1 • Today' },
  { name: 'Current EPC.pdf', meta: 'Version 1 • Today' },
];

export const milestones = [
  { title: 'Purchase Completed', date: '12/12/2026', state: 'done' },
  { title: 'Assessment', date: '12/12/2026', state: 'done' },
  { title: 'Survey', date: '', state: 'current' },
  { title: 'Installation', date: '', state: 'upcoming' },
];

export const chatMessages = [
  { from: 'other', text: 'Hi Sarah, EPC received. Reviewing now.', time: '14:22', avatar: 'https://i.pravatar.cc/80?img=12' },
  { from: 'me', text: 'Okay', time: '14:22', avatar: 'https://i.pravatar.cc/80?img=13' },
];

export const teamWorkload = [
  { name: 'Jane', value: 4 },
  { name: 'Rob', value: 6 },
  { name: 'Marie', value: 5 },
  { name: 'Aron', value: 7 },
  { name: 'Mila', value: 6.5 },
  { name: 'Jon', value: 9 },
];

export const projectByStatus = [
  { name: 'On Track', value: 55, color: '#1fae5c' },
  { name: 'At Risk', value: 30, color: '#0f1b2e' },
  { name: 'Delayed', value: 15, color: '#d9dce1' },
];

export const revenueTrend = [
  { month: 'Jan', value: 3.6 },
  { month: 'Feb', value: 4.5 },
  { month: 'Mar', value: 3.9 },
  { month: 'Apr', value: 7.6 },
  { month: 'May', value: 8 },
  { month: 'Jun', value: 6.9 },
  { month: 'Jul', value: 5.5 },
  { month: 'Aug', value: 3.4 },
  { month: 'Sep', value: 5.9 },
  { month: 'Oct', value: 4.3 },
  { month: 'Nov', value: 3.6 },
  { month: 'Dec', value: 9.6 },
];

export const plans = [
  {
    name: 'Free',
    price: '£0',
    desc: 'Essential tools for individuals.',
    features: [
      { text: 'Up to 2 projects', ok: true },
      { text: 'Basic PDF exports', ok: true },
      { text: 'Advanced analytics', ok: false },
    ],
    cta: 'Current Plan',
    highlight: false,
  },
  {
    name: 'Priority',
    price: '£29',
    desc: 'Precision tools for growing teams.',
    features: [
      { text: 'Unlimited projects', ok: true },
      { text: 'Priority support', ok: true },
      { text: 'Advanced energy models', ok: true },
    ],
    cta: 'Upgrade Now',
    highlight: true,
    badge: 'MOST POPULAR',
  },
  {
    name: 'Enterprise',
    price: '£149',
    desc: 'Institutional-grade control.',
    features: [
      { text: 'SSO & SAML', ok: true },
      { text: 'Custom API access', ok: true },
      { text: 'Dedicated account manager', ok: true },
    ],
    cta: 'Contact Sales',
    highlight: false,
  },
];
