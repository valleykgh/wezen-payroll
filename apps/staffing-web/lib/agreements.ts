export const AGREEMENT_URLS = {
  CNA: '/agreements/cna-ica.pdf',
  LVN: '/agreements/lvn-ica.pdf',
  RN: '/agreements/rn-ica.pdf',
} as const;

export type AgreementRole = keyof typeof AGREEMENT_URLS;
