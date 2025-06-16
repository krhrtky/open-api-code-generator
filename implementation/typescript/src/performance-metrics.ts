import { performance } from 'perf_hooks';

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
  evictions: number;
  size: number;
  maxSize: number;
}

export interface PerformanceMetrics {
  totalProcessingTime: number;
  schemaResolutionTime: number;
  cacheOperationTime: number;
  memoryCleanupTime: number;
  parallelProcessingTime: number;
  schemasProcessed: number;
  filesGenerated: number;
  averageSchemaProcessingTime: number;
  peakMemoryUsage: number;
  memoryCleanupCount: number;
}

export interface DetailedCacheMetrics {
  schema: CacheMetrics;
  composition: CacheMetrics;
  reference: CacheMetrics;
  overall: CacheMetrics;
}

export class PerformanceTracker {
  private metrics: PerformanceMetrics;
  private cacheMetrics: DetailedCacheMetrics;
  private timers: Map<string, number> = new Map();
  private memorySnapshots: number[] = [];
  private startTime: number = 0;

  constructor() {
    this.metrics = {
      totalProcessingTime: 0,
      schemaResolutionTime: 0,
      cacheOperationTime: 0,
      memoryCleanupTime: 0,
      parallelProcessingTime: 0,
      schemasProcessed: 0,
      filesGenerated: 0,
      averageSchemaProcessingTime: 0,
      peakMemoryUsage: 0,
      memoryCleanupCount: 0
    };

    this.cacheMetrics = {
      schema: this.createEmptyCacheMetrics(),
      composition: this.createEmptyCacheMetrics(),
      reference: this.createEmptyCacheMetrics(),
      overall: this.createEmptyCacheMetrics()
    };
  }

  private createEmptyCacheMetrics(): CacheMetrics {
    return {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalRequests: 0,
      evictions: 0,
      size: 0,
      maxSize: 0
    };
  }

  /**
   * Start timing an operation
   */
  startTimer(operation: string): void {
    this.timers.set(operation, performance.now());
  }

  /**
   * End timing an operation and record the duration
   */
  endTimer(operation: string): number {
    const startTime = this.timers.get(operation);
    if (!startTime) {
      throw new Error(`Timer '${operation}' was not started`);
    }
    
    const duration = performance.now() - startTime;
    this.timers.delete(operation);
    
    // Update metrics based on operation type
    switch (operation) {
      case 'schemaResolution':
        this.metrics.schemaResolutionTime += duration;
        break;
      case 'cacheOperation':
        this.metrics.cacheOperationTime += duration;
        break;
      case 'memoryCleanup':
        this.metrics.memoryCleanupTime += duration;
        this.metrics.memoryCleanupCount++;
        break;
      case 'parallelProcessing':
        this.metrics.parallelProcessingTime += duration;
        break;
      case 'totalProcessing':
        this.metrics.totalProcessingTime = duration;
        break;
    }
    
    return duration;
  }

  /**
   * Record a cache hit for specific cache type
   */
  recordCacheHit(cacheType: 'schema' | 'composition' | 'reference'): void {
    const cache = this.cacheMetrics[cacheType];
    cache.hits++;
    cache.totalRequests++;
    cache.hitRate = cache.hits / cache.totalRequests;
    
    this.updateOverallCacheMetrics();
  }

  /**
   * Record a cache miss for specific cache type
   */
  recordCacheMiss(cacheType: 'schema' | 'composition' | 'reference'): void {
    const cache = this.cacheMetrics[cacheType];
    cache.misses++;
    cache.totalRequests++;
    cache.hitRate = cache.hits / cache.totalRequests;
    
    this.updateOverallCacheMetrics();
  }

  /**
   * Record a cache eviction
   */
  recordCacheEviction(cacheType: 'schema' | 'composition' | 'reference', count: number = 1): void {
    this.cacheMetrics[cacheType].evictions += count;
  }

  /**
   * Update cache size information
   */
  updateCacheSize(cacheType: 'schema' | 'composition' | 'reference', size: number, maxSize: number): void {
    const cache = this.cacheMetrics[cacheType];
    cache.size = size;
    cache.maxSize = maxSize;
  }

  /**
   * Record schema processing completion
   */
  recordSchemaProcessed(): void {
    this.metrics.schemasProcessed++;
    if (this.metrics.schemaResolutionTime > 0) {
      this.metrics.averageSchemaProcessingTime = 
        this.metrics.schemaResolutionTime / this.metrics.schemasProcessed;
    }
  }

  /**
   * Record file generation completion
   */
  recordFileGenerated(): void {
    this.metrics.filesGenerated++;
  }

  /**
   * Take a memory snapshot
   */
  takeMemorySnapshot(): void {
    const memoryUsage = process.memoryUsage();
    this.memorySnapshots.push(memoryUsage.heapUsed);
    
    const currentPeak = Math.max(...this.memorySnapshots);
    if (currentPeak > this.metrics.peakMemoryUsage) {
      this.metrics.peakMemoryUsage = currentPeak;
    }
  }

  /**
   * Start overall performance tracking
   */
  startTracking(): void {
    this.startTime = performance.now();
    this.startTimer('totalProcessing');
    this.takeMemorySnapshot();
  }

  /**
   * End overall performance tracking
   */
  endTracking(): void {
    if (this.timers.has('totalProcessing')) {
      this.endTimer('totalProcessing');
    }
    this.takeMemorySnapshot();
  }

  /**
   * Update overall cache metrics from individual cache types
   */
  private updateOverallCacheMetrics(): void {
    const overall = this.cacheMetrics.overall;
    const caches = [this.cacheMetrics.schema, this.cacheMetrics.composition, this.cacheMetrics.reference];
    
    overall.hits = caches.reduce((sum, cache) => sum + cache.hits, 0);
    overall.misses = caches.reduce((sum, cache) => sum + cache.misses, 0);
    overall.totalRequests = overall.hits + overall.misses;
    overall.hitRate = overall.totalRequests > 0 ? overall.hits / overall.totalRequests : 0;
    overall.evictions = caches.reduce((sum, cache) => sum + cache.evictions, 0);
    overall.size = caches.reduce((sum, cache) => sum + cache.size, 0);
    overall.maxSize = caches.reduce((sum, cache) => sum + cache.maxSize, 0);
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current cache metrics
   */
  getCacheMetrics(): DetailedCacheMetrics {
    return JSON.parse(JSON.stringify(this.cacheMetrics));
  }

  /**
   * Get comprehensive performance report
   */
  getPerformanceReport(): {
    summary: PerformanceMetrics;
    cache: DetailedCacheMetrics;
    memory: {
      snapshots: number[];
      peakUsageMB: number;
      currentUsageMB: number;
      cleanupCount: number;
    };
    efficiency: {
      schemasPerSecond: number;
      filesPerSecond: number;
      cacheEfficiency: number;
      memoryEfficiency: number;
    };
  } {
    const currentMemory = process.memoryUsage();
    const totalTimeSeconds = this.metrics.totalProcessingTime / 1000;
    
    return {
      summary: this.getMetrics(),
      cache: this.getCacheMetrics(),
      memory: {
        snapshots: [...this.memorySnapshots],
        peakUsageMB: this.metrics.peakMemoryUsage / 1024 / 1024,
        currentUsageMB: currentMemory.heapUsed / 1024 / 1024,
        cleanupCount: this.metrics.memoryCleanupCount
      },
      efficiency: {
        schemasPerSecond: totalTimeSeconds > 0 ? this.metrics.schemasProcessed / totalTimeSeconds : 0,
        filesPerSecond: totalTimeSeconds > 0 ? this.metrics.filesGenerated / totalTimeSeconds : 0,
        cacheEfficiency: this.cacheMetrics.overall.hitRate,
        memoryEfficiency: this.memorySnapshots.length > 1 ? 
          1 - (this.memorySnapshots[this.memorySnapshots.length - 1] / Math.max(...this.memorySnapshots)) : 1
      }
    };
  }

  /**
   * Generate a formatted performance report
   */
  generateFormattedReport(): string {
    const report = this.getPerformanceReport();
    
    return `
=== PERFORMANCE REPORT ===

📊 SUMMARY
  Total Processing Time: ${report.summary.totalProcessingTime.toFixed(2)}ms
  Schemas Processed: ${report.summary.schemasProcessed}
  Files Generated: ${report.summary.filesGenerated}
  Average Schema Time: ${report.summary.averageSchemaProcessingTime.toFixed(2)}ms

⚡ EFFICIENCY
  Schemas/Second: ${report.efficiency.schemasPerSecond.toFixed(2)}
  Files/Second: ${report.efficiency.filesPerSecond.toFixed(2)}
  Cache Efficiency: ${(report.efficiency.cacheEfficiency * 100).toFixed(1)}%
  Memory Efficiency: ${(report.efficiency.memoryEfficiency * 100).toFixed(1)}%

🎯 CACHE PERFORMANCE
  Overall Hit Rate: ${(report.cache.overall.hitRate * 100).toFixed(1)}%
  Total Requests: ${report.cache.overall.totalRequests}
  Cache Hits: ${report.cache.overall.hits}
  Cache Misses: ${report.cache.overall.misses}
  Evictions: ${report.cache.overall.evictions}

  Schema Cache: ${(report.cache.schema.hitRate * 100).toFixed(1)}% hit rate (${report.cache.schema.hits}/${report.cache.schema.totalRequests})
  Composition Cache: ${(report.cache.composition.hitRate * 100).toFixed(1)}% hit rate (${report.cache.composition.hits}/${report.cache.composition.totalRequests})
  Reference Cache: ${(report.cache.reference.hitRate * 100).toFixed(1)}% hit rate (${report.cache.reference.hits}/${report.cache.reference.totalRequests})

💾 MEMORY USAGE
  Peak Memory: ${report.memory.peakUsageMB.toFixed(2)} MB
  Current Memory: ${report.memory.currentUsageMB.toFixed(2)} MB
  Memory Cleanups: ${report.memory.cleanupCount}

⏱️ TIMING BREAKDOWN
  Schema Resolution: ${report.summary.schemaResolutionTime.toFixed(2)}ms (${(report.summary.schemaResolutionTime / report.summary.totalProcessingTime * 100).toFixed(1)}%)
  Cache Operations: ${report.summary.cacheOperationTime.toFixed(2)}ms (${(report.summary.cacheOperationTime / report.summary.totalProcessingTime * 100).toFixed(1)}%)
  Memory Cleanup: ${report.summary.memoryCleanupTime.toFixed(2)}ms (${(report.summary.memoryCleanupTime / report.summary.totalProcessingTime * 100).toFixed(1)}%)
  Parallel Processing: ${report.summary.parallelProcessingTime.toFixed(2)}ms (${(report.summary.parallelProcessingTime / report.summary.totalProcessingTime * 100).toFixed(1)}%)

========================
`;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = {
      totalProcessingTime: 0,
      schemaResolutionTime: 0,
      cacheOperationTime: 0,
      memoryCleanupTime: 0,
      parallelProcessingTime: 0,
      schemasProcessed: 0,
      filesGenerated: 0,
      averageSchemaProcessingTime: 0,
      peakMemoryUsage: 0,
      memoryCleanupCount: 0
    };

    this.cacheMetrics = {
      schema: this.createEmptyCacheMetrics(),
      composition: this.createEmptyCacheMetrics(),
      reference: this.createEmptyCacheMetrics(),
      overall: this.createEmptyCacheMetrics()
    };

    this.timers.clear();
    this.memorySnapshots = [];
    this.startTime = 0;
  }

  /**
   * Export metrics to JSON
   */
  exportMetrics(): string {
    return JSON.stringify(this.getPerformanceReport(), null, 2);
  }
}