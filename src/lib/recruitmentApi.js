import { query } from './api';

/**
 * Recruitment API helpers (docs/api/recruitment.md). Every endpoint is named here, so a backend path change is a one-line edit.
 * Paths are relative to `/api`. Lists are Laravel paginators (`data`, `current_page`, `last_page`, `total`).
 */
export { listOf, pageOf, send, today, unwrap, useAction, useList, useLookup } from './timeOfficeApi';
export { query };

/** 'strong_yes' -> 'Strong yes'. */
export const titleCase = (s) => {
  const t = String(s ?? '').replace(/[_-]+/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export const R = '/v1/recruitment';
export const paths = {
  jobs: `${R}/jobs`,
  requisitions: `${R}/requisitions`,
  requisition: (uuid, part) => `${R}/requisitions/${uuid}/${part}`,
  postings: `${R}/postings`,
  posting: (uuid, part) => `${R}/postings/${uuid}/${part}`,
  candidates: `${R}/candidates`,
  anonymize: (uuid) => `${R}/candidates/${uuid}/anonymize`,
  applications: `${R}/applications`,
  transition: (uuid) => `${R}/applications/${uuid}/transition`,
  history: (uuid) => `${R}/applications/${uuid}/history`,
  interviews: `${R}/interviews`,
  interview: (uuid, part) => `${R}/interviews/${uuid}/${part}`,
  offers: `${R}/offers`,
  offer: (uuid, part) => `${R}/offers/${uuid}/${part}`,
  analytics: `${R}/analytics`,
  users: `${R}/users`,
};

export const STAGES = ['applied', 'screening', 'assessment', 'interview', 'offer'];

/** Section navigation. `permission` is an any-of list; the nav shows only what the user may open. */
export const NAV = [
  { to: '/recruitment/analytics', label: 'Analytics', permission: 'recruitment.reports.view' },
  { to: '/recruitment/requisitions', label: 'Requisitions', permission: 'recruitment.view' },
  { to: '/recruitment/postings', label: 'Job postings', permission: 'recruitment.view' },
  { to: '/recruitment/candidates', label: 'Candidates', permission: 'recruitment.view' },
  { to: '/recruitment/pipeline', label: 'Pipeline', permission: 'recruitment.view' },
  { to: '/recruitment/interviews', label: 'Interviews', permission: 'recruitment.view' },
  { to: '/recruitment/offers', label: 'Offers', permission: 'recruitment.offer.manage|recruitment.offer.approve' },
];
export const RECRUITMENT_ACCESS = [...new Set(NAV.flatMap((n) => n.permission.split('|')))].join('|');

export const newKey = () => globalThis.crypto.randomUUID();
/** Drops empty optional form values before sending. */
export const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== null && v !== undefined));
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—');

/** Loads every page of a list (capped) for views that group client-side, such as the pipeline board. */
export async function fetchAll(api, path, cap = 10) {
  const rows = [];
  let page = 1;
  let last = 1;
  do {
    const r = await api(`${path}${path.includes('?') ? '&' : '?'}page=${page}`);
    rows.push(...(Array.isArray(r?.data) ? r.data : []));
    last = r?.last_page ?? 1;
    page += 1;
  } while (page <= last && page <= cap);
  return rows;
}
