/**
 * Default form values for entity creation modals.
 * Centralises operator-specific defaults (Phoenix/AZ, Pest Control, etc.)
 * so they can be changed in one place.
 *
 * Fields with union-type values (status, priority, contactType, etc.) are
 * intentionally typed as `string` by not using `as const`, so that spread
 * into setState works without type narrowing issues.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DEFAULT_COMPANY_FORM: Record<string, any> = {
  name:                '',
  industry:            'Pest Control',
  website:             '',
  phone:               '',
  email:               '',
  city:                'Phoenix',
  state:               'AZ',
  ownerName:           '',
  ownerAgeSignal:      '',
  estimatedRevenueLow: '',
  estimatedRevenueHigh:'',
  estimatedSDELow:     '',
  estimatedSDEHigh:    '',
  yearsInBusiness:     '',
  status:              'target' ,
  priority:            'medium' ,
  source:              '',
  notes:               '',
  retirementSignal:    false,
  noWebsiteSignal:     false,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DEFAULT_CONTACT_FORM: Record<string, any> = {
  firstName:     '',
  lastName:      '',
  title:         '',
  companyId:     '',
  contactType:   'networking_contact',
  email:         '',
  phone:         '',
  notes:         '',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DEFAULT_DEAL_FORM: Record<string, any> = {
  companyId:        '',
  companyName:      '',
  name:             '',
  stage:            'identified',
  estimatedRevenue: '',
  estimatedSDE:     '',
  askingPrice:      '',
  source:           '',
  dealThesis:       '',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DEFAULT_CANDIDATE_FORM: Record<string, any> = {
  name:          '',
  title:         '',
  company:       '',
  seatType:      '',
  source:        '',
  status:        'identified',
  equityOffered: '',
  bio:           '',
  notes:         '',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const DEFAULT_MEETING_FORM: Record<string, any> = {
  meetingType:     'seller_discovery',
  title:           '',
  startsAt:        '',
  endsAt:          '',
  durationMinutes: 60,
  locationType:    'phone',
  locationValue:   '',
  linkedCompanyId: '',
  linkedDealId:    '',
  agenda:          '',
};
