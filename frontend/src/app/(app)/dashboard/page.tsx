import { redirect } from 'next/navigation';

// /dashboard → /command-center (canonical URL for the main dashboard)
export default function DashboardRedirect() {
  redirect('/command-center');
}
