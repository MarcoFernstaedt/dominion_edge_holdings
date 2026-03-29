import type { OutreachTemplate } from '@/lib/types';

export const SYSTEM_TEMPLATES: OutreachTemplate[] = [
  {
    id: 'tpl_seller_initial',
    name: 'Seller Initial Outreach',
    templateType: 'seller_outreach',
    subjectTemplate: 'Regarding {{company_name}} — Private Inquiry',
    bodyTemplate: `Dear {{owner_name}},

My name is Marco Fernstaedt, and I am the principal of Dominion Edge Holdings, an acquisition company focused on established {{industry}} businesses in the {{location}} area.

I am reaching out privately — not through a broker — because I am specifically interested in {{company_name}}. Your business came to my attention through {{source}}, and based on what I have learned, it aligns well with our acquisition criteria.

We are not a private equity firm. We are not here to strip the business down or eliminate jobs. We are building a platform company and looking for the right operator-owned business to be our first acquisition.

I would welcome a brief, confidential conversation to introduce myself and explain how we approach acquisitions. There is no pressure and no obligation. Many owners I speak with simply want to understand their options — and I respect that.

If this is something you would ever consider discussing, I would be happy to call at your convenience.

Respectfully,

Marco Fernstaedt
Principal, Dominion Edge Holdings
{{phone}}
{{email}}`,
    tone: 'formal_respectful',
    variables: ['owner_name', 'company_name', 'industry', 'location', 'source', 'phone', 'email'],
    isSystemTemplate: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl_seller_followup1',
    name: 'Seller Follow-Up 1',
    templateType: 'seller_outreach',
    subjectTemplate: 'Following up — {{company_name}}',
    bodyTemplate: `Dear {{owner_name}},

I wanted to follow up on my message from {{days_ago}} days ago regarding a potential private conversation about {{company_name}}.

I understand your time is valuable and running a business leaves little room for distractions. This is not meant to be one.

If you are open to a 15-minute call — even just to hear more about how we approach acquisitions — I believe it would be worth your time.

If now is not the right time, I completely understand. I am happy to reconnect when it makes sense for you.

Respectfully,

Marco Fernstaedt
Principal, Dominion Edge Holdings
{{phone}}`,
    tone: 'professional_persistent',
    variables: ['owner_name', 'company_name', 'days_ago', 'phone'],
    isSystemTemplate: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl_seller_followup2',
    name: 'Seller Follow-Up 2',
    templateType: 'seller_outreach',
    subjectTemplate: 'One more thought — {{company_name}}',
    bodyTemplate: `Dear {{owner_name}},

I will keep this brief. I have reached out twice about {{company_name}} and have not heard back. I understand — you are busy running a business and did not ask for this contact.

I want to leave you with one thought: our board includes a former {{industry}} executive who built and sold multiple companies in this space. If you ever want to understand what your business might be worth — not from a broker perspective but from someone who has been in your shoes — we are the right conversation.

I will not reach out again unless you invite it. But if you ever have a quiet moment and want to explore your options confidentially, I am here.

Marco Fernstaedt
{{phone}} | {{email}}`,
    tone: 'respectful_final',
    variables: ['owner_name', 'company_name', 'industry', 'phone', 'email'],
    isSystemTemplate: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl_board_intro',
    name: 'Board Candidate Introduction',
    templateType: 'board_outreach',
    subjectTemplate: 'Board Advisory Opportunity — Dominion Edge Holdings',
    bodyTemplate: `Dear {{contact_name}},

My name is Marco Fernstaedt. I am building Dominion Edge Holdings, an acquisition company focused on established {{industry}} businesses in the {{location}} market.

I am recruiting a small advisory board of senior professionals who can provide guidance and introductions as we execute our first acquisition. I am reaching out to you specifically because of your background at {{contact_company}} and your depth of experience in {{expertise_area}}.

The commitment is minimal — 2 to 4 hours per quarter, primarily introductions and occasional counsel. The compensation is equity, not cash, structured as {{equity_range}}% with standard advisory vesting terms.

Our board includes {{board_credential}}, which speaks to the seriousness of this endeavor.

I would welcome a 20-minute call to share our acquisition thesis and answer any questions you have. There is no pressure — I simply believe you would find the opportunity interesting.

Are you open to a conversation?

Respectfully,

Marco Fernstaedt
Principal, Dominion Edge Holdings
{{phone}} | {{email}}`,
    tone: 'executive_professional',
    variables: ['contact_name', 'industry', 'location', 'contact_company', 'expertise_area', 'equity_range', 'board_credential', 'phone', 'email'],
    isSystemTemplate: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl_board_followup',
    name: 'Board Candidate Follow-Up',
    templateType: 'board_outreach',
    subjectTemplate: 'Following up — Dominion Edge Holdings Advisory Role',
    bodyTemplate: `Dear {{contact_name}},

I am following up on my message about the advisory board opportunity with Dominion Edge Holdings.

We are at an active stage of execution — our acquisition target pipeline is building and our first LOI is targeted for {{target_timeline}}. Having your perspective on board now, before that moment, would be genuinely valuable.

If you have 20 minutes this week, I would appreciate the chance to walk you through our thesis. No commitment expected — just a conversation.

Marco Fernstaedt
{{phone}}`,
    tone: 'professional_brief',
    variables: ['contact_name', 'target_timeline', 'phone'],
    isSystemTemplate: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl_lender_intro',
    name: 'Lender Introduction',
    templateType: 'lender_outreach',
    subjectTemplate: 'SBA 7(a) Acquisition — {{industry}} — {{location}}',
    bodyTemplate: `Dear {{contact_name}},

I am Marco Fernstaedt, principal of Dominion Edge Holdings. We are actively pursuing the acquisition of an established {{industry}} business in the {{location}} market, targeting $1.5M–$3M in revenue with normalized SDE of $200K–$500K.

Our deal structure targets SBA 7(a) financing with a DSCR of 1.35–1.50x at base case. We have an advisory board that includes {{board_credential}}.

I would welcome the opportunity to introduce our company and discuss what a lending partnership might look like. {{referral_mention}}

Are you available for a 20-minute call this week or next?

Marco Fernstaedt
Principal, Dominion Edge Holdings
{{phone}} | {{email}}`,
    tone: 'professional_direct',
    variables: ['contact_name', 'industry', 'location', 'board_credential', 'referral_mention', 'phone', 'email'],
    isSystemTemplate: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'tpl_discovery_confirm',
    name: 'Discovery Call Confirmation',
    templateType: 'seller_outreach',
    subjectTemplate: 'Confirmed: Our Call on {{date}} at {{time}}',
    bodyTemplate: `Dear {{owner_name}},

Thank you for agreeing to speak with me. I am looking forward to our call on {{date}} at {{time}} {{timezone}}.

I will call you at {{phone}}. The call should take no more than 20–30 minutes.

To set expectations: this is simply an introductory conversation. I will share a bit about Dominion Edge Holdings and our approach to acquisitions. I would love to hear about your business and your goals. Nothing will be decided or committed on this call.

If anything comes up and you need to reschedule, please reach me at {{my_phone}}.

Looking forward to speaking with you.

Marco Fernstaedt
Principal, Dominion Edge Holdings`,
    tone: 'warm_professional',
    variables: ['owner_name', 'date', 'time', 'timezone', 'phone', 'my_phone'],
    isSystemTemplate: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];
