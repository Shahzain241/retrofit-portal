/**
 * Misc dashboard mock data — notifications, activity, users, admin services,
 * invoices, deliverables, documents, milestones, chat and subscription plans.
 *
 * Every entity below follows one consistent shape (unique `id`, lowercase
 * enum keys for status/role, no duplicated nested objects).
 */

export const topbarNotifications = [
  {
    id: 'ntf-1001',
    title: 'Technical Survey Uploaded',
    meta: 'Mike Ross • 2h ago',
    timestamp: '2026-05-18T08:15:00Z',
  },
  {
    id: 'ntf-1002',
    title: 'Comment on Invoice #902',
    meta: 'Sarah Jenkins • 5h ago',
    timestamp: '2026-05-18T05:10:00Z',
  },
  {
    id: 'ntf-1003',
    title: 'Milestone completed: Assessment',
    meta: 'System • 1d ago',
    timestamp: '2026-05-17T09:00:00Z',
  },
];

export const topbarApps = ['Dashboard', 'Projects', 'Services', 'Billing', 'Support', 'Docs'];

export const recentActivity = [
  {
    id: 'act-1001',
    title: 'Technical Survey Uploaded',
    meta: 'Mike Ross • 2h ago',
    timestamp: '2026-05-18T08:15:00Z',
  },
  {
    id: 'act-1002',
    title: 'Comment on Invoice #902',
    meta: 'Sarah Jenkins • 5h ago',
    timestamp: '2026-05-18T05:10:00Z',
  },
  {
    id: 'act-1003',
    title: 'Milestone completed: Assessment',
    meta: 'System • 1d ago',
    timestamp: '2026-05-17T09:00:00Z',
  },
];

export const users = [
  {
    id: 'usr-1001',
    name: 'John Smith',
    email: 'johnsmith123@gmail.com',
    role: 'super-admin',
    projects: 'All',
    lastLogin: 'Just Now',
    status: 'active',
  },
  {
    id: 'usr-1002',
    name: 'John Smith',
    email: 'johnsmith123@gmail.com',
    role: 'coordinator',
    projects: '12',
    lastLogin: '2 hours ago',
    status: 'offline',
  },
  {
    id: 'usr-1003',
    name: 'John Smith',
    email: 'johnsmith123@gmail.com',
    role: 'designer',
    projects: '2',
    lastLogin: 'Yesterday',
    status: 'active',
  },
  {
    id: 'usr-1004',
    name: 'John Smith',
    email: 'johnsmith123@gmail.com',
    role: 'assessor',
    projects: '3',
    lastLogin: 'May 18, 2026',
    status: 'offline',
  },
  {
    id: 'usr-1005',
    name: 'John Smith',
    email: 'johnsmith123@gmail.com',
    role: 'designer',
    projects: '3',
    lastLogin: 'May 18, 2026',
    status: 'active',
  },
  {
    id: 'usr-1006',
    name: 'John Smith',
    email: 'johnsmith123@gmail.com',
    role: 'designer',
    projects: '1',
    lastLogin: 'May 18, 2026',
    status: 'active',
  },
];

export const services = [
  {
    id: 'srv-1001',
    title: 'House thermal Inspection',
    price: 245,
    currency: 'GBP',
    days: 3,
    updated: 'Just Now',
    deliverables: 4,
    status: 'active',
  },
  {
    id: 'srv-1002',
    title: 'House thermal Inspection',
    price: 12,
    currency: 'GBP',
    days: 3,
    updated: '2 hours ago',
    deliverables: 4,
    status: 'inactive',
  },
  {
    id: 'srv-1003',
    title: 'House thermal Inspection',
    price: 2,
    currency: 'GBP',
    days: 3,
    updated: 'Yesterday',
    deliverables: 4,
    status: 'active',
  },
  {
    id: 'srv-1004',
    title: 'House thermal Inspection',
    price: 3,
    currency: 'GBP',
    days: 3,
    updated: 'May 18, 2026',
    deliverables: 4,
    status: 'inactive',
  },
  {
    id: 'srv-1005',
    title: 'House thermal Inspection',
    price: 3,
    currency: 'GBP',
    days: 3,
    updated: 'May 18, 2026',
    deliverables: 4,
    status: 'active',
  },
  {
    id: 'srv-1006',
    title: 'House thermal Inspection',
    price: 1,
    currency: 'GBP',
    days: 3,
    updated: 'May 18, 2026',
    deliverables: 4,
    status: 'active',
  },
];

export const invoices = [
  { id: 'inv-902', number: '#INV-902', date: 'Sep 12, 2024', amount: '£29.00', status: 'paid' },
  { id: 'inv-901', number: '#INV-901', date: 'Aug 12, 2024', amount: '£29.00', status: 'paid' },
  { id: 'inv-900', number: '#INV-900', date: 'Jul 12, 2024', amount: '£29.00', status: 'paid' },
  { id: 'inv-899', number: '#INV-899', date: 'Jun 12, 2024', amount: '£29.00', status: 'paid' },
  { id: 'inv-898', number: '#INV-898', date: 'May 12, 2024', amount: '£29.00', status: 'paid' },
  { id: 'inv-897', number: '#INV-897', date: 'Apr 12, 2024', amount: '£29.00', status: 'paid' },
];

export const deliverables = [
  {
    id: 'dlv-1001',
    title: 'EPC Pre-Retrofit Report',
    desc: 'Baseline energy performance certificate.',
    icon: 'pdf',
    ready: true,
  },
  {
    id: 'dlv-1002',
    title: 'Funding Assessment #V2',
    desc: 'ECO4 contribution breakdown.',
    icon: 'xls',
    ready: true,
  },
  {
    id: 'dlv-1003',
    title: 'Technical Survey Report',
    desc: 'In progress • Est. July 5th',
    icon: 'doc',
    ready: false,
  },
];

export const documents = [
  { id: 'doc-1001', name: 'Current EPC.pdf', meta: 'Version 1 • Today' },
  { id: 'doc-1002', name: 'Current EPC.pdf', meta: 'Version 1 • Today' },
  { id: 'doc-1003', name: 'Current EPC.pdf', meta: 'Version 1 • Today' },
];

export const milestones = [
  { id: 'ms-1001', title: 'Purchase Completed', date: '12/12/2026', state: 'done' },
  { id: 'ms-1002', title: 'Assessment', date: '12/12/2026', state: 'done' },
  { id: 'ms-1003', title: 'Survey', date: '', state: 'current' },
  { id: 'ms-1004', title: 'Installation', date: '', state: 'upcoming' },
];

export const chatMessages = [
  {
    id: 'msg-1001',
    from: 'other',
    text: 'Hi Sarah, EPC received. Reviewing now.',
    time: '14:22',
    avatar: 'https://i.pravatar.cc/80?img=12',
  },
  {
    id: 'msg-1002',
    from: 'me',
    text: 'Okay',
    time: '14:22',
    avatar: 'https://i.pravatar.cc/80?img=13',
  },
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
    id: 'plan-free',
    name: 'Free',
    price: '£0',
    desc: 'Essential tools for individuals.',
    features: [
      { id: 'free-1', text: 'Up to 2 projects', ok: true },
      { id: 'free-2', text: 'Basic PDF exports', ok: true },
      { id: 'free-3', text: 'Advanced analytics', ok: false },
    ],
    cta: 'Current Plan',
    highlight: false,
  },
  {
    id: 'plan-priority',
    name: 'Priority',
    price: '£29',
    desc: 'Precision tools for growing teams.',
    features: [
      { id: 'priority-1', text: 'Unlimited projects', ok: true },
      { id: 'priority-2', text: 'Priority support', ok: true },
      { id: 'priority-3', text: 'Advanced energy models', ok: true },
    ],
    cta: 'Upgrade Now',
    highlight: true,
    badge: 'MOST POPULAR',
  },
  {
    id: 'plan-enterprise',
    name: 'Enterprise',
    price: '£149',
    desc: 'Institutional-grade control.',
    features: [
      { id: 'enterprise-1', text: 'SSO & SAML', ok: true },
      { id: 'enterprise-2', text: 'Custom API access', ok: true },
      { id: 'enterprise-3', text: 'Dedicated account manager', ok: true },
    ],
    cta: 'Contact Sales',
    highlight: false,
  },
];
