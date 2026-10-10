import { useState } from 'react';
import { Badge, Select } from '../ui';
import Access from '../Access';
import PeopleSettingsCrud, { activeBadge } from './PeopleSettingsCrud';

const SLUG = /^[a-z0-9][a-z0-9_-]*$/;
const yes = (v) => (v ? 'Yes' : 'No');
const activeField = { name: 'active', label: 'Active', type: 'checkbox', default: true };

/* ---------- lookups ---------- */
export const LOOKUP_KINDS = [
  ['employment_status', 'Employment status'],
  ['separation_reason', 'Separation reason'],
  ['relationship_type', 'Relationship type'],
  ['document_category', 'Document category'],
  ['skill_category', 'Skill category'],
  ['termination_reason', 'Termination reason'],
];
const lookupSpec = (kind) => ({
  noun: 'Lookup value',
  intro: 'System values cannot be deleted. Values in use can only be deactivated.',
  listPath: `/v1/people/lookups/${kind}`,
  createPath: `/v1/people/lookups/${kind}`,
  updatePath: (r) => `/v1/people/lookups/${kind}/${r.id}`,
  deletePath: (r) => `/v1/people/lookups/${kind}/${r.id}`,
  canDelete: (r) => r.can_delete !== false && !r.system,
  columns: [
    { key: 'label', label: 'Label' },
    { key: 'code', label: 'Code' },
    { key: 'active', label: 'Status', render: activeBadge },
    { key: 'system', label: 'Type', render: (r) => (r.system ? <Badge>System</Badge> : 'Custom') },
  ],
  fields: [
    { name: 'label', label: 'Label', required: true, maxLength: 120 },
    { name: 'code', label: 'Code', maxLength: 60, createOnly: true, pattern: SLUG, patternMessage: 'Use lowercase letters, numbers, - and _.', hint: 'Optional. Cannot be changed later.' },
    { name: 'sort', label: 'Sort order', type: 'number', min: 0 },
    activeField,
  ],
});
export function LookupsPanel() {
  const [kind, setKind] = useState('employment_status');
  return (
    <>
      <div className="px-4 pt-4 sm:px-6">
        <Select label="Lookup list" value={kind} onChange={(e) => setKind(e.target.value)} options={LOOKUP_KINDS.map(([value, label]) => ({ value, label }))} />
      </div>
      <PeopleSettingsCrud key={kind} spec={lookupSpec(kind)} />
    </>
  );
}

/* ---------- document types ---------- */
const docTypes = {
  noun: 'Document type',
  listPath: '/v1/people/document-types',
  createPath: '/v1/people/document-types',
  updatePath: (r) => `/v1/people/document-types/${r.code}`,
  updateMethod: 'PATCH',
  deletePath: (r) => `/v1/people/document-types/${r.code}`,
  canDelete: (r) => !r.builtin && !r.system && !r.in_use,
  rowKey: (r) => r.code,
  intro: 'Built-in or used types cannot be deleted; deactivate them instead.',
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'code', label: 'Code' },
    { key: 'category', label: 'Category' },
    { key: 'requires_expiry', label: 'Expiry', render: (r) => yes(r.requires_expiry) },
    { key: 'mandatory', label: 'Mandatory', render: (r) => yes(r.mandatory) },
    { key: 'active', label: 'Status', render: activeBadge },
  ],
  fields: [
    { name: 'code', label: 'Code', required: true, maxLength: 60, createOnly: true, pattern: SLUG, patternMessage: 'Use lowercase letters, numbers, - and _.' },
    { name: 'name', label: 'Name', required: true, maxLength: 120 },
    { name: 'category', label: 'Category', maxLength: 60 },
    { name: 'requires_expiry', label: 'Requires an expiry date', type: 'checkbox' },
    { name: 'mandatory', label: 'Mandatory for employees', type: 'checkbox' },
    activeField,
  ],
};
export const DocumentTypesPanel = () => <PeopleSettingsCrud spec={docTypes} />;

/* ---------- skills and tags ---------- */
const skills = {
  noun: 'Skill',
  listPath: '/v1/people/skills?include_inactive=1&per_page=100',
  createPath: '/v1/people/skills',
  updatePath: (r) => `/v1/people/skills/${r.id}`,
  updateMethod: 'PATCH',
  paged: false,
  intro: 'Skills are deactivated rather than deleted.',
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'category', label: 'Category' },
    { key: 'active', label: 'Status', render: activeBadge },
  ],
  fields: [{ name: 'name', label: 'Name', required: true, maxLength: 120 }, { name: 'category', label: 'Category', maxLength: 80 }, activeField],
};
const COLORS = ['slate', 'gray', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'];
const tags = {
  noun: 'Tag',
  listPath: '/v1/people/tags?include_inactive=1&per_page=100',
  createPath: '/v1/people/tags',
  updatePath: (r) => `/v1/people/tags/${r.id}`,
  updateMethod: 'PATCH',
  intro: 'A required permission limits who can see and assign a tag.',
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'color_token', label: 'Colour' },
    { key: 'required_permission', label: 'Permission' },
    { key: 'active', label: 'Status', render: activeBadge },
  ],
  fields: [
    { name: 'name', label: 'Name', required: true, maxLength: 60 },
    { name: 'color_token', label: 'Colour', type: 'select', default: 'slate', options: COLORS },
    { name: 'description', label: 'Description', type: 'textarea', maxLength: 255 },
    { name: 'required_permission', label: 'Required permission key', maxLength: 80, pattern: /^[a-z][a-z0-9_.]*$/, patternMessage: 'Use a permission key such as people.notes.private.' },
    activeField,
  ],
};
export function SkillsTagsPanel() {
  const [kind, setKind] = useState('skills');
  return (
    <>
      <div className="px-4 pt-4 sm:px-6">
        <Select label="Catalogue" value={kind} onChange={(e) => setKind(e.target.value)} options={[{ value: 'skills', label: 'Skills' }, { value: 'tags', label: 'Tags' }]} />
      </div>
      <PeopleSettingsCrud key={kind} spec={kind === 'skills' ? skills : tags} />
    </>
  );
}

/* ---------- groups ---------- */
const groups = {
  noun: 'Group',
  listPath: '/v1/people/groups?per_page=50',
  paged: true,
  createPath: '/v1/people/groups',
  updatePath: (r) => `/v1/people/groups/${r.id}`,
  deletePath: (r) => `/v1/people/groups/${r.id}`,
  intro: 'A group cannot be deleted while it has members or data-scope grants; deactivate it instead.',
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'code', label: 'Code' },
    { key: 'members_count', label: 'Members' },
    { key: 'active', label: 'Status', render: activeBadge },
  ],
  fields: [
    { name: 'name', label: 'Name', required: true, maxLength: 120 },
    { name: 'code', label: 'Code', maxLength: 60 },
    { name: 'description', label: 'Description', type: 'textarea', maxLength: 500 },
    activeField,
  ],
};
export const GroupsPanel = () => <PeopleSettingsCrud spec={groups} />;

/* ---------- custom sections and fields ---------- */
const FIELD_TYPES = ['text', 'long_text', 'number', 'currency', 'date', 'datetime', 'boolean', 'single_select', 'multi_select', 'email', 'phone', 'url', 'employee_ref', 'department_ref', 'location_ref', 'country', 'attachment_ref'];
const sections = {
  noun: 'Section',
  listPath: '/v1/people/custom-sections',
  createPath: '/v1/people/custom-sections',
  updatePath: (r) => `/v1/people/custom-sections/${r.id}`,
  deletePath: (r) => `/v1/people/custom-sections/${r.id}`,
  columns: [
    { key: 'label', label: 'Label' },
    { key: 'key', label: 'Key' },
    { key: 'classification', label: 'Classification' },
    { key: 'active', label: 'Status', render: activeBadge },
  ],
  fields: [
    { name: 'key', label: 'Key', required: true, maxLength: 60, createOnly: true, pattern: /^[a-z][a-z0-9_]*$/, patternMessage: 'Use lowercase letters, numbers and underscores.' },
    { name: 'label', label: 'Label', required: true, maxLength: 120 },
    { name: 'description', label: 'Description', type: 'textarea', maxLength: 500 },
    { name: 'sort', label: 'Sort order', type: 'number', min: 0 },
    activeField,
  ],
};
const customFields = {
  noun: 'Field',
  intro: 'Fields with stored values cannot be deleted; deactivate them to hide the field and keep the data.',
  listPath: '/v1/people/custom-fields',
  createPath: '/v1/people/custom-fields',
  updatePath: (r) => `/v1/people/custom-fields/${r.id}`,
  deletePath: (r) => `/v1/people/custom-fields/${r.id}`,
  columns: [
    { key: 'label', label: 'Label' },
    { key: 'key', label: 'Key' },
    { key: 'type', label: 'Type' },
    { key: 'required', label: 'Required', render: (r) => yes(r.required) },
    { key: 'active', label: 'Status', render: activeBadge },
  ],
  fields: [
    { name: 'entity', label: 'Applies to', type: 'select', createOnly: true, default: 'employee', options: [{ value: 'employee', label: 'Employee record' }, { value: 'person', label: 'Person (personal data)' }] },
    { name: 'key', label: 'Key', required: true, maxLength: 60, createOnly: true, pattern: /^[a-z][a-z0-9_]*$/, patternMessage: 'Use lowercase letters, numbers and underscores.' },
    { name: 'type', label: 'Type', type: 'select', createOnly: true, default: 'text', options: FIELD_TYPES },
    { name: 'label', label: 'Label', required: true, maxLength: 120 },
    { name: 'section_id', label: 'Section ID', type: 'number', min: 1 },
    { name: 'required', label: 'Required', type: 'checkbox' },
    { name: 'employee_editable', label: 'Employee can edit', type: 'checkbox' },
    activeField,
  ],
};
export function CustomFieldsPanel() {
  const [kind, setKind] = useState('fields');
  return (
    <>
      <div className="px-4 pt-4 sm:px-6">
        <Select label="Manage" value={kind} onChange={(e) => setKind(e.target.value)} options={[{ value: 'fields', label: 'Custom fields' }, { value: 'sections', label: 'Sections' }]} />
      </div>
      <PeopleSettingsCrud key={kind} spec={kind === 'fields' ? customFields : sections} />
    </>
  );
}

/* ---------- country configs ---------- */
const countries = {
  noun: 'Country',
  intro: 'Overrides change the shipped country pack for this workspace. Reset removes the override.',
  listPath: '/v1/people/countries',
  createPath: '/v1/people/countries/__new__',
  updatePath: (r) => `/v1/people/countries/${r.code}`,
  deletePath: (r) => `/v1/people/countries/${r.code}`,
  deleteLabel: 'reset',
  canDelete: (r) => r.source === 'override' || r.source === 'custom',
  rowKey: (r) => r.code,
  columns: [
    { key: 'name', label: 'Country' },
    { key: 'code', label: 'Code' },
    { key: 'currency', label: 'Currency' },
    { key: 'timezone', label: 'Time zone' },
    { key: 'source', label: 'Source', render: (r) => <Badge tone={r.source === 'default' ? 'neutral' : 'purple'}>{r.source}</Badge> },
  ],
  fields: [
    { name: 'name', label: 'Name', required: true, maxLength: 80 },
    { name: 'currency', label: 'Currency (ISO)', maxLength: 3, pattern: /^[A-Za-z]{3}$/, patternMessage: 'Use a 3-letter currency code.' },
    { name: 'timezone', label: 'Time zone', maxLength: 64 },
    { name: 'locale', label: 'Locale', maxLength: 20 },
    { name: 'date_format', label: 'Date format', maxLength: 20 },
    { name: 'phone_code', label: 'Phone code', maxLength: 6 },
  ],
};
export const CountriesPanel = () => <PeopleSettingsCrud spec={{ ...countries, createPath: undefined }} />;

/* ---------- data-scope grants ---------- */
const scopes = {
  noun: 'Grant',
  paged: true,
  intro: 'Grants extend which employees a user can see beyond their role. Employee grants use the employee UUID.',
  listPath: '/access/data-scopes',
  createPath: '/access/data-scopes',
  deletePath: (r) => `/access/data-scopes/${r.id}`,
  columns: [
    { key: 'user', label: 'User', render: (r) => r.user?.name || r.user?.email || '—' },
    { key: 'kind', label: 'Scope', render: (r) => String(r.kind).replaceAll('_', ' ') },
    { key: 'reference_label', label: 'Applies to' },
  ],
  fields: [
    { name: 'user_id', label: 'User ID', type: 'number', required: true, min: 1 },
    { name: 'kind', label: 'Scope', type: 'select', default: 'department', options: ['department', 'business_unit', 'location', 'legal_entity', 'employee_group', 'employee'] },
    { name: 'reference_id', label: 'Reference ID (employee UUID for employee scope)', required: true, maxLength: 64 },
  ],
  toBody: (b) => ({ ...b, reference_id: b.kind === 'employee' || !/^\d+$/.test(String(b.reference_id)) ? b.reference_id : Number(b.reference_id) }),
};
export const DataScopesPanel = () => (
  <Access permission="users.manage" module="people">
    <PeopleSettingsCrud spec={scopes} />
  </Access>
);
