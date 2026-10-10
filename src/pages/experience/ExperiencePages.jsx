import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, ErrorState, PageHeader, Skeleton } from '../../components/ui';
import Access from '../../components/Access';
import { FormModal, StatusBadge, useDo } from '../../components/payroll/kit';
import { experiencePaths as paths, send, useList } from '../../lib/experienceApi';
import { useAuth } from '../../lib/auth';

function Page({ permission, title, description, action, children }) {
  return <Access permission={permission} module="experience"><PageHeader title={title} description={description} action={action} />{children}</Access>;
}

export function TicketListPage() {
  const { can } = useAuth();
  const [create, setCreate] = useState(false);
  const categories = useList(paths.categories);
  const list = useList(paths.tickets);
  const service = useDo();
  const employee = can('experience.self');
  const fields = [{ name: 'category_uuid', label: 'Request type', options: categories.rows.map((c) => ({ value: c.uuid, label: c.name })) },
    { name: 'subject', label: 'Subject' }, { name: 'description', label: 'Describe what you need', textarea: true }];
  return <Page permission="experience.self|experience.view|experience.ticket.manage" title={employee && !can('experience.view') ? 'My HR requests' : 'HR service desk'} description={employee && !can('experience.view') ? 'Create a request and follow updates from HR.' : 'Review service requests visible within your access scope.'} action={employee && <Button onClick={() => setCreate(true)}>New request</Button>}>
    {list.loading ? <Skeleton /> : list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : <div className="grid gap-3">
      {list.rows.map((ticket) => <Card key={ticket.uuid} title={<Link className="text-brand-700 underline dark:text-brand-300" to={`/experience/tickets/${ticket.uuid}`}>{ticket.subject}</Link>} action={<StatusBadge value={ticket.status} />}>
        <p className="m-0 text-xs text-slate-500">{ticket.category?.name} · {ticket.employee?.name} · {ticket.priority}</p>
      </Card>)}
      {!list.rows.length && <Card><p className="m-0 text-sm">No requests found.</p></Card>}
    </div>}
    <FormModal open={create} onClose={() => setCreate(false)} title="New HR request" intro="Only HR service staff can see internal notes added during handling." fields={fields} onSubmit={(data) => send('POST', paths.tickets, data)} success="Request submitted" />
  </Page>;
}

export function TicketDetailPage() {
  const { uuid } = useParams();
  const { can } = useAuth();
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState('public');
  const ticket = useList(paths.ticket(uuid));
  const actions = useDo();
  const data = ticket.data?.data ?? ticket.data;
  async function comment(event) {
    event.preventDefault();
    const saved = await actions.run('comment', () => send('POST', paths.ticket(uuid, 'comments'), { body, visibility }), 'Reply added');
    if (saved) { setBody(''); ticket.reload(); }
  }
  async function update(status) {
    const saved = await actions.run('status', () => send('PATCH', paths.ticket(uuid), { status }), `Request ${status.replace('_', ' ')}`);
    if (saved) ticket.reload();
  }
  return <Page permission="experience.self|experience.view|experience.ticket.manage" title={data?.subject ?? 'HR request'} description={data?.category?.name ?? 'Request details and conversation.'}>
    {ticket.loading ? <Skeleton /> : ticket.error ? <ErrorState error={ticket.error} onRetry={ticket.reload} /> : data && <>
      <Card className="mb-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="m-0 text-sm">Status: <StatusBadge value={data.status} /></p><p className="mb-0 mt-2 text-sm">{data.description}</p></div>{can('experience.ticket.manage') && <div className="flex gap-2">{data.status !== 'resolved' && data.status !== 'closed' && <Button variant="secondary" onClick={() => update('resolved')}>Resolve</Button>}{data.status === 'resolved' && <Button variant="secondary" onClick={() => update('closed')}>Close</Button>}</div>}</div></Card>
      <Card title="Conversation" className="mb-4"><div className="space-y-3">{(data.comments ?? []).map((item) => <article key={item.uuid} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"><div className="flex justify-between gap-2 text-xs"><strong>{item.author}</strong>{item.visibility === 'private' && <span className="text-amber-700">Internal HR note</span>}</div><p className="mb-0 mt-2 whitespace-pre-wrap text-sm">{item.body}</p></article>)}{!data.comments?.length && <p className="m-0 text-sm">No replies yet.</p>}</div></Card>
      {data.status !== 'closed' && <Card title={can('experience.ticket.manage') ? 'Add a reply or private note' : 'Add a reply'}><form className="space-y-3" onSubmit={comment}><textarea aria-label="Reply" required maxLength={10000} className="min-h-28 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={body} onChange={(e) => setBody(e.target.value)} />{can('experience.ticket.manage') && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={visibility === 'private'} onChange={(e) => setVisibility(e.target.checked ? 'private' : 'public')} />Internal note (visible to HR service staff only)</label>}<Button type="submit" disabled={Boolean(actions.busy)}>Send reply</Button></form></Card>}
    </>}
  </Page>;
}
