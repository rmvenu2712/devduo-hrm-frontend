import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

let permissions = [];
vi.mock('../../../lib/auth', () => ({ useAuth: () => ({ can: (key) => key.split('|').some((p) => permissions.includes(p)), enabled: () => true }) }));
vi.mock('../../../lib/api', async (load) => ({ ...(await load()), api: vi.fn() }));
import { api } from '../../../lib/api';
import { ToastProvider } from '../../../components/ui';
import { AnnouncementsPage, KnowledgePage, SurveysPage, TicketDetailPage, TicketListPage } from '../ExperiencePages';
import { calls, mockApi } from '../../payroll/__tests__/helpers';

afterEach(() => { cleanup(); vi.resetAllMocks(); });
const wrap = (ui, path = '/') => <ToastProvider><MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter></ToastProvider>;

describe('HR helpdesk', () => {
  it('lists employee requests without exposing HR-only notes', async () => {
    permissions = ['experience.self'];
    mockApi(api, {
      '/tickets/t1': { uuid: 't1', subject: 'Payslip question', category: { name: 'Payroll' }, status: 'open', description: 'Need help', comments: [{ uuid: 'c1', author: 'HR', body: 'Public update', visibility: 'public' }] },
    });
    render(wrap(<Routes><Route path="/experience/tickets/:uuid" element={<TicketDetailPage />} /></Routes>, '/experience/tickets/t1'));
    expect(await screen.findByText('Public update')).toBeInTheDocument();
    expect(screen.queryByText('Internal note (visible to HR service staff only)')).not.toBeInTheDocument();
  });

  it('shows private notes and the private-note control only to HR ticket managers', async () => {
    permissions = ['experience.ticket.manage'];
    mockApi(api, {
      '/tickets/t1': { uuid: 't1', subject: 'Payslip question', category: { name: 'Payroll' }, status: 'open', description: 'Need help', comments: [{ uuid: 'c1', author: 'HR', body: 'Internal investigation', visibility: 'private' }] },
    });
    render(wrap(<Routes><Route path="/experience/tickets/:uuid" element={<TicketDetailPage />} /></Routes>, '/experience/tickets/t1'));
    expect(await screen.findByText('Internal investigation')).toBeInTheDocument();
    expect(screen.getByText('Internal HR note')).toBeInTheDocument();
    expect(screen.getByLabelText('Internal note (visible to HR service staff only)')).toBeInTheDocument();
  });

  it('shows the employee request list and new request action', async () => {
    permissions = ['experience.self'];
    mockApi(api, { '/tickets': { data: [{ uuid: 't1', subject: 'Payslip question', category: { name: 'Payroll' }, status: 'open', employee: { name: 'Asha Rao' } }] } });
    render(wrap(<TicketListPage />));
    expect(await screen.findByText('Payslip question')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New request' })).toBeInTheDocument();
  });

  it('renders searchable published guidance', async () => {
    permissions = ['experience.self'];
    mockApi(api, { '/knowledge': { data: [{ uuid: 'a1', title: 'Payroll dates', summary: 'When payroll is processed', locale: 'en', version: 2, status: 'published', visibility: 'employee' }] } });
    render(wrap(<KnowledgePage />));
    expect(await screen.findByText('Payroll dates')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search articles'), { target: { value: 'payroll' } });
  });

  it('suggests relevant knowledge articles while an employee writes a ticket', async () => {
    permissions = ['experience.self'];
    mockApi(api, {
      '/service-categories': [{ uuid: 'cat1', name: 'Payroll' }],
      '/tickets': { data: [] },
      '/knowledge': { data: [{ uuid: 'a1', title: 'Payslip help', summary: 'Find your payslip' }] },
    });
    render(wrap(<TicketListPage />));
    fireEvent.click(await screen.findByRole('button', { name: 'New request' }));
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Payslip access issue' } });
    expect(await screen.findByRole('link', { name: 'Payslip help' })).toHaveAttribute('href', '/experience/knowledge/a1');
  });

  it('lets employees mark an announcement read and acknowledge it', async () => {
    permissions = ['experience.self'];
    mockApi(api, {
      '/announcements/notice1/read': { uuid: 'notice1', read_at: '2026-10-10T10:00:00Z' },
      '/announcements/notice1/acknowledge': { uuid: 'notice1', read_at: '2026-10-10T10:00:00Z', acknowledged_at: '2026-10-10T10:02:00Z' },
      '/announcements': { data: [{ uuid: 'notice1', title: 'Benefits enrollment', body: 'Please review the plans.', status: 'published', acknowledgment_required: true, publish_at: '2026-10-10', read_at: null, acknowledged_at: null }] },
    });
    render(wrap(<AnnouncementsPage />));
    expect(await screen.findByText('Benefits enrollment')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
    await screen.findByRole('button', { name: 'Acknowledge' });
    expect(calls(api, '/announcements/notice1/read')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Acknowledge' }));
    await screen.findByRole('button', { name: 'Acknowledge' });
    expect(calls(api, '/announcements/notice1/acknowledge')).toHaveLength(1);
  });

  it('submits anonymous rating survey answers without showing identity', async () => {
    permissions = ['experience.self'];
    mockApi(api, {
      '/surveys/s1/responses': { submitted: true },
      '/surveys': { data: [{ uuid: 's1', title: 'Team pulse', status: 'published', submitted: false, questions: [{ uuid: 'q1', prompt: 'Is workload manageable?', kind: 'rating', scale: [1, 2, 3, 4, 5] }] }] },
    });
    render(wrap(<SurveysPage />));
    expect(await screen.findByText('Team pulse')).toBeInTheDocument();
    expect(screen.getByText(/Anonymous survey/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Is workload manageable?'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit anonymous response' }));
    await screen.findByRole('button', { name: 'Submit anonymous response' });
    expect(calls(api, '/surveys/s1/responses')).toHaveLength(1);
  });
});
