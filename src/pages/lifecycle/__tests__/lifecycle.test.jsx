import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

let perms = [];
vi.mock('../../../lib/auth', () => ({
  useAuth: () => ({ can: (p) => !p || p.split('|').some((k) => perms.includes(k)), enabled: () => true }),
}));
vi.mock('../../../lib/api', async (orig) => ({ ...(await orig()), api: vi.fn() }));
import { api } from '../../../lib/api';
import { ToastProvider } from '../../../components/ui';
import LifecycleLayout from '../LifecycleLayout';
import { MyTasksPage } from '../MyPages';
import MovesPage from '../MovesPage';
import { CaseDetailPage } from '../CasePages';
import { NAV, LIFECYCLE_ACCESS } from '../../../lib/lifecycleApi';
import { calls, mockApi } from '../../payroll/__tests__/helpers';

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const wrap = (ui, start) => (
  <ToastProvider>
    <MemoryRouter initialEntries={[start]}>{ui}</MemoryRouter>
  </ToastProvider>
);
const page = (rows) => ({ data: rows, current_page: 1, last_page: 1, total: rows.length });
const links = () => screen.queryAllByRole('link').map((l) => l.textContent);

describe('Lifecycle navigation', () => {
  const show = () =>
    render(
      <MemoryRouter initialEntries={['/lifecycle/x']}>
        <Routes>
          <Route path="lifecycle" element={<LifecycleLayout />}>
            <Route path="x" element={<p>child</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  it('shows only self sections to an employee', () => {
    perms = ['lifecycle.self'];
    show();
    expect(links()).toEqual(['My tasks', 'Exit interview']);
  });
  it('shows manager sections with their keys only', () => {
    perms = ['lifecycle.view', 'lifecycle.moves.approve'];
    show();
    expect(links()).toEqual(['Dashboard', 'Cases', 'Pre-joiners', 'Internal moves']);
  });
  it('renders nothing without a lifecycle key and the access list covers every key', () => {
    perms = ['people.view'];
    show();
    expect(links()).toHaveLength(0);
    NAV.forEach((n) => n.permission.split('|').forEach((k) => expect(LIFECYCLE_ACCESS.split('|')).toContain(k)));
  });
});

describe('My tasks', () => {
  it('completes a task through the dialog', async () => {
    perms = ['lifecycle.self'];
    const task = { uuid: 't1', title: 'Sign handbook', status: 'pending', due_date: '2026-10-12', mandatory: true };
    mockApi(api, { '/tasks/t1/complete': { uuid: 't1' }, '/me/tasks': page([task]) });
    render(wrap(<MyTasksPage />, '/'));
    fireEvent.click((await screen.findAllByRole('button', { name: 'Complete Sign handbook' }))[0]);
    const dialog = screen.getByRole('dialog');
    expect(calls(api, '/complete')).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mark done' }));
    await waitFor(() => expect(calls(api, '/complete')).toHaveLength(1));
    expect(calls(api, '/complete')[0][1].body).toMatchObject({ outcome: 'done' });
  });
});

describe('Internal moves', () => {
  const move = (extra = {}) => ({ uuid: 'm1', employee_name: 'Asha Rao', kind: 'transfer', status: 'pending', effective_date: '2026-11-01', can_decide: true, ...extra });
  const show = () => render(wrap(<MovesPage />, '/'));
  it('disables approval for the requester and explains why', async () => {
    perms = ['lifecycle.moves.approve'];
    mockApi(api, { '/moves': page([move({ can_decide: false })]), '/employees': page([]) });
    show();
    expect((await screen.findAllByText('Another approver is needed')).length).toBeGreaterThan(0);
    screen.getAllByRole('button', { name: 'Approve move for Asha Rao' }).forEach((b) => expect(b).toBeDisabled());
  });
  it('approves a move another user requested, after confirming', async () => {
    perms = ['lifecycle.moves.approve'];
    mockApi(api, { '/m1/decision': move({ status: 'approved' }), '/moves': page([move()]), '/employees': page([]) });
    show();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Approve move for Asha Rao' }))[0]);
    const dialog = screen.getByRole('dialog');
    expect(calls(api, '/decision')).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(calls(api, '/decision')).toHaveLength(1));
    expect(calls(api, '/decision')[0][1].body).toEqual({ decision: 'approve' });
  });
});

describe('Settlement', () => {
  const show = (cleared) => {
    perms = ['lifecycle.view', 'lifecycle.clearance.manage'];
    mockApi(api, {
      '/clearance': { cleared, departments: [], blockers: cleared ? [] : ['Laptop not returned'] },
      '/cases/c1': { uuid: 'c1', kind: 'offboarding', status: 'open', employee_name: 'Asha Rao', tasks: [], readiness: { percent: 50 } },
    });
    render(
      wrap(
        <Routes>
          <Route path="/lifecycle/cases/:uuid" element={<CaseDetailPage />} />
        </Routes>,
        '/lifecycle/cases/c1',
      ),
    );
  };
  it('stays disabled while clearance has blockers', async () => {
    show(false);
    expect(await screen.findByText('Laptop not returned')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Initiate settlement' })).toBeDisabled();
  });
  it('is enabled once cleared', async () => {
    show(true);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Initiate settlement' })).toBeEnabled());
  });
});
