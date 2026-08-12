import {
  FileText,
  ClipboardCheck,
  Clock,
  Star,
  Activity,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import clientdash1 from '../assets/clientdash1.png';
import clientdash2 from '../assets/clientdash2.png';
import clientdash3 from '../assets/clientdash3.png';

/**
 * Dashboard headline stat cards. `icon` is a lucide component reference and
 * `variant` optionally drives the danger styling on StatCard.
 */
export const adminStats = [
  { icon: FileText, value: '2', label: 'New Today', compact: true },
  { icon: ClipboardCheck, value: '4', label: 'Active Projects', compact: true },
  { icon: Clock, value: '4', label: 'Overdue Tasks', variant: 'danger', compact: true },
  { icon: Star, value: '£1,5054', label: 'Revenue MTD', compact: true },
  { icon: Activity, value: '4', label: 'Avg Completion', compact: true },
  { icon: Zap, value: '100%', label: 'Compliance', compact: true },
];

export const clientStats = [
  { icon: ClipboardCheck, value: '2', label: 'Active Projects' },
  { icon: CheckCircle2, value: '4', label: 'Completed' },
  { icon: Star, value: '£1,5054', label: 'Funding Secured' },
  { icon: Zap, value: '100%', label: 'Compliance' },
];

export const clientProjectImages = [clientdash1, clientdash2, clientdash3];