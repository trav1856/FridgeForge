// Client-safe option lists + validation for private, optional demographics.

export const CONSENT_TEXT =
  "We may share or sell anonymized, aggregated insights (never your name, email, or anything that identifies you) with partners for scientific and marketing research.";

/** Minimum group size for any reported cell or group (k-anonymity). */
export const K_ANON = 20;
/** Minimum age to be included in research reports. */
export const RESEARCH_MIN_AGE = 16;

export const SEX_OPTIONS = [
  { id: "male", label: "Male" },
  { id: "female", label: "Female" },
] as const;

/** Broad heritage list (self-identified, multi-select). */
export const ETHNICITIES = [
  { id: "african-american", label: "African American / Black" },
  { id: "african", label: "African" },
  { id: "caribbean", label: "Caribbean" },
  { id: "mexican", label: "Mexican" },
  { id: "central-american", label: "Central American" },
  { id: "south-american", label: "South American" },
  { id: "puerto-rican", label: "Puerto Rican" },
  { id: "cuban", label: "Cuban" },
  { id: "native-american", label: "Native American / Alaska Native" },
  { id: "pacific-islander", label: "Native Hawaiian / Pacific Islander" },
  { id: "english", label: "English / British" },
  { id: "irish", label: "Irish" },
  { id: "scottish", label: "Scottish" },
  { id: "german", label: "German" },
  { id: "french", label: "French" },
  { id: "italian", label: "Italian" },
  { id: "spanish", label: "Spanish" },
  { id: "portuguese", label: "Portuguese" },
  { id: "greek", label: "Greek" },
  { id: "scandinavian", label: "Scandinavian" },
  { id: "dutch", label: "Dutch" },
  { id: "polish", label: "Polish" },
  { id: "eastern-european", label: "Eastern European" },
  { id: "jewish", label: "Jewish" },
  { id: "arab", label: "Arab" },
  { id: "persian", label: "Persian / Iranian" },
  { id: "turkish", label: "Turkish" },
  { id: "armenian", label: "Armenian" },
  { id: "south-asian", label: "Indian / South Asian" },
  { id: "chinese", label: "Chinese" },
  { id: "japanese", label: "Japanese" },
  { id: "korean", label: "Korean" },
  { id: "filipino", label: "Filipino" },
  { id: "vietnamese", label: "Vietnamese" },
  { id: "southeast-asian", label: "Other Southeast Asian" },
  { id: "central-asian", label: "Central Asian" },
  { id: "other", label: "Other" },
] as const;

export const REGIONS = [
  "North America", "Latin America & Caribbean", "Europe", "Middle East & North Africa",
  "Sub-Saharan Africa", "South Asia", "East Asia", "Southeast Asia", "Central Asia", "Oceania",
] as const;
export type Region = (typeof REGIONS)[number];

/** Family-origin countries (ISO alpha-2) with a broad world region. */
export const COUNTRIES: { code: string; name: string; region: Region }[] = [
  ["US", "United States", "North America"], ["CA", "Canada", "North America"],
  ["MX", "Mexico", "Latin America & Caribbean"], ["GT", "Guatemala", "Latin America & Caribbean"], ["SV", "El Salvador", "Latin America & Caribbean"],
  ["HN", "Honduras", "Latin America & Caribbean"], ["NI", "Nicaragua", "Latin America & Caribbean"], ["CR", "Costa Rica", "Latin America & Caribbean"],
  ["PA", "Panama", "Latin America & Caribbean"], ["CU", "Cuba", "Latin America & Caribbean"], ["DO", "Dominican Republic", "Latin America & Caribbean"],
  ["PR", "Puerto Rico", "Latin America & Caribbean"], ["HT", "Haiti", "Latin America & Caribbean"], ["JM", "Jamaica", "Latin America & Caribbean"],
  ["TT", "Trinidad and Tobago", "Latin America & Caribbean"], ["CO", "Colombia", "Latin America & Caribbean"], ["VE", "Venezuela", "Latin America & Caribbean"],
  ["EC", "Ecuador", "Latin America & Caribbean"], ["PE", "Peru", "Latin America & Caribbean"], ["BO", "Bolivia", "Latin America & Caribbean"],
  ["CL", "Chile", "Latin America & Caribbean"], ["AR", "Argentina", "Latin America & Caribbean"], ["UY", "Uruguay", "Latin America & Caribbean"],
  ["PY", "Paraguay", "Latin America & Caribbean"], ["BR", "Brazil", "Latin America & Caribbean"],
  ["GB", "United Kingdom", "Europe"], ["IE", "Ireland", "Europe"], ["FR", "France", "Europe"], ["DE", "Germany", "Europe"], ["IT", "Italy", "Europe"],
  ["ES", "Spain", "Europe"], ["PT", "Portugal", "Europe"], ["NL", "Netherlands", "Europe"], ["BE", "Belgium", "Europe"], ["CH", "Switzerland", "Europe"],
  ["AT", "Austria", "Europe"], ["GR", "Greece", "Europe"], ["SE", "Sweden", "Europe"], ["NO", "Norway", "Europe"], ["DK", "Denmark", "Europe"],
  ["FI", "Finland", "Europe"], ["IS", "Iceland", "Europe"], ["PL", "Poland", "Europe"], ["CZ", "Czechia", "Europe"], ["SK", "Slovakia", "Europe"],
  ["HU", "Hungary", "Europe"], ["RO", "Romania", "Europe"], ["BG", "Bulgaria", "Europe"], ["RS", "Serbia", "Europe"], ["HR", "Croatia", "Europe"],
  ["BA", "Bosnia and Herzegovina", "Europe"], ["AL", "Albania", "Europe"], ["UA", "Ukraine", "Europe"], ["BY", "Belarus", "Europe"], ["RU", "Russia", "Europe"],
  ["LT", "Lithuania", "Europe"], ["LV", "Latvia", "Europe"], ["EE", "Estonia", "Europe"], ["AM", "Armenia", "Europe"], ["GE", "Georgia", "Europe"],
  ["TR", "Turkey", "Middle East & North Africa"], ["IL", "Israel", "Middle East & North Africa"], ["PS", "Palestine", "Middle East & North Africa"],
  ["LB", "Lebanon", "Middle East & North Africa"], ["SY", "Syria", "Middle East & North Africa"], ["JO", "Jordan", "Middle East & North Africa"],
  ["IQ", "Iraq", "Middle East & North Africa"], ["IR", "Iran", "Middle East & North Africa"], ["SA", "Saudi Arabia", "Middle East & North Africa"],
  ["YE", "Yemen", "Middle East & North Africa"], ["AE", "United Arab Emirates", "Middle East & North Africa"], ["EG", "Egypt", "Middle East & North Africa"],
  ["LY", "Libya", "Middle East & North Africa"], ["TN", "Tunisia", "Middle East & North Africa"], ["DZ", "Algeria", "Middle East & North Africa"],
  ["MA", "Morocco", "Middle East & North Africa"],
  ["NG", "Nigeria", "Sub-Saharan Africa"], ["GH", "Ghana", "Sub-Saharan Africa"], ["SN", "Senegal", "Sub-Saharan Africa"], ["CI", "Côte d'Ivoire", "Sub-Saharan Africa"],
  ["CM", "Cameroon", "Sub-Saharan Africa"], ["ET", "Ethiopia", "Sub-Saharan Africa"], ["ER", "Eritrea", "Sub-Saharan Africa"], ["SO", "Somalia", "Sub-Saharan Africa"],
  ["KE", "Kenya", "Sub-Saharan Africa"], ["TZ", "Tanzania", "Sub-Saharan Africa"], ["UG", "Uganda", "Sub-Saharan Africa"], ["CD", "DR Congo", "Sub-Saharan Africa"],
  ["AO", "Angola", "Sub-Saharan Africa"], ["ZA", "South Africa", "Sub-Saharan Africa"], ["ZW", "Zimbabwe", "Sub-Saharan Africa"], ["SD", "Sudan", "Sub-Saharan Africa"],
  ["IN", "India", "South Asia"], ["PK", "Pakistan", "South Asia"], ["BD", "Bangladesh", "South Asia"], ["LK", "Sri Lanka", "South Asia"], ["NP", "Nepal", "South Asia"],
  ["AF", "Afghanistan", "South Asia"],
  ["CN", "China", "East Asia"], ["TW", "Taiwan", "East Asia"], ["HK", "Hong Kong", "East Asia"], ["JP", "Japan", "East Asia"], ["KR", "South Korea", "East Asia"],
  ["MN", "Mongolia", "East Asia"],
  ["PH", "Philippines", "Southeast Asia"], ["VN", "Vietnam", "Southeast Asia"], ["TH", "Thailand", "Southeast Asia"], ["KH", "Cambodia", "Southeast Asia"],
  ["LA", "Laos", "Southeast Asia"], ["MM", "Myanmar", "Southeast Asia"], ["MY", "Malaysia", "Southeast Asia"], ["SG", "Singapore", "Southeast Asia"],
  ["ID", "Indonesia", "Southeast Asia"],
  ["KZ", "Kazakhstan", "Central Asia"], ["UZ", "Uzbekistan", "Central Asia"], ["KG", "Kyrgyzstan", "Central Asia"], ["TJ", "Tajikistan", "Central Asia"],
  ["TM", "Turkmenistan", "Central Asia"],
  ["AU", "Australia", "Oceania"], ["NZ", "New Zealand", "Oceania"], ["FJ", "Fiji", "Oceania"], ["WS", "Samoa", "Oceania"], ["TO", "Tonga", "Oceania"],
].map(([code, name, region]) => ({ code: code!, name: name!, region: region as Region }));

const ETH_IDS = new Set<string>(ETHNICITIES.map((e) => e.id));
const COUNTRY_BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));
export const ethnicityLabel = (id: string) => ETHNICITIES.find((e) => e.id === id)?.label ?? id;
export const countryName = (code: string) => COUNTRY_BY_CODE.get(code)?.name ?? code;
export const regionForCountry = (code: string): Region | null => COUNTRY_BY_CODE.get(code)?.region ?? null;

export function cleanSex(v: unknown): "male" | "female" | null {
  return v === "male" || v === "female" ? v : null;
}
export function cleanEthnicities(v: unknown): string[] {
  const arr = Array.isArray(v) ? v : [];
  return [...new Set(arr.filter((x): x is string => typeof x === "string" && ETH_IDS.has(x)))].sort();
}
export function cleanCountries(v: unknown): string[] {
  const arr = Array.isArray(v) ? v : [];
  return [...new Set(arr.filter((x): x is string => typeof x === "string" && COUNTRY_BY_CODE.has(x)))].sort().slice(0, 12);
}
export function parseList(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[];
  try {
    const a = JSON.parse(String(v ?? "[]"));
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

/** Research inclusion rule (pure). */
export function isResearchEligible(d: { researchConsent: boolean; age16ConfirmedAt: Date | string | null } | null | undefined): boolean {
  return Boolean(d && d.researchConsent && d.age16ConfirmedAt);
}
