import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useResource } from '../../lib/hooks';
import { label, revealIdentity } from '../../lib/peopleApi';
import { Badge, Button, EmptyState, Modal, Resource, useToast } from '../ui';

const HIDE_AFTER_MS = 30000;

const IDENTITY = {
  kind: 'identity',
  title: 'Identity documents',
  heading: (r) => r.type_label || label(r.type),
  masked: (r) => r.number_masked,
  detail: (r) => [r.country, r.expiry_date && `Expires ${r.expiry_date}`].filter(Boolean).join(' · '),
  revealed: (r) => r.number,
};
const BANK = {
  kind: 'bank-accounts',
  title: 'Bank accounts',
  heading: (r) => `${r.bank_name} (${r.account_holder})`,
  masked: (r) => r.account_masked || `••••${r.account_last4 || ''}`,
  detail: (r) => [r.currency, r.is_primary && 'Primary', r.status].filter(Boolean).join(' · '),
  revealed: (r) =>
    Object.entries(r.details || {})
      .map(([k, v]) => `${label(k)}: ${v}`)
      .join(', '),
};

function SensitiveList({ uuid, config }) {
  const { can } = useAuth(),
    toast = useToast();
  const resource = useResource(`/v1/employees/${uuid}/${config.kind}`);
  const [confirm, setConfirm] = useState(null),
    [shown, setShown] = useState({}), // id -> plaintext
    [busy, setBusy] = useState(false);
  const timers = useRef({});
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);
  const hide = (id) => {
    clearTimeout(timers.current[id]);
    setShown((s) => {
      const { [id]: _removed, ...rest } = s;
      return rest;
    });
  };
  async function reveal() {
    setBusy(true);
    try {
      const result = await revealIdentity(uuid, confirm.uuid, config.kind);
      const id = confirm.uuid;
      setShown((s) => ({ ...s, [id]: config.revealed(result) }));
      timers.current[id] = setTimeout(() => hide(id), HIDE_AFTER_MS);
      setConfirm(null);
    } catch (e) {
      toast(e.message, 'error');
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Resource resource={resource}>
      {(data) => {
        const rows = data.data || [];
        return (
          <section aria-label={config.title} className="p-5">
            <h2 className="mb-4 mt-0 text-sm">{config.title}</h2>
            {rows.length === 0 ? (
              <EmptyState title={`No ${config.title.toLowerCase()}`} description="Nothing has been recorded." />
            ) : (
              <ul className="m-0 list-none divide-y divide-slate-100 p-0 dark:divide-slate-800">
                {rows.map((r) => (
                  <li key={r.uuid} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <strong className="block text-sm">{config.heading(r)}</strong>
                      <span className="break-all font-mono text-xs" aria-live="polite">
                        {shown[r.uuid] ?? config.masked(r)}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">{config.detail(r)}</span>
                      {r.verification_status && <Badge tone={r.verification_status === 'verified' ? 'green' : 'neutral'}>{r.verification_status}</Badge>}
                    </div>
                    {can('people.sensitive.reveal') &&
                      (shown[r.uuid] ? (
                        <Button variant="secondary" onClick={() => hide(r.uuid)}>
                          <EyeOff size={16} /> Hide
                        </Button>
                      ) : (
                        <Button variant="secondary" aria-label={`Reveal ${config.heading(r)}`} onClick={() => setConfirm(r)}>
                          <Eye size={16} /> Reveal
                        </Button>
                      ))}
                  </li>
                ))}
              </ul>
            )}
            <Modal open={Boolean(confirm)} onClose={() => setConfirm(null)} title="Reveal sensitive information?">
              <p>
                This shows the full value of {confirm && config.heading(confirm)}. The access is recorded in the audit log, and the
                value is hidden again after 30 seconds.
              </p>
              <div className="mt-6 flex justify-end gap-2.5">
                <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
                <Button onClick={reveal} loading={busy}>Reveal</Button>
              </div>
            </Modal>
          </section>
        );
      }}
    </Resource>
  );
}

export default function SensitivePanel({ uuid, sections }) {
  return (
    <>
      {sections.includes('identity') && <SensitiveList uuid={uuid} config={IDENTITY} />}
      {sections.includes('bank') && <SensitiveList uuid={uuid} config={BANK} />}
    </>
  );
}
