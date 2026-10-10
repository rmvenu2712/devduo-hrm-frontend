import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

let permissions = [];
vi.mock('../../../lib/auth', () => ({ useAuth: () => ({ can: (key) => key.split('|').some((p) => permissions.includes(p)), enabled: () => true }) }));
vi.mock('../../../lib/api', async (load) => ({ ...(await load()), api: vi.fn() }));
import { api } from '../../../lib/api';
import { ToastProvider } from '../../../components/ui';
import { TicketDetailPage, TicketListPage } from '../ExperiencePages';
import { mockApi } from '../../payroll/__tests__/helpers';

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
});
