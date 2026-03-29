import { redirect } from 'next/navigation';

export default function UnderwritingDealPage({ params }: { params: { dealId: string } }) {
  redirect(`/underwriting?dealId=${params.dealId}`);
}
