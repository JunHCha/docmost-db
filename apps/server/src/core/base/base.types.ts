// Server-side mirror of the client contract in
// apps/client/src/ee/base/types/base.types.ts. The fork adds 'relation'
// as a property type and view scoping (embed/personal) on top.

export type BasePropertyType =
  | 'text'
  | 'number'
  | 'select'
  | 'status'
  | 'multiSelect'
  | 'date'
  | 'person'
  | 'file'
  | 'page'
  | 'checkbox'
  | 'url'
  | 'email'
  | 'createdAt'
  | 'lastEditedAt'
  | 'lastEditedBy'
  | 'formula'
  | 'longText'
  | 'relation';

export const BASE_PROPERTY_TYPES: readonly BasePropertyType[] = [
  'text',
  'number',
  'select',
  'status',
  'multiSelect',
  'date',
  'person',
  'file',
  'page',
  'checkbox',
  'url',
  'email',
  'createdAt',
  'lastEditedAt',
  'lastEditedBy',
  'formula',
  'longText',
  'relation',
];

// Property types whose value derives from row columns, not cells.
export const COMPUTED_PROPERTY_TYPES: readonly BasePropertyType[] = [
  'createdAt',
  'lastEditedAt',
  'lastEditedBy',
];

export type BaseViewType = 'table' | 'kanban' | 'calendar';

export const BASE_VIEW_TYPES: readonly BaseViewType[] = [
  'table',
  'kanban',
  'calendar',
];

export type Choice = {
  id: string;
  name: string;
  color: string;
  category?: 'todo' | 'inProgress' | 'complete';
};

export type SelectTypeOptions = {
  choices: Choice[];
  choiceOrder: string[];
  disableColors?: boolean;
  defaultValue?: string | string[] | null;
};

export type RelationTypeOptions = {
  // Page id of the target base.
  targetPageId: string;
  // Paired reverse property id on the target base.
  relatedPropertyId?: string | null;
};

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'ncontains'
  | 'startsWith'
  | 'endsWith'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'before'
  | 'after'
  | 'onOrBefore'
  | 'onOrAfter'
  | 'any'
  | 'none'
  | 'all'
  | 'isWithin';

export type DateFilterAnchor =
  | 'today'
  | 'tomorrow'
  | 'yesterday'
  | 'oneWeekAgo'
  | 'oneWeekFromNow'
  | 'oneMonthAgo'
  | 'oneMonthFromNow';

export type DateFilterRange =
  | 'pastWeek'
  | 'pastMonth'
  | 'pastYear'
  | 'thisWeek'
  | 'thisMonth'
  | 'thisYear'
  | 'nextWeek'
  | 'nextMonth'
  | 'nextYear';

export type DateFilterValue =
  | { mode: 'exact'; date: string }
  | { mode: 'relative'; preset: DateFilterAnchor }
  | { mode: 'range'; preset: DateFilterRange };

export type FilterCondition = {
  propertyId: string;
  op: FilterOperator;
  value?: unknown;
};

export type FilterGroup = {
  op: 'and' | 'or';
  children: Array<FilterCondition | FilterGroup>;
};

export type FilterNode = FilterCondition | FilterGroup;

export type ViewSortConfig = {
  propertyId: string;
  direction: 'asc' | 'desc';
};

export type ViewConfig = {
  sorts?: ViewSortConfig[];
  filter?: FilterGroup;
  visiblePropertyIds?: string[];
  hiddenPropertyIds?: string[];
  propertyWidths?: Record<string, number>;
  propertyOrder?: string[];
  groupByPropertyId?: string;
  hiddenChoiceIds?: string[];
  choiceOrder?: string[];
};

export type ViewConfigPatch = {
  [K in keyof ViewConfig]?: ViewConfig[K] | null;
};

export type UserRef = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
};

export type ResolvedPage = {
  id: string;
  slugId: string;
  title: string | null;
  icon: string | null;
  spaceId: string;
  space: { id: string; slug: string; name: string } | null;
};

export type RowReferences = {
  users: Record<string, UserRef>;
  pages: Record<string, ResolvedPage>;
};

export function isFilterGroup(node: FilterNode): node is FilterGroup {
  return (
    typeof node === 'object' &&
    node !== null &&
    (node as FilterGroup).op !== undefined &&
    Array.isArray((node as FilterGroup).children)
  );
}
