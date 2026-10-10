import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, ErrorState, Skeleton, Tabs, useToast } from '../../components/ui';
import { Amount, Banner, ConfirmDialog, ConfirmPreview, FormModal, Page, Pill, Progress, Section, StatusBadge, Tiles, useDo } from '../../components/payroll/kit';
import { PayslipsTab, PrepareTab, RosterTab, TotalsTab, ValidationsTab } from './RunTabs';
import { useAuth } from '../../lib/auth';
import { useResource } from '../../lib/hooks';
import { api } from '../../lib/api';
import { paths, send, titleCase, unwrap } from '../../lib/payrollApi';
import { periodOf } from './RunsPage';

const STAGES = ['inputs', 'calculating', 'review', 'approval', 'approved', 'locked', 'outputs', 'payment', 'closed'];
const RUNNING = ['calculating', 'validating'];
const LOCKED = ['locked', 'outputs', 'payment', 'closed'];

/** Polls /progress after a calculation is started until the run leaves the calculating states. */
function useProgress(uuid, status, active, onDone) {
  const [progress, setProgress] = useState(null);
  const done = useRef(onDone);
  done.current = onDone;
  const running = RUNNING.includes(status) || active;
  useEffect(() => {
    if (!running) return undefined;
    let live = true;
    let timer;
    let ticks = 0;
    const tick = async () => {
      ticks += 1;
      try {
        const p = unwrap(await api(paths.run(uuid, 'progress')));
        if (!live) return;
        setProgress(p);
        const stillRunning = RUNNING.includes(p.status) || (p.status === 'inputs' && ticks < 30);
        if (!stillRunning) {
          done.current();
          return;
        }
      } catch {
        if (!live || ticks > 60) return;
      }
      timer = setTimeout(tick, 2000);
    };
    tick();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [uuid, running]);
  return progress;
}

export default function RunDetailPage() {
  const { uuid } = useParams();
  const { can } = useAuth();
  const toast = useToast();
  const res = useResource(paths.run(uuid));
  const run = res.data ? unwrap(res.data) : null;
  const [tab, setTab] = useState('overview');
  const [polling, setPolling] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [inputs, setInputs] = useState(null);
  const { busy, run: act } = useDo();
  const progress = useProgress(uuid, run?.status, polling, () => {
    setPolling(false);
    res.reload();
  });

  const status = run?.status;
  const canRun = can('payroll.run');
  const locked = LOCKED.includes(status);
  const post = (key, part, ok, body = {}) => act(key, () => send('POST', paths.run(uuid, part), body), ok).then((r) => r && res.reload());

  async function calculate() {
    const r = await act('calc', () => send('POST', paths.run(uuid, 'calculate'), {}), 'Calculation started');
    if (r) setPolling(true);
  }
  async function collect() {
    const r = await act('collect', () => send('POST', paths.run(uuid, 'collect-inputs'), {}), 'Inputs collected');
    if (r && r !== true) setInputs(unwrap(r));
    if (r) res.reload();
  }

  const tabs = [
    ['overview', 'Overview'],
    ['roster', 'Roster'],
    ['validations', 'Validations'],
    ...(can('payroll.results.view') ? [['totals', 'Totals']] : []),
    ...(can('payroll.payslips.manage') ? [['payslips', 'Payslips']] : []),
    ...(can('payroll.payments.prepare') ? [['payments', 'Payments']] : []),
  ];

  return (
    <Page permission="payroll.view|payroll.run" title={run ? `Run: ${periodOf(run)}` : 'Payroll run'} description={run ? `${titleCase(run.run_type)} run${run.group_name ? ` for ${run.group_name}` : ''}` : undefined}>
      <p className="mt-0">
        <Link to="/payroll/runs" className="text-xs font-semibold text-brand-700 dark:text-brand-300">
          Back to runs
        </Link>
      </p>
      {res.loading ? (
        <Skeleton rows={3} />
      ) : res.error ? (
        <ErrorState error={res.error} onRetry={res.reload} />
      ) : (
        <>
          <Tabs items={tabs.map(([value, label]) => ({ value, label }))} value={tab} onChange={setTab} />
          <div className="pt-5">
            {tab === 'overview' && (
              <>
                <Card title="Status" className="mb-5">
                  <Section>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <StatusBadge value={status} />
                      {STAGES.map((s) => (
                        <Pill key={s}>{s === status ? `${titleCase(s)} (now)` : titleCase(s)}</Pill>
                      ))}
                    </div>
                    {(RUNNING.includes(status) || polling) && (
                      <div role="status" className="mb-3">
                        <Progress value={progress?.done ?? 0} max={progress?.total ?? 1} label="Calculation progress" />
                        <p className="m-0 mt-1 text-xs">
                          Calculating: {progress?.done ?? 0} of {progress?.total ?? '…'} employees{progress?.failed ? `, ${progress.failed} failed` : ''}
                        </p>
                      </div>
                    )}
                    {run.validation?.blocking > 0 && <Banner tone="error">{run.validation.blocking} blocking finding(s) must be fixed before this run can be submitted.</Banner>}
                    {inputs && (
                      <Banner tone={inputs.complete ? 'success' : 'warn'} title="Inputs collected">
                        {inputs.created} created, {inputs.updated} updated, {inputs.skipped} skipped.
                        {(inputs.warnings ?? []).map((w, i) => (
                          <span key={i} className="block">
                            {typeof w === 'string' ? w : w.message}
                          </span>
                        ))}
                      </Banner>
                    )}
                    {run.control_totals ? (
                      <Tiles
                        items={[
                          { label: 'Employees', value: run.control_totals.employee_count },
                          { label: 'Gross', value: <Amount value={run.control_totals.gross_total} currency={run.control_totals.currency} /> },
                          { label: 'Net', value: <Amount value={run.control_totals.net_total} currency={run.control_totals.currency} /> },
                          { label: 'Failed', value: run.control_totals.failed_count },
                        ]}
                      />
                    ) : (
                      <p className="text-xs text-slate-500">Control totals are hidden for your role.</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {canRun && ['inputs', 'review', 'reopened', 'readiness', 'validating'].includes(status) && (
                        <Button variant="secondary" loading={busy === 'collect'} onClick={collect}>
                          Collect inputs
                        </Button>
                      )}
                      {canRun && ['inputs', 'review', 'reopened', 'readiness'].includes(status) && (
                        <Button loading={busy === 'calc' || polling} onClick={calculate}>
                          {status === 'review' ? 'Recalculate' : 'Calculate'}
                        </Button>
                      )}
                      {canRun && status === 'review' && (
                        <Button loading={busy === 'submit'} onClick={() => post('submit', 'submit', 'Submitted for approval')}>
                          Submit for approval
                        </Button>
                      )}
                      {can('payroll.approve') && status === 'approval' && (
                        <>
                          <Button onClick={() => setDialog('approve')}>Approve</Button>
                          <Button variant="secondary" onClick={() => setDialog('reject')}>
                            Reject
                          </Button>
                        </>
                      )}
                      {can('payroll.lock') && status === 'approved' && <Button onClick={() => setDialog('lock')}>Lock run</Button>}
                      {can('payroll.unlock') && locked && <Button variant="secondary" onClick={() => setDialog('reopen')}>Request reopen</Button>}
                      {can('payroll.unlock.approve') && (run.reopen_requested || run.reopen_request) && <Button variant="secondary" onClick={() => setDialog('reopen-decision')}>Decide on reopen request</Button>}
                      {canRun && !locked && status !== 'cancelled' && status !== 'approved' && <Button variant="danger" onClick={() => setDialog('cancel')}>Cancel run</Button>}
                    </div>
                  </Section>
                </Card>
              </>
            )}
            {tab === 'roster' && <RosterTab run={run} canRun={canRun} locked={locked || status === 'approved'} />}
            {tab === 'validations' && <ValidationsTab run={run} canWaive={can('payroll.approve')} />}
            {tab === 'totals' && <TotalsTab run={run} />}
            {tab === 'payslips' && <PayslipsTab run={run} canManage={can('payroll.payslips.manage')} />}
            {tab === 'payments' && <PrepareTab run={run} canPrepare={can('payroll.payments.prepare')} />}
          </div>

          <ConfirmDialog
            open={dialog === 'approve'}
            onClose={() => setDialog(null)}
            title="Approve this run?"
            intro="You cannot approve a run you created or submitted. Approval allows the run to be locked."
            confirmLabel="Approve run"
            onConfirm={async () => {
              await send('POST', paths.run(uuid, 'approve'), {});
              toast('Run approved');
              res.reload();
            }}
          />
          <FormModal
            open={dialog === 'reject'}
            onClose={() => setDialog(null)}
            title="Reject this run"
            fields={[{ name: 'comment', label: 'Comment', textarea: true }]}
            submitLabel="Reject run"
            onSubmit={async (v) => {
              await send('POST', paths.run(uuid, 'reject'), { comment: v.comment });
              res.reload();
            }}
            success="Run rejected"
          />
          <ConfirmPreview
            open={dialog === 'lock'}
            onClose={() => setDialog(null)}
            title="Lock this run"
            intro="Locking verifies result checksums and freezes the run. Changes afterwards need an approved reopen."
            load={async () => {
              try {
                return unwrap(await api(paths.run(uuid, 'totals')));
              } catch (e) {
                if (e.status === 403) return { restricted: true };
                throw e;
              }
            }}
            blocked={(d) => (d.stored?.reconciled === false ? 'Totals do not reconcile. Resolve this before locking.' : null)}
            ack={() => 'I have reviewed the totals and want to lock this run'}
            confirmLabel="Lock run"
            onConfirm={async () => {
              await send('POST', paths.run(uuid, 'lock'), {});
              toast('Run locked');
              res.reload();
            }}
          >
            {(d) =>
              d.restricted ? (
                <p className="text-sm">Totals are hidden for your role. Locking still verifies them on the server.</p>
              ) : (
                <Tiles
                  items={[
                    { label: 'Employees', value: d.stored?.employees },
                    { label: 'Gross', value: <Amount value={d.stored?.gross} currency={d.stored?.currency} /> },
                    { label: 'Net pay', value: <Amount value={d.stored?.net} currency={d.stored?.currency} /> },
                    { label: 'Reconciled', value: d.stored?.reconciled === false ? 'No' : 'Yes' },
                  ]}
                />
              )
            }
          </ConfirmPreview>
          <FormModal
            open={dialog === 'reopen'}
            onClose={() => setDialog(null)}
            title="Request reopen"
            intro="A second person must approve the request before the run is reopened."
            fields={[{ name: 'reason', label: 'Reason (at least 10 characters)', textarea: true, minLength: 10 }]}
            submitLabel="Request reopen"
            onSubmit={async (v) => {
              await send('POST', paths.run(uuid, 'reopen-request'), { reason: v.reason });
              res.reload();
            }}
            success="Reopen requested"
          />
          <FormModal
            open={dialog === 'reopen-decision'}
            onClose={() => setDialog(null)}
            title="Decide on reopen request"
            intro="You cannot decide on a request you made."
            initial={{ decision: 'approved' }}
            fields={[
              { name: 'decision', label: 'Decision', options: [{ value: 'approved', label: 'Approve reopen' }, { value: 'rejected', label: 'Reject' }] },
              { name: 'comment', label: 'Comment', required: false, textarea: true },
            ]}
            onSubmit={async (v) => {
              await send('POST', paths.run(uuid, 'reopen-decision'), v);
              res.reload();
            }}
            success="Decision recorded"
          />
          <FormModal
            open={dialog === 'cancel'}
            onClose={() => setDialog(null)}
            title="Cancel this run"
            fields={[{ name: 'reason', label: 'Reason', textarea: true }]}
            submitLabel="Cancel run"
            onSubmit={async (v) => {
              await send('POST', paths.run(uuid, 'cancel'), { reason: v.reason });
              res.reload();
            }}
            success="Run cancelled"
          />
        </>
      )}
    </Page>
  );
}
