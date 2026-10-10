import { Outlet, Route } from 'react-router-dom';
import { Headset } from 'lucide-react';
import Access from '../components/Access';
import { EXPERIENCE_ACCESS } from '../lib/experienceApi';
import { TicketDetailPage, TicketListPage } from '../pages/experience/ExperiencePages';

function ExperienceLayout() { return <Access permission={EXPERIENCE_ACCESS} module="experience"><Outlet /></Access>; }

export const experienceRoutes = <Route path="experience" element={<ExperienceLayout />}>
  <Route index element={<TicketListPage />} />
  <Route path="tickets/:uuid" element={<TicketDetailPage />} />
</Route>;
export const experienceNavItem = { to: '/experience', label: 'HR Service Desk', icon: Headset, permission: EXPERIENCE_ACCESS, module: 'experience' };
