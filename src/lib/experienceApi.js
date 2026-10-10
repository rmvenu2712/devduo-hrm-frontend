export { listOf, pageOf, send, useList } from './timeOfficeApi';
export const E = '/v1/experience';
export const experiencePaths = {
  categories: `${E}/service-categories`,
  tickets: `${E}/tickets`,
  ticket: (uuid, part = '') => `${E}/tickets/${uuid}${part ? `/${part}` : ''}`,
};
export const EXPERIENCE_ACCESS = 'experience.self|experience.view|experience.ticket.manage';
