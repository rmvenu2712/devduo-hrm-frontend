import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, ErrorState, PageHeader, Skeleton } from '../../components/ui';
import Access from '../../components/Access';
import { FormModal, StatusBadge, useDo } from '../../components/payroll/kit';
import { experiencePaths as paths, send, useList } from '../../lib/experienceApi';
import { useAuth } from '../../lib/auth';

function Page({ permission, title, description, action, children }) {
  return <Access permission={permission} module="experience"><PageHeader title={title} description={description} action={action} />{children}</Access>;
}

function ArticleSuggestions({ values }) {
  const search = [values.subject, values.description].filter(Boolean).join(' ');
  const list = useList(`${paths.knowledge}?search=${encodeURIComponent(search)}&per_page=4`);
  if (search.trim().length < 4 || !list.rows.length) return null;
  return <div className="mb-3 rounded-lg bg-brand-50 p-3 dark:bg-brand-950"><p className="mb-2 text-xs font-semibold">These articles may help</p><ul className="m-0 list-disc pl-5 text-xs">{list.rows.map((a) => <li key={a.uuid}><Link to={`/experience/knowledge/${a.uuid}`} className="underline">{a.title}</Link></li>)}</ul></div>;
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
    <FormModal open={create} onClose={() => setCreate(false)} title="New HR request" intro="Only HR service staff can see internal notes added during handling." fields={fields} extra={(values) => <ArticleSuggestions values={values} />} onSubmit={(data) => send('POST', paths.tickets, data)} success="Request submitted" />
  </Page>;
}

export function KnowledgePage() {
  const { can } = useAuth();
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [create, setCreate] = useState(false);
  const list = useList(`${paths.knowledge}?search=${encodeURIComponent(term)}&per_page=50`);
  const actions = useDo();
  useEffect(() => { const timer = setTimeout(() => setTerm(query), 250); return () => clearTimeout(timer); }, [query]);
  return <Page permission="experience.self|experience.view|experience.ticket.manage|experience.knowledge.manage" title="HR knowledge base" description="Search current HR guidance and service articles." action={can('experience.knowledge.manage') && <Button onClick={() => setCreate(true)}>Create article</Button>}>
    <label className="mb-5 block max-w-xl text-xs">Search articles<input aria-label="Search articles" className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a policy or question" /></label>
    {list.loading ? <Skeleton /> : list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : <div className="grid gap-3 md:grid-cols-2">
      {list.rows.map((article) => <Card key={article.uuid} title={<Link className="text-brand-700 underline dark:text-brand-300" to={`/experience/knowledge/${article.uuid}`}>{article.title}</Link>} action={<StatusBadge value={article.status} />}>
        <p className="m-0 text-sm text-slate-600 dark:text-slate-300">{article.summary}</p><p className="mb-0 mt-2 text-xs text-slate-500">{article.locale} · v{article.version}{article.visibility === 'hr' ? ' · HR only' : ''}</p>
        {can('experience.knowledge.manage') && article.status === 'draft' && <Button className="mt-3" variant="secondary" disabled={Boolean(actions.busy)} onClick={async () => { const r = await actions.run('publish', () => send('POST', paths.article(article.uuid, 'publish'), {}), 'Article published'); if (r) list.reload(); }}>Publish</Button>}
      </Card>)}
      {!list.rows.length && <Card><p className="m-0 text-sm">No matching articles.</p></Card>}
    </div>}
    <FormModal open={create} onClose={() => setCreate(false)} title="Create knowledge article" intro="Each saved article is a new draft version. Publish when it is ready." fields={[
      { name: 'locale', label: 'Locale', initial: 'en' }, { name: 'title', label: 'Title' }, { name: 'summary', label: 'Short summary', required: false },
      { name: 'body', label: 'Article content', textarea: true }, { name: 'visibility', label: 'Visibility', options: [{ value: 'employee', label: 'Employees' }, { value: 'hr', label: 'HR only' }] },
    ]} initial={{ locale: 'en', visibility: 'employee' }} onSubmit={(v) => send('POST', paths.knowledge, { ...v, locale: v.locale || 'en' })} success="Draft article created" />
  </Page>;
}

export function KnowledgeArticlePage() {
  const { uuid } = useParams();
  const { can } = useAuth();
  const article = useList(paths.article(uuid));
  const data = article.data?.data ?? article.data;
  return <Page permission="experience.self|experience.view|experience.ticket.manage|experience.knowledge.manage" title={data?.title ?? 'HR article'} description={data?.summary ?? 'Current HR guidance.'}>
    {article.loading ? <Skeleton /> : article.error ? <ErrorState error={article.error} onRetry={article.reload} /> : data && <Card title={`${data.title} · v${data.version}`} action={<StatusBadge value={data.status} />}>
      <p className="m-0 whitespace-pre-wrap text-sm leading-6">{data.body}</p>
      <p className="mb-0 mt-5 text-xs text-slate-500">{data.locale}{data.effective_from ? ` · Effective ${data.effective_from}` : ''}{data.visibility === 'hr' ? ' · HR only' : ''}</p>
      {can('experience.ticket.manage') && <p className="mb-0 mt-4 text-xs"><Link className="underline" to="/experience">Open the service desk</Link></p>}
    </Card>}
  </Page>;
}

export function AnnouncementsPage() {
  const { can } = useAuth();
  const [create, setCreate] = useState(false);
  const list = useList(`${paths.announcements}?per_page=50`);
  const actions = useDo();
  async function track(item, action) {
    const result = await actions.run(action, () => send('POST', paths.announcement(item.uuid, action), {}), action === 'acknowledge' ? 'Acknowledgment recorded' : 'Announcement marked as read');
    if (result) list.reload();
  }
  return <Page permission="experience.self|experience.view|experience.ticket.manage|experience.announcement.manage" title="Employee announcements" description="Company updates and notices requiring acknowledgment." action={can('experience.announcement.manage') && <Button onClick={() => setCreate(true)}>Create announcement</Button>}>
    {list.loading ? <Skeleton /> : list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : <div className="grid gap-3">
      {list.rows.map((item) => <Card key={item.uuid} title={item.title} action={<StatusBadge value={item.status} />}>
        <p className="whitespace-pre-wrap text-sm leading-6">{item.body}</p>
        <p className="text-xs text-slate-500">{item.publish_at ? `Published ${item.publish_at}` : 'Draft'}{item.acknowledgment_required ? ' · Acknowledgment required' : ''}</p>
        {item.status === 'published' && !item.read_at && <Button variant="secondary" disabled={Boolean(actions.busy)} onClick={() => track(item, 'read')}>Mark as read</Button>}
        {item.status === 'published' && item.acknowledgment_required && !item.acknowledged_at && <Button className="ml-2" disabled={Boolean(actions.busy)} onClick={() => track(item, 'acknowledge')}>Acknowledge</Button>}
        {item.read_at && <p className="mb-0 text-xs text-emerald-700">{item.acknowledged_at ? 'Acknowledged' : 'Read'}</p>}
        {can('experience.announcement.manage') && item.status === 'draft' && <Button variant="secondary" disabled={Boolean(actions.busy)} onClick={async () => { const result = await actions.run('publish', () => send('POST', paths.announcement(item.uuid, 'publish'), {}), 'Announcement published'); if (result) list.reload(); }}>Publish</Button>}
      </Card>)}
      {!list.rows.length && <Card><p className="m-0 text-sm">No announcements yet.</p></Card>}
    </div>}
    <FormModal open={create} onClose={() => setCreate(false)} title="Create announcement" intro="Save a draft, then publish it when it is ready." fields={[
      { name: 'title', label: 'Title' }, { name: 'body', label: 'Announcement', textarea: true },
      { name: 'publish_at', label: 'Publish date', type: 'date', required: false }, { name: 'acknowledgment_required', label: 'Require employee acknowledgment', type: 'checkbox' },
    ]} initial={{ acknowledgment_required: false }} onSubmit={(v) => send('POST', paths.announcements, { ...v, acknowledgment_required: Boolean(v.acknowledgment_required), publish_at: v.publish_at || null })} success="Draft announcement created" />
  </Page>;
}

export function SurveysPage() {
  const { can } = useAuth();
  const [create, setCreate] = useState(false);
  const [answers, setAnswers] = useState({});
  const list = useList(`${paths.surveys}?per_page=50`);
  const actions = useDo();
  async function submit(survey) {
    const result = await actions.run(survey.uuid, () => send('POST', paths.survey(survey.uuid, 'responses'), { answers: answers[survey.uuid] ?? {} }), 'Anonymous response submitted');
    if (result) { setAnswers((all) => ({ ...all, [survey.uuid]: {} })); list.reload(); }
  }
  return <Page permission="experience.self|experience.view|experience.ticket.manage|experience.survey.manage" title="Employee surveys" description="Share feedback through anonymous rating surveys. Individual answers are never shown.
    Results stay hidden until the response threshold is reached." action={can('experience.survey.manage') && <Button onClick={() => setCreate(true)}>Create survey</Button>}>
    {list.loading ? <Skeleton /> : list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : <div className="grid gap-3">
      {list.rows.map((survey) => <Card key={survey.uuid} title={survey.title} action={<StatusBadge value={survey.status} />}>
        {survey.description && <p className="text-sm">{survey.description}</p>}
        {survey.status === 'published' && !survey.submitted && <form onSubmit={(e) => { e.preventDefault(); submit(survey); }} className="space-y-4">
          <p className="text-xs text-slate-500">Anonymous survey · results are suppressed until at least five people respond. We store completion separately to prevent duplicate submissions.</p>
          {survey.questions.map((question) => <label key={question.uuid} className="block text-sm">{question.prompt}<select required aria-label={question.prompt} className="mt-1 block min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900" value={answers[survey.uuid]?.[question.uuid] ?? ''} onChange={(e) => setAnswers((all) => ({ ...all, [survey.uuid]: { ...all[survey.uuid], [question.uuid]: Number(e.target.value) } }))}><option value="">Choose a rating</option>{question.scale.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>)}
          <Button type="submit" disabled={Boolean(actions.busy)}>Submit anonymous response</Button>
        </form>}
        {survey.submitted && <p className="mb-0 text-sm text-emerald-700">Your anonymous response has been recorded.</p>}
        {can('experience.survey.manage') && survey.status === 'draft' && <Button variant="secondary" onClick={async () => { const result = await actions.run('publish', () => send('POST', paths.survey(survey.uuid, 'publish'), {}), 'Survey published'); if (result) list.reload(); }}>Publish</Button>}
        {can('experience.survey.manage') && survey.status === 'published' && <p className="mb-0 mt-3 text-xs"><Link to={`/experience/surveys/${survey.uuid}/results`} className="underline">View thresholded results</Link></p>}
      </Card>)}
      {!list.rows.length && <Card><p className="m-0 text-sm">No surveys are available.</p></Card>}
    </div>}
    <FormModal open={create} onClose={() => setCreate(false)} title="Create anonymous survey" intro="Only 1–5 rating questions are supported in this privacy-focused survey slice. Add one prompt per line." fields={[
      { name: 'title', label: 'Title' }, { name: 'description', label: 'Description', textarea: true, required: false },
      { name: 'opens_at', label: 'Open date', type: 'date', required: false }, { name: 'closes_at', label: 'Close date', type: 'date', required: false },
      { name: 'minimum_responses', label: 'Minimum responses before results appear', type: 'number', initial: 5 },
      { name: 'questions_text', label: 'Rating questions', textarea: true },
    ]} initial={{ minimum_responses: 5 }} onSubmit={(v) => send('POST', paths.surveys, { title: v.title, description: v.description || null, opens_at: v.opens_at || null, closes_at: v.closes_at || null, minimum_responses: Number(v.minimum_responses || 5), questions: v.questions_text.split('\n').map((prompt) => prompt.trim()).filter(Boolean).map((prompt) => ({ prompt })) })} success="Survey draft created" />
  </Page>;
}

export function SurveyResultsPage() {
  const { uuid } = useParams();
  const result = useList(paths.survey(uuid, 'results'));
  const data = result.data?.data ?? result.data;
  return <Page permission="experience.survey.manage" title="Survey results" description="Only aggregates meeting the privacy threshold are shown.">
    {result.loading ? <Skeleton /> : result.error ? <ErrorState error={result.error} onRetry={result.reload} /> : data && (data.suppressed ? <Card><p className="m-0 text-sm">Results are hidden until at least {data.minimum_responses} people have responded.</p></Card> : <div className="grid gap-3"><Card><p className="m-0 text-sm">{data.response_count} responses · minimum threshold {data.minimum_responses}</p></Card>{data.questions.map((question) => <Card key={question.uuid} title={question.prompt}><ul className="m-0 space-y-1 p-0 text-sm">{question.distribution.map((row) => <li key={row.rating}>Rating {row.rating}: {row.suppressed ? 'Suppressed' : row.count}</li>)}</ul></Card>)}</div>)}
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
