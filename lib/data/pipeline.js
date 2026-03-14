export const DEAL_STAGES = [
  'Identified', 'Contacted', 'Conversation', 'Diligence',
  'LOI Sent', 'Under Contract', 'Closed', 'Dead',
];

export const HOW_FOUND = [
  'AZ OPM Registry', 'Google Maps', 'Referral', 'LinkedIn', 'AZPMA Event', 'Other',
];

export const STAGE_COLORS = {
  Identified:     '#666',
  Contacted:      '#5A8DB5',
  Conversation:   '#7B9E87',
  Diligence:      '#8B6F9E',
  'LOI Sent':     '#C9A84C',
  'Under Contract':'#D4845A',
  Closed:         '#4CAF50',
  Dead:           '#444',
};

export const FUNNEL_STEPS = [
  { label: '150 contacted',          color: '#C9A84C' },
  { label: '30–40 real conversations', color: '#5A8DB5' },
  { label: '10–15 open to selling',  color: '#7B9E87' },
  { label: '3–5 right price + timing', color: '#D4845A' },
  { label: '1–2 will close',         color: '#4CAF50' },
];

export const EMPTY_DEAL = {
  company: '', owner: '', phone: '', email: '',
  revenue: '', ebitda: '', trucks: '', years: '',
  howFound: 'AZ OPM Registry', stage: 'Identified', notes: '',
};
