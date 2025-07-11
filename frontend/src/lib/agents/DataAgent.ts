import { z } from 'zod';
import { Agent, AgentConfig } from './base/Agent';
import { AgentType, RequestMessage } from './base/types';
import { supabase } from '@/lib/supabase/browser';

// Input/Output schemas
const QueryDatabaseSchema = z.object({
  query: z.string(),
  params: z.array(z.any()).optional(),
  timeout: z.number().optional(),
});

const InsertDataSchema = z.object({
  table: z.string(),
  data: z.union([z.record(z.string(), z.any()), z.array(z.record(z.string(), z.any()))]),
  returning: z.array(z.string()).optional(),
});

const UpdateDataSchema = z.object({
  table: z.string(),
  data: z.record(z.string(), z.any()),
  filters: z.record(z.string(), z.any()),
  returning: z.array(z.string()).optional(),
});

const DeleteDataSchema = z.object({
  table: z.string(),
  filters: z.record(z.string(), z.any()),
  returning: z.array(z.string()).optional(),
});

const BackupDataSchema = z.object({
  tables: z.array(z.string()).optional(),
  format: z.enum(['json', 'csv', 'sql']).optional(),
  compress: z.boolean().optional(),
});

const AnalyzeDataSchema = z.object({
  table: z.string(),
  columns: z.array(z.string()).optional(),
  analysisType: z.enum(['statistics', 'distribution', 'correlation', 'trends']),
  groupBy: z.array(z.string()).optional(),
  timeColumn: z.string().optional(),
});

export class DataAgent extends Agent {
  constructor(config?: Partial<AgentConfig>) {
    super({
      name: 'Data Agent',
      type: AgentType.DATA,
      description: 'Handles database operations and data analysis',
      ...config,
    });

    this.registerActions();
  }

  protected async onInitialize(): Promise<void> {
    // Verify database connection
    try {
      const { error } = await supabase.from('_test_connection').select('*').limit(1);
      if (error && error.code !== 'PGRST116') { // Table not found is ok
        console.warn('Database connection test failed:', error);
      }
    } catch (error) {
      console.warn('Failed to test database connection:', error);
    }
  }

  protected async onShutdown(): Promise<void> {
    // Clean up any resources
  }

  protected async processRequest(message: RequestMessage): Promise<any> {
    const { action, payload } = message;

    switch (action) {
      case 'query_database':
        return this.queryDatabase(payload);
      case 'insert_data':
        return this.insertData(payload);
      case 'update_data':
        return this.updateData(payload);
      case 'delete_data':
        return this.deleteData(payload);
      case 'backup_data':
        return this.backupData(payload);
      case 'analyze_data':
        return this.analyzeData(payload);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  private registerActions(): void {
    this.registerAction('query_database', {
      name: 'query_database',
      description: 'Execute a database query',
      inputSchema: QueryDatabaseSchema,
      outputSchema: z.object({
        rows: z.array(z.record(z.string(), z.any())),
        rowCount: z.number(),
        executionTime: z.number(),
      }),
    });

    this.registerAction('insert_data', {
      name: 'insert_data',
      description: 'Insert data into a table',
      inputSchema: InsertDataSchema,
      outputSchema: z.object({
        inserted: z.array(z.record(z.string(), z.any())),
        count: z.number(),
      }),
    });

    this.registerAction('update_data', {
      name: 'update_data',
      description: 'Update data in a table',
      inputSchema: UpdateDataSchema,
      outputSchema: z.object({
        updated: z.array(z.record(z.string(), z.any())),
        count: z.number(),
      }),
    });

    this.registerAction('delete_data', {
      name: 'delete_data',
      description: 'Delete data from a table',
      inputSchema: DeleteDataSchema,
      outputSchema: z.object({
        deleted: z.array(z.record(z.string(), z.any())),
        count: z.number(),
      }),
    });

    this.registerAction('backup_data', {
      name: 'backup_data',
      description: 'Backup database data',
      inputSchema: BackupDataSchema,
      outputSchema: z.object({
        backupId: z.string(),
        size: z.number(),
        tables: z.array(z.string()),
        timestamp: z.string(),
      }),
    });

    this.registerAction('analyze_data', {
      name: 'analyze_data',
      description: 'Analyze data patterns and statistics',
      inputSchema: AnalyzeDataSchema,
      outputSchema: z.object({
        analysisType: z.string(),
        results: z.record(z.string(), z.any()),
        insights: z.array(z.string()),
        visualizations: z.array(z.object({
          type: z.string(),
          data: z.any(),
        })).optional(),
      }),
    });
  }

  private async queryDatabase(input: z.infer<typeof QueryDatabaseSchema>) {
    const startTime = Date.now();
    
    try {
      // Parse the query to determine the table and operation
      const query = input.query.trim().toLowerCase();
      
      if (query.startsWith('select')) {
        // Extract table name from query
        const tableMatch = query.match(/from\s+(\w+)/);
        if (!tableMatch) {
          throw new Error('Invalid SELECT query: table not found');
        }
        
        const tableName = tableMatch[1];
        
        // Build Supabase query
        let supabaseQuery = supabase.from(tableName).select('*');
        
        // Parse WHERE clause if exists
        const whereMatch = query.match(/where\s+(.+?)(?:\s+order\s+by|\s+limit|$)/);
        if (whereMatch) {
          // Simple WHERE parsing (in production, use a proper SQL parser)
          const conditions = whereMatch[1].split(/\s+and\s+/i);
          for (const condition of conditions) {
            const [column, operator, value] = condition.split(/\s*(=|!=|>|<|>=|<=)\s*/);
            if (column && operator && value) {
              const cleanValue = value.replace(/['"]/g, '');
              switch (operator) {
                case '=':
                  supabaseQuery = supabaseQuery.eq(column, cleanValue);
                  break;
                case '!=':
                  supabaseQuery = supabaseQuery.neq(column, cleanValue);
                  break;
                case '>':
                  supabaseQuery = supabaseQuery.gt(column, cleanValue);
                  break;
                case '<':
                  supabaseQuery = supabaseQuery.lt(column, cleanValue);
                  break;
                case '>=':
                  supabaseQuery = supabaseQuery.gte(column, cleanValue);
                  break;
                case '<=':
                  supabaseQuery = supabaseQuery.lte(column, cleanValue);
                  break;
              }
            }
          }
        }
        
        // Parse LIMIT
        const limitMatch = query.match(/limit\s+(\d+)/);
        if (limitMatch) {
          supabaseQuery = supabaseQuery.limit(parseInt(limitMatch[1]));
        }
        
        const { data, error } = await supabaseQuery;
        
        if (error) throw error;
        
        const executionTime = Date.now() - startTime;
        
        this.broadcast('query_executed', {
          table: tableName,
          rowCount: data?.length || 0,
          executionTime,
        });
        
        return {
          rows: data || [],
          rowCount: data?.length || 0,
          executionTime,
        };
      } else {
        throw new Error('Only SELECT queries are supported for direct execution');
      }
    } catch (error) {
      this.broadcast('query_failed', {
        query: input.query,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async insertData(input: z.infer<typeof InsertDataSchema>) {
    try {
      const query = supabase.from(input.table).insert(input.data);
      
      if (input.returning) {
        query.select(input.returning.join(','));
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      const count = Array.isArray(input.data) ? input.data.length : 1;
      
      this.broadcast('data_inserted', {
        table: input.table,
        count,
      });
      
      return {
        inserted: data || [],
        count,
      };
    } catch (error) {
      this.broadcast('insert_failed', {
        table: input.table,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async updateData(input: z.infer<typeof UpdateDataSchema>) {
    try {
      let query = supabase.from(input.table).update(input.data);
      
      // Apply filters
      for (const [column, value] of Object.entries(input.filters)) {
        query = query.eq(column, value);
      }
      
      if (input.returning) {
        query.select(input.returning.join(','));
      }
      
      const { data, error } = await query as { data: any[] | null; error: any };
      
      if (error) throw error;
      
      this.broadcast('data_updated', {
        table: input.table,
        count: data?.length || 0,
      });
      
      return {
        updated: data || [],
        count: data?.length || 0,
      };
    } catch (error) {
      this.broadcast('update_failed', {
        table: input.table,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async deleteData(input: z.infer<typeof DeleteDataSchema>) {
    try {
      let query = supabase.from(input.table).delete();
      
      // Apply filters
      for (const [column, value] of Object.entries(input.filters)) {
        query = query.eq(column, value);
      }
      
      if (input.returning) {
        query.select(input.returning.join(','));
      }
      
      const { data, error } = await query as { data: any[] | null; error: any };
      
      if (error) throw error;
      
      this.broadcast('data_deleted', {
        table: input.table,
        count: data?.length || 0,
      });
      
      return {
        deleted: data || [],
        count: data?.length || 0,
      };
    } catch (error) {
      this.broadcast('delete_failed', {
        table: input.table,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async backupData(input: z.infer<typeof BackupDataSchema>) {
    try {
      const backupId = `backup_${Date.now()}`;
      const tables = input.tables || ['users', 'ai_assistants', 'chat_sessions']; // Default tables
      const backupData: Record<string, any[]> = {};
      
      // Fetch data from each table
      for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*');
        if (error) {
          console.warn(`Failed to backup table ${table}:`, error);
          continue;
        }
        backupData[table] = data || [];
      }
      
      // Format backup based on requested format
      let backupContent: string;
      let size: number;
      
      switch (input.format) {
        case 'csv':
          // Convert to CSV (simplified)
          backupContent = Object.entries(backupData)
            .map(([table, rows]) => {
              if (rows.length === 0) return '';
              const headers = Object.keys(rows[0]).join(',');
              const values = rows.map(row => Object.values(row).join(',')).join('\n');
              return `-- Table: ${table}\n${headers}\n${values}`;
            })
            .join('\n\n');
          break;
        case 'sql':
          // Convert to SQL (simplified)
          backupContent = Object.entries(backupData)
            .map(([table, rows]) => {
              return rows.map(row => {
                const columns = Object.keys(row).join(', ');
                const values = Object.values(row)
                  .map(v => typeof v === 'string' ? `'${v}'` : v)
                  .join(', ');
                return `INSERT INTO ${table} (${columns}) VALUES (${values});`;
              }).join('\n');
            })
            .join('\n\n');
          break;
        default:
          // JSON format
          backupContent = JSON.stringify(backupData, null, 2);
      }
      
      size = new TextEncoder().encode(backupContent).length;
      
      // In a real implementation, save to storage
      // For now, we'll simulate the backup
      
      this.broadcast('backup_created', {
        backupId,
        tables,
        size,
      });
      
      return {
        backupId,
        size,
        tables,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.broadcast('backup_failed', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private async analyzeData(input: z.infer<typeof AnalyzeDataSchema>) {
    try {
      // Fetch data for analysis
      let query = supabase.from(input.table).select(input.columns?.join(',') || '*');
      
      const { data, error } = await query;
      
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('No data found for analysis');
      }
      
      let results: any = {};
      const insights: string[] = [];
      
      switch (input.analysisType) {
        case 'statistics':
          results = this.calculateStatistics(data, input.columns);
          insights.push(
            `Analyzed ${data.length} records from ${input.table}`,
            `Found ${Object.keys(results).length} numeric columns`
          );
          break;
          
        case 'distribution':
          results = this.calculateDistribution(data, input.groupBy);
          insights.push(
            `Distribution analysis across ${input.groupBy?.length || 0} dimensions`,
            `Most common value: ${Object.entries(results)[0]?.[0] || 'N/A'}`
          );
          break;
          
        case 'correlation':
          results = this.calculateCorrelation(data, input.columns);
          insights.push('Correlation matrix calculated for numeric columns');
          break;
          
        case 'trends':
          if (!input.timeColumn) {
            throw new Error('Time column required for trend analysis');
          }
          results = this.calculateTrends(data, input.timeColumn, input.columns);
          insights.push(`Trend analysis over time column: ${input.timeColumn}`);
          break;
      }
      
      // Request additional insights from AnalysisAgent
      try {
        const aiInsights = await this.sendRequest('analysis-agent', 'generate_insights', {
          data: { table: input.table, analysis: results },
          context: `Data analysis of ${input.table} table`,
          focusAreas: [input.analysisType],
        });
        
        if (aiInsights.insights) {
          insights.push(...aiInsights.insights.map((i: any) => i.description));
        }
      } catch (error) {
        console.warn('Failed to get AI insights:', error);
      }
      
      this.broadcast('data_analyzed', {
        table: input.table,
        analysisType: input.analysisType,
        recordCount: data.length,
      });
      
      return {
        analysisType: input.analysisType,
        results,
        insights,
        visualizations: this.generateVisualizations(input.analysisType, results),
      };
    } catch (error) {
      this.broadcast('analysis_failed', {
        table: input.table,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  // Analysis helper methods
  private calculateStatistics(data: any[], columns?: string[]): any {
    const stats: any = {};
    const numericColumns = columns || Object.keys(data[0]);
    
    for (const column of numericColumns) {
      const values = data
        .map(row => row[column])
        .filter(val => typeof val === 'number' && !isNaN(val));
      
      if (values.length > 0) {
        stats[column] = {
          count: values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          mean: values.reduce((a, b) => a + b, 0) / values.length,
          median: this.getMedian(values),
        };
        
        // Calculate standard deviation
        const mean = stats[column].mean;
        const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
        stats[column].stdDev = Math.sqrt(
          squaredDiffs.reduce((a, b) => a + b, 0) / values.length
        );
      }
    }
    
    return stats;
  }

  private calculateDistribution(data: any[], groupBy?: string[]): any {
    const distribution: any = {};
    const columns = groupBy || [Object.keys(data[0])[0]];
    
    for (const row of data) {
      const key = columns.map(col => row[col]).join('_');
      distribution[key] = (distribution[key] || 0) + 1;
    }
    
    // Sort by count
    return Object.fromEntries(
      Object.entries(distribution).sort((a, b) => (b[1] as number) - (a[1] as number))
    );
  }

  private calculateCorrelation(data: any[], columns?: string[]): any {
    // Simplified correlation calculation
    const numericColumns = columns || Object.keys(data[0]).filter(col =>
      typeof data[0][col] === 'number'
    );
    
    const correlation: any = {};
    
    for (const col1 of numericColumns) {
      correlation[col1] = {};
      for (const col2 of numericColumns) {
        if (col1 === col2) {
          correlation[col1][col2] = 1;
        } else {
          // Calculate Pearson correlation coefficient
          const values1 = data.map(row => row[col1]);
          const values2 = data.map(row => row[col2]);
          correlation[col1][col2] = this.pearsonCorrelation(values1, values2);
        }
      }
    }
    
    return correlation;
  }

  private calculateTrends(data: any[], timeColumn: string, valueColumns?: string[]): any {
    // Sort by time
    const sorted = data.sort((a, b) => 
      new Date(a[timeColumn]).getTime() - new Date(b[timeColumn]).getTime()
    );
    
    const trends: any = {};
    const columns = valueColumns || Object.keys(data[0]).filter(col =>
      typeof data[0][col] === 'number' && col !== timeColumn
    );
    
    for (const column of columns) {
      const timeSeries = sorted.map(row => ({
        time: row[timeColumn],
        value: row[column],
      }));
      
      // Calculate simple moving average
      const windowSize = Math.min(7, Math.floor(timeSeries.length / 4));
      const movingAverage = this.calculateMovingAverage(
        timeSeries.map(p => p.value),
        windowSize
      );
      
      trends[column] = {
        data: timeSeries,
        movingAverage,
        trend: movingAverage.length > 1 && 
          movingAverage[movingAverage.length - 1] > movingAverage[0] ? 'up' : 'down',
      };
    }
    
    return trends;
  }

  private generateVisualizations(analysisType: string, results: any): any[] {
    const visualizations = [];
    
    switch (analysisType) {
      case 'statistics':
        visualizations.push({
          type: 'bar_chart',
          data: {
            labels: Object.keys(results),
            datasets: [{
              label: 'Mean Values',
              data: Object.values(results).map((s: any) => s.mean),
            }],
          },
        });
        break;
        
      case 'distribution':
        visualizations.push({
          type: 'pie_chart',
          data: {
            labels: Object.keys(results).slice(0, 10),
            values: Object.values(results).slice(0, 10),
          },
        });
        break;
        
      case 'correlation':
        visualizations.push({
          type: 'heatmap',
          data: results,
        });
        break;
        
      case 'trends':
        for (const [column, trend] of Object.entries(results)) {
          visualizations.push({
            type: 'line_chart',
            data: {
              label: column,
              ...(typeof trend === 'object' && trend !== null ? trend : {}),
            },
          });
        }
        break;
    }
    
    return visualizations;
  }

  // Utility methods
  private getMedian(values: number[]): number {
    const sorted = values.sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
    const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
    const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);
    
    const correlation = (n * sumXY - sumX * sumY) /
      Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return isNaN(correlation) ? 0 : correlation;
  }

  private calculateMovingAverage(values: number[], windowSize: number): number[] {
    const result = [];
    for (let i = windowSize - 1; i < values.length; i++) {
      const window = values.slice(i - windowSize + 1, i + 1);
      result.push(window.reduce((a, b) => a + b, 0) / windowSize);
    }
    return result;
  }
}