'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Phone, 
  Plus, 
  Trash2, 
  Play, 
  Settings,
  ArrowRight,
  PhoneCall,
  Mic,
  Hash,
  Clock,
  Copy,
  Edit,
  Save,
  X
} from 'lucide-react'
import type { IVRFlow, IVRStep } from '@/hooks/useTwilio'
import { toast } from 'sonner'

interface IVRDesignerProps {
  flows: IVRFlow[]
  onCreateFlow: (flow: Omit<IVRFlow, 'id'>) => Promise<void>
  onUpdateFlow: (flowId: string, updates: Partial<IVRFlow>) => Promise<void>
  onDeleteFlow: (flowId: string) => Promise<void>
  onActivateFlow: (flowId: string, phoneNumberSid: string) => Promise<void>
  phoneNumbers: Array<{ sid: string; phoneNumber: string; friendlyName: string }>
  loading?: boolean
}

export function IVRDesigner({ 
  flows, 
  onCreateFlow, 
  onUpdateFlow, 
  onDeleteFlow,
  onActivateFlow,
  phoneNumbers,
  loading = false 
}: IVRDesignerProps) {
  const [selectedFlow, setSelectedFlow] = useState<IVRFlow | null>(null)
  const [editingFlow, setEditingFlow] = useState<IVRFlow | null>(null)
  const [newFlow, setNewFlow] = useState<Omit<IVRFlow, 'id'>>({
    name: '',
    steps: [],
    isActive: false
  })
  const [newStep, setNewStep] = useState<Partial<IVRStep>>({
    type: 'welcome',
    message: '',
    options: {}
  })
  const [showStepModal, setShowStepModal] = useState(false)
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null)

  const stepTypes = [
    { value: 'welcome', label: 'Welcome Message', icon: Phone },
    { value: 'menu', label: 'Menu Options', icon: Hash },
    { value: 'gather', label: 'Collect Input', icon: Settings },
    { value: 'record', label: 'Record Message', icon: Mic },
    { value: 'transfer', label: 'Transfer Call', icon: PhoneCall },
    { value: 'hangup', label: 'End Call', icon: X }
  ]

  const handleCreateFlow = async () => {
    if (!newFlow.name || newFlow.steps.length === 0) {
      toast.error('Please provide a flow name and at least one step')
      return
    }

    try {
      await onCreateFlow(newFlow)
      toast.success('IVR flow created successfully')
      setNewFlow({ name: '', steps: [], isActive: false })
    } catch (error) {
      console.error('Error creating flow:', error)
      toast.error('Failed to create IVR flow')
    }
  }

  const handleUpdateFlow = async () => {
    if (!editingFlow) return

    try {
      await onUpdateFlow(editingFlow.id, editingFlow)
      toast.success('IVR flow updated successfully')
      setEditingFlow(null)
    } catch (error) {
      console.error('Error updating flow:', error)
      toast.error('Failed to update IVR flow')
    }
  }

  const handleAddStep = useCallback(() => {
    if (!newStep.type || !newStep.message) {
      toast.error('Please provide step type and message')
      return
    }

    const step: IVRStep = {
      id: `step_${Date.now()}`,
      type: newStep.type as any,
      message: newStep.message,
      options: newStep.options || {},
      nextSteps: newStep.nextSteps || {}
    }

    if (editingFlow) {
      setEditingFlow(prev => prev ? {
        ...prev,
        steps: [...prev.steps, step]
      } : null)
    } else {
      setNewFlow(prev => ({
        ...prev,
        steps: [...prev.steps, step]
      }))
    }

    setNewStep({ type: 'welcome', message: '', options: {} })
    setShowStepModal(false)
  }, [newStep, editingFlow])

  const handleEditStep = (stepIndex: number) => {
    const step = editingFlow?.steps[stepIndex] || newFlow.steps[stepIndex]
    if (step) {
      setNewStep(step)
      setEditingStepIndex(stepIndex)
      setShowStepModal(true)
    }
  }

  const handleUpdateStep = useCallback(() => {
    if (!newStep.type || !newStep.message || editingStepIndex === null) return

    const updatedStep: IVRStep = {
      id: newStep.id || `step_${Date.now()}`,
      type: newStep.type as any,
      message: newStep.message,
      options: newStep.options || {},
      nextSteps: newStep.nextSteps || {}
    }

    if (editingFlow) {
      setEditingFlow(prev => prev ? {
        ...prev,
        steps: prev.steps.map((step, index) => 
          index === editingStepIndex ? updatedStep : step
        )
      } : null)
    } else {
      setNewFlow(prev => ({
        ...prev,
        steps: prev.steps.map((step, index) => 
          index === editingStepIndex ? updatedStep : step
        )
      }))
    }

    setNewStep({ type: 'welcome', message: '', options: {} })
    setEditingStepIndex(null)
    setShowStepModal(false)
  }, [newStep, editingStepIndex, editingFlow])

  const handleDeleteStep = (stepIndex: number) => {
    if (editingFlow) {
      setEditingFlow(prev => prev ? {
        ...prev,
        steps: prev.steps.filter((_, index) => index !== stepIndex)
      } : null)
    } else {
      setNewFlow(prev => ({
        ...prev,
        steps: prev.steps.filter((_, index) => index !== stepIndex)
      }))
    }
  }

  const renderStepOptions = (step: IVRStep) => {
    const options = []
    
    if (step.options?.numDigits) {
      options.push(`${step.options.numDigits} digits`)
    }
    if (step.options?.timeout) {
      options.push(`${step.options.timeout}s timeout`)
    }
    if (step.options?.finishOnKey) {
      options.push(`End on ${step.options.finishOnKey}`)
    }
    if (step.options?.transferNumber) {
      options.push(`Transfer to ${step.options.transferNumber}`)
    }
    
    return options.join(' • ')
  }

  const renderStepModal = () => {
    if (!showStepModal) return null

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">
              {editingStepIndex !== null ? 'Edit Step' : 'Add Step'}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowStepModal(false)
                setEditingStepIndex(null)
                setNewStep({ type: 'welcome', message: '', options: {} })
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="stepType">Step Type</Label>
              <Select
                value={newStep.type}
                onValueChange={(value) => setNewStep(prev => ({ ...prev, type: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select step type" />
                </SelectTrigger>
                <SelectContent>
                  {stepTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="stepMessage">Message</Label>
              <Textarea
                id="stepMessage"
                value={newStep.message}
                onChange={(e) => setNewStep(prev => ({ ...prev, message: e.target.value }))}
                placeholder="Enter the message for this step..."
                rows={3}
              />
            </div>

            {/* Step-specific options */}
            {(newStep.type === 'menu' || newStep.type === 'gather') && (
              <>
                <div>
                  <Label htmlFor="numDigits">Number of Digits</Label>
                  <Input
                    id="numDigits"
                    type="number"
                    value={newStep.options?.numDigits || ''}
                    onChange={(e) => setNewStep(prev => ({
                      ...prev,
                      options: { ...prev.options, numDigits: parseInt(e.target.value) }
                    }))}
                    placeholder="1"
                  />
                </div>
                <div>
                  <Label htmlFor="timeout">Timeout (seconds)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    value={newStep.options?.timeout || ''}
                    onChange={(e) => setNewStep(prev => ({
                      ...prev,
                      options: { ...prev.options, timeout: parseInt(e.target.value) }
                    }))}
                    placeholder="10"
                  />
                </div>
                <div>
                  <Label htmlFor="finishOnKey">Finish on Key</Label>
                  <Input
                    id="finishOnKey"
                    value={newStep.options?.finishOnKey || ''}
                    onChange={(e) => setNewStep(prev => ({
                      ...prev,
                      options: { ...prev.options, finishOnKey: e.target.value }
                    }))}
                    placeholder="#"
                  />
                </div>
              </>
            )}

            {newStep.type === 'record' && (
              <div>
                <Label htmlFor="maxLength">Max Length (seconds)</Label>
                <Input
                  id="maxLength"
                  type="number"
                  value={newStep.options?.maxLength || ''}
                  onChange={(e) => setNewStep(prev => ({
                    ...prev,
                    options: { ...prev.options, maxLength: parseInt(e.target.value) }
                  }))}
                  placeholder="60"
                />
              </div>
            )}

            {newStep.type === 'transfer' && (
              <div>
                <Label htmlFor="transferNumber">Transfer Number</Label>
                <Input
                  id="transferNumber"
                  value={newStep.options?.transferNumber || ''}
                  onChange={(e) => setNewStep(prev => ({
                    ...prev,
                    options: { ...prev.options, transferNumber: e.target.value }
                  }))}
                  placeholder="+1234567890"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setShowStepModal(false)
                setEditingStepIndex(null)
                setNewStep({ type: 'welcome', message: '', options: {} })
              }}
            >
              Cancel
            </Button>
            <Button onClick={editingStepIndex !== null ? handleUpdateStep : handleAddStep}>
              {editingStepIndex !== null ? 'Update Step' : 'Add Step'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {renderStepModal()}
      
      <Tabs defaultValue="flows" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="flows">IVR Flows</TabsTrigger>
          <TabsTrigger value="designer">Flow Designer</TabsTrigger>
        </TabsList>

        <TabsContent value="flows" className="space-y-4">
          <div className="grid gap-4">
            {flows.map((flow) => (
              <Card key={flow.id} className={flow.isActive ? 'border-green-500' : ''}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {flow.name}
                        {flow.isActive && <Badge variant="success">Active</Badge>}
                      </CardTitle>
                      <CardDescription>
                        {flow.steps.length} steps
                        {flow.phoneNumberSid && (
                          <span className="ml-2">
                            • Phone: {phoneNumbers.find(p => p.sid === flow.phoneNumberSid)?.phoneNumber}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingFlow(flow)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDeleteFlow(flow.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {flow.steps.map((step, index) => {
                      const StepIcon = stepTypes.find(t => t.value === step.type)?.icon || Phone
                      return (
                        <div key={step.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                          <StepIcon className="h-4 w-4 text-gray-500" />
                          <div className="flex-1">
                            <div className="font-medium">{step.type.replace('_', ' ')}</div>
                            <div className="text-sm text-gray-600 truncate">{step.message}</div>
                            {renderStepOptions(step) && (
                              <div className="text-xs text-gray-500 mt-1">
                                {renderStepOptions(step)}
                              </div>
                            )}
                          </div>
                          {index < flow.steps.length - 1 && (
                            <ArrowRight className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                  
                  {!flow.isActive && (
                    <div className="mt-4 flex gap-2">
                      <Select onValueChange={(phoneNumberSid) => onActivateFlow(flow.id, phoneNumberSid)}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Activate on phone number" />
                        </SelectTrigger>
                        <SelectContent>
                          {phoneNumbers.map(phone => (
                            <SelectItem key={phone.sid} value={phone.sid}>
                              {phone.phoneNumber} ({phone.friendlyName})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="designer" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {editingFlow ? `Edit Flow: ${editingFlow.name}` : 'Create New IVR Flow'}
              </CardTitle>
              <CardDescription>
                Design your interactive voice response flow step by step
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <Label htmlFor="flowName">Flow Name</Label>
                  <Input
                    id="flowName"
                    value={editingFlow?.name || newFlow.name}
                    onChange={(e) => {
                      if (editingFlow) {
                        setEditingFlow(prev => prev ? { ...prev, name: e.target.value } : null)
                      } else {
                        setNewFlow(prev => ({ ...prev, name: e.target.value }))
                      }
                    }}
                    placeholder="Enter flow name..."
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-4">
                    <Label>Flow Steps</Label>
                    <Button onClick={() => setShowStepModal(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Step
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {(editingFlow?.steps || newFlow.steps).map((step, index) => {
                      const StepIcon = stepTypes.find(t => t.value === step.type)?.icon || Phone
                      return (
                        <div key={step.id} className="flex items-center gap-3 p-4 border rounded-lg">
                          <StepIcon className="h-5 w-5 text-blue-500" />
                          <div className="flex-1">
                            <div className="font-medium capitalize">
                              {step.type.replace('_', ' ')}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              {step.message}
                            </div>
                            {renderStepOptions(step) && (
                              <div className="text-xs text-gray-500 mt-1">
                                {renderStepOptions(step)}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditStep(index)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteStep(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {(editingFlow?.steps || newFlow.steps).length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      No steps added yet. Click &quot;Add Step&quot; to get started.
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  {editingFlow && (
                    <Button
                      variant="outline"
                      onClick={() => setEditingFlow(null)}
                    >
                      Cancel
                    </Button>
                  )}
                  <Button 
                    onClick={editingFlow ? handleUpdateFlow : handleCreateFlow}
                    disabled={loading}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {editingFlow ? 'Update Flow' : 'Create Flow'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}