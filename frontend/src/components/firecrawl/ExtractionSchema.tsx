'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, 
  Trash2, 
  Code2, 
  FileJson,
  ChevronDown,
  ChevronRight,
  Hash,
  Type,
  ToggleLeft,
  Calendar,
  List,
  Layers
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SchemaField {
  id: string
  name: string
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object'
  description?: string
  required?: boolean
  children?: SchemaField[]
}

interface ExtractionSchemaProps {
  value: SchemaField[]
  onChange: (fields: SchemaField[]) => void
  className?: string
}

const fieldTypes = [
  { value: 'string', label: 'Text', icon: Type },
  { value: 'number', label: 'Number', icon: Hash },
  { value: 'boolean', label: 'Boolean', icon: ToggleLeft },
  { value: 'date', label: 'Date', icon: Calendar },
  { value: 'array', label: 'Array', icon: List },
  { value: 'object', label: 'Object', icon: Layers },
]

export function ExtractionSchema({
  value,
  onChange,
  className,
}: ExtractionSchemaProps) {
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set())
  const [showJson, setShowJson] = useState(false)

  const addField = (parentId?: string) => {
    const newField: SchemaField = {
      id: `field_${Date.now()}`,
      name: '',
      type: 'string',
      required: false,
    }

    if (parentId) {
      const updateFields = (fields: SchemaField[]): SchemaField[] => {
        return fields.map((field: SchemaField) => {
          if (field.id === parentId) {
            return {
              ...field,
              children: [...(field.children || []), newField],
            }
          }
          if (field.children) {
            return {
              ...field,
              children: updateFields(field.children),
            }
          }
          return field
        })
      }
      onChange(updateFields(value))
      setExpandedFields(prev => new Set([...prev, parentId]))
    } else {
      onChange([...value, newField])
    }
  }

  const updateField = (id: string, updates: Partial<SchemaField>) => {
    const updateFields = (fields: SchemaField[]): SchemaField[] => {
      return fields.map(field => {
        if (field.id === id) {
          return { ...field, ...updates }
        }
        if (field.children) {
          return {
            ...field,
            children: updateFields(field.children),
          }
        }
        return field
      })
    }
    onChange(updateFields(value))
  }

  const removeField = (id: string) => {
    const removeFromFields = (fields: SchemaField[]): SchemaField[] => {
      return fields
        .filter(field => field.id !== id)
        .map((field: SchemaField) => {
          if (field.children) {
            return {
              ...field,
              children: removeFromFields(field.children),
            }
          }
          return field
        })
    }
    onChange(removeFromFields(value))
  }

  const toggleExpanded = (id: string) => {
    setExpandedFields(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const generateJsonSchema = () => {
    const buildSchema = (fields: SchemaField[]): any => {
      const properties: any = {}
      const required: string[] = []

      fields.forEach(field => {
        let fieldSchema: any = { type: field.type }
        
        if (field.description) {
          fieldSchema.description = field.description
        }

        if (field.type === 'array') {
          fieldSchema.items = field.children?.length 
            ? buildSchema(field.children) 
            : { type: 'string' }
        } else if (field.type === 'object' && field.children) {
          const childSchema = buildSchema(field.children)
          fieldSchema = {
            type: 'object',
            properties: childSchema.properties,
            required: childSchema.required,
          }
        }

        properties[field.name] = fieldSchema

        if (field.required) {
          required.push(field.name)
        }
      })

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      }
    }

    return buildSchema(value)
  }

  const renderField = (field: SchemaField, depth = 0) => {
    const hasChildren = field.type === 'object' || field.type === 'array'
    const isExpanded = expandedFields.has(field.id)
    const TypeIcon = fieldTypes.find(t => t.value === field.type)?.icon || Type

    return (
      <motion.div
        key={field.id}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="space-y-2"
        style={{ marginLeft: depth * 24 }}
      >
        <div className="flex items-center gap-2 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
          {hasChildren && (
            <button
              onClick={() => toggleExpanded(field.id)}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
            </button>
          )}
          
          <TypeIcon className="h-4 w-4 text-gray-500" />
          
          <input
            type="text"
            value={field.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField(field.id, { name: e.target.value })}
            placeholder="Field name"
            className="flex-1 bg-transparent border-none outline-none text-sm text-gray-100 placeholder-gray-500"
          />

          <select
            value={field.type}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateField(field.id, { 
              type: e.target.value as SchemaField['type'],
              children: (e.target.value === 'object' || e.target.value === 'array') ? [] : undefined
            })}
            className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-gray-300"
          >
            {fieldTypes.map((type: typeof fieldTypes[0]) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => updateField(field.id, { required: !field.required })}
            className={cn(
              'px-2 py-1 text-xs rounded transition-colors',
              field.required
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'bg-gray-700 text-gray-400 border border-gray-600'
            )}
          >
            Required
          </button>

          <button
            onClick={() => removeField(field.id)}
            className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {field.name && (
          <input
            type="text"
            value={field.description || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField(field.id, { description: e.target.value })}
            placeholder="Description (optional)"
            className="w-full px-3 py-2 bg-gray-800/30 border border-gray-700 rounded text-sm text-gray-300 placeholder-gray-500"
            style={{ marginLeft: hasChildren ? 28 : 0 }}
          />
        )}

        <AnimatePresence>
          {hasChildren && isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 mt-2"
            >
              {field.children?.map((child: SchemaField) => renderField(child, depth + 1))}
              <button
                onClick={() => addField(field.id)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors"
                style={{ marginLeft: 28 }}
              >
                <Plus className="h-4 w-4" />
                Add nested field
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-100">
          Extraction Schema
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowJson(!showJson)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors',
              showJson
                ? 'bg-purple-500/20 text-purple-400'
                : 'bg-gray-800 text-gray-400 hover:text-gray-300'
            )}
          >
            {showJson ? <FileJson className="h-4 w-4" /> : <Code2 className="h-4 w-4" />}
            {showJson ? 'Show Builder' : 'Show JSON'}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {showJson ? (
          <motion.div
            key="json"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-4 bg-gray-900 border border-gray-700 rounded-lg"
          >
            <pre className="text-sm text-gray-300 overflow-auto">
              {JSON.stringify(generateJsonSchema(), null, 2)}
            </pre>
          </motion.div>
        ) : (
          <motion.div
            key="builder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2"
          >
            <AnimatePresence>
              {value.map((field: SchemaField) => renderField(field))}
            </AnimatePresence>
            
            <button
              onClick={() => addField()}
              className="flex items-center gap-2 w-full px-4 py-3 text-sm text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add field
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}