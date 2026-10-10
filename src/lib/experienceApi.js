export { listOf, pageOf, send, useList } from './timeOfficeApi';
export const E = '/v1/experience';
export const experiencePaths = {
  categories: `${E}/service-categories`,
  health: `${E}/service-health`,
  tickets: `${E}/tickets`,
  ticketAssignees: `${E}/tickets/assignees`,
  ticket: (uuid, part = '') => `${E}/tickets/${uuid}${part ? `/${part}` : ''}`,
  knowledge: `${E}/knowledge`,
  article: (uuid, part = '') => `${E}/knowledge/${uuid}${part ? `/${part}` : ''}`,
  announcements: `${E}/announcements`,
  announcementAudienceOptions: `${E}/announcements/audience-options`,
  announcement: (uuid, part = '') => `${E}/announcements/${uuid}${part ? `/${part}` : ''}`,
  surveys: `${E}/surveys`,
  surveyAudienceOptions: `${E}/surveys/audience-options`,
  survey: (uuid, part = '') => `${E}/surveys/${uuid}${part ? `/${part}` : ''}`,
  recognitions: `${E}/recognitions`,
  recognition: (uuid, part = '') => `${E}/recognitions/${uuid}${part ? `/${part}` : ''}`,
};
export const EXPERIENCE_ACCESS = 'experience.self|experience.view|experience.ticket.manage|experience.announcement.manage|experience.survey.manage|experience.recognition.manage';
