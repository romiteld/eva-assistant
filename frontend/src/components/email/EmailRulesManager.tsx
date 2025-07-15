'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Plus,
  Trash2,
  Edit,
  Save,
  X,
  Copy,
  Play,
  Pause,
  AlertCircle,
  CheckCircle,
  Filter,
  Zap,
  Settings,
  TestTube,
  Code,
  Mail,
  FileText,
  Users,
  Calendar,
  Tag,
  ArrowRight,
  Wand2
} from 'lucide-react';
import { AutomationRule, RuleCondition, RuleAction } from '@/lib/automation/email-rules';
import { supabase } from '@/lib/supabase/browser';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface RuleTemplate {
  name: string;
  description: string;
  icon: React.ReactNode;
  rule: Partial<AutomationRule>;
}

const ruleTemplates: RuleTemplate[] = [
  {
    name: 'Client Inquiry Handler',
    description: 'Automatically create deals from client inquiries',
    icon: <Mail className="w-5 h-5" />,
    rule: {
      name: 'Client Inquiry to Deal',
      description: 'Creates deals from emails containing hiring keywords',
      priority: 10,
      conditions: [
        {
          field: 'subject',
          operator: 'contains',
          value: ['position', 'role', 'hiring', 'recruitment']
        }
      ],
      actions: [
        { type: 'create_deal', template: 'client_inquiry' },
        { type: 'notify', users: ['account_manager'] },
        { type: 'send_reply', template: 'acknowledge_inquiry' }
      ]
    }
  },
  {
    name: 'Resume Processor',
    description: 'Parse resumes and create candidate profiles',
    icon: <FileText className="w-5 h-5" />,
    rule: {
      name: 'Resume Processing',
      description: 'Automatically process candidate applications',
      priority: 8,
      conditions: [
        {
          field: 'attachments',
          operator: 'has',
          value: ['resume', 'cv', 'pdf', 'doc']
        }
      ],
      actions: [
        { type: 'create_contact', params: { category: 'candidate' } },
        { type: 'parse_resume', destination: 'contact_fields' },
        { type: 'match_to_jobs', notify: true }
      ]
    }
  },
  {
    name: 'Urgent Request Escalation',
    description: 'Prioritize and escalate urgent emails',
    icon: <Zap className="w-5 h-5" />,
    rule: {
      name: 'Urgent Request Handler',
      description: 'Fast-track urgent client requests',
      priority: 15,
      conditions: [
        {
          field: 'subject',
          operator: 'contains',
          value: ['urgent', 'asap', 'critical', 'emergency']
        }
      ],
      actions: [
        { type: 'create_deal', params: { priority: 'high' } },
        { type: 'notify', users: ['manager'] },
        { type: 'create_task', params: { priority: 'high', dueIn: 2 } }
      ]
    }
  }
];

const conditionFields = [
  { value: 'from', label: 'From Email' },
  { value: 'to', label: 'To Email' },
  { value: 'subject', label: 'Subject' },
  { value: 'body', label: 'Body' },
  { value: 'attachments', label: 'Attachments' },
  { value: 'domain', label: 'Sender Domain' }
];

const conditionOperators = [
  { value: 'contains', label: 'Contains' },
  { value: 'not_contains', label: 'Does not contain' },
  { value: 'equals', label: 'Equals' },
  { value: 'domain_in', label: 'Domain is in' },
  { value: 'has', label: 'Has' },
  { value: 'matches_regex', label: 'Matches pattern' }
];

const actionTypes = [
  { value: 'create_deal', label: 'Create Deal', icon: <Zap className="w-4 h-4" /> },
  { value: 'update_deal', label: 'Update Deal', icon: <Edit className="w-4 h-4" /> },
  { value: 'create_contact', label: 'Create Contact', icon: <Users className="w-4 h-4" /> },
  { value: 'parse_resume', label: 'Parse Resume', icon: <FileText className="w-4 h-4" /> },
  { value: 'notify', label: 'Send Notification', icon: <AlertCircle className="w-4 h-4" /> },
  { value: 'send_reply', label: 'Send Reply', icon: <Mail className="w-4 h-4" /> },
  { value: 'create_task', label: 'Create Task', icon: <Calendar className="w-4 h-4" /> },
  { value: 'add_tag', label: 'Add Tag', icon: <Tag className="w-4 h-4" /> }
];

export function EmailRulesManager() {
  const { user } = useAuth();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<RuleTemplate | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testResults, setTestResults] = useState<any>(null);

  // Load rules
  const loadRules = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('email_automation_rules')
        .select('*')
        .eq('user_id', user.id)
        .order('priority', { ascending: false });

      if (error) throw error;

      const parsedRules = data.map(rule => ({
        ...rule,
        conditions: JSON.parse(rule.conditions),
        actions: JSON.parse(rule.actions),
        createdAt: new Date(rule.created_at),
        updatedAt: new Date(rule.updated_at)
      }));

      setRules(parsedRules);
    } catch (error) {
      console.error('Error loading rules:', error);
      toast({
        title: 'Error',
        description: 'Failed to load automation rules',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, [user]);

  // Create or update rule
  const saveRule = async (rule: Partial<AutomationRule>) => {
    if (!user) return;

    try {
      const ruleData = {
        user_id: user.id,
        name: rule.name,
        description: rule.description,
        active: rule.active ?? true,
        priority: rule.priority ?? 5,
        conditions: JSON.stringify(rule.conditions || []),
        condition_logic: rule.conditionLogic || 'AND',
        actions: JSON.stringify(rule.actions || []),
        stop_on_match: rule.stopOnMatch ?? false
      };

      if (editingRule?.id) {
        // Update existing rule
        const { error } = await supabase
          .from('email_automation_rules')
          .update(ruleData)
          .eq('id', editingRule.id)
          .eq('user_id', user.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Rule updated successfully'
        });
      } else {
        // Create new rule
        const { error } = await supabase
          .from('email_automation_rules')
          .insert(ruleData);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Rule created successfully'
        });
      }

      await loadRules();
      setEditingRule(null);
      setShowCreateDialog(false);
    } catch (error) {
      console.error('Error saving rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to save rule',
        variant: 'destructive'
      });
    }
  };

  // Delete rule
  const deleteRule = async (ruleId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('email_automation_rules')
        .delete()
        .eq('id', ruleId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Rule deleted successfully'
      });

      await loadRules();
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete rule',
        variant: 'destructive'
      });
    }
  };

  // Toggle rule active status
  const toggleRuleStatus = async (rule: AutomationRule) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('email_automation_rules')
        .update({ active: !rule.active })
        .eq('id', rule.id)
        .eq('user_id', user.id);

      if (error) throw error;

      await loadRules();
    } catch (error) {
      console.error('Error toggling rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to update rule status',
        variant: 'destructive'
      });
    }
  };

  // Test rule
  const testRule = async (rule: AutomationRule) => {
    if (!testEmail) {
      toast({
        title: 'Error',
        description: 'Please enter a test email content',
        variant: 'destructive'
      });
      return;
    }

    try {
      const response = await fetch('/api/email/test-rule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rule,
          email: {
            id: 'test-' + Date.now(),
            from: { email: 'test@example.com', name: 'Test User' },
            subject: 'Test Email',
            body: testEmail,
            receivedAt: new Date().toISOString()
          }
        })
      });

      const result = await response.json();
      setTestResults(result);

      toast({
        title: result.matched ? 'Rule Matched!' : 'No Match',
        description: result.matched 
          ? `Executed ${result.actions.length} actions`
          : 'The rule conditions did not match the test email'
      });
    } catch (error) {
      console.error('Error testing rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to test rule',
        variant: 'destructive'
      });
    }
  };

  const RuleEditor = ({ rule, onSave, onCancel }: any) => {
    const [formData, setFormData] = useState<Partial<AutomationRule>>(
      rule || {
        name: '',
        description: '',
        priority: 5,
        conditions: [],
        conditionLogic: 'AND',
        actions: [],
        stopOnMatch: false,
        active: true
      }
    );

    const addCondition = () => {
      setFormData({
        ...formData,
        conditions: [
          ...(formData.conditions || []),
          { field: 'subject', operator: 'contains', value: '' }
        ]
      });
    };

    const updateCondition = (index: number, updates: Partial<RuleCondition>) => {
      const newConditions = [...(formData.conditions || [])];
      newConditions[index] = { ...newConditions[index], ...updates };
      setFormData({ ...formData, conditions: newConditions });
    };

    const removeCondition = (index: number) => {
      const newConditions = [...(formData.conditions || [])];
      newConditions.splice(index, 1);
      setFormData({ ...formData, conditions: newConditions });
    };

    const addAction = () => {
      setFormData({
        ...formData,
        actions: [
          ...(formData.actions || []),
          { type: 'notify', params: {} }
        ]
      });
    };

    const updateAction = (index: number, updates: Partial<RuleAction>) => {
      const newActions = [...(formData.actions || [])];
      newActions[index] = { ...newActions[index], ...updates };
      setFormData({ ...formData, actions: newActions });
    };

    const removeAction = (index: number) => {
      const newActions = [...(formData.actions || [])];
      newActions.splice(index, 1);
      setFormData({ ...formData, actions: newActions });
    };

    return (
      <div className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <div>
            <Label>Rule Name</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Client Inquiry Handler"
            />
          </div>
          
          <div>
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this rule does..."
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label>Priority</Label>
              <Input
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                min="1"
                max="100"
                className="w-24"
              />
              <p className="text-sm text-gray-500 mt-1">Higher priority rules run first</p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.stopOnMatch}
                  onCheckedChange={(checked) => setFormData({ ...formData, stopOnMatch: checked })}
                />
                <Label>Stop on match</Label>
              </div>
              
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
                <Label>Active</Label>
              </div>
            </div>
          </div>
        </div>

        {/* Conditions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Conditions</Label>
            <Select
              value={formData.conditionLogic}
              onValueChange={(value: 'AND' | 'OR') => 
                setFormData({ ...formData, conditionLogic: value })
              }
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AND">AND</SelectItem>
                <SelectItem value="OR">OR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            {formData.conditions?.map((condition, index) => (
              <div key={index} className="flex items-center gap-2">
                <Select
                  value={condition.field}
                  onValueChange={(value) => updateCondition(index, { field: value as any })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {conditionFields.map(field => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select
                  value={condition.operator}
                  onValueChange={(value) => updateCondition(index, { operator: value as any })}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {conditionOperators.map(op => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Input
                  value={Array.isArray(condition.value) ? condition.value.join(', ') : condition.value instanceof RegExp ? condition.value.toString() : condition.value}
                  onChange={(e) => updateCondition(index, { 
                    value: e.target.value.includes(',') 
                      ? e.target.value.split(',').map(v => v.trim())
                      : e.target.value 
                  })}
                  placeholder="Value"
                  className="flex-1"
                />
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCondition(index)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
            
            <Button
              variant="outline"
              size="sm"
              onClick={addCondition}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Condition
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div>
          <Label className="mb-2">Actions</Label>
          
          <div className="space-y-2">
            {formData.actions?.map((action, index) => (
              <div key={index} className="flex items-center gap-2">
                <Select
                  value={action.type}
                  onValueChange={(value) => updateAction(index, { type: value as any })}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {actionTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          {type.icon}
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {action.type === 'notify' && (
                  <Input
                    value={action.users?.join(', ') || ''}
                    onChange={(e) => updateAction(index, { 
                      users: e.target.value.split(',').map(u => u.trim()) 
                    })}
                    placeholder="User IDs or roles"
                    className="flex-1"
                  />
                )}
                
                {action.type === 'send_reply' && (
                  <Input
                    value={action.template || ''}
                    onChange={(e) => updateAction(index, { template: e.target.value })}
                    placeholder="Reply template"
                    className="flex-1"
                  />
                )}
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeAction(index)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
            
            <Button
              variant="outline"
              size="sm"
              onClick={addAction}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Action
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onSave(formData)}>
            <Save className="w-4 h-4 mr-2" />
            Save Rule
          </Button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Email Automation Rules</h2>
          <p className="text-gray-600">Configure rules to automate email processing</p>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRule ? 'Edit Rule' : 'Create New Rule'}
              </DialogTitle>
              <DialogDescription>
                {editingRule 
                  ? 'Update your automation rule settings'
                  : 'Choose a template or create a custom rule'
                }
              </DialogDescription>
            </DialogHeader>
            
            {!editingRule && !selectedTemplate && (
              <div className="space-y-4">
                <h3 className="font-semibold">Start with a template</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ruleTemplates.map((template) => (
                    <Card
                      key={template.name}
                      className="cursor-pointer hover:border-blue-500 transition-colors"
                      onClick={() => setSelectedTemplate(template)}
                    >
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          {template.icon}
                          {template.name}
                        </CardTitle>
                        <CardDescription>{template.description}</CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
                
                <div className="text-center">
                  <p className="text-gray-500 mb-2">or</p>
                  <Button
                    variant="outline"
                    onClick={() => setEditingRule({} as AutomationRule)}
                  >
                    <Wand2 className="w-4 h-4 mr-2" />
                    Create Custom Rule
                  </Button>
                </div>
              </div>
            )}
            
            {(editingRule || selectedTemplate) && (
              <RuleEditor
                rule={editingRule || selectedTemplate?.rule}
                onSave={saveRule}
                onCancel={() => {
                  setEditingRule(null);
                  setSelectedTemplate(null);
                  setShowCreateDialog(false);
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Rules List */}
      <div className="space-y-4">
        {rules.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Mail className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No automation rules yet</h3>
              <p className="text-gray-600 mb-4">
                Create your first rule to start automating email processing
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Rule
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Accordion type="single" collapsible className="space-y-2">
            {rules.map((rule) => (
              <AccordionItem key={rule.id} value={rule.id}>
                <Card>
                  <AccordionTrigger className="px-6 py-4 hover:no-underline">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-4">
                        <Switch
                          checked={rule.active}
                          onCheckedChange={() => toggleRuleStatus(rule)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="text-left">
                          <h3 className="font-semibold">{rule.name}</h3>
                          <p className="text-sm text-gray-600">{rule.description}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Priority: {rule.priority}</Badge>
                        {rule.stopOnMatch && (
                          <Badge variant="secondary">Stop on match</Badge>
                        )}
                        {rule.stats && (
                          <Badge variant="default">
                            {rule.stats.matches} matches
                          </Badge>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>
                  
                  <AccordionContent>
                    <CardContent className="pt-4">
                      <Tabs defaultValue="details">
                        <TabsList>
                          <TabsTrigger value="details">Details</TabsTrigger>
                          <TabsTrigger value="test">Test</TabsTrigger>
                          <TabsTrigger value="stats">Statistics</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="details" className="space-y-4">
                          {/* Conditions */}
                          <div>
                            <h4 className="font-semibold mb-2">Conditions ({rule.conditionLogic})</h4>
                            <div className="space-y-1">
                              {rule.conditions.map((condition, index) => (
                                <div key={index} className="flex items-center gap-2 text-sm">
                                  <Filter className="w-4 h-4 text-gray-400" />
                                  <span className="font-medium">{condition.field}</span>
                                  <span className="text-gray-600">{condition.operator}</span>
                                  <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                                    {Array.isArray(condition.value) 
                                      ? condition.value.join(', ')
                                      : condition.value instanceof RegExp 
                                        ? condition.value.toString()
                                        : String(condition.value)
                                    }
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* Actions */}
                          <div>
                            <h4 className="font-semibold mb-2">Actions</h4>
                            <div className="space-y-1">
                              {rule.actions.map((action, index) => (
                                <div key={index} className="flex items-center gap-2 text-sm">
                                  <ArrowRight className="w-4 h-4 text-gray-400" />
                                  <span className="font-medium">
                                    {actionTypes.find(t => t.value === action.type)?.label}
                                  </span>
                                  {action.template && (
                                    <span className="text-gray-600">
                                      using template: {action.template}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex justify-end gap-2 pt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingRule(rule);
                                setShowCreateDialog(true);
                              }}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteRule(rule.id)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </Button>
                          </div>
                        </TabsContent>
                        
                        <TabsContent value="test" className="space-y-4">
                          <div>
                            <Label>Test Email Content</Label>
                            <Textarea
                              value={testEmail}
                              onChange={(e) => setTestEmail(e.target.value)}
                              placeholder="Enter email content to test against this rule..."
                              rows={5}
                            />
                          </div>
                          
                          <Button onClick={() => testRule(rule)}>
                            <TestTube className="w-4 h-4 mr-2" />
                            Test Rule
                          </Button>
                          
                          {testResults && (
                            <Alert>
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>
                                <div className="space-y-2">
                                  <p>
                                    <strong>Matched:</strong> {testResults.matched ? 'Yes' : 'No'}
                                  </p>
                                  {testResults.matched && (
                                    <>
                                      <p>
                                        <strong>Actions executed:</strong> {testResults.actions.length}
                                      </p>
                                      <ul className="list-disc pl-4">
                                        {testResults.actions.map((action: any, i: number) => (
                                          <li key={i}>
                                            {action.type}: {action.success ? 'Success' : 'Failed'}
                                          </li>
                                        ))}
                                      </ul>
                                    </>
                                  )}
                                </div>
                              </AlertDescription>
                            </Alert>
                          )}
                        </TabsContent>
                        
                        <TabsContent value="stats">
                          {rule.stats ? (
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm text-gray-600">Total Matches</p>
                                <p className="text-2xl font-bold">{rule.stats.matches}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-600">Last Match</p>
                                <p className="text-sm">
                                  {rule.stats.lastMatch 
                                    ? new Date(rule.stats.lastMatch).toLocaleString()
                                    : 'Never'
                                  }
                                </p>
                              </div>
                              {rule.stats.avgProcessingTime && (
                                <div>
                                  <p className="text-sm text-gray-600">Avg Processing Time</p>
                                  <p className="text-lg font-semibold">
                                    {(rule.stats.avgProcessingTime / 1000).toFixed(2)}s
                                  </p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-gray-500">No statistics available yet</p>
                          )}
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </AccordionContent>
                </Card>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </div>
  );
}