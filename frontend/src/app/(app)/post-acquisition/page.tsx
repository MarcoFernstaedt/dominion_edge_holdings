'use client';

import { useAppStore } from '@/lib/store';
import Link from 'next/link';
import { Building2, CheckSquare, ArrowRight } from 'lucide-react';

const POST_ACQ_TASKS = [
  { category: 'Day 1–7', tasks: ['Meet every employee one-on-one', 'Introduce yourself to top 10 customers', 'Review banking relationships and cash position', 'Confirm key vendor relationships', 'Review all employment agreements'] },
  { category: 'Day 8–30', tasks: ['Complete vendor contract review', 'Set up new accounting/reporting cadence', 'Identify quick operational wins', 'Establish weekly reporting rhythm', 'Review licensing and compliance status'] },
  { category: 'Day 31–60', tasks: ['Complete customer retention plan', 'Launch first board update', 'Establish KPI dashboard baseline', 'Complete first month P&L review', 'Identify first add-on acquisition targets'] },
  { category: 'Day 61–90', tasks: ['90-day performance review against plan', 'Identify operational improvement initiatives', 'Begin second acquisition sourcing', 'Review operator transition readiness', 'Prepare first quarterly board update'] },
];

export default function PostAcquisitionPage() {
  const deals = useAppStore((s) => s.deals);
  const closedDeals = deals.filter((d) => d.status === 'closed');

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
      <header>
        <h1 className="font-serif text-3xl font-semibold text-[#E8E6E3]">Post-Acquisition</h1>
        <p className="text-sm text-[#A7A29A] mt-1">90-day integration plan · Operator transition · Platform building</p>
      </header>

      {closedDeals.length === 0 ? (
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-8 text-center">
          <Building2 size={32} className="mx-auto text-[#A7A29A] mb-3" aria-hidden />
          <p className="text-sm text-[#A7A29A] mb-2">No closed acquisitions yet.</p>
          <p className="text-xs text-[#A7A29A]">Once a deal closes, your 90-day integration plan will appear here.</p>
          <Link href="/pipeline" className="mt-3 inline-flex items-center gap-1 text-sm text-[#C9A227] hover:underline">
            View Pipeline <ArrowRight size={12} aria-hidden />
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {closedDeals.map((d) => (
            <div key={d.id} className="bg-[#141414] border border-[#3FA66B40] rounded-md p-4">
              <div className="text-sm font-semibold text-[#E8E6E3]">{d.companyName}</div>
              <div className="text-xs text-[#3FA66B]">Acquired</div>
            </div>
          ))}
        </div>
      )}

      {/* 90-day template */}
      <section aria-labelledby="plan-heading">
        <h2 id="plan-heading" className="text-[10px] tracking-widest uppercase font-medium text-[#A7A29A] mb-3">
          90-Day Integration Framework
        </h2>
        <div className="space-y-3">
          {POST_ACQ_TASKS.map((section) => (
            <div key={section.category} className="bg-[#141414] border border-[#2A2A2E] rounded-md p-5">
              <h3 className="text-sm font-semibold text-[#C9A227] mb-3">{section.category}</h3>
              <ul className="space-y-2">
                {section.tasks.map((task, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#A7A29A]">
                    <CheckSquare size={14} className="text-[#2A2A2E] flex-shrink-0 mt-0.5" aria-hidden />
                    {task}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
