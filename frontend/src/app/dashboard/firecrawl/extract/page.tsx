'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  Database, 
  Settings,
  Play,
  Download,
  Plus,
  Trash2,
  Copy,
  Check,
  FileJson,
  Globe,
  Sparkles,
  Code2,
  ChevronDown
} from 'lucide-react'
import { ExtractionSchema } from '@/components/firecrawl/ExtractionSchema'
import { ResultViewer } from '@/components/firecrawl/ResultViewer'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import type { SchemaField } from '@/components/firecrawl/ExtractionSchema'

interface ExtractionOptions {
  prompt?: string
  systemPrompt?: string
  allowExternalLinks: boolean
  enableWebSearch: boolean
  includeSubdomains: boolean
}

interface ExtractionResult {
  data: any[]
  schema: any
  urls: string[]
  timestamp: Date
}

export default function ExtractPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [urls, setUrls] = useState<string[]>([''])
  const [schemaFields, setSchemaFields] = useState<SchemaField[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<ExtractionResult | null>(null)
  const [showOptions, setShowOptions] = useState(false)
  const [copied, setCopied] = useState(false)
  const [options, setOptions] = useState<ExtractionOptions>({
    prompt: '',
    systemPrompt: 'Extract the requested information accurately and completely.',
    allowExternalLinks: false,
    enableWebSearch: false,
    includeSubdomains: false,
  })

  const addUrl = () => {
    setUrls([...urls, ''])
  }

  const updateUrl = (index: number, value: string) => {
    const newUrls = [...urls]
    newUrls[index] = value
    setUrls(newUrls)
  }

  const removeUrl = (index: number) => {
    if (urls.length > 1) {
      setUrls(urls.filter((_, i) => i !== index))
    }
  }

  const handleExtract = async () => {
    const validUrls = urls.filter(url => url.trim())
    if (validUrls.length === 0 || schemaFields.length === 0) {
      toast({
        title: 'Please add at least one URL and define your schema',
        variant: 'destructive'
      })
      return
    }

    setIsLoading(true)
    setResult(null)

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Mock extracted data based on schema
      const mockData = validUrls.map((url, index) => {
        const data: any = { _source_url: url }
        
        schemaFields.forEach((field: any) => {
          switch (field.type) {
            case 'string':
              data[field.name] = `Sample ${field.name} from ${new URL(url).hostname}`
              break
            case 'number':
              data[field.name] = Math.floor(Math.random() * 100)
              break
            case 'boolean':
              data[field.name] = Math.random() > 0.5
              break
            case 'date':
              data[field.name] = new Date().toISOString().split('T')[0]
              break
            case 'array':
              data[field.name] = [`Item 1`, `Item 2`, `Item 3`]
              break
            case 'object':
              data[field.name] = field.children?.reduce((obj: any, child: any) => {
                obj[child.name] = `Nested ${child.name}`
                return obj
              }, {}) || {}
              break
          }
        })
        
        return data
      })

      setResult({
        data: mockData,
        schema: schemaFields,
        urls: validUrls,
        timestamp: new Date(),
      })

      toast({
        title: `Extracted data from ${validUrls.length} URLs`,
        variant: 'success'
      })
    } catch (error) {
      toast({
        title: 'Extraction failed',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopyData = async () => {
    if (!result) return
    
    await navigator.clipboard.writeText(JSON.stringify(result.data, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast({
      title: 'Data copied to clipboard!',
      variant: 'success'
    })
  }

  const handleDownload = () => {
    if (!result) return
    
    const content = JSON.stringify({
      extraction: {
        timestamp: result.timestamp,
        urls: result.urls,
        schema: result.schema,
        options: options,
      },
      data: result.data,
    }, null, 2)
    
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `extraction-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const presetSchemas = [
    {
      name: 'Contact Information',
      fields: [
        { id: '1', name: 'name', type: 'string' as const, required: true },
        { id: '2', name: 'email', type: 'string' as const, required: true },
        { id: '3', name: 'phone', type: 'string' as const },
        { id: '4', name: 'company', type: 'string' as const },
        { id: '5', name: 'position', type: 'string' as const },
      ]
    },
    {
      name: 'Product Details',
      fields: [
        { id: '1', name: 'name', type: 'string' as const, required: true },
        { id: '2', name: 'price', type: 'number' as const, required: true },
        { id: '3', name: 'description', type: 'string' as const },
        { id: '4', name: 'inStock', type: 'boolean' as const },
        { id: '5', name: 'categories', type: 'array' as const },
      ]
    },
    {
      name: 'Job Posting',
      fields: [
        { id: '1', name: 'title', type: 'string' as const, required: true },
        { id: '2', name: 'company', type: 'string' as const, required: true },
        { id: '3', name: 'location', type: 'string' as const },
        { id: '4', name: 'salary', type: 'object' as const, children: [
          { id: '4.1', name: 'min', type: 'number' as const },
          { id: '4.2', name: 'max', type: 'number' as const },
        ]},
        { id: '5', name: 'requirements', type: 'array' as const },
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard/firecrawl')}
              className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-100">Data Extraction</h1>
              <p className="text-sm text-gray-400 mt-1">
                Extract structured data from websites using AI-powered schemas
              </p>
            </div>
          </div>
        </motion.div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Configuration */}
          <div className="space-y-4">
            {/* URLs Input */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-gray-900/50 border border-gray-700 rounded-lg p-6"
            >
              <h3 className="text-lg font-semibold text-gray-100 mb-4">
                Target URLs
              </h3>
              <div className="space-y-3">
                <AnimatePresence>
                  {urls.map((url, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex gap-2"
                    >
                      <div className="flex-1 relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                        <input
                          type="text"
                          value={url}
                          onChange={(e) => updateUrl(index, e.target.value)}
                          placeholder="https://example.com/page"
                          className="w-full pl-10 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500"
                        />
                      </div>
                      {urls.length > 1 && (
                        <button
                          onClick={() => removeUrl(index)}
                          className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
                <button
                  onClick={addUrl}
                  className="w-full px-3 py-2 text-sm text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add URL
                </button>
              </div>
            </motion.div>

            {/* Schema Builder */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-gray-900/50 border border-gray-700 rounded-lg p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-100">
                  Data Schema
                </h3>
                <div className="relative">
                  <button
                    onClick={() => {
                      const menu = document.getElementById('preset-menu')
                      if (menu) menu.classList.toggle('hidden')
                    }}
                    className="px-3 py-1.5 text-sm text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    Presets
                  </button>
                  <div
                    id="preset-menu"
                    className="hidden absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10"
                  >
                    {presetSchemas.map(preset => (
                      <button
                        key={preset.name}
                        onClick={() => {
                          setSchemaFields(preset.fields as any)
                          document.getElementById('preset-menu')?.classList.add('hidden')
                          toast({
                            title: `Loaded ${preset.name} schema`,
                            variant: 'success'
                          })
                        }}
                        className="w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 text-left transition-colors first:rounded-t-lg last:rounded-b-lg"
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <ExtractionSchema
                value={schemaFields}
                onChange={setSchemaFields}
              />
            </motion.div>

            {/* Options */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-gray-900/50 border border-gray-700 rounded-lg"
            >
              <button
                onClick={() => setShowOptions(!showOptions)}
                className="w-full px-6 py-4 flex items-center justify-between text-gray-300 hover:text-gray-100 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Extraction Options
                </span>
                <ChevronDown className={cn(
                  'h-4 w-4 transition-transform',
                  showOptions && 'rotate-180'
                )} />
              </button>

              <AnimatePresence>
                {showOptions && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-6 pb-6 space-y-4 border-t border-gray-700"
                  >
                    <div>
                      <label className="text-sm font-medium text-gray-300 mb-2 block">
                        Custom Prompt
                      </label>
                      <textarea
                        value={options.prompt}
                        onChange={(e) => setOptions(prev => ({ ...prev, prompt: e.target.value }))}
                        placeholder="Additional instructions for extraction..."
                        className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-100 placeholder-gray-500 min-h-[80px]"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={options.allowExternalLinks}
                          onChange={(e) => setOptions(prev => ({ ...prev, allowExternalLinks: e.target.checked }))}
                          className="rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500"
                        />
                        Allow external links
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={options.enableWebSearch}
                          onChange={(e) => setOptions(prev => ({ ...prev, enableWebSearch: e.target.checked }))}
                          className="rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500"
                        />
                        Enable web search for context
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={options.includeSubdomains}
                          onChange={(e) => setOptions(prev => ({ ...prev, includeSubdomains: e.target.checked }))}
                          className="rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500"
                        />
                        Include subdomains
                      </label>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Extract Button */}
            <button
              onClick={handleExtract}
              disabled={urls.filter(u => u.trim()).length === 0 || schemaFields.length === 0 || isLoading}
              className={cn(
                'w-full px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2',
                urls.filter(u => u.trim()).length > 0 && schemaFields.length > 0 && !isLoading
                  ? 'bg-purple-500 text-white hover:bg-purple-600 hover:shadow-lg hover:shadow-purple-500/25'
                  : 'bg-gray-800 text-gray-500 cursor-not-allowed'
              )}
            >
              <Database className="h-4 w-4" />
              {isLoading ? 'Extracting...' : 'Extract Data'}
            </button>
          </div>

          {/* Right Column - Results */}
          <div>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-gray-900/50 border border-gray-700 rounded-lg p-12"
              >
                <div className="text-center">
                  <Database className="h-16 w-16 text-purple-500 mx-auto mb-4 animate-pulse" />
                  <h3 className="text-lg font-medium text-gray-300 mb-2">
                    Extracting Data
                  </h3>
                  <p className="text-sm text-gray-500">
                    Using AI to extract structured data from your URLs...
                  </p>
                </div>
              </motion.div>
            )}

            {result && !isLoading && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                {/* Stats */}
                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div>
                        <p className="text-sm text-gray-400">Records</p>
                        <p className="text-2xl font-bold text-gray-100">{result.data.length}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Fields</p>
                        <p className="text-2xl font-bold text-gray-100">{result.schema.length}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyData}
                        className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
                      >
                        <AnimatePresence mode="wait">
                          {copied ? (
                            <motion.div
                              key="check"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                            >
                              <Check className="h-4 w-4 text-green-500" />
                            </motion.div>
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </AnimatePresence>
                        Copy
                      </button>
                      <button
                        onClick={handleDownload}
                        className="px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors flex items-center gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </button>
                    </div>
                  </div>
                </div>

                {/* Data Display */}
                <ResultViewer
                  content={result.data}
                  format="json"
                  title="Extracted Data"
                />
              </motion.div>
            )}

            {!result && !isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-gray-900/50 border border-gray-700 rounded-lg p-12"
              >
                <div className="text-center">
                  <Code2 className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-300 mb-2">
                    No Data Yet
                  </h3>
                  <p className="text-sm text-gray-500 max-w-sm mx-auto">
                    Add URLs and define your schema, then click Extract to see structured data here
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}