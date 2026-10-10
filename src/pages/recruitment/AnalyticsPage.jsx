import { Card, ErrorState, Skeleton } from '../../components/ui';
import { CountMap, Page, Section, Tiles } from '../../components/recruitment/kit';
import { paths, unwrap, useList } from '../../lib/recruitmentApi';

export default function AnalyticsPage() {
  const res = useList(paths.analytics);
  const d = unwrap(res.data) ?? {};
  const rq = d.requisitions ?? {};
  const pl = d.pipeline ?? {};
  const ttf = d.time_to_fill ?? {};
  const of = d.offers ?? {};
  const pct = (v) => (v == null ? '—' : `${v}%`);
  return (
    <Page permission="recruitment.reports.view" title="Recruitment analytics" description="Hiring demand, pipeline health and offer outcomes within your scope.">
      {res.loading ? (
        <Card><Skeleton /></Card>
      ) : res.error ? (
        <Card><ErrorState error={res.error} onRetry={res.reload} /></Card>
      ) : (
        <>
          <Tiles
            items={[
              { label: 'Open openings', value: rq.openings },
              { label: 'Filled', value: rq.filled },
              { label: 'Overdue requisitions', value: rq.overdue, tone: rq.overdue > 0 ? 'warn' : undefined },
              { label: 'Avg days to fill', value: ttf.average_days ?? '—', detail: `${ttf.filled_requisitions ?? 0} filled requisition(s)` },
              { label: 'Offer acceptance', value: pct(of.acceptance_rate) },
            ]}
          />
          <Card title="Requisitions by status" className="mb-5"><Section><CountMap map={rq.by_status} empty="No requisitions" /></Section></Card>
          <Card title="Active pipeline by stage" className="mb-5"><Section><CountMap map={pl.by_stage} empty="No active applications" /></Section></Card>
          <Card title="Applications by status" className="mb-5"><Section><CountMap map={pl.by_status} empty="No applications" /></Section></Card>
          <Card title="Applications by source" className="mb-5"><Section><CountMap map={pl.by_source} empty="No applications" /></Section></Card>
          <Card title="Offers by status" className="mb-5"><Section><CountMap map={of.by_status} empty="No offers" /></Section></Card>
        </>
      )}
    </Page>
  );
}
