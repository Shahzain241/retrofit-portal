/**
 * Retrofit project data — single source of truth for the "project" entity.
 *
 * The same shape is used for the client view (`projects`) and the admin
 * directory (`directoryProjects`). People are stored once and referenced by
 * id (`coordinatorId` / `clientId`) instead of being repeated inline.
 */

// ---------------------------------------------------------------------------
// People (referenced by id)
// ---------------------------------------------------------------------------

export const coordinators = [
  {
    id: 'usr-john-hopkins',
    name: 'John Hopkins',
    role: 'coordinator',
    email: 'johnhop123@gmail.com',
    avatar: 'https://i.pravatar.cc/80?img=12',
  },
];

export const clients = [
  {
    id: 'usr-john-smith',
    name: 'John Smith',
    email: 'johnsmith123@gmail.com',
    avatar: 'https://i.pravatar.cc/80?img=13',
  },
];

export const coordinatorById = Object.fromEntries(coordinators.map((c) => [c.id, c]));
export const clientById = Object.fromEntries(clients.map((c) => [c.id, c]));

// ---------------------------------------------------------------------------
// Address helpers (addresses are stored once as a structured object)
// ---------------------------------------------------------------------------

/** Full single-line address, e.g. "42 Maple Avenue, London NW10 6RF". */
export function formatAddress(project) {
  const { line1, city, postcode } = project.address;
  return `${line1}, ${city} ${postcode}`;
}

/** City + postcode line, e.g. "London, NW10 6RF, UK". */
export function formatLocation(project) {
  const { city, postcode } = project.address;
  return `${city}, ${postcode}, UK`;
}

// ---------------------------------------------------------------------------
// Client projects (dashboard / my projects / project detail)
// ---------------------------------------------------------------------------

export const projects = [
  {
    id: 'RET-2026-0042',
    name: 'Deep Retrofit & Solar Installation',
    address: { line1: '42 Maple Avenue', city: 'London', postcode: 'NW10 6RF' },
    status: 'active',
    progress: 65,
    tag: 'ECO4',
    image:
      'https://images.unsplash.com/photo-1613977257363-707ba9348227?q=80&w=800&auto=format&fit=crop',
    coordinatorId: 'usr-john-hopkins',
    clientId: 'usr-john-smith',
    phase: 'coordination',
    currentPhase: 'Technical Survey',
    phaseDescription:
      'Certified assessors are validating property dimensions and thermal retention capabilities to finalize the heat pump specification.',
    notice: 'Requires coordinator sign-off before proceeding to procurement.',
    dates: { created: '2026-01-12', updated: '2026-05-16', dueDate: '2026-07-05' },
  },
  {
    id: 'RET-2026-0043',
    name: 'Deep Retrofit & Solar Installation',
    address: { line1: '23 Oak Avenue', city: 'Manchester', postcode: 'M1 4AB' },
    status: 'active',
    progress: 65,
    tag: 'ECO4',
    image:
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?q=80&w=800&auto=format&fit=crop',
    coordinatorId: 'usr-john-hopkins',
    clientId: 'usr-john-smith',
    phase: 'assessment',
    currentPhase: 'Assessment',
    phaseDescription: 'Initial property assessment is underway.',
    notice: 'Awaiting client document upload.',
    dates: { created: '2026-02-02', updated: '2026-05-10', dueDate: '2026-08-01' },
  },
  {
    id: 'RET-2026-0044',
    name: 'Deep Retrofit & Solar Installation',
    address: { line1: '88 Birchwood Lane', city: 'Leeds', postcode: 'LS6 2NW' },
    status: 'completed',
    progress: 100,
    tag: 'ECO4',
    image:
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?q=80&w=800&auto=format&fit=crop',
    coordinatorId: 'usr-john-hopkins',
    clientId: 'usr-john-smith',
    phase: 'completed',
    currentPhase: 'Completed',
    phaseDescription: 'Project has been completed successfully.',
    notice: '',
    dates: { created: '2025-11-20', updated: '2026-04-28', dueDate: '2026-04-30' },
  },
];

// ---------------------------------------------------------------------------
// Task board (admin)
// ---------------------------------------------------------------------------

export const taskBoardColumns = [
  {
    id: 'backlog',
    title: 'Backlog',
    tasks: [{ id: 'task-0001', title: 'Completed task', tags: ['System', 'Done'] }],
  },
  { id: 'awaiting-client', title: 'Awaiting Client', tasks: [] },
  { id: 'assessment', title: 'Assessment', tasks: [] },
  { id: 'design', title: 'Design', tasks: [] },
  { id: 'coordination', title: 'Coordination', tasks: [] },
  { id: 'qa', title: 'QA', tasks: [] },
  { id: 'done', title: 'Done', tasks: [] },
];

// ---------------------------------------------------------------------------
// Priority queue (admin dashboard)
// ---------------------------------------------------------------------------

export const priorityQueue = [
  {
    id: 'pq-1001',
    projectId: 'RET-2026-0043',
    property: '23 Oak Avenue, Manchester',
    issue: 'UPC report overdue',
    dueDate: 'May 18, 2026',
    priority: 'high',
    assignedTo: null,
    action: 'Assign',
  },
  {
    id: 'pq-1002',
    projectId: 'RET-2026-0042',
    property: '42 Maple Avenue, London',
    issue: 'Ventilation certificate missing',
    dueDate: 'May 22, 2026',
    priority: 'medium',
    assignedTo: 'John Smith',
    action: 'Assign',
  },
  {
    id: 'pq-1003',
    projectId: 'RET-2026-0044',
    property: '88 Birchwood Lane, Leeds',
    issue: 'EPC figures rejected at QA review',
    dueDate: 'May 25, 2026',
    priority: 'high',
    assignedTo: 'John Smith',
    action: 'Review',
  },
  {
    id: 'pq-1004',
    projectId: 'RET-2026-0043',
    property: '23 Oak Avenue, Manchester',
    issue: 'Funding application resubmission',
    dueDate: 'May 29, 2026',
    priority: 'low',
    assignedTo: null,
    action: 'Assign',
  },
  {
    id: 'pq-1005',
    projectId: 'RET-2026-0042',
    property: '42 Maple Avenue, London',
    issue: 'Client documents pending upload',
    dueDate: 'Jun 03, 2026',
    priority: 'high',
    assignedTo: 'John Smith',
    action: 'Assign',
  },
];

// ---------------------------------------------------------------------------
// Projects directory (admin) — same "project" shape as `projects`
// ---------------------------------------------------------------------------

const directoryEntries = [
  { line1: '42 Oakwood Drive', city: 'Manchester', postcode: 'M3 4AB', service: 'HVAC Retrofit', progress: 65 },
  { line1: '17 Cedar Close', city: 'Birmingham', postcode: 'B12 8QD', service: 'Insulation Upgrade', progress: 40 },
  { line1: '9 Willow Way', city: 'London', postcode: 'SE15 2BN', service: 'Insulation Upgrade', progress: 82 },
  { line1: '31 Sycamore Street', city: 'Leeds', postcode: 'LS11 5RT', service: 'HVAC Retrofit', progress: 25 },
  { line1: '58 Rowan Road', city: 'Bristol', postcode: 'BS3 4JL', service: 'Insulation Upgrade', progress: 90 },
  { line1: '12 Hazel Grove', city: 'Manchester', postcode: 'M20 1HJ', service: 'Insulation Upgrade', progress: 55 },
  { line1: '24 Aspen Avenue', city: 'London', postcode: 'NW2 3PK', service: 'HVAC Retrofit', progress: 70 },
  { line1: '3 Elm Terrace', city: 'Leeds', postcode: 'LS8 2XD', service: 'Insulation Upgrade', progress: 45 },
  { line1: '77 Beech Drive', city: 'Birmingham', postcode: 'B5 7UQ', service: 'HVAC Retrofit', progress: 100 },
];

export const directoryProjects = directoryEntries.map((entry, i) => ({
  id: `RET-2026-${String(101 + i)}`,
  name: entry.service,
  address: { line1: entry.line1, city: entry.city, postcode: entry.postcode },
  status: entry.progress === 100 ? 'completed' : 'active',
  progress: entry.progress,
  clientId: 'usr-john-smith',
  service: entry.service,
  hasIssues: i % 4 === 1,
  dates: {
    created: '2026-01-05',
    updated: '2026-05-12',
    dueDate: '2026-09-30',
  },
}));
