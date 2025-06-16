import { AsyncProcessor, ProcessingTask } from '../async-processor';

describe('AsyncProcessor', () => {
  let processor: AsyncProcessor;

  beforeEach(() => {
    processor = new AsyncProcessor();
  });

  afterEach(async () => {
    await processor.shutdown();
  });

  describe('constructor', () => {
    test('should initialize with default options', () => {
      expect(processor).toBeInstanceOf(AsyncProcessor);
    });

    test('should accept custom options', () => {
      const customProcessor = new AsyncProcessor({
        maxConcurrency: 10,
        queueSize: 1000,
        timeout: 30000
      });
      expect(customProcessor).toBeInstanceOf(AsyncProcessor);
    });
  });

  describe('task processing', () => {
    test('should process simple task', async () => {
      const mockTask: ProcessingTask = {
        id: 'test-1',
        type: 'simple',
        data: { value: 42 },
        execute: jest.fn().mockResolvedValue({ result: 'success' })
      };

      const result = await processor.addTask(mockTask);

      expect(result).toEqual({ result: 'success' });
      expect(mockTask.execute).toHaveBeenCalledWith({ value: 42 });
    });

    test('should handle task failure', async () => {
      const mockTask: ProcessingTask = {
        id: 'test-2',
        type: 'failing',
        data: {},
        execute: jest.fn().mockRejectedValue(new Error('Task failed'))
      };

      await expect(processor.addTask(mockTask)).rejects.toThrow('Task failed');
    });

    test('should respect concurrency limits', async () => {
      const limitedProcessor = new AsyncProcessor({ maxConcurrency: 2 });
      let concurrentTasks = 0;
      let maxConcurrent = 0;

      const createTask = (id: string): ProcessingTask => ({
        id,
        type: 'concurrent',
        data: {},
        execute: async () => {
          concurrentTasks++;
          maxConcurrent = Math.max(maxConcurrent, concurrentTasks);
          await new Promise(resolve => setTimeout(resolve, 100));
          concurrentTasks--;
          return { id };
        }
      });

      const tasks = Array.from({ length: 5 }, (_, i) => createTask(`task-${i}`));
      const promises = tasks.map(task => limitedProcessor.addTask(task));

      await Promise.all(promises);
      await limitedProcessor.shutdown();

      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    test('should handle task timeout', async () => {
      const timeoutProcessor = new AsyncProcessor({ timeout: 100 });
      
      const slowTask: ProcessingTask = {
        id: 'slow-task',
        type: 'slow',
        data: {},
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 200));
          return { result: 'late' };
        }
      };

      await expect(timeoutProcessor.addTask(slowTask)).rejects.toThrow();
      await timeoutProcessor.shutdown();
    });

    test('should process tasks in order when concurrency is 1', async () => {
      const sequentialProcessor = new AsyncProcessor({ maxConcurrency: 1 });
      const executionOrder: string[] = [];

      const createTask = (id: string): ProcessingTask => ({
        id,
        type: 'sequential',
        data: {},
        execute: async () => {
          executionOrder.push(id);
          await new Promise(resolve => setTimeout(resolve, 10));
          return { id };
        }
      });

      const tasks = ['task-1', 'task-2', 'task-3'].map(createTask);
      const promises = tasks.map(task => sequentialProcessor.addTask(task));

      await Promise.all(promises);
      await sequentialProcessor.shutdown();

      expect(executionOrder).toEqual(['task-1', 'task-2', 'task-3']);
    });
  });

  describe('queue management', () => {
    test('should respect queue size limits', async () => {
      const smallQueueProcessor = new AsyncProcessor({ 
        maxConcurrency: 1,
        queueSize: 2
      });

      const longTask: ProcessingTask = {
        id: 'long-task',
        type: 'long',
        data: {},
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return { result: 'done' };
        }
      };

      const quickTask = (id: string): ProcessingTask => ({
        id,
        type: 'quick',
        data: {},
        execute: async () => ({ id })
      });

      // Start long task to block queue
      const longPromise = smallQueueProcessor.addTask(longTask);

      // Add tasks to fill queue
      const task1Promise = smallQueueProcessor.addTask(quickTask('task-1'));
      const task2Promise = smallQueueProcessor.addTask(quickTask('task-2'));

      // This should fail due to queue size limit
      await expect(
        smallQueueProcessor.addTask(quickTask('task-3'))
      ).rejects.toThrow();

      await Promise.all([longPromise, task1Promise, task2Promise]);
      await smallQueueProcessor.shutdown();
    });

    test('should provide queue statistics', () => {
      const stats = processor.getStats();

      expect(stats).toHaveProperty('queueSize');
      expect(stats).toHaveProperty('activeTasks');
      expect(stats).toHaveProperty('completedTasks');
      expect(stats).toHaveProperty('failedTasks');
      expect(typeof stats.queueSize).toBe('number');
      expect(typeof stats.activeTasks).toBe('number');
      expect(typeof stats.completedTasks).toBe('number');
      expect(typeof stats.failedTasks).toBe('number');
    });

    test('should update statistics correctly', async () => {
      const initialStats = processor.getStats();

      const successTask: ProcessingTask = {
        id: 'success-task',
        type: 'success',
        data: {},
        execute: jest.fn().mockResolvedValue({ result: 'ok' })
      };

      const failTask: ProcessingTask = {
        id: 'fail-task',
        type: 'fail',
        data: {},
        execute: jest.fn().mockRejectedValue(new Error('Failed'))
      };

      await processor.addTask(successTask);
      await expect(processor.addTask(failTask)).rejects.toThrow();

      const finalStats = processor.getStats();

      expect(finalStats.completedTasks).toBe(initialStats.completedTasks + 1);
      expect(finalStats.failedTasks).toBe(initialStats.failedTasks + 1);
    });
  });

  describe('error handling', () => {
    test('should handle task execution errors gracefully', async () => {
      const errorTask: ProcessingTask = {
        id: 'error-task',
        type: 'error',
        data: {},
        execute: jest.fn().mockRejectedValue(new Error('Execution error'))
      };

      await expect(processor.addTask(errorTask)).rejects.toThrow('Execution error');

      // Processor should still be functional after error
      const goodTask: ProcessingTask = {
        id: 'good-task',
        type: 'good',
        data: {},
        execute: jest.fn().mockResolvedValue({ result: 'success' })
      };

      const result = await processor.addTask(goodTask);
      expect(result).toEqual({ result: 'success' });
    });

    test('should handle invalid tasks', async () => {
      const invalidTask = {
        id: 'invalid',
        type: 'invalid',
        data: {},
        // Missing execute function
      } as any;

      await expect(processor.addTask(invalidTask)).rejects.toThrow();
    });

    test('should handle null/undefined data', async () => {
      const taskWithNullData: ProcessingTask = {
        id: 'null-data',
        type: 'null',
        data: null,
        execute: jest.fn().mockResolvedValue({ result: 'ok' })
      };

      const result = await processor.addTask(taskWithNullData);
      expect(result).toEqual({ result: 'ok' });
      expect(taskWithNullData.execute).toHaveBeenCalledWith(null);
    });
  });

  describe('lifecycle management', () => {
    test('should shutdown gracefully', async () => {
      const task: ProcessingTask = {
        id: 'shutdown-task',
        type: 'shutdown',
        data: {},
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return { result: 'completed' };
        }
      };

      const promise = processor.addTask(task);
      await processor.shutdown();
      
      const result = await promise;
      expect(result).toEqual({ result: 'completed' });
    });

    test('should reject new tasks after shutdown', async () => {
      await processor.shutdown();

      const task: ProcessingTask = {
        id: 'post-shutdown',
        type: 'rejected',
        data: {},
        execute: jest.fn()
      };

      await expect(processor.addTask(task)).rejects.toThrow();
    });

    test('should handle shutdown with pending tasks', async () => {
      const slowTask: ProcessingTask = {
        id: 'slow-shutdown',
        type: 'slow',
        data: {},
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 200));
          return { result: 'slow-done' };
        }
      };

      const quickTask: ProcessingTask = {
        id: 'quick-shutdown',
        type: 'quick',
        data: {},
        execute: async () => ({ result: 'quick-done' })
      };

      const slowPromise = processor.addTask(slowTask);
      const quickPromise = processor.addTask(quickTask);

      await processor.shutdown();

      // Both tasks should complete
      const [slowResult, quickResult] = await Promise.all([slowPromise, quickPromise]);
      expect(slowResult).toEqual({ result: 'slow-done' });
      expect(quickResult).toEqual({ result: 'quick-done' });
    });
  });

  describe('priority handling', () => {
    test('should process high priority tasks first', async () => {
      const priorityProcessor = new AsyncProcessor({ maxConcurrency: 1 });
      const executionOrder: string[] = [];

      const createTask = (id: string, priority: 'high' | 'normal' | 'low' = 'normal'): ProcessingTask => ({
        id,
        type: 'priority',
        priority,
        data: {},
        execute: async () => {
          executionOrder.push(id);
          return { id };
        }
      });

      // Add tasks in mixed priority order
      const lowTask = priorityProcessor.addTask(createTask('low-1', 'low'));
      const highTask = priorityProcessor.addTask(createTask('high-1', 'high'));
      const normalTask = priorityProcessor.addTask(createTask('normal-1', 'normal'));
      const anotherHighTask = priorityProcessor.addTask(createTask('high-2', 'high'));

      await Promise.all([lowTask, highTask, normalTask, anotherHighTask]);
      await priorityProcessor.shutdown();

      // High priority tasks should execute before others
      const firstTwoTasks = executionOrder.slice(0, 2);
      expect(firstTwoTasks).toContain('high-1');
      expect(firstTwoTasks).toContain('high-2');
    });
  });

  describe('event handling', () => {
    test('should emit task completion events', async () => {
      const events: string[] = [];
      
      processor.on('taskCompleted', (taskId) => {
        events.push(`completed:${taskId}`);
      });

      processor.on('taskFailed', (taskId) => {
        events.push(`failed:${taskId}`);
      });

      const successTask: ProcessingTask = {
        id: 'event-success',
        type: 'event',
        data: {},
        execute: async () => ({ result: 'ok' })
      };

      const failTask: ProcessingTask = {
        id: 'event-fail',
        type: 'event',
        data: {},
        execute: async () => { throw new Error('Event test error'); }
      };

      await processor.addTask(successTask);
      await expect(processor.addTask(failTask)).rejects.toThrow();

      expect(events).toContain('completed:event-success');
      expect(events).toContain('failed:event-fail');
    });

    test('should emit queue status events', async () => {
      const queueEvents: string[] = [];
      
      processor.on('queueEmpty', () => {
        queueEvents.push('queue-empty');
      });

      processor.on('queueFull', () => {
        queueEvents.push('queue-full');
      });

      const task: ProcessingTask = {
        id: 'queue-event',
        type: 'queue',
        data: {},
        execute: async () => ({ result: 'ok' })
      };

      await processor.addTask(task);

      expect(queueEvents).toContain('queue-empty');
    });
  });
});