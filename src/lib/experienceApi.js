export { listOf, pageOf, send, useList } from './timeOfficeApi';
export const E = '/v1/experience';
export const experiencePaths = {
  categories: `${E}/service-categories`,
  tickets: `${E}/tickets`,
  ticket: (uuid, part = '') => `${E}/tickets/${uuid}${part ? `/${part}` : ''}`,
  knowledge: `${E}/knowledge`,
  article: (uuid, part = '') => `${E}/knowledge/${uuid}${part ? `/${part}` : ''}`,
  announcements: `${E}/announcements`,
  announcement: (uuid, part = '') => `${E}/announcements/${uuid}${part ? `/${part}` : ''}`,
  surveys: `${E}/surveys`,
  survey: (uuid, part = '') => `${E}/surveys/${uuid}${part ? `/${part}` : ''}`,
};
export const EXPERIENCE_ACCESS = 'experience.self|experience.view|experience.ticket.manage|experience.announcement.manage|experience.survey.manage';
