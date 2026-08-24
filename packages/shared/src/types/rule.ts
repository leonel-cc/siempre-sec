export enum AlertAction {
  CREATE_ALERT = 'CREATE_ALERT',
  SEND_NOTIFICATION = 'SEND_NOTIFICATION',
  LOG_EVENT = 'LOG_EVENT',
  NO_ACTION = 'NO_ACTION',
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  conditions: RuleCondition[];
  actions: AlertAction[];
  schedule?: ScheduleConfig;
  cooldown_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface RuleCondition {
  field: ConditionField;
  operator: ConditionOperator;
  value: string | number | boolean;
}

export enum ConditionField {
  OBJECT_CLASS = 'object_class',
  IDENTITY = 'identity',
  ZONE_TYPE = 'zone_type',
  TIME_OF_DAY = 'time_of_day',
  PRESENCE_DURATION = 'presence_duration',
  CONFIDENCE = 'confidence',
}

export enum ConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  IN = 'in',
  BETWEEN = 'between',
}

export interface ScheduleConfig {
  enabled: boolean;
  start_time: string;
  end_time: string;
  days: DayOfWeek[];
}

export enum DayOfWeek {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday',
}

export interface CreateRuleDto {
  name: string;
  description?: string;
  enabled?: boolean;
  priority?: number;
  conditions: RuleCondition[];
  actions: AlertAction[];
  schedule?: ScheduleConfig;
  cooldown_seconds?: number;
}
