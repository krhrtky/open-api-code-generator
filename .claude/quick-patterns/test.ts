// Vibe Testing Pattern
// 使用例: describe('User Registration', () => { it('accepts valid user data', testScenario()...); });

import { describe, it, expect, beforeEach, afterEach } from 'test-framework';

// Test Builder Pattern
class TestBuilder<T> {
  private testData: Partial<T> = {};

  static for<T>(entityType: new () => T): TestBuilder<T> {
    return new TestBuilder<T>();
  }

  with(property: keyof T, value: T[keyof T]): TestBuilder<T> {
    this.testData[property] = value;
    return this;
  }

  build(): T {
    // Merge with default values
    const defaults = this.getDefaults();
    return { ...defaults, ...this.testData } as T;
  }

  private getDefaults(): Partial<T> {
    // Return sensible defaults for the entity
    return {} as Partial<T>;
  }
}

// Scenario Testing
class TestScenario {
  private setupSteps: Array<() => void | Promise<void>> = [];
  private actionSteps: Array<() => void | Promise<void>> = [];
  private assertionSteps: Array<() => void | Promise<void>> = [];

  given(description: string, setup: () => void | Promise<void>): TestScenario {
    console.log(`Given: ${description}`);
    this.setupSteps.push(setup);
    return this;
  }

  when(description: string, action: () => void | Promise<void>): TestScenario {
    console.log(`When: ${description}`);
    this.actionSteps.push(action);
    return this;
  }

  then(description: string, assertion: () => void | Promise<void>): TestScenario {
    console.log(`Then: ${description}`);
    this.assertionSteps.push(assertion);
    return this;
  }

  async run(): Promise<void> {
    // Execute setup steps
    for (const setup of this.setupSteps) {
      await setup();
    }

    // Execute action steps
    for (const action of this.actionSteps) {
      await action();
    }

    // Execute assertion steps
    for (const assertion of this.assertionSteps) {
      await assertion();
    }
  }
}

// Mock Builder
class MockBuilder<T> {
  private mockBehaviors: Map<keyof T, any> = new Map();
  private callTracker: Map<keyof T, any[]> = new Map();

  static for<T>(): MockBuilder<T> {
    return new MockBuilder<T>();
  }

  when(method: keyof T): {
    returns: (value: any) => MockBuilder<T>;
    throws: (error: Error) => MockBuilder<T>;
    calls: (callback: (...args: any[]) => any) => MockBuilder<T>;
  } {
    return {
      returns: (value: any) => {
        this.mockBehaviors.set(method, () => value);
        return this;
      },
      throws: (error: Error) => {
        this.mockBehaviors.set(method, () => { throw error; });
        return this;
      },
      calls: (callback: (...args: any[]) => any) => {
        this.mockBehaviors.set(method, callback);
        return this;
      }
    };
  }

  build(): T & MockTracker {
    const mock = new Proxy({} as T & MockTracker, {
      get: (target, prop) => {
        if (prop === 'wasCalledWith') {
          return (method: keyof T, ...args: any[]) => {
            const calls = this.callTracker.get(method) || [];
            return calls.some(callArgs => 
              JSON.stringify(callArgs) === JSON.stringify(args)
            );
          };
        }

        if (prop === 'callCount') {
          return (method: keyof T) => {
            return (this.callTracker.get(method) || []).length;
          };
        }

        const propKey = prop as keyof T;
        const behavior = this.mockBehaviors.get(propKey);
        
        if (behavior) {
          return (...args: any[]) => {
            // Track the call
            if (!this.callTracker.has(propKey)) {
              this.callTracker.set(propKey, []);
            }
            this.callTracker.get(propKey)!.push(args);

            // Execute behavior
            return behavior(...args);
          };
        }

        return undefined;
      }
    });

    return mock;
  }
}

interface MockTracker {
  wasCalledWith(method: string, ...args: any[]): boolean;
  callCount(method: string): number;
}

// Custom Matchers
const customMatchers = {
  toBeValid: (received: any) => {
    const isValid = received && typeof received.isValid === 'function' 
      ? received.isValid() 
      : !!received;
    
    return {
      message: () => `Expected ${received} to be valid`,
      pass: isValid
    };
  },

  toHaveProperty: (received: any, property: string, expectedValue?: any) => {
    const hasProperty = received && received.hasOwnProperty(property);
    const valueMatches = expectedValue === undefined || received[property] === expectedValue;
    
    return {
      message: () => `Expected ${received} to have property ${property}${expectedValue !== undefined ? ` with value ${expectedValue}` : ''}`,
      pass: hasProperty && valueMatches
    };
  },

  toMatchEntity: (received: any, expected: any) => {
    const receivedId = received?.id || received?.entityId;
    const expectedId = expected?.id || expected?.entityId;
    
    return {
      message: () => `Expected entities to match by ID`,
      pass: receivedId === expectedId
    };
  }
};

// Test Data Factory
class TestDataFactory {
  static create${EntityName}(overrides: Partial<${EntityName}Data> = {}): ${EntityName}Data {
    return {
      id: 'test-id',
      name: 'Test Entity',
      status: 'active',
      createdAt: new Date(),
      ...overrides
    };
  }

  static createUser(overrides: Partial<UserData> = {}): UserData {
    return {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      status: 'active',
      ...overrides
    };
  }

  static createInvalidUser(): UserData {
    return {
      id: '',
      email: 'invalid-email',
      name: '',
      status: 'unknown'
    } as UserData;
  }
}

// Test Suite Template
describe('${FeatureName}', () => {
  let service: ${ServiceName}Service;
  let mockRepository: Repository & MockTracker;
  let testData: ${EntityName}Data;

  beforeEach(() => {
    // Setup
    mockRepository = MockBuilder.for<Repository>()
      .when('save').returns(Promise.resolve())
      .when('findById').returns(Promise.resolve(null))
      .build();

    service = new ${ServiceName}Service({ repository: mockRepository });
    testData = TestDataFactory.create${EntityName}();
  });

  afterEach(() => {
    // Cleanup
  });

  describe('Creating ${EntityName}', () => {
    it('accepts valid data', async () => {
      await new TestScenario()
        .given('valid entity data', () => {
          testData = TestDataFactory.create${EntityName}({
            name: 'Valid Entity',
            status: 'active'
          });
        })
        .when('creating the entity', async () => {
          const result = await service.create(testData);
          expect(result.isOk()).toBe(true);
        })
        .then('entity is saved to repository', () => {
          expect(mockRepository.wasCalledWith('save', expect.any(Object))).toBe(true);
        })
        .then('entity has correct properties', () => {
          const entity = mockRepository.callCount('save') > 0;
          expect(entity).toBe(true);
        })
        .run();
    });

    it('rejects invalid data', async () => {
      await new TestScenario()
        .given('invalid entity data', () => {
          testData = TestDataFactory.createInvalid${EntityName}();
        })
        .when('attempting to create entity', async () => {
          const result = await service.create(testData);
          expect(result.isErr()).toBe(true);
        })
        .then('no entity is saved', () => {
          expect(mockRepository.callCount('save')).toBe(0);
        })
        .then('appropriate error is returned', () => {
          // Additional error checking
        })
        .run();
    });
  });

  describe('Querying ${EntityName}', () => {
    it('finds entity by id', async () => {
      const existingEntity = TestDataFactory.create${EntityName}();
      
      mockRepository = MockBuilder.for<Repository>()
        .when('findById').returns(Promise.resolve(existingEntity))
        .build();

      const result = await service.findById('test-id');

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toMatchEntity(existingEntity);
    });

    it('handles non-existent entity', async () => {
      mockRepository = MockBuilder.for<Repository>()
        .when('findById').returns(Promise.resolve(null))
        .build();

      const result = await service.findById('non-existent');

      expect(result.isErr()).toBe(true);
    });
  });

  describe('Business Rules', () => {
    it('enforces business rule X', async () => {
      // Test business logic
      const entity = TestDataFactory.create${EntityName}({ status: 'inactive' });
      
      const canPerformAction = entity.canPerformAction();
      
      expect(canPerformAction).toBe(false);
    });
  });

  describe('Error Scenarios', () => {
    it('handles database errors gracefully', async () => {
      mockRepository = MockBuilder.for<Repository>()
        .when('save').throws(new Error('Database connection failed'))
        .build();

      const result = await service.create(testData);

      expect(result.isErr()).toBe(true);
      expect(result.error.message).toContain('Database connection failed');
    });
  });
});

// Property-based testing example
describe('${EntityName} Properties', () => {
  it('maintains invariants', () => {
    // Generate random test data
    const testCases = Array.from({ length: 100 }, () => ({
      id: Math.random().toString(),
      name: Math.random().toString(36),
      value: Math.floor(Math.random() * 1000)
    }));

    testCases.forEach(testCase => {
      const entity = ${EntityName}.create(testCase.id, testCase.name, testCase.value);
      
      // Invariant: entity ID should never change
      expect(entity.id).toBe(testCase.id);
      
      // Invariant: entity should always be valid after creation
      expect(entity).toBeValid();
    });
  });
});

// Integration test template
describe('${FeatureName} Integration', () => {
  let database: TestDatabase;
  let realService: ${ServiceName}Service;

  beforeEach(async () => {
    database = new TestDatabase();
    await database.migrate();
    
    realService = new ${ServiceName}Service({
      repository: new Real${EntityName}Repository(database.connection)
    });
  });

  afterEach(async () => {
    await database.cleanup();
  });

  it('complete workflow works end-to-end', async () => {
    const entityData = TestDataFactory.create${EntityName}();
    
    // Create
    const createResult = await realService.create(entityData);
    expect(createResult.isOk()).toBe(true);
    
    const createdEntity = createResult.unwrap();
    
    // Read
    const findResult = await realService.findById(createdEntity.id);
    expect(findResult.isOk()).toBe(true);
    expect(findResult.unwrap()).toMatchEntity(createdEntity);
    
    // Update
    const updateResult = await realService.update(createdEntity.id, { name: 'Updated Name' });
    expect(updateResult.isOk()).toBe(true);
    
    // Verify update
    const updatedEntity = (await realService.findById(createdEntity.id)).unwrap();
    expect(updatedEntity.name).toBe('Updated Name');
  });
});

// Type definitions
interface ${EntityName}Data {
  id: string;
  name: string;
  status: string;
  createdAt?: Date;
}

interface UserData {
  id: string;
  email: string;
  name: string;
  status: string;
}

interface Repository {
  save(entity: any): Promise<void>;
  findById(id: string): Promise<any>;
  query(spec: any): Promise<any>;
}

class TestDatabase {
  async migrate(): Promise<void> {
    // Database migration logic
  }

  async cleanup(): Promise<void> {
    // Database cleanup logic
  }

  get connection(): any {
    // Return database connection
    return {};
  }
}