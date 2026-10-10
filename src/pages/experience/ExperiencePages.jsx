import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, Card, ErrorState, PageHeader, Skeleton } from '../../components/ui';
import Access from '../../components/Access';
import { FormModal, StatusBadge, useDo } from '../../components/payroll/kit';
import { experiencePaths as paths, send, useList } from '../../lib/experienceApi';
import { useAuth } from '../../lib/auth';
import { download } from '../../lib/api';

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
  const [queue, setQueue] = useState({ status: '', priority: '', assignee: '', sla_overdue: false });
  const categories = useList(paths.categories);
  const assignees = useList(can('experience.ticket.manage') ? paths.ticketAssignees : null);
  const queueQuery = new URLSearchParams(Object.entries(queue).filter(([key, value]) => key === 'sla_overdue' ? value : Boolean(value))).toString();
  const list = useList(`${paths.tickets}${queueQuery ? `?${queueQuery}` : ''}`);
  const health = useList(can('experience.analytics.view') ? paths.health : null);
  const service = useDo();
  const employee = can('experience.self');
  const fields = [{ name: 'category_uuid', label: 'Request type', options: categories.rows.map((c) => ({ value: c.uuid, label: c.name })) },
    { name: 'subject', label: 'Subject' }, { name: 'description', label: 'Describe what you need', textarea: true }];
  return <Page permission="experience.self|experience.view|experience.ticket.manage" title={employee && !can('experience.view') ? 'My HR requests' : 'HR service desk'} description={employee && !can('experience.view') ? 'Create a request and follow updates from HR.' : 'Review service requests visible within your access scope.'} action={employee && <Button onClick={() => setCreate(true)}>New request</Button>}>
    {can('experience.ticket.manage') && <Card className="mb-4" title="Service queue"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-xs">Status<select aria-label="Queue status" className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={queue.status} onChange={(e) => setQueue((q) => ({ ...q, status: e.target.value }))}><option value="">All statuses</option>{['open', 'in_progress', 'waiting_employee', 'resolved', 'closed'].map((x) => <option key={x} value={x}>{x.replace('_', ' ')}</option>)}</select></label>
      <label className="text-xs">Priority<select aria-label="Queue priority" className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={queue.priority} onChange={(e) => setQueue((q) => ({ ...q, priority: e.target.value }))}><option value="">All priorities</option>{['low', 'normal', 'high', 'urgent'].map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
      <label className="text-xs">Assignment<select aria-label="Queue assignment" className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={queue.assignee} onChange={(e) => setQueue((q) => ({ ...q, assignee: e.target.value }))}><option value="">All assignments</option><option value="unassigned">Unassigned</option>{assignees.rows.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
      <label className="flex items-center gap-2 self-end pb-2 text-xs"><input type="checkbox" checked={queue.sla_overdue} onChange={(e) => setQueue((q) => ({ ...q, sla_overdue: e.target.checked }))} />Past SLA only</label>
    </div></Card>}
    {can('experience.analytics.view') && !health.loading && !health.error && health.data && <Card className="mb-4" title="Service health"><p className="m-0 text-sm">{health.data.backlog.total} open requests · {health.data.sla_overdue} past SLA · oldest {health.data.oldest_open_age_days} days</p><p className="mb-0 mt-2 text-xs text-slate-500">{health.data.satisfaction.suppressed ? 'Satisfaction hidden until five ratings are collected.' : `${health.data.satisfaction.response_count} ratings · average ${health.data.satisfaction.average_rating}/5`}</p></Card>}
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
  const actions = useDo();
  const article = useList(paths.article(uuid));
  const metrics = useList(can('experience.analytics.view') ? paths.article(uuid, 'feedback-results') : null);
  const data = article.data?.data ?? article.data;
  return <Page permission="experience.self|experience.view|experience.ticket.manage|experience.knowledge.manage" title={data?.title ?? 'HR article'} description={data?.summary ?? 'Current HR guidance.'}>
    {article.loading ? <Skeleton /> : article.error ? <ErrorState error={article.error} onRetry={article.reload} /> : data && <Card title={`${data.title} · v${data.version}`} action={<StatusBadge value={data.status} />}>
      <p className="m-0 whitespace-pre-wrap text-sm leading-6">{data.body}</p>
      <p className="mb-0 mt-5 text-xs text-slate-500">{data.locale}{data.effective_from ? ` · Effective ${data.effective_from}` : ''}{data.visibility === 'hr' ? ' · HR only' : ''}</p>
      {can('experience.self') && <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-700"><p className="text-xs">Was this article helpful?</p>{data.feedback_given ? <p className="text-xs text-emerald-700">Thanks for your feedback.</p> : <div className="flex gap-2"><Button variant="secondary" onClick={async () => { const saved = await actions.run('feedback', () => send('POST', paths.article(uuid, 'feedback'), { helpful: true }), 'Feedback recorded'); if (saved) article.reload(); }}>Yes</Button><Button variant="secondary" onClick={async () => { const saved = await actions.run('feedback', () => send('POST', paths.article(uuid, 'feedback'), { helpful: false }), 'Feedback recorded'); if (saved) article.reload(); }}>No</Button></div>}</div>}
      {can('experience.analytics.view') && metrics.data && <p className="mb-0 mt-4 text-xs text-slate-500">{metrics.data.suppressed ? `Article feedback hidden until ${metrics.data.minimum_responses} responses.` : `${metrics.data.response_count} responses · helpful ${metrics.data.helpful_suppressed ? 'suppressed' : metrics.data.helpful} · not helpful ${metrics.data.not_helpful_suppressed ? 'suppressed' : metrics.data.not_helpful}`}</p>}
      {can('experience.ticket.manage') && <p className="mb-0 mt-4 text-xs"><Link className="underline" to="/experience">Open the service desk</Link></p>}
    </Card>}
  </Page>;
}

export function AnnouncementsPage() {
  const { can } = useAuth();
  const [create, setCreate] = useState(false);
  const list = useList(`${paths.announcements}?per_page=50`);
  const audienceOptions = useList(can('experience.announcement.manage') ? paths.announcementAudienceOptions : null);
  const actions = useDo();
  async function track(item, action) {
    const result = await actions.run(action, () => send('POST', paths.announcement(item.uuid, action), {}), action === 'acknowledge' ? 'Acknowledgment recorded' : 'Announcement marked as read');
    if (result) list.reload();
  }
  return <Page permission="experience.self|experience.view|experience.ticket.manage|experience.announcement.manage" title="Employee announcements" description="Company updates and notices requiring acknowledgment." action={can('experience.announcement.manage') && <Button onClick={() => setCreate(true)}>Create announcement</Button>}>
    {list.loading ? <Skeleton /> : list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : <div className="grid gap-3">
      {list.rows.map((item) => <Card key={item.uuid} title={<>{item.pinned && <span className="mr-2 text-amber-600">Pinned</span>}{item.title}</>} action={<StatusBadge value={item.status} />}>
        <p className="whitespace-pre-wrap text-sm leading-6">{item.body}</p>
        <p className="text-xs text-slate-500">{item.publish_at ? `Published ${item.publish_at}` : 'Draft'}{item.expires_at ? ` · Expires ${item.expires_at}` : ''}{item.acknowledgment_required ? ' · Acknowledgment required' : ''}{item.audience && Object.values(item.audience).some((a) => a.length) ? ' · Targeted audience' : ''}</p>
        {item.status === 'published' && !item.read_at && <Button variant="secondary" disabled={Boolean(actions.busy)} onClick={() => track(item, 'read')}>Mark as read</Button>}
        {item.status === 'published' && item.acknowledgment_required && !item.acknowledged_at && <Button className="ml-2" disabled={Boolean(actions.busy)} onClick={() => track(item, 'acknowledge')}>Acknowledge</Button>}
        {item.read_at && <p className="mb-0 text-xs text-emerald-700">{item.acknowledged_at ? 'Acknowledged' : 'Read'}</p>}
        {can('experience.announcement.manage') && item.status === 'draft' && <Button variant="secondary" disabled={Boolean(actions.busy)} onClick={async () => { const result = await actions.run('publish', () => send('POST', paths.announcement(item.uuid, 'publish'), {}), 'Announcement published'); if (result) list.reload(); }}>Publish</Button>}
        {can('experience.analytics.view') && item.status !== 'draft' && <Link className="ml-3 text-xs underline" to={`/experience/announcements/${item.uuid}/metrics`}>Read metrics</Link>}
      </Card>)}
      {!list.rows.length && <Card><p className="m-0 text-sm">No announcements yet.</p></Card>}
    </div>}
    <FormModal open={create} onClose={() => setCreate(false)} title="Create announcement" intro="Save a draft, then publish it when it is ready." fields={[
      { name: 'title', label: 'Title' }, { name: 'body', label: 'Announcement', textarea: true },
      { name: 'publish_at', label: 'Publish date', type: 'date', required: false }, { name: 'expires_at', label: 'Expiration date', type: 'date', required: false },
      { name: 'acknowledgment_required', label: 'Require employee acknowledgment', type: 'checkbox' }, { name: 'pinned', label: 'Pin announcement', type: 'checkbox' },
    ]} initial={{ acknowledgment_required: false, pinned: false }} extra={(v, set) => <div className="mb-4"><p className="text-xs">Audience filters (leave all empty to target the whole workspace)</p>{[
      ['legal_entity_ids', 'Legal entities', audienceOptions.data?.legal_entities ?? []], ['location_ids', 'Locations', audienceOptions.data?.locations ?? []], ['designation_ids', 'Roles / designations', audienceOptions.data?.designations ?? []],
    ].map(([key, label, options]) => <fieldset key={key} className="mb-3"><legend className="text-xs font-semibold">{label}</legend><div className="mt-1 flex flex-wrap gap-3">{options.map((option) => <label key={option.id} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={(v[key] ?? []).includes(option.id)} onChange={(e) => set(key, e.target.checked ? [...(v[key] ?? []), option.id] : (v[key] ?? []).filter((id) => id !== option.id))} />{option.name}</label>)}</div></fieldset>)}</div>}
    onSubmit={(v) => send('POST', paths.announcements, { title: v.title, body: v.body, acknowledgment_required: Boolean(v.acknowledgment_required), pinned: Boolean(v.pinned), publish_at: v.publish_at || null, expires_at: v.expires_at || null, audience: { legal_entity_ids: v.legal_entity_ids ?? [], location_ids: v.location_ids ?? [], designation_ids: v.designation_ids ?? [] } })} success="Draft announcement created" />
  </Page>;
}

export function AnnouncementMetricsPage() {
  const { uuid } = useParams();
  const metrics = useList(paths.announcement(uuid, 'metrics'));
  const data = metrics.data?.data ?? metrics.data;
  return <Page permission="experience.analytics.view" title="Announcement read metrics" description="Read and acknowledgment totals are suppressed for small audiences.">
    {metrics.loading ? <Skeleton /> : metrics.error ? <ErrorState error={metrics.error} onRetry={metrics.reload} /> : data && <Card title="Audience activity">{data.suppressed ? <p className="m-0 text-sm">Metrics are hidden until at least {data.minimum_responses} employees are in the audience.</p> : <div className="space-y-2 text-sm"><p>Audience: {data.audience_count}</p><p>Read: {data.read_suppressed ? 'Suppressed' : data.read_count}</p><p>Acknowledged: {data.acknowledged_suppressed ? 'Suppressed' : data.acknowledged_count}</p></div>}</Card>}
  </Page>;
}

export function SurveysPage() {
  const { can } = useAuth();
  const [create, setCreate] = useState(false);
  const [answers, setAnswers] = useState({});
  const [consents, setConsents] = useState({});
  const list = useList(`${paths.surveys}?per_page=50`);
  const audienceOptions = useList(can('experience.survey.manage') ? paths.surveyAudienceOptions : null);
  const actions = useDo();
  async function submit(survey) {
    const result = await actions.run(survey.uuid, () => send('POST', paths.survey(survey.uuid, 'responses'), { answers: answers[survey.uuid] ?? {}, consent: Boolean(consents[survey.uuid]) }), 'Anonymous response submitted');
    if (result) { setAnswers((all) => ({ ...all, [survey.uuid]: {} })); list.reload(); }
  }
  return <Page permission="experience.self|experience.view|experience.ticket.manage|experience.survey.manage" title="Employee surveys" description="Share feedback through anonymous rating surveys. Individual answers are never shown.
    Results stay hidden until the response threshold is reached." action={can('experience.survey.manage') && <Button onClick={() => setCreate(true)}>Create survey</Button>}>
    {list.loading ? <Skeleton /> : list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : <div className="grid gap-3">
      {list.rows.map((survey) => <Card key={survey.uuid} title={survey.title} action={<StatusBadge value={survey.status} />}>
        <p className="text-xs text-slate-500">{survey.campaign_type} campaign{survey.retention_until ? ` · Responses retained until ${survey.retention_until}` : ''}</p>
        {survey.description && <p className="text-sm">{survey.description}</p>}
        {survey.status === 'published' && !survey.submitted && <form onSubmit={(e) => { e.preventDefault(); submit(survey); }} className="space-y-4">
          <p className="text-xs text-slate-500">Anonymous survey · results are suppressed until at least five people respond. We store completion separately to prevent duplicate submissions.</p>
          {survey.questions.map((question) => <label key={question.uuid} className="block text-sm">{question.prompt}<select required aria-label={question.prompt} className="mt-1 block min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900" value={answers[survey.uuid]?.[question.uuid] ?? ''} onChange={(e) => setAnswers((all) => ({ ...all, [survey.uuid]: { ...all[survey.uuid], [question.uuid]: Number(e.target.value) } }))}><option value="">Choose a rating</option>{question.scale.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>)}
          {survey.requires_consent && <label className="flex items-start gap-2 text-xs"><input type="checkbox" required checked={Boolean(consents[survey.uuid])} onChange={(e) => setConsents((all) => ({ ...all, [survey.uuid]: e.target.checked }))} />I consent to submit an anonymous rating response for this survey.</label>}
          <Button type="submit" disabled={Boolean(actions.busy)}>Submit anonymous response</Button>
        </form>}
      {survey.submitted && <p className="mb-0 text-sm text-emerald-700">Your anonymous response has been recorded.</p>}
        {can('experience.survey.manage') && survey.status === 'draft' && <Button variant="secondary" onClick={async () => { const result = await actions.run('publish', () => send('POST', paths.survey(survey.uuid, 'publish'), {}), 'Survey published'); if (result) list.reload(); }}>Publish</Button>}
        {can('experience.survey.manage') && survey.status === 'published' && <p className="mb-0 mt-3 text-xs"><Link to={`/experience/surveys/${survey.uuid}/results`} className="underline">View thresholded results</Link></p>}
      </Card>)}
      {!list.rows.length && <Card><p className="m-0 text-sm">No surveys are available.</p></Card>}
    </div>}
    <FormModal open={create} onClose={() => setCreate(false)} title="Create anonymous survey" intro="Only 1–5 rating questions are supported in this privacy-focused survey slice. Add one prompt per line." fields={[
      { name: 'campaign_type', label: 'Campaign type', options: ['engagement', 'pulse', 'onboarding', 'exit', 'custom'].map((value) => ({ value, label: value })) },
      { name: 'title', label: 'Title' }, { name: 'description', label: 'Description', textarea: true, required: false },
      { name: 'opens_at', label: 'Open date', type: 'date', required: false }, { name: 'closes_at', label: 'Close date', type: 'date', required: false }, { name: 'retention_until', label: 'Retention end date', type: 'date' },
      { name: 'minimum_responses', label: 'Minimum responses before results appear', type: 'number', initial: 5 },
      { name: 'requires_consent', label: 'Require explicit consent before response', type: 'checkbox' },
      { name: 'questions_text', label: 'Rating questions', textarea: true },
    ]} initial={{ campaign_type: 'custom', minimum_responses: 5, requires_consent: false }} extra={(v, set) => <div className="mb-4"><p className="text-xs">Eligibility filters (leave all empty to include all employees)</p>{[
      ['legal_entity_ids', 'Legal entities', audienceOptions.data?.legal_entities ?? []], ['location_ids', 'Locations', audienceOptions.data?.locations ?? []], ['designation_ids', 'Roles / designations', audienceOptions.data?.designations ?? []],
    ].map(([key, label, options]) => <fieldset key={key} className="mb-3"><legend className="text-xs font-semibold">{label}</legend><div className="mt-1 flex flex-wrap gap-3">{options.map((option) => <label key={option.id} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={(v[key] ?? []).includes(option.id)} onChange={(e) => set(key, e.target.checked ? [...(v[key] ?? []), option.id] : (v[key] ?? []).filter((id) => id !== option.id))} />{option.name}</label>)}</div></fieldset>)}</div>}
      onSubmit={(v) => send('POST', paths.surveys, { title: v.title, campaign_type: v.campaign_type || 'custom', description: v.description || null, opens_at: v.opens_at || null, closes_at: v.closes_at || null, retention_until: v.retention_until, requires_consent: Boolean(v.requires_consent), minimum_responses: Number(v.minimum_responses || 5), eligibility: { legal_entity_ids: v.legal_entity_ids ?? [], location_ids: v.location_ids ?? [], designation_ids: v.designation_ids ?? [] }, questions: v.questions_text.split('\n').map((prompt) => prompt.trim()).filter(Boolean).map((prompt) => ({ prompt })) })} success="Survey draft created" />
  </Page>;
}

export function SurveyResultsPage() {
  const { uuid } = useParams();
  const result = useList(paths.survey(uuid, 'results'));
  const data = result.data?.data ?? result.data;
  return <Page permission="experience.survey.manage" title="Survey results" description="Only aggregates meeting the privacy threshold are shown.">
    {result.loading ? <Skeleton /> : result.error ? <ErrorState error={result.error} onRetry={result.reload} /> : data && (data.retention_expired ? <Card><p className="m-0 text-sm">Survey response data has been purged after its retention period.</p></Card> : data.suppressed ? <Card><p className="m-0 text-sm">Results are hidden until at least {data.minimum_responses} people have responded.</p></Card> : <div className="grid gap-3"><Card><p className="m-0 text-sm">{data.response_count} responses · minimum threshold {data.minimum_responses}</p></Card>{data.questions.map((question) => <Card key={question.uuid} title={question.prompt}><ul className="m-0 space-y-1 p-0 text-sm">{question.distribution.map((row) => <li key={row.rating}>Rating {row.rating}: {row.suppressed ? 'Suppressed' : row.count}</li>)}</ul></Card>)}</div>)}
  </Page>;
}

const RECOGNITION_VALUES = ['teamwork', 'customer_care', 'ownership', 'innovation', 'inclusion'];
export function RecognitionPage() {
  const { can } = useAuth();
  const [search, setSearch] = useState('');
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [tags, setTags] = useState([]);
  const [reward, setReward] = useState('');
  const [optedOut, setOptedOut] = useState(false);
  const list = useList(paths.recognitions);
  const preference = useList(paths.recognition('preference'));
  const recipients = useList(`${paths.recognition('recipients')}?search=${encodeURIComponent(search)}`);
  const actions = useDo();
  useEffect(() => { setOptedOut(Boolean(preference.data?.opted_out)); }, [preference.data]);
  async function savePreference(value) {
    const saved = await actions.run('preference', () => send('PUT', paths.recognition('preference'), { opted_out: value }), value ? 'Recognition opt-out saved' : 'Recognition opt-in saved');
    if (saved) { setOptedOut(value); preference.reload(); }
  }
  async function submit(event) {
    event.preventDefault();
    const saved = await actions.run('create', () => send('POST', paths.recognitions, { recipient_uuid: recipient, message, value_tags: tags, reward_reference: reward || null }), 'Recognition submitted for moderation');
    if (saved) { setRecipient(''); setMessage(''); setTags([]); setReward(''); }
  }
  async function moderate(item, decision) {
    const saved = await actions.run(item.uuid, () => send('POST', paths.recognition(item.uuid, 'moderate'), { decision }), `Recognition ${decision}`);
    if (saved) list.reload();
  }
  return <Page permission="experience.self|experience.recognition.manage" title="Recognition" description={can('experience.recognition.manage') ? 'Review appreciation before it appears in the employee feed.' : 'Appreciate a coworker and celebrate the values they demonstrate.'}>
    {can('experience.self') && <Card className="mb-4" title="Recognition preference"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={optedOut} onChange={(e) => savePreference(e.target.checked)} disabled={Boolean(actions.busy)} />Opt out of receiving recognition</label></Card>}
    {can('experience.self') && <Card className="mb-4" title="Recognize a coworker"><form className="space-y-3" onSubmit={submit}>
      <label className="block text-xs">Find coworker<input aria-label="Find coworker" minLength={2} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={search} onChange={(e) => { setSearch(e.target.value); setRecipient(''); }} /></label>
      <label className="block text-xs">Coworker<select aria-label="Coworker" required className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={recipient} onChange={(e) => setRecipient(e.target.value)}><option value="">Choose a coworker</option>{recipients.rows.map((person) => <option key={person.uuid} value={person.uuid}>{person.name}</option>)}</select></label>
      <label className="block text-xs">Appreciation message<textarea aria-label="Appreciation message" required maxLength={2000} className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={message} onChange={(e) => setMessage(e.target.value)} /></label>
      <fieldset><legend className="mb-1 text-xs">Values</legend><div className="flex flex-wrap gap-3">{RECOGNITION_VALUES.map((tag) => <label key={tag} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={tags.includes(tag)} onChange={(e) => setTags((current) => e.target.checked ? [...current, tag] : current.filter((x) => x !== tag))} />{tag.replace('_', ' ')}</label>)}</div></fieldset>
      <label className="block text-xs">Reward reference (optional; reference only, not a monetary value)<input aria-label="Reward reference" maxLength={100} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={reward} onChange={(e) => setReward(e.target.value)} /></label>
      <Button type="submit" disabled={!recipient || !tags.length || Boolean(actions.busy)}>Submit for moderation</Button>
    </form></Card>}
    {list.loading ? <Skeleton /> : list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : <div className="grid gap-3">{list.rows.map((item) => <Card key={item.uuid} title={item.recipient?.name ?? 'Recognition'} action={<StatusBadge value={item.status} />}>
      <p className="text-sm">{item.message}</p><p className="text-xs text-slate-500">{item.value_tags.join(' · ')}{item.reward_reference ? ` · Reward ref: ${item.reward_reference}` : ''}</p>
      {can('experience.recognition.manage') && item.status === 'pending' && <div className="flex gap-2"><Button variant="secondary" onClick={() => moderate(item, 'rejected')} disabled={Boolean(actions.busy)}>Reject</Button><Button onClick={() => moderate(item, 'approved')} disabled={Boolean(actions.busy)}>Approve</Button></div>}
    </Card>)}{!list.rows.length && <Card><p className="m-0 text-sm">No recognition items to show.</p></Card>}</div>}
  </Page>;
}

export function TicketDetailPage() {
  const { uuid } = useParams();
  const { can } = useAuth();
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [rating, setRating] = useState('');
  const [feedback, setFeedback] = useState('');
  const [file, setFile] = useState(null);
  const [escalationReason, setEscalationReason] = useState('');
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
  async function reopen() {
    const saved = await actions.run('reopen', () => send('POST', paths.ticket(uuid, 'reopen'), {}), 'Request reopened');
    if (saved) ticket.reload();
  }
  async function rate(event) {
    event.preventDefault();
    const saved = await actions.run('feedback', () => send('POST', paths.ticket(uuid, 'feedback'), { rating: Number(rating), comment: feedback || null }), 'Feedback submitted');
    if (saved) ticket.reload();
  }
  async function attach(event) {
    event.preventDefault();
    if (!file) return;
    const formElement = event.currentTarget;
    const form = new FormData(); form.append('file', file);
    const saved = await actions.run('attachment', () => send('POST', paths.ticket(uuid, 'attachments'), form), 'Attachment uploaded');
    if (saved) { setFile(null); formElement.reset(); ticket.reload(); }
  }
  async function escalate(event) {
    event.preventDefault();
    const saved = await actions.run('escalate', () => send('POST', paths.ticket(uuid, 'escalate'), { reason: escalationReason }), 'Ticket escalated');
    if (saved) { setEscalationReason(''); ticket.reload(); }
  }
  return <Page permission="experience.self|experience.view|experience.ticket.manage" title={data?.subject ?? 'HR request'} description={data?.category?.name ?? 'Request details and conversation.'}>
    {ticket.loading ? <Skeleton /> : ticket.error ? <ErrorState error={ticket.error} onRetry={ticket.reload} /> : data && <>
      <Card className="mb-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="m-0 text-sm">Status: <StatusBadge value={data.status} /></p><p className="mb-0 mt-2 text-sm">{data.description}</p></div><div className="flex gap-2">{can('experience.ticket.manage') && data.status !== 'resolved' && data.status !== 'closed' && <Button variant="secondary" onClick={() => update('resolved')}>Resolve</Button>}{can('experience.ticket.manage') && data.status === 'resolved' && <Button variant="secondary" onClick={() => update('closed')}>Close</Button>}{data.can_reopen && <Button variant="secondary" onClick={reopen}>Reopen request</Button>}</div></div></Card>
      {can('experience.ticket.manage') && data.status !== 'resolved' && data.status !== 'closed' && <Card className="mb-4" title="Escalate ticket"><form className="flex flex-wrap items-end gap-3" onSubmit={escalate}><label className="min-w-64 flex-1 text-xs">Private reason<input aria-label="Escalation reason" required maxLength={1000} value={escalationReason} onChange={(e) => setEscalationReason(e.target.value)} className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" /></label><Button type="submit" variant="secondary" disabled={!escalationReason.trim() || Boolean(actions.busy)}>Escalate</Button></form>{data.escalations?.length > 0 && <ul className="mb-0 mt-3 space-y-1 pl-5 text-xs">{data.escalations.map((item) => <li key={item.uuid}>Level {item.level} · {item.type}: {item.reason}</li>)}</ul>}</Card>}
      {!!data.attachments?.length && <Card title="Attachments" className="mb-4"><ul className="m-0 space-y-2 p-0">{data.attachments.map((item) => <li key={item.uuid}><button type="button" className="text-sm text-brand-700 underline" onClick={() => download(paths.ticket(uuid, `attachments/${item.uuid}`), item.filename)}>{item.filename}</button><span className="ml-2 text-xs text-slate-500">{Math.ceil(item.size_bytes / 1024)} KB</span></li>)}</ul></Card>}
      {data.status !== 'closed' && <Card title="Conversation" className="mb-4"><div className="space-y-3">{(data.comments ?? []).map((item) => <article key={item.uuid} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"><div className="flex justify-between gap-2 text-xs"><strong>{item.author}</strong>{item.visibility === 'private' && <span className="text-amber-700">Internal HR note</span>}</div><p className="mb-0 mt-2 whitespace-pre-wrap text-sm">{item.body}</p></article>)}{!data.comments?.length && <p className="m-0 text-sm">No replies yet.</p>}</div></Card>}
      {data.status !== 'closed' && <form className="mb-4 flex flex-wrap items-end gap-3" onSubmit={attach}><label className="text-xs">Add attachment (PDF, image, Word, or Excel; 5 MB max)<input aria-label="Ticket attachment" type="file" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 block text-sm" /></label><Button type="submit" variant="secondary" disabled={!file || Boolean(actions.busy)}>Upload file</Button></form>}
      {data.status !== 'closed' && <Card title={can('experience.ticket.manage') ? 'Add a reply or private note' : 'Add a reply'}><form className="space-y-3" onSubmit={comment}><textarea aria-label="Reply" required maxLength={10000} className="min-h-28 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={body} onChange={(e) => setBody(e.target.value)} />{can('experience.ticket.manage') && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={visibility === 'private'} onChange={(e) => setVisibility(e.target.checked ? 'private' : 'public')} />Internal note (visible to HR service staff only)</label>}<Button type="submit" disabled={Boolean(actions.busy)}>Send reply</Button></form></Card>}
      {data.can_feedback && <Card className="mt-4" title="Rate HR support"><form className="space-y-3" onSubmit={rate}><label className="block text-xs">Rating<select required aria-label="Service rating" className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={rating} onChange={(e) => setRating(e.target.value)}><option value="">Choose a rating</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></label><textarea aria-label="Service feedback" maxLength={1000} placeholder="Optional comment" className="min-h-20 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900" value={feedback} onChange={(e) => setFeedback(e.target.value)} /><Button type="submit" disabled={!rating || Boolean(actions.busy)}>Submit feedback</Button></form></Card>}
    </>}
  </Page>;
}
