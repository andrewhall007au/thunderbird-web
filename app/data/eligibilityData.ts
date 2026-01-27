export interface Country {
  id: string
  name: string
}

export interface Carrier {
  id: string
  name: string
  countryId: string
}

export interface Destination {
  id: string
  name: string
  region: string
}

export interface ServiceAvailability {
  service: string
  status: 'live' | 'testing'
  note?: string
}

export interface EligibilityResult {
  eligible: boolean
  services: ServiceAvailability[]
  alternativeCarriers: Carrier[]
  countrySupported: boolean
}

export const countries: Country[] = [
  { id: 'us', name: 'United States' },
  { id: 'ca', name: 'Canada' },
  { id: 'uk', name: 'United Kingdom' },
  { id: 'fr', name: 'France' },
  { id: 'it', name: 'Italy' },
  { id: 'ch', name: 'Switzerland' },
  { id: 'nz', name: 'New Zealand' },
  { id: 'za', name: 'South Africa' },
  { id: 'jp', name: 'Japan' },
  { id: 'au', name: 'Australia' },
]

export const carriers: Carrier[] = [
  // USA
  { id: 'us-tmobile', name: 'T-Mobile', countryId: 'us' },
  { id: 'us-verizon', name: 'Verizon', countryId: 'us' },
  { id: 'us-att', name: 'AT&T', countryId: 'us' },
  { id: 'us-spectrum', name: 'Spectrum Mobile', countryId: 'us' },
  { id: 'us-xfinity', name: 'Xfinity Mobile', countryId: 'us' },
  { id: 'us-other', name: 'Other', countryId: 'us' },
  // Canada
  { id: 'ca-telus', name: 'Telus', countryId: 'ca' },
  { id: 'ca-rogers', name: 'Rogers', countryId: 'ca' },
  { id: 'ca-bell', name: 'Bell', countryId: 'ca' },
  { id: 'ca-other', name: 'Other', countryId: 'ca' },
  // UK
  { id: 'uk-vmo2', name: 'VMO2 (Virgin Media O2)', countryId: 'uk' },
  { id: 'uk-ee', name: 'EE', countryId: 'uk' },
  { id: 'uk-three', name: 'Three', countryId: 'uk' },
  { id: 'uk-vodafone', name: 'Vodafone', countryId: 'uk' },
  { id: 'uk-other', name: 'Other', countryId: 'uk' },
  // France
  { id: 'fr-orange', name: 'Orange', countryId: 'fr' },
  { id: 'fr-sfr', name: 'SFR', countryId: 'fr' },
  { id: 'fr-bouygues', name: 'Bouygues Telecom', countryId: 'fr' },
  { id: 'fr-free', name: 'Free Mobile', countryId: 'fr' },
  { id: 'fr-other', name: 'Other', countryId: 'fr' },
  // Italy
  { id: 'it-tim', name: 'TIM', countryId: 'it' },
  { id: 'it-vodafone', name: 'Vodafone', countryId: 'it' },
  { id: 'it-wind', name: 'WindTre', countryId: 'it' },
  { id: 'it-other', name: 'Other', countryId: 'it' },
  // Switzerland
  { id: 'ch-salt', name: 'Salt', countryId: 'ch' },
  { id: 'ch-swisscom', name: 'Swisscom', countryId: 'ch' },
  { id: 'ch-sunrise', name: 'Sunrise', countryId: 'ch' },
  { id: 'ch-other', name: 'Other', countryId: 'ch' },
  // New Zealand
  { id: 'nz-onenz', name: 'One NZ', countryId: 'nz' },
  { id: 'nz-spark', name: 'Spark', countryId: 'nz' },
  { id: 'nz-2degrees', name: '2degrees', countryId: 'nz' },
  { id: 'nz-other', name: 'Other', countryId: 'nz' },
  // South Africa
  { id: 'za-vodacom', name: 'Vodacom', countryId: 'za' },
  { id: 'za-mtn', name: 'MTN', countryId: 'za' },
  { id: 'za-cellc', name: 'Cell C', countryId: 'za' },
  { id: 'za-other', name: 'Other', countryId: 'za' },
  // Japan
  { id: 'jp-docomo', name: 'NTT Docomo', countryId: 'jp' },
  { id: 'jp-au', name: 'au (KDDI)', countryId: 'jp' },
  { id: 'jp-softbank', name: 'SoftBank', countryId: 'jp' },
  { id: 'jp-rakuten', name: 'Rakuten Mobile', countryId: 'jp' },
  { id: 'jp-other', name: 'Other', countryId: 'jp' },
  // Australia
  { id: 'au-telstra', name: 'Telstra', countryId: 'au' },
  { id: 'au-optus', name: 'Optus', countryId: 'au' },
  { id: 'au-vodafone', name: 'Vodafone', countryId: 'au' },
  { id: 'au-other', name: 'Other', countryId: 'au' },
]

export const destinations: Destination[] = [
  { id: 'pct', name: 'Pacific Crest Trail', region: 'USA West' },
  { id: 'at', name: 'Appalachian Trail', region: 'USA East' },
  { id: 'cdt', name: 'Continental Divide Trail', region: 'USA West' },
  { id: 'jmt', name: 'John Muir Trail', region: 'USA West' },
  { id: 'tmb', name: 'Tour du Mont Blanc', region: 'Europe' },
  { id: 'gr20', name: 'GR20 (Corsica)', region: 'Europe' },
  { id: 'west-highland', name: 'West Highland Way', region: 'UK' },
  { id: 'overland', name: 'Overland Track', region: 'Australia' },
  { id: 'milford', name: 'Milford Track', region: 'New Zealand' },
  { id: 'routeburn', name: 'Routeburn Track', region: 'New Zealand' },
  { id: 'western-arthurs', name: 'Western Arthurs', region: 'Australia' },
  { id: 'drakensberg', name: 'Drakensberg Grand Traverse', region: 'South Africa' },
  { id: 'haute-route', name: 'Haute Route', region: 'Europe' },
  { id: 'gdt', name: 'Great Divide Trail', region: 'Canada' },
  { id: 'other', name: 'Other / Not listed', region: '' },
]

// Eligibility rules: which country+carrier combos get which services
const eligibilityRules: Record<string, ServiceAvailability[]> = {
  // USA - Apple Satellite available for all carriers (iPhone 14+)
  // T-Mobile gets Starlink DTC
  // Verizon, Spectrum, Xfinity, T-Mobile get Samsung Skylo
  'us-tmobile': [
    { service: 'Apple Satellite', status: 'live', note: 'iPhone 14+ required' },
    { service: 'Starlink Direct to Cell', status: 'live' },
    { service: 'Samsung Skylo', status: 'live', note: 'Galaxy S25+ required' },
  ],
  'us-verizon': [
    { service: 'Apple Satellite', status: 'live', note: 'iPhone 14+ required' },
    { service: 'Samsung Skylo', status: 'live', note: 'Galaxy S25+ required' },
  ],
  'us-spectrum': [
    { service: 'Apple Satellite', status: 'live', note: 'iPhone 14+ required' },
    { service: 'Samsung Skylo', status: 'live', note: 'Galaxy S25+ required' },
  ],
  'us-xfinity': [
    { service: 'Apple Satellite', status: 'live', note: 'iPhone 14+ required' },
    { service: 'Samsung Skylo', status: 'live', note: 'Galaxy S25+ required' },
  ],
  'us-att': [
    { service: 'Apple Satellite', status: 'live', note: 'iPhone 14+ required' },
  ],
  'us-other': [
    { service: 'Apple Satellite', status: 'live', note: 'iPhone 14+ required' },
  ],
  // Canada
  'ca-telus': [
    { service: 'Apple Satellite', status: 'live', note: 'iPhone 14+ required' },
    { service: 'Samsung Skylo', status: 'live', note: 'Galaxy S25+ required' },
  ],
  'ca-rogers': [
    { service: 'Apple Satellite', status: 'live', note: 'iPhone 14+ required' },
    { service: 'Starlink Direct to Cell', status: 'testing', note: 'Coming soon' },
  ],
  'ca-bell': [
    { service: 'Apple Satellite', status: 'live', note: 'iPhone 14+ required' },
  ],
  'ca-other': [
    { service: 'Apple Satellite', status: 'live', note: 'iPhone 14+ required' },
  ],
  // Japan
  'jp-docomo': [
    { service: 'Apple Satellite', status: 'live', note: 'iPhone 14+ required' },
  ],
  'jp-au': [
    { service: 'Apple Satellite', status: 'live', note: 'iPhone 14+ required' },
  ],
  'jp-softbank': [
    { service: 'Apple Satellite', status: 'live', note: 'iPhone 14+ required' },
  ],
  'jp-rakuten': [
    { service: 'Apple Satellite', status: 'live', note: 'iPhone 14+ required' },
  ],
  'jp-other': [
    { service: 'Apple Satellite', status: 'live', note: 'iPhone 14+ required' },
  ],
  // Australia
  'au-telstra': [
    { service: 'Starlink Direct to Cell', status: 'live' },
  ],
  // New Zealand
  'nz-onenz': [
    { service: 'Starlink Direct to Cell', status: 'live' },
  ],
  // UK
  'uk-vmo2': [
    { service: 'Starlink Direct to Cell', status: 'testing', note: 'Coming soon' },
  ],
  // Switzerland
  'ch-salt': [
    { service: 'Starlink Direct to Cell', status: 'testing', note: 'Coming soon' },
  ],
}

// Countries that have at least one supported carrier
const supportedCountries = new Set(['us', 'ca', 'au', 'nz', 'uk', 'ch', 'jp'])

export function getCarriersForCountry(countryId: string): Carrier[] {
  return carriers.filter(c => c.countryId === countryId)
}

export function checkEligibility(countryId: string, carrierId: string): EligibilityResult {
  const services = eligibilityRules[carrierId] || []
  const countrySupported = supportedCountries.has(countryId)

  // Find alternative carriers in same country that have services
  const alternativeCarriers = carriers.filter(c =>
    c.countryId === countryId &&
    c.id !== carrierId &&
    (eligibilityRules[c.id]?.length ?? 0) > 0
  )

  return {
    eligible: services.length > 0,
    services,
    alternativeCarriers,
    countrySupported,
  }
}
