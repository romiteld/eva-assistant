// Task Validation Component

import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Task, TaskStatus, VALID_STATUS_TRANSITIONS, TASK_VALIDATION } from '@/types/task';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';

interface TaskValidationProps {
  task: Partial<Task>;
  currentStatus?: TaskStatus;
  targetStatus?: TaskStatus;
}

export const TaskValidation: React.FC<TaskValidationProps> = ({
  task,
  currentStatus,
  targetStatus
}) => {
  const validationErrors: string[] = [];
  const validationWarnings: string[] = [];

  // Validate task fields
  if (task.title) {
    if (task.title.length === 0) {
      validationErrors.push('Title is required');
    } else if (task.title.length > TASK_VALIDATION.TITLE_MAX_LENGTH) {
      validationErrors.push(`Title exceeds maximum length of ${TASK_VALIDATION.TITLE_MAX_LENGTH} characters`);
    }
  }

  if (task.description && task.description.length > TASK_VALIDATION.DESCRIPTION_MAX_LENGTH) {
    validationErrors.push(`Description exceeds maximum length of ${TASK_VALIDATION.DESCRIPTION_MAX_LENGTH} characters`);
  }

  if (task.priority !== undefined) {
    if (task.priority < TASK_VALIDATION.PRIORITY_MIN || task.priority > TASK_VALIDATION.PRIORITY_MAX) {
      validationErrors.push(`Priority must be between ${TASK_VALIDATION.PRIORITY_MIN} and ${TASK_VALIDATION.PRIORITY_MAX}`);
    }
  }

  if (task.tags) {
    if (task.tags.length > TASK_VALIDATION.TAGS_MAX_COUNT) {
      validationErrors.push(`Cannot have more than ${TASK_VALIDATION.TAGS_MAX_COUNT} tags`);
    }
    
    task.tags.forEach(tag => {
      if (tag.length > TASK_VALIDATION.TAG_MAX_LENGTH) {
        validationErrors.push(`Tag "${tag}" exceeds maximum length of ${TASK_VALIDATION.TAG_MAX_LENGTH} characters`);
      }
    });
  }

  if (task.due_date && task.created_at) {
    if (new Date(task.due_date) < new Date(task.created_at)) {
      validationErrors.push('Due date cannot be before creation date');
    }
  }

  // Validate status transition
  if (currentStatus && targetStatus) {
    const validTransitions = VALID_STATUS_TRANSITIONS[currentStatus];
    if (!validTransitions.includes(targetStatus)) {
      validationErrors.push(`Cannot transition from ${currentStatus} to ${targetStatus}`);
    }
  }

  // Add warnings
  if (task.due_date && new Date(task.due_date) < new Date()) {
    validationWarnings.push('Due date is in the past');
  }

  if (task.estimated_hours && task.actual_hours) {
    if (task.actual_hours > task.estimated_hours * 2) {
      validationWarnings.push('Actual hours significantly exceed estimated hours');
    }
  }

  if (validationErrors.length === 0 && validationWarnings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              {validationErrors.map((error, index) => (
                <div key={index} className="flex items-center gap-2">
                  <XCircle className="h-3 w-3" />
                  <span>{error}</span>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {validationWarnings.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              {validationWarnings.map((warning, index) => (
                <div key={index} className="flex items-center gap-2">
                  <AlertCircle className="h-3 w-3" />
                  <span>{warning}</span>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

interface StatusTransitionValidatorProps {
  currentStatus: TaskStatus;
  onSelectStatus: (status: TaskStatus) => void;
}

export const StatusTransitionValidator: React.FC<StatusTransitionValidatorProps> = ({
  currentStatus,
  onSelectStatus
}) => {
  const validTransitions = VALID_STATUS_TRANSITIONS[currentStatus];

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-600">Current status: <Badge>{currentStatus}</Badge></p>
      
      <div className="space-y-2">
        <p className="text-sm font-medium">Available transitions:</p>
        <div className="flex flex-wrap gap-2">
          {validTransitions.length > 0 ? (
            validTransitions.map(status => (
              <Badge
                key={status}
                variant="outline"
                className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                onClick={() => onSelectStatus(status)}
              >
                {status}
              </Badge>
            ))
          ) : (
            <p className="text-sm text-gray-500">No transitions available from this status</p>
          )}
        </div>
      </div>
    </div>
  );
};

interface PriorityValidatorProps {
  priority: number;
  onChange: (priority: number) => void;
}

export const PriorityValidator: React.FC<PriorityValidatorProps> = ({
  priority,
  onChange
}) => {
  const isValid = priority >= TASK_VALIDATION.PRIORITY_MIN && priority <= TASK_VALIDATION.PRIORITY_MAX;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={TASK_VALIDATION.PRIORITY_MIN}
          max={TASK_VALIDATION.PRIORITY_MAX}
          value={priority}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
          className="flex-1"
        />
        <span className="text-sm font-medium w-8 text-center">{priority}</span>
        {isValid ? (
          <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
          <XCircle className="h-4 w-4 text-red-500" />
        )}
      </div>
      
      <div className="flex justify-between text-xs text-gray-500">
        <span>Low Priority</span>
        <span>High Priority</span>
      </div>
      
      {!isValid && (
        <p className="text-sm text-red-500">
          Priority must be between {TASK_VALIDATION.PRIORITY_MIN} and {TASK_VALIDATION.PRIORITY_MAX}
        </p>
      )}
    </div>
  );
};